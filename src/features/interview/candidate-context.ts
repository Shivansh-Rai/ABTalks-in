import "server-only";
import { prisma } from "@/lib/db";
import { getCandidateProfile } from "@/repositories/candidate";
import { buildChallengeContext } from "@/features/interview/challenge-context";
import { buildResumeContext } from "@/features/interview/resume-context";
import type { CandidateContext } from "@/features/interview/types";

/**
 * Single deterministic entry point for everything the interviewer agent knows
 * about a candidate. Identity/college/role come from CandidateProfile and
 * structured history. Domain stays on StudentProfile (later family) when present.
 */
export async function buildCandidateContext(
  userId: string,
): Promise<CandidateContext | null> {
  const [profile, challenge, resume, domainRow] = await Promise.all([
    getCandidateProfile(userId),
    buildChallengeContext(userId),
    buildResumeContext(userId),
    prisma.studentProfile.findUnique({
      where: { userId },
      select: { domain: true },
    }),
  ]);

  if (!profile) return null;

  return {
    userId,
    fullName: profile.fullName,
    domain: domainRow?.domain ?? "",
    role: profile.role,
    organization: profile.organization,
    yearsExperience: profile.yearsExperience,
    college: profile.college,
    challenge,
    resume,
  };
}
