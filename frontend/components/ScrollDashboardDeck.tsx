// frontend/components/ScrollDashboardDeck.tsx
"use client";

/**
 * ScrollDashboardDeck
 * Replaces tab-clicking panels on the dashboard with a smooth scroll-driven deck:
 * - Top sticky telemetry HUD
 * - Continuous viewport cards for 3D Core, Live Hardware Counters, Trajectory, and ML Explainability
 * - Full responsive fluidity
 */

import React, { useRef } from "react";
import { motion, useScroll } from "framer-motion";
import {
  Gauge,
  Activity,
  Leaf,
  Sparkles,
  Cpu,
  Layers,
  HardDrive,
  Wifi,
} from "lucide-react";
import { GlassPanel } from "./GlassPanel";
import { TelemetryCard } from "./TelemetryCard";
import { LiveChart } from "./LiveChart";
import { EnergyCore3D } from "./EnergyCore3D";
import { Skeleton } from "./Skeleton";
import { TelemetryData, PredictionResult } from "../types";
import { CarbonResponse } from "../lib/api";

interface ScrollDashboardDeckProps {
  telemetry: TelemetryData | null;
  prediction: PredictionResult | null;
  carbon: CarbonResponse | null;
  estimatedPower: number | null;
  carbonRatePerHour: number | null;
  energyScore: number | null;
  isLoading: boolean;
  isLive: boolean;
  mode: "live" | "demo" | "offline";
  bothDown: boolean;
  history: Array<{ time: string; power: number; cpu: number; carbon: number }>;
}

export const ScrollDashboardDeck: React.FC<ScrollDashboardDeckProps> = ({
  telemetry,
  prediction,
  carbon,
  estimatedPower,
  carbonRatePerHour,
  energyScore,
  isLoading,
  isLive,
  mode,
  bothDown,
  history,
}) => {
  return (
    <div className="space-y-10">
      
      {/* SECTION 1: 3D System Core & Power Calibration */}
      <section className="relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7">
            <EnergyCore3D
              cpuUtilization={telemetry?.cpu_utilization ?? null}
              gpuUtilization={telemetry?.gpu_utilization ?? null}
              estimatedPower={estimatedPower}
              isOptimized={false}
            />
          </div>

          <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
            <GlassPanel intensity="strong" className="p-6 h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-widest text-emerald-400">
                    Physics CMOS Model
                  </span>
                  <Gauge className="w-4 h-4 text-emerald-400" />
                </div>
                <h3 className="text-2xl font-bold font-display tracking-display text-white mt-2">
                  XGBoost Power Inference
                </h3>
                <p className="text-xs text-white/60 mt-2 leading-relaxed">
                  Real-time power mapping derived from CPU, RAM, GPU, and I/O states. Sub-2ms inference with physical CMOS safeguards.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10 space-y-2.5 font-mono text-xs">
                <div className="flex justify-between text-white/60">
                  <span>Latency:</span>
                  <span className="text-emerald-300 font-semibold">
                    {prediction?.inference_latency_ms != null
                      ? `${prediction.inference_latency_ms.toFixed(2)} ms`
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>Model Engine:</span>
                  <span className="text-white">v{prediction?.model_version ?? "—"}</span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>Distribution Guard:</span>
                  <span className={prediction?.is_out_of_distribution ? "text-amber-300" : "text-emerald-300"}>
                    {prediction?.is_out_of_distribution ? "OOD Warning" : "Calibrated Nominal"}
                  </span>
                </div>
              </div>
            </GlassPanel>
          </div>
        </div>
      </section>

      {/* SECTION 2: Live Hardware Telemetry Grid */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display font-bold tracking-display text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            Hardware Telemetry Matrix
          </h2>
          <span className="text-xs font-mono text-white/40">Windows OS Counters</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {isLoading && !telemetry ? (
            Array.from({ length: 6 }).map((_, i) => (
              <GlassPanel key={i} className="p-4 h-32">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-8 w-20 mt-4" />
              </GlassPanel>
            ))
          ) : telemetry ? (
            <>
              <TelemetryCard
                title="CPU Load"
                value={telemetry.cpu_utilization?.toFixed(1) ?? null}
                unit="%"
                icon={Cpu}
                percentage={telemetry.cpu_utilization}
                subtitle={telemetry.cpu_frequency ? `${telemetry.cpu_frequency} MHz` : "Multi-core active"}
                colorTheme="emerald"
              />
              <TelemetryCard
                title="RAM Usage"
                value={telemetry.memory_usage?.toFixed(1) ?? null}
                unit="%"
                icon={Layers}
                percentage={telemetry.memory_usage}
                subtitle={
                  telemetry.memory_used_gb
                    ? `${telemetry.memory_used_gb} / ${telemetry.memory_total_gb} GB`
                    : "Physical memory"
                }
                colorTheme="cyan"
              />
              <TelemetryCard
                title="GPU Activity"
                value={telemetry.gpu_utilization != null ? telemetry.gpu_utilization.toFixed(1) : null}
                unit="%"
                icon={Sparkles}
                percentage={telemetry.gpu_utilization}
                subtitle={telemetry.gpu_name || "Integrated graphics"}
                colorTheme="purple"
                isUnavailable={telemetry.gpu_utilization === null}
              />
              <TelemetryCard
                title="Disk I/O"
                value={telemetry.disk_io?.toFixed(1) ?? null}
                unit="MB/s"
                icon={HardDrive}
                percentage={telemetry.disk_io == null ? undefined : Math.min(100, telemetry.disk_io * 2)}
                subtitle={
                  telemetry.disk_read_mbs
                    ? `R:${telemetry.disk_read_mbs} W:${telemetry.disk_write_mbs}`
                    : "I/O throughput"
                }
                colorTheme="amber"
              />
              <TelemetryCard
                title="Latency"
                value={telemetry.network_latency != null ? telemetry.network_latency.toFixed(0) : null}
                unit="ms"
                icon={Wifi}
                percentage={telemetry.network_latency == null ? undefined : Math.min(100, telemetry.network_latency)}
                subtitle={telemetry.network_throughput_kbs ? `${telemetry.network_throughput_kbs} KB/s` : "Gateway ping"}
                colorTheme="cyan"
                isUnavailable={telemetry.network_latency === null}
              />
              <TelemetryCard
                title="Processes"
                value={telemetry.process_count?.toString() ?? null}
                unit="tasks"
                icon={Activity}
                subtitle={telemetry.thread_count ? `${telemetry.thread_count} threads` : "Windows tasks"}
                colorTheme="emerald"
              />
            </>
          ) : (
            <GlassPanel className="col-span-full p-8 text-center text-xs font-mono text-white/40">
              Telemetry data source is offline.
            </GlassPanel>
          )}
        </div>
      </section>

      {/* SECTION 3: Power & Carbon Trajectory Chart */}
      <section>
        <GlassPanel className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-display font-bold tracking-display text-white flex items-center gap-2">
              <Leaf className="w-4 h-4 text-emerald-400" aria-hidden />
              Power &amp; Carbon Trajectory
            </h2>
            <span className="text-xs font-mono text-white/35">Rolling 25-tick sample buffer</span>
          </div>
          {history.length > 1 ? (
            <LiveChart history={history} />
          ) : (
            <div className="h-48 flex items-center justify-center text-xs font-mono text-white/35">
              {bothDown ? "No stream — chart paused" : "Streaming live telemetry ticks…"}
            </div>
          )}
        </GlassPanel>
      </section>

      {/* SECTION 4: ML Explainability & Feature Trees */}
      <section>
        <GlassPanel className="p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-display font-bold tracking-display text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              Real-time Feature Attributions
            </h3>
            <span className="text-xs font-mono text-white/40">Sub-2ms attribution</span>
          </div>
          <p className="text-xs font-mono text-white/45 mb-6">
            Instantaneous feature weights impacting wattage prediction.
          </p>

          {prediction?.feature_contributions ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(prediction.feature_contributions)
                .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
                .slice(0, 6)
                .map(([feature, contribution]) => {
                  const max = Math.max(
                    ...Object.values(prediction.feature_contributions!).map(Math.abs),
                    1
                  );
                  const pct = Math.min(100, (Math.abs(contribution) / max) * 100);
                  return (
                    <div key={feature} className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <div className="flex justify-between text-xs font-mono text-white/70 mb-1.5">
                        <span className="capitalize">{feature.replace(/_/g, " ")}</span>
                        <span className="text-emerald-300 font-semibold">{contribution.toFixed(2)} W</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="py-8 text-center text-xs font-mono text-white/40">
              Calibrating feature weights...
            </div>
          )}
        </GlassPanel>
      </section>

    </div>
  );
};

