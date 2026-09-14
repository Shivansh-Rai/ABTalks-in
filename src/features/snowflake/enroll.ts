import "server-only";
import { EnrollmentStatusV2 } from "@prisma/client";
import { writeClient } from "@/lib/db";
import {
  SNOWFLAKE_MAX_MISSION_POINTS,
  SNOWFLAKE_TOTAL_DAYS,
} from "@/features/snowflake/constants";
import type { SnowflakeEnrollInput } from "@/lib/validations/snowflake";
import { getProfileSummary, updateCandidateLinks } from "@/repositories/candidate";
import {
  createSnowflakeEnrollmentRow,
  findSnowflakeEnrollment,
  getSnowflakeCohort,
} from "@/repositories/snowflake";

export type SnowflakeEntryState =
  | { screen: "needs_profile" }
  | { screen: "closed" }
  | { screen: "form" }
  | { screen: "enrolled"; enrollmentId: string };

export async function getSnowflakeEntryState(
  userId: string,
): Promise<SnowflakeEntryState> {
  const existing = await findSnowflakeEnrollment(userId);
  if (
    existing &&
    (existing.status === EnrollmentStatusV2.ACTIVE ||
      existing.status === EnrollmentStatusV2.COMPLETED)
  ) {
    return { screen: "enrolled", enrollmentId: existing.id };
  }

  const profile = await getProfileSummary(userId);
  if (!profile) return { screen: "needs_profile" };

  const cohort = await getSnowflakeCohort();
  if (
    !cohort ||
    (cohort.status !== "ENROLLING" && cohort.status !== "ACTIVE")
  ) {
    return { screen: "closed" };
  }

  return { screen: "form" };
}

export async function createSnowflakeEnrollment(
  userId: string,
  input: SnowflakeEnrollInput,
): Promise<{ ok: true; enrollmentId: string } | { ok: false; message: string }> {
  const profile = await getProfileSummary(userId);
  if (!profile) {
    return { ok: false, message: "Complete your registration first." };
  }

  const cohort = await getSnowflakeCohort();
  if (
    !cohort ||
    (cohort.status !== "ENROLLING" && cohort.status !== "ACTIVE")
  ) {
    return { ok: false, message: "This cohort is not open for enrolment." };
  }

  const existing = await findSnowflakeEnrollment(userId);
  if (
    existing &&
    (existing.status === EnrollmentStatusV2.ACTIVE ||
      existing.status === EnrollmentStatusV2.COMPLETED)
  ) {
    return { ok: false, message: "You are already enrolled." };
  }

  await updateCandidateLinks(userId, {
    linkedinUrl: input.linkedinUrl,
    githubUsername: input.githubUsername,
    skills: input.skills,
  });

  const enrollmentId = await writeClient().$transaction(async (tx) => {
    const row = await createSnowflakeEnrollmentRow(tx, {
      userId,
      cohortId: cohort.id,
      githubRepoUrl: input.githubRepoUrl,
    });
    await tx.enrollmentProgress.upsert({
      where: { enrollmentId: row.id },
      create: {
        enrollmentId: row.id,
        cohortId: cohort.id,
        completedActivities: 0,
        totalActivities: SNOWFLAKE_TOTAL_DAYS,
        percentCompleteBp: 0,
        pointsEarned: 0,
        pointsPossible: SNOWFLAKE_MAX_MISSION_POINTS,
        currentStreak: 0,
        longestStreak: 0,
        unlockedThroughPosition: 0,
      },
      update: {},
    });
    return row.id;
  });

  return { ok: true, enrollmentId };
}
