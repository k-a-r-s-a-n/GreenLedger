import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatWatts(w: number): string {
  return `${w.toFixed(1)} W`;
}

export function formatGrams(g: number): string {
  if (g >= 1000) {
    return `${(g / 1000).toFixed(2)} kg`;
  }
  return `${g.toFixed(1)} g`;
}

export function formatPercent(p: number): string {
  return `${p.toFixed(1)}%`;
}
