import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Unplug } from 'lucide-react';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import {
  githubApi,
  type GithubOrgAccess,
  type GithubOrgAccountAccess,
  type GithubStatus,
} from '../../../lib/githubApi';
import { PrivateRepoToggle } from './PrivateRepoToggle';
import { useGithubConnect } from './useGithubConnect';

/**
 * "Access & settings" content (M2.10 orgs panel, reshaped per-account for
 * M2.11): one card per connected GitHub account with the organizations it can
 * see, the GitHub App's install state there, that account's private-repo
 * preference, and reconnect/disconnect actions. Orgs without the app
 * installed get an install/request deep-link — private repos from an org only
 * become listable once the app is installed (org owners may need to approve).
 */
export function OrganizationsPanel({ status }: { status: GithubStatus }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['github', 'orgs'],
    queryFn: githubApi.getOrgs,
    enabled: status.connected,
  });

  const appSlug = data?.appSlug ?? status.appSlug;
  // includePrivate lives on the status accounts; org data is keyed by the
  // same connection ids.
  const statusById = new Map(status.accounts.map((a) => [a.id, a]));

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-muted">
        Private repositories from an organization appear only after the app is installed there —
        org owners may need to approve the request.
      </p>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 bg-paper-border rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-sm text-danger-text">
          Could not load your organizations. Please try again.
        </p>
      )}

      {!isLoading &&
        !isError &&
        (data?.accounts ?? []).map((account) => (
          <AccountAccessCard
            key={account.id}
            account={account}
            includePrivate={statusById.get(account.id)?.includePrivate ?? false}
            appSlug={appSlug}
          />
        ))}
    </div>
  );
}

/** One connected account: its orgs, private-repo preference and actions. */
function AccountAccessCard({
  account,
  includePrivate,
  appSlug,
}: {
  account: GithubOrgAccountAccess;
  includePrivate: boolean;
  appSlug: string | null;
}) {
  const queryClient = useQueryClient();
  const connect = useGithubConnect();

  const disconnect = useMutation({
    mutationFn: () => githubApi.disconnect(account.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['github'] });
    },
  });

  const label = account.login ? `@${account.login}` : `Account #${account.id}`;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-heading font-semibold text-ink-primary truncate">{label}</h3>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="secondary"
            loading={connect.isPending}
            onClick={() => connect.mutate()}
          >
            <RefreshCw size={12} />
            Reconnect
          </Button>
          <Button
            size="sm"
            variant="ghost"
            loading={disconnect.isPending}
            onClick={() => {
              if (window.confirm(`Disconnect ${label}? Its repos will disappear from listings.`))
                disconnect.mutate();
            }}
          >
            <Unplug size={12} />
            Disconnect
          </Button>
        </div>
      </div>

      {disconnect.isError && (
        <p className="text-xs text-danger-text">Could not disconnect. Please try again.</p>
      )}

      {account.error ? (
        <p className="text-xs text-warning-text">
          {account.error === 'GITHUB_RECONNECT'
            ? `${label} needs reconnecting — organization access can't be listed until then.`
            : `Could not load organizations for ${label}. Please try again.`}
        </p>
      ) : (
        <ul className="divide-y divide-paper-border">
          {account.orgs.map((org) => (
            <OrgRow key={org.login} org={org} appSlug={appSlug} />
          ))}
          {account.orgs.length === 0 && (
            <li className="py-2 text-xs text-ink-muted">No organizations found.</li>
          )}
        </ul>
      )}

      <div className="pt-2 border-t border-paper-border">
        <PrivateRepoToggle
          includePrivate={includePrivate}
          appSlug={appSlug}
          connectionId={account.id}
        />
      </div>
    </Card>
  );
}

/** Deep-link to install the app on (or request access for) a specific account. */
function installUrl(appSlug: string, org: GithubOrgAccess): string {
  return org.databaseId !== null
    ? `https://github.com/apps/${appSlug}/installations/new/permissions?target_id=${org.databaseId}`
    : `https://github.com/apps/${appSlug}/installations/new`;
}

function OrgRow({ org, appSlug }: { org: GithubOrgAccess; appSlug: string | null }) {
  const accessible = org.accessible ?? null;
  // The org granted repos to the app, but THIS user's GitHub account can't
  // open any of them — the classic non-admin org-member gap (M2.12). Without
  // this hint the repos just silently never appear.
  const memberAccessGap =
    org.status === 'installed' && org.type === 'Organization' && accessible !== null && accessible.total === 0;

  return (
    <li className="py-2 space-y-1">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-sm text-ink-primary truncate">{org.login}</span>
          {org.type === 'User' && <span className="text-xs text-ink-muted">Personal account</span>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {org.status === 'installed' && accessible !== null && (
            <span className="text-xs text-ink-muted" title="Repos you can reach through this installation: the org's grant filtered by your own GitHub permissions">
              {accessible.total} {accessible.total === 1 ? 'repo' : 'repos'}
              {accessible.privateCount > 0 && ` (${accessible.privateCount} private)`} visible to you
            </span>
          )}
          {org.status === 'installed' && <Badge variant="success">Connected</Badge>}
          {org.status === 'suspended' && <Badge variant="warning">Suspended</Badge>}
          {org.status === 'not_installed' && (
            <>
              <Badge>No access</Badge>
              {appSlug && (
                <a
                  href={installUrl(appSlug, org)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-indigo-600 font-medium hover:text-indigo-700"
                >
                  Install / request access →
                </a>
              )}
            </>
          )}
        </div>
      </div>
      {org.status === 'suspended' && (
        <p className="text-xs text-ink-muted">
          An org admin suspended the app — repos from this org are unavailable.
        </p>
      )}
      {memberAccessGap && (
        <p className="text-xs text-warning-text">
          The app is installed on {org.login}, but your GitHub account can't open any of the repos
          it covers. Ask an org owner to give you repository access (via a team or as a
          collaborator), then refresh your repo list.
        </p>
      )}
      {org.status === 'installed' && org.type === 'Organization' && appSlug && (
        <a
          href={installUrl(appSlug, org)}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-indigo-600 font-medium hover:text-indigo-700"
        >
          Manage repo selection →
        </a>
      )}
    </li>
  );
}
