// frontend/components/BadgeCard.tsx
"use client";

import React, { useState } from "react";
import { 
  CheckCircle, 
  Lock, 
  ExternalLink, 
  Wallet,
  Loader2
} from "lucide-react";
import { BadgeItem } from "../types";
import { mintBadgeOnChain, checkBadgeMintedOnChain, SEPOLIA_EXPLORER_URL } from "../lib/web3";
import { verifyMintOnBackend } from "../lib/api";
import { BadgeViewer3D } from "./BadgeViewer3D";

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
  const [isAlreadyMinted, setIsAlreadyMinted] = useState(Boolean(badge.minted_on_chain || badge.tx_hash));

  // Sync with badge prop updates
  React.useEffect(() => {
    if (badge.minted_on_chain || badge.tx_hash) {
      setIsAlreadyMinted(true);
      if (badge.tx_hash) setTxHash(badge.tx_hash);
    }
  }, [badge.minted_on_chain, badge.tx_hash]);

  // Check on-chain contract state if wallet is connected
  React.useEffect(() => {
    let isMounted = true;
    if (badge.token_id && userWallet && !isAlreadyMinted) {
      checkBadgeMintedOnChain(badge.token_id, userWallet).then((minted) => {
        if (isMounted && minted) {
          setIsAlreadyMinted(true);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [badge.token_id, userWallet, isAlreadyMinted]);

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
      setIsAlreadyMinted(true);
      setMintStatus("Confirming on-chain verification...");

      // Record verification on backend
      const verification = await verifyMintOnBackend(badge.id, res.txHash, badge.token_id, userWallet);
      if (verification?.verified) {
        setMintStatus("Minted and verified on Sepolia.");
        onMintSuccess?.();
      } else {
        setMintStatus("Transaction confirmed on Sepolia.");
        onMintSuccess?.();
      }
    } else {
      const errMsg = res.error || "Minting failed";
      if (errMsg.toLowerCase().includes("already minted")) {
        setIsAlreadyMinted(true);
        setMintStatus("Badge already minted to this account");
      } else {
        setMintStatus(errMsg);
      }
    }
    setIsMinting(false);
  };

  const handleBuy = async () => {
    setIsPurchasing(true);
    await onPurchase(badge.id);
    setIsPurchasing(false);
  };

  const canAfford = userCredits >= badge.credit_price;
  const isMinted = Boolean(isAlreadyMinted || txHash || badge.minted_on_chain);

  return (
    <div className={`p-5 rounded-2xl liquid-glass border transition-all duration-300 flex flex-col justify-between relative overflow-hidden group ${
      badge.is_unlocked ? "border-emerald-500/30 hover:border-emerald-500/60 shadow-glow-green/10" : "border-white/10 opacity-80"
    }`}>
      <span aria-hidden className="glass-sheen absolute inset-0" />
      
      {/* Top Banner: Rarity & Token ID */}
      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border ${getRarityBadge()}`}>
            {badge.rarity}
          </span>
          <span className="text-[10px] font-mono text-white/45">
            Token #{badge.token_id}
          </span>
        </div>

        {/* 3D Interactive WebGL Holographic Badge Crystal */}
        <div className="my-3 flex items-center justify-center relative">
          <BadgeViewer3D
            rarity={badge.rarity}
            isUnlocked={badge.is_unlocked}
            isMinted={isMinted}
            size={128}
          />
          {!badge.is_unlocked && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="w-8 h-8 rounded-full bg-black/60 border border-white/20 flex items-center justify-center backdrop-blur-sm">
                <Lock className="w-4 h-4 text-white/50" />
              </span>
            </div>
          )}
        </div>

        {/* Title & Description */}
        <h4 className="text-base font-semibold text-white text-center tracking-tight">
          {badge.name}
        </h4>
        <p className="mt-1 text-xs text-white/55 text-center leading-relaxed">
          {badge.description}
        </p>

        <div className="mt-3 p-2 rounded-xl liquid-glass border border-white/10 text-[11px] font-mono text-white/50">
          <span className="text-white/40">Unlock: </span>
          <span className="text-emerald-300">{badge.unlock_criteria}</span>
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-5 pt-4 border-t border-white/10 space-y-2 relative z-10">
        
        {/* State 1: Locked & Needs Credits */}
        {!badge.is_unlocked && (
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-mono">
              <span className="text-white/40">Price: </span>
              <span className="font-bold text-emerald-300">{badge.credit_price} GC</span>
            </div>
            <button
              onClick={handleBuy}
              disabled={!canAfford || isPurchasing}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition ${
                canAfford
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-glow-green"
                  : "liquid-glass text-white/30 cursor-not-allowed border border-white/10"
              }`}
            >
              {isPurchasing ? "Unlocking..." : canAfford ? "Unlock Badge" : "Need Credits"}
            </button>
          </div>
        )}

        {/* State 2: Unlocked, Can Mint to Sepolia */}
        {badge.is_unlocked && !isMinted && (
          <div>
            {userWallet ? (
              <button
                onClick={handleMint}
                disabled={isMinting}
                className="w-full py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs font-mono font-semibold flex items-center justify-center gap-1.5 shadow-glow-green transition"
              >
                {isMinting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wallet className="w-3.5 h-3.5" />}
                <span>{isMinting ? mintStatus : "Mint on Sepolia"}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onConnect}
                className="w-full py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[11px] font-mono border border-amber-500/30 flex items-center justify-center gap-1.5 transition cursor-pointer"
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
        {isMinted && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-emerald-300 liquid-glass px-2.5 py-2 rounded-xl border border-emerald-500/30">
              <span className="flex items-center gap-1.5 font-semibold">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                Minted to this account
              </span>
              <span className="text-[10px] text-emerald-400/80 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30">ERC-1155</span>
            </div>
            {txHash && (
              <a
                href={`${SEPOLIA_EXPLORER_URL}/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center justify-center gap-1 transition"
              >
                <span>View Transaction on Sepolia</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {mintStatus && mintStatus !== "Badge already minted to this account" && (
              <p className="text-[10px] text-center text-emerald-400 font-mono">
                {mintStatus}
              </p>
            )}
          </div>
        )}

      </div>

    </div>
  );
};
