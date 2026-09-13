// frontend/components/ScrollHorizontalSection.tsx
"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Activity, Zap, Coins, LucideIcon, Layers, ShieldCheck, Award } from "lucide-react";
import { GlassPanel } from "./GlassPanel";

export interface ScrollFeatureCard {
  id: string;
  step: string;
  title: string;
  body: string;
  detail: string;
  badge: string;
  icon: LucideIcon;
  tag: string;
}

interface ScrollHorizontalSectionProps {
  title: string;
  subtitle: string;
  cards: ScrollFeatureCard[];
}

export const ScrollHorizontalSection: React.FC<ScrollHorizontalSectionProps> = ({
  title,
  subtitle,
  cards,
}) => {
  const targetRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ["start start", "end end"],
  });

  // Convert vertical scroll progress into horizontal track translation
  // Moves left as the user scrolls downwards
  const x = useTransform(scrollYProgress, [0, 1], ["2%", "-65%"]);

  return (
    <section ref={targetRef} className="relative h-[300vh] bg-black">
      {/* Sticky container that pins during vertical scroll */}
      <div className="sticky top-0 h-screen flex flex-col justify-center overflow-hidden px-4 sm:px-8">
        
        {/* Header indicator */}
        <div className="max-w-7xl mx-auto w-full mb-8">
          <div className="flex items-center gap-3">
            <span className="h-px w-10 bg-emerald-400" />
            <span className="text-xs font-mono uppercase tracking-widest text-emerald-400">
              {subtitle}
            </span>
          </div>
          <h2 className="font-display text-4xl sm:text-6xl font-bold uppercase tracking-display text-white mt-2">
            {title}
          </h2>
          <p className="text-xs font-mono text-white/40 mt-1">
            Scroll down to glide horizontally through the architecture
          </p>
        </div>

        {/* Horizontal scroll track */}
        <motion.div style={{ x }} className="flex gap-8 pl-4 pr-12">
          {cards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                className="relative w-[340px] sm:w-[460px] shrink-0 rounded-3xl overflow-hidden"
              >
                <GlassPanel
                  intensity="strong"
                  className="p-8 sm:p-10 h-[420px] flex flex-col justify-between border border-white/10 hover:border-emerald-500/40 transition-colors group"
                >
                  <span aria-hidden className="glass-sheen absolute inset-0" />
                  
                  {/* Card Top */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-mono uppercase tracking-widest px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                        {card.badge}
                      </span>
                      <span className="text-3xl font-display font-extrabold text-white/20 group-hover:text-emerald-400/30 transition-colors">
                        {card.step}
                      </span>
                    </div>

                    <div className="w-12 h-12 rounded-2xl liquid-glass border border-white/10 flex items-center justify-center mb-5 text-emerald-400 group-hover:scale-110 transition-transform">
                      <Icon className="w-6 h-6" />
                    </div>

                    <h3 className="font-display text-2xl sm:text-3xl font-bold tracking-display text-white mb-3 leading-tight">
                      {card.title}
                    </h3>

                    <p className="text-sm text-white/60 leading-relaxed font-sans">
                      {card.body}
                    </p>
                  </div>

                  {/* Card Bottom Tech Specs */}
                  <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs font-mono text-white/45">
                    <span>{card.detail}</span>
                    <span className="text-emerald-400">{card.tag}</span>
                  </div>
                </GlassPanel>
              </div>
            );
          })}
        </motion.div>

        {/* Scroll Progress Bar at bottom */}
        <div className="max-w-7xl mx-auto w-full mt-10">
          <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              style={{ scaleX: scrollYProgress, transformOrigin: "left" }}
              className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400"
            />
          </div>
        </div>

      </div>
    </section>
  );
};

