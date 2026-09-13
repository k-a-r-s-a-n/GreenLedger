// frontend/components/GlassPanel.tsx
"use client";

import React from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { cn } from "../lib/cn";

type GlassIntensity = "default" | "strong" | "accent";

interface GlassPanelProps extends HTMLMotionProps<"div"> {
  /** Visual intensity: `strong` for heroes/headers, `accent` adds an emerald rim for live data. */
  intensity?: GlassIntensity;
  /** Adds the thin top highlight line ("liquid" surface cue). Default true. */
  sheen?: boolean;
  /** Animate a soft blur+rise entrance. Disable for static wrappers. */
  animateIn?: boolean;
  /** Entrance delay (seconds) — used by pages to stagger siblings. */
  delay?: number;
  className?: string;
  children: React.ReactNode;
}

/**
 * The core surface primitive of the design system.
 * Maps to .liquid-glass / .liquid-glass-strong in globals.css.
 * All entrance motion is skipped when the user prefers reduced motion.
 */
export function GlassPanel({
  intensity = "default",
  sheen = true,
  animateIn = false,
  delay = 0,
  className,
  children,
  ...rest
}: GlassPanelProps) {
  const prefersReducedMotion = useReducedMotion();

  const glassClass =
    intensity === "strong"
      ? "liquid-glass-strong"
      : intensity === "accent"
        ? "liquid-glass liquid-glass-accent"
        : "liquid-glass";

  // Choreography: 14px rise + blur(8px)→0 over 0.55s, easeOut — the standard
  // panel entrance across all screens. Reduced motion renders statically.
  const entrance = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 14, filter: "blur(8px)" },
        animate: { opacity: 1, y: 0, filter: "blur(0px)" },
        transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] as const },
      };

  return (
    <motion.div
      className={cn("relative overflow-hidden rounded-2xl", glassClass, className)}
      {...(animateIn ? entrance : {})}
      {...rest}
    >
      {sheen && <span aria-hidden className="glass-sheen absolute inset-0" />}
      {children}
    </motion.div>
  );
}
