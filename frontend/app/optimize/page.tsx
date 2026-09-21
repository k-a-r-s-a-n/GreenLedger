// frontend/app/optimize/page.tsx
"use client";

/**
 * Optimization flow — the app's core UX loop.
 *
 * Server state (TanStack Query): telemetry (single fetch + manual refresh)
 * and recommendations (POST /api/optimization/recommendations with the raw
 * telemetry, per contract).
 *
 * Execution flow (local state machine, server-verified):
 *   idle → executing (snapshot before → action executes → settle → snapshot
 *   after → POST evaluate-delta) → verified reveal, or explicit error.
 *
 * Honest gating: process-level actions require the live Windows agent
 * (real PIDs only exist in live telemetry). Power Saver and Reduce
 * Brightness execute for real on this machine through Next.js routes
 * (powercfg / WMI) even when the agent is offline. Demo telemetry is never
 * eligible for execution or server-verified credits.
 * 429 cooldowns surface a live countdown from Retry-After.
 */
import React, { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Zap,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  Timer,
  RefreshCw,
} from "lucide-react";
import { Navbar } from "../../components/Navbar";
import { Footer } from "../../components/Footer";
import { ModeBadge } from "../../components/ModeBadge";
import { GlassPanel } from "../../components/GlassPanel";
import { Button } from "../../components/Button";
import { Skeleton } from "../../components/Skeleton";
import { ErrorPanel } from "../../components/ErrorPanel";
import { OptimizationModal } from "../../components/OptimizationModal";
import { BeforeAfterCard } from "../../components/BeforeAfterCard";
import { useTelemetry } from "../../hooks/useTelemetry";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  fetchRecommendations,
  fetchTelemetry,
  executeOptimizationAction,
  rollbackOptimizationAction,
  evaluateOptimizationDelta,
  ApiError,
} from "../../lib/api";
import { OptimizationOpportunity, BeforeAfterResult, TelemetryData } from "../../types";

type FlowError = { message: string; retryAfterSeconds?: number };

/** Local-mode opportunity from raw telemetry — mirrors the backend's logic. */
function buildLocalRecommendations(
  telemetry: TelemetryData
): OptimizationOpportunity[] {
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
    estimated_power_reduction_pct: null,
    reversible: true,
    description: "Requests a lower display brightness. Any power reduction must be measured after execution.",
    action_name: "Reduce Brightness",
  });

  return recommendations;
}

type WindowTelemetry = TelemetryData & {
  _sample_count: number;
  _cpu_stddev: number;
  _memory_stddev: number;
};

async function collectLiveTelemetryWindow(): Promise<WindowTelemetry> {
  const samples: TelemetryData[] = [];
  for (let index = 0; index < 3; index += 1) {
    samples.push(await fetchTelemetry());
    if (index < 2) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  const median = (values: number[]) => {
    if (values.length === 0) return 0;
    const ordered = [...values].sort((a, b) => a - b);
    const middle = Math.floor(ordered.length / 2);
    return ordered.length % 2 === 0
      ? (ordered[middle - 1] + ordered[middle]) / 2
      : ordered[middle];
  };
  const standardDeviation = (values: number[]) => {
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    return Math.sqrt(
      values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
    );
  };
  const first = samples[0];
  return {
    ...first,
    timestamp: samples[samples.length - 1].timestamp,
    cpu_utilization: median(samples.map((sample) => sample.cpu_utilization)),
    memory_usage: median(samples.map((sample) => sample.memory_usage)),
    disk_io: median(samples.map((sample) => sample.disk_io)),
    process_count: Math.round(median(samples.map((sample) => sample.process_count))),
    thread_count: Math.round(
      median(samples.map((sample) => sample.thread_count ?? first.thread_count ?? 1))
    ),
    uptime: median(samples.map((sample) => sample.uptime)),
    power_meter_raw: (() => {
      const values = samples
        .map((sample) => sample.power_meter_raw)
        .filter((value): value is number => typeof value === "number");
      return values.length > 0 ? median(values) : first.power_meter_raw;
    })(),
    _sample_count: samples.length,
    _cpu_stddev: standardDeviation(samples.map((sample) => sample.cpu_utilization)),
    _memory_stddev: standardDeviation(samples.map((sample) => sample.memory_usage)),
  };
}

export default function OptimizePage() {
  const prefersReducedMotion = useReducedMotion();
  const { telemetry, mode, isLive, isLoading, refetch } = useTelemetry({
    refetchInterval: false, // single snapshot per page visit; refresh is manual
  });

  // ---- Recommendations: derived from the fetched telemetry snapshot ----
  const recommendationsQuery = useQuery({
    queryKey: ["recommendations", telemetry?.timestamp ?? null],
    enabled: telemetry !== null,
    staleTime: Infinity, // tied to the snapshot, not wall-clock freshness
    queryFn: () => fetchRecommendations(telemetry as TelemetryData),
  });

  // ---- Execution state machine (local; server verifies every step) ----
  const [selected, setSelected] = useState<OptimizationOpportunity | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [result, setResult] = useState<{
    comparison: BeforeAfterResult;
    before: TelemetryData;
    after: TelemetryData;
  } | null>(null);
  const [flowError, setFlowError] = useState<FlowError | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const executeMutation = useMutation({
    mutationFn: async (opportunity: OptimizationOpportunity) => {
      if (!isLive) {
        throw new ApiError(
          0,
          "Optimization execution requires live Windows telemetry; demo snapshots cannot produce verified savings."
        );
      }
      const before = await collectLiveTelemetryWindow();
      const executed = await executeOptimizationAction(
        opportunity.id,
        { pid: opportunity.pid, process_name: opportunity.process_name },
        true
      );
      if (!executed) {
        throw new ApiError(0, "The optimization action did not execute.");
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const after = await collectLiveTelemetryWindow();
      const comparison: BeforeAfterResult = await evaluateOptimizationDelta(
        opportunity.id,
        before,
        after
      );
      return { comparison, before, after };
    },
    onSuccess: ({ comparison, before, after }) => {
      setResult({ comparison, before, after });
      setFlowError(null);
      setIsModalOpen(false);
      setSelected(null);
    },
    onError: (err) => {
      setIsModalOpen(false);
      setSelected(null);
      if (err instanceof ApiError && err.status === 429) {
        const seconds = err.retryAfterSeconds ?? 20;
        setCooldownSeconds(seconds);
        setFlowError({
          message: `Cooldown active between optimization cycles — try again in ${seconds}s.`,
          retryAfterSeconds: seconds,
        });

        const rollbackMutation = useMutation({
          mutationFn: (actionId: string) => rollbackOptimizationAction(actionId, isLive),
          onSuccess: () => {
            setFlowError(null);
            setResult(null);
          },
          onError: (err) => {
            setFlowError({
              message: err instanceof Error ? err.message : "Rollback failed.",
            });
          },
        });
      } else {
        setFlowError({
          message: err instanceof Error ? err.message : "Optimization verification failed.",
        });
      }
    },
  });

  // Live countdown for the 429 cooldown.
  React.useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const id = setInterval(() => setCooldownSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldownSeconds]);

  const powerSaver = recommendationsQuery.data?.find(
    (r) => r.id === "enable_power_saver"
  );
  const otherRecommendations =
    recommendationsQuery.data?.filter((r) => r.id !== "enable_power_saver") ?? [];

  const openModal = (opp: OptimizationOpportunity) => {
    setSelected(opp);
    setIsModalOpen(true);
  };

  // Closes the verified-result panel (same behavior as the card's reset button).
  const closeResult = () => setResult(null);

  const reveal = {
    initial: prefersReducedMotion ? false : { opacity: 0, y: 18, filter: "blur(6px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  };

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <Navbar dataSourceMode={mode} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-7">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-3xl sm:text-4xl tracking-display text-white">
                Optimization engine
              </h1>
              <ModeBadge mode={mode} />
            </div>
            <p className="text-xs font-mono text-white/40 mt-1.5">
              Safe, reversible actions only · server-verified before every credit award
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              refetch();
              if (telemetry) void recommendationsQuery.refetch();
            }}
            loading={isLoading || recommendationsQuery.isFetching}
          >
            {!isLoading && !recommendationsQuery.isFetching && (
              <RefreshCw className="w-4 h-4" aria-hidden />
            )}
            Refresh snapshot
          </Button>
        </div>

        {/* Flow errors: 429 cooldown / 422 rejection / agent failure */}
        {flowError && (
          <ErrorPanel
            title={cooldownSeconds > 0 ? "Cooldown active" : "Optimization not verified"}
            message={
              cooldownSeconds > 0
                ? `${flowError.message} (${cooldownSeconds}s)`
                : flowError.message
            }
          />
        )}

        {/* Verified result reveal — the before/after moment */}
        <AnimatePresence>
          {result && (
            <motion.section {...reveal} className="space-y-3">
              <h2 className="text-lg font-semibold tracking-tight-2 text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" aria-hidden />
                Verified impact
              </h2>
              <BeforeAfterCard
                result={result.comparison}
                beforeTelemetry={result.before}
                afterTelemetry={result.after}
                onReset={closeResult}
                onRollback={() => rollbackMutation.mutate(result.comparison.action_id)}
                rollbackPending={rollbackMutation.isPending}
                rollbackAvailable={
                  result.comparison.action_id === "enable_power_saver" ||
                  result.comparison.action_id === "reduce_brightness"
                }
              />
            </motion.section>
          )}
        </AnimatePresence>

        {/* Power Saver feature panel (primary recommended action) */}
        {!isLoading && telemetry === null ? (
          <ErrorPanel
            title="No telemetry snapshot"
            message="Neither the live Windows agent nor the backend demo endpoint is reachable. Start the services (or click Refresh snapshot) and try again."
            onRetry={() => refetch()}
          />
        ) : recommendationsQuery.isPending ? (
          <Skeleton className="h-32 w-full rounded-2xl" />
        ) : powerSaver ? (
          <GlassPanel intensity="accent" className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <span aria-hidden className="glass-sheen absolute inset-0" />
            <div className="relative">
              <h2 className="text-base font-semibold tracking-tight-2 text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" aria-hidden />
                Windows Power Saver
              </h2>
              <p className="text-sm text-white/55 mt-1 max-w-xl">
                Activates the Windows Power Saver scheme via powercfg on this
                machine (the live agent is used when available). The measured
                drop is verified server-side before any credits are awarded.
              </p>
            </div>
            <div className="relative shrink-0">
              <Button
                onClick={() => openModal(powerSaver)}
                disabled={!telemetry || !isLive}
                loading={executeMutation.isPending}
                title={
                  isLive
                    ? "Enable Windows Power Saver"
                    : telemetry
                      ? "Live Windows telemetry is required before changing the power plan"
                      : "Load a telemetry snapshot first"
                }
              >
                <Zap className="w-4 h-4" aria-hidden />
                Enable Power Saver
              </Button>
            </div>
          </GlassPanel>
        ) : telemetry && !recommendationsQuery.isFetching ? (
          <GlassPanel className="p-5 flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" aria-hidden />
            <p className="text-sm text-white/60">
              Power Saver is already active or not currently recommended — the
              engine found nothing to change there.
            </p>
          </GlassPanel>
        ) : null}

        {/* Quick-Action Brightness Optimization Card */}
        <GlassPanel intensity="accent" className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-5 border-cyan-500/30">
          <span aria-hidden className="glass-sheen absolute inset-0" />
          <div className="relative">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border border-cyan-500/40 text-cyan-300 bg-cyan-500/10">
                Display Hardware
              </span>
              <span className="text-xs font-mono text-white/45">Measured after execution</span>
            </div>
            <h2 className="text-base font-semibold tracking-tight-2 text-white flex items-center gap-2 mt-2">
              <Zap className="w-4 h-4 text-cyan-400" aria-hidden />
              Reduce Screen Brightness (40%)
            </h2>
            <p className="text-sm text-white/55 mt-1 max-w-xl">
              Display backlight is one of the highest static power draws on modern laptops and monitors.
              Instantly dims the display to an energy-efficient 40% target via Windows WMI.
            </p>
          </div>
          <div className="relative shrink-0">
            <Button
              onClick={() => {
                const brightnessOpp: OptimizationOpportunity = {
                  id: "reduce_brightness",
                  title: "Reduce Screen Brightness to 40%",
                  category: "display",
                  priority: "medium",
                  estimated_power_reduction_pct: null,
                  reversible: true,
                  description: "Display backlighting accounts for up to 30% of system draw. Dims display to energy-efficient 40%.",
                  action_name: "Dim Display to 40%",
                };
                openModal(brightnessOpp);
              }}
              disabled={!telemetry || !isLive}
              loading={executeMutation.isPending}
              title={
                isLive
                  ? "Dim the display to 40% via Windows WMI"
                  : telemetry
                    ? "Live Windows telemetry is required before changing brightness"
                    : "Load a telemetry snapshot first"
              }
              className="bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500"
            >
              <Zap className="w-4 h-4" aria-hidden />
              Reduce Brightness
            </Button>
          </div>
        </GlassPanel>

        {/* Other recommendations */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight-2 text-white">
              Recommended actions
            </h2>
            <span className="text-xs font-mono text-white/35">
              {recommendationsQuery.data
                ? `${otherRecommendations.length} opportunity card${otherRecommendations.length === 1 ? "" : "s"}`
                : "—"}
            </span>
          </div>

          {!isLoading && telemetry === null ? (
            <ErrorPanel
              title="No telemetry snapshot"
              message="Load a snapshot first — recommendations are derived from live or demo telemetry."
              onRetry={() => refetch()}
            />
          ) : recommendationsQuery.isPending ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Skeleton className="h-48 rounded-2xl" />
              <Skeleton className="h-48 rounded-2xl" />
            </div>
          ) : recommendationsQuery.isError ? (
            <ErrorPanel
              title="Recommendations unavailable"
              message={
                recommendationsQuery.error instanceof Error
                  ? recommendationsQuery.error.message
                  : "The backend did not return recommendations for this snapshot."
              }
              onRetry={() => recommendationsQuery.refetch()}
            />
          ) : otherRecommendations.length === 0 ? (
            <GlassPanel className="p-6 text-sm text-white/55">
              No additional actions for this snapshot — your machine is running
              close to its efficient baseline.
            </GlassPanel>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {otherRecommendations.map((rec, i) => (
                <motion.div
                  key={rec.id}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: i * 0.08 }}
                >
                  <GlassPanel className="h-full p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border ${
                            rec.priority === "high"
                              ? "border-rose-500/40 text-rose-300 bg-rose-500/10"
                              : "border-amber-500/40 text-amber-300 bg-amber-500/10"
                          }`}
                        >
                          {rec.priority} impact
                        </span>
                        <span className="text-xs font-mono text-emerald-300">
                          {rec.estimated_power_reduction_pct == null
                            ? "Measured after execution"
                            : `~${rec.estimated_power_reduction_pct}% drop`}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold tracking-tight-2 text-white mt-3">
                        {rec.title}
                      </h3>
                      <p className="text-[13px] text-white/50 mt-1 leading-relaxed">
                        {rec.description}
                      </p>
                      {rec.process_name && (
                        <div className="mt-3 inline-flex items-center gap-3 text-[11px] font-mono text-white/45 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                          <span>
                            Process: <strong className="text-white/80">{rec.process_name}</strong>
                          </span>
                          <span>
                            CPU: <strong className="text-amber-300">{rec.cpu_percent}%</strong>
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between">
                      <span className="text-[11px] font-mono text-white/40">
                        {rec.reversible ? "Reversible" : "Graceful close"}
                      </span>
                      <Button
                        size="sm"
                        onClick={() => openModal(rec)}
                        disabled={!isLive && rec.id.startsWith("close_process_")}
                        variant="primary"
                        title={
                          isLive
                            ? rec.action_name
                            : "Process actions need the live Windows agent — unavailable in demo mode"
                        }
                      >
                        {rec.action_name}
                        <ArrowRight className="w-3.5 h-3.5" aria-hidden />
                      </Button>
                    </div>
                  </GlassPanel>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Safety guarantee */}
        <GlassPanel className="p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-white tracking-tight-2 mb-4">
            <ShieldCheck className="w-5 h-5 text-emerald-400" aria-hidden />
            Non-destructive safety guarantee
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-white/50 leading-relaxed">
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
              <strong className="text-white/85 block mb-1">Protected services</strong>
              Never terminates <code>explorer.exe</code>, <code>svchost.exe</code>,
              <code> dwm.exe</code>, or antivirus services — server whitelist enforced.
            </div>
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
              <strong className="text-white/85 block mb-1">Explicit consent</strong>
              Every action opens a confirmation dialog; nothing executes autonomously.
            </div>
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
              <strong className="text-white/85 block mb-1">Instant rollback</strong>
              Power-plan changes keep the previous scheme GUID for one-click reversal.
            </div>
          </div>
        </GlassPanel>
      </main>

      {/* Confirmation modal (reused widget) */}
      <OptimizationModal
        isOpen={isModalOpen}
        opportunity={selected}
        onClose={() => {
          setIsModalOpen(false);
          setSelected(null);
        }}
        onConfirm={() => selected && executeMutation.mutate(selected)}
        isExecuting={executeMutation.isPending}
      />

      <Footer />
    </div>
  );
}
