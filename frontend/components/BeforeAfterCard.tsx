"use client";

import React, { useState, useEffect } from "react";
import { ArrowRight, CheckCircle2, Award, Zap, Cloud, Sparkles, RotateCcw } from "lucide-react";
import { BeforeAfterResult, TelemetryData } from "../types";

interface BeforeAfterCardProps {
  result: BeforeAfterResult;
  beforeTelemetry: TelemetryData;
  afterTelemetry: TelemetryData;
  onReset?: () => void;
}

export const BeforeAfterCard: React.FC<BeforeAfterCardProps> = ({
  result,
  beforeTelemetry,
  afterTelemetry,
  onReset
}) => {
  const [animatedReduction, setAnimatedReduction] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = result.reduction_pct;
    const duration = 1200;
    const stepTime = 25;
    const totalSteps = duration / stepTime;
    const increment = end / totalSteps;

    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setAnimatedReduction(end);
        clearInterval(timer);
      } else {
        setAnimatedReduction(start);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [result.reduction_pct]);

  const beforeCO2 = (result.before_power_w * 0.385).toFixed(1);
  const afterCO2 = (result.after_power_w * 0.385).toFixed(1);

  return (
    <div className="p-6 rounded-2xl bg-gradient-to-br from-surface-card via-surface-card to-emerald-950/20 border border-emerald-500/40 relative overflow-hidden shadow-glow-green/20">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-surface-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-cyber-neon">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Verified Optimization Completed
            </h3>
            <p className="text-xs text-emerald-400 font-mono">
              Action Signature: {result.action_hash}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-400/40 flex items-center gap-2">
            <Award className="w-4 h-4 text-cyber-neon" />
            <span className="text-xs font-mono font-semibold text-white">
              +{result.credits_awarded} Green Credits
            </span>
          </div>
          {onReset && (
            <button
              onClick={onReset}
              className="p-1.5 rounded-lg bg-surface-elevated hover:bg-surface-border text-gray-400 hover:text-white transition"
              title="Reset comparison"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Hero Reduction Showcase */}
      <div className="my-6 p-4 rounded-xl bg-surface/90 border border-surface-border flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
        <div>
          <span className="text-xs uppercase tracking-widest text-gray-400 font-mono">
            Measured Energy Drop
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-4xl sm:text-5xl font-extrabold font-mono text-cyber-neon tracking-tight">
              -{animatedReduction.toFixed(1)}%
            </span>
            <span className="text-sm font-mono text-gray-300">Power Saved</span>
          </div>
        </div>

        <div className="h-px md:h-12 w-full md:w-px bg-surface-border" />

        <div className="flex items-center gap-6">
          <div>
            <span className="text-[11px] text-gray-400 font-mono">Saved Rate</span>
            <div className="text-xl font-bold font-mono text-white">
              -{result.reduction_watts.toFixed(1)} Watts
            </div>
          </div>
          <div>
            <span className="text-[11px] text-gray-400 font-mono">Prevented Carbon</span>
            <div className="text-xl font-bold font-mono text-cyber-cyan">
              -{result.hourly_co2_saved_g.toFixed(1)} g CO₂e/h
            </div>
          </div>
        </div>
      </div>

      {/* Side-by-Side Before vs After Specs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* BEFORE BOX */}
        <div className="p-4 rounded-xl bg-surface/60 border border-surface-border">
          <div className="flex items-center justify-between text-xs font-mono text-gray-400 mb-3">
            <span className="font-semibold text-rose-400 uppercase tracking-wider">Before Optimization</span>
            <span>Pre-tuning</span>
          </div>

          <div className="space-y-2.5 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-surface-border/40">
              <span className="text-gray-400">Estimated Power:</span>
              <span className="text-white font-semibold">{result.before_power_w.toFixed(1)} W</span>
            </div>
            <div className="flex justify-between py-1 border-b border-surface-border/40">
              <span className="text-gray-400">Carbon Rate:</span>
              <span className="text-gray-300">{beforeCO2} g/h</span>
            </div>
            <div className="flex justify-between py-1 border-b border-surface-border/40">
              <span className="text-gray-400">CPU Utilization:</span>
              <span className="text-gray-300">{beforeTelemetry.cpu_utilization.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between py-1 border-b border-surface-border/40">
              <span className="text-gray-400">RAM Usage:</span>
              <span className="text-gray-300">{beforeTelemetry.memory_usage.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-400">Active Processes:</span>
              <span className="text-gray-300">{beforeTelemetry.process_count}</span>
            </div>
          </div>
        </div>

        {/* AFTER BOX */}
        <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/40">
          <div className="flex items-center justify-between text-xs font-mono text-emerald-400 mb-3">
            <span className="font-semibold uppercase tracking-wider">After Optimization</span>
            <span className="text-cyber-neon font-semibold">Active State</span>
          </div>

          <div className="space-y-2.5 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-emerald-500/20">
              <span className="text-gray-400">Estimated Power:</span>
              <span className="text-cyber-neon font-bold">{result.after_power_w.toFixed(1)} W</span>
            </div>
            <div className="flex justify-between py-1 border-b border-emerald-500/20">
              <span className="text-gray-400">Carbon Rate:</span>
              <span className="text-white">{afterCO2} g/h</span>
            </div>
            <div className="flex justify-between py-1 border-b border-emerald-500/20">
              <span className="text-gray-400">CPU Utilization:</span>
              <span className="text-white">{afterTelemetry.cpu_utilization.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between py-1 border-b border-emerald-500/20">
              <span className="text-gray-400">RAM Usage:</span>
              <span className="text-white">{afterTelemetry.memory_usage.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-400">Active Processes:</span>
              <span className="text-white">{afterTelemetry.process_count}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Unlocked Badge Alert if achieved */}
      {result.unlocked_badge && (
        <div className="mt-4 p-3 rounded-xl bg-amber-950/40 border border-amber-500/50 flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="text-xs font-mono">
            <span className="text-amber-300 font-bold">New Achievement Unlocked: </span>
            <span className="text-white">{result.unlocked_badge}! Visit the Marketplace to mint it to your Sepolia collection.</span>
          </div>
        </div>
      )}

    </div>
  );
};
