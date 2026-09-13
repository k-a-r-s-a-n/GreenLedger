// frontend/app/profile/page.tsx
"use client";

/**
 * Profile — identity, lifetime stats, badge collection, audit trail.
 * Server state: credits query + badges query (both cached, invalidated by
 * purchases/optimizations elsewhere). Wallet states reuse WalletContext:
 *   not connected → connect CTA
 *   wrong network → switch-to-Sepolia CTA
 *   Sepolia       → address chip with explorer link
 */
import React from "react";
import Link from "next/link";
import {
  User,
  Award,
  Flame,
  Wallet,
  ExternalLink,
  Calendar,
  ShoppingBag,
} from "lucide-react";
import { Navbar } from "../../components/Navbar";
import { Footer } from "../../components/Footer";
import { GlassPanel } from "../../components/GlassPanel";
import { StatCard } from "../../components/StatCard";
import { Skeleton } from "../../components/Skeleton";
import { ErrorPanel } from "../../components/ErrorPanel";
import { Button } from "../../components/Button";
import { useCreditState, useBadges } from "../../hooks/useCredits";
import { useWallet } from "../../context/WalletContext";
import { SEPOLIA_EXPLORER_URL } from "../../lib/web3";

export default function ProfilePage() {
  const { wallet, connect, switchNetwork, isConnecting } = useWallet();
  const creditState = useCreditState();
  const badgesQuery = useBadges();

  const state = creditState.data;
  const badges = badgesQuery.data ?? [];
  const unlockedBadges = badges.filter((b) => b.is_unlocked);

  const loading = creditState.isPending || badgesQuery.isPending;

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-7">
        {creditState.isError && (
          <ErrorPanel
            title="Account data unavailable"
            message={
              creditState.error instanceof Error
                ? creditState.error.message
                : "The backend did not return your credit state."
            }
            onRetry={() => void creditState.refetch()}
          />
        )}

        {/* Identity card */}
        <GlassPanel intensity="strong" className="p-8 relative">
          <span aria-hidden className="glass-sheen absolute inset-0" />
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" aria-hidden />

          <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            {/* Avatar + rank */}
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-2xl liquid-glass-strong border border-emerald-500/30 flex items-center justify-center">
                <User className="w-9 h-9 text-emerald-400" aria-hidden />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="font-display text-3xl tracking-display text-white">
                    GreenLedger User
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono border border-white/15 bg-white/5 text-white/60">
                    local account
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-3 text-xs font-mono">
                  <span className="text-emerald-300 font-semibold">
                    {creditState.isPending ? (
                      <Skeleton className="inline-block h-3.5 w-24" />
                    ) : (
                      `Rank: ${state?.rank_title ?? "—"}`
                    )}
                  </span>
                  <span className="text-white/30">•</span>
                  <span className="text-amber-300 font-semibold flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5" aria-hidden />
                    {state ? `${state.current_streak_days}-day streak` : "no streak yet"}
                  </span>
                </div>
              </div>
            </div>

            {/* Wallet states: connect → network check → connected */}
            <div className="p-4 rounded-xl liquid-glass text-xs font-mono min-w-[220px]">
              <span className="text-white/40 block text-[10px] uppercase tracking-widest">
                Connected wallet
              </span>
              {wallet.isConnected ? (
                wallet.isSepolia ? (
                  <a
                    href={`${SEPOLIA_EXPLORER_URL}/address/${wallet.address}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 flex items-center gap-2 text-white hover:text-emerald-300 transition-colors"
                  >
                    <Wallet className="w-4 h-4 text-emerald-400" aria-hidden />
                    <span>
                      {wallet.address?.slice(0, 8)}…{wallet.address?.slice(-6)}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
                      Sepolia
                    </span>
                    <ExternalLink className="w-3 h-3" aria-hidden />
                  </a>
                ) : (
                  <button
                    onClick={() => switchNetwork()}
                    className="mt-1.5 flex items-center gap-2 text-amber-300 hover:text-amber-200 transition-colors"
                  >
                    <Wallet className="w-4 h-4" aria-hidden />
                    <span>
                      {wallet.address?.slice(0, 8)}…{wallet.address?.slice(-6)}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded border border-amber-500/40 bg-amber-500/10">
                      Chain {wallet.chainId ?? "?"} — switch to Sepolia
                    </span>
                  </button>
                )
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => connect()}
                  loading={isConnecting}
                  className="mt-2"
                >
                  <Wallet className="w-3.5 h-3.5" aria-hidden />
                  Connect MetaMask
                </Button>
              )}
            </div>
          </div>

          {/* Lifetime stats — skeleton while loading, never invented */}
          <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-white/10">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))
            ) : (
              <>
                <div>
                  <span className="text-white/40 text-[11px] block font-mono uppercase tracking-widest">
                    Green credits
                  </span>
                  <span className="text-2xl font-semibold font-mono text-emerald-300">
                    {state?.credit_balance ?? "—"}
                  </span>
                </div>
                <div>
                  <span className="text-white/40 text-[11px] block font-mono uppercase tracking-widest">
                    Optimizations
                  </span>
                  <span className="text-2xl font-semibold font-mono text-white">
                    {state?.total_optimizations ?? "—"}
                  </span>
                </div>
                <div>
                  <span className="text-white/40 text-[11px] block font-mono uppercase tracking-widest">
                    CO₂ prevented
                  </span>
                  <span className="text-2xl font-semibold font-mono text-white">
                    {state ? state.lifetime_reduction_g_co2.toFixed(1) : "—"}
                    <span className="text-sm text-white/40"> g</span>
                  </span>
                </div>
                <div>
                  <span className="text-white/40 text-[11px] block font-mono uppercase tracking-widest">
                    Energy saved
                  </span>
                  <span className="text-2xl font-semibold font-mono text-white">
                    {state ? state.lifetime_energy_saved_kwh.toFixed(3) : "—"}
                    <span className="text-sm text-white/40"> kWh</span>
                  </span>
                </div>
              </>
            )}
          </div>
        </GlassPanel>

        {/* Badge collection */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight-2 text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-400" aria-hidden />
              Active badges ({loading ? "…" : unlockedBadges.length})
            </h2>
            <Link
              href="/marketplace"
              className="text-xs font-mono text-emerald-300 hover:text-emerald-200 flex items-center gap-1 transition-colors"
            >
              <ShoppingBag className="w-3.5 h-3.5" aria-hidden />
              Marketplace
            </Link>
          </div>

          {badgesQuery.isPending ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-2xl" />
              ))}
            </div>
          ) : unlockedBadges.length === 0 ? (
            <GlassPanel className="p-6 text-sm text-white/55">
              No badges unlocked yet — complete a verified optimization to earn
              your first one.
            </GlassPanel>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {unlockedBadges.map((badge) => (
                <GlassPanel
                  key={badge.id}
                  className="p-4 flex items-center justify-between gap-3"
                  intensity={badge.minted_on_chain ? "accent" : "default"}
                >
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate">
                      {badge.name}
                    </h3>
                    <p className="text-[11px] text-white/45 mt-0.5 truncate">
                      {badge.unlock_criteria}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border shrink-0 ${
                      badge.minted_on_chain
                        ? "border-emerald-500/50 text-emerald-300 bg-emerald-500/10"
                        : "border-white/15 text-white/55 bg-white/5"
                    }`}
                  >
                    {badge.minted_on_chain ? "Minted" : "Unlocked"}
                  </span>
                </GlassPanel>
              ))}
            </div>
          )}
        </section>

        {/* Audit trail */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight-2 text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-400" aria-hidden />
            Verified optimization history
          </h2>

          <GlassPanel className="p-6 overflow-x-auto">
            {creditState.isPending ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 rounded-lg" />
                ))}
              </div>
            ) : (
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-white/40 uppercase tracking-widest text-[10px]">
                    <th className="pb-3">Timestamp</th>
                    <th className="pb-3">Action</th>
                    <th className="pb-3">Type</th>
                    <th className="pb-3 text-right">Credits</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {state && state.recent_transactions.length > 0 ? (
                    state.recent_transactions.map((tx) => (
                      <tr key={tx.tx_id} className="hover:bg-white/[0.03] transition-colors">
                        <td className="py-3 text-white/40 whitespace-nowrap">
                          {new Date(tx.timestamp).toLocaleString()}
                        </td>
                        <td className="py-3 text-white">{tx.description}</td>
                        <td className="py-3 text-emerald-300">{tx.type}</td>
                        <td className="py-3 text-right font-semibold text-white">
                          {tx.credits > 0 ? `+${tx.credits}` : tx.credits} GC
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-white/35">
                        No verified optimization transactions yet — the ledger
                        fills as you optimize.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </GlassPanel>
        </section>
      </main>

      <Footer />
    </div>
  );
}
