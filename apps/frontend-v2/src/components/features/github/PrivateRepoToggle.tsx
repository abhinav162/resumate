import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { githubApi, type GithubStatus } from '../../../lib/githubApi';

/**
 * Opt-in checkbox for listing private repositories (M2.9.2). Off by default —
 * the baseline flow lists public repos only. Turning it on also surfaces the
 * GitHub App install link: private repos only become visible once the app is
 * installed on the user's account with access to them.
 *
 * Shared by the dashboard connect card and the /github page so the preference
 * is reachable from both.
 */
export function PrivateRepoToggle({ status }: { status: GithubStatus }) {
  const queryClient = useQueryClient();

  const toggle = useMutation({
    mutationFn: githubApi.setPreferences,
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
          checked={status.includePrivate}
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
      {status.includePrivate && status.appSlug && (
        <a
          href={`https://github.com/apps/${status.appSlug}/installations/new`}
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
