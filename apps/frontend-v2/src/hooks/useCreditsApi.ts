import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { creditsApi } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';

/**
 * Credits queries & mutations.
 *
 * Named `useCreditsApi` to avoid colliding with the existing `useCredits`
 * context hook, which is refactored to delegate to `useCreditBalance` below.
 */

export function useCreditBalance(enabled = true) {
  return useQuery({
    queryKey: queryKeys.credits.balance,
    queryFn: async () => (await creditsApi.getBalance()).balance,
    enabled,
  });
}

export function useCreditPacks() {
  return useQuery({
    queryKey: queryKeys.credits.packs,
    queryFn: creditsApi.getPacks,
    // Packs rarely change — keep them fresh for the whole session.
    staleTime: Infinity,
  });
}

export function useCreateCheckout() {
  return useMutation({
    mutationFn: (packId: string) => creditsApi.createCheckout(packId),
  });
}

/** Imperatively refresh the cached balance (e.g. after a purchase). */
export function useInvalidateCreditBalance() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.credits.balance });
}
