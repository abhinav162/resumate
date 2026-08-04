import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { RefreshCw, Search, X } from 'lucide-react';
import { Button } from '../../ui/Button';
import { githubApi, type AnalyzeResult, type GithubStatus } from '../../../lib/githubApi';
import { RepoPickerList, RepoPricingSummary } from './RepoPickerList';
import { useGithubConnect } from './useGithubConnect';

const selectClasses =
  'text-xs font-medium border border-paper-border rounded px-2 py-1.5 bg-paper-surface text-ink-secondary hover:border-paper-border-strong focus:outline-none focus:border-indigo-500 cursor-pointer';

/** Classify an analyze failure for the sticky bar's inline error area. */
function analyzeErrorInfo(error: unknown): { kind: 'credits' | 'rateLimited' | 'generic'; retryAt?: string | null } {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 402) return { kind: 'credits' };
    if (status === 429) {
      const retryAt = (error.response?.data as { retryAt?: string | null } | undefined)?.retryAt;
      return { kind: 'rateLimited', retryAt: retryAt ?? null };
    }
  }
  return { kind: 'generic' };
}

/**
 * "Browse repos" tab of /github: the ranked repo picker shared with the
 * editor's import modal, plus client-side search/account/owner/language
 * filters and a sticky bottom action bar (selection meter + analyze button +
 * inline errors) so the primary action never scrolls out of view. Accounts
 * whose fetch failed surface as dismissible warnings with a reconnect action.
 */
export function BrowseTab({
  status,
  onGoToLibrary,
}: {
  status: GithubStatus;
  onGoToLibrary: () => void;
}) {
  const queryClient = useQueryClient();
  const connect = useGithubConnect();

  // Pick order matters: the first `freeReposLeft` non-cached selections are free.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [languageFilter, setLanguageFilter] = useState('');
  // Per-account fetch warnings the user has dismissed (by connection id).
  const [dismissedErrorIds, setDismissedErrorIds] = useState<Set<number>>(new Set());
  // Repos skipped by the last analyze run (partial failure) — cleared on retry.
  const [analyzeFailed, setAnalyzeFailed] = useState<NonNullable<AnalyzeResult['failed']>>([]);
  // Count of successfully analyzed repos from the last run, for the library hint.
  const [analyzedCount, setAnalyzedCount] = useState<number | null>(null);

  const {
    data: repos,
    isLoading: reposLoading,
    isError: reposError,
  } = useQuery({
    queryKey: ['github', 'repos'],
    queryFn: () => githubApi.getRepos(),
  });

  // Library entries make re-analysis free, even when stale (see pricing note).
  const { data: library } = useQuery({
    queryKey: ['github', 'summaries'],
    queryFn: githubApi.getSummaries,
  });

  // Refresh bypasses the cached repo profile; the result replaces the query
  // cache so the list below updates in place.
  const refresh = useMutation({
    mutationFn: () => githubApi.getRepos(true),
    onSuccess: (data) => {
      queryClient.setQueryData(['github', 'repos'], data);
    },
  });

  const analyze = useMutation({
    mutationFn: githubApi.analyzeRepos,
    onMutate: () => {
      setAnalyzeFailed([]);
      setAnalyzedCount(null);
    },
    onSuccess: (data) => {
      setAnalyzeFailed(data.failed ?? []);
      setAnalyzedCount(data.summaries.length);
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['github'] });
      queryClient.invalidateQueries({ queryKey: ['credits'] });
    },
  });

  const importable = repos?.importable ?? [];
  const entries = library?.summaries ?? [];
  const freeReposLeft = repos?.freeReposLeft ?? library?.freeReposLeft ?? status.freeReposLeft;

  // Free set: repos flagged analyzed by the repos endpoint plus anything with
  // a library entry (stale or not — re-analysis is free). Only never-analyzed
  // repos are chargeable.
  const freeRepoIds = new Set([
    ...importable.filter((r) => r.analyzed).map((r) => r.id),
    ...entries.map((s) => s.repoId),
  ]);

  // Filter options derived from the list itself (client-side only).
  const owners = [...new Set(importable.map((r) => r.ownerLogin).filter((o): o is string => Boolean(o)))];
  const languages = [
    ...new Set(importable.map((r) => r.primaryLanguage).filter((l): l is string => Boolean(l))),
  ].sort();

  const query = search.trim().toLowerCase();
  const filtered = importable.filter((repo) => {
    if (accountFilter && String(repo.connectionId ?? '') !== accountFilter) return false;
    if (ownerFilter && repo.ownerLogin !== ownerFilter) return false;
    if (languageFilter && repo.primaryLanguage !== languageFilter) return false;
    if (!query) return true;
    return (
      repo.nameWithOwner.toLowerCase().includes(query) ||
      (repo.description?.toLowerCase().includes(query) ?? false)
    );
  });

  // Accounts whose fetch failed — their repos are missing from the list.
  const failedAccounts = (repos?.accounts ?? []).filter(
    (a) => a.error && !dismissedErrorIds.has(a.id)
  );

  const toggleSelected = (repoId: string) => {
    setSelectedIds((prev) =>
      prev.includes(repoId) ? prev.filter((id) => id !== repoId) : [...prev, repoId]
    );
  };

  const dismissAccountError = (id: number) => {
    setDismissedErrorIds((prev) => new Set(prev).add(id));
  };

  const errorInfo = analyze.isError ? analyzeErrorInfo(analyze.error) : null;

  return (
    <div className="space-y-4">
      {/* Per-account fetch failures (other accounts' repos still listed) */}
      {failedAccounts.map((account) => (
        <div
          key={account.id}
          className="flex items-center justify-between gap-3 bg-warning-bg border border-warning-border rounded-lg px-3 py-2"
        >
          <p className="text-xs text-warning-text">
            {account.error === 'GITHUB_RECONNECT'
              ? `@${account.login ?? 'account'} needs reconnecting — its repos are hidden.`
              : `Repos from @${account.login ?? 'account'} couldn't be loaded — try refreshing.`}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            {account.error === 'GITHUB_RECONNECT' && (
              <Button
                size="sm"
                variant="secondary"
                loading={connect.isPending}
                onClick={() => connect.mutate()}
              >
                Reconnect
              </Button>
            )}
            <button
              type="button"
              onClick={() => dismissAccountError(account.id)}
              className="text-warning-text hover:opacity-70 p-0.5 rounded transition-opacity"
              aria-label="Dismiss warning"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      ))}

      {/* Search + filters + refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search repositories…"
            className="w-full text-sm border border-paper-border rounded pl-8 pr-3 py-1.5 bg-paper-surface text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {status.accounts.length > 1 && (
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className={selectClasses}
              aria-label="Filter by account"
            >
              <option value="">All accounts</option>
              {status.accounts.map((a) => (
                <option key={a.id} value={String(a.id)}>
                  {a.login ? `@${a.login}` : `Account #${a.id}`}
                </option>
              ))}
            </select>
          )}
          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className={selectClasses}
            aria-label="Filter by owner"
          >
            <option value="">All owners</option>
            {owners.map((owner) => (
              <option key={owner} value={owner}>
                {owner}
              </option>
            ))}
          </select>
          <select
            value={languageFilter}
            onChange={(e) => setLanguageFilter(e.target.value)}
            className={selectClasses}
            aria-label="Filter by language"
          >
            <option value="">All languages</option>
            {languages.map((language) => (
              <option key={language} value={language}>
                {language}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="ghost"
            loading={refresh.isPending}
            onClick={() => refresh.mutate()}
          >
            <RefreshCw size={14} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Repo list */}
      {reposLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 bg-paper-border rounded animate-pulse" />
          ))}
        </div>
      )}
      {reposError && (
        <p className="py-8 text-center text-sm text-danger-text">
          Could not load your repositories. Please try again.
        </p>
      )}
      {!reposLoading && !reposError && (
        <RepoPickerList
          repos={filtered}
          selectedIds={selectedIds}
          onToggle={toggleSelected}
          freeRepoIds={freeRepoIds}
          freeReposLeft={freeReposLeft}
        />
      )}

      {/* Sticky action bar: the analyze CTA never scrolls out of view. */}
      <div className="sticky bottom-0 -mx-1 px-1 pb-2 pt-1">
        <div className="bg-paper-surface border border-paper-border rounded-lg shadow-elevated p-3 space-y-2">
          {errorInfo?.kind === 'credits' && (
            <p className="text-sm text-danger-text">
              Not enough credits.{' '}
              <Link
                to="/credits"
                className="text-indigo-600 font-medium hover:text-indigo-700 underline"
              >
                Get credits
              </Link>
            </p>
          )}
          {errorInfo?.kind === 'rateLimited' && (
            <p className="text-sm text-warning-text">
              GitHub rate limit reached — try again{' '}
              {errorInfo.retryAt
                ? `after ${new Date(errorInfo.retryAt).toLocaleTimeString()}`
                : 'shortly'}
              .
            </p>
          )}
          {errorInfo?.kind === 'generic' && (
            <p className="text-sm text-danger-text">Analysis failed. Please try again.</p>
          )}
          {analyzeFailed.length > 0 && (
            <p className="text-sm text-warning-text">
              {analyzeFailed.length} {analyzeFailed.length === 1 ? 'repo' : 'repos'} could not be
              analyzed: {analyzeFailed.map((f) => f.repoName ?? f.repoId).join(', ')} — try again
              later.
            </p>
          )}
          {analyzedCount !== null && analyzedCount > 0 && (
            <p className="text-sm text-success-text">
              Analyzed {analyzedCount} {analyzedCount === 1 ? 'repo' : 'repos'}.{' '}
              <button
                type="button"
                onClick={onGoToLibrary}
                className="text-indigo-600 font-medium hover:text-indigo-700 underline"
              >
                View in library →
              </button>
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <RepoPricingSummary
              selectedIds={selectedIds}
              freeRepoIds={freeRepoIds}
              freeReposLeft={freeReposLeft}
            />
            <Button
              size="sm"
              disabled={selectedIds.length === 0}
              loading={analyze.isPending}
              onClick={() => analyze.mutate(selectedIds)}
            >
              Analyze {selectedIds.length} {selectedIds.length === 1 ? 'repo' : 'repos'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
