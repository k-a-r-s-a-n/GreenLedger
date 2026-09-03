"use client";

import React from "react";
import Link from "next/link";
import { 
  Zap, 
  Leaf, 
  Cpu, 
  ShieldCheck, 
  TrendingDown, 
  ShoppingBag, 
  Award, 
  ArrowRight, 
  CheckCircle,
  ExternalLink,
  Layers,
  Sparkles
} from "lucide-react";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { EnergyCore3D } from "../components/EnergyCore3D";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background bg-grid-pattern">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-16 pb-24 overflow-hidden">
        
        {/* Ambient background glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyber-emerald/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-[400px] h-[400px] bg-cyber-cyan/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Hero Left Content */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-mono">
                <span className="w-2 h-2 rounded-full bg-cyber-neon animate-pulse" />
                <span>Next-Gen Sustainability Protocol for Windows 11</span>
              </div>

              <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-[1.1]">
                Turn Computing Into{" "}
                <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyber-neon bg-clip-text text-transparent">
                  Cleaner Computing.
                </span>
              </h1>

              <p className="text-lg sm:text-xl font-mono text-emerald-400 font-semibold tracking-wide">
                Monitor. Optimize. Reduce. Earn.
              </p>

              <p className="text-gray-400 text-sm sm:text-base max-w-2xl leading-relaxed">
                GreenLedger connects native Windows hardware telemetry to a physics-calibrated XGBoost machine-learning engine. Predict power consumption, execute safe user-approved optimizations, measure verified carbon drops, and mint achievement badges on Ethereum Sepolia.
              </p>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <Link
                  href="/dashboard"
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyber-emerald hover:from-emerald-500 hover:to-teal-500 text-white font-mono font-bold text-sm shadow-glow-green flex items-center justify-center gap-2 transition group"
                >
                  <span>Launch Dashboard</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>

                <Link
                  href="#how-it-works"
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-surface-card hover:bg-surface-elevated border border-surface-border text-gray-300 hover:text-white font-mono text-sm transition flex items-center justify-center"
                >
                  How It Works
                </Link>
              </div>

              {/* Quick Trust Badges */}
              <div className="pt-6 border-t border-surface-border/60 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-xs text-gray-400 font-mono">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-cyber-neon" />
                  <span>Windows 11 Native</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-cyber-neon" />
                  <span>XGBoost ML (metrics fetched from Diagnostics)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-cyber-neon" />
                  <span>Ethereum Sepolia Testnet</span>
                </div>
              </div>

            </div>

            {/* Hero Right 3D Visualizer */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <div className="w-full max-w-md">
                <EnergyCore3D
                  cpuUtilization={null}
                  gpuUtilization={null}
                  estimatedPower={null}
                  isOptimized={false}
                />
                
                {/* Visual Pipeline Loop Indicator */}
                <div className="mt-4 p-3 rounded-xl bg-surface-card/90 border border-surface-border text-[11px] font-mono text-gray-400 flex items-center justify-between">
                  <span className="text-cyber-neon">Live Loop:</span>
                  <span>Sensors → ML Preprocessing → XGBoost → Reduction</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* Problem & Solution Section */}
      <section className="py-20 border-y border-surface-border bg-surface/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-mono uppercase tracking-widest text-emerald-400">The Problem</span>
            <h2 className="text-3xl font-extrabold text-white tracking-tight mt-2">
              Laptops Waste Gigawatt-Hours In Silence.
            </h2>
            <p className="text-gray-400 text-sm mt-3 leading-relaxed">
              Every day, hundreds of millions of personal computers run bloated background indexers, dormant browser processes, and inefficient power profiles. Because users cannot see power consumption in Watts, efficiency opportunities vanish unmeasured.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            <div className="p-6 rounded-2xl bg-surface-card border border-surface-border space-y-3">
              <div className="w-10 h-10 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-400 flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Invisible Power Waste</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Operating systems lack native, universal Watt meters. Users have no intuition for whether an idle application is burning 10 Watts or 45 Watts.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-surface-card border border-surface-border space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-400 flex items-center justify-center">
                <TrendingDown className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Zero Carbon Accountability</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Electricity grid emission factors differ globally. Without localized translation from Watts to grams of CO₂e, individual carbon footprints remain opaque.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-surface-card border border-surface-border space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
                <Award className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">No Incentives to Optimize</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Efficiency requires user effort. Without tangible, verifiable rewards and gamification, sustainable compute habits fail to form.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* How It Works Pipeline */}
      <section id="how-it-works" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-mono uppercase tracking-widest text-cyber-cyan">Architecture</span>
            <h2 className="text-3xl font-extrabold text-white tracking-tight mt-2">
              The End-to-End Optimization Loop
            </h2>
            <p className="text-gray-400 text-sm mt-3">
              From raw Windows hardware counters to Web3 Sepolia credentials in 6 transparent steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Step 1 */}
            <div className="p-6 rounded-2xl bg-surface-card border border-surface-border relative group hover:border-emerald-500/40 transition">
              <span className="text-xs font-mono text-emerald-400 font-bold">01 / Telemetry</span>
              <h4 className="text-base font-bold text-white mt-1">Windows Agent Collection</h4>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                Native daemon polls CPU, RAM, GPU, Disk I/O, Network, and active tasks on <code>http://127.0.0.1:8765</code>.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-2xl bg-surface-card border border-surface-border relative group hover:border-emerald-500/40 transition">
              <span className="text-xs font-mono text-emerald-400 font-bold">02 / Feature Mapping</span>
              <h4 className="text-base font-bold text-white mt-1">Engineering & Validation</h4>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                Maps hardware metrics into model feature space, computing thermal interaction terms and checking out-of-distribution limits.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-2xl bg-surface-card border border-surface-border relative group hover:border-emerald-500/40 transition">
              <span className="text-xs font-mono text-emerald-400 font-bold">03 / ML Power Inference</span>
              <h4 className="text-base font-bold text-white mt-1">XGBoost Regression</h4>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                Trained XGBoost model predicts estimated system power consumption in Watts with sub-2ms latency.
              </p>
            </div>

            {/* Step 4 */}
            <div className="p-6 rounded-2xl bg-surface-card border border-surface-border relative group hover:border-emerald-500/40 transition">
              <span className="text-xs font-mono text-emerald-400 font-bold">04 / Carbon Engine</span>
              <h4 className="text-base font-bold text-white mt-1">Grams CO₂e Calculation</h4>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                Converts Watts to kWh and computes hourly carbon footprints based on regional electricity grid emission factors.
              </p>
            </div>

            {/* Step 5 */}
            <div className="p-6 rounded-2xl bg-surface-card border border-surface-border relative group hover:border-emerald-500/40 transition">
              <span className="text-xs font-mono text-emerald-400 font-bold">05 / Safe Optimization</span>
              <h4 className="text-base font-bold text-white mt-1">User-Approved Actions</h4>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                Executes reversible power plan tuning or closes heavy user tasks with strict OS protection rules.
              </p>
            </div>

            {/* Step 6 */}
            <div className="p-6 rounded-2xl bg-surface-card border border-surface-border relative group hover:border-emerald-500/40 transition">
              <span className="text-xs font-mono text-emerald-400 font-bold">06 / Web3 Marketplace</span>
              <h4 className="text-base font-bold text-white mt-1">Green Credits & Sepolia</h4>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                Verified reductions award Green Credits, unlocking ERC-1155 achievement badges mintable on Ethereum Sepolia.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-16 bg-gradient-to-r from-emerald-950/40 via-surface-card to-teal-950/40 border-y border-surface-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/40 border border-emerald-500/40 text-emerald-300 text-xs font-mono">
            <Sparkles className="w-3.5 h-3.5 text-cyber-neon" />
            <span>Ready for Instant Evaluation</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Experience the Future of Sustainable Computing
          </h2>

          <p className="text-gray-400 text-sm max-w-xl mx-auto leading-relaxed">
            Run the local Windows agent for native Windows hardware metrics and evaluate the measured ML and carbon pipeline in your browser.
          </p>

          <div className="pt-2 flex items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-mono font-bold text-sm shadow-glow-green transition"
            >
              Open Live Dashboard
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
