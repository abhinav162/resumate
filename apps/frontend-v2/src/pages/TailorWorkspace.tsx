import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { ScorePill } from '../components/ui/ScorePill';
import { Badge } from '../components/ui/Badge';
import { RequiresCredits } from '../components/ui/RequiresCredits';
import type { TailorStatus } from '../lib/api';
import type { TailoredResume } from '../types';
import { useResumes } from '../hooks/useResumes';
import { useTailorResume, useTailorStatus } from '../hooks/useTailor';
import { useTailoredResume } from '../hooks/useTailoredResumes';
import { CREDIT_COSTS } from '../config/pricing';

type TailorResult = {
  tailoredResumeId: string;
  diff: { sectionType: string; bulletId: string; original: string; rewritten: string; reason: string }[];
  beforeScore: number;
  afterScore: number;
};

// The tailored-resume detail endpoint returns these extra fields beyond the
// stored row; they aren't part of the persisted TailoredResume type.
type FullTailored = TailoredResume & {
  diff?: TailorResult['diff'];
  beforeScore?: number;
  afterScore?: number;
};

type ResumeOption = { id: string; name: string };

const STATUS_LABEL: Record<TailorStatus, string> = {
  PENDING: 'Queued — waiting to start',
  IN_PROGRESS: 'AI is tailoring your resume...',
  COMPLETED: 'Done!',
  FAILED: 'Failed',
};

export default function TailorWorkspace() {
  const [searchParams] = useSearchParams();
  const [resumeId, setResumeId] = useState(searchParams.get('resumeId') ?? '');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  // The job id is the only piece of local state the tailoring flow needs —
  // everything else (status, diff, scores) is derived from cached queries.
  const [tailoredResumeId, setTailoredResumeId] = useState<string | null>(null);

  const { data: resumeData, isLoading: resumesLoading } = useResumes();
  const resumes: ResumeOption[] = (resumeData ?? []).map((r: { id: string; name?: string }) => ({ id: r.id, name: r.name || 'Untitled' }));

  const tailorMutation = useTailorResume();
  // Declarative polling — stops itself on COMPLETED/FAILED and refreshes credits.
  const { data: status, error: statusError } = useTailorStatus(tailoredResumeId ?? undefined);

  // Live poll value, falling back to the mutation's initial response before
  // the first poll lands.
  const jobStatus: TailorStatus | null = status?.status ?? tailorMutation.data?.status ?? null;
  const completed = jobStatus === 'COMPLETED';

  // Once completed, load the full tailored resume (diff + before/after scores).
  const { data: fullTailored } = useTailoredResume(completed ? tailoredResumeId ?? undefined : undefined);
  const full = fullTailored as FullTailored | undefined;

  const result: TailorResult | null = completed && full && tailoredResumeId
    ? {
        tailoredResumeId,
        diff: full.diff ?? [],
        beforeScore: full.beforeScore ?? status?.beforeScore ?? 0,
        afterScore: full.afterScore ?? status?.afterScore ?? 0,
      }
    : null;

  const error: string | null = tailorMutation.error
    ? (((tailorMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message) ?? 'Could not start tailoring. Please try again.')
    : jobStatus === 'FAILED'
      ? (status?.errorMessage ?? 'Tailoring failed. Please try again.')
      : statusError
        ? 'Lost connection while checking status. Please refresh.'
        : null;

  const submitting = tailorMutation.isPending;
  // Keep the working state until the full result has loaded, to avoid an
  // idle-screen flash between COMPLETED and the diff arriving.
  const finalizing = completed && !full;
  const isWorking = jobStatus === 'PENDING' || jobStatus === 'IN_PROGRESS' || submitting || finalizing;

  function handleTailor() {
    setTailoredResumeId(null);
    tailorMutation.reset();
    tailorMutation.mutate(
      { resumeId, jobTitle, company, jobDescription },
      { onSuccess: (data) => setTailoredResumeId(data.tailoredResumeId) },
    );
  }

  return (
    <div className="flex h-screen bg-paper-bg">
      {/* Left: Input */}
      <div className="w-72 shrink-0 border-r border-paper-border bg-paper-surface p-5 flex flex-col gap-4">
        <h1 className="font-heading font-bold text-lg text-ink-primary">Tailor Resume</h1>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Resume</label>
          <select
            className="w-full border border-paper-border rounded px-3 py-2 text-sm text-ink-primary bg-paper-bg focus:outline-none focus:border-indigo-400"
            value={resumeId}
            onChange={e => setResumeId(e.target.value)}
            disabled={isWorking}
          >
            <option value="">{resumesLoading ? 'Loading...' : 'Select a resume'}</option>
            {resumes.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Job Title</label>
          <input
            className="w-full border border-paper-border rounded px-3 py-2 text-sm text-ink-primary bg-paper-bg focus:outline-none focus:border-indigo-400"
            placeholder="e.g. Software Engineer"
            value={jobTitle}
            onChange={e => setJobTitle(e.target.value)}
            disabled={isWorking}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Company</label>
          <input
            className="w-full border border-paper-border rounded px-3 py-2 text-sm text-ink-primary bg-paper-bg focus:outline-none focus:border-indigo-400"
            placeholder="e.g. Google"
            value={company}
            onChange={e => setCompany(e.target.value)}
            disabled={isWorking}
          />
        </div>

        <div className="flex-1 space-y-1">
          <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Job Description</label>
          <textarea
            className="w-full h-40 border border-paper-border rounded px-3 py-2 text-sm text-ink-primary bg-paper-bg focus:outline-none focus:border-indigo-400 resize-none"
            placeholder="Paste the job description..."
            value={jobDescription}
            onChange={e => setJobDescription(e.target.value)}
            disabled={isWorking}
          />
        </div>

        {error && <p className="text-xs text-danger-text bg-danger-bg border border-danger-border rounded p-2">{error}</p>}

        <RequiresCredits cost={CREDIT_COSTS.RESUME_TAILOR}>
          <Button
            className="w-full"
            size="lg"
            onClick={handleTailor}
            loading={isWorking}
            disabled={!resumeId || !jobTitle || !company || !jobDescription || isWorking}
          >
            {isWorking ? 'Tailoring...' : '✨ Tailor — 2 credits'}
          </Button>
        </RequiresCredits>
      </div>

      {/* Right: Results */}
      <div className="flex-1 p-6 overflow-y-auto">
        {/* Idle state */}
        {!result && !isWorking && !error && (
          <div className="h-full flex items-center justify-center text-center">
            <div className="space-y-2">
              <p className="text-3xl">✨</p>
              <p className="font-heading font-semibold text-ink-primary">Results will appear here</p>
              <p className="text-sm text-ink-muted">Fill in the form and click Tailor</p>
            </div>
          </div>
        )}

        {/* Working state */}
        {isWorking && (
          <div className="h-full flex items-center justify-center text-center">
            <div className="space-y-3 max-w-sm">
              <div className="inline-block w-10 h-10 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              <p className="font-heading font-semibold text-ink-primary">
                {jobStatus ? STATUS_LABEL[jobStatus] : 'Submitting...'}
              </p>
              <p className="text-sm text-ink-muted">
                This usually takes 30–60 seconds. You can leave this page and check the
                "Tailored Resumes" tab to track progress — your work is saved.
              </p>
            </div>
          </div>
        )}

        {/* Completed state */}
        {result && jobStatus === 'COMPLETED' && (
          <div className="space-y-6 max-w-2xl">
            <div className="bg-paper-surface border border-paper-border rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-ink-secondary mb-1">ATS Match Score</p>
                <div className="flex items-center gap-3">
                  <ScorePill score={result.beforeScore} />
                  <span className="text-ink-muted">→</span>
                  <ScorePill score={result.afterScore} size="lg" />
                  <Badge variant="success">+{result.afterScore - result.beforeScore} pts</Badge>
                </div>
              </div>
              <Button size="sm" variant="secondary" onClick={() => window.location.href = `/editor/tailored/${result.tailoredResumeId}`}>
                Open Tailored Resume →
              </Button>
            </div>

            <div className="space-y-3">
              <h2 className="font-heading font-semibold text-ink-primary">What Changed</h2>
              {result.diff.length === 0 && (
                <p className="text-sm text-ink-muted">No bullet-level changes were recorded.</p>
              )}
              {result.diff.map((item, i) => (
                <div key={i} className="bg-paper-surface border border-paper-border rounded-lg p-4 space-y-2">
                  <Badge variant="default">{item.sectionType}</Badge>
                  <p className="text-xs text-danger-text line-through leading-relaxed">{item.original}</p>
                  <p className="text-xs text-success-text leading-relaxed font-medium">{item.rewritten}</p>
                  <p className="text-xs text-ink-muted italic">{item.reason}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
