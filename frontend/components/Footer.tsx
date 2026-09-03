"use client";

import React from "react";
import Link from "next/link";
import { ShieldCheck, Info, Cpu, Globe, ExternalLink } from "lucide-react";

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-surface-border bg-surface/60 backdrop-blur-md mt-16 py-10 text-xs text-gray-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Transparency Banner */}
        <div className="p-4 rounded-xl bg-surface-card border border-surface-border/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-gray-200">Technical Honesty & Hardware Disclosure</h4>
              <p className="text-gray-400 text-[11px] leading-relaxed mt-0.5">
                Power wattage displayed is an <strong>Estimated Power</strong> metric inferred via a calibrated XGBoost regression model trained on standard IT performance resource metrics. Windows laptops do not directly expose whole-system watt sensors. Measured physical power is sourced only from supported Windows Power Meter performance counters when hardware OEM exposes it.
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2 text-[11px] font-mono text-emerald-400 bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-800/40">
            <ShieldCheck className="w-4 h-4" />
            <span>Auditable Off-Chain & On-Chain</span>
          </div>
        </div>

        {/* Links Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <h5 className="font-semibold text-gray-300 mb-3">Platform</h5>
            <ul className="space-y-2 text-[12px]">
              <li><Link href="/dashboard" className="hover:text-emerald-300 transition">Telemetry Monitor</Link></li>
              <li><Link href="/optimize" className="hover:text-emerald-300 transition">AI Optimization Engine</Link></li>
              <li><Link href="/marketplace" className="hover:text-emerald-300 transition">Web3 Badge Marketplace</Link></li>
              <li><Link href="/impact" className="hover:text-emerald-300 transition">Carbon Tracking</Link></li>
            </ul>
          </div>

          <div>
            <h5 className="font-semibold text-gray-300 mb-3">Auditing & Safety</h5>
            <ul className="space-y-2 text-[12px]">
              <li><Link href="/diagnostics" className="hover:text-emerald-300 transition">ML Model Diagnostics</Link></li>
              <li><Link href="/privacy" className="hover:text-emerald-300 transition">Data Privacy & Boundaries</Link></li>
              <li><span className="text-gray-500">Safe Process Whitelist</span></li>
              <li><span className="text-gray-500">Reversible System Plans</span></li>
            </ul>
          </div>

          <div>
            <h5 className="font-semibold text-gray-300 mb-3">Web3 & Decentralization</h5>
            <ul className="space-y-2 text-[12px]">
              <li><span className="text-emerald-400 font-mono">Ethereum Sepolia Testnet</span></li>
              <li><span className="text-gray-500 text-[11px]">Chain ID: 11155111</span></li>
              <li><span className="text-gray-500 text-[11px]">ERC-1155 Multi-Token Badges</span></li>
              <li><span className="text-gray-500 text-[11px]">Zero Real Financial Risk</span></li>
            </ul>
          </div>

          <div>
            <h5 className="font-semibold text-gray-300 mb-3">Hardware Compatibility</h5>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Engineered natively for <strong>Windows 11</strong>, Intel Core Ultra, and Intel Arc graphics architectures with fallback simulation for non-Windows evaluators.
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-surface-border flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px]">
          <p>© 2026 GreenLedger Protocol. Built for Hackathon Excellence. Open Source MIT License.</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              All Systems Operational
            </span>
          </div>
        </div>

      </div>
    </footer>
  );
};
