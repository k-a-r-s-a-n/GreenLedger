// frontend/components/StatCard.tsx
"use client";

import React, { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Skeleton } from "./Skeleton";
import { cn } from "../lib/cn";

interface StatCardProps {
  label: string;
  /** Numeric value — animated on change. Null renders the loading/unavailable skeleton. */
  value: number | null;
  unit?: string;
  /** Decimal places for display. Default 1. */
  precision?: number;
  /** Mono variant for technical values (watts, ms). Default true. */
  mono?: boolean;
  /** Emerald accent when true (e.g. positive metrics like credits). */
  accent?: boolean;
  /** Short context line under the value. */
  hint?: string | null;
  className?: string;
}

/**
 * Glass stat card used across dashboard/profile/marketplace.
 * Value changes animate as a quick blur-swap (old value fades up-blurred,
 * new value settles) — deliberately subtle so 2.5s telemetry ticks don't
 * feel jittery. Skeleton state is used for loading AND null-unavailable.
 */
export function StatCard({
  label,
  value,
  unit,
  precision = 1,
  mono = true,
  accent = false,
  hint,
  className,
}: StatCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const isFirstRender = useRef(true);

  // Skip the entrance tick on first data arrival; only animate *changes*.
  useEffect(() => {
    isFirstRender.current = false;
  }, []);

  const showSkeleton = value === null;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl liquid-glass p-4",
        accent && "liquid-glass-accent",
        className
      )}
    >
      <span aria-hidden className="glass-sheen absolute inset-0" />
      <p className="text-[11px] uppercase tracking-widest text-white/45 font-mono">
        {label}
      </p>

      <div className="mt-2 h-9 flex items-baseline gap-1.5">
        {showSkeleton ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={value}
              initial={
                prefersReducedMotion || isFirstRender.current
                  ? false
                  : { opacity: 0, y: 8, filter: "blur(6px)" }
              }
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={
                prefersReducedMotion
                  ? undefined
                  : { opacity: 0, y: -8, filter: "blur(6px)" }
              }
              transition={{ duration: 0.35, ease: "easeOut" }}
              className={cn(
                "text-3xl font-semibold tracking-tight-2 text-white",
                mono && "font-mono",
                accent && "text-emerald-300"
              )}
            >
              {value.toFixed(precision)}
            </motion.span>
          </AnimatePresence>
        )}
        {!showSkeleton && unit && (
          <span className="text-xs font-mono text-white/45">{unit}</span>
        )}
      </div>

      {hint !== undefined && (
        <p className="mt-1 text-[11px] font-mono text-white/40 truncate">
          {hint ?? ""}
        </p>
      )}
    </div>
  );
}
