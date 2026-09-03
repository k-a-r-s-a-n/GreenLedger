"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Leaf, 
  User, 
  Sliders, 
  Activity, 
  Wallet, 
  AlertCircle,
  X,
  Zap, 
  ShoppingBag, 
  Tv
} from "lucide-react";
import { useWallet } from "../context/WalletContext";

interface NavbarProps {
  isLive?: boolean;
  onTogglePresentation?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  isLive = false, 
  onTogglePresentation 
}) => {
  const pathname = usePathname();
  const { wallet, isConnecting, connect, switchNetwork, clearError } = useWallet();

  const handleWalletClick = async () => {
    if (!wallet.isConnected) {
      await connect();
    } else if (!wallet.isSepolia) {
      await switchNetwork();
    }
  };

  const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: Activity },
    { href: "/optimize", label: "Optimize", icon: Zap },
    { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
    { href: "/impact", label: "Carbon Impact", icon: Leaf },
    { href: "/profile", label: "Profile", icon: User },
    { href: "/diagnostics", label: "ML Diagnostics", icon: Sliders },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-background/80 border-b border-surface-border transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyber-emerald to-cyber-cyan flex items-center justify-center p-0.5 shadow-glow-green">
              <div className="w-full h-full bg-background rounded-[7px] flex items-center justify-center">
                <Leaf className="w-5 h-5 text-cyber-neon transition-transform group-hover:scale-110" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-emerald-200 to-cyber-neon bg-clip-text text-transparent">
                GreenLedger
              </span>
              <span className="text-[9px] uppercase tracking-widest text-emerald-400 font-mono -mt-1">
                AI Carbon Protocol
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                    isActive
                      ? "bg-surface-elevated text-cyber-neon border border-cyber-emerald/40 shadow-glow-green"
                      : "text-gray-400 hover:text-white hover:bg-surface-card"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-cyber-neon" : "text-gray-400"}`} />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Action Controls & Web3 Wallet */}
          <div className="flex items-center gap-2.5">
            
            {/* Mode Indicator & Toggle */}
            <div
              title="Telemetry is collected from the local Windows agent"
              className={`px-2.5 py-1 rounded-full text-[11px] font-mono flex items-center gap-1.5 border transition-all ${
                isLive
                  ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-300"
                  : "bg-amber-950/60 border-amber-500/50 text-amber-300 cursor-help"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isLive ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
              {isLive ? "Live Windows Agent" : "Agent Offline"}
            </div>

            {/* Presentation Mode Button */}
            {onTogglePresentation && (
              <button
                onClick={onTogglePresentation}
                title="Enter Judge Presentation Mode (Full Screen Pitch Layout)"
                className="p-1.5 rounded-lg bg-surface-card border border-surface-border text-gray-400 hover:text-white hover:border-cyber-cyan transition-all hidden sm:flex items-center"
              >
                <Tv className="w-4 h-4 text-cyber-cyan" />
              </button>
            )}

            {/* MetaMask Web3 Connector */}
            <button
              onClick={handleWalletClick}
              disabled={isConnecting}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 border transition-all ${
                wallet.isConnected
                  ? wallet.isSepolia
                    ? "bg-emerald-900/40 border-emerald-500/60 text-emerald-200"
                    : "bg-amber-900/40 border-amber-500/60 text-amber-200 hover:bg-amber-800/50"
                  : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-transparent shadow-glow-green"
              }`}
            >
              <Wallet className="w-3.5 h-3.5" />
              {wallet.isConnected ? (
                wallet.isSepolia ? (
                  <span>
                    {wallet.address?.slice(0, 6)}...{wallet.address?.slice(-4)}
                  </span>
                ) : (
                  <span className="text-amber-300">Switch to Sepolia</span>
                )
              ) : isConnecting ? (
                <span>Connecting...</span>
              ) : (
                <span>Connect Wallet</span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Wallet Error Alert Banner */}
      {wallet.error && (
        <div className="bg-amber-950/90 border-b border-amber-500/50 px-4 py-2 text-xs font-mono text-amber-200 flex items-center justify-between z-40 relative animate-in fade-in">
          <div className="flex items-center gap-2 max-w-5xl mx-auto flex-1">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{wallet.error}</span>
          </div>
          <button
            onClick={clearError}
            className="p-1 hover:bg-amber-900/60 rounded text-amber-400"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </>
  );
};
