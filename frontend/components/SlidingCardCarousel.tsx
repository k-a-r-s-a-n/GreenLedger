// frontend/components/SlidingCardCarousel.tsx
"use client";

/**
 * Sliding Carousel component for step-by-step exploration (Pipeline & Architecture).
 * Replaces static stacked panels with a fluid sliding deck with progress dots,
 * navigation arrows, drag gestures, and keyboard arrow controls.
 */

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, LucideIcon } from "lucide-react";
import { GlassPanel } from "./GlassPanel";

export interface CarouselSlide {
  id: string;
  step: string;
  title: string;
  body: string;
  icon?: LucideIcon;
  detail?: string;
  badge?: string;
}

interface SlidingCardCarouselProps {
  slides: CarouselSlide[];
  autoPlay?: boolean;
  autoPlayIntervalMs?: number;
  className?: string;
}

export const SlidingCardCarousel: React.FC<SlidingCardCarouselProps> = ({
  slides,
  autoPlay = false,
  autoPlayIntervalMs = 5000,
  className = "",
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<number>(1);
  const prefersReducedMotion = useReducedMotion();

  const handleNext = useCallback(() => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const handlePrev = useCallback(() => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  const handleSelect = (idx: number) => {
    setDirection(idx > currentIndex ? 1 : -1);
    setCurrentIndex(idx);
  };

  // Keyboard navigation (ArrowLeft, ArrowRight)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePrev]);

  // Autoplay support
  useEffect(() => {
    if (!autoPlay) return;
    const timer = setInterval(handleNext, autoPlayIntervalMs);
    return () => clearInterval(timer);
  }, [autoPlay, autoPlayIntervalMs, handleNext]);

  const current = slides[currentIndex];
  const Icon = current?.icon;

  const slideVariants = {
    enter: (dir: number) => ({
      x: prefersReducedMotion ? 0 : dir > 0 ? 80 : -80,
      opacity: 0,
      filter: prefersReducedMotion ? "none" : "blur(8px)",
      scale: prefersReducedMotion ? 1 : 0.98,
    }),
    center: {
      x: 0,
      opacity: 1,
      filter: "blur(0px)",
      scale: 1,
      transition: {
        x: { type: "spring", stiffness: 320, damping: 32 },
        opacity: { duration: 0.35 },
        filter: { duration: 0.3 },
      },
    },
    exit: (dir: number) => ({
      x: prefersReducedMotion ? 0 : dir > 0 ? -80 : 80,
      opacity: 0,
      filter: prefersReducedMotion ? "none" : "blur(8px)",
      scale: prefersReducedMotion ? 1 : 0.98,
      transition: { duration: 0.25 },
    }),
  };

  return (
    <div className={`relative w-full ${className}`}>
      {/* Top Track & Progress Indicator */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {slides.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => handleSelect(idx)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center gap-2 border ${
                idx === currentIndex
                  ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300 shadow-glow-green/20"
                  : "bg-white/[0.03] border-white/10 text-white/45 hover:text-white hover:bg-white/10"
              }`}
            >
              <span className="opacity-60">{s.step}</span>
              <span className="font-medium truncate max-w-[120px] sm:max-w-none">{s.title}</span>
            </button>
          ))}
        </div>

        {/* Carousel Navigation Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handlePrev}
            aria-label="Previous slide"
            className="p-2 rounded-xl liquid-glass border border-white/10 text-white/70 hover:text-white hover:border-emerald-500/40 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono text-white/40 min-w-[38px] text-center">
            {currentIndex + 1} / {slides.length}
          </span>
          <button
            onClick={handleNext}
            aria-label="Next slide"
            className="p-2 rounded-xl liquid-glass border border-white/10 text-white/70 hover:text-white hover:border-emerald-500/40 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Slide Display Arena */}
      <div className="relative min-h-[260px] overflow-hidden rounded-3xl">
        <AnimatePresence custom={direction} mode="wait">
          <motion.div
            key={current.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="w-full"
          >
            <GlassPanel intensity="strong" className="p-8 sm:p-10 relative overflow-hidden">
              <span aria-hidden className="glass-sheen absolute inset-0" />
              <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

              <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-8">
                <div className="max-w-xl space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded-md text-[10px] font-mono uppercase tracking-widest bg-emerald-500/15 border border-emerald-500/40 text-emerald-300">
                      Step {current.step}
                    </span>
                    {current.badge && (
                      <span className="px-2.5 py-1 rounded-md text-[10px] font-mono text-white/50 border border-white/10">
                        {current.badge}
                      </span>
                    )}
                  </div>

                  <h3 className="font-display text-3xl sm:text-4xl text-white tracking-display">
                    {current.title}
                  </h3>

                  <p className="text-base text-white/65 leading-relaxed">
                    {current.body}
                  </p>

                  {current.detail && (
                    <div className="pt-2 border-t border-white/10 text-xs font-mono text-emerald-300/80">
                      {current.detail}
                    </div>
                  )}
                </div>

                {/* Big Visual Step Medallion */}
                <div className="shrink-0 flex items-center justify-center">
                  <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl liquid-glass-strong border border-emerald-500/30 flex flex-col items-center justify-center relative shadow-2xl group">
                    {Icon ? (
                      <Icon className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-400 mb-2 transition-transform duration-300 group-hover:scale-110" />
                    ) : (
                      <span className="font-display text-4xl sm:text-5xl text-emerald-400 mb-1">
                        {current.step}
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-white/40 tracking-widest uppercase">
                      GreenLedger
                    </span>
                  </div>
                </div>
              </div>
            </GlassPanel>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Progress Bar */}
      <div className="w-full bg-white/5 h-1 rounded-full mt-4 overflow-hidden">
        <motion.div
          className="bg-emerald-400 h-full rounded-full"
          initial={false}
          animate={{
            width: `${((currentIndex + 1) / slides.length) * 100}%`,
          }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </div>
  );
};

