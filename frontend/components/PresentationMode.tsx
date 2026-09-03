"use client";

import React from "react";
import { X, Zap, Cloud, Award, Cpu, ShieldCheck, Sparkles } from "lucide-react";
import { TelemetryData } from "../types";

interface PresentationModeProps {
  isOpen: boolean;
  onClose: () => void;
  telemetry: TelemetryData;
  estimatedPower: number | null;
  carbonRate: number | null;
  credits: number | null;
  onQuickOptimize: () => void;
  isOptimized: boolean;
}

export const PresentationMode: React.FC<PresentationModeProps> = ({
  isOpen,
  onClose,
  telemetry,
  estimatedPower,
  carbonRate,
  credits,
  onQuickOptimize,
  isOptimized
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col justify-between p-6 sm:p-10 overflow-y-auto animate-in fade-in duration-300">
      
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-surface-border pb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyber-emerald/20 border border-cyber-emerald flex items-center justify-center text-cyber-neon shadow-glow-green">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              GreenLedger — Live Judge Presentation
            </h1>
            <p className="text-xs sm:text-sm text-cyber-neon font-mono">
              Real-Time Windows Telemetry & XGBoost Carbon Optimization Protocol
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="px-4 py-2 rounded-xl bg-surface-card border border-surface-border text-gray-300 hover:text-white flex items-center gap-2 text-xs font-mono transition"
        >
          <X className="w-4 h-4" />
          <span>Exit Presentation</span>
        </button>
      </div>

      {/* Main Pitch Showcase Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-8">
        
        {/* Giant Gauge 1: Power */}
        <div className="p-8 rounded-3xl bg-surface-card border border-surface-border flex flex-col items-center justify-center text-center relative overflow-hidden shadow-glow-green/15">
          <div className="flex items-center gap-2 text-emerald-400 font-mono text-sm uppercase tracking-wider mb-2">
            <Zap className="w-5 h-5 text-cyber-neon animate-pulse" />
            Estimated Power Consumption
          </div>
          <div className="text-6xl sm:text-7xl font-black font-mono text-white tracking-tight my-2">
            {estimatedPower === null ? "Unavailable" : estimatedPower.toFixed(1)}
            {estimatedPower !== null && <span className="text-2xl text-gray-400 ml-2">Watts</span>}
          </div>
          <p className="text-xs text-gray-400 font-mono">
            Predicted via XGBoost Model; test metrics are shown in Diagnostics when available.
          </p>
        </div>

        {/* Giant Gauge 2: Carbon */}
        <div className="p-8 rounded-3xl bg-surface-card border border-surface-border flex flex-col items-center justify-center text-center relative overflow-hidden shadow-glow-cyan/15">
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-sm uppercase tracking-wider mb-2">
            <Cloud className="w-5 h-5 text-cyber-cyan" />
            Estimated Carbon Footprint
          </div>
          <div className="text-6xl sm:text-7xl font-black font-mono text-cyber-cyan tracking-tight my-2">
            {carbonRate === null ? "Unavailable" : carbonRate.toFixed(1)}
            {carbonRate !== null && <span className="text-2xl text-gray-400 ml-2">g/hr</span>}
          </div>
          <p className="text-xs text-gray-400 font-mono">
            CO₂e based on 0.385 kg/kWh Grid Factor
          </p>
        </div>

        {/* Giant Gauge 3: Green Credits */}
        <div className="p-8 rounded-3xl bg-surface-card border border-surface-border flex flex-col items-center justify-center text-center relative overflow-hidden shadow-glow-gold/15">
          <div className="flex items-center gap-2 text-amber-400 font-mono text-sm uppercase tracking-wider mb-2">
            <Award className="w-5 h-5 text-amber-400" />
            Verified Green Credits
          </div>
          <div className="text-6xl sm:text-7xl font-black font-mono text-cyber-gold tracking-tight my-2">
            {credits === null ? "Unavailable" : credits}
            {credits !== null && <span className="text-2xl text-gray-400 ml-2">GC</span>}
          </div>
          <p className="text-xs text-gray-400 font-mono">
            Web3 Redeemable on Ethereum Sepolia
          </p>
        </div>

      </div>

      {/* Live Hardware Stats Bar */}
      <div className="p-6 rounded-2xl bg-surface-elevated/40 border border-surface-border flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <Cpu className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-mono text-white">
            CPU: <strong>{telemetry.cpu_utilization.toFixed(1)}%</strong>
          </span>
        </div>
        <div className="text-sm font-mono text-white">
          RAM: <strong>{telemetry.memory_usage.toFixed(1)}%</strong>
        </div>
        <div className="text-sm font-mono text-white">
          Processes: <strong>{telemetry.process_count}</strong>
        </div>
        <div className="text-sm font-mono text-white">
          Disk I/O: <strong>{telemetry.disk_io.toFixed(1)} MB/s</strong>
        </div>
        <div className="text-sm font-mono text-emerald-400 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4" />
          <span>{telemetry.is_live ? "Live Windows Hardware" : "Windows Agent Offline"}</span>
        </div>
      </div>

      {/* Big Interactive Action Button */}
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
        <button
          onClick={onQuickOptimize}
          disabled={!telemetry.is_live}
          title={!telemetry.is_live ? "Requires live local agent telemetry" : "Open live optimization controls"}
          className={`px-10 py-5 rounded-2xl text-base sm:text-lg font-mono font-extrabold flex items-center gap-3 shadow-2xl transition-all duration-300 ${
            isOptimized
              ? "bg-emerald-950 border border-emerald-500/60 text-emerald-300"
              : "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:scale-105 text-white shadow-glow-green"
          }`}
        >
          <Zap className="w-6 h-6" />
          <span>{isOptimized ? "Optimization controls" : telemetry.is_live ? "Open optimization controls" : "Requires live telemetry"}</span>
        </button>
      </div>

      {/* Footer Info */}
      <div className="pt-6 border-t border-surface-border text-center text-xs font-mono text-gray-500">
        Presentation Mode — Press Esc or click Exit Presentation to return to normal dashboard
      </div>

    </div>
  );
};
