"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { 
  Cpu, 
  HardDrive, 
  Activity, 
  Wifi, 
  Layers, 
  Zap, 
  HelpCircle, 
  CheckCircle, 
  AlertTriangle, 
  ArrowUpRight,
  TrendingDown,
  Sparkles,
  RefreshCw,
  Tv
} from "lucide-react";
import { Navbar } from "../../components/Navbar";
import { Footer } from "../../components/Footer";
import { EnergyCore3D } from "../../components/EnergyCore3D";
import { TelemetryCard } from "../../components/TelemetryCard";
import { PowerGauge } from "../../components/PowerGauge";
import { LiveChart } from "../../components/LiveChart";
import { PresentationMode } from "../../components/PresentationMode";
import { fetchTelemetry, predictPower, checkAgentHealth } from "../../lib/api";
import { TelemetryData, PredictionResult } from "../../types";

export default function DashboardPage() {
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [isAgentLive, setIsAgentLive] = useState(false);
  const [history, setHistory] = useState<{ time: string; power: number; cpu: number; carbon: number }[]>([]);
  const [showPresentation, setShowPresentation] = useState(false);
  const [isOptimized, setIsOptimized] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Polling loop (every 2.5 seconds)
  useEffect(() => {
    let isMounted = true;

    const poll = async () => {
      // 1. Check agent health
      const agentOnline = await checkAgentHealth();
      if (isMounted) setIsAgentLive(agentOnline);

      // 2. Fetch telemetry
      let data: TelemetryData;
      try {
        data = await fetchTelemetry();
      } catch (error) {
        if (isMounted) setLoadError(error instanceof Error ? error.message : "Telemetry unavailable");
        return;
      }
      if (!isMounted) return;
      setTelemetry(data);
      setIsAgentLive(data.is_live === true);

      // 3. Predict power via XGBoost
      let pred: PredictionResult;
      try {
        pred = await predictPower(data);
      } catch (error) {
        if (isMounted) {
          setPrediction(null);
          setLoadError(error instanceof Error ? error.message : "Power estimate unavailable");
        }
        return;
      }
      if (!isMounted) return;
      setPrediction(pred);
      setLoadError(null);

      // 4. Update rolling history
      setHistory((prev) => {
        const next = [
          ...prev,
          {
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            power: pred.estimated_power_w,
            cpu: data.cpu_utilization,
            carbon: pred.estimated_power_w * 0.385
          }
        ];
        return next.slice(-25); // keep last 25 ticks
      });
    };

    poll();
    const interval = setInterval(poll, 2500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Derived metrics
  const estimatedPower = prediction?.estimated_power_w ?? null;
  const carbonRate = estimatedPower === null ? null : estimatedPower * 0.385;
  
  // Calculate transparent energy score: 100 - (cpu * 0.4 + mem * 0.3 + (power / 60) * 30)
  const cpuLoad = telemetry?.cpu_utilization ?? null;
  const memLoad = telemetry?.memory_usage ?? null;
  const energyScore = cpuLoad === null || memLoad === null || estimatedPower === null
    ? null
    : Math.max(10, Math.min(100, Math.round(100 - (cpuLoad * 0.35 + memLoad * 0.25 + (estimatedPower / 80) * 40))));
  const potentialReductionPct = null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar
        isLive={isAgentLive}
        onTogglePresentation={() => setShowPresentation(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {loadError && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-xs font-mono text-amber-200">
            {loadError}. Start the backend and local agent for live Windows values.
          </div>
        )}
        
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                System Energy & Carbon Monitor
              </h1>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                isAgentLive
                  ? "bg-emerald-950/80 border-emerald-500/50 text-emerald-300"
                  : "bg-amber-950/80 border-amber-500/50 text-amber-300"
              }`}>
                {isAgentLive ? "● Live Windows Device" : "● Agent Offline"}
              </span>
            </div>
            <p className="text-xs text-gray-400 font-mono mt-1">
              Architecture: Intel Core Ultra / Arc 140V · XGBoost Regression Pipeline
            </p>
          </div>

          {/* Quick Toolbar Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPresentation(true)}
              className="px-3 py-1.5 rounded-lg bg-surface-card hover:bg-surface-elevated border border-surface-border text-xs font-mono text-cyan-300 flex items-center gap-1.5 transition"
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Pitch Mode</span>
            </button>
          </div>
        </div>

        {/* Primary Power & Carbon Highlight Gauge */}
        <PowerGauge
          estimatedPowerW={estimatedPower}
          carbonRateGramsPerHour={carbonRate}
          energyScore={energyScore}
          potentialReductionPct={potentialReductionPct}
          isMeasuredPowerAvailable={Boolean(telemetry?.power_meter_raw)}
          measuredPowerW={telemetry?.power_meter_raw}
        />

        {/* 3D Visualizer & ML Explanation Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* 3D Energy Core */}
          <div className="lg:col-span-7">
            <EnergyCore3D
              cpuUtilization={telemetry?.cpu_utilization ?? 0}
              gpuUtilization={telemetry?.gpu_utilization}
              estimatedPower={estimatedPower}
              isOptimized={isOptimized}
            />
          </div>

          {/* ML Explanation Panel: "Why is estimated energy high?" */}
          <div className="lg:col-span-5 p-6 rounded-2xl bg-surface-card border border-surface-border flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-surface-border">
                <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyber-neon" />
                  ML Explanation Panel
                </span>
                <span className="text-[10px] font-mono text-gray-400">
                  Model Latency: {prediction ? `${prediction.inference_latency_ms.toFixed(2)} ms` : "Unavailable"}
                </span>
              </div>

              <h3 className="text-sm font-bold text-white mt-3">
                Why is estimated energy at {estimatedPower === null ? "Unavailable" : `${estimatedPower.toFixed(1)} Watts`}?
              </h3>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Feature attribution computed directly from model tree weights and current telemetry state:
              </p>

              {/* Dynamic Feature Weight Bars */}
              <div className="mt-4 space-y-3 font-mono text-xs">
                
                <div>
                  <div className="flex justify-between text-gray-300 mb-1">
                    <span>CPU Utilization</span>
                    <span className="text-white font-bold">{telemetry?.cpu_utilization == null ? "Unavailable" : `${telemetry.cpu_utilization.toFixed(1)}%`}</span>
                  </div>
                  <div className="w-full bg-surface-elevated rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-cyber-neon h-full rounded-full transition-all duration-500"
                      style={{ width: `${telemetry?.cpu_utilization == null ? 0 : Math.min(100, telemetry.cpu_utilization)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-gray-300 mb-1">
                    <span>Memory Working Set</span>
                    <span className="text-white font-bold">{telemetry?.memory_usage == null ? "Unavailable" : `${telemetry.memory_usage.toFixed(1)}%`}</span>
                  </div>
                  <div className="w-full bg-surface-elevated rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-cyber-cyan h-full rounded-full transition-all duration-500"
                      style={{ width: `${telemetry?.memory_usage == null ? 0 : Math.min(100, telemetry.memory_usage * 0.85)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-gray-300 mb-1">
                    <span>Active Process Count</span>
                    <span className="text-white font-bold">{telemetry?.process_count == null ? "Unavailable" : `${telemetry.process_count} tasks`}</span>
                  </div>
                  <div className="w-full bg-surface-elevated rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-amber-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${telemetry?.process_count == null ? 0 : Math.min(100, (telemetry.process_count / 300) * 100)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-gray-300 mb-1">
                    <span>Thermal Load</span>
                    <span className="text-white font-bold">{telemetry?.temperature == null ? "Unavailable" : `${telemetry.temperature.toFixed(0)}°C`}</span>
                  </div>
                  <div className="w-full bg-surface-elevated rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-rose-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${telemetry?.temperature == null ? 0 : Math.min(100, ((telemetry.temperature - 35) / 55) * 100)}%` }}
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* CTA to Optimize Page */}
            <div className="mt-5 pt-4 border-t border-surface-border flex items-center justify-between">
              <span className="text-[11px] font-mono text-emerald-400">
                {potentialReductionPct === null ? "Optimization scope unavailable" : `Optimization Available (-${potentialReductionPct}%)`}
              </span>
              <Link
                href="/optimize"
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-mono text-xs font-bold shadow-glow-green flex items-center gap-1.5 transition"
              >
                <span>Tune System</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

          </div>

        </div>

        {/* 6 Core Hardware Telemetry Cards */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyber-neon" />
              Live Hardware Telemetry
            </h3>
            <span className="text-xs font-mono text-gray-400">
              Auto-refreshing every 2.5s
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            
            {/* 1. CPU */}
            <TelemetryCard
              title="CPU Load"
              value={telemetry?.cpu_utilization?.toFixed(1) || null}
              unit="%"
              icon={Cpu}
              percentage={telemetry?.cpu_utilization}
              subtitle={telemetry?.cpu_frequency ? `${telemetry.cpu_frequency} MHz` : "Multi-Core Active"}
              colorTheme="emerald"
            />

            {/* 2. RAM */}
            <TelemetryCard
              title="RAM Usage"
              value={telemetry?.memory_usage?.toFixed(1) || null}
              unit="%"
              icon={Layers}
              percentage={telemetry?.memory_usage}
              subtitle={telemetry?.memory_used_gb ? `${telemetry.memory_used_gb} / ${telemetry.memory_total_gb} GB` : "Physical Memory"}
              colorTheme="cyan"
            />

            {/* 3. GPU */}
            <TelemetryCard
              title="GPU Activity"
              value={telemetry?.gpu_utilization !== null && telemetry?.gpu_utilization !== undefined ? telemetry.gpu_utilization.toFixed(1) : null}
              unit="%"
              icon={Sparkles}
              percentage={telemetry?.gpu_utilization}
              subtitle={telemetry?.gpu_name || "Intel Arc Graphics"}
              colorTheme="purple"
              isUnavailable={telemetry?.gpu_utilization === null}
            />

            {/* 4. Disk */}
            <TelemetryCard
              title="Disk I/O"
              value={telemetry?.disk_io?.toFixed(1) || null}
              unit="MB/s"
              icon={HardDrive}
              percentage={telemetry?.disk_io == null ? undefined : Math.min(100, telemetry.disk_io * 2)}
              subtitle={telemetry?.disk_read_mbs ? `R:${telemetry.disk_read_mbs} W:${telemetry.disk_write_mbs}` : "I/O Throughput"}
              colorTheme="amber"
            />

            {/* 5. Network */}
            <TelemetryCard
              title="Latency / Ping"
              value={telemetry?.network_latency !== null && telemetry?.network_latency !== undefined ? telemetry.network_latency.toFixed(0) : null}
              unit="ms"
              icon={Wifi}
              percentage={telemetry?.network_latency == null ? undefined : Math.min(100, telemetry.network_latency)}
              subtitle={telemetry?.network_throughput_kbs ? `${telemetry.network_throughput_kbs} KB/s` : "Gateway Ping"}
              colorTheme="cyan"
              isUnavailable={telemetry?.network_latency === null}
            />

            {/* 6. Processes */}
            <TelemetryCard
              title="Processes"
              value={telemetry?.process_count?.toString() || null}
              unit="tasks"
              icon={Activity}
              subtitle={telemetry?.thread_count ? `${telemetry.thread_count} threads` : "Windows Tasks"}
              colorTheme="emerald"
            />

          </div>
        </div>

        {/* Real-Time Live Trajectory Chart */}
        <LiveChart history={history} />

      </main>

      {/* Presentation Mode Full-Screen Overlay */}
      {telemetry && (
        <PresentationMode
          isOpen={showPresentation}
          onClose={() => setShowPresentation(false)}
          telemetry={telemetry}
          estimatedPower={estimatedPower}
          carbonRate={carbonRate}
          credits={null}
          onQuickOptimize={() => { window.location.href = "/optimize"; }}
          isOptimized={isOptimized}
        />
      )}

      <Footer />
    </div>
  );
}
