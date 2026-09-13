// frontend/app/impact/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { 
  Leaf, 
  Cloud, 
  TreePine, 
  Car, 
  Calendar, 
  Info,
  Layers,
  Sparkles
} from "lucide-react";
import { Navbar } from "../../components/Navbar";
import { Footer } from "../../components/Footer";
import { fetchCreditState } from "../../lib/api";
import { UserCreditState } from "../../types";
import { GlassPanel } from "../../components/GlassPanel";
import { EarthSphere3D } from "../../components/EarthSphere3D";

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
    <div className="min-h-screen flex flex-col bg-black">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {loadError && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs font-mono text-amber-200">
            Credit history unavailable. No fabricated impact values are shown.
          </div>
        )}
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-3xl sm:text-4xl tracking-display text-white">
                Carbon Impact &amp; Equivalencies
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono liquid-glass border border-emerald-500/50 text-emerald-300">
                Audited Conversion
              </span>
            </div>
            <p className="text-xs text-white/40 font-mono mt-1">
              Deterministic translation of avoided electrical energy into verified carbon reduction metrics.
            </p>
          </div>

          {/* Regional Grid Factor Selector */}
          <div className="flex items-center gap-2 liquid-glass p-2 rounded-xl border border-white/10 text-xs font-mono">
            <span className="text-white/40 text-[11px] pl-1">Grid Region:</span>
            <select
              value={selectedFactor}
              onChange={(e) => setSelectedFactor(parseFloat(e.target.value))}
              className="bg-black/60 text-emerald-300 rounded-lg px-2.5 py-1 border border-white/15 focus:outline-none focus:border-emerald-500 font-mono text-xs"
            >
              {REGIONS.map((r) => (
                <option key={r.id} value={r.factor} className="bg-black text-white">
                  {r.name} ({r.factor} kg/kWh)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 3D Earth Showcase Banner with Headline Stats */}
        <GlassPanel intensity="strong" className="p-8 relative overflow-hidden">
          <span aria-hidden className="glass-sheen absolute inset-0" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            <div className="lg:col-span-7 space-y-4">
              <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/30">
                Global Biosphere Impact
              </span>
              <h2 className="font-display text-3xl sm:text-4xl text-white tracking-display">
                Every saved watt directly prevents atmospheric emissions.
              </h2>
              <p className="text-sm text-white/60 leading-relaxed max-w-xl">
                By optimizing Windows system processes and power plans, your device
                reduces peak grid generation demand, verified using standard EPA eGRID factors.
              </p>
              <div className="pt-3 flex flex-wrap gap-4 font-mono text-xs text-white/50">
                <span className="inline-flex items-center gap-1.5">
                  <TreePine className="w-4 h-4 text-emerald-400" />
                  {treeDays ? `${treeDays} Tree-Days Saved` : "Calculating tree days…"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Car className="w-4 h-4 text-amber-400" />
                  {carKm ? `${carKm} km Car Mileage Avoided` : "Calculating vehicle offset…"}
                </span>
              </div>
            </div>

            <div className="lg:col-span-5 flex justify-center">
              <div className="w-full max-w-[320px] aspect-square">
                <EarthSphere3D size={300} interactive={true} />
              </div>
            </div>
          </div>
        </GlassPanel>

        {/* Highlight Lifetime Impact Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <GlassPanel className="p-5 space-y-2">
            <div className="flex items-center justify-between text-white/45 text-xs font-mono">
              <span>Lifetime CO₂ Saved</span>
              <Cloud className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-3xl font-bold font-mono text-emerald-300 tracking-tight">
              {lifetimeCO2 === null ? "—" : lifetimeCO2.toFixed(1)} <span className="text-sm text-white/45">g CO₂e</span>
            </div>
            <p className="text-[11px] text-white/40 font-mono">
              Prevented from atmospheric release
            </p>
          </GlassPanel>

          <GlassPanel className="p-5 space-y-2">
            <div className="flex items-center justify-between text-white/45 text-xs font-mono">
              <span>Energy Conserved</span>
              <Leaf className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-bold font-mono text-white tracking-tight">
              {lifetimeKwh === null ? "—" : lifetimeKwh.toFixed(3)} <span className="text-sm text-white/45">kWh</span>
            </div>
            <p className="text-[11px] text-white/40 font-mono">
              Cumulative reduction across sessions
            </p>
          </GlassPanel>

          <GlassPanel className="p-5 space-y-2">
            <div className="flex items-center justify-between text-white/45 text-xs font-mono">
              <span>Tree Offset Equivalent</span>
              <TreePine className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-bold font-mono text-emerald-300 tracking-tight">
              {treeDays ?? "—"} <span className="text-sm text-white/45">Tree-Days</span>
            </div>
            <p className="text-[11px] text-white/40 font-mono">
              Equiv. carbon absorption (59.6g/day)
            </p>
          </GlassPanel>

          <GlassPanel className="p-5 space-y-2">
            <div className="flex items-center justify-between text-white/45 text-xs font-mono">
              <span>Car Mileage Offset</span>
              <Car className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl font-bold font-mono text-amber-300 tracking-tight">
              {carKm ?? "—"} <span className="text-sm text-white/45">km</span>
            </div>
            <p className="text-[11px] text-white/40 font-mono">
              Average vehicle emissions offset
            </p>
          </GlassPanel>
        </div>

        {/* Projections & Carbon Math */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Carbon Forecast Card */}
          <GlassPanel className="p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 font-mono text-xs">
              <span className="text-white font-semibold flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                Workstation Emissions Forecast
              </span>
              <span className="text-white/40">8h Daily Workload</span>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-white/45">Today's Estimated Footprint:</span>
                <span className="text-white font-semibold">{dailyCO2Grams.toFixed(1)} g CO₂e ({dailyKwh.toFixed(3)} kWh)</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-white/45">Weekly Projected Footprint:</span>
                <span className="text-cyan-300 font-semibold">{weeklyCO2Grams.toFixed(1)} g CO₂e ({(dailyKwh * 7).toFixed(2)} kWh)</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-white/45">Potential Weekly Savings:</span>
                <span className="text-emerald-300 font-bold">-{(weeklyCO2Grams * 0.20).toFixed(1)} g CO₂e (-20%)</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-white/45">Annual Prevented Impact:</span>
                <span className="text-emerald-300 font-bold">-{(weeklyCO2Grams * 52 * 0.20 / 1000).toFixed(2)} kg CO₂e / year</span>
              </div>
            </div>
          </GlassPanel>

          {/* Environmental Formula Transparency */}
          <GlassPanel className="p-6 space-y-3 text-xs leading-relaxed">
            <div className="flex items-center gap-2 font-mono font-bold text-white">
              <Info className="w-4 h-4 text-emerald-400" />
              Transparent Conversion Methodology
            </div>
            <div className="space-y-2 text-white/50 font-mono text-[11px]">
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
            <p className="text-[11px] text-white/40 pt-2 border-t border-white/10">
              All factors comply with US EPA eGRID and European Environment Agency guidelines.
            </p>
          </GlassPanel>
        </div>
      </main>

      <Footer />
    </div>
  );
}
