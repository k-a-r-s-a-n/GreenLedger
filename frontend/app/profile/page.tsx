"use client";

import React, { useState, useEffect } from "react";
import { 
  User, 
  Award, 
  Flame, 
  Wallet, 
  ExternalLink, 
  Calendar
} from "lucide-react";
import { Navbar } from "../../components/Navbar";
import { Footer } from "../../components/Footer";
import { fetchCreditState, fetchBadges } from "../../lib/api";
import { UserCreditState, BadgeItem } from "../../types";
import { useWallet } from "../../context/WalletContext";

export default function ProfilePage() {
  const [userState, setUserState] = useState<UserCreditState | null>(null);
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const { wallet, connect, isConnecting } = useWallet();
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    fetchCreditState().then(setUserState).catch(() => setLoadError(true));
    fetchBadges().then(setBadges).catch(() => setLoadError(true));
  }, []);

  const unlockedBadges = badges.filter((b) => b.is_unlocked);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {loadError && <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-xs font-mono text-amber-200">Account data unavailable. Values are intentionally not estimated.</div>}
        
        {/* Futuristic Identity Card */}
        <div className="p-8 rounded-3xl bg-gradient-to-br from-surface-card via-surface-card to-emerald-950/20 border border-emerald-500/40 relative overflow-hidden shadow-2xl">
          
          <div className="absolute top-0 right-0 w-80 h-80 bg-cyber-emerald/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            
            {/* User Avatar & Rank */}
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyber-emerald to-cyber-cyan p-0.5 shadow-glow-green">
                <div className="w-full h-full bg-background rounded-[15px] flex items-center justify-center">
                  <User className="w-10 h-10 text-cyber-neon" />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-black text-white tracking-tight">
                    GreenLedger User
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950/80 border border-emerald-500/50 text-emerald-300">
                    Local account
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs font-mono">
                  <span className="text-cyber-neon font-bold">
                    Rank: {userState?.rank_title || "Eco Explorer"}
                  </span>
                  <span className="text-gray-400">•</span>
                  <span className="text-amber-400 font-bold flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5" />
                    {userState?.current_streak_days ?? "Unavailable"}-Day Streak
                  </span>
                </div>
              </div>
            </div>

            {/* Wallet Status Box */}
            <div className="p-4 rounded-xl bg-surface/80 border border-surface-border text-xs font-mono">
              <span className="text-gray-400 block text-[10px]">Connected Web3 Wallet</span>
              {wallet.isConnected ? (
                <div className="mt-1 flex items-center gap-2 text-white font-semibold">
                  <Wallet className="w-4 h-4 text-emerald-400" />
                  <span>{wallet.address?.slice(0, 8)}...{wallet.address?.slice(-6)}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded ${
                    wallet.isSepolia 
                      ? "text-emerald-400 bg-emerald-950/60 border border-emerald-700/50" 
                      : "text-amber-400 bg-amber-950/60 border border-amber-700/50"
                  }`}>
                    {wallet.isSepolia ? "Sepolia" : `Chain ${wallet.chainId || "Unknown"}`}
                  </span>
                </div>
              ) : (
                <button
                  onClick={() => connect()}
                  disabled={isConnecting}
                  className="mt-1 text-cyber-cyan hover:underline flex items-center gap-1 disabled:opacity-60"
                >
                  <span>{isConnecting ? "Connecting..." : "Connect MetaMask"}</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>

          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-surface-border font-mono">
            <div>
              <span className="text-gray-400 text-[11px] block">Green Credits</span>
              <span className="text-2xl font-bold text-cyber-neon">
                {userState?.credit_balance ?? "Unavailable"} GC
              </span>
            </div>
            <div>
              <span className="text-gray-400 text-[11px] block">Total Optimizations</span>
              <span className="text-2xl font-bold text-white">
                {userState?.total_optimizations ?? "Unavailable"} Actions
              </span>
            </div>
            <div>
              <span className="text-gray-400 text-[11px] block">CO₂ Prevented</span>
              <span className="text-2xl font-bold text-cyber-cyan">
                {userState?.lifetime_reduction_g_co2?.toFixed(1) ?? "Unavailable"} g
              </span>
            </div>
            <div>
              <span className="text-gray-400 text-[11px] block">Energy Saved</span>
              <span className="text-2xl font-bold text-emerald-400">
                {userState?.lifetime_energy_saved_kwh?.toFixed(3) ?? "Unavailable"} kWh
              </span>
            </div>
          </div>

        </div>

        {/* Owned Achievement Badges */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            Active Digital Badges ({unlockedBadges.length})
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {unlockedBadges.map((badge) => (
              <div
                key={badge.id}
                className="p-4 rounded-xl bg-surface-card border border-emerald-500/30 flex items-center justify-between"
              >
                <div>
                  <h4 className="text-sm font-bold text-white">{badge.name}</h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">{badge.unlock_criteria}</p>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/40">
                  {badge.minted_on_chain ? "Minted" : "Unlocked"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Optimization Action Audit Trail */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Calendar className="w-5 h-5 text-cyber-neon" />
            Verified Optimization Audit History
          </h3>

          <div className="p-6 rounded-2xl bg-surface-card border border-surface-border overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-surface-border text-gray-400 uppercase tracking-wider text-[10px]">
                  <th className="pb-3">Timestamp</th>
                  <th className="pb-3">Action Description</th>
                  <th className="pb-3">Type</th>
                  <th className="pb-3 text-right">Green Credits</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/50">
                {userState?.recent_transactions && userState.recent_transactions.length > 0 ? (
                  userState.recent_transactions.map((tx) => (
                    <tr key={tx.tx_id} className="hover:bg-surface-elevated/40 transition">
                      <td className="py-3 text-gray-400">
                        {new Date(tx.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 text-white font-semibold">
                        {tx.description}
                      </td>
                      <td className="py-3 text-emerald-400">
                        {tx.type}
                      </td>
                      <td className="py-3 text-right font-bold text-cyber-neon">
                        {tx.credits > 0 ? `+${tx.credits}` : tx.credits} GC
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-gray-500">
                      No optimization transactions recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      <Footer />
    </div>
  );
}
