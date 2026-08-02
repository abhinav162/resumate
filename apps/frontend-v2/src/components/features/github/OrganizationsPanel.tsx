import { useQuery } from '@tanstack/react-query';
import { Badge } from '../../ui/Badge';
import { Card } from '../../ui/Card';
import { githubApi, type GithubOrgAccess } from '../../../lib/githubApi';

/**
 * "Organizations & access" panel (M2.10). Lists the user's personal account
 * plus every organization they belong to, with the GitHub App's install state
 * there. Orgs without the app installed get an install/request deep-link —
 * private repos from an org only become listable once the app is installed
 * (org owners may need to approve the request).
 */
export function OrganizationsPanel({ connected }: { connected: boolean }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['github', 'orgs'],
    queryFn: githubApi.getOrgs,
    enabled: connected,
  });

  const orgs = data?.orgs ?? [];
  const appSlug = data?.appSlug ?? null;

  return (
    <Card className="p-4 space-y-3">
      <div>
        <h2 className="font-heading font-semibold text-ink-primary">Organizations &amp; access</h2>
        <p className="text-xs text-ink-muted mt-0.5">
          Private repositories from an organization appear only after the app is installed there —
          org owners may need to approve the request.
        </p>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-10 bg-paper-border rounded animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-xs text-danger-text">
          Could not load your organizations. Please try again.
        </p>
      )}

      {!isLoading && !isError && (
        <ul className="divide-y divide-paper-border">
          {orgs.map((org) => (
            <OrgRow key={org.login} org={org} appSlug={appSlug} />
          ))}
          {orgs.length === 0 && (
            <li className="py-2 text-xs text-ink-muted">No organizations found.</li>
          )}
        </ul>
      )}
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
  return (
    <li className="py-2 space-y-1">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-sm text-ink-primary truncate">{org.login}</span>
          {org.type === 'User' && <span className="text-xs text-ink-muted">Personal account</span>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
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
    </li>
  );
}
