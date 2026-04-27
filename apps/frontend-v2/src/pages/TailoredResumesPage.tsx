import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { ScorePill } from '../components/ui/ScorePill';
import { Badge } from '../components/ui/Badge';
import { tailoredResumesApi } from '../lib/api';
import type { TailorStatus } from '../lib/api';

type TailoredItem = {
  id: string;
  jobDetails: { jobTitle: string; company: string; description: string };
  status: TailorStatus;
  errorMessage: string | null;
  beforeScore: number | null;
  afterScore: number | null;
  createdAt: string;
  updatedAt: string;
};

const STATUS_STYLES: Record<TailorStatus, { variant: any; label: string }> = {
  PENDING: { variant: 'default', label: 'Queued' },
  IN_PROGRESS: { variant: 'default', label: 'In progress' },
  COMPLETED: { variant: 'success', label: 'Completed' },
  FAILED: { variant: 'danger', label: 'Failed' },
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function TailoredResumesPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<TailoredItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollTimer = useRef<number | null>(null);

  async function load() {
    try {
      const data = await tailoredResumesApi.getTailoredResumes();
      setItems(data as any);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to load tailored resumes.');
    } finally {
      setLoading(false);
    }
  }

  // Initial load + cleanup
  useEffect(() => {
    load();
    return () => {
      if (pollTimer.current) window.clearTimeout(pollTimer.current);
    };
  }, []);

  // Auto-refresh every 5 seconds while any job is still in flight
  useEffect(() => {
    const hasInflight = items.some(i => i.status === 'PENDING' || i.status === 'IN_PROGRESS');
    if (!hasInflight) {
      if (pollTimer.current) {
        window.clearTimeout(pollTimer.current);
        pollTimer.current = null;
      }
      return;
    }
    pollTimer.current = window.setTimeout(load, 5000);
    return () => {
      if (pollTimer.current) {
        window.clearTimeout(pollTimer.current);
        pollTimer.current = null;
      }
    };
  }, [items]);

  async function handleDelete(id: string) {
    if (!confirm('Delete this tailored resume? This cannot be undone.')) return;
    try {
      await tailoredResumesApi.deleteTailoredResume(id);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Could not delete tailored resume.');
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading font-bold text-2xl text-ink-primary flex items-center gap-2">
            <Layers size={22} className="text-indigo-600" />
            Tailored Resumes
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            All resumes you've tailored for specific job descriptions.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="mb-4 text-sm text-danger-text bg-danger-bg border border-danger-border rounded p-3">
          {error}
        </div>
      )}

      {loading && items.length === 0 && (
        <p className="text-sm text-ink-muted">Loading...</p>
      )}

      {!loading && items.length === 0 && (
        <div className="text-center py-16 border border-dashed border-paper-border rounded-xl">
          <Layers size={32} className="mx-auto text-ink-muted mb-3" />
          <p className="font-heading font-semibold text-ink-primary mb-1">No tailored resumes yet</p>
          <p className="text-sm text-ink-muted mb-4">
            Head to the Tailor page to create your first one.
          </p>
          <Button onClick={() => navigate('/tailor')} size="sm">
            Go to Tailor
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {items.map(item => {
          const statusMeta = STATUS_STYLES[item.status] ?? STATUS_STYLES.COMPLETED;
          const isWorking = item.status === 'PENDING' || item.status === 'IN_PROGRESS';
          const canOpen = item.status === 'COMPLETED';
          return (
            <div
              key={item.id}
              className="bg-paper-surface border border-paper-border rounded-xl p-4 flex items-center gap-4 hover:border-paper-border-strong transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-heading font-semibold text-ink-primary truncate">
                    {item.jobDetails.jobTitle || 'Untitled role'}
                  </h3>
                  <span className="text-ink-muted">·</span>
                  <span className="text-sm text-ink-secondary truncate">
                    {item.jobDetails.company || 'Unknown company'}
                  </span>
                  <Badge variant={statusMeta.variant}>
                    {isWorking && (
                      <span className="inline-block w-2 h-2 mr-1 rounded-full bg-current animate-pulse" />
                    )}
                    {statusMeta.label}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-ink-muted">
                  <span>Created {formatDate(item.createdAt)}</span>
                  {item.status === 'COMPLETED' && item.beforeScore != null && item.afterScore != null && (
                    <span className="flex items-center gap-1.5">
                      <ScorePill score={item.beforeScore} size="sm" />
                      →
                      <ScorePill score={item.afterScore} size="sm" />
                    </span>
                  )}
                  {item.status === 'FAILED' && item.errorMessage && (
                    <span className="text-danger-text truncate max-w-md">{item.errorMessage}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!canOpen}
                  onClick={() => navigate(`/editor/${item.id}`)}
                >
                  Open
                </Button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-2 text-ink-muted hover:text-danger-text rounded transition-colors"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
