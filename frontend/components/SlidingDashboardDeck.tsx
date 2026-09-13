// frontend/components/SlidingDashboardDeck.tsx
"use client";

/**
 * Sliding Dashboard Deck.
 * Transforms the live dashboard into an interactive sliding multi-tab deck:
 * - Slide 0: 3D System Core & Power Prediction
 * - Slide 1: Live Hardware Counters (CPU, RAM, GPU, Disk, Network)
 * - Slide 2: Power & Carbon Trajectory Telemetry Chart
 * - Slide 3: XGBoost ML Explainability & Feature Trees
 *
 * Keeps all backend queries, polling intervals, and error states intact.
 */

import React, { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Gauge,
  Activity,
  Leaf,
  Sparkles,
  ChevronLeft,
  ChevronRight,
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

interface SlidingDashboardDeckProps {
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

export const SlidingDashboardDeck: React.FC<SlidingDashboardDeckProps> = ({
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
  const [activeSlide, setActiveSlide] = useState<number>(0);
  const [direction, setDirection] = useState<number>(1);
  const prefersReducedMotion = useReducedMotion();

  const slides = [
    { id: "core", label: "3D Energy Core", icon: Gauge },
    { id: "hardware", label: "Hardware Telemetry", icon: Activity },
    { id: "trajectory", label: "Carbon Trajectory", icon: Leaf },
    { id: "ml", label: "ML Attributions", icon: Sparkles },
  ];

  const handleNext = () => {
    setDirection(1);
    setActiveSlide((prev) => (prev + 1) % slides.length);
  };

  const handlePrev = () => {
    setDirection(-1);
    setActiveSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const handleSelect = (idx: number) => {
    setDirection(idx > activeSlide ? 1 : -1);
    setActiveSlide(idx);
  };

  const slideVariants = {
    enter: (dir: number) => ({
      x: prefersReducedMotion ? 0 : dir > 0 ? 90 : -90,
      opacity: 0,
      filter: prefersReducedMotion ? "none" : "blur(8px)",
    }),
    center: {
      x: 0,
      opacity: 1,
      filter: "blur(0px)",
      transition: {
        x: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.35 },
        filter: { duration: 0.3 },
      },
    },
    exit: (dir: number) => ({
      x: prefersReducedMotion ? 0 : dir > 0 ? -90 : 90,
      opacity: 0,
      filter: prefersReducedMotion ? "none" : "blur(8px)",
      transition: { duration: 0.25 },
    }),
  };

  return (
    <div className="space-y-4">
      {/* Sliding Tab Controller */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/10">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {slides.map((s, idx) => {
            const Icon = s.icon;
            const isActive = idx === activeSlide;
            return (
              <button
                key={s.id}
                onClick={() => handleSelect(idx)}
                className={`px-3.5 py-2 rounded-xl text-xs font-mono transition-all flex items-center gap-2 border ${
                  isActive
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-glow-green/20 font-semibold"
                    : "bg-white/[0.02] border-white/10 text-white/50 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-emerald-400" : "text-white/40"}`} />
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button
            onClick={handlePrev}
            aria-label="Previous metric view"
            className="p-1.5 rounded-lg liquid-glass border border-white/10 text-white/60 hover:text-white"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[11px] font-mono text-white/40 min-w-[32px] text-center">
            {activeSlide + 1} / {slides.length}
          </span>
          <button
            onClick={handleNext}
            aria-label="Next metric view"
            className="p-1.5 rounded-lg liquid-glass border border-white/10 text-white/60 hover:text-white"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Sliding Arena */}
      <div className="relative min-h-[340px] overflow-hidden rounded-3xl">
        <AnimatePresence custom={direction} mode="wait">
          <motion.div
            key={activeSlide}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="w-full"
          >
            {/* SLIDE 0: 3D System Core & Power */}
            {activeSlide === 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
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
                          AI Model Calibration
                        </span>
                        <Gauge className="w-4 h-4 text-emerald-400" />
                      </div>
                      <h3 className="text-2xl font-bold font-display tracking-display text-white mt-2">
                        XGBoost Power Inference
                      </h3>
                      <p className="text-xs text-white/60 mt-2 leading-relaxed">
                        Physical CMOS power dissipation model mapped across 6 telemetry counters.
                        Real-time wattage estimation with sub-2ms latency.
                      </p>
                    </div>

                    <div className="mt-5 pt-4 border-t border-white/10 space-y-2 font-mono text-xs">
                      <div className="flex justify-between text-white/60">
                        <span>Latency:</span>
                        <span className="text-emerald-300">
                          {prediction?.inference_latency_ms != null
                            ? `${prediction.inference_latency_ms.toFixed(2)} ms`
                            : "—"}
                        </span>
                      </div>
                      <div className="flex justify-between text-white/60">
                        <span>Model Version:</span>
                        <span className="text-white">v{prediction?.model_version ?? "1.0.0"}</span>
                      </div>
                      <div className="flex justify-between text-white/60">
                        <span>Distribution Guard:</span>
                        <span className={prediction?.is_out_of_distribution ? "text-amber-300" : "text-emerald-300"}>
                          {prediction?.is_out_of_distribution ? "OOD Warning" : "Nominal"}
                        </span>
                      </div>
                    </div>
                  </GlassPanel>
                </div>
              </div>
            )}

            {/* SLIDE 1: Live Hardware Counters */}
            {activeSlide === 1 && (
              <div>
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
              </div>
            )}

            {/* SLIDE 2: Trajectory Chart */}
            {activeSlide === 2 && (
              <GlassPanel className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold tracking-tight-2 text-white flex items-center gap-2">
                    <Leaf className="w-4 h-4 text-emerald-400" aria-hidden />
                    Power &amp; carbon trajectory
                  </h2>
                  <span className="text-[11px] font-mono text-white/35">last 25 ticks</span>
                </div>
                {history.length > 1 ? (
                  <LiveChart history={history} />
                ) : (
                  <div className="h-44 flex items-center justify-center text-xs font-mono text-white/35">
                    {bothDown ? "No stream — chart paused" : "Collecting ticks…"}
                  </div>
                )}
              </GlassPanel>
            )}

            {/* SLIDE 3: ML Explainability */}
            {activeSlide === 3 && (
              <GlassPanel className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base font-semibold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    Feature Weights &amp; Attributions
                  </h3>
                  <span className="text-xs font-mono text-white/40">Sub-2ms attribution</span>
                </div>
                <p className="text-xs font-mono text-white/45 mb-5">
                  XGBoost tree contributions for the latest telemetry reading.
                </p>

                {prediction?.feature_contributions ? (
                  <div className="space-y-3">
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
                          <div key={feature}>
                            <div className="flex justify-between text-xs font-mono text-white/60 mb-1">
                              <span>{feature}</span>
                              <span className="text-white font-semibold">{contribution.toFixed(2)}</span>
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
                    Waiting for model prediction attributions...
                  </div>
                )}
              </GlassPanel>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

