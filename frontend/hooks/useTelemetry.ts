// frontend/hooks/useTelemetry.ts
"use client";

/**
 * Server-state hooks for the live telemetry pipeline.
 *
 * Pattern decision (kept consistent across the app):
 *  - TanStack Query owns ALL server state; components never fetch in effects.
 *  - Live→demo fallback is explicit: if the Windows agent is unreachable we
 *    fetch the backend's demo telemetry and label the mode "demo". The mode
 *    is part of the query result so every consumer renders the same badge.
 *  - Prediction queries are keyed by telemetry timestamp, so each telemetry
 *    tick naturally produces exactly one ML inference (no double polling).
 */
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  checkAgentHealth,
  fetchTelemetry,
  fetchDemoTelemetry,
  predictPower,
  type DemoScenario,
} from "../lib/api";
import type { TelemetryData, PredictionResult } from "../types";

export type DataSourceMode = "live" | "demo" | "offline";

/** Central query-key registry — import from here, never inline keys. */
export const qk = {
  telemetry: ["telemetry"] as const,
  prediction: (tick: string | null) => ["prediction", tick] as const,
  credits: (userId: string) => ["credits", userId] as const,
  badges: (userId: string) => ["badges", userId] as const,
  marketplace: (userId: string) => ["marketplace", userId] as const,
};

interface TelemetryOptions {
  /** Backend demo scenario when the agent is offline. Default "normal". */
  demoScenario?: DemoScenario;
  /** Polling cadence in ms, or `false` to fetch once without polling. Default 2500. */
  refetchInterval?: number | false;
}

export interface TelemetryState {
  telemetry: TelemetryData | null;
  mode: DataSourceMode;
  /** True only when data comes from the local Windows agent. */
  isLive: boolean;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Polls telemetry every `refetchInterval`. Live agent first; on failure the
 * backend demo endpoint (contract: demo is always is_live:false). If BOTH are
 * down, mode is "offline" and consumers must render the error state.
 */
export function useTelemetry({
  demoScenario = "normal",
  refetchInterval = 2500,
}: TelemetryOptions = {}): TelemetryState {
  // Agent health is UI signal for explanatory copy; derived from the same
  // poll cycle rather than a second polling loop (cheaper, always in sync).
  const [agentOnline, setAgentOnline] = useState<boolean | null>(null);

  const query = useQuery({
    queryKey: qk.telemetry,
    refetchInterval,
    staleTime: 0,
    queryFn: async (): Promise<{ data: TelemetryData; mode: DataSourceMode }> => {
      try {
        const live = await fetchTelemetry();
        setAgentOnline(true);
        return { data: live, mode: "live" };
      } catch {
        // Agent down — labelled demo fallback, never silent.
        setAgentOnline(false);
        const demo = await fetchDemoTelemetry(demoScenario);
        return { data: demo, mode: "demo" };
      }
    },
  });

  // Re-check agent health occasionally so "Agent Offline" copy can recover
  // without a page reload. Lightweight (1.2s timeout), every 30s.
  useEffect(() => {
    const id = setInterval(() => {
      checkAgentHealth().then(setAgentOnline);
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  const isError = query.isError;
  return {
    telemetry: query.data?.data ?? null,
    mode: query.data?.mode ?? "offline",
    isLive: query.data?.mode === "live",
    isLoading: query.isPending,
    error: isError ? (query.error as Error) : null,
    refetch: () => void query.refetch(),
  };
}

/**
 * XGBoost power inference for the latest telemetry tick. Keyed by the
 * telemetry timestamp: new tick ⇒ new cache entry ⇒ exactly one POST per
 * tick. Disabled until telemetry exists.
 */
export function usePowerPrediction(telemetry: TelemetryData | null) {
  return useQuery({
    queryKey: qk.prediction(telemetry?.timestamp ?? null),
    enabled: telemetry !== null,
    staleTime: 0,
    queryFn: () => predictPower(telemetry as TelemetryData),
  });
}
