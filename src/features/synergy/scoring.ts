export const SYNERGY_BASE_SUBMISSION = 5;
export const SYNERGY_PROOF_GITHUB = 5;
export const SYNERGY_PROOF_LINKEDIN = 5;

/** Rank is 1-based order of submittedAt among submissions for the same
 *  (challengeId, dayNumber). Lower rank (earlier) = more synergy. */
export function rankBonus(rank: number): number {
  if (rank <= 1) return 10;
  if (rank <= 3) return 8;
  if (rank <= 10) return 6;
  if (rank <= 25) return 5;
  return 2;
}

export function computeSubmissionSynergy(input: {
  rank: number;
  hasGithub: boolean;
  hasLinkedin: boolean;
}): { points: number; rankBonus: number } {
  const rb = rankBonus(input.rank);
  const points =
    SYNERGY_BASE_SUBMISSION +
    rb +
    (input.hasGithub ? SYNERGY_PROOF_GITHUB : 0) +
    (input.hasLinkedin ? SYNERGY_PROOF_LINKEDIN : 0);
  return { points, rankBonus: rb };
}
