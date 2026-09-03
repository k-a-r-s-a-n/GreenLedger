"use client";

import React from "react";
import { AlertTriangle, ShieldCheck, Zap, X, Check } from "lucide-react";
import { OptimizationOpportunity } from "../types";

interface OptimizationModalProps {
  isOpen: boolean;
  opportunity: OptimizationOpportunity | null;
  onClose: () => void;
  onConfirm: (actionId: string, params?: any) => void;
  isExecuting?: boolean;
}

export const OptimizationModal: React.FC<OptimizationModalProps> = ({
  isOpen,
  opportunity,
  onClose,
  onConfirm,
  isExecuting = false
}) => {
  if (!isOpen || !opportunity) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md p-6 rounded-2xl bg-surface-card border border-surface-border shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-surface-elevated transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-cyber-neon">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              Confirm Safe Optimization
            </h3>
            <span className="text-[11px] font-mono text-emerald-400">
              User-Approved Execution Guardrail
            </span>
          </div>
        </div>

        {/* Action Details */}
        <div className="mt-5 space-y-3">
          <div className="p-3.5 rounded-xl bg-surface/80 border border-surface-border">
            <div className="text-xs font-semibold text-white mb-1">
              {opportunity.title}
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              {opportunity.description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-2.5 rounded-lg bg-surface/60 border border-surface-border">
              <span className="text-gray-400 text-[10px]">Expected Power Drop:</span>
              <div className="text-cyber-neon font-bold mt-0.5">
                {opportunity.estimated_power_reduction_pct == null ? "Measured after execution" : `~${opportunity.estimated_power_reduction_pct}%`}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-surface/60 border border-surface-border">
              <span className="text-gray-400 text-[10px]">Reversible:</span>
              <div className="text-white font-bold mt-0.5">
                {opportunity.reversible ? "Yes (Undo Available)" : "Manual Relaunch"}
              </div>
            </div>
          </div>

          {/* Safety Notice */}
          <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/40 flex items-start gap-2.5 text-xs text-emerald-300">
            <ShieldCheck className="w-4 h-4 text-cyber-neon shrink-0 mt-0.5" />
            <span className="text-[11px] leading-relaxed">
              Adheres to GreenLedger Safety Rules: Never terminates Windows OS services, does not delete user files, and adheres strictly to safe process boundaries.
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isExecuting}
            className="px-4 py-2 rounded-xl text-xs font-mono text-gray-400 hover:text-white hover:bg-surface-elevated transition"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(opportunity.id, { pid: opportunity.pid })}
            disabled={isExecuting}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-mono font-bold shadow-glow-green flex items-center gap-1.5 transition"
          >
            {isExecuting ? (
              <span>Applying...</span>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Apply Optimization</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
