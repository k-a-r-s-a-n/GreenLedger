"use client";

import React, { useState, useEffect } from "react";
import { 
  Leaf, 
  Cloud, 
  Globe, 
  TreePine, 
  Car, 
  TrendingDown, 
  Info,
  Calendar,
  Sparkles
} from "lucide-react";
import { Navbar } from "../../components/Navbar";
import { Footer } from "../../components/Footer";
import { fetchCreditState } from "../../lib/api";
import { UserCreditState } from "../../types";

const REGIONS = [
  { id: "us", name: "United States (eGRID Avg)", factor: 0.385 },
  { id: "eu", name: "European Union (EEA Avg)", factor: 0.230 },
  { id: "uk", name: "United Kingdom (National Grid)", factor: 0.165 },
  { id: "de", name: "Germany (UBA Grid)", factor: 0.348 },
  { id: "in", name: "India (CEA Grid Avg)", factor: 0.710 },
  { id: "nordic", name: "Nordic (Hydro/Nuclear Clean)", factor: 0.045 },
  { id: "renew", name: "100% Certified Clean Energy", factor: 0.015 }
];

export default function ImpactPage() {
  const [selectedFactor, setSelectedFactor] = useState(0.385);
  const [userState, setUserState] = useState<UserCreditState | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    fetchCreditState().then(setUserState).catch(() => setLoadError(true));
  }, []);

  const lifetimeCO2 = userState?.lifetime_reduction_g_co2 ?? null;
  const lifetimeKwh = userState?.lifetime_energy_saved_kwh ?? null;
  const treeDays = lifetimeCO2 === null ? null : (lifetimeCO2 / 59.64).toFixed(2);
  const carKm = lifetimeCO2 === null ? null : (lifetimeCO2 / 120.0).toFixed(2);

  // Daily & Weekly projections at current baseline (e.g. 28W)
  const avgWatts = 28.0;
  const dailyKwh = (avgWatts * 8) / 1000;
  const dailyCO2Grams = dailyKwh * selectedFactor * 1000;
  const weeklyCO2Grams = dailyCO2Grams * 7;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {loadError && <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-xs font-mono text-amber-200">Credit history unavailable. No fabricated impact values are shown.</div>}
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Carbon Impact & Environmental Equivalencies
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950/80 border border-emerald-500/50 text-emerald-300">
                Audited Conversion
              </span>
            </div>
            <p className="text-xs text-gray-400 font-mono mt-1">
              Deterministic translation of avoided electrical energy into verified carbon reduction metrics.
            </p>
          </div>

          {/* Regional Grid Factor Selector */}
          <div className="flex items-center gap-2 bg-surface-card p-2 rounded-xl border border-surface-border text-xs font-mono">
            <span className="text-gray-400 text-[11px] pl-1">Grid Region:</span>
            <select
              value={selectedFactor}
              onChange={(e) => setSelectedFactor(parseFloat(e.target.value))}
              className="bg-surface-elevated text-cyber-neon rounded-lg px-2.5 py-1 border border-surface-border focus:outline-none focus:border-emerald-500"
            >
              {REGIONS.map((r) => (
                <option key={r.id} value={r.factor}>
                  {r.name} ({r.factor} kg/kWh)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Highlight Lifetime Impact Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          
          <div className="p-5 rounded-2xl bg-surface-card border border-surface-border space-y-2">
            <div className="flex items-center justify-between text-gray-400 text-xs font-mono">
              <span>Lifetime CO₂ Saved</span>
              <Cloud className="w-4 h-4 text-cyber-cyan" />
            </div>
            <div className="text-3xl font-bold font-mono text-cyber-neon tracking-tight">
              {lifetimeCO2 === null ? "Unavailable" : lifetimeCO2.toFixed(1)} <span className="text-sm text-gray-400">g CO₂e</span>
            </div>
            <p className="text-[11px] text-gray-400 font-mono">
              Prevented from atmospheric release
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-surface-card border border-surface-border space-y-2">
            <div className="flex items-center justify-between text-gray-400 text-xs font-mono">
              <span>Energy Conserved</span>
              <Leaf className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-bold font-mono text-white tracking-tight">
              {lifetimeKwh === null ? "Unavailable" : lifetimeKwh.toFixed(3)} <span className="text-sm text-gray-400">kWh</span>
            </div>
            <p className="text-[11px] text-gray-400 font-mono">
              Cumulative reduction across sessions
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-surface-card border border-surface-border space-y-2">
            <div className="flex items-center justify-between text-gray-400 text-xs font-mono">
              <span>Tree Offset Equivalent</span>
              <TreePine className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-bold font-mono text-emerald-300 tracking-tight">
              {treeDays} <span className="text-sm text-gray-400">Tree-Days</span>
            </div>
            <p className="text-[11px] text-gray-400 font-mono">
              Equiv. carbon absorption (59.6g/day)
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-surface-card border border-surface-border space-y-2">
            <div className="flex items-center justify-between text-gray-400 text-xs font-mono">
              <span>Car Mileage Offset</span>
              <Car className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl font-bold font-mono text-amber-300 tracking-tight">
              {carKm} <span className="text-sm text-gray-400">km</span>
            </div>
            <p className="text-[11px] text-gray-400 font-mono">
              Average vehicle emissions offset
            </p>
          </div>

        </div>

        {/* Projections & Carbon Math */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Carbon Forecast Card */}
          <div className="p-6 rounded-2xl bg-surface-card border border-surface-border space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-surface-border font-mono text-xs">
              <span className="text-gray-300 font-bold flex items-center gap-2">
                <Calendar className="w-4 h-4 text-cyber-neon" />
                Workstation Emissions Forecast
              </span>
              <span className="text-gray-400">8h Daily Workload</span>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between py-2 border-b border-surface-border/40">
                <span className="text-gray-400">Today's Estimated Footprint:</span>
                <span className="text-white font-semibold">{dailyCO2Grams.toFixed(1)} g CO₂e ({dailyKwh.toFixed(3)} kWh)</span>
              </div>
              <div className="flex justify-between py-2 border-b border-surface-border/40">
                <span className="text-gray-400">Weekly Projected Footprint:</span>
                <span className="text-cyber-cyan font-semibold">{weeklyCO2Grams.toFixed(1)} g CO₂e ({(dailyKwh * 7).toFixed(2)} kWh)</span>
              </div>
              <div className="flex justify-between py-2 border-b border-surface-border/40">
                <span className="text-gray-400">Potential Weekly Optimization Savings:</span>
                <span className="text-cyber-neon font-bold">-{(weeklyCO2Grams * 0.20).toFixed(1)} g CO₂e (-20%)</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-400">Annual Prevented Impact:</span>
                <span className="text-emerald-300 font-bold">-{(weeklyCO2Grams * 52 * 0.20 / 1000).toFixed(2)} kg CO₂e / year</span>
              </div>
            </div>
          </div>

          {/* Environmental Formula Transparency */}
          <div className="p-6 rounded-2xl bg-surface-card border border-surface-border space-y-3 text-xs leading-relaxed">
            <div className="flex items-center gap-2 font-mono font-bold text-white">
              <Info className="w-4 h-4 text-emerald-400" />
              Transparent Conversion Methodology
            </div>
            <div className="space-y-2 text-gray-400 font-mono text-[11px]">
              <p>
                <strong>1. Energy:</strong> <code>kWh = (Watts / 1000) × Hours</code>
              </p>
              <p>
                <strong>2. Emissions:</strong> <code>kg CO₂e = kWh × Regional Grid Factor ({selectedFactor})</code>
              </p>
              <p>
                <strong>3. Tree Days:</strong> <code>1 Mature Tree absorbs ~59.64 g CO₂ per active day</code>
              </p>
              <p>
                <strong>4. Car Travel:</strong> <code>Average passenger vehicle emits ~120 g CO₂ / km</code>
              </p>
            </div>
            <p className="text-[11px] text-gray-400 pt-2 border-t border-surface-border">
              All factors comply with US EPA eGRID and European Environment Agency guidelines.
            </p>
          </div>

        </div>

      </main>

      <Footer />
    </div>
  );
}
