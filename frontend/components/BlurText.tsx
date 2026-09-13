// frontend/components/BlurText.tsx
"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "../lib/cn";

interface BlurTextProps {
  /** Text is split into words; each word is a motion span. */
  text: string;
  /** Seconds between each word's entrance. Default 0.045. */
  stagger?: number;
  /** Seconds before the first word starts. */
  delay?: number;
  className?: string;
  /** Render as a specific heading level for semantics. Default "h1" visual span style only. */
  as?: "h1" | "h2" | "h3" | "p" | "span";
}

const container = (stagger: number, delay: number) => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: stagger, delayChildren: delay },
  },
});

const wordVariant = {
  hidden: { opacity: 0, y: 10, filter: "blur(10px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};

/**
 * Staggered blur-in headline text, adapted from the reference spec's
 * BlurText. Each word rises ~10px while unblurring. Words are wrapped in
 * aria-hidden spans and the full text is exposed via sr-only so screen
 * readers hear one clean phrase instead of chopped words.
 */
export function BlurText({
  text,
  stagger = 0.045,
  delay = 0,
  className,
  as = "span",
}: BlurTextProps) {
  const prefersReducedMotion = useReducedMotion();
  const words = text.split(" ");
  const Tag = as;

  if (prefersReducedMotion) {
    // Static render — same layout, no choreography.
    return (
      <Tag className={className}>
        <span className="sr-only">{text}</span>
        <span aria-hidden>{text}</span>
      </Tag>
    );
  }

  return (
    <Tag className={className}>
      <span className="sr-only">{text}</span>
      <motion.span
        aria-hidden
        className={cn("inline-block")}
        variants={container(stagger, delay)}
        initial="hidden"
        animate="visible"
      >
        {words.map((word, i) => (
          <motion.span
            key={`${word}-${i}`}
            className="inline-block will-change-transform"
            variants={wordVariant}
          >
            {word}
            {i < words.length - 1 ? "\u00A0" : ""}
          </motion.span>
        ))}
      </motion.span>
    </Tag>
  );
}
