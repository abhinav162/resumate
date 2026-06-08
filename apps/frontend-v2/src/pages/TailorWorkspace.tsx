import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, RotateCw, Check, Undo2, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { ScorePill } from '../components/ui/ScorePill';
import { Badge } from '../components/ui/Badge';
import { RequiresCredits } from '../components/ui/RequiresCredits';
import { ResponsivePreviewCanvas } from '../components/features/editor/ResumePreview';
import type { TailorStatus } from '../lib/api';
import type { ResumeData, TailoredResume } from '../types';
import { useResumes } from '../hooks/useResumes';
import { useScoreResume } from '../hooks/useResumes';
import { useTailorResume, useTailorStatus } from '../hooks/useTailor';
import { useTailoredResume, useTailoredEditorData, useSaveTailoredEditorData } from '../hooks/useTailoredResumes';
import { useCredits } from '../contexts/CreditContext';
import { CREDIT_COSTS } from '../config/pricing';
import {
  applySelection,
  estimateScore,
  selectionSignature,
  type TailorDiffItem,
} from '../lib/tailorSelection';
import { keywordCoverage, resumeToText } from '../lib/keywordMatch';

// The tailored-resume detail endpoint returns these extra fields beyond the
// stored row; they aren't part of the persisted TailoredResume type.
type FullTailored = TailoredResume & {
  diff?: TailorDiffItem[];
  beforeScore?: number;
  afterScore?: number;
  jdKeywords?: string[] | null;
};

type ResumeOption = { id: string; name: string };

const STATUS_LABEL: Record<TailorStatus, string> = {
  PENDING: 'Queued — waiting to start',
  IN_PROGRESS: 'AI is tailoring your resume...',
  COMPLETED: 'Done!',
  FAILED: 'Failed',
};

export default function TailorWorkspace() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [resumeId, setResumeId] = useState(searchParams.get('resumeId') ?? '');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [jobDescription, setJobDescription] = useState('');

  // The job id is the only piece of local state the tailoring flow needs —
  // everything else (status, diff, scores) is derived from cached queries.
  const [tailoredResumeId, setTailoredResumeId] = useState<string | null>(null);
  // The form collapses into a thin rail once tailoring starts, freeing the
  // canvas for the combined preview + changes view.
  const [formCollapsed, setFormCollapsed] = useState(false);
  // Set of discarded change bulletIds (undo). Empty = keep everything.
  const [discarded, setDiscarded] = useState<Set<string>>(new Set());
  // The last manually re-scored value, tagged with the selection it scored so
  // we know whether it's still accurate after further toggling.
  const [lastScored, setLastScored] = useState<{ score: number; signature: string } | null>(null);

  const { data: resumeListData, isLoading: resumesLoading } = useResumes();
  const resumes: ResumeOption[] = (resumeListData ?? []).map((r: { id: string; name?: string }) => ({ id: r.id, name: r.name || 'Untitled' }));

  const tailorMutation = useTailorResume();
  // Declarative polling — stops itself on COMPLETED/FAILED and refreshes credits.
  const { data: status, error: statusError } = useTailorStatus(tailoredResumeId ?? undefined);

  const jobStatus: TailorStatus | null = status?.status ?? tailorMutation.data?.status ?? null;
  const completed = jobStatus === 'COMPLETED';

  // Once completed, load the full tailored resume (diff + scores) and the
  // editor-shaped content (for the live preview).
  const { data: fullTailored } = useTailoredResume(completed ? tailoredResumeId ?? undefined : undefined);
  const { data: editorData } = useTailoredEditorData(completed ? tailoredResumeId ?? undefined : undefined);
  const full = fullTailored as FullTailored | undefined;

  const { mutateAsync: saveTailoredAsync } = useSaveTailoredEditorData();
  const { mutateAsync: scoreAsync, isPending: scoring } = useScoreResume();
  const { refresh: refreshCredits } = useCredits();

  const diff: TailorDiffItem[] = useMemo(() => full?.diff ?? [], [full]);
  const beforeScore = full?.beforeScore ?? status?.beforeScore ?? 0;
  const afterScore = full?.afterScore ?? status?.afterScore ?? 0;

  // Resume rendered in the preview, reflecting the current keep/discard choices.
  const previewData: ResumeData | null = useMemo(() => {
    if (!editorData?.data) return null;
    return applySelection(editorData.data, diff, discarded);
  }, [editorData, diff, discarded]);

  // Live JD keyword coverage of the current selection. Recomputes instantly as
  // changes are kept/discarded (the backend keyword extraction is reused).
  const jdKeywords = useMemo(() => full?.jdKeywords ?? [], [full]);
  const coverage = useMemo(
    () => (previewData && jdKeywords.length ? keywordCoverage(resumeToText(previewData), jdKeywords) : null),
    [previewData, jdKeywords],
  );

  // Score shown in the header. With no discards it's the confirmed after-score;
  // once the user toggles, we show a free estimate (or a confirmed re-score if
  // it still matches the current selection).
  const signature = selectionSignature(discarded);
  const isDirty = discarded.size > 0;
  const confirmedScore = !isDirty
    ? afterScore
    : lastScored?.signature === signature
      ? lastScored.score
      : null;
  const displayScore = confirmedScore ?? estimateScore(beforeScore, afterScore, diff.length, discarded.size);
  const isEstimate = confirmedScore === null;

  const error: string | null = tailorMutation.error
    ? (((tailorMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message) ?? 'Could not start tailoring. Please try again.')
    : jobStatus === 'FAILED'
      ? (status?.errorMessage ?? 'Tailoring failed. Please try again.')
      : statusError
        ? 'Lost connection while checking status. Please refresh.'
        : null;

  const submitting = tailorMutation.isPending;
  // Keep the working state until both the diff and the preview content have
  // loaded, to avoid an idle-screen flash between COMPLETED and the data arriving.
  const finalizing = completed && (!full || !editorData);
  const isWorking = jobStatus === 'PENDING' || jobStatus === 'IN_PROGRESS' || submitting || finalizing;
  const showResult = completed && !!full && !!previewData;

  function handleTailor() {
    setTailoredResumeId(null);
    setDiscarded(new Set());
    setLastScored(null);
    setFormCollapsed(true);
    tailorMutation.reset();
    tailorMutation.mutate(
      { resumeId, jobTitle, company, jobDescription },
      { onSuccess: (data) => setTailoredResumeId(data.tailoredResumeId) },
    );
  }

  function toggleChange(bulletId: string) {
    setDiscarded((prev) => {
      const next = new Set(prev);
      if (next.has(bulletId)) next.delete(bulletId);
      else next.add(bulletId);
      return next;
    });
  }

  async function persistSelection() {
    if (!tailoredResumeId || !previewData) return;
    await saveTailoredAsync({ id: tailoredResumeId, data: previewData });
  }

  async function handleRescore() {
    if (!tailoredResumeId || !previewData) return;
    try {
      // Persist the current selection first so the backend scores what the
      // user actually sees, then re-score it.
      await persistSelection();
      const res = await scoreAsync(tailoredResumeId);
      setLastScored({ score: res.score, signature });
      await refreshCredits();
    } catch (err) {
      alert((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not re-score. Please try again.');
    }
  }

  async function handleOpen() {
    if (!tailoredResumeId) return;
    try {
      await persistSelection();
    } catch {
      // Non-fatal — open the editor anyway; the user can re-save there.
    }
    navigate(`/editor/tailored/${tailoredResumeId}`);
  }

  const formStarted = !!tailoredResumeId || submitting;

  return (
    <div className="flex h-screen bg-paper-bg">
      {/* Left: collapsible input form */}
      {formCollapsed ? (
        <button
          onClick={() => setFormCollapsed(false)}
          className="w-12 shrink-0 border-r border-paper-border bg-paper-surface flex flex-col items-center gap-3 pt-5 text-ink-secondary hover:text-ink-primary transition-colors"
          title="Show tailoring form"
          aria-label="Show tailoring form"
        >
          <ChevronRight size={18} />
          <span className="text-xs font-semibold uppercase tracking-wider [writing-mode:vertical-rl] rotate-180">
            Tailor Resume
          </span>
        </button>
      ) : (
        <div className="w-72 shrink-0 border-r border-paper-border bg-paper-surface p-5 flex flex-col gap-4 overflow-y-auto">
          <div className="flex items-center justify-between">
            <h1 className="font-heading font-bold text-lg text-ink-primary">Tailor Resume</h1>
            {formStarted && (
              <button
                onClick={() => setFormCollapsed(true)}
                className="text-ink-secondary hover:text-ink-primary transition-colors"
                title="Collapse form"
                aria-label="Collapse form"
              >
                <ChevronLeft size={18} />
              </button>
            )}
          </div>

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
      )}

      {/* Right: results */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Idle state */}
        {!showResult && !isWorking && !error && (
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

        {/* Completed: combined preview + changes view */}
        {showResult && previewData && (
          <div className="flex-1 flex min-h-0">
            {/* Live preview reflecting the current selection */}
            <div className="flex-1 min-w-0 flex flex-col border-r border-paper-border">
              <ResponsivePreviewCanvas resumeData={previewData} />
            </div>

            {/* Changes + score panel */}
            <div className="w-[420px] shrink-0 overflow-y-auto custom-scrollbar p-5 space-y-5 bg-paper-surface">
              {/* Score card */}
              <div className="bg-paper-bg border border-paper-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-ink-secondary">ATS Match Score</p>
                  {isEstimate ? (
                    <Badge variant="warning">Estimated · re-score to confirm</Badge>
                  ) : isDirty ? (
                    <Badge variant="success">Confirmed</Badge>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <ScorePill score={beforeScore} />
                  <span className="text-ink-muted">→</span>
                  <span className="flex items-center gap-1">
                    {isEstimate && <span className="text-ink-muted text-sm">~</span>}
                    <ScorePill score={displayScore} size="lg" />
                  </span>
                  <Badge variant={displayScore - beforeScore >= 0 ? 'success' : 'danger'}>
                    {displayScore - beforeScore >= 0 ? '+' : ''}{displayScore - beforeScore} pts
                  </Badge>
                </div>
                {isEstimate && (
                  <RequiresCredits cost={CREDIT_COSTS.RESUME_RESCORE}>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-3 w-full"
                      onClick={handleRescore}
                      loading={scoring}
                    >
                      {!scoring && <RotateCw size={14} />}
                      Re-score — {CREDIT_COSTS.RESUME_RESCORE} credit
                    </Button>
                  </RequiresCredits>
                )}
              </div>

              {/* JD keyword coverage */}
              {coverage && (
                <div className="bg-paper-bg border border-paper-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-ink-secondary">JD Keywords</p>
                    <Badge variant={coverage.missing.length === 0 ? 'success' : 'warning'}>
                      {coverage.matched.length}/{coverage.matched.length + coverage.missing.length} covered
                    </Badge>
                  </div>
                  {coverage.missing.length === 0 ? (
                    <p className="text-xs text-success-text">All JD keywords are present in your resume. 🎉</p>
                  ) : (
                    <>
                      <p className="text-xs text-ink-muted mb-2">
                        Missing — consider adding these (with real evidence):
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {coverage.missing.map((kw) => (
                          <span
                            key={kw}
                            className="text-xs px-2 py-0.5 rounded-full border border-warning-border bg-warning-bg text-warning-text"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* What changed */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-heading font-semibold text-ink-primary flex items-center gap-2">
                    <Sparkles size={16} className="text-indigo-600" />
                    What Changed
                  </h2>
                  <span className="text-xs text-ink-muted">
                    {diff.length - discarded.size}/{diff.length} kept
                  </span>
                </div>

                {diff.length === 0 && (
                  <p className="text-sm text-ink-muted">No bullet-level changes were recorded.</p>
                )}

                {diff.map((item) => {
                  const isDiscarded = discarded.has(item.bulletId);
                  return (
                    <div
                      key={item.bulletId}
                      className={`border rounded-lg p-3 space-y-2 transition-colors ${
                        isDiscarded ? 'border-paper-border bg-paper-bg opacity-60' : 'border-paper-border bg-paper-bg'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="default">{item.sectionType}</Badge>
                        <button
                          onClick={() => toggleChange(item.bulletId)}
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded transition-colors ${
                            isDiscarded
                              ? 'text-indigo-600 hover:bg-indigo-50'
                              : 'text-ink-secondary hover:text-danger-text hover:bg-danger-bg'
                          }`}
                          title={isDiscarded ? 'Keep this change' : 'Discard this change'}
                        >
                          {isDiscarded ? (<><Undo2 size={13} /> Keep</>) : (<><Check size={13} /> Discard</>)}
                        </button>
                      </div>
                      <p className="text-xs text-danger-text line-through leading-relaxed">{item.original}</p>
                      <p className={`text-xs leading-relaxed font-medium ${isDiscarded ? 'text-ink-muted line-through' : 'text-success-text'}`}>
                        {item.rewritten}
                      </p>
                      {!isDiscarded && item.reason && (
                        <p className="text-xs text-ink-muted italic">{item.reason}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              <Button className="w-full" onClick={handleOpen}>
                Open Tailored Resume →
              </Button>
            </div>
          </div>
        )}

        {/* Error-only state (no result, not working) */}
        {error && !isWorking && !showResult && (
          <div className="h-full flex items-center justify-center text-center px-6">
            <p className="text-sm text-danger-text bg-danger-bg border border-danger-border rounded p-3 max-w-md">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
