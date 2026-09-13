// frontend/components/TelemetryCard.tsx
"use client";

import React from "react";
import { LucideIcon } from "lucide-react";

interface TelemetryCardProps {
  title: string;
  value: string | number | null;
  unit?: string;
  icon: LucideIcon;
  subtitle?: string;
  percentage?: number | null;
  colorTheme?: "emerald" | "cyan" | "amber" | "purple";
  isUnavailable?: boolean;
}

export const TelemetryCard: React.FC<TelemetryCardProps> = ({
  title,
  value,
  unit,
  icon: Icon,
  subtitle,
  percentage,
  colorTheme = "emerald",
  isUnavailable = false,
}) => {
  const getThemeClasses = () => {
    switch (colorTheme) {
      case "cyan":
        return {
          iconColor: "text-cyan-400",
          barColor: "bg-cyan-400",
          borderHover: "hover:border-cyan-500/40",
          glow: "group-hover:shadow-glow-cyan",
        };
      case "amber":
        return {
          iconColor: "text-amber-400",
          barColor: "bg-amber-400",
          borderHover: "hover:border-amber-500/40",
          glow: "group-hover:shadow-glow-gold",
        };
      case "purple":
        return {
          iconColor: "text-purple-400",
          barColor: "bg-purple-400",
          borderHover: "hover:border-purple-500/40",
          glow: "",
        };
      default:
        return {
          iconColor: "text-emerald-400",
          barColor: "bg-emerald-400",
          borderHover: "hover:border-emerald-500/40",
          glow: "group-hover:shadow-glow-green",
        };
    }
  };

  const theme = getThemeClasses();

  return (
    <div
      className={`p-4 rounded-2xl liquid-glass border border-white/10 transition-all duration-300 group relative overflow-hidden ${theme.borderHover} ${theme.glow}`}
    >
      <span aria-hidden className="glass-sheen absolute inset-0" />
      <div className="flex items-start justify-between relative z-10">
        <span className="text-[11px] font-medium text-white/45 uppercase tracking-wider font-mono">
          {title}
        </span>
        <div className={`p-1.5 rounded-lg liquid-glass-strong border border-white/10 ${theme.iconColor}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>

      <div className="mt-2.5 flex items-baseline gap-1 relative z-10">
        {isUnavailable || value === null ? (
          <span className="text-sm font-mono text-white/40 italic">Unavailable</span>
        ) : (
          <>
            <span className="text-2xl font-bold font-mono tracking-tight text-white">
              {value}
            </span>
            {unit && <span className="text-xs font-mono text-white/45">{unit}</span>}
          </>
        )}
      </div>

      {percentage !== undefined && percentage !== null && !isUnavailable && (
        <div className="mt-2.5 w-full bg-white/5 rounded-full h-1.5 overflow-hidden relative z-10">
          <div
            className={`h-full rounded-full transition-all duration-500 ${theme.barColor}`}
            style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
          />
        </div>
      )}

      {subtitle && (
        <p className="mt-2 text-[11px] text-white/40 truncate font-mono relative z-10">
          {subtitle}
        </p>
      )}
    </div>
  );
};
