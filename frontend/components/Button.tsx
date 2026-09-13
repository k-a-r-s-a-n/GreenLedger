// frontend/components/Button.tsx
"use client";

import React from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "../lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

// Extend framer's motion button props (not React's) so spread into
// <motion.button> type-checks — framer redefines onDrag etc. Children are
// narrowed back to ReactNode (framer's type also admits MotionValues,
// which we don't want as button labels).
interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner and blocks interaction while true. */
  loading?: boolean;
  children?: React.ReactNode;
}

const variants: Record<Variant, string> = {
  // Primary: emerald accent gradient — the single saturated CTA style.
  primary:
    "bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 shadow-glow-green border border-transparent",
  // Secondary: liquid glass surface, white hierarchy.
  secondary:
    "liquid-glass text-white hover:bg-white/10 border border-white/10",
  // Ghost: text-only for tertiary actions.
  ghost: "text-white/70 hover:text-white hover:bg-white/5 border border-transparent",
  danger:
    "bg-rose-600/90 text-white hover:bg-rose-500 border border-transparent",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-7 text-base",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "primary", size = "md", loading, className, children, disabled, ...rest },
    ref
  ) {
    const prefersReducedMotion = useReducedMotion();
    return (
      <motion.button
        ref={ref}
        whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
        transition={{ duration: 0.15 }}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl font-medium tracking-tight-2 transition-colors disabled:opacity-50 disabled:pointer-events-none",
          variants[variant],
          sizes[size],
          className
        )}
        {...rest}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
        {children}
      </motion.button>
    );
  }
);
