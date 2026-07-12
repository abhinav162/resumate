import { techProfile } from './profile.js';

/**
 * Builds a compact, verified-evidence block for the tailoring prompt (M2.6).
 *
 * Input is the user's CACHED GitHub data only — the normalized profile payload
 * (github_profiles.data) and their analyzed repo summaries — so tailoring never
 * makes GitHub network calls and works even when the token has expired.
 * Returns a plain-text block, or null when there is nothing worth injecting.
 */
export function buildGithubEvidence(profile, summaries = [], { maxRepos = 5, maxChars = 1500 } = {}) {
  if (!profile || !Array.isArray(profile.repos) || profile.repos.length === 0) return null;

  const lines = [];

  const { languages } = techProfile(profile.repos);
  if (languages.length) {
    lines.push(
      `Top languages (weighted by recent activity): ${languages
        .slice(0, 6)
        .map((l) => `${l.name} (${l.percent}%)`)
        .join(', ')}`
    );
  }

  const c = profile.contributions;
  if (c && (c.commits || c.prs || c.reviews)) {
    lines.push(
      `Contributions (last year): ${c.commits ?? 0} commits, ${c.prs ?? 0} pull requests, ${c.reviews ?? 0} code reviews`
    );
  }

  // Prefer repos the user explicitly analyzed — those carry grounded bullets.
  const byRepoId = new Map(profile.repos.map((r) => [r.id, r]));
  const analyzed = summaries
    .map((s) => ({ ...s, repo: byRepoId.get(s.repoId) }))
    .slice(0, maxRepos);

  if (analyzed.length) {
    lines.push('Notable projects (from the candidate\'s real repositories):');
    for (const { repoName, bullets, repo } of analyzed) {
      const meta = repo
        ? ` (★${repo.stars}${repo.primaryLanguage ? `, ${repo.primaryLanguage}` : ''})`
        : '';
      lines.push(`- ${repoName}${meta}`);
      for (const b of (bullets ?? []).slice(0, 3)) lines.push(`  • ${b}`);
    }
  }

  if (!lines.length) return null;
  const text = lines.join('\n');
  return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
}
