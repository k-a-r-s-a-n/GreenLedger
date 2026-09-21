// frontend/app/dashboard/page.tsx
"use client";

/**
 * Live dashboard — server state via TanStack Query hooks only.
 * Data modes:
 *  - live  → green LIVE badge, agent telemetry
 *  - demo  → amber DEMO badge, backend-simulated telemetry (agent offline)
 *  - offline → both unreachable; explicit error panel, no invented values
 *
 * Visual & sliding upgrades:
 *  - Integrated 3D WebGL Energy Core model with real-time telemetry reaction.
 *  - Interactive Sliding Dashboard Deck (Energy Core, Telemetry Counters, Carbon Trajectory, ML Attributions)
 *    replacing static stacked panels with smooth sliding deck navigation.
 */
import React, { useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Sparkles,
  Gauge,
  Leaf,
  Sliders,
} from "lucide-react";
import { Navbar } from "../../components/Navbar";
import { Footer } from "../../components/Footer";
import { ModeBadge } from "../../components/ModeBadge";
import { GlassPanel } from "../../components/GlassPanel";
import { StatCard } from "../../components/StatCard";
import { Skeleton } from "../../components/Skeleton";
import { ErrorPanel } from "../../components/ErrorPanel";
import { Button } from "../../components/Button";
import { useTelemetry, usePowerPrediction } from "../../hooks/useTelemetry";
import { useCarbonEstimate } from "../../hooks/useCarbon";
import { ScrollDashboardDeck } from "../../components/ScrollDashboardDeck";

interface HistoryPoint {
  time: string;
  power: number;
  cpu: number;
  carbon: number;
}

export default function DashboardPage() {
  const [history, setHistory] = useState<HistoryPoint[]>([]);

  const {
    telemetry,
    mode,
    isLive,
    isLoading,
    error,
    refetch,
  } = useTelemetry({ refetchInterval: 2500 });

  const prediction = usePowerPrediction(telemetry);
  const estimatedPower = prediction.data?.estimated_power_w ?? null;
  const carbon = useCarbonEstimate(estimatedPower);
  const carbonRatePerHour = carbon.data?.emissions_g_co2 ?? null;

  // Rolling 25-tick history — derived from each accepted prediction tick.
  React.useEffect(() => {
    if (!telemetry || estimatedPower === null || carbonRatePerHour === null) return;
    setHistory((prev) => {
      const next = [
        ...prev,
        {
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
          power: estimatedPower,
          cpu: telemetry.cpu_utilization,
          carbon: carbonRatePerHour,
        },
      ];
      return next.slice(-25);
    });
  }, [telemetry?.timestamp, estimatedPower, carbonRatePerHour]);

  // Transparent, labelled client heuristic
  const cpuLoad = telemetry?.cpu_utilization ?? null;
  const memLoad = telemetry?.memory_usage ?? null;
  const energyScore =
    cpuLoad === null || memLoad === null || estimatedPower === null
      ? null
      : Math.max(
          10,
          Math.min(
            100,
            Math.round(
              100 - (cpuLoad * 0.35 + memLoad * 0.25 + (estimatedPower / 80) * 40)
            )
          )
        );

  const bothDown = mode === "offline" && !isLoading;

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <Navbar dataSourceMode={mode} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-7">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-3xl sm:text-4xl tracking-display text-white">
                Energy monitor
              </h1>
              <ModeBadge mode={mode} />
            </div>
            <p className="text-xs font-mono text-white/40 mt-1.5">
              {isLive
                ? "Live from the local Windows agent · auto-refresh 2.5s"
                : mode === "demo"
                ? "Simulated demo telemetry — not this machine · auto-refresh 2.5s"
                : "Waiting for a data source…"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/optimize" className="shrink-0">
              <Button variant="secondary">
                Optimize now
                <ArrowUpRight className="w-4 h-4" aria-hidden />
              </Button>
            </Link>
          </div>
        </div>

        {/* Explicit failure state */}
        {bothDown && (
          <ErrorPanel
            title="No data source reachable"
            message="The Windows agent is offline and the backend demo endpoint is unreachable. Start the backend (port 8000) or the agent (port 8765) — no values will be estimated in the meantime."
            onRetry={refetch}
          />
        )}
        {!bothDown && error && (
          <ErrorPanel compact title="Telemetry hiccup" message={error.message} onRetry={refetch} />
        )}

        {/* Primary stat row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <GlassPanel intensity="accent" className="p-4 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-widest text-white/45 font-mono">
                Estimated power
              </p>
              <Gauge className="w-4 h-4 text-emerald-400" aria-hidden />
            </div>
            {prediction.isPending && !estimatedPower ? (
              <Skeleton className="h-10 w-28 mt-2" />
            ) : (
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-4xl font-semibold font-mono tracking-tight-2 text-white">
                  {estimatedPower != null ? estimatedPower.toFixed(1) : "—"}
                </span>
                <span className="text-xs font-mono text-white/45">W</span>
              </div>
            )}
            <p className="mt-1.5 text-[11px] font-mono text-white/40 truncate">
              {prediction.data
                ? `XGBoost v${prediction.data.model_version} · ${prediction.data.inference_latency_ms.toFixed(2)} ms`
                : prediction.isError
                ? "ML backend unavailable — retrying"
                : "waiting for inference"}
            </p>
            {prediction.isError && (
              <button
                type="button"
                onClick={() => void prediction.refetch()}
                className="mt-1 text-[11px] font-mono text-amber-300 hover:text-amber-200"
              >
                Retry XGBoost inference
              </button>
            )}
            {prediction.data?.is_out_of_distribution && (
              <p className="mt-1 text-[11px] font-mono text-amber-300">
                Out-of-distribution reading — treat with caution
              </p>
            )}
          </GlassPanel>

          <StatCard
            label="Carbon rate"
            value={carbonRatePerHour}
            unit="g CO₂e/h"
            precision={1}
            accent
            hint={carbon.isFetching ? "updating…" : carbon.data ? "hourly rate, 0.385 kg/kWh grid" : null}
          />
          <StatCard
            label="Energy score"
            value={energyScore}
            unit="/100"
            precision={0}
            mono={false}
            hint="client heuristic from cpu/mem/power"
          />
          <StatCard
            label="CPU load"
            value={telemetry?.cpu_utilization ?? null}
            unit="%"
            hint={telemetry ? `${telemetry.process_count ?? "?"} processes` : null}
          />
        </div>

        {/* Scroll-Driven Deck: 3D Core, Hardware Telemetry, Trajectory, Attributions */}
        <section className="pt-2">
          <ScrollDashboardDeck
            telemetry={telemetry}
            prediction={prediction.data ?? null}
            carbon={carbon.data ?? null}
            estimatedPower={estimatedPower}
            carbonRatePerHour={carbonRatePerHour}
            energyScore={energyScore}
            isLoading={isLoading}
            isLive={isLive}
            mode={mode}
            bothDown={bothDown}
            history={history}
          />
        </section>
      </main>

      <Footer />
    </div>
  );
}
