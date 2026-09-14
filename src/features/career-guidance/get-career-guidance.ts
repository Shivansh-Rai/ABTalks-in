import "server-only";
import {
  EnrollmentStatusV2,
  ProgramMemberStatus,
} from "@prisma/client";
import { prismaApplicationStore } from "@/features/candidate-jobs/prisma-store";
import { isHackathonRegistrationOpen } from "@/components/hackathon/hackathon-config";
import { isUserRegistered } from "@/features/hackathon/registration-status";
import { evaluateRules } from "@/features/career-guidance/rules";
import { getIstDateKey, getIstWeekKey } from "@/lib/date-utils";
import type { GuidanceTargeting } from "@/features/career-guidance/catalog";
import type {
  CandidateFacts,
  ChallengeFact,
  GuidanceItem,
  MockFact,
  TrackStatus,
} from "@/features/career-guidance/types";
import {
  isClaudeEnabled,
  isDatabricksEnabled,
  isDsArchitectEnabled,
  isPowerBiEnabled,
  isProgramEnabled,
} from "@/lib/feature-flags";
import { logger } from "@/lib/logger";
import { getCareerGuidanceFacts } from "@/repositories/candidate-detail";
import { findDatabricksEnrollment } from "@/repositories/databricks";
import { findDsArchitectEnrollment } from "@/repositories/ds-architect";
import {
  findActiveMembership,
  listChallengeEnrollments,
} from "@/repositories/learning";
import { findPowerBiEnrollment } from "@/repositories/powerbi";

function peToTrackStatus(
  status: EnrollmentStatusV2 | undefined,
): TrackStatus | null {
  if (!status) return null;
  if (
    status === EnrollmentStatusV2.DROPPED ||
    status === EnrollmentStatusV2.REMOVED
  ) {
    return null;
  }
  if (status === EnrollmentStatusV2.COMPLETED) return "COMPLETED";
  return "ACTIVE";
}

function memberToTrackStatus(
  status: ProgramMemberStatus | undefined,
): TrackStatus | null {
  if (!status) return null;
  if (status === ProgramMemberStatus.DROPPED) return null;
  if (status === ProgramMemberStatus.COMPLETED) return "COMPLETED";
  if (
    status === ProgramMemberStatus.ENROLLED ||
    status === ProgramMemberStatus.APPLIED ||
    status === ProgramMemberStatus.WAITLISTED
  ) {
    return "ACTIVE";
  }
  return null;
}

async function loadJobs(userId: string): Promise<{
  jobs: CandidateFacts["jobs"];
  appliedJobIds: string[];
}> {
  try {
    const store = prismaApplicationStore();
    const [published, applications] = await Promise.all([
      store.listPublishedJobsFiltered({}),
      store.listByCandidate(userId),
    ]);
    return {
      jobs: published.map((job) => ({
        id: job.id,
        title: job.title,
        company: job.company,
        skills: job.skills,
        type: job.type,
      })),
      appliedJobIds: applications.map((row) => row.jobId),
    };
  } catch (err) {
    logger.warn("[career-guidance] jobs unavailable; omitting opportunities", {
      userId,
      err,
    });
    return { jobs: [], appliedJobIds: [] };
  }
}

export type CareerGuidancePayload = {
  items: GuidanceItem[];
  targeting: GuidanceTargeting;
  istDay: string;
  istWeek: string;
};

/**
 * Assemble this candidate's facts and evaluate the T-224 rule table.
 *
 * Mocks are passed in because the hub already loaded them; a second history
 * read would duplicate a path that is allowed to fail independently.
 */
export async function getCareerGuidance(
  userId: string,
  mocks: MockFact[],
): Promise<CareerGuidancePayload> {
  const [
    challengeRows,
    membership,
    databricks,
    dsArchitect,
    powerBi,
    hackathonRegistered,
    profile,
    jobBundle,
  ] = await Promise.all([
    listChallengeEnrollments(userId),
    findActiveMembership(userId),
    findDatabricksEnrollment(userId),
    findDsArchitectEnrollment(userId),
    findPowerBiEnrollment(userId),
    isUserRegistered(userId),
    getCareerGuidanceFacts(userId),
    loadJobs(userId),
  ]);

  const challenges: ChallengeFact[] = challengeRows.map((row) => ({
    domain: row.domain,
    status: row.status,
  }));

  const facts: CandidateFacts = {
    challenges,
    aiCohortStatus: memberToTrackStatus(membership?.member.status),
    databricksStatus: peToTrackStatus(databricks?.status),
    dsArchitectStatus: peToTrackStatus(dsArchitect?.status),
    powerBiStatus: peToTrackStatus(powerBi?.status),
    hackathonRegistered,
    hackathonRegistrationOpen: isHackathonRegistrationOpen(),
    skills: profile.skills,
    preferredRoles: profile.preferredRoles,
    opportunityTypes: profile.opportunityTypes,
    flags: {
      program: isProgramEnabled(),
      databricks: isDatabricksEnabled(),
      dsArchitect: isDsArchitectEnabled(),
      powerBi: isPowerBiEnabled(),
      claude: isClaudeEnabled(),
    },
    mocks,
    jobs: jobBundle.jobs,
    appliedJobIds: jobBundle.appliedJobIds,
  };

  return {
    items: evaluateRules(facts),
    targeting: {
      challengeDomains: [
        ...new Set(
          challenges
            .filter((c) => c.status === "ACTIVE" || c.status === "COMPLETED")
            .map((c) => c.domain),
        ),
      ],
      aiCohortActive: facts.aiCohortStatus === "ACTIVE",
      aiCohortCompleted: facts.aiCohortStatus === "COMPLETED",
      skillNames: profile.skills.map((s) => s.name),
      preferredRoles: profile.preferredRoles,
      skillsEmpty: profile.skills.length === 0,
    },
    istDay: getIstDateKey(),
    istWeek: getIstWeekKey(),
  };
}
