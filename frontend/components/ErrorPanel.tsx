// frontend/components/ErrorPanel.tsx
"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./Button";

interface ErrorPanelProps {
  title?: string;
  message: string;
  /** When provided, renders a retry button wired to this callback. */
  onRetry?: () => void;
  /** Compact variant for inline slots. */
  compact?: boolean;
  className?: string;
}

/**
 * Explicit failure state — the app never renders blank on error.
 * Amber (not rose) to signal "recoverable environment issue" (backend
 * unreachable, agent offline) rather than user error.
 */
export function ErrorPanel({
  title = "Data unavailable",
  message,
  onRetry,
  compact = false,
  className,
}: ErrorPanelProps) {
  return (
    <div
      role="alert"
      className={`rounded-2xl border border-amber-500/40 bg-amber-500/10 ${compact ? "px-4 py-3" : "px-5 py-4"} ${className ?? ""}`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-300 mt-0.5 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-200">{title}</p>
          <p className="text-xs font-mono text-amber-200/70 mt-0.5 leading-relaxed break-words">
            {message}
          </p>
        </div>
        {onRetry && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onRetry}
            className="ml-auto shrink-0 border-amber-500/40 text-amber-200"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden />
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}
