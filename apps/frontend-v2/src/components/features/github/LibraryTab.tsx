import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { githubApi, type GithubSummaryEntry } from '../../../lib/githubApi';
import { resumesApi } from '../../../lib/api';
import { useUpdateResume } from '../../../hooks/useResumes';
import { timeAgo } from './repoPricing';

/** Raw list shape from useResumes — only what the picker needs. */
type ResumeListItem = { id: string; name: string };

type LibraryFilter = 'all' | 'stale' | 'inResume';

const FILTER_CHIPS: { id: LibraryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'stale', label: 'Needs re-analysis' },
  { id: 'inResume', label: 'In a resume' },
];

/**
 * "Library" tab of /github: previously analyzed repos with their generated
 * bullets. Client-side search (repo name + bullet text) and filter chips,
 * rendered as a responsive card grid. Stale entries offer a free re-analysis
 * and each entry can be appended to any existing resume.
 */
export function LibraryTab({
  resumes,
  onGoToBrowse,
}: {
  resumes: ResumeListItem[];
  onGoToBrowse: () => void;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<LibraryFilter>('all');

  const { data: library, isLoading } = useQuery({
    queryKey: ['github', 'summaries'],
    queryFn: githubApi.getSummaries,
  });

  const entries = library?.summaries ?? [];
  const query = search.trim().toLowerCase();
  const filtered = entries.filter((entry) => {
    if (filter === 'stale' && !entry.stale) return false;
    if (filter === 'inResume' && entry.inResumes.length === 0) return false;
    if (!query) return true;
    return (
      entry.repoName.toLowerCase().includes(query) ||
      entry.bullets.some((b) => b.toLowerCase().includes(query))
    );
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-40 bg-paper-border rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <Card className="p-8 text-center space-y-2">
        <p className="text-sm text-ink-secondary">No analyzed repos yet.</p>
        <p className="text-xs text-ink-muted">
          Pick repositories in the Browse tab to build your project library.
        </p>
        <Button size="sm" variant="secondary" onClick={onGoToBrowse}>
          Browse repos →
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search + filter chips */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search repos or bullets…"
            className="w-full text-sm border border-paper-border rounded pl-8 pr-3 py-1.5 bg-paper-surface text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setFilter(chip.id)}
              className={`px-2.5 py-1 text-xs font-medium border rounded-full transition-colors ${
                filter === chip.id
                  ? 'border-indigo-400 bg-indigo-50 text-indigo-600'
                  : 'border-paper-border bg-paper-surface text-ink-secondary hover:border-paper-border-strong'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-muted">
          No library entries match your search.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((entry) => (
            <LibraryCard key={entry.repoId} entry={entry} resumes={resumes} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * One library entry: generated bullets (first two, with an expander),
 * staleness state (with a free re-analysis action), and an add-to-resume
 * picker.
 */
function LibraryCard({
  entry,
  resumes,
}: {
  entry: GithubSummaryEntry;
  resumes: ResumeListItem[];
}) {
  const queryClient = useQueryClient();
  const updateResume = useUpdateResume();
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addedTo, setAddedTo] = useState<string | null>(null);
  const [addError, setAddError] = useState(false);

  const reanalyze = useMutation({
    mutationFn: () => githubApi.analyzeRepos([entry.repoId]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['github'] });
      queryClient.invalidateQueries({ queryKey: ['credits'] });
    },
  });

  // Resumes that already contain this repo — shown as "Added" and not clickable.
  const inResumeIds = new Set(entry.inResumes.map((r) => r.id));

  // Fetch the full resume, append the library project, and save it back.
  // The whole resume is sent (not just `projects`) so no fields are dropped.
  const handleAdd = async (resume: ResumeListItem) => {
    setAdding(true);
    setAddedTo(null);
    setAddError(false);
    try {
      const full = await resumesApi.getResume(resume.id);
      const projects = [
        ...(full.projects ?? []),
        {
          name: entry.project.name,
          url: entry.project.url,
          repoUrl: entry.project.repoUrl,
          description: entry.project.description,
          githubRepoId: entry.repoId,
        },
      ];
      await updateResume.mutateAsync({ id: resume.id, data: { ...full, projects } });
      setAddedTo(resume.name);
      // Refresh the usage map so this resume shows up as "Added" right away.
      queryClient.invalidateQueries({ queryKey: ['github', 'summaries'] });
    } catch {
      setAddError(true);
    } finally {
      setAdding(false);
    }
  };

  const visibleBullets = expanded ? entry.bullets : entry.bullets.slice(0, 2);
  const hiddenCount = entry.bullets.length - 2;

  return (
    <Card className="p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-heading font-semibold text-sm text-ink-primary truncate">
            {entry.repoName}
          </span>
          {entry.stale ? (
            <Badge variant="warning">Repo updated</Badge>
          ) : (
            <Badge variant="success">cached · free</Badge>
          )}
        </div>
        <span className="text-xs text-ink-muted shrink-0">analyzed {timeAgo(entry.createdAt)}</span>
      </div>

      {/* Origin line: source account + resume usage */}
      {(entry.accountLogin || entry.inResumes.length > 0) && (
        <p className="text-xs text-ink-muted -mt-1">
          {entry.accountLogin && <span>@{entry.accountLogin}</span>}
          {entry.accountLogin && entry.inResumes.length > 0 && ' · '}
          {entry.inResumes.length > 0 && (
            <span title={entry.inResumes.map((r) => r.name).join(', ')}>
              in {entry.inResumes.length} {entry.inResumes.length === 1 ? 'resume' : 'resumes'}
            </span>
          )}
        </p>
      )}

      <div className="flex-1 space-y-1">
        <ul className="space-y-1 list-disc list-inside">
          {visibleBullets.map((bullet, i) => (
            <li key={i} className="text-xs text-ink-secondary">
              {bullet}
            </li>
          ))}
        </ul>
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="text-xs text-indigo-600 font-medium hover:text-indigo-700"
          >
            {expanded ? 'Show less' : `Show ${hiddenCount} more`}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 pt-1 flex-wrap">
        {entry.stale && (
          <Button
            size="sm"
            variant="secondary"
            loading={reanalyze.isPending}
            onClick={() => reanalyze.mutate()}
          >
            Re-analyze (free)
          </Button>
        )}
        {resumes.length > 0 ? (
          <select
            value=""
            disabled={adding}
            onChange={(e) => {
              const resume = resumes.find((r) => r.id === e.target.value);
              if (resume) void handleAdd(resume);
            }}
            className="text-xs font-medium border border-paper-border rounded px-2 py-1.5 bg-paper-bg text-ink-secondary hover:border-paper-border-strong focus:outline-none focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            aria-label={`Add ${entry.repoName} to a resume`}
          >
            <option value="" disabled>
              {adding ? 'Adding…' : 'Add to resume…'}
            </option>
            {resumes.map((r) => (
              <option key={r.id} value={r.id} disabled={inResumeIds.has(r.id)}>
                {inResumeIds.has(r.id) ? `${r.name} · Added` : r.name}
              </option>
            ))}
          </select>
        ) : (
          <Link
            to="/upload"
            className="text-xs text-indigo-600 font-medium hover:text-indigo-700"
          >
            Upload a resume to add this project →
          </Link>
        )}
        {addedTo && <span className="text-xs text-success-text">Added to {addedTo}</span>}
        {addError && (
          <span className="text-xs text-danger-text">Could not add project. Please try again.</span>
        )}
        {reanalyze.isError && (
          <span className="text-xs text-danger-text">Re-analysis failed. Please try again.</span>
        )}
      </div>
    </Card>
  );
}
