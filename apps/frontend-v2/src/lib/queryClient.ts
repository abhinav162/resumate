import { QueryClient } from '@tanstack/react-query';

/**
 * Shared QueryClient for the app.
 *
 * Defaults are tuned for a dashboard-style app where data changes occasionally
 * and instant navigation matters more than absolute freshness:
 * - staleTime 30s   — served from cache without a refetch for 30s after a fetch
 * - gcTime 5min     — unused cache entries are dropped after 5 minutes
 * - retry 1         — one retry on transient failure (auth/4xx are not retried below)
 * - refetchOnWindowFocus — revalidate quietly when the user returns to the tab
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: (failureCount, error: any) => {
        // Don't retry client errors (auth, validation, not-found).
        const status = error?.response?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 1;
      },
    },
    mutations: {
      retry: 0,
    },
  },
});
