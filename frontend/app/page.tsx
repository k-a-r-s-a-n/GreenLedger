// frontend/app/page.tsx
"use client";

/**
 * GreenLedger Landing Page — Lusion.co-inspired scroll-driven journey.
 *
 * Upgrades:
 *  - High-impact futuristic typography (Syne + Plus Jakarta Sans).
 *  - Full-bleed 3D scroll hero (LusionScrollHero) with reactive eco-sphere scale & tilt.
 *  - Horizontal pin-scroll section (ScrollHorizontalSection) driven by vertical scroll.
 *  - Smooth parallax step narrative (ScrollStepSection).
 *  - Auto-starting backend/agent connectivity.
 */
import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity,
  Zap,
  Coins,
  ShieldCheck,
  Cpu,
  Award,
  Sparkles,
  Lock,
} from "lucide-react";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { HeroParticles } from "../components/HeroParticles";
import { LusionScrollHero } from "../components/LusionScrollHero";
import { ScrollHorizontalSection, type ScrollFeatureCard } from "../components/ScrollHorizontalSection";
import { ScrollStepSection } from "../components/ScrollStepSection";
import { Button } from "../components/Button";

const capabilityCards: ScrollFeatureCard[] = [
  {
    id: "card-01",
    step: "01",
    title: "Continuous Telemetry Engine",
    body: "Streams native Windows counters (CPU, RAM, GPU, Disk I/O) every 2.5s with zero telemetry loss. Completely local and private.",
    detail: "127.0.0.1:8765 agent daemon",
    badge: "Windows 11 Native",
    icon: Activity,
    tag: "psutil & CIM",
  },
  {
    id: "card-02",
    step: "02",
    title: "Physics CMOS Power Model",
    body: "XGBoost tree ensemble maps multi-core utilization and clock frequencies into true wattage dissipation with sub-2ms latency.",
    detail: "99.1% R² calibration",
    badge: "Physics AI",
    icon: Cpu,
    tag: "Gradient Boosted",
  },
  {
    id: "card-03",
    step: "03",
    title: "1-Click Safe Optimization",
    body: "Execute non-destructive power plans and throttle non-essential background processes. Critical OS tasks are immutably protected.",
    detail: "100% reversible actions",
    badge: "Zero-Risk Guard",
    icon: Zap,
    tag: "Instant Rollback",
  },
  {
    id: "card-04",
    step: "04",
    title: "Cryptographic Verification",
    body: "Server-side before-and-after snapshot comparisons prove the exact watts and CO₂e emissions averted before issuing rewards.",
    detail: "Replay-proof signing",
    badge: "Verified Proof",
    icon: ShieldCheck,
    tag: "Zero Simulation",
  },
  {
    id: "card-05",
    step: "05",
    title: "Sepolia Web3 Rewards",
    body: "Redeem green credits for on-chain ERC-1155 NFT merit badges minted directly on Ethereum Sepolia testnet.",
    detail: "Smart Contract Verified",
    badge: "Web3 Ledger",
    icon: Coins,
    tag: "ERC-1155",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-black text-white selection:bg-emerald-500/30 selection:text-white">
      <Navbar />

      {/* Hero Particle Field */}
      <HeroParticles className="fixed inset-0 pointer-events-none z-0" />

      {/* Lusion-style 3D Scroll Hero */}
      <LusionScrollHero />

      {/* Lusion Horizontal Pin-Scroll Section */}
      <ScrollHorizontalSection
        title="Engineered for Precision"
        subtitle="Core Capabilities"
        cards={capabilityCards}
      />

      {/* Scroll-Driven Step Narrative */}
      <ScrollStepSection />

      {/* Final Cinematic Call to Action */}
      <section className="py-32 relative border-t border-white/10 overflow-hidden bg-black">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-4 text-center z-10 space-y-6">
          <div className="w-14 h-14 rounded-2xl liquid-glass border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-glow-green/20">
            <Sparkles className="w-7 h-7" />
          </div>

          <h2 className="font-display text-4xl sm:text-7xl font-extrabold tracking-display uppercase text-white leading-tight">
            Stop guessing your footprint.
          </h2>

          <p className="text-base sm:text-xl text-white/60 font-sans max-w-2xl mx-auto leading-relaxed">
            See your machine&apos;s live draw, cut wasteful cycles with zero risk, and record verified energy savings on-chain.
          </p>

          <div className="pt-4 flex justify-center">
            <Link href="/dashboard">
              <Button size="lg" className="shadow-glow-green/30 px-8 py-4 text-base">
                Launch Live Dashboard
              </Button>
            </Link>
          </div>

          <div className="pt-8 flex items-center justify-center gap-6 text-xs font-mono text-white/40 flex-wrap">
            <span className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-emerald-400" /> Windows 11 Native</span>
            <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-emerald-400" /> No Admin Required</span>
            <span className="flex items-center gap-1.5"><Award className="w-3.5 h-3.5 text-cyan-400" /> Sepolia Smart Contracts</span>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
