// frontend/components/ModeBadge.tsx
import React from "react";
import { Radio, FlaskConical, WifiOff } from "lucide-react";
import { cn } from "../lib/cn";

export type DataSourceMode = "live" | "demo" | "offline";

interface ModeBadgeProps {
  mode: DataSourceMode;
  /** Optional explanation surfaced as title text. */
  label?: string;
  className?: string;
}

const config: Record<
  DataSourceMode,
  { icon: React.ElementType; text: string; classes: string; title: string }
> = {
  live: {
    icon: Radio,
    text: "LIVE",
    classes: "border-emerald-500/50 text-emerald-300 bg-emerald-500/10",
    title: "Data is live from the local Windows agent.",
  },
  demo: {
    icon: FlaskConical,
    text: "DEMO",
    classes: "border-amber-500/50 text-amber-300 bg-amber-500/10",
    title:
      "Agent offline — showing backend-simulated demo telemetry. Values are not from this machine.",
  },
  offline: {
    icon: WifiOff,
    text: "OFFLINE",
    classes: "border-white/15 text-white/50 bg-white/5",
    title: "No data source reachable. Values are unavailable, not estimated.",
  },
};

/**
 * Required on every data-bearing screen (per UX spec): communicates whether
 * the numbers on screen are live machine telemetry, backend demo data, or
 * absent. Amber demo styling is deliberately loud so demo data can never be
 * mistaken for measurements.
 */
export function ModeBadge({ mode, label, className }: ModeBadgeProps) {
  const { icon: Icon, text, classes, title } = config[mode];
  return (
    <span
      title={label ?? title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-mono tracking-widest",
        classes,
        className
      )}
    >
      <Icon className="w-3 h-3" aria-hidden />
      {text}
      {mode === "live" && (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot" aria-hidden />
      )}
    </span>
  );
}
