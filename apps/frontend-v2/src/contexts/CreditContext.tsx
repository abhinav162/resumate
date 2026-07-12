import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useCreditBalance } from '../hooks/useCreditsApi';

interface CreditContextType {
  balance: number | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const CreditContext = createContext<CreditContextType>({ balance: null, loading: true, refresh: async () => {} });

/**
 * Formats a credit balance for display. Balances can be fractional since the
 * 0.2-credit GitHub repo pricing (M2) — show whole numbers plainly and clamp
 * fractional values to 2 dp so float drift (4.799999…) never leaks into the UI.
 */
export function formatCredits(balance: number | null | undefined): string {
  if (balance == null) return '–';
  return Number.isInteger(balance) ? String(balance) : balance.toFixed(2);
}

/**
 * Thin wrapper over the cached credit-balance query. Kept as a context so the
 * many existing `useCredits()` callers don't need to change, while the actual
 * fetching/caching/invalidation is owned by React Query. The axios request
 * interceptor injects auth, so no manual token syncing is needed here.
 */
export function CreditProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const enabled = isLoaded && isSignedIn;

  const { data, isLoading, refetch } = useCreditBalance(enabled);

  const value: CreditContextType = {
    balance: data ?? null,
    loading: enabled ? isLoading : false,
    refresh: async () => {
      await refetch();
    },
  };

  return <CreditContext.Provider value={value}>{children}</CreditContext.Provider>;
}

export const useCredits = () => useContext(CreditContext);
