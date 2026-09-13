// frontend/hooks/useCredits.ts
"use client";

/**
 * Server-state hooks for Green Credits and badges.
 * userId is fixed to "default_user" — the contract's identity model is
 * wallet-based for minting; credit state is keyed per user_id with this
 * default until auth exists.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchCreditState,
  fetchBadges,
  fetchMarketplaceCatalog,
  purchaseBadge,
} from "../lib/api";
import { qk } from "./useTelemetry";

/** GET /api/credits/state — balance, streak, rank, transactions. */
export function useCreditState(userId = "default_user") {
  return useQuery({
    queryKey: qk.credits(userId),
    queryFn: () => fetchCreditState(userId),
    // Balance changes after optimize/purchase mutations invalidate this key.
    staleTime: 10_000,
  });
}

/** GET /api/badges/list — 5-badge catalog with per-user unlock state. */
export function useBadges(userId = "default_user") {
  return useQuery({
    queryKey: qk.badges(userId),
    queryFn: () => fetchBadges(userId),
    staleTime: 10_000,
  });
}

interface PurchaseMutationResult {
  /** Readable outcome for the UI banner (success or the 400 detail). */
  message: string;
  success: boolean;
}

/** GET /api/marketplace/catalog — balance + items in a single call. */
export function useMarketplaceCatalog(userId = "default_user") {
  return useQuery({
    queryKey: qk.marketplace(userId),
    queryFn: () => fetchMarketplaceCatalog(userId),
    staleTime: 10_000,
  });
}

/**
 * POST /api/marketplace/purchase. On success invalidates credits, badges and
 * marketplace queries so balance + unlock states refresh from the server
 * rather than being patched locally (server remains the source of truth).
 */
export function usePurchaseBadge(userId = "default_user") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (badgeId: string): Promise<PurchaseMutationResult> => {
      const res = await purchaseBadge(badgeId, userId);
      return { success: res.success, message: res.message ?? (res.success ? "Badge unlocked!" : "Purchase failed.") };
    },
    onSuccess: (data) => {
      if (data.success) {
        void queryClient.invalidateQueries({ queryKey: qk.credits(userId) });
        void queryClient.invalidateQueries({ queryKey: qk.badges(userId) });
        void queryClient.invalidateQueries({ queryKey: qk.marketplace(userId) });
      }
    },
  });
}
