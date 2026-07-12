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
