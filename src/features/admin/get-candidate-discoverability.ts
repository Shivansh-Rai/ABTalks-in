import "server-only";
import { prisma } from "@/lib/db";
import { programMember } from "@/repositories/legacy/program-member";
import { resolveProfileRefs } from "@/repositories/hire";
import { searchableUserWhere } from "@/repositories/talent";
import {
  evaluateDiscoverability,
  type CandidateDiscoverability,
  type DiscoverabilityFacts,
} from "@/features/admin/candidate-discoverability";

/**
 * Loads the facts behind "why isn't this candidate showing up?" for one user.
 *
 * Two of them are LIVE PROBES rather than re-implementations: the gate itself is
 * `searchableUserWhere()` run against this one id, and profile-pool membership is
 * `resolveProfileRefs([userId])` — the same function `/hire` uses to decide
 * whether a shortlisted ref is still real. So the verdict cannot drift from the
 * platform even if the individual explanations below do.
 *
 * The discovery record is read here, not through the search repository, because
 * this is admin moderation diagnosis: the same reason `features/admin/
 * anonymize-user.ts` is one of the two files allowed to write it. Only the three
 * columns the gate actually tests are selected.
 */

/**
 * Mirrors `listProfileCandidates` in `src/repositories/hire.ts`. Used only to
 * count how many usable profiles sit ahead of this one in the pool ordering —
 * membership itself comes from `resolveProfileRefs`. Keep in step with that
 * repository; `candidate-discoverability.test.ts` pins the two together.
 */
const USABLE_PROFILE = {
  is: {
    fullName: { not: "" },
    skills: { some: { claimedByCandidate: true } },
  },
} as const;

/**
 * The profile pool's row cap. `searchCandidates` passes `CHALLENGE_POOL_CAP`
 * (600) into every track loader, and `loadProfile` hands it straight to
 * `listProfileCandidates`, which orders newest-first by sign-up date. Copied
 * rather than imported: that constant is private to the recruiter search module.
 */
const PROFILE_POOL_CAP = 600;

export async function getCandidateDiscoverability(
  userId: string,
): Promise<CandidateDiscoverability | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      createdAt: true,
      deletedAt: true,
      disabledAt: true,
      disabledReason: true,
      anonymizedAt: true,
      sessionInvalidatedAt: true,
    },
  });
  if (!user) return null;

  const [
    gateRow,
    passesSearchGate,
    profileRefs,
    profile,
    claimedSkills,
    skillsWithEvidence,
    profilePoolAhead,
    challengeWithSubmissions,
    programMemberships,
    hackathonWithSubmission,
  ] = await Promise.all([
    prisma.candidateVisibility.findUnique({
      where: { userId },
      select: { searchableByRecruiters: true, withdrawnAt: true },
    }),
    prisma.user.count({ where: { id: userId, ...searchableUserWhere() } }),
    resolveProfileRefs([userId]),
    prisma.candidateProfile.findUnique({
      where: { userId },
      select: {
        fullName: true,
        headline: true,
        locationCity: true,
        countryCode: true,
        hasNoWorkExperience: true,
        _count: { select: { education: true, experience: true } },
      },
    }),
    prisma.candidateSkill.count({ where: { userId, claimedByCandidate: true } }),
    prisma.candidateSkill.count({
      where: { userId, claimedByCandidate: true, verified: true },
    }),
    prisma.user.count({
      where: {
        ...searchableUserWhere(),
        candidateProfile: USABLE_PROFILE,
        createdAt: { gt: user.createdAt },
      },
    }),
    prisma.enrollment.count({ where: { userId, submissions: { some: {} } } }),
    programMember.count({ where: { userId } }),
    prisma.hackathonParticipant.count({
      where: { userId, team: { submission: { isNot: null } } },
    }),
  ]);

  const facts: DiscoverabilityFacts = {
    deletedAt: user.deletedAt,
    anonymizedAt: user.anonymizedAt,
    disabledAt: user.disabledAt,
    disabledReason: user.disabledReason,
    sessionInvalidatedAt: user.sessionInvalidatedAt,
    gate: {
      exists: gateRow !== null,
      searchableByRecruiters: gateRow?.searchableByRecruiters ?? false,
      withdrawnAt: gateRow?.withdrawnAt ?? null,
    },
    passesSearchGate: passesSearchGate > 0,
    profile: {
      exists: profile !== null,
      fullName: profile?.fullName ?? "",
      headline: profile?.headline ?? null,
      locationCity: profile?.locationCity ?? null,
      countryCode: profile?.countryCode ?? null,
      educationCount: profile?._count.education ?? 0,
      experienceCount: profile?._count.experience ?? 0,
      hasNoWorkExperience: profile?.hasNoWorkExperience ?? false,
    },
    skills: { claimed: claimedSkills, withEvidence: skillsWithEvidence },
    inProfilePool: profileRefs.length > 0,
    profilePoolAhead,
    profilePoolCap: PROFILE_POOL_CAP,
    tracks: {
      challengeWithSubmissions,
      programMemberships,
      hackathonWithSubmission,
    },
  };

  return evaluateDiscoverability(facts);
}
