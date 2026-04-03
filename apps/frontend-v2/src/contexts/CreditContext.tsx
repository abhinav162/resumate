import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { creditsApi, setAuthHeaders } from '../lib/api';

interface CreditContextType {
  balance: number | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const CreditContext = createContext<CreditContextType>({ balance: null, loading: true, refresh: async () => {} });

export function CreditProvider({ children }: { children: ReactNode }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();

  const refresh = useCallback(async () => {
    try {
      const data = await creditsApi.getBalance();
      setBalance(data.balance);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setLoading(false);
      return;
    }
    // Ensure auth headers are set before the first balance fetch
    const init = async () => {
      try {
        const token = await getToken();
        setAuthHeaders(token, userId);
        await refresh();
      } catch {
        setLoading(false);
      }
    };
    init();
  }, [isLoaded, isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  return <CreditContext.Provider value={{ balance, loading, refresh }}>{children}</CreditContext.Provider>;
}

export const useCredits = () => useContext(CreditContext);
