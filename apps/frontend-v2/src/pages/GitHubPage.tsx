import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Github } from 'lucide-react';
import { AccountsStrip } from '../components/features/github/AccountsStrip';
import { BrowseTab } from '../components/features/github/BrowseTab';
import { GitHubConnectCard } from '../components/features/github/GitHubConnectCard';
import { LibraryTab } from '../components/features/github/LibraryTab';
import { OrganizationsPanel } from '../components/features/github/OrganizationsPanel';
import { useCredits } from '../contexts/CreditContext';
import { formatCredits } from '../lib/format';
import { githubApi } from '../lib/githubApi';
import { useResumes } from '../hooks/useResumes';

/** Raw list shape from useResumes — only what the library cards need. */
type ResumeListItem = { id: string; name: string };

type TabId = 'library' | 'browse' | 'access';

const TABS: { id: TabId; label: string }[] = [
  { id: 'library', label: 'Library' },
  { id: 'browse', label: 'Browse repos' },
  { id: 'access', label: 'Access & settings' },
];

/**
 * /github — tabbed GitHub workspace (M2.11.3).
 *
 * Header (title + credit/free-analysis stats) and the connected-accounts
 * strip sit above three tabs: "Library" (analyzed repos with bullets),
 * "Browse repos" (the ranked picker + analyze flow shared with the editor's
 * import modal) and "Access & settings" (per-account orgs, private-repo
 * preference and connection management). The active tab lives in ?tab= so
 * links survive reload.
 */
export default function GitHubPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { balance, loading: creditsLoading } = useCredits();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // GitHub's post-install redirect lands on ?tab=access with a flash:
  // 'installed' — the app was installed or its repo access changed (refetch
  // everything github-scoped once); 'requested' — a non-admin org member
  // asked an owner to approve, so NOTHING is granted yet.
  const githubFlash = searchParams.get('github');
  const installedFlash = githubFlash === 'installed';
  const requestedFlash = githubFlash === 'requested';
  const dismissInstalledFlash = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('github');
    setSearchParams(params, { replace: true });
  };
  useEffect(() => {
    if (installedFlash) {
      queryClient.invalidateQueries({ queryKey: ['github'] });
    }
  }, [installedFlash, queryClient]);

  const rawTab = searchParams.get('tab');
  const tab: TabId = rawTab === 'browse' || rawTab === 'access' ? rawTab : 'library';
  const setTab = (next: TabId) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'library') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params, { replace: true });
  };

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['github', 'status'],
    queryFn: githubApi.getStatus,
    enabled: isLoaded && isSignedIn,
  });
  const connected = status?.connected === true;

  // Shares the cache with the Browse tab; here it only feeds the accounts
  // strip's per-account attention dots.
  const { data: repos } = useQuery({
    queryKey: ['github', 'repos'],
    queryFn: () => githubApi.getRepos(),
    enabled: connected,
  });

  const { data: resumesData } = useResumes({ enabled: isLoaded && isSignedIn });
  const resumes = (resumesData ?? []) as ResumeListItem[];

  const freeReposLeft = repos?.freeReposLeft ?? status?.freeReposLeft ?? 0;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Github size={22} className="text-ink-primary" />
          <h1 className="font-heading text-2xl font-bold text-ink-primary">GitHub Projects</h1>
        </div>
        {connected && (
          <p className="text-sm text-ink-muted text-right">
            <Link
              to="/credits"
              className="font-mono font-medium text-ink-secondary hover:text-indigo-600 transition-colors"
              title="Buy credits"
            >
              {creditsLoading ? '…' : formatCredits(balance)} credits
            </Link>{' '}
            · {freeReposLeft} free {freeReposLeft === 1 ? 'analysis' : 'analyses'} left
          </p>
        )}
      </div>

      {installedFlash && (
        <div
          className="bg-success-bg border border-success-border rounded-lg px-4 py-3 text-success-text text-sm font-medium cursor-pointer"
          onClick={dismissInstalledFlash}
        >
          ✓ GitHub repository access updated — your repo list is refreshing.
        </div>
      )}
      {requestedFlash && (
        <div
          className="bg-warning-bg border border-warning-border rounded-lg px-4 py-3 text-warning-text text-sm font-medium cursor-pointer"
          onClick={dismissInstalledFlash}
        >
          Access request sent — an organization owner must approve it before those repos appear
          here. You'll see the org as connected once they do.
        </div>
      )}

      {statusLoading && <div className="h-24 bg-paper-border rounded-lg animate-pulse" />}

      {!statusLoading && !connected && <GitHubConnectCard />}

      {connected && status && (
        <>
          <AccountsStrip status={status} accountErrors={repos?.accounts} />

          {/* Tab bar */}
          <div className="flex items-center gap-1 border-b border-paper-border" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  tab === t.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-ink-secondary hover:text-ink-primary'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'library' && (
            <LibraryTab resumes={resumes} onGoToBrowse={() => setTab('browse')} />
          )}
          {tab === 'browse' && (
            <BrowseTab status={status} onGoToLibrary={() => setTab('library')} />
          )}
          {tab === 'access' && <OrganizationsPanel status={status} />}
        </>
      )}
    </div>
  );
}
