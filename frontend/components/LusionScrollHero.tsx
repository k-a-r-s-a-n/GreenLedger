// frontend/components/LusionScrollHero.tsx
"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { ArrowRight, Sparkles, Cpu, Award, ShieldCheck, Activity } from "lucide-react";
import { EarthSphere3D } from "./EarthSphere3D";
import { Button } from "./Button";

export const LusionScrollHero: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 20 });

  // 3D Model Scale and Rotation linked to scroll progress (Lusion signature effect)
  const sphereScale = useTransform(smoothProgress, [0, 0.7, 1], [1, 1.45, 1.8]);
  const sphereY = useTransform(smoothProgress, [0, 1], [0, 180]);
  const sphereOpacity = useTransform(smoothProgress, [0, 0.85, 1], [1, 0.9, 0.2]);

  // Typography Parallax
  const textY = useTransform(smoothProgress, [0, 0.5], [0, -60]);
  const textOpacity = useTransform(smoothProgress, [0, 0.6], [1, 0]);

  return (
    <div
      ref={containerRef}
      className="relative min-h-[140vh] w-full flex flex-col items-center justify-start overflow-hidden pt-24"
    >
      {/* Background Ambient Aura */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/10 rounded-full blur-[160px] pointer-events-none" />

      {/* Sticky Scroll Canvas Layer */}
      <div className="sticky top-20 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
        
        {/* Animated Badge */}
        <motion.div
          style={{ opacity: textOpacity, y: textY }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full liquid-glass text-white/80 text-xs font-mono mb-6 border border-emerald-500/30 shadow-glow-green/10"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-dot" />
          <span>Windows 11 Live Intelligence &amp; Autonomous Optimization</span>
        </motion.div>

        {/* Cinematic Headline with Lusion-like Scale & Depth */}
        <motion.div
          style={{ opacity: textOpacity, y: textY }}
          className="w-full max-w-5xl mx-auto space-y-4 text-center"
        >
          <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl tracking-display text-white font-extrabold uppercase leading-[0.98]">
            Computing, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
              Made Accountable.
            </span>
          </h1>
          <p className="text-sm sm:text-lg text-white/60 font-sans max-w-2xl mx-auto leading-relaxed">
            Real-time hardware telemetry streams directly into a physics-calibrated ML engine.
            Measure avoided watts, reverse power bloat, and bank verified on-chain green credits.
          </p>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          style={{ opacity: textOpacity, y: textY }}
          className="mt-8 flex items-center gap-4 z-20"
        >
          <Link href="/dashboard">
            <Button size="lg" className="shadow-glow-green/30">
              Launch Live Dashboard
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
          <Link href="#explore">
            <Button variant="secondary" size="lg">
              Explore Scroll Journey
            </Button>
          </Link>
        </motion.div>

        {/* Lusion Centerpiece: 3D Interactive WebGL Eco-Sphere with Scroll Reactions */}
        <motion.div
          style={{
            scale: sphereScale,
            y: sphereY,
            opacity: sphereOpacity,
          }}
          className="relative mt-8 z-10 w-full max-w-[560px] aspect-square flex items-center justify-center pointer-events-auto"
        >
          <div className="absolute inset-0 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none" />
          <EarthSphere3D size={520} interactive={true} />
        </motion.div>

        {/* Trust Stats Bar */}
        <motion.div
          style={{ opacity: textOpacity }}
          className="mt-4 grid grid-cols-3 gap-8 text-center max-w-lg border-t border-white/10 pt-6"
        >
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-white/40">Inference</div>
            <div className="text-sm font-semibold font-mono text-emerald-400 mt-0.5">&lt;2 ms</div>
          </div>
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-white/40">Safety</div>
            <div className="text-sm font-semibold font-mono text-white mt-0.5">100% Reversible</div>
          </div>
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-white/40">Ledger</div>
            <div className="text-sm font-semibold font-mono text-cyan-400 mt-0.5">Sepolia Verified</div>
          </div>
        </motion.div>

      </div>
    </div>
  );
};
