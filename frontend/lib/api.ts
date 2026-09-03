/**
 * GreenLedger - API Client
 * Manages dual connectivity: Local Windows Telemetry Agent (http://127.0.0.1:8765)
 * and Cloud / Local FastAPI Backend (http://127.0.0.1:8000).
 */

import { TelemetryData, PredictionResult, OptimizationOpportunity, BeforeAfterResult, UserCreditState, BadgeItem } from "../types";

export const AGENT_BASE_URL = process.env.NEXT_PUBLIC_LOCAL_AGENT_URL || "http://127.0.0.1:8765";
export const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

/**
 * Checks if the local Windows agent daemon is running.
 */
export async function checkAgentHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${AGENT_BASE_URL}/health`, { 
      method: "GET",
      signal: AbortSignal.timeout(1200) 
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fetches latest telemetry from the local Windows agent only.
 */
export async function fetchTelemetry(): Promise<TelemetryData> {
  try {
    const res = await fetch(`${AGENT_BASE_URL}/telemetry`, {
      signal: AbortSignal.timeout(1500)
    });
    if (res.ok) {
      const data = await res.json();
      return { ...data, is_live: true, mode_label: "Live Windows device telemetry" };
    }
  } catch {
    // Report the unavailable state to the page without inventing measurements.
  }
  throw new Error("Live Windows telemetry unavailable: start the local agent.");
}

/**
 * Calls XGBoost ML Inference Engine for honest power estimation.
 */
export async function predictPower(telemetry: TelemetryData): Promise<PredictionResult> {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/ml/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(telemetry),
      signal: AbortSignal.timeout(2000)
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn("ML predict network error, using physics baseline:", e);
  }

  throw new Error("Power estimate unavailable: backend ML service is unreachable.");
}

/**
 * Fetches optimization opportunities for current system state.
 */
export async function fetchRecommendations(telemetry: TelemetryData, isAgentLive: boolean): Promise<OptimizationOpportunity[]> {
  if (isAgentLive) {
    try {
      const res = await fetch(`${AGENT_BASE_URL}/optimization/recommendations`, {
        signal: AbortSignal.timeout(1500)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
  }

  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/optimization/recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(telemetry),
      signal: AbortSignal.timeout(2000)
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {}

  throw new Error("Optimization recommendations unavailable: agent and backend are unreachable.");
}

/**
 * Executes safe optimization action.
 */
export async function executeOptimizationAction(actionId: string, params?: any, isAgentLive: boolean = false): Promise<boolean> {
  if (isAgentLive) {
    try {
      const res = await fetch(`${AGENT_BASE_URL}/optimization/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action_id: actionId, params })
      });
      return res.ok;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Evaluates before/after optimization impact and calculates green credit rewards.
 */
export async function evaluateOptimizationDelta(
  actionId: string,
  before: TelemetryData,
  after: TelemetryData,
  userId: string = "default_user"
): Promise<BeforeAfterResult> {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/optimization/evaluate-delta`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action_id: actionId,
        before_telemetry: before,
        after_telemetry: after,
        user_id: userId
      })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {}

  throw new Error("Optimization result unavailable: backend verification service is unreachable.");
}

/**
 * Fetches user credit state, streak, and recent history.
 */
export async function fetchCreditState(userId: string = "default_user"): Promise<UserCreditState> {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/credits/state?user_id=${userId}`);
    if (res.ok) {
      return await res.json();
    }
  } catch {}

  throw new Error("Credit state unavailable: backend is unreachable.");
}

/**
 * Fetches marketplace badges.
 */
export async function fetchBadges(userId: string = "default_user"): Promise<BadgeItem[]> {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/badges/list?user_id=${userId}`);
    if (res.ok) {
      return await res.json();
    }
  } catch {}

  throw new Error("Badge catalog unavailable: backend is unreachable.");
}

/**
 * Purchases badge using Green Credits.
 */
export async function purchaseBadge(badgeId: string, userId: string = "default_user"): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/marketplace/purchase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ badge_id: badgeId, user_id: userId })
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.detail || "Purchase failed" };
    return data;
  } catch (e: any) {
    return { success: false, error: e.message || "Network error" };
  }
}

/**
 * Records verified Sepolia minting.
 */
export async function verifyMintOnBackend(badgeId: string, txHash: string, tokenId: number, userWallet: string): Promise<any> {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/blockchain/verify-mint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        badge_id: badgeId,
        tx_hash: txHash,
        token_id: tokenId,
        user_wallet: userWallet
      })
    });
    return await res.json();
  } catch (e) {
    console.error("Backend mint verification error:", e);
    return { verified: false };
  }
}

