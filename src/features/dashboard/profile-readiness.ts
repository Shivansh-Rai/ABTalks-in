import { phoneSchema } from "@/lib/validations/phone";
import type { ProfileCompleteness } from "@/features/profile/completeness";
import type { CandidateDetail } from "@/repositories/candidate-detail";

/**
 * When the dashboard road unlocks.
 *
 * Profile strength is a 0–100 UX number (see `features/profile/completeness`)
 * and the last stretch of it is a long tail: gender, state, awards, a live demo
 * link. Holding the whole hub hostage to 100% means nobody ever gets past the
 * first tile, so the bar is 70%.
 *
 * 70% on its own is not enough, though. Eight of those points are free (empty
 * certifications and empty preferences both score full credit), so a profile
 * with no name, no phone and no headline can cross 70 on projects and
 * education alone — and arrive in front of a recruiter unreachable. The gate is
 * therefore 70% **and** the short list of details that carry the most weight
 * for a recruiter, which is what "high-importance first" means here.
 *
 * This reads the score; it never changes it.
 */

/** Profile strength needed to move along the road. */
export const PROFILE_READY_SCORE = 70;

export type ProfileReadiness = {
  /** The road is open: the bar is cleared and nothing essential is missing. */
  ready: boolean;
  /**
   * Essential details still missing, most valuable first and named the way the
   * profile wizard names them. Empty does not mean ready — the 70% still has
   * to be there.
   */
  blocking: string[];
};

function filled(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * The details a candidate cannot skip, whatever the percentage says: who they
 * are, how to reach them, where they are, what they can do, and one settled
 * history section. Ordered by what a recruiter reads first.
 */
function essentials(
  detail: CandidateDetail,
  completeness: ProfileCompleteness,
): { label: string; met: boolean }[] {
  const complete = (key: string): boolean =>
    completeness.sections.find((s) => s.key === key)?.complete ?? false;
  const claimedSkills = new Set(
    detail.skills.filter((s) => s.claimedByCandidate).map((s) => s.skillId),
  ).size;

  return [
    { label: "Headline", met: filled(detail.headline) },
    { label: "Full name", met: filled(detail.fullName) },
    {
      label: "Phone number",
      met: filled(detail.phone) && phoneSchema.safeParse(detail.phone).success,
    },
    { label: "Current city", met: filled(detail.locationCity) },
    { label: "At least three skills", met: claimedSkills >= 3 },
    {
      // Either half satisfies it, and "I have no work experience yet" already
      // completes the experience section — students are not asked for a job.
      label: "Your education or work history",
      met: complete("education") || complete("experience"),
    },
  ];
}

export function evaluateProfileReadiness(
  detail: CandidateDetail,
  completeness: ProfileCompleteness,
): ProfileReadiness {
  const blocking = essentials(detail, completeness)
    .filter((e) => !e.met)
    .map((e) => e.label);
  return {
    ready: completeness.score >= PROFILE_READY_SCORE && blocking.length === 0,
    blocking,
  };
}
