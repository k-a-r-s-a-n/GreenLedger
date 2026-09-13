// frontend/app/marketplace/page.tsx
"use client";

/**
 * Marketplace — redeem Green Credits for badges, then mint on Sepolia.
 * Server state: ONE catalog query (balance + items per contract), the
 * purchase mutation (invalidates credits/badges/catalog on success).
 * Wallet connect / network-switch states come from the existing
 * WalletContext (out of scope to modify — only restyled here).
 */
import React, { useState } from "react";
import { Award, Info, Wallet, CheckCircle, Sparkles, Layers } from "lucide-react";
import { Navbar } from "../../components/Navbar";
import { Footer } from "../../components/Footer";
import { BadgeCard } from "../../components/BadgeCard";
import { GlassPanel } from "../../components/GlassPanel";
import { Skeleton } from "../../components/Skeleton";
import { ErrorPanel } from "../../components/ErrorPanel";
import { Button } from "../../components/Button";
import { useMarketplaceCatalog, usePurchaseBadge, useCreditState } from "../../hooks/useCredits";
import { useWallet } from "../../context/WalletContext";
import { CONTRACT_ADDRESS } from "../../lib/web3";
import { cn } from "../../lib/cn";

type Filter = "all" | "unlocked" | "minted";

export default function MarketplacePage() {
  const { wallet, connect, switchNetwork, isConnecting } = useWallet();
  const [filter, setFilter] = useState<Filter>("all");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  // Balance arrives with the catalog payload; credits query backfills
  // rank title and revalidates after purchases via cache invalidation.
  const catalog = useMarketplaceCatalog();
  const creditState = useCreditState();
  const purchase = usePurchaseBadge();

  const badges = catalog.data?.items ?? [];

  // If the catalog fetch itself failed, render nothing (ErrorPanel handles the failure).
  // Fall back to credits balance only when the catalog endpoint is healthy but its
  // item set has not yet arrived.
  const balance = catalog.data ? catalog.data.user_balance : creditState.data?.credit_balance ?? null;

  const handlePurchase = async (badgeId: string) => {
    const res = await purchase.mutateAsync(badgeId);
    setNotice({ ok: res.success, text: res.message });
    // Auto-dismiss after 4s — long enough to read, short enough to feel snappy.
    setTimeout(() => setNotice(null), 4000);
  };

  const filtered = badges.filter((b) => {
    if (filter === "unlocked") return b.is_unlocked;
    if (filter === "minted") return b.minted_on_chain;
    return true;
  });

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All badges", count: badges.length },
    { id: "unlocked", label: "Unlocked", count: badges.filter((b) => b.is_unlocked).length },
    { id: "minted", label: "On-chain", count: badges.filter((b) => b.minted_on_chain).length },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-7">
        {/* Header + balance */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl tracking-display text-white">
              Badge marketplace
            </h1>
            <p className="text-xs font-mono text-white/40 mt-1.5">
              Redeem Green Credits for verifiable ERC-1155 credentials on Sepolia.
            </p>
          </div>

          <GlassPanel intensity="accent" className="p-4 flex items-center gap-5 shrink-0">
            <span aria-hidden className="glass-sheen absolute inset-0" />
            <div className="relative flex items-center gap-2.5">
              <Award className="w-5 h-5 text-emerald-400" aria-hidden />
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-white/40 block">
                  Balance
                </span>
                {balance === null ? (
                  <Skeleton className="h-6 w-16 mt-0.5" />
                ) : (
                  <span className="text-xl font-semibold font-mono text-emerald-300">
                    {balance} GC
                  </span>
                )}
              </div>
            </div>
            <div className="relative h-9 w-px bg-white/10" />
            <div className="relative">
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/40 block">
                Rank
              </span>
              <span className="text-sm font-mono font-medium text-white/85">
                {creditState.data?.rank_title ?? "—"}
              </span>
            </div>
          </GlassPanel>
        </div>

        {/* Catalog failure — explicit, with retry */}
        {catalog.isError && (
          <ErrorPanel
            title="Marketplace unavailable"
            message={
              catalog.error instanceof Error
                ? catalog.error.message
                : "The backend did not return the badge catalog."
            }
            onRetry={() => void catalog.refetch()}
          />
        )}

        {/* Web3 network strip: contract info + wallet states */}
        <GlassPanel className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-white/50 shrink-0 mt-0.5" aria-hidden />
            <div className="text-xs">
              <span className="font-medium text-white">Ethereum Sepolia testnet</span>
              <p className="text-white/45 text-[11px] leading-relaxed mt-0.5 font-mono">
                Contract:{" "}
                {CONTRACT_ADDRESS ? (
                  CONTRACT_ADDRESS
                ) : (
                  <span className="text-amber-300">
                    not configured — minting unavailable until NEXT_PUBLIC_CONTRACT_ADDRESS is set
                  </span>
                )}
                . Testnet assets carry zero financial risk.
              </p>
            </div>
          </div>
          <div className="shrink-0">
            {!wallet.isConnected ? (
              <Button size="sm" onClick={() => connect()} loading={isConnecting}>
                <Wallet className="w-3.5 h-3.5" aria-hidden />
                Connect MetaMask
              </Button>
            ) : !wallet.isSepolia ? (
              <Button size="sm" variant="secondary" onClick={() => switchNetwork()} className="border-amber-500/50 text-amber-300">
                Switch to Sepolia
              </Button>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-500/10 text-emerald-300 text-xs font-mono px-3 py-1.5">
                <CheckCircle className="w-3.5 h-3.5" aria-hidden />
                {wallet.address?.slice(0, 6)}…{wallet.address?.slice(-4)}
              </span>
            )}
          </div>
        </GlassPanel>

        {/* Purchase notice (success or 400 detail, e.g. insufficient credits) */}
        {notice && (
          <div
            role="status"
            className={cn(
              "p-3.5 rounded-xl border text-xs font-mono flex items-center gap-2",
              notice.ok
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                : "border-amber-500/50 bg-amber-500/10 text-amber-300"
            )}
          >
            {notice.ok ? <Sparkles className="w-4 h-4" aria-hidden /> : <Info className="w-4 h-4" aria-hidden />}
            {notice.text}
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-3 text-xs font-mono">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg transition-colors",
                filter === f.id
                  ? "bg-white/10 text-white border border-white/15"
                  : "text-white/45 hover:text-white hover:bg-white/5"
              )}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>

        {/* Badge grid — skeletons while loading, empty state when filtered out */}
        {catalog.isPending ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-80 rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <GlassPanel className="p-8 text-center text-sm text-white/50">
            No badges match this filter yet — complete optimizations to unlock
            achievements.
          </GlassPanel>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
            {filtered.map((badge) => (
              <BadgeCard
                key={badge.id}
                badge={badge}
                userCredits={balance ?? 0}
                userWallet={wallet.address}
                onPurchase={handlePurchase}
                onMintSuccess={() => {
                  // Revalidation handled inside purchase mutation; a fresh
                  // catalog fetch also picks up new mint ledger entries.
                  void catalog.refetch();
                  void creditState.refetch();
                }}
                onConnect={() => connect()}
              />
            ))}
          </div>
        )}

        {/* Rationale card */}
        <GlassPanel className="p-6 space-y-2.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white tracking-tight-2">
            <Layers className="w-4 h-4 text-emerald-400" aria-hidden />
            Why put carbon milestones on-chain?
          </div>
          <p className="text-xs text-white/50 leading-relaxed max-w-4xl">
            Telemetry and ML inference stay 100% off-chain for privacy and
            speed. Sepolia is used solely for verifiable badge ownership —
            portable credentials that no app update can wipe.
          </p>
        </GlassPanel>
      </main>

      <Footer />
    </div>
  );
}
