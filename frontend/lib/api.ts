// frontend/lib/api.ts
/**
 * GreenLedger — typed API client.
 * Single source of truth: docs/api-contract.md. Every request/response shape
 * here mirrors that file; when the backend deviates we surface a console
 * warning (dev) and a thrown ApiError the UI can render — never silent
 * coercion of missing fields.
 *
 * Dual connectivity:
 *  - Local Windows telemetry agent (NEXT_PUBLIC_LOCAL_AGENT_URL, :8765)
 *  - GreenLedger backend       (NEXT_PUBLIC_API_URL,        :8000)
 */

import {
  TelemetryData,
  PredictionResult,
  SequencePredictionResult,
  OptimizationOpportunity,
  BeforeAfterResult,
  UserCreditState,
  BadgeItem,
} from "../types";
import { AGENT_BASE_URL, BACKEND_BASE_URL } from "./config";

export { AGENT_BASE_URL, BACKEND_BASE_URL } from "./config";

const DEV = process.env.NODE_ENV !== "production";

/** Contract error carrying the backend's documented `{ detail }` format. */
export class ApiError extends Error {
  status: number;
  /** Seconds to wait, from the 429 Retry-After header (cooldown state). */
  retryAfterSeconds?: number;

  constructor(status: number, detail: string, retryAfterSeconds?: number) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Warn in dev when a response deviates from the documented contract. */
function warnContractMismatch(endpoint: string, problem: string) {
  if (DEV) {
    console.warn(
      `[GreenLedger] Contract mismatch on ${endpoint}: ${problem} — ` +
        `docs/api-contract.md is the source of truth.`
    );
  }
}

/** Standard fetch wrapper: parses `{ detail }` errors exactly per contract. */
async function request<T>(
  endpoint: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  const { timeoutMs, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(endpoint, {
      ...rest,
      signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
    });
  } catch (error) {
    const reason =
      error instanceof DOMException && error.name === "AbortError"
        ? "request timed out"
        : "network error or blocked by CORS";
    const message = `Unable to reach ${endpoint}: ${reason}.`;
    console.error("[GreenLedger] API request failed:", {
      endpoint,
      reason,
      error,
    });
    throw new ApiError(0, message);
  }

  if (!res.ok) {
    let detail = `Request failed with status ${res.status}.`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      // Non-JSON error body — keep the generic status message.
    }
    const retryAfter = res.headers.get("Retry-After");
    throw new ApiError(
      res.status,
      detail,
      retryAfter ? parseInt(retryAfter, 10) : undefined
    );
  }

  try {
    return (await res.json()) as T;
  } catch (error) {
    const message = `Backend returned invalid JSON for ${endpoint}.`;
    console.error("[GreenLedger] API response parse failed:", {
      endpoint,
      error,
    });
    throw new ApiError(0, message);
  }
}

/* ------------------------------------------------------------------ */
/* Telemetry — local Windows agent, backend demo fallback              */
/* ------------------------------------------------------------------ */

/** Health-checks the local Windows agent daemon (fast timeout: 1.2s). */
export async function checkAgentHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${AGENT_BASE_URL}/health`, {
      signal: AbortSignal.timeout(1200),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fetches live telemetry from the local agent ONLY.
 * Throws (never invents measurements) — callers decide whether to fall back
 * to the backend demo endpoint and label the screen DEMO.
 */
export async function fetchTelemetry(): Promise<TelemetryData> {
  let data: TelemetryData;
  try {
    const res = await fetch(`${AGENT_BASE_URL}/telemetry`, {
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) throw new Error(`agent responded ${res.status}`);
    data = await res.json();
  } catch {
    throw new ApiError(0, "Live Windows agent is unreachable.");
  }

  // The agent does not stamp is_live; the client does, per contract
  // ("before/after telemetry must carry is_live: true").
  if (data && typeof data === "object") {
    return { ...data, is_live: true, mode_label: "Live Windows device telemetry" };
  }
  warnContractMismatch("GET /telemetry (agent)", "response is not an object");
  throw new ApiError(0, "Live Windows agent returned malformed telemetry.");
}

export type DemoScenario = "normal" | "high_load" | "optimized";

/**
 * Backend-simulated telemetry (GET /api/telemetry/demo). Contract: always
 * `is_live: false` plus a `mode_label`. Used ONLY as a labelled fallback.
 */
export async function fetchDemoTelemetry(
  scenario: DemoScenario = "normal"
): Promise<TelemetryData> {
  const data = await request<TelemetryData>(
    `${BACKEND_BASE_URL}/api/telemetry/demo?scenario=${scenario}`,
    { timeoutMs: 2000 }
  );
  if (data.is_live !== false) {
    warnContractMismatch(
      "GET /api/telemetry/demo",
      "expected is_live=false per contract"
    );
  }
  return data;
}

/* ------------------------------------------------------------------ */
/* ML power prediction                                                 */
/* ------------------------------------------------------------------ */

/** POST /api/ml/predict — 422 when core telemetry missing, 503 model missing. */
export async function predictPower(telemetry: TelemetryData): Promise<PredictionResult> {
  const result = await request<PredictionResult>(
    "/api/ml/predict",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(telemetry),
      timeoutMs: 3000,
    }
  );
  if (typeof result?.estimated_power_w !== "number") {
    warnContractMismatch("POST /api/ml/predict", "missing estimated_power_w");
    throw new ApiError(502, "Power model returned no estimate.");
  }
  return result;
}

/**
 * POST /api/ml/predict-sequence — temporal LSTM quantiles for the last tick
 * of a trailing telemetry window. 503 when torch/artifact is unavailable
 * (callers degrade to the point estimate; intervals are a complement).
 */
export async function predictSequence(
  window: TelemetryData[]
): Promise<SequencePredictionResult> {
  const result = await request<SequencePredictionResult>(
    "/api/ml/predict-sequence",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telemetry_window: window }),
      timeoutMs: 8000,
    }
  );
  if (
    typeof result?.median_w !== "number" ||
    !Array.isArray(result?.interval_80_w)
  ) {
    warnContractMismatch("POST /api/ml/predict-sequence", "missing quantiles");
    throw new ApiError(502, "Temporal model returned no intervals.");
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Carbon translation                                                  */
/* ------------------------------------------------------------------ */

export interface CarbonResponse {
  power_watts: number;
  duration_hours: number;
  energy_kwh: number;
  carbon_intensity_kg_per_kwh: number;
  emissions_g_co2: number;
  emissions_kg_co2: number;
  trees_offset_equivalent: number;
  car_km_equivalent: number;
}

/**
 * POST /api/carbon/calculate — the backend owns ALL carbon math (per scope
 * rules the frontend never multiplies watts by factors itself). The dashboard
 * calls this with duration_hours=1 to get an hourly rate plus equivalents.
 */
export async function calculateCarbon(
  powerWatts: number,
  durationHours = 1
): Promise<CarbonResponse> {
  return request<CarbonResponse>("/api/carbon/calculate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      power_watts: powerWatts,
      duration_hours: durationHours,
      carbon_intensity_kg_per_kwh: 0.385,
    }),
  });
}

/* ------------------------------------------------------------------ */
/* Optimization loop                                                   */
/* ------------------------------------------------------------------ */

/**
 * Local-mode recommendations — mirrors the backend's logic so the Optimize
 * page stays fully usable when the backend (:8000) is unreachable or its
 * engine returns nothing. Process-level cards still require the live agent;
 * power-saver and brightness run through Next.js routes on this machine.
 */
function localRecommendations(telemetry: TelemetryData): OptimizationOpportunity[] {
  const recommendations: OptimizationOpportunity[] = [];
  const topProcs = telemetry.top_cpu_processes || [];

  // MUST mirror backend/services/optimization/engine.py OPTIMIZABLE_PROCESS_NAMES
  // and agent/config.py OPTIMIZABLE_PROCESS_CANDIDATES: only these everyday
  // user applications may ever be suggested for closing. Anything else is
  // skipped here and would additionally be rejected at execution time.
  const optimizableNames = new Set([
    "chrome.exe",
    "msedge.exe",
    "firefox.exe",
    "brave.exe",
    "opera.exe",
    "spotify.exe",
    "discord.exe",
    "slack.exe",
    "teams.exe",
    "zoom.exe",
    "steam.exe",
    "epicgameslauncher.exe",
    "dropbox.exe",
    "onedrive.exe",
    "notion.exe",
    "figma.exe",
  ]);

  for (const p of topProcs) {
    const name = (p.name || "").toLowerCase().trim();
    const cpu = p.cpu_percent ?? 0;
    const pid = p.pid;
    // Allowlist-only: skip PIDs <= 4 and anything that is not a known
    // optimizable user application (system services can never match).
    if (!name || pid <= 4 || !optimizableNames.has(name)) {
      continue;
    }
    if (cpu > 8.0) {
      recommendations.push({
        id: `close_process_${pid}`,
        title: `Suspend High-CPU App: ${p.name}`,
        category: "process_management",
        priority: cpu > 20.0 ? "high" : "medium",
        estimated_power_reduction_pct: null,
        reversible: false,
        description: `${p.name} is consuming ${cpu.toFixed(1)}% CPU cycles in the background.`,
        action_name: `Close ${p.name}`,
        pid: pid,
        process_name: p.name,
        cpu_percent: cpu,
        memory_percent: p.memory_percent ?? 0,
      });
    }
  }

  recommendations.push({
    id: "enable_power_saver",
    title: "Enable Windows Energy Saver Profile",
    category: "power_plan",
    priority: "high",
    estimated_power_reduction_pct: null,
    reversible: true,
    description: "Throttles aggressive core boost thresholds and reduces background indexers.",
    action_name: "Switch Power Plan",
  });

  recommendations.push({
    id: "reduce_brightness",
    title: "Reduce Screen Brightness to 40%",
    category: "display",
    priority: "medium",
    estimated_power_reduction_pct: null,
    reversible: true,
    description: "Display backlighting accounts for up to 30% of laptop draw. Dims display to energy-efficient 40%.",
    action_name: "Reduce Brightness",
  });

  recommendations.push({
    id: "eco_mode",
    title: "Activate Eco Mode Bundle",
    category: "eco_bundle",
    priority: "high",
    estimated_power_reduction_pct: null,
    reversible: true,
    description: "One verified cycle: display to 35%, Power Saver plan, 55% sustained CPU cap. Fully reversible.",
    action_name: "Activate Eco Mode",
  });

  return recommendations;
}

/**
 * POST /api/optimization/recommendations — backend derives safe actions from
 * raw telemetry. Only `enable_power_saver` / `close_process_<pid>` come back.
 * Falls back to the local mirror when the backend is unreachable or returns
 * nothing, so the Optimize page never renders an empty dead-end.
 */
export async function fetchRecommendations(
  telemetry: TelemetryData
): Promise<OptimizationOpportunity[]> {
  try {
    const recs = await request<OptimizationOpportunity[]>(
      "/api/backend/optimization/recommendations",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(telemetry),
        timeoutMs: 3000,
      }
    );
    if (Array.isArray(recs) && recs.length > 0) {
      return recs;
    }
    warnContractMismatch(
      "POST /api/optimization/recommendations",
      "empty recommendations — using the local mirror"
    );
  } catch {
    // Backend (:8000) unreachable or warming up — generate safe
    // recommendations locally so the flow keeps working.
  }
  return localRecommendations(telemetry);
}

/**
 * True when an action executes inside the local Windows agent process.
 * `enable_power_saver` and `reduce_brightness` are the exceptions — they run
 * through Next.js routes (/api/power-saver, /api/brightness) and work
 * whenever the Next server can reach powercfg/WMI, even when the agent
 * daemon is offline.
 */
export function isAgentAction(actionId: string): boolean {
  return actionId !== "reduce_brightness" && actionId !== "enable_power_saver";
}

/**
 * Executes a safe action. Process-level actions run inside the local Windows
 * agent (out of API contract scope — agent-owned endpoint). Power-plan and
 * display actions run through Next.js routes on this machine so they work
 * even when the agent daemon is offline. Returns false when the agent is
 * not available so the UI can block the flow instead of fabricating a
 * "before" snapshot.
 */
export async function executeOptimizationAction(
  actionId: string,
  params?: Record<string, unknown>,
  isAgentLive: boolean = false
): Promise<boolean> {
  // Power Saver: the live agent is preferred; when it's offline the Next.js
  // /api/power-saver route switches the plan via powercfg. The route's
  // failure detail is surfaced as an ApiError.
  if (actionId === "enable_power_saver") {
    if (isAgentLive) {
      try {
        const res = await fetch("/api/agent/optimization/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action_id: actionId, params }),
          signal: AbortSignal.timeout(4000),
        });
        if (res.ok) return true;
      } catch {
        /* agent failed/unreachable — fall through to the Next.js route */
      }
    }
    try {
      const res = await fetch("/api/power-saver", { method: "POST" });
      if (res.ok) return true;
      const body = await res.json().catch(() => null);
      throw new ApiError(
        res.status,
        body?.error ?? `Power plan service returned status ${res.status}.`
      );
    } catch (err) {
      if (err instanceof ApiError) throw err;
      return false; // network-level failure — generic handling upstream
    }
  }

  // Brightness reduction runs through the Next.js /api/brightness route
  // (Windows WMI) — NOT the agent — so it works even when the agent daemon
  // is offline. The route's failure detail is surfaced as an ApiError.
  if (actionId === "reduce_brightness") {
    try {
      const res = await fetch("/api/brightness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: 40 }),
      });
      if (res.ok) return true;
      const body = await res.json().catch(() => null);
      throw new ApiError(
        res.status,
        body?.error ?? `Brightness service returned status ${res.status}.`
      );
    } catch (err) {
      if (err instanceof ApiError) throw err;
      return false; // network-level failure — generic handling upstream
    }
  }

  // Eco Mode bundle: display to 35% (Next.js WMI route) + agent eco_core
  // (Power Saver plan + 55% CPU cap) as one verified cycle. Brightness 501
  // (external monitor without WMI) degrades honestly — the core still runs
  // and verification measures whatever actually changed.
  if (actionId === "eco_mode") {
    if (!isAgentLive) return false;
    try {
      const brightRes = await fetch("/api/brightness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: 35 }),
      });
      if (!brightRes.ok && brightRes.status !== 501) {
        const body = await brightRes.json().catch(() => null);
        throw new ApiError(
          brightRes.status,
          body?.error ?? `Brightness service returned status ${brightRes.status}.`
        );
      }
      const coreRes = await fetch("/api/agent/optimization/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action_id: "eco_core", params }),
        signal: AbortSignal.timeout(8000),
      });
      if (!coreRes.ok) {
        const body = await coreRes.json().catch(() => null);
        throw new ApiError(
          coreRes.status,
          body?.detail ?? body?.error ?? "The local agent rejected the Eco Core action."
        );
      }
      return true;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      return false;
    }
  }

  if (!isAgentLive) return false;
  try {
    const res = await fetch("/api/agent/optimization/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action_id: actionId, params }),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) return true;
    const body = await res.json().catch(() => null);
    throw new ApiError(
      res.status,
      body?.detail ?? body?.error ?? "The local agent rejected the process action."
    );
  } catch (err) {
    if (err instanceof ApiError) throw err;
    return false;
  }
}

/** Restores the exact state captured by a reversible optimization action. */
export async function rollbackOptimizationAction(
  actionId: string,
  isAgentLive: boolean
): Promise<void> {
  if (actionId === "reduce_brightness") {
    const res = await fetch("/api/brightness", { method: "PUT" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new ApiError(res.status, body?.error ?? "Brightness rollback failed.");
    }
    return;
  }
  if (actionId === "eco_mode") {
    if (!isAgentLive) throw new ApiError(0, "Eco rollback requires the live Windows agent.");
    const failures: string[] = [];
    try {
      const brightRes = await fetch("/api/brightness", { method: "PUT" });
      if (!brightRes.ok) failures.push("brightness");
    } catch {
      failures.push("brightness");
    }
    try {
      const coreRes = await fetch("/api/agent/optimization/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action_id: "eco_core" }),
        signal: AbortSignal.timeout(8000),
      });
      if (!coreRes.ok) failures.push("eco core");
    } catch {
      failures.push("eco core");
    }
    if (failures.length > 0) {
      throw new ApiError(500, `Eco rollback incomplete (failed: ${failures.join(", ")}).`);
    }
    return;
  }
  if (actionId === "enable_power_saver" || actionId === "cap_cpu_55") {
    if (!isAgentLive) throw new ApiError(0, "Agent rollback requires the live Windows agent.");
    const res = await fetch("/api/agent/optimization/undo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action_id: actionId }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new ApiError(res.status, body?.detail ?? "Agent rollback failed.");
    }
    return;
  }
  throw new ApiError(422, "This process action cannot be restored automatically.");
}

/**
 * POST /api/optimization/evaluate-delta — verified reduction + credits.
 * Surfaces contract errors: 422 (whitelist/duplicate/non-live/identical),
 * 429 (cooldown, with Retry-After), 503 (model missing).
 */
export async function evaluateOptimizationDelta(
  actionId: string,
  before: TelemetryData,
  after: TelemetryData,
  userId: string = "default_user",
  windows?: { before_window?: TelemetryData[]; after_window?: TelemetryData[] },
  predictedNetW?: number | null
): Promise<BeforeAfterResult> {
  return request<BeforeAfterResult>(
    "/api/backend/optimization/evaluate-delta",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action_id: actionId,
        before_telemetry: before,
        after_telemetry: after,
        user_id: userId,
        ...(windows?.before_window ? { before_window: windows.before_window } : {}),
        ...(windows?.after_window ? { after_window: windows.after_window } : {}),
        ...(typeof predictedNetW === "number" ? { predicted_net_w: predictedNetW } : {}),
      }),
    }
  );
}

/* ------------------------------------------------------------------ */
/* Credits, badges, marketplace                                        */
/* ------------------------------------------------------------------ */

/** GET /api/credits/state — balance, streak, rank, recent transactions. */
export async function fetchCreditState(
  userId: string = "default_user"
): Promise<UserCreditState> {
  const state = await request<UserCreditState>(
    `${BACKEND_BASE_URL}/api/credits/state?user_id=${encodeURIComponent(userId)}`
  );
  const requiredFields: (keyof UserCreditState)[] = [
    "user_id",
    "credit_balance",
    "lifetime_reduction_g_co2",
    "lifetime_energy_saved_kwh",
    "total_optimizations",
    "current_streak_days",
    "rank_title",
    "recent_transactions",
  ];
  const missingFields = requiredFields.filter(
    (field) => !(field in Object(state))
  );
  if (missingFields.length > 0 || !Array.isArray(state.recent_transactions)) {
    const detail =
      missingFields.length > 0
        ? `missing fields: ${missingFields.join(", ")}`
        : "recent_transactions is not an array";
    const message = `Backend returned an invalid credit state (${detail}).`;
    console.error("[GreenLedger] Credit state contract mismatch:", {
      endpoint: "/api/credits/state",
      detail,
      response: state,
    });
    throw new ApiError(0, message);
  }
  return state;
}

/** GET /api/badges/list — 5-badge catalog with per-user unlock state. */
export async function fetchBadges(
  userId: string = "default_user"
): Promise<BadgeItem[]> {
  const badges = await request<BadgeItem[]>(
    `${BACKEND_BASE_URL}/api/badges/list?user_id=${encodeURIComponent(userId)}`
  );
  if (!Array.isArray(badges)) {
    warnContractMismatch("GET /api/badges/list", "expected an array");
  }
  return badges;
}

export interface MarketplaceCatalog {
  currency: string;
  user_balance: number;
  items: BadgeItem[];
}

/** GET /api/marketplace/catalog — balance + purchasable items in one call. */
export async function fetchMarketplaceCatalog(
  userId: string = "default_user"
): Promise<MarketplaceCatalog> {
  const catalog = await request<MarketplaceCatalog>(
    `${BACKEND_BASE_URL}/api/marketplace/catalog?user_id=${encodeURIComponent(userId)}`
  );
  if (!catalog || !Array.isArray(catalog.items)) {
    warnContractMismatch(
      "GET /api/marketplace/catalog",
      "missing items array"
    );
  }
  return catalog;
}

export interface PurchaseResult {
  success: boolean;
  message?: string;
  badge?: BadgeItem;
  new_balance?: number;
}

/**
 * POST /api/marketplace/purchase — business rejections arrive as 400 with a
 * readable detail ("Insufficient Green Credits…", "You already own…").
 */
export async function purchaseBadge(
  badgeId: string,
  userId: string = "default_user"
): Promise<PurchaseResult> {
  try {
    return await request<PurchaseResult>(
      `${BACKEND_BASE_URL}/api/marketplace/purchase`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ badge_id: badgeId, user_id: userId }),
      }
    );
  } catch (err) {
    if (err instanceof ApiError) {
      return { success: false, message: err.message };
    }
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/* Blockchain verification                                             */
/* ------------------------------------------------------------------ */

export interface MintVerificationResponse {
  verified: boolean;
  tx_hash: string;
  token_id: number;
  badge_id: string;
  user_wallet: string;
  explorer_url: string;
  message: string;
}

/**
 * POST /api/blockchain/verify-mint — server-side fail-closed verification.
 * 503 means the receipt could not be verified; nothing is recorded.
 * Contract note: identity is the wallet, so `user_id` is omitted (the
 * contract documents the frontend currently omits it).
 */
export async function verifyMintOnBackend(
  badgeId: string,
  txHash: string,
  tokenId: number,
  userWallet: string
): Promise<MintVerificationResponse | { verified: false }> {
  try {
    return await request<MintVerificationResponse>(
      `${BACKEND_BASE_URL}/api/blockchain/verify-mint`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          badge_id: badgeId,
          tx_hash: txHash,
          token_id: tokenId,
          user_wallet: userWallet,
        }),
      }
    );
  } catch (err) {
    if (err instanceof ApiError) {
      warnContractMismatch(
        "POST /api/blockchain/verify-mint",
        `verification failed: ${err.message}`
      );
      return { verified: false };
    }
    throw err;
  }
}
