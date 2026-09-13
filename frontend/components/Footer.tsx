// frontend/components/Footer.tsx
"use client";

import React from "react";
import Link from "next/link";
import { ShieldCheck, Info, ExternalLink } from "lucide-react";

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-white/10 mt-16 py-12 text-xs text-white/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Measurement honesty banner — adapted to a glass accent panel */}
        <div className="p-5 rounded-2xl liquid-glass liquid-glass-accent relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <span aria-hidden className="glass-sheen absolute inset-0" />
          <div className="flex items-start gap-3 relative">
            <Info className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" aria-hidden />
            <div>
              <h4 className="font-semibold text-white">Measurement honesty</h4>
              <p className="text-white/55 text-[11px] leading-relaxed mt-0.5 max-w-3xl">
                Wattage is an <strong className="text-white/80">estimated</strong> value from a
                calibrated XGBoost model — Windows laptops expose no whole-system watt sensor.
                A physical reading is shown only when the OEM power meter counter is available.
              </p>
            </div>
          </div>
          <div className="shrink-0 relative flex items-center gap-2 text-[11px] font-mono text-emerald-300 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/30">
            <ShieldCheck className="w-4 h-4" aria-hidden />
            <span>Auditable off-chain &amp; on-chain</span>
          </div>
        </div>

        {/* Link grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <h5 className="font-semibold text-white/80 mb-3">Platform</h5>
            <ul className="space-y-2 text-[12px]">
              <li><Link href="/dashboard" className="hover:text-emerald-300 transition-colors">Telemetry monitor</Link></li>
              <li><Link href="/optimize" className="hover:text-emerald-300 transition-colors">Optimization engine</Link></li>
              <li><Link href="/marketplace" className="hover:text-emerald-300 transition-colors">Badge marketplace</Link></li>
              <li><Link href="/profile" className="hover:text-emerald-300 transition-colors">Profile &amp; history</Link></li>
            </ul>
          </div>

          <div>
            <h5 className="font-semibold text-white/80 mb-3">Safety &amp; privacy</h5>
            <ul className="space-y-2 text-[12px]">
              <li><Link href="/diagnostics" className="hover:text-emerald-300 transition-colors">ML diagnostics</Link></li>
              <li><Link href="/privacy" className="hover:text-emerald-300 transition-colors">Data privacy</Link></li>
              <li><Link href="/impact" className="hover:text-emerald-300 transition-colors">Carbon impact</Link></li>
              <li><span className="text-white/30">Reversible actions only</span></li>
            </ul>
          </div>

          <div>
            <h5 className="font-semibold text-white/80 mb-3">Web3</h5>
            <ul className="space-y-2 text-[12px]">
              <li className="flex items-center gap-1.5">
                <span className="text-emerald-300 font-mono">Ethereum Sepolia</span>
                <a
                  href="https://sepolia.etherscan.io"
                  target="_blank"
                  rel="noreferrer"
                  className="text-white/35 hover:text-white/60 transition-colors"
                  aria-label="Open Sepolia Etherscan"
                >
                  <ExternalLink className="w-3 h-3" aria-hidden />
                </a>
              </li>
              <li><span className="text-white/35 font-mono">Chain ID 11155111</span></li>
              <li><span className="text-white/35 font-mono">ERC-1155 badges</span></li>
              <li><span className="text-white/35">Zero financial risk</span></li>
            </ul>
          </div>

          <div>
            <h5 className="font-semibold text-white/80 mb-3">Compatibility</h5>
            <p className="text-[11px] text-white/45 leading-relaxed">
              Native Windows 11 telemetry agent with labelled demo fallback for
              non-Windows evaluators — demo data is always badged, never blended
              with real measurements.
            </p>
          </div>
        </div>

        <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px]">
          <p>© 2026 GreenLedger. Open source, MIT.</p>
          <span className="flex items-center gap-1.5 text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot" aria-hidden />
            All systems operational
          </span>
        </div>
      </div>
    </footer>
  );
};
