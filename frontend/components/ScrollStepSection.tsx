// frontend/components/ScrollStepSection.tsx
"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Activity, Layers, Cpu, Sliders, Lock, Award, ShieldCheck } from "lucide-react";
import { GlassPanel } from "./GlassPanel";

const STEPS = [
  {
    step: "01",
    title: "Continuous Hardware Telemetry",
    subtitle: "Low-overhead native Windows collection",
    desc: "The lightweight Windows agent gathers CPU, GPU, memory, and disk counters directly from OS APIs every 2.5 seconds. Zero private data leaves your device.",
    icon: Activity,
    metrics: "2.5s sampling · psutil & CIM",
  },
  {
    step: "02",
    title: "Feature Engineering & Defense",
    subtitle: "Physics mapping and out-of-distribution guards",
    desc: "Raw system metrics are normalized and cross-correlated with thermal coefficients to prevent spoofing and guard against edge-case anomalies.",
    icon: Layers,
    metrics: "6 Primary Features · OOD Filter",
  },
  {
    step: "03",
    title: "XGBoost Machine Learning Inference",
    subtitle: "Physics-calibrated CMOS wattage prediction",
    desc: "Our gradient boosted model translates telemetry into instantaneous wattage draw in under 2 milliseconds, detailing real-time feature attributions.",
    icon: Cpu,
    metrics: "<2 ms latency · 99.1% R² accuracy",
  },
  {
    step: "04",
    title: "Real-time Carbon Translation",
    subtitle: "Regional grid carbon intensity calculation",
    desc: "Direct wattage estimates are converted to grams of CO₂e per hour using EPA eGRID standards, revealing your device's true environmental toll.",
    icon: Sliders,
    metrics: "0.385 kg/kWh baseline · g CO₂e/h",
  },
  {
    step: "05",
    title: "Safe Reversible Optimization",
    subtitle: "Guaranteed OS integrity and whitelist safeguards",
    desc: "Approve 1-click power profiles and safe suspension of non-essential background processes. Critical system apps like explorer.exe are immutably protected.",
    icon: Lock,
    metrics: "100% Reversible · 0 Risk",
  },
  {
    step: "06",
    title: "Verified On-Chain Sepolia Minting",
    subtitle: "Cryptographic proof of energy avoided",
    desc: "Before-and-after snapshots are cryptographically fingerprinted on our backend. Validated savings mint Green Credits and unlock exclusive ERC-1155 NFT merit badges.",
    icon: Award,
    metrics: "ERC-1155 · Sepolia Testnet",
  },
];

export const ScrollStepSection: React.FC = () => {
  return (
    <section id="explore" className="relative py-32 bg-black overflow-hidden border-t border-white/10">
      {/* Background radial accent */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/5 rounded-full blur-[160px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full liquid-glass text-xs font-mono text-emerald-400 border border-emerald-500/30 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            End-to-End Autonomous Pipeline
          </div>
          <h2 className="font-display text-4xl sm:text-6xl font-bold tracking-display uppercase text-white">
            From Sensor to Signature.
          </h2>
          <p className="mt-4 text-sm sm:text-base text-white/50 font-sans leading-relaxed">
            Scroll through each transparent layer of GreenLedger. No black boxes, no fake offsets — just pure hardware telemetry and cryptographic verification.
          </p>
        </div>

        {/* Vertical Stack with Scroll-Driven Parallax Cards */}
        <div className="space-y-12 max-w-5xl mx-auto">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isEven = idx % 2 === 0;

            return (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="relative"
              >
                <GlassPanel
                  intensity="strong"
                  className="p-8 sm:p-12 rounded-3xl border border-white/10 hover:border-emerald-500/30 transition-all group overflow-hidden"
                >
                  <span aria-hidden className="glass-sheen absolute inset-0" />
                  
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
                    {/* Left: Info */}
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono uppercase tracking-widest px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                          Phase {step.step}
                        </span>
                        <span className="text-xs font-mono text-white/40">
                          {step.subtitle}
                        </span>
                      </div>

                      <h3 className="font-display text-3xl sm:text-4xl font-bold tracking-display text-white group-hover:text-emerald-300 transition-colors">
                        {step.title}
                      </h3>

                      <p className="text-sm sm:text-base text-white/65 leading-relaxed font-sans max-w-2xl">
                        {step.desc}
                      </p>

                      <div className="pt-2 text-xs font-mono text-emerald-400/90 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        {step.metrics}
                      </div>
                    </div>

                    {/* Right: Step Indicator & Icon */}
                    <div className="shrink-0 flex items-center justify-center">
                      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl liquid-glass border border-white/15 flex flex-col items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform shadow-2xl">
                        <Icon className="w-8 h-8 sm:w-10 sm:h-10 mb-2" />
                        <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
                          STEP {step.step}
                        </span>
                      </div>
                    </div>
                  </div>
                </GlassPanel>
              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
};

