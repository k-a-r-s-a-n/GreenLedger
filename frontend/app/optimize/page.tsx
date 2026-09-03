"use client";

import React, { useState, useEffect } from "react";
import { 
  Zap, 
  ShieldCheck, 
  CheckCircle, 
  ArrowRight, 
  TrendingDown, 
  Sliders, 
  Sparkles,
  AlertCircle,
  RotateCcw
} from "lucide-react";
import { Navbar } from "../../components/Navbar";
import { Footer } from "../../components/Footer";
import { OptimizationModal } from "../../components/OptimizationModal";
import { BeforeAfterCard } from "../../components/BeforeAfterCard";
import { 
  fetchTelemetry, 
  fetchRecommendations, 
  executeOptimizationAction, 
  evaluateOptimizationDelta,
  checkAgentHealth 
} from "../../lib/api";
import { TelemetryData, OptimizationOpportunity, BeforeAfterResult } from "../../types";

export default function OptimizePage() {
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [recommendations, setRecommendations] = useState<OptimizationOpportunity[]>([]);
  const [isAgentLive, setIsAgentLive] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<OptimizationOpportunity | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  
  // Before & After States
  const [beforeTelemetry, setBeforeTelemetry] = useState<TelemetryData | null>(null);
  const [afterTelemetry, setAfterTelemetry] = useState<TelemetryData | null>(null);
  const [comparisonResult, setComparisonResult] = useState<BeforeAfterResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const powerSaverRecommendation = recommendations.find((recommendation) => recommendation.id === "enable_power_saver");

  useEffect(() => {
    const load = async () => {
      const agentActive = await checkAgentHealth();
      setIsAgentLive(agentActive);

      try {
        const data = await fetchTelemetry();
        setIsAgentLive(data.is_live === true);
        setTelemetry(data);
        const recs = await fetchRecommendations(data, agentActive);
        setRecommendations(recs);
        setLoadError(null);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Optimization data unavailable");
      }
    };
    load();
  }, []);

  const handleOpenModal = (opp: OptimizationOpportunity) => {
    setSelectedOpportunity(opp);
    setIsModalOpen(true);
  };

  const handleApplyOptimization = async (actionId: string, params?: any) => {
    setIsExecuting(true);
    try {
      const beforeSnap = telemetry || (await fetchTelemetry());
      setBeforeTelemetry(beforeSnap);

      const executed = await executeOptimizationAction(actionId, params, isAgentLive);
      if (!executed) throw new Error("Optimization was not executed by the local Windows agent.");

      await new Promise((resolve) => setTimeout(resolve, 1500));

      const afterSnap = await fetchTelemetry();
      setAfterTelemetry(afterSnap);

      const result = await evaluateOptimizationDelta(actionId, beforeSnap, afterSnap);
      setComparisonResult(result);
      setIsModalOpen(false);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Optimization verification failed");
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar isLive={isAgentLive} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {loadError && <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-xs font-mono text-amber-200">{loadError}. Start the backend and local Windows agent to enable real optimization.</div>}
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                AI Optimization Engine
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950/80 border border-emerald-500/50 text-emerald-300">
                Safe & Reversible
              </span>
            </div>
            <p className="text-xs text-gray-400 font-mono mt-1">
              Autonomous opportunities ranked by estimated wattage reduction and system stability.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-surface-card px-3 py-1.5 rounded-xl border border-surface-border">
            <ShieldCheck className="w-4 h-4 text-cyber-neon" />
            <span>Protected Process Guardrails Active</span>
          </div>
        </div>

        <section className="p-5 rounded-2xl bg-surface-card border border-emerald-500/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-cyber-neon" />
              Windows Power Saver
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Uses the local Windows agent to activate the system Power Saver plan. The impact is measured after activation.
            </p>
            <span className="text-[11px] font-mono text-emerald-300">
              {!isAgentLive ? "Agent offline" : powerSaverRecommendation ? "Available to enable" : "Not reported as needed; it may already be active"}
            </span>
          </div>
          <button
            onClick={() => powerSaverRecommendation && handleOpenModal(powerSaverRecommendation)}
            disabled={!isAgentLive || !powerSaverRecommendation || isExecuting}
            title={!isAgentLive ? "Requires local Windows agent" : !powerSaverRecommendation ? "Power Saver is already active or unavailable" : "Enable Windows Power Saver"}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-surface-elevated disabled:text-gray-500 text-white text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition"
          >
            <Zap className="w-3.5 h-3.5" />
            {powerSaverRecommendation ? "Enable Power Saver" : "Power Saver Active / Unavailable"}
          </button>
        </section>

        {/* If an optimization was executed, showcase the Before/After Comparison Card */}
        {comparisonResult && beforeTelemetry && afterTelemetry && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-500">
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyber-neon" />
              Optimization Impact Verification
            </h2>
            <BeforeAfterCard
              result={comparisonResult}
              beforeTelemetry={beforeTelemetry}
              afterTelemetry={afterTelemetry}
              onReset={() => {
                setComparisonResult(null);
                setBeforeTelemetry(null);
                setAfterTelemetry(null);
              }}
            />
          </div>
        )}

        {/* Actionable Opportunities List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              Recommended System Actions
            </h3>
            <span className="text-xs font-mono text-gray-400">
              {recommendations.length} opportunities detected
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {recommendations.map((rec) => (
              <div
                key={rec.id}
                className="p-5 rounded-2xl bg-surface-card border border-surface-border hover:border-emerald-500/50 transition-all duration-300 flex flex-col justify-between group shadow-lg"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border ${
                      rec.priority === "high"
                        ? "bg-rose-950/40 border-rose-500/40 text-rose-300"
                        : "bg-amber-950/40 border-amber-500/40 text-amber-300"
                    }`}>
                      {rec.priority} Impact
                    </span>

                    <span className="text-xs font-mono text-cyber-neon font-bold">
                      {rec.estimated_power_reduction_pct == null ? "Measured after execution" : `~${rec.estimated_power_reduction_pct}% Drop`}
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-white mt-3 group-hover:text-emerald-300 transition">
                    {rec.title}
                  </h4>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    {rec.description}
                  </p>

                  {rec.cpu_percent && (
                    <div className="mt-3 inline-flex items-center gap-3 text-[11px] font-mono text-gray-400 bg-surface/70 px-2.5 py-1 rounded-lg border border-surface-border/60">
                      <span>Process: <strong>{rec.process_name}</strong></span>
                      <span>CPU: <strong className="text-amber-300">{rec.cpu_percent}%</strong></span>
                    </div>
                  )}
                </div>

                <div className="mt-5 pt-4 border-t border-surface-border/60 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-gray-400">
                    {rec.reversible ? "Reversible Plan" : "Graceful Close"}
                  </span>

                  <button
                    onClick={() => handleOpenModal(rec)}
                    disabled={!isAgentLive}
                    title={!isAgentLive ? "Requires local agent for a real optimization" : "Review and apply this live action"}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-mono font-bold shadow-glow-green flex items-center gap-1.5 transition"
                  >
                    <span>{isAgentLive ? rec.action_name : "Requires live agent"}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Safety Rules Disclosure Card */}
        <div className="p-6 rounded-2xl bg-surface-card border border-surface-border/80 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-white font-mono uppercase tracking-wider">
            <ShieldCheck className="w-5 h-5 text-cyber-neon" />
            GreenLedger Non-Destructive Safety Guarantee
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-400 leading-relaxed">
            <div className="p-3 rounded-xl bg-surface/60 border border-surface-border">
              <strong className="text-gray-200 block mb-1">Protected Windows Services</strong>
              Never terminates <code>explorer.exe</code>, <code>svchost.exe</code>, <code>dwm.exe</code>, or antivirus security services under any condition.
            </div>
            <div className="p-3 rounded-xl bg-surface/60 border border-surface-border">
              <strong className="text-gray-200 block mb-1">Explicit User Consent</strong>
              No optimization action is executed autonomously without user review and confirmation.
            </div>
            <div className="p-3 rounded-xl bg-surface/60 border border-surface-border">
              <strong className="text-gray-200 block mb-1">State Rollback Capability</strong>
              Power plans maintain previous scheme GUIDs for one-click instantaneous reversal.
            </div>
          </div>
        </div>

      </main>

      {/* Confirmation Modal */}
      <OptimizationModal
        isOpen={isModalOpen}
        opportunity={selectedOpportunity}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleApplyOptimization}
        isExecuting={isExecuting}
      />

      <Footer />
    </div>
  );
}
