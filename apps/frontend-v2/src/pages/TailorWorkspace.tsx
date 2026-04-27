import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { ScorePill } from '../components/ui/ScorePill';
import { Badge } from '../components/ui/Badge';
import { RequiresCredits } from '../components/ui/RequiresCredits';
import { aiApi, resumesApi, tailoredResumesApi } from '../lib/api';
import type { TailorStatus } from '../lib/api';
import { useCredits } from '../contexts/CreditContext';
import { CREDIT_COSTS } from '../config/pricing';

type TailorResult = {
  tailoredResumeId: string;
  diff: { sectionType: string; bulletId: string; original: string; rewritten: string; reason: string }[];
  beforeScore: number;
  afterScore: number;
};

type ResumeOption = { id: string; name: string };

const POLL_INTERVAL_MS = 3000;
const STATUS_LABEL: Record<TailorStatus, string> = {
  PENDING: 'Queued — waiting to start',
  IN_PROGRESS: 'AI is tailoring your resume...',
  COMPLETED: 'Done!',
  FAILED: 'Failed',
};

export default function TailorWorkspace() {
  const [searchParams] = useSearchParams();
  const [resumeId, setResumeId] = useState(searchParams.get('resumeId') ?? '');
  const [resumes, setResumes] = useState<ResumeOption[]>([]);
  const [resumesLoading, setResumesLoading] = useState(true);
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [jobStatus, setJobStatus] = useState<TailorStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TailorResult | null>(null);
  const pollTimer = useRef<number | null>(null);
  const { refresh } = useCredits();

  useEffect(() => {
    resumesApi.getAll().then((data) => {
      setResumes(data.map((r: any) => ({ id: r.id, name: r.name || 'Untitled' })));
    }).catch(() => {}).finally(() => setResumesLoading(false));
  }, []);

  // Cleanup any in-flight poll on unmount
  useEffect(() => {
    return () => {
      if (pollTimer.current) window.clearTimeout(pollTimer.current);
    };
  }, []);

  function stopPolling() {
    if (pollTimer.current) {
      window.clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }

  async function pollUntilDone(tailoredResumeId: string) {
    try {
      const status = await aiApi.getTailorStatus(tailoredResumeId);
      setJobStatus(status.status);

      if (status.status === 'COMPLETED') {
        // Fetch the full tailored resume (with diff) from the dedicated endpoint
        const full = await tailoredResumesApi.getTailoredResume(tailoredResumeId);
        const fullAny = full as any;
        setResult({
          tailoredResumeId,
          diff: fullAny.diff ?? [],
          beforeScore: fullAny.beforeScore ?? status.beforeScore ?? 0,
          afterScore: fullAny.afterScore ?? status.afterScore ?? 0,
        });
        await refresh();
        stopPolling();
        return;
      }

      if (status.status === 'FAILED') {
        setError(status.errorMessage ?? 'Tailoring failed. Please try again.');
        stopPolling();
        return;
      }

      // Still PENDING or IN_PROGRESS — schedule next poll
      pollTimer.current = window.setTimeout(() => pollUntilDone(tailoredResumeId), POLL_INTERVAL_MS);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Lost connection while checking status. Please refresh.');
      stopPolling();
    }
  }

  async function handleTailor() {
    setSubmitting(true);
    setError(null);
    setResult(null);
    setJobStatus(null);
    try {
      const data = await aiApi.tailorResume({ resumeId, jobTitle, company, jobDescription });
      setJobStatus(data.status);
      // Start polling for completion
      pollUntilDone(data.tailoredResumeId);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Could not start tailoring. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const isWorking = jobStatus === 'PENDING' || jobStatus === 'IN_PROGRESS' || submitting;

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
