import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { githubApi } from '../../../lib/githubApi';

/**
 * Opt-in checkbox for listing private repositories (M2.9.2). Off by default —
 * the baseline flow lists public repos only. Turning it on also surfaces the
 * GitHub App install link: private repos only become visible once the app is
 * installed on the account with access to them.
 *
 * Since M2.11 the preference is per connected account: pass `connectionId` to
 * scope the change to one account (omit it to apply to all).
 */
export function PrivateRepoToggle({
  includePrivate,
  appSlug,
  connectionId,
}: {
  includePrivate: boolean;
  appSlug: string | null;
  /** Connection id of the account this toggle controls; omitted = all accounts. */
  connectionId?: number;
}) {
  const queryClient = useQueryClient();

  const toggle = useMutation({
    mutationFn: (value: boolean) => githubApi.setPreferences(value, connectionId),
    onSuccess: () => {
      // The repo listing + status both change with the preference.
      queryClient.invalidateQueries({ queryKey: ['github'] });
    },
  });

  return (
    <div className="space-y-1">
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={includePrivate}
          disabled={toggle.isPending}
          onChange={(e) => toggle.mutate(e.target.checked)}
          className="mt-0.5 accent-indigo-600"
        />
        <span className="text-xs text-ink-secondary">
          Include private repositories
          <span className="block text-ink-muted">
            READMEs of selected private repos are sent for AI analysis.
          </span>
        </span>
      </label>
      {includePrivate && appSlug && (
        <a
          href={`https://github.com/apps/${appSlug}/installations/new`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-indigo-600 font-medium hover:text-indigo-700 pl-6"
        >
          Grant repo access on GitHub
          <ExternalLink size={11} />
        </a>
      )}
      {toggle.isError && (
        <p className="text-xs text-danger-text pl-6">Could not save the preference. Please try again.</p>
      )}
    </div>
  );
}
