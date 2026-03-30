import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { creditsApi } from '../lib/api';

interface CreditContextType {
  balance: number | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const CreditContext = createContext<CreditContextType>({ balance: null, loading: true, refresh: async () => {} });

export function CreditProvider({ children }: { children: ReactNode }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await creditsApi.getBalance();
      setBalance(data.balance);
    } catch {
      // silently fail — user may not be logged in
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return <CreditContext.Provider value={{ balance, loading, refresh }}>{children}</CreditContext.Provider>;
}

export const useCredits = () => useContext(CreditContext);
