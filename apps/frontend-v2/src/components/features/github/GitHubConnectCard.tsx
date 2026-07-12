import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Github } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { githubApi } from '../../../lib/githubApi';

/**
 * Dashboard card for the GitHub integration.
 *
 * Not connected: pitch + "Connect GitHub" button that redirects to the OAuth
 * URL. Connected: shows the login, remaining free repo analyses, and a
 * two-step disconnect (first click arms, second confirms). A status fetch
 * error is treated as "not connected" so the card never crashes the dashboard.
 */
export function GitHubConnectCard({ className = '' }: { className?: string }) {
  const queryClient = useQueryClient();
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

  const { data: status, isLoading } = useQuery({
    queryKey: ['github', 'status'],
    queryFn: githubApi.getStatus,
  });

  const connect = useMutation({
    mutationFn: githubApi.getConnectUrl,
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });

  const disconnect = useMutation({
    mutationFn: githubApi.disconnect,
    onSuccess: () => {
      setConfirmingDisconnect(false);
      queryClient.invalidateQueries({ queryKey: ['github'] });
    },
  });

  if (isLoading) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="h-16 bg-paper-border rounded animate-pulse" />
      </Card>
    );
  }

  // A failed status fetch leaves `status` undefined — render the
  // not-connected state rather than crashing.
  if (!status?.connected) {
    return (
      <Card className={`p-4 space-y-3 ${className}`}>
        <div className="flex items-center gap-2">
          <Github size={18} className="text-ink-primary" />
          <p className="font-heading font-semibold text-ink-primary">GitHub</p>
        </div>
        <p className="text-sm text-ink-secondary">
          Import projects and ground your resume in real contributions.
        </p>
        <Button size="sm" loading={connect.isPending} onClick={() => connect.mutate()}>
          <Github size={14} />
          Connect GitHub
        </Button>
      </Card>
    );
  }

  return (
    <Card className={`p-4 space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Github size={18} className="text-ink-primary" />
          <p className="font-heading font-semibold text-ink-primary">@{status.login}</p>
          <span className="w-2 h-2 rounded-full bg-success-text" title="Connected" />
        </div>
        {confirmingDisconnect ? (
          <Button
            size="sm"
            variant="danger"
            loading={disconnect.isPending}
            onClick={() => disconnect.mutate()}
            onBlur={() => setConfirmingDisconnect(false)}
          >
            Confirm disconnect?
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirmingDisconnect(true)}>
            Disconnect
          </Button>
        )}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-muted">
          {status.freeReposLeft} free repo {status.freeReposLeft === 1 ? 'analysis' : 'analyses'} left
        </p>
        <Link to="/github" className="text-xs text-indigo-600 font-medium hover:text-indigo-700">
          Manage projects →
        </Link>
      </div>
    </Card>
  );
}
