// frontend/hooks/useCarbon.ts
"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { calculateCarbon } from "../lib/api";

/**
 * Hourly carbon rate for the current power estimate.
 *
 * Keyed by ROUNDED watts so tiny telemetry jitter doesn't spawn a new cache
 * entry every tick. `keepPreviousData` holds the last value while the next
 * tick resolves — at a 2.5s cadence, skeleton-flicker would be worse than a
 * one-tick-stale rate (flagged tradeoff, chose stability).
 */
export function useCarbonEstimate(powerWatts: number | null) {
  return useQuery({
    queryKey: ["carbon", powerWatts === null ? null : powerWatts.toFixed(1)],
    enabled: powerWatts !== null,
    staleTime: 0,
    placeholderData: keepPreviousData,
    queryFn: () => calculateCarbon(powerWatts as number, 1),
  });
}
