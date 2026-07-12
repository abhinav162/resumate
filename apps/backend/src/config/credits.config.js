export const CREDIT_COSTS = {
  RESUME_SCORE: 1,
  RESUME_RESCORE: 1,
  RESUME_TAILOR: 2,
  // Per-repo GitHub analysis beyond the free allowance. Fractional — SQLite's
  // flexible typing stores REAL values in the INTEGER `credits` column.
  GITHUB_REPO: 0.2,
};

// First N user-selected repos are analyzed free; after that GITHUB_REPO applies.
export const GITHUB_FREE_REPOS = 10;
