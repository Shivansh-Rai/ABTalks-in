export const SYNERGY_BASE_SUBMISSION = 10;
export const SYNERGY_PROOF_GITHUB = 5;
export const SYNERGY_PROOF_LINKEDIN = 8;
export const SYNERGY_REFERRAL = 3;

export function computeSubmissionSynergy(input: {
  hasGithub: boolean;
  hasLinkedin: boolean;
}): { points: number } {
  const points =
    SYNERGY_BASE_SUBMISSION +
    (input.hasGithub ? SYNERGY_PROOF_GITHUB : 0) +
    (input.hasLinkedin ? SYNERGY_PROOF_LINKEDIN : 0);
  return { points };
}
