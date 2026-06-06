import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiApi } from '../lib/api';
import type { TailorStatus } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';

/**
 * AI tailoring: kick off a job (mutation) and poll its status (query).
 *
 * The status query replaces the hand-rolled setTimeout/useRef polling loop:
 * `refetchInterval` polls while the job is PENDING/IN_PROGRESS and returns
 * false to stop once the job reaches a terminal state.
 */

const POLL_INTERVAL_MS = 2500;

export function useTailorResume() {
  return useMutation({
    mutationFn: (payload: {
      resumeId: string;
      jobTitle: string;
      company: string;
      jobDescription: string;
    }) => aiApi.tailorResume(payload),
  });
}

/**
 * Poll a tailoring job's status. Pass the job id once it exists; the query
 * stays disabled (and silent) until then.
 */
export function useTailorStatus(tailoredResumeId: string | undefined) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: queryKeys.tailor.status(tailoredResumeId ?? ''),
    queryFn: () => aiApi.getTailorStatus(tailoredResumeId as string),
    enabled: !!tailoredResumeId,
    refetchInterval: (query) => {
      const status = query.state.data?.status as TailorStatus | undefined;
      if (status === 'COMPLETED' || status === 'FAILED') {
        // Job finished — refresh credit balance once and stop polling.
        qc.invalidateQueries({ queryKey: queryKeys.credits.balance });
        return false;
      }
      return POLL_INTERVAL_MS;
    },
    // Status is inherently fresh-per-poll; never serve a stale terminal value
    // when a new job starts under a new id (handled by the id-keyed cache).
    staleTime: 0,
  });
}
