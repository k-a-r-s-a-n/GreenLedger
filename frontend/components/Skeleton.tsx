// frontend/components/Skeleton.tsx
import React from "react";
import { cn } from "../lib/cn";

interface SkeletonProps {
  className?: string;
  /** Rounded pill style for text lines. Default block. */
  rounded?: boolean;
}

/**
 * Shimmer loading placeholder. Always visually distinct from real values:
 * grey block with a sweeping highlight — never render fake numbers in here.
 */
export function Skeleton({ className, rounded }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn("skeleton", rounded && "rounded-full", className)}
    />
  );
}
