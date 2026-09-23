import "server-only";
import { getCandidateProfile } from "@/repositories/candidate";
import { displayedChallengeDomain } from "@/repositories/enrollment-state";
import { buildChallengeContext } from "@/features/interview/challenge-context";
import { buildResumeContext } from "@/features/interview/resume-context";
import type { CandidateContext } from "@/features/interview/types";

/**
 * Single deterministic entry point for everything the interviewer agent knows
 * about a candidate. Identity/college/role come from CandidateProfile and
 * structured history. Challenge domain comes from ProgramEnrollment.joinedAt.
 */
export async function buildCandidateContext(
  userId: string,
): Promise<CandidateContext | null> {
  const [profile, challenge, resume] = await Promise.all([
    getCandidateProfile(userId),
    buildChallengeContext(userId),
    buildResumeContext(userId),
  ]);

  if (!profile) return null;

  return {
    userId,
    fullName: profile.fullName,
    domain: (await displayedChallengeDomain(userId, null)) ?? "",
    role: profile.role,
    organization: profile.organization,
    yearsExperience: profile.yearsExperience,
    college: profile.college,
    challenge,
    resume,
  };
}
