"use client";

import React, { useState } from "react";
import { 
  Leaf, 
  Zap, 
  Globe, 
  Flame, 
  Trophy, 
  CheckCircle, 
  Lock, 
  ExternalLink, 
  Wallet,
  Sparkles,
  Loader2
} from "lucide-react";
import { BadgeItem } from "../types";
import { mintBadgeOnChain, SEPOLIA_EXPLORER_URL } from "../lib/web3";
import { verifyMintOnBackend } from "../lib/api";

interface BadgeCardProps {
  badge: BadgeItem;
  userCredits: number;
  userWallet: string | null;
  onPurchase: (badgeId: string) => Promise<void>;
  onMintSuccess?: () => void;
  onConnect?: () => void;
}

export const BadgeCard: React.FC<BadgeCardProps> = ({
  badge,
  userCredits,
  userWallet,
  onPurchase,
  onMintSuccess,
  onConnect
}) => {
  const [mintStatus, setMintStatus] = useState<string | null>(null);
  const [isMinting, setIsMinting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(badge.tx_hash || null);
  const [isPurchasing, setIsPurchasing] = useState(false);

  // Icon mapping
  const renderIcon = () => {
    switch (badge.id) {
      case "badge_first_opt":
        return <Leaf className="w-8 h-8 text-emerald-400" />;
      case "badge_power_saver":
        return <Zap className="w-8 h-8 text-amber-400" />;
      case "badge_carbon_cutter":
        return <Globe className="w-8 h-8 text-cyber-cyan" />;
      case "badge_efficiency_master":
        return <Flame className="w-8 h-8 text-rose-400" />;
      case "badge_green_guardian":
        return <Trophy className="w-8 h-8 text-yellow-300" />;
      default:
        return <Sparkles className="w-8 h-8 text-emerald-400" />;
    }
  };

  const getRarityBadge = () => {
    switch (badge.rarity) {
      case "Legendary":
        return "border-yellow-500/50 bg-yellow-950/40 text-yellow-300 shadow-glow-gold";
      case "Epic":
        return "border-purple-500/50 bg-purple-950/40 text-purple-300";
      case "Rare":
        return "border-cyan-500/50 bg-cyan-950/40 text-cyan-300";
      default:
        return "border-emerald-500/50 bg-emerald-950/40 text-emerald-300";
    }
  };

  const handleMint = async () => {
    if (!badge.token_id || !userWallet) return;
    setIsMinting(true);
    setMintStatus("Initiating transaction...");

    const res = await mintBadgeOnChain(badge.token_id, (status) => {
      setMintStatus(status);
    });

    if (res.success && res.txHash) {
      setTxHash(res.txHash);
      // Record verification on backend
      const verification = await verifyMintOnBackend(badge.id, res.txHash, badge.token_id, userWallet);
      if (verification.verified) {
        setMintStatus("Minted and verified on Sepolia.");
        onMintSuccess?.();
      } else {
        setMintStatus("Receipt was not verified by the backend.");
        setTxHash(null);
      }
    } else {
      setMintStatus(res.error || "Minting failed");
    }
    setIsMinting(false);
  };

  const handleBuy = async () => {
    setIsPurchasing(true);
    await onPurchase(badge.id);
    setIsPurchasing(false);
  };

  const canAfford = userCredits >= badge.credit_price;

  return (
    <div className={`p-5 rounded-2xl bg-surface-card border transition-all duration-300 flex flex-col justify-between ${
      badge.is_unlocked ? "border-surface-border hover:border-emerald-500/60 shadow-glow-green/10" : "border-surface-border/40 opacity-80"
    }`}>
      
      {/* Top Banner: Rarity & Token ID */}
      <div>
        <div className="flex items-center justify-between">
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border ${getRarityBadge()}`}>
            {badge.rarity}
          </span>
          <span className="text-[10px] font-mono text-gray-400">
            Token #{badge.token_id}
          </span>
        </div>

        {/* 3D-styled Badge Icon Orb */}
        <div className="my-5 flex items-center justify-center">
          <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br from-surface-elevated via-surface to-background border flex items-center justify-center shadow-lg relative group transition-transform duration-300 hover:scale-105 ${
            badge.is_unlocked ? "border-emerald-500/40 shadow-glow-green" : "border-surface-border"
          }`}>
            {renderIcon()}
            {!badge.is_unlocked && (
              <div className="absolute inset-0 bg-background/70 backdrop-blur-[2px] rounded-2xl flex items-center justify-center">
                <Lock className="w-5 h-5 text-gray-400" />
              </div>
            )}
          </div>
        </div>

        {/* Title & Description */}
        <h4 className="text-base font-bold text-white text-center tracking-tight">
          {badge.name}
        </h4>
        <p className="mt-1 text-xs text-gray-400 text-center leading-relaxed">
          {badge.description}
        </p>

        <div className="mt-3 p-2 rounded-lg bg-surface/70 border border-surface-border/60 text-[11px] font-mono text-gray-400">
          <span className="text-gray-400">Unlock: </span>
          <span className="text-emerald-300">{badge.unlock_criteria}</span>
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-5 pt-4 border-t border-surface-border/60 space-y-2">
        
        {/* State 1: Locked & Needs Credits */}
        {!badge.is_unlocked && (
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-mono">
              <span className="text-gray-400">Price: </span>
              <span className="font-bold text-cyber-neon">{badge.credit_price} GC</span>
            </div>
            <button
              onClick={handleBuy}
              disabled={!canAfford || isPurchasing}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition ${
                canAfford
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-glow-green"
                  : "bg-surface-elevated text-gray-500 cursor-not-allowed border border-surface-border"
              }`}
            >
              {isPurchasing ? "Unlocking..." : canAfford ? "Unlock Badge" : "Need Credits"}
            </button>
          </div>
        )}

        {/* State 2: Unlocked, Can Mint to Sepolia */}
        {badge.is_unlocked && !txHash && !badge.minted_on_chain && (
          <div>
            {userWallet ? (
              <button
                onClick={handleMint}
                disabled={isMinting}
                className="w-full py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs font-mono font-semibold flex items-center justify-center gap-1.5 shadow-glow-green transition"
              >
                {isMinting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wallet className="w-3.5 h-3.5" />}
                <span>{isMinting ? mintStatus : "Mint on Sepolia"}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onConnect}
                className="w-full py-2 rounded-lg bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 text-[11px] font-mono border border-amber-800/50 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Connect MetaMask to Mint</span>
              </button>
            )}
            {mintStatus && !txHash && (
              <p className="text-[10px] text-center text-emerald-400 font-mono mt-1.5">
                {mintStatus}
              </p>
            )}
          </div>
        )}

        {/* State 3: Already Minted on Chain */}
        {(txHash || badge.minted_on_chain) && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono text-cyber-neon bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-500/40">
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-cyber-neon" />
                Minted on Sepolia
              </span>
              <span className="text-[10px] text-gray-400">ERC-1155</span>
            </div>
            {txHash && (
              <a
                href={`${SEPOLIA_EXPLORER_URL}/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center justify-center gap-1 transition"
              >
                <span>View Transaction</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

      </div>

    </div>
  );
};
