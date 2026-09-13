// frontend/components/LiveChart.tsx
"use client";

import React from "react";

interface DataPoint {
  time: string;
  power: number;
  cpu: number;
  carbon: number;
}

interface LiveChartProps {
  history: DataPoint[];
  title?: string;
}

export const LiveChart: React.FC<LiveChartProps> = ({
  history,
  title = "Real-Time Power & Workload Trajectory",
}) => {
  const points = history;
  const maxCarbon = points.length ? Math.max(...points.map((p) => p.carbon)) : 0;

  const maxPower = Math.max(...points.map((p) => p.power), 45);
  const minPower = Math.max(0, Math.min(...points.map((p) => p.power), 10) - 5);

  const width = 600;
  const height = 180;
  const padding = 25;

  // Coordinate mapping
  const getX = (index: number) => {
    if (points.length <= 1) return padding;
    return padding + (index / (points.length - 1)) * (width - padding * 2);
  };

  const getYPower = (val: number) => {
    const range = maxPower - minPower || 1;
    return height - padding - ((val - minPower) / range) * (height - padding * 2);
  };

  const getYCpu = (val: number) => {
    return height - padding - (val / 100) * (height - padding * 2);
  };

  const getYCarbon = (val: number) => {
    return height - padding - (maxCarbon ? (val / maxCarbon) * (height - padding * 2) : 0);
  };

  const powerPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${getX(i)},${getYPower(p.power)}`)
    .join(" ");

  const cpuPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${getX(i)},${getYCpu(p.cpu)}`)
    .join(" ");

  const carbonPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${getX(i)},${getYCarbon(p.carbon)}`)
    .join(" ");

  // Gradient area path for power
  const areaPath = `${powerPath} L ${getX(points.length - 1)},${height - padding} L ${getX(0)},${height - padding} Z`;

  return (
    <div className="p-5 rounded-2xl liquid-glass border border-white/10 flex flex-col relative overflow-hidden">
      <span aria-hidden className="glass-sheen absolute inset-0" />
      <div className="flex items-center justify-between pb-3 border-b border-white/10 text-xs font-mono relative z-10">
        <span className="text-white font-semibold">
          {title} {points.length ? "(live samples)" : "(waiting for samples)"}
        </span>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-emerald-400" />
            <span className="text-white/45">Power (Watts)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-cyan-400" />
            <span className="text-white/45">CPU (%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-amber-400" />
            <span className="text-white/45">
              Carbon (g/h): {points.length ? maxCarbon.toFixed(1) : "—"}
            </span>
          </div>
        </div>
      </div>

      <div className="w-full mt-3 overflow-hidden relative z-10">
        {points.length === 0 ? (
          <div className="h-44 flex items-center justify-center text-xs font-mono text-white/35">
            Waiting for real telemetry and model samples.
          </div>
        ) : (
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44 overflow-visible">
            <defs>
              <linearGradient id="powerGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
            <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.12)" />

            {/* Power Area Fill */}
            <path d={areaPath} fill="url(#powerGrad)" />

            {/* CPU Line */}
            <path d={cpuPath} fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeOpacity="0.75" />

            {/* Power Line */}
            <path d={powerPath} fill="none" stroke="#10b981" strokeWidth="2" />

            {/* Estimated carbon line derived from each power sample */}
            <path d={carbonPath} fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 3" />

            {/* Latest Point Indicator */}
            {points.length > 0 && (
              <circle
                cx={getX(points.length - 1)}
                cy={getYPower(points[points.length - 1].power)}
                r="4"
                className="fill-emerald-400 stroke-white stroke-2 animate-pulse"
              />
            )}
          </svg>
        )}
      </div>

      <div className="flex items-center justify-between text-[10px] text-white/40 font-mono mt-2 relative z-10">
        <span>{points[0]?.time || "—"}</span>
        <span>{points[points.length - 1]?.time || "—"}</span>
        <span>{points.length ? "Live telemetry stream" : "Waiting for ticks"}</span>
      </div>
    </div>
  );
};
