"use client";

import React from "react";
import { ShieldCheck, Lock, EyeOff, Server, HardDrive, CheckCircle } from "lucide-react";
import { Navbar } from "../../components/Navbar";
import { Footer } from "../../components/Footer";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        
        {/* Privacy Header */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-cyber-neon" />
            <span>Zero Data Extraction Policy</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Data Privacy & Telemetry Guardrails
          </h1>
          <p className="text-sm text-gray-400 font-mono">
            How GreenLedger safeguards your privacy and local device integrity.
          </p>
        </div>

        {/* 4 Privacy Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          
          <div className="p-5 rounded-2xl bg-surface-card border border-surface-border space-y-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-cyber-neon flex items-center justify-center">
              <HardDrive className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Local-First Architecture</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Your hardware telemetry is sampled locally on <code>http://127.0.0.1:8765</code> and does not leave your personal machine unless requested for model inference.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-surface-card border border-surface-border space-y-2">
            <div className="w-9 h-9 rounded-xl bg-cyber-cyan/20 border border-cyber-cyan/40 text-cyber-cyan flex items-center justify-center">
              <EyeOff className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Never Reads User Content</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              We never inspect file contents, keystrokes, personal documents, browser history, URLs, or clipboard data. Only anonymous numeric hardware performance counters are measured.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-surface-card border border-surface-border space-y-2">
            <div className="w-9 h-9 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-400 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Non-Custodial Web3</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              We never ask for or store private keys or seed phrases. All Sepolia testnet transactions are signed directly in your MetaMask wallet extension.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-surface-card border border-surface-border space-y-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Process Whitelist Guardrails</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Strict blacklists prevent any modification or termination of Windows system services (such as <code>explorer.exe</code> or Windows Defender).
            </p>
          </div>

        </div>

        {/* Explicit Prohibitions Checklist */}
        <div className="p-6 rounded-2xl bg-surface-card border border-surface-border space-y-4">
          <h3 className="text-base font-bold text-white font-mono">
            Explicit System Boundary Guarantees:
          </h3>
          <ul className="space-y-2.5 text-xs text-gray-300 font-mono">
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-cyber-neon shrink-0" />
              <span>Zero access to user documents, photos, or files.</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-cyber-neon shrink-0" />
              <span>Zero keylogger or input monitoring hooks.</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-cyber-neon shrink-0" />
              <span>Zero telemetry uploaded to third-party ad trackers.</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-cyber-neon shrink-0" />
              <span>Zero permanent changes to Windows registry.</span>
            </li>
          </ul>
        </div>

      </main>

      <Footer />
    </div>
  );
}
