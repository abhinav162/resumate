import type { ResumeData } from '../types';

/**
 * A single bullet-level change produced by the tailoring job. Carries both the
 * original and rewritten text plus a bulletId locator, so the final resume can
 * be reconstructed entirely on the client by choosing one text per change.
 */
export type TailorDiffItem = {
  sectionType: string;
  bulletId: string;
  original: string;
  rewritten: string;
  reason: string;
};

/**
 * bulletId format (see backend aiService prompt):
 *   experience-<expIdx>-<bulletIdx> → experience[expIdx].responsibilities[bulletIdx]
 *   projects-<projIdx>-<bulletIdx>  → projects[projIdx].description[bulletIdx]
 *
 * Note: the editor stores experience bullets as a newline-joined string and
 * project bullets as a string array — this mirrors ResumeEditorContext.
 */
function setBulletText(data: ResumeData, bulletId: string, text: string): void {
  const parts = bulletId.split('-');
  const section = parts[0];
  const sectionIdx = parseInt(parts[1], 10);
  const bulletIdx = parseInt(parts[2], 10);
  if (Number.isNaN(sectionIdx) || Number.isNaN(bulletIdx)) return;

  if (section === 'experience' && data.experience?.[sectionIdx]) {
    const exp = { ...data.experience[sectionIdx] } as { responsibilities?: string[] };
    const bullets = Array.isArray(exp.responsibilities) ? [...exp.responsibilities] : [];
    if (bulletIdx < bullets.length) {
      bullets[bulletIdx] = text;
      exp.responsibilities = bullets;
      data.experience = data.experience.map((e, i) => (i === sectionIdx ? exp : e)) as ResumeData['experience'];
    }
  } else if (section === 'projects' && data.projects?.[sectionIdx]) {
    const proj = { ...data.projects[sectionIdx] } as { description?: string[] };
    const bullets = Array.isArray(proj.description) ? [...proj.description] : [];
    if (bulletIdx < bullets.length) {
      bullets[bulletIdx] = text;
      proj.description = bullets;
      data.projects = data.projects.map((p, i) => (i === sectionIdx ? proj : p)) as ResumeData['projects'];
    }
  }
}

/**
 * Rebuild the resume for a given keep/discard selection. `base` is the fully
 * tailored resume (all rewrites applied); for every discarded change we swap
 * that bullet back to its original text.
 */
export function applySelection(
  base: ResumeData,
  diff: TailorDiffItem[],
  discarded: Set<string>,
): ResumeData {
  const data: ResumeData = structuredClone(base);
  for (const item of diff) {
    if (discarded.has(item.bulletId)) {
      setBulletText(data, item.bulletId, item.original);
    }
  }
  return data;
}

/**
 * Free, instant proportional estimate of the ATS score for the current
 * selection: linearly interpolate the before→after gain by the fraction of
 * changes kept. Indicative only — a true score requires a re-score call.
 */
export function estimateScore(
  beforeScore: number,
  afterScore: number,
  totalChanges: number,
  discardedCount: number,
): number {
  if (totalChanges === 0) return afterScore;
  const keptFraction = (totalChanges - discardedCount) / totalChanges;
  return Math.round(beforeScore + (afterScore - beforeScore) * keptFraction);
}

/** Stable signature of a selection, used to know if a re-score is still valid. */
export function selectionSignature(discarded: Set<string>): string {
  return [...discarded].sort().join('|');
}
