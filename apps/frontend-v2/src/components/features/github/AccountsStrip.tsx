import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, Plus, RefreshCw, Unplug } from 'lucide-react';
import { githubApi, type GithubAccount, type GithubStatus } from '../../../lib/githubApi';
import { useGithubConnect } from './useGithubConnect';

/**
 * Chip row of connected GitHub accounts (M2.11.2). Each chip opens a small
 * menu with the per-account private-repo preference, reconnect and disconnect
 * actions. Accounts whose repo fetch failed get an amber attention dot. A
 * trailing "+ Add account" chip starts the same OAuth flow while there is
 * room under `maxAccounts`.
 */
export function AccountsStrip({
  status,
  accountErrors,
}: {
  status: GithubStatus;
  /** Per-account fetch errors from the repos query, when available. */
  accountErrors?: { id: number; error: string | null }[];
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const connect = useGithubConnect();

  const errorById = new Map((accountErrors ?? []).map((a) => [a.id, a.error]));
  const canAdd = status.accounts.length < status.maxAccounts;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {status.accounts.map((account) => (
        <AccountChip
          key={account.id}
          account={account}
          needsAttention={Boolean(errorById.get(account.id))}
          open={openId === account.id}
          onToggle={() => setOpenId((prev) => (prev === account.id ? null : account.id))}
          onClose={() => setOpenId(null)}
        />
      ))}
      {canAdd && (
        <button
          type="button"
          onClick={() => connect.mutate()}
          disabled={connect.isPending}
          title="GitHub connects whichever account you're signed into on github.com"
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-dashed border-paper-border-strong rounded-full text-ink-secondary hover:text-ink-primary hover:border-indigo-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Plus size={12} />
          Add account
        </button>
      )}
    </div>
  );
}

/** One account chip + its dropdown menu (plain state, no portal). */
function AccountChip({
  account,
  needsAttention,
  open,
  onToggle,
  onClose,
}: {
  account: GithubAccount;
  needsAttention: boolean;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const connect = useGithubConnect();

  const setPrivate = useMutation({
    mutationFn: (includePrivate: boolean) => githubApi.setPreferences(includePrivate, account.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['github'] });
    },
  });

  const disconnect = useMutation({
    mutationFn: () => githubApi.disconnect(account.id),
    onSuccess: () => {
      onClose();
      queryClient.invalidateQueries({ queryKey: ['github'] });
    },
  });

  const label = account.login ? `@${account.login}` : `Account #${account.id}`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border rounded-full transition-colors ${
          open
            ? 'border-indigo-400 bg-indigo-50 text-indigo-600'
            : 'border-paper-border bg-paper-surface text-ink-primary hover:border-paper-border-strong'
        }`}
      >
        {label}
        {account.includePrivate && <Lock size={10} className="text-ink-muted" />}
        {needsAttention && (
          <span
            className="w-1.5 h-1.5 rounded-full bg-warning-text"
            title="This account needs attention"
          />
        )}
      </button>

      {open && (
        <>
          {/* Invisible backdrop: clicking anywhere else closes the menu. */}
          <div className="fixed inset-0 z-10" onClick={onClose} aria-hidden="true" />
          <div className="absolute left-0 top-full mt-1 z-20 w-60 bg-paper-surface border border-paper-border rounded-lg shadow-elevated p-2 space-y-1">
            <label className="flex items-start gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-paper-bg">
              <input
                type="checkbox"
                checked={account.includePrivate}
                disabled={setPrivate.isPending}
                onChange={(e) => setPrivate.mutate(e.target.checked)}
                className="mt-0.5 accent-indigo-600"
              />
              <span className="text-xs text-ink-secondary">
                Include private repos
                <span className="block text-ink-muted">
                  READMEs of selected private repos are sent for AI analysis.
                </span>
              </span>
            </label>
            {setPrivate.isError && (
              <p className="px-2 text-xs text-danger-text">Could not save. Please try again.</p>
            )}
            <button
              type="button"
              onClick={() => connect.mutate()}
              disabled={connect.isPending}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-ink-secondary rounded hover:bg-paper-bg hover:text-ink-primary transition-colors disabled:opacity-60"
            >
              <RefreshCw size={12} />
              Reconnect
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Disconnect ${label}? Its repos will disappear from listings.`))
                  disconnect.mutate();
              }}
              disabled={disconnect.isPending}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-danger-text rounded hover:bg-danger-bg transition-colors disabled:opacity-60"
            >
              <Unplug size={12} />
              Disconnect
            </button>
            {disconnect.isError && (
              <p className="px-2 text-xs text-danger-text">Could not disconnect. Please try again.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
