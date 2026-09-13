// frontend/components/PresentationMode.tsx
"use client";

import React from "react";
import { X, Zap, Cloud, Award, Cpu, ShieldCheck, Sparkles } from "lucide-react";
import { TelemetryData } from "../types";
import { EarthSphere3D } from "./EarthSphere3D";

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
  isOptimized,
}) => {
  // Handle Escape key to close presentation
  React.useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex flex-col justify-between p-6 sm:p-10 overflow-y-auto animate-in fade-in duration-300">
      
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl liquid-glass border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-glow-green">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-display tracking-display text-white">
              GreenLedger — Live Presentation
            </h1>
            <p className="text-xs sm:text-sm text-emerald-300 font-mono">
              Real-Time Windows Telemetry &amp; XGBoost Carbon Optimization Protocol
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="px-4 py-2 rounded-xl liquid-glass border border-white/15 text-white/70 hover:text-white flex items-center gap-2 text-xs font-mono transition"
        >
          <X className="w-4 h-4" />
          <span>Exit Presentation</span>
        </button>
      </div>

      {/* Center 3D Showcase & Giant Gauges */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 my-6 items-center">
        
        {/* Left Gauges */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-6 rounded-3xl liquid-glass border border-white/10 flex flex-col items-center justify-center text-center relative overflow-hidden shadow-2xl">
            <span aria-hidden className="glass-sheen absolute inset-0" />
            <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs uppercase tracking-wider mb-2">
              <Zap className="w-4 h-4 text-emerald-400 animate-pulse" />
              Estimated Power Consumption
            </div>
            <div className="text-5xl sm:text-6xl font-black font-mono text-white tracking-tight my-1">
              {estimatedPower === null ? "—" : estimatedPower.toFixed(1)}
              {estimatedPower !== null && <span className="text-xl text-white/40 ml-2">Watts</span>}
            </div>
            <p className="text-[11px] text-white/45 font-mono">
              XGBoost inference from 6 hardware counters
            </p>
          </div>

          <div className="p-6 rounded-3xl liquid-glass border border-white/10 flex flex-col items-center justify-center text-center relative overflow-hidden shadow-2xl">
            <span aria-hidden className="glass-sheen absolute inset-0" />
            <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs uppercase tracking-wider mb-2">
              <Cloud className="w-4 h-4 text-cyan-400" />
              Estimated Carbon Footprint
            </div>
            <div className="text-5xl sm:text-6xl font-black font-mono text-cyan-300 tracking-tight my-1">
              {carbonRate === null ? "—" : carbonRate.toFixed(1)}
              {carbonRate !== null && <span className="text-xl text-white/40 ml-2">g/hr</span>}
            </div>
            <p className="text-[11px] text-white/45 font-mono">
              CO₂e based on 0.385 kg/kWh Grid Factor
            </p>
          </div>
        </div>

        {/* Center 3D Eco-Sphere */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center">
          <div className="w-full max-w-[340px] aspect-square rounded-3xl liquid-glass p-2 border border-white/10 shadow-2xl relative">
            <EarthSphere3D size={320} interactive={true} />
            <div className="absolute bottom-3 inset-x-0 text-center pointer-events-none">
              <span className="text-[10px] font-mono text-emerald-300/80 bg-black/60 px-2.5 py-1 rounded-full border border-emerald-500/30">
                Interactive Biosphere Orb
              </span>
            </div>
          </div>
        </div>

        {/* Right Gauge: Green Credits */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-6 rounded-3xl liquid-glass border border-white/10 flex flex-col items-center justify-center text-center relative overflow-hidden shadow-2xl">
            <span aria-hidden className="glass-sheen absolute inset-0" />
            <div className="flex items-center gap-2 text-amber-400 font-mono text-xs uppercase tracking-wider mb-2">
              <Award className="w-4 h-4 text-amber-400" />
              Verified Green Credits
            </div>
            <div className="text-5xl sm:text-6xl font-black font-mono text-amber-300 tracking-tight my-1">
              {credits === null ? "—" : credits}
              {credits !== null && <span className="text-xl text-white/40 ml-2">GC</span>}
            </div>
            <p className="text-[11px] text-white/45 font-mono">
              Web3 Redeemable on Ethereum Sepolia
            </p>
          </div>

          <div className="p-6 rounded-3xl liquid-glass border border-white/10 flex flex-col items-center justify-center text-center relative">
            <span aria-hidden className="glass-sheen absolute inset-0" />
            <div className="text-xs font-mono text-white/50 mb-2">Current System Status</div>
            <div className="text-lg font-mono text-white font-semibold flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse-dot" />
              {telemetry.is_live ? "Live Windows 11 Telemetry" : "Windows Agent Offline"}
            </div>
            <div className="mt-2 text-[11px] font-mono text-emerald-300">
              {telemetry.process_count} Processes • {telemetry.cpu_utilization.toFixed(1)}% CPU
            </div>
          </div>
        </div>

      </div>

      {/* Live Hardware Stats Bar */}
      <div className="p-4 rounded-2xl liquid-glass border border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-emerald-400" />
          <span className="text-white/60">CPU: <strong className="text-white">{telemetry.cpu_utilization.toFixed(1)}%</strong></span>
        </div>
        <div className="text-white/60">
          RAM: <strong className="text-white">{telemetry.memory_usage.toFixed(1)}%</strong>
        </div>
        <div className="text-white/60">
          Tasks: <strong className="text-white">{telemetry.process_count}</strong>
        </div>
        <div className="text-white/60">
          Disk I/O: <strong className="text-white">{telemetry.disk_io.toFixed(1)} MB/s</strong>
        </div>
        <div className="text-emerald-400 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4" />
          <span>{telemetry.is_live ? "Agent Stream Active" : "Offline Fallback"}</span>
        </div>
      </div>

      {/* Big Interactive Action Button */}
      <div className="mt-6 flex items-center justify-center gap-4">
        <button
          onClick={onQuickOptimize}
          disabled={!telemetry.is_live}
          title={!telemetry.is_live ? "Requires live local agent telemetry" : "Open live optimization controls"}
          className={`px-8 py-4 rounded-2xl text-sm font-mono font-bold flex items-center gap-3 transition-all duration-300 ${
            isOptimized
              ? "liquid-glass border border-emerald-500/60 text-emerald-300"
              : "bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white shadow-glow-green"
          }`}
        >
          <Zap className="w-5 h-5" />
          <span>
            {isOptimized ? "Optimization Controls" : telemetry.is_live ? "Open Optimization Engine" : "Requires Live Telemetry"}
          </span>
        </button>
      </div>

      {/* Footer Info */}
      <div className="pt-4 text-center text-[11px] font-mono text-white/30">
        Presentation Mode — Press Esc or click Exit Presentation to return to normal dashboard
      </div>

    </div>
  );
};
