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
  isUnavailable = false
}) => {
  const getThemeClasses = () => {
    switch (colorTheme) {
      case "cyan":
        return {
          iconColor: "text-cyber-cyan",
          barColor: "bg-cyber-cyan",
          borderHover: "hover:border-cyber-cyan/50",
          glow: "group-hover:shadow-glow-cyan"
        };
      case "amber":
        return {
          iconColor: "text-amber-400",
          barColor: "bg-amber-400",
          borderHover: "hover:border-amber-400/50",
          glow: "group-hover:shadow-glow-gold"
        };
      case "purple":
        return {
          iconColor: "text-purple-400",
          barColor: "bg-purple-400",
          borderHover: "hover:border-purple-400/50",
          glow: ""
        };
      default:
        return {
          iconColor: "text-cyber-neon",
          barColor: "bg-cyber-emerald",
          borderHover: "hover:border-emerald-500/50",
          glow: "group-hover:shadow-glow-green"
        };
    }
  };

  const theme = getThemeClasses();

  return (
    <div className={`p-4 rounded-xl bg-surface-card/90 border border-surface-border transition-all duration-300 group ${theme.borderHover} ${theme.glow}`}>
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider font-mono">
          {title}
        </span>
        <div className={`p-2 rounded-lg bg-surface-elevated/70 border border-surface-border ${theme.iconColor}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-1">
        {isUnavailable || value === null ? (
          <span className="text-lg font-mono text-gray-500 italic">Unavailable</span>
        ) : (
          <>
            <span className="text-2xl font-bold font-mono tracking-tight text-white">
              {value}
            </span>
            {unit && <span className="text-xs font-mono text-gray-400">{unit}</span>}
          </>
        )}
      </div>

      {percentage !== undefined && percentage !== null && !isUnavailable && (
        <div className="mt-2.5 w-full bg-surface-elevated rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${theme.barColor}`}
            style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
          />
        </div>
      )}

      {subtitle && (
        <p className="mt-2 text-[11px] text-gray-400 truncate font-mono">
          {subtitle}
        </p>
      )}
    </div>
  );
};
