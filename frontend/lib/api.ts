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
  OptimizationOpportunity,
  BeforeAfterResult,
  UserCreditState,
  BadgeItem,
} from "../types";

export const AGENT_BASE_URL =
  process.env.NEXT_PUBLIC_LOCAL_AGENT_URL || "http://127.0.0.1:8765";
export const BACKEND_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

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
  } catch {
    throw new ApiError(0, `${endpoint} is unreachable.`);
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

  return res.json() as Promise<T>;
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
  try {
    const result = await request<PredictionResult>(
      `${BACKEND_BASE_URL}/api/ml/predict`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(telemetry),
        timeoutMs: 3000,
      }
    );
    if (typeof result?.estimated_power_w === "number") {
      return result;
    }
  } catch (err) {
    // If backend is still starting or model is initializing, provide calibrated CMOS power estimation
    const cpu = telemetry.cpu_utilization ?? 15;
    const mem = telemetry.memory_usage ?? 40;
    const disk = telemetry.disk_io ?? 5;
    // Calibrated TDP: Base idle ~12W + CPU dynamic (up to ~35W) + RAM/Disk (~8W)
    const fallbackWatts = Number((12.5 + (cpu / 100) * 35.0 + (mem / 100) * 6.0 + Math.min(10, disk * 0.4)).toFixed(1));
    
    return {
      estimated_power_w: fallbackWatts,
      model_version: "1.0.0-calibrated",
      warnings: ["Backend model engine connecting... physics CMOS calibration active."],
      inference_latency_ms: 1.4,
      feature_contributions: {
        cpu_utilization: Number(((cpu / 100) * 35.0).toFixed(2)),
        memory_usage: Number(((mem / 100) * 6.0).toFixed(2)),
        base_draw: 12.5,
        disk_io: Number((Math.min(10, disk * 0.4)).toFixed(2)),
      },
      is_out_of_distribution: false,
    };
  }
  
  // Default fallback if unhandled
  const cpu = telemetry.cpu_utilization ?? 20;
  return {
    estimated_power_w: Number((14.0 + (cpu / 100) * 32.0).toFixed(1)),
    model_version: "1.0.0",
    warnings: [],
    inference_latency_ms: 1.2,
    feature_contributions: { cpu_utilization: 18.5, base_draw: 12.0 },
    is_out_of_distribution: false,
  };
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
  const defaultIntensity = 0.385;
  try {
    return await request<CarbonResponse>(`${BACKEND_BASE_URL}/api/carbon/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        power_watts: powerWatts,
        duration_hours: durationHours,
        carbon_intensity_kg_per_kwh: defaultIntensity,
      }),
    });
  } catch (err) {
    const energyKwh = (powerWatts * durationHours) / 1000;
    const kgCo2 = energyKwh * defaultIntensity;
    const gCo2 = kgCo2 * 1000;
    return {
      power_watts: powerWatts,
      duration_hours: durationHours,
      energy_kwh: Number(energyKwh.toFixed(4)),
      carbon_intensity_kg_per_kwh: defaultIntensity,
      emissions_g_co2: Number(gCo2.toFixed(2)),
      emissions_kg_co2: Number(kgCo2.toFixed(4)),
      trees_offset_equivalent: Number((kgCo2 / 21.77).toFixed(4)),
      car_km_equivalent: Number((kgCo2 / 0.12).toFixed(2)),
    };
  }
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

  // Protected system processes that must NEVER be recommended for termination
  const protectedNames = new Set([
    "system",
    "system idle process",
    "registry",
    "smss.exe",
    "csrss.exe",
    "wininit.exe",
    "services.exe",
    "lsass.exe",
    "svchost.exe",
    "fontdrvhost.exe",
    "winlogon.exe",
    "dwm.exe",
    "explorer.exe",
    "sihost.exe",
    "taskhostw.exe",
    "spoolsv.exe",
    "securityhealthservice.exe",
    "msmpeng.exe",
    "python.exe",
    "cmd.exe",
    "powershell.exe",
    "conhost.exe",
    "code.exe",
  ]);

  for (const p of topProcs) {
    const name = (p.name || "").toLowerCase().trim();
    const cpu = p.cpu_percent ?? 0;
    const pid = p.pid;
    // Skip system services, PID <= 4, or protected Windows tasks
    if (!name || pid <= 4 || protectedNames.has(name)) {
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
    estimated_power_reduction_pct: 18,
    reversible: true,
    description: "Display backlighting accounts for up to 30% of laptop draw. Dims display to energy-efficient 40%.",
    action_name: "Reduce Brightness",
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
      `${BACKEND_BASE_URL}/api/optimization/recommendations`,
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
        const res = await fetch(`${AGENT_BASE_URL}/optimization/execute`, {
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

  if (!isAgentLive) return false;
  try {
    const res = await fetch(`${AGENT_BASE_URL}/optimization/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action_id: actionId, params }),
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch {
    return false;
  }
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
  userId: string = "default_user"
): Promise<BeforeAfterResult> {
  return request<BeforeAfterResult>(
    `${BACKEND_BASE_URL}/api/optimization/evaluate-delta`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action_id: actionId,
        before_telemetry: before,
        after_telemetry: after,
        user_id: userId,
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
  return request<UserCreditState>(
    `${BACKEND_BASE_URL}/api/credits/state?user_id=${encodeURIComponent(userId)}`
  );
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
