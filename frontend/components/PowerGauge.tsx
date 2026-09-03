"use client";

import React from "react";
import { Zap, Cloud, Sparkles, TrendingDown, Info } from "lucide-react";

interface PowerGaugeProps {
  estimatedPowerW: number | null;
  carbonRateGramsPerHour: number | null;
  energyScore: number | null;
  potentialReductionPct: number | null;
  isMeasuredPowerAvailable?: boolean;
  measuredPowerW?: number | null;
}

export const PowerGauge: React.FC<PowerGaugeProps> = ({
  estimatedPowerW,
  carbonRateGramsPerHour,
  energyScore,
  potentialReductionPct,
  isMeasuredPowerAvailable = false,
  measuredPowerW = null
}) => {
  return (
    <div className="p-6 rounded-2xl bg-gradient-to-br from-surface-card via-surface-card to-surface-elevated/40 border border-surface-border relative overflow-hidden shadow-glow-green/10">
      
      {/* Subtle background energy mesh */}
      <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-cyber-neon/5 blur-3xl pointer-events-none" />

      {/* Header with Honesty Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-surface-border/60">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-widest text-emerald-400 font-semibold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyber-neon" />
            AI Inference Energy Engine
          </span>
          <h2 className="text-xl font-bold text-white tracking-tight mt-0.5">
            Real-Time Power & Carbon State
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-md text-[10px] font-mono bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 flex items-center gap-1">
            <Info className="w-3 h-3 text-emerald-400" />
            Estimated Power (XGBoost)
          </span>
          {isMeasuredPowerAvailable && (
            <span className="px-2.5 py-1 rounded-md text-[10px] font-mono bg-cyan-950/70 border border-cyan-500/40 text-cyan-300">
              Measured: {measuredPowerW?.toFixed(1)} W
            </span>
          )}
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        
        {/* Card 1: Estimated Power */}
        <div className="p-4 rounded-xl bg-surface/80 border border-surface-border flex flex-col">
          <div className="flex items-center justify-between text-gray-400 text-xs font-mono">
            <span>Estimated Power</span>
            <Zap className="w-4 h-4 text-cyber-neon" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-bold font-mono text-white tracking-tight">
              {estimatedPowerW === null ? "Unavailable" : estimatedPowerW.toFixed(1)}
            </span>
            <span className="text-sm font-mono text-gray-400">Watts</span>
          </div>
          <span className="text-[10px] text-gray-400 mt-1 font-mono">
            Laptop System Load
          </span>
        </div>

        {/* Card 2: Carbon Footprint */}
        <div className="p-4 rounded-xl bg-surface/80 border border-surface-border flex flex-col">
          <div className="flex items-center justify-between text-gray-400 text-xs font-mono">
            <span>Carbon Emission</span>
            <Cloud className="w-4 h-4 text-cyber-cyan" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-bold font-mono text-white tracking-tight">
              {carbonRateGramsPerHour === null ? "Unavailable" : carbonRateGramsPerHour.toFixed(1)}
            </span>
            <span className="text-xs font-mono text-gray-400">g CO₂e/h</span>
          </div>
          <span className="text-[10px] text-gray-400 mt-1 font-mono">
            Grid Intensity Factor 0.385
          </span>
        </div>

        {/* Card 3: Energy Efficiency Score */}
        <div className="p-4 rounded-xl bg-surface/80 border border-surface-border flex flex-col">
          <div className="flex items-center justify-between text-gray-400 text-xs font-mono">
            <span>Efficiency Score</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className={`text-3xl font-bold font-mono tracking-tight ${
              energyScore === null ? "text-gray-400" : (energyScore >= 80 ? "text-cyber-neon" : (energyScore >= 60 ? "text-amber-400" : "text-rose-400"))
            }`}>
              {energyScore === null ? "Unavailable" : energyScore}
            </span>
            {energyScore !== null && <span className="text-xs font-mono text-gray-400">/ 100</span>}
          </div>
          <span className="text-[10px] text-gray-400 mt-1 font-mono">
            {energyScore === null ? "Requires telemetry and model" : (energyScore >= 80 ? "Optimal Efficiency" : "Moderate Optimization Scope")}
          </span>
        </div>

        {/* Card 4: Optimization Potential */}
        <div className="p-4 rounded-xl bg-surface/80 border border-surface-border flex flex-col">
          <div className="flex items-center justify-between text-gray-400 text-xs font-mono">
            <span>Reduction Scope</span>
            <TrendingDown className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-bold font-mono text-emerald-400 tracking-tight">
              {potentialReductionPct === null ? "Unavailable" : `-${potentialReductionPct.toFixed(0)}%`}
            </span>
            <span className="text-xs font-mono text-emerald-300">Potential</span>
          </div>
          <span className="text-[10px] text-gray-400 mt-1 font-mono">
            Via Safe System Tuning
          </span>
        </div>

      </div>

    </div>
  );
};
