// frontend/components/Navbar.tsx
"use client";

import React, { useState } from "react";
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
  Menu,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useWallet } from "../context/WalletContext";
import { ModeBadge, type DataSourceMode } from "./ModeBadge";
import { cn } from "../lib/cn";

interface NavbarProps {
  /** Telemetry data mode — surfaced as the Demo/Live badge (UX requirement). */
  dataSourceMode?: DataSourceMode;
}

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: Activity },
  { href: "/optimize", label: "Optimize", icon: Zap },
  { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/diagnostics", label: "Diagnostics", icon: Sliders },
];

export const Navbar: React.FC<NavbarProps> = ({ dataSourceMode }) => {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close mobile menu when clicking outside (on the backdrop)
  const handleBackdropClick = () => setMenuOpen(false);
  
  // Close on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && menuOpen) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);
  const { wallet, isConnecting, connect, switchNetwork, clearError } = useWallet();

  const handleWalletClick = async () => {
    if (!wallet.isConnected) {
      await connect();
    } else if (!wallet.isSepolia) {
      await switchNetwork();
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full liquid-glass-strong border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <span className="w-8 h-8 rounded-lg liquid-glass flex items-center justify-center border-emerald-500/30">
              <Leaf className="w-5 h-5 text-emerald-400 transition-transform group-hover:scale-110" aria-hidden />
            </span>
            <span className="font-display text-xl tracking-display text-white">
              GreenLedger
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Primary">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[13px] font-medium tracking-tight-2 transition-colors flex items-center gap-1.5",
                    isActive
                      ? "bg-white/10 text-white border border-white/15"
                      : "text-white/55 hover:text-white hover:bg-white/5"
                  )}
                >
                  <Icon className={cn("w-3.5 h-3.5", isActive && "text-emerald-400")} aria-hidden />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Right cluster */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Demo/Live indication on every data-bearing screen (nav is global). */}
            {dataSourceMode && <ModeBadge mode={dataSourceMode} className="hidden sm:inline-flex" />}

            {/* Wallet button — connect → network check → address states */}
            <button
              onClick={handleWalletClick}
              disabled={isConnecting}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 border transition-colors",
                wallet.isConnected
                  ? wallet.isSepolia
                    ? "border-emerald-500/50 text-emerald-300 bg-emerald-500/10"
                    : "border-amber-500/50 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white border-transparent shadow-glow-green"
              )}
            >
              <Wallet className="w-3.5 h-3.5" aria-hidden />
              {wallet.isConnected ? (
                wallet.isSepolia ? (
                  <span>
                    {wallet.address?.slice(0, 6)}…{wallet.address?.slice(-4)}
                  </span>
                ) : (
                  <span>Switch to Sepolia</span>
                )
              ) : isConnecting ? (
                <span>Connecting…</span>
              ) : (
                <span>Connect</span>
              )}
            </button>

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown — glass sheet with staggered link entrance */}
        <AnimatePresence>
          {menuOpen && (
            <>
              {/* Backdrop to capture outside clicks */}
              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={handleBackdropClick}
                className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                aria-hidden="true"
              />
              <motion.nav
                initial={prefersReducedMotion ? false : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="md:hidden liquid-glass-strong border-t border-white/10 px-4 py-3 space-y-1"
                aria-label="Mobile"
              >
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm tracking-tight-2",
                      isActive
                        ? "bg-white/10 text-white"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <Icon className={cn("w-4 h-4", isActive && "text-emerald-400")} aria-hidden />
                    {link.label}
                  </Link>
                );
              })}
              {dataSourceMode && (
                <div className="pt-2 px-3">
                  <ModeBadge mode={dataSourceMode} />
                </div>
              )}
            </motion.nav>
            </>
          )}
        </AnimatePresence>
      </header>

      {/* Wallet error banner */}
      {wallet.error && (
        <div
          role="alert"
          className="sticky top-16 z-40 bg-amber-500/10 border-b border-amber-500/30 backdrop-blur-md px-4 py-2 text-xs font-mono text-amber-200 flex items-center justify-between"
        >
          <div className="flex items-center gap-2 max-w-5xl mx-auto flex-1">
            <AlertCircle className="w-4 h-4 text-amber-300 shrink-0" aria-hidden />
            <span>{wallet.error}</span>
          </div>
          <button
            onClick={clearError}
            className="p-1 hover:bg-amber-500/20 rounded text-amber-300"
            title="Dismiss"
            aria-label="Dismiss wallet error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </>
  );
};
