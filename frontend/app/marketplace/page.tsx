"use client";

import React, { useState, useEffect } from "react";
import { 
  Award, 
  Wallet, 
  CheckCircle, 
  Sparkles, 
  Info,
  Layers
} from "lucide-react";
import { Navbar } from "../../components/Navbar";
import { Footer } from "../../components/Footer";
import { BadgeCard } from "../../components/BadgeCard";
import { fetchBadges, fetchCreditState, purchaseBadge } from "../../lib/api";
import { CONTRACT_ADDRESS } from "../../lib/web3";
import { BadgeItem, UserCreditState } from "../../types";
import { useWallet } from "../../context/WalletContext";

export default function MarketplacePage() {
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [userState, setUserState] = useState<UserCreditState | null>(null);
  const { wallet, connect, switchNetwork, isConnecting } = useWallet();
  const [filter, setFilter] = useState<"all" | "unlocked" | "minted">("all");
  const [purchaseNotice, setPurchaseNotice] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = async () => {
    const [bList, uState] = await Promise.all([
      fetchBadges("default_user"),
      fetchCreditState("default_user")
    ]);
    setBadges(bList);
    setUserState(uState);
    setLoadError(null);
  };

  const loadDataSafely = async () => {
    try {
      await loadData();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Marketplace data unavailable");
    }
  };

  useEffect(() => {
    loadDataSafely();
  }, []);

  const handlePurchase = async (badgeId: string) => {
    const res = await purchaseBadge(badgeId);
    if (res.success) {
      setPurchaseNotice(res.message || "Badge acquired!");
      await loadDataSafely();
    } else {
      setPurchaseNotice(`Error: ${res.error}`);
    }
    setTimeout(() => setPurchaseNotice(null), 4000);
  };

  const filteredBadges = badges.filter((b) => {
    if (filter === "unlocked") return b.is_unlocked;
    if (filter === "minted") return b.minted_on_chain;
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {loadError && <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-xs font-mono text-amber-200">{loadError}. The marketplace is unavailable until the backend responds.</div>}
        
        {/* Marketplace Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Decentralized Achievement Marketplace
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950/80 border border-emerald-500/50 text-emerald-300">
                Sepolia Testnet
              </span>
            </div>
            <p className="text-xs text-gray-400 font-mono mt-1">
              Redeem earned Green Credits for verifiable ERC-1155 achievement credentials.
            </p>
          </div>

          {/* User Credits Balance Banner */}
          <div className="flex items-center gap-4 bg-surface-card p-3 rounded-2xl border border-surface-border">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-950/60 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase text-gray-400 block">
                  Available Balance
                </span>
                <span className="text-lg font-bold font-mono text-cyber-neon">
                  {userState?.credit_balance ?? "Unavailable"} GC
                </span>
              </div>
            </div>

            <div className="h-8 w-px bg-surface-border" />

            <div>
              <span className="text-[10px] font-mono uppercase text-gray-400 block">
                Rank Title
              </span>
              <span className="text-xs font-mono font-semibold text-emerald-300">
                {userState?.rank_title || "Eco Explorer"}
              </span>
            </div>
          </div>
        </div>

        {/* Web3 Network Notice */}
        <div className="p-4 rounded-xl bg-surface-card border border-surface-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-cyber-cyan shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-semibold text-white">Ethereum Sepolia Testnet Integration</span>
              <p className="text-gray-400 text-[11px] leading-relaxed mt-0.5">
                Smart Contract: <code className="text-emerald-400">{CONTRACT_ADDRESS || "Unavailable: contract address not configured"}</code>. Badges are standard ERC-1155 tokens. Testnet assets carry zero financial risk.
              </p>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            {!wallet.isConnected ? (
              <button
                onClick={() => connect()}
                disabled={isConnecting}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-mono text-xs font-semibold shadow-glow-green flex items-center gap-1.5 transition disabled:opacity-60"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>{isConnecting ? "Connecting..." : "Connect MetaMask"}</span>
              </button>
            ) : !wallet.isSepolia ? (
              <button
                onClick={() => switchNetwork()}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-mono text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <span>Switch to Sepolia</span>
              </button>
            ) : (
              <div className="px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-cyber-neon text-xs font-mono flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Sepolia Connected ({wallet.address?.slice(0, 6)}...{wallet.address?.slice(-4)})</span>
              </div>
            )}
          </div>
        </div>

        {/* Purchase Notification Banner */}
        {purchaseNotice && (
          <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/60 text-xs font-mono text-cyber-neon flex items-center gap-2 animate-in fade-in duration-200">
            <Sparkles className="w-4 h-4" />
            <span>{purchaseNotice}</span>
          </div>
        )}

        {/* Category Filters */}
        <div className="flex items-center gap-2 border-b border-surface-border pb-3 text-xs font-mono">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg transition ${filter === "all" ? "bg-surface-elevated text-cyber-neon font-bold border border-emerald-500/40" : "text-gray-400 hover:text-white"}`}
          >
            All Badges ({badges.length})
          </button>
          <button
            onClick={() => setFilter("unlocked")}
            className={`px-3 py-1.5 rounded-lg transition ${filter === "unlocked" ? "bg-surface-elevated text-cyber-neon font-bold border border-emerald-500/40" : "text-gray-400 hover:text-white"}`}
          >
            Unlocked ({badges.filter((b) => b.is_unlocked).length})
          </button>
          <button
            onClick={() => setFilter("minted")}
            className={`px-3 py-1.5 rounded-lg transition ${filter === "minted" ? "bg-surface-elevated text-cyber-neon font-bold border border-emerald-500/40" : "text-gray-400 hover:text-white"}`}
          >
            On-Chain ({badges.filter((b) => b.minted_on_chain).length})
          </button>
        </div>

        {/* Badge Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {filteredBadges.map((badge) => (
            <BadgeCard
              key={badge.id}
              badge={badge}
              userCredits={userState?.credit_balance || 0}
              userWallet={wallet.address}
              onPurchase={handlePurchase}
              onMintSuccess={loadDataSafely}
              onConnect={connect}
            />
          ))}
        </div>

        {/* Web3 Philosophy Card */}
        <div className="p-6 rounded-2xl bg-surface-card border border-surface-border space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-white font-mono">
            <Layers className="w-4 h-4 text-cyber-neon" />
            Why Put Carbon Milestones on Blockchain?
          </div>
          <p className="text-xs text-gray-400 leading-relaxed max-w-4xl">
            Real-time telemetry and XGBoost inference stay 100% off-chain for privacy and microsecond speed. The Ethereum Sepolia blockchain is leveraged solely for <strong>verifiable badge ownership and portable achievement provenance</strong>. Your credentials can never be wiped by an app update and remain exportable across the decentralized web.
          </p>
        </div>

      </main>

      <Footer />
    </div>
  );
}
