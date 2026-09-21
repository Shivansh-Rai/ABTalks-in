import "server-only";
import {
  AttemptLateness,
  EnrollmentStatus,
  SubmissionStatus,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { isNewProgressRepoEnabled } from "@/lib/feature-flags";
import {
  enrollmentIdFromPe,
  memberIdFromPe,
  peIdForEnrollment,
  peIdForMember,
  quizIdFromActivity,
  missionSubmissionIdFromAttemptId,
} from "@/repositories/ids";

export type ChallengeProgressStats = {
  daysCompleted: number;
  currentStreak: number;
  longestStreak: number;
  lastSubmittedDay: number | null;
};

export type ChallengeSubmissionRow = {
  id: string;
  dayNumber: number;
  status: SubmissionStatus;
  githubUrl: string | null;
  linkedinUrl: string | null;
  submittedAt: Date;
};

export type ProgramMissionProgressRow = {
  dayNumber: number;
  passed: boolean;
  payload: unknown;
};

export type ProgramMissionAttemptRow = {
  attemptNumber: number;
  passed: boolean;
  verdict: Prisma.JsonValue | null;
  payload: unknown;
  createdAt: Date;
};

export type QuizAttemptRow = {
  id: string;
  quizId: string;
  score: number;
  answers: Record<string, string>;
  attemptedAt: Date;
};

function jsonObject(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function answersFromPayload(
  payload: Prisma.JsonValue | null | undefined,
): Record<string, string> {
  const answers = jsonObject(payload).answers;
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(answers as Record<string, unknown>)) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

function latenessToStatus(lateness: AttemptLateness): SubmissionStatus {
  return lateness === AttemptLateness.LATE
    ? SubmissionStatus.LATE
    : SubmissionStatus.ON_TIME;
}

async function challengeCompletionFromAttempts(
  enrollmentId: string,
): Promise<{ daysCompleted: number; lastSubmittedDay: number | null }> {
  const attempts = await prisma.activityAttempt.findMany({
    where: {
      enrollmentId: peIdForEnrollment(enrollmentId),
      id: { startsWith: "aa_sub_" },
      activityId: { startsWith: "act_dt_" },
    },
    select: {
      passed: true,
      activity: { select: { dayNumber: true } },
      evaluations: {
        where: { isAuthoritative: true },
        select: { passed: true },
        take: 1,
      },
    },
  });

  const passedDays = new Set<number>();
  let lastSubmittedDay: number | null = null;
  for (const row of attempts) {
    const dayNumber = row.activity.dayNumber;
    if (dayNumber == null) continue;
    const passed = row.evaluations[0]?.passed ?? row.passed;
    if (!passed) continue;
    passedDays.add(dayNumber);
    if (lastSubmittedDay == null || dayNumber > lastSubmittedDay) {
      lastSubmittedDay = dayNumber;
    }
  }
  return { daysCompleted: passedDays.size, lastSubmittedDay };
}

/**
 * Phase 6: completed days come from attempts. Track streak stays the
 * Enrollment.currentStreak / longestStreak snapshot written on submit.
 * Live-recomputing streak is a separate product decision (Phase 7).
 */
export async function getChallengeProgressStats(
  enrollmentId: string,
): Promise<ChallengeProgressStats> {
  const snapshot = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      daysCompleted: true,
      currentStreak: true,
      longestStreak: true,
      lastSubmittedDay: true,
    },
  });
  const streaks = {
    currentStreak: snapshot?.currentStreak ?? 0,
    longestStreak: snapshot?.longestStreak ?? 0,
  };
  if (!isNewProgressRepoEnabled()) {
    return {
      daysCompleted: snapshot?.daysCompleted ?? 0,
      lastSubmittedDay: snapshot?.lastSubmittedDay ?? null,
      ...streaks,
    };
  }
  const derived = await challengeCompletionFromAttempts(enrollmentId);
  return { ...derived, ...streaks };
}

export async function overlayChallengeProgressFields<
  T extends {
    id: string;
    daysCompleted: number;
    currentStreak: number;
    longestStreak: number;
    lastSubmittedDay: number | null;
  },
>(rows: T[]): Promise<T[]> {
  if (!isNewProgressRepoEnabled() || rows.length === 0) return rows;
  return Promise.all(
    rows.map(async (row) => {
      const derived = await challengeCompletionFromAttempts(row.id);
      return {
        ...row,
        daysCompleted: derived.daysCompleted,
        lastSubmittedDay: derived.lastSubmittedDay,
      };
    }),
  );
}

async function listChallengeSubmissionTimes(userId: string): Promise<Date[]> {
  if (!isNewProgressRepoEnabled()) {
    const rows = await prisma.submission.findMany({
      where: { enrollment: { userId } },
      select: { submittedAt: true },
    });
    return rows.map((r) => r.submittedAt);
  }

  const pes = await prisma.programEnrollment.findMany({
    where: { userId, id: { startsWith: "pe_enr_" } },
    select: { id: true },
  });
  if (pes.length === 0) return [];
  const rows = await prisma.activityAttempt.findMany({
    where: {
      enrollmentId: { in: pes.map((p) => p.id) },
      id: { startsWith: "aa_sub_" },
      submittedAt: { not: null },
    },
    select: { submittedAt: true },
  });
  return rows
    .map((r) => r.submittedAt)
    .filter((d): d is Date => d instanceof Date);
}

/**
 * Skip tokens and enrollment waivers create ProgramMissionSubmission rows the
 * member never submitted — they are bookkeeping, not activity.
 * Local copy of the feature-layer predicates: features/program/progression
 * imports this file, so importing it back would cycle.
 */
function isBookkeepingMissionPayload(payload: Prisma.JsonValue | null): boolean {
  const obj = jsonObject(payload);
  return obj.skipped === true || obj.waived === true;
}

/** AI Cohort mission runs — every verification run, pass or fail. */
async function listProgramMissionTimes(userId: string): Promise<Date[]> {
  if (!isNewProgressRepoEnabled()) {
    const rows = await prisma.programMissionSubmission.findMany({
      where: { member: { userId } },
      select: { createdAt: true, payload: true },
    });
    return rows
      .filter((r) => !isBookkeepingMissionPayload(r.payload))
      .map((r) => r.createdAt);
  }

  const pes = await prisma.programEnrollment.findMany({
    where: { userId, id: { startsWith: "pe_pm_" } },
    select: { id: true },
  });
  if (pes.length === 0) return [];
  const rows = await prisma.activityAttempt.findMany({
    where: {
      enrollmentId: { in: pes.map((p) => p.id) },
      id: { startsWith: "aa_ms_" },
      activityId: { startsWith: "act_pd_" },
    },
    select: { submittedAt: true, createdAt: true, payload: true },
  });
  return rows
    .filter((r) => !isBookkeepingMissionPayload(r.payload))
    .map((r) => r.submittedAt ?? r.createdAt);
}

/** Databricks mission runs — every verification run, pass or fail. */
async function listDatabricksAttemptTimes(userId: string): Promise<Date[]> {
  const rows = await prisma.activityAttempt.findMany({
    where: {
      enrollment: { userId },
      activityId: { startsWith: "act_dbx_day_" },
    },
    select: { submittedAt: true, createdAt: true },
  });
  return rows.map((r) => r.submittedAt ?? r.createdAt);
}

/** Data Solutions Architect mission runs — every verification run, pass or fail. */
async function listDsArchitectAttemptTimes(userId: string): Promise<Date[]> {
  const rows = await prisma.activityAttempt.findMany({
    where: {
      enrollment: { userId },
      activityId: { startsWith: "act_dsa_day_" },
    },
    select: { submittedAt: true, createdAt: true },
  });
  return rows.map((r) => r.submittedAt ?? r.createdAt);
}

/** Power BI mission runs — every verification run, pass or fail. */
async function listPowerBiAttemptTimes(userId: string): Promise<Date[]> {
  const rows = await prisma.activityAttempt.findMany({
    where: {
      enrollment: { userId },
      activityId: { startsWith: "act_pbi_day_" },
    },
    select: { submittedAt: true, createdAt: true },
  });
  return rows.map((r) => r.submittedAt ?? r.createdAt);
}

/** Snowflake mission runs — every verification run, pass or fail. */
async function listSnowflakeAttemptTimes(userId: string): Promise<Date[]> {
  const rows = await prisma.activityAttempt.findMany({
    where: {
      enrollment: { userId },
      activityId: { startsWith: "act_snf_day_" },
    },
    select: { submittedAt: true, createdAt: true },
  });
  return rows.map((r) => r.submittedAt ?? r.createdAt);
}

/**
 * Every submission the hub heatmap and streak card count, across all tracks
 * the user can be in: 60-Day Challenge, AI Cohort, Databricks, DS Architect,
 * Power BI, Snowflake.
 */
export async function listHubSubmissionTimes(
  userId: string,
): Promise<Date[]> {
  const [challenge, program, databricks, dsArchitect, powerBi, snowflake] =
    await Promise.all([
      listChallengeSubmissionTimes(userId),
      listProgramMissionTimes(userId),
      listDatabricksAttemptTimes(userId),
      listDsArchitectAttemptTimes(userId),
      listPowerBiAttemptTimes(userId),
      listSnowflakeAttemptTimes(userId),
    ]);
  return [
    ...challenge,
    ...program,
    ...databricks,
    ...dsArchitect,
    ...powerBi,
    ...snowflake,
  ];
}

export async function listChallengeSubmissions(
  enrollmentId: string,
): Promise<ChallengeSubmissionRow[]> {
  if (!isNewProgressRepoEnabled()) {
    return prisma.submission.findMany({
      where: { enrollmentId },
      orderBy: { submittedAt: "desc" },
      select: {
        id: true,
        dayNumber: true,
        status: true,
        githubUrl: true,
        linkedinUrl: true,
        submittedAt: true,
      },
    });
  }

  const rows = await prisma.activityAttempt.findMany({
    where: {
      enrollmentId: peIdForEnrollment(enrollmentId),
      id: { startsWith: "aa_sub_" },
      activityId: { startsWith: "act_dt_" },
    },
    select: {
      id: true,
      passed: true,
      lateness: true,
      submittedAt: true,
      payload: true,
      activity: { select: { dayNumber: true } },
      evaluations: {
        where: { isAuthoritative: true },
        select: { passed: true },
        take: 1,
      },
    },
    orderBy: { submittedAt: "desc" },
  });

  const out: ChallengeSubmissionRow[] = [];
  for (const row of rows) {
    const dayNumber = row.activity.dayNumber;
    if (dayNumber == null || !row.submittedAt) continue;
    const passed = row.evaluations[0]?.passed ?? row.passed;
    if (!passed) continue;
    const payload = jsonObject(row.payload);
    const legacyId =
      typeof payload.legacySubmissionId === "string"
        ? payload.legacySubmissionId
        : row.id.slice("aa_sub_".length);
    out.push({
      id: legacyId,
      dayNumber,
      status: latenessToStatus(row.lateness),
      githubUrl: typeof payload.githubUrl === "string" ? payload.githubUrl : null,
      linkedinUrl:
        typeof payload.linkedinUrl === "string" ? payload.linkedinUrl : null,
      submittedAt: row.submittedAt,
    });
  }
  return out;
}

export async function getChallengeDaySubmission(
  enrollmentId: string,
  dayNumber: number,
): Promise<Omit<ChallengeSubmissionRow, "id" | "dayNumber"> | null> {
  if (!isNewProgressRepoEnabled()) {
    const row = await prisma.submission.findUnique({
      where: { enrollmentId_dayNumber: { enrollmentId, dayNumber } },
      select: {
        status: true,
        githubUrl: true,
        linkedinUrl: true,
        submittedAt: true,
      },
    });
    return row;
  }

  const rows = await listChallengeSubmissions(enrollmentId);
  const row = rows.find((r) => r.dayNumber === dayNumber);
  if (!row) return null;
  return {
    status: row.status,
    githubUrl: row.githubUrl,
    linkedinUrl: row.linkedinUrl,
    submittedAt: row.submittedAt,
  };
}

export async function getChallengeCompletionState(
  enrollmentId: string,
  totalDays: number,
  status: EnrollmentStatus,
): Promise<{ daysCompleted: number; isComplete: boolean }> {
  const stats = await getChallengeProgressStats(enrollmentId);
  return {
    daysCompleted: stats.daysCompleted,
    isComplete:
      status === EnrollmentStatus.COMPLETED || stats.daysCompleted >= totalDays,
  };
}

export async function listProgramMissionProgress(
  memberId: string,
): Promise<ProgramMissionProgressRow[]> {
  if (!isNewProgressRepoEnabled()) {
    return prisma.programMissionSubmission.findMany({
      where: { memberId },
      select: { dayNumber: true, passed: true, payload: true },
    });
  }

  const rows = await prisma.activityAttempt.findMany({
    where: {
      enrollmentId: peIdForMember(memberId),
      id: { startsWith: "aa_ms_" },
      activityId: { startsWith: "act_pd_" },
    },
    select: {
      passed: true,
      payload: true,
      activity: { select: { dayNumber: true } },
      evaluations: {
        where: { isAuthoritative: true },
        select: { passed: true },
        take: 1,
      },
    },
  });

  const out: ProgramMissionProgressRow[] = [];
  for (const row of rows) {
    const dayNumber = row.activity.dayNumber;
    if (dayNumber == null) continue;
    out.push({
      dayNumber,
      passed: row.evaluations[0]?.passed ?? row.passed,
      payload: row.payload,
    });
  }
  return out;
}

export async function listProgramMissionAttemptsForDay(
  memberId: string,
  dayNumber: number,
): Promise<ProgramMissionAttemptRow[]> {
  if (!isNewProgressRepoEnabled()) {
    return prisma.programMissionSubmission.findMany({
      where: { memberId, dayNumber },
      select: {
        attemptNumber: true,
        passed: true,
        verdict: true,
        payload: true,
        createdAt: true,
      },
      orderBy: { attemptNumber: "asc" },
    });
  }

  const rows = await prisma.activityAttempt.findMany({
    where: {
      enrollmentId: peIdForMember(memberId),
      id: { startsWith: "aa_ms_" },
      activity: { dayNumber },
      activityId: { startsWith: "act_pd_" },
    },
    select: {
      attemptNumber: true,
      passed: true,
      payload: true,
      submittedAt: true,
      createdAt: true,
      evaluations: {
        where: { isAuthoritative: true },
        select: { passed: true, detailJson: true },
        take: 1,
      },
    },
    orderBy: { attemptNumber: "asc" },
  });

  return rows.map((row) => ({
    attemptNumber: row.attemptNumber,
    passed: row.evaluations[0]?.passed ?? row.passed,
    verdict: row.evaluations[0]?.detailJson ?? null,
    payload: row.payload,
    createdAt: row.submittedAt ?? row.createdAt,
  }));
}

export type CanonicalMissionAttemptRow = {
  id: string;
  memberId: string;
  dayNumber: number;
  attemptNumber: number;
  passed: boolean;
  payload: Prisma.JsonValue | null;
  createdAt: Date;
  pointsAwarded: number;
  aiFeedback: string | null;
};

function aiFeedbackFromPayload(
  payload: Prisma.JsonValue | null | undefined,
): string | null {
  const value = jsonObject(payload).aiFeedback;
  return typeof value === "string" ? value : null;
}

export async function listCanonicalMissionAttempts(input: {
  memberIds: string[];
}): Promise<CanonicalMissionAttemptRow[]> {
  if (input.memberIds.length === 0) return [];
  if (!isNewProgressRepoEnabled()) {
    const rows = await prisma.programMissionSubmission.findMany({
      where: { memberId: { in: input.memberIds } },
      select: {
        id: true,
        memberId: true,
        dayNumber: true,
        attemptNumber: true,
        passed: true,
        payload: true,
        createdAt: true,
        pointsAwarded: true,
        aiFeedback: true,
      },
      orderBy: [{ dayNumber: "asc" }, { attemptNumber: "asc" }],
    });
    return rows;
  }

  const rows = await prisma.activityAttempt.findMany({
    where: {
      enrollmentId: { in: input.memberIds.map((id) => peIdForMember(id)) },
      id: { startsWith: "aa_ms_" },
      activityId: { startsWith: "act_pd_" },
    },
    select: {
      id: true,
      enrollmentId: true,
      attemptNumber: true,
      passed: true,
      payload: true,
      pointsAwarded: true,
      submittedAt: true,
      createdAt: true,
      activity: { select: { dayNumber: true } },
      evaluations: {
        where: { isAuthoritative: true },
        select: { passed: true },
        take: 1,
      },
    },
    orderBy: [{ attemptNumber: "asc" }],
  });

  const out: CanonicalMissionAttemptRow[] = [];
  for (const row of rows) {
    const memberId = memberIdFromPe(row.enrollmentId);
    const dayNumber = row.activity.dayNumber;
    if (!memberId || dayNumber == null) continue;
    const id = missionSubmissionIdFromAttemptId(row.id) ?? row.id;
    out.push({
      id,
      memberId,
      dayNumber,
      attemptNumber: row.attemptNumber,
      passed: row.evaluations[0]?.passed ?? row.passed,
      payload: row.payload,
      createdAt: row.submittedAt ?? row.createdAt,
      pointsAwarded: row.pointsAwarded,
      aiFeedback: aiFeedbackFromPayload(row.payload),
    });
  }
  return out;
}

export type CanonicalChallengeFeedRow = {
  id: string;
  userId: string;
  dayNumber: number;
  status: SubmissionStatus;
  githubUrl: string | null;
  linkedinUrl: string | null;
  submittedAt: Date;
  domain: string;
};

export async function listCanonicalChallengeFeed(input: {
  domain?: string;
  status?: SubmissionStatus;
  minDay?: number;
  maxDay?: number;
  take?: number;
  submittedAtGte?: Date;
  submittedAtLt?: Date;
}): Promise<CanonicalChallengeFeedRow[]> {
  if (!isNewProgressRepoEnabled()) {
    const rows = await prisma.submission.findMany({
      where: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.minDay != null || input.maxDay != null
          ? {
              dayNumber: {
                ...(input.minDay != null ? { gte: input.minDay } : {}),
                ...(input.maxDay != null ? { lte: input.maxDay } : {}),
              },
            }
          : {}),
        ...(input.submittedAtGte || input.submittedAtLt
          ? {
              submittedAt: {
                ...(input.submittedAtGte ? { gte: input.submittedAtGte } : {}),
                ...(input.submittedAtLt ? { lt: input.submittedAtLt } : {}),
              },
            }
          : {}),
        ...(input.domain
          ? { enrollment: { domain: input.domain as never } }
          : {}),
      },
      orderBy: { submittedAt: "desc" },
      take: input.take,
      select: {
        id: true,
        userId: true,
        dayNumber: true,
        status: true,
        githubUrl: true,
        linkedinUrl: true,
        submittedAt: true,
        enrollment: { select: { domain: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      dayNumber: row.dayNumber,
      status: row.status,
      githubUrl: row.githubUrl,
      linkedinUrl: row.linkedinUrl,
      submittedAt: row.submittedAt,
      domain: row.enrollment.domain,
    }));
  }

  const rows = await prisma.activityAttempt.findMany({
    where: {
      id: { startsWith: "aa_sub_" },
      activityId: { startsWith: "act_dt_" },
      submittedAt: {
        not: null,
        ...(input.submittedAtGte ? { gte: input.submittedAtGte } : {}),
        ...(input.submittedAtLt ? { lt: input.submittedAtLt } : {}),
      },
      ...(input.status === "LATE"
        ? { lateness: "LATE" }
        : input.status === "ON_TIME"
          ? { lateness: "ON_TIME" }
          : {}),
      ...(input.minDay != null || input.maxDay != null
        ? {
            activity: {
              dayNumber: {
                ...(input.minDay != null ? { gte: input.minDay } : {}),
                ...(input.maxDay != null ? { lte: input.maxDay } : {}),
              },
            },
          }
        : {}),
    },
    orderBy: { submittedAt: "desc" },
    take: input.take ?? 5000,
    select: {
      id: true,
      enrollmentId: true,
      lateness: true,
      payload: true,
      submittedAt: true,
      enrollment: { select: { userId: true } },
      activity: { select: { dayNumber: true } },
    },
  });

  const enrollmentIds = [
    ...new Set(
      rows
        .map((row) => enrollmentIdFromPe(row.enrollmentId))
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const enrollments = await prisma.enrollment.findMany({
    where: { id: { in: enrollmentIds } },
    select: { id: true, domain: true },
  });
  const domainByEnrollment = new Map(enrollments.map((e) => [e.id, e.domain]));

  const out: CanonicalChallengeFeedRow[] = [];
  for (const row of rows) {
    const enrollmentId = enrollmentIdFromPe(row.enrollmentId);
    const dayNumber = row.activity.dayNumber;
    if (!enrollmentId || dayNumber == null || !row.submittedAt) continue;
    const domain = domainByEnrollment.get(enrollmentId);
    if (!domain) continue;
    if (input.domain && domain !== input.domain) continue;
    const payload = jsonObject(row.payload);
    const legacyId =
      typeof payload.legacySubmissionId === "string"
        ? payload.legacySubmissionId
        : row.id.startsWith("aa_sub_")
          ? row.id.slice("aa_sub_".length)
          : row.id;
    out.push({
      id: legacyId,
      userId: row.enrollment.userId,
      dayNumber,
      status: latenessToStatus(row.lateness),
      githubUrl: typeof payload.githubUrl === "string" ? payload.githubUrl : null,
      linkedinUrl:
        typeof payload.linkedinUrl === "string" ? payload.linkedinUrl : null,
      submittedAt: row.submittedAt,
      domain,
    });
  }
  return out;
}

export async function listProgramRecentMissionAttempts(
  memberId: string,
  take: number,
): Promise<
  Array<{
    dayNumber: number;
    passed: boolean;
    verdict: Prisma.JsonValue | null;
    createdAt: Date;
    payload: unknown;
  }>
> {
  if (!isNewProgressRepoEnabled()) {
    return prisma.programMissionSubmission.findMany({
      where: { memberId },
      select: {
        dayNumber: true,
        passed: true,
        verdict: true,
        createdAt: true,
        payload: true,
      },
      orderBy: { createdAt: "desc" },
      take,
    });
  }

  const rows = await prisma.activityAttempt.findMany({
    where: {
      enrollmentId: peIdForMember(memberId),
      id: { startsWith: "aa_ms_" },
      activityId: { startsWith: "act_pd_" },
    },
    select: {
      passed: true,
      payload: true,
      submittedAt: true,
      createdAt: true,
      activity: { select: { dayNumber: true } },
      evaluations: {
        where: { isAuthoritative: true },
        select: { passed: true, detailJson: true },
        take: 1,
      },
    },
    orderBy: { submittedAt: "desc" },
    take,
  });

  return rows.flatMap((row) => {
    const dayNumber = row.activity.dayNumber;
    if (dayNumber == null) return [];
    return [
      {
        dayNumber,
        passed: row.evaluations[0]?.passed ?? row.passed,
        verdict: row.evaluations[0]?.detailJson ?? null,
        createdAt: row.submittedAt ?? row.createdAt,
        payload: row.payload,
      },
    ];
  });
}

export async function getProgramUnlockFloor(
  memberId: string,
  fallback: number,
): Promise<number> {
  if (!isNewProgressRepoEnabled()) return fallback;
  const pe = await prisma.programEnrollment.findUnique({
    where: { id: peIdForMember(memberId) },
    select: { unlockFloorDay: true },
  });
  return pe?.unlockFloorDay ?? fallback;
}

export async function listQuizAttemptsForUser(
  userId: string,
  quizIds: string[],
): Promise<Array<Pick<QuizAttemptRow, "id" | "quizId" | "score" | "attemptedAt">>> {
  if (quizIds.length === 0) return [];
  if (!isNewProgressRepoEnabled()) {
    return prisma.quizAttempt.findMany({
      where: { userId, quizId: { in: quizIds } },
      select: { id: true, score: true, quizId: true, attemptedAt: true },
      orderBy: { attemptedAt: "desc" },
    });
  }

  const pes = await prisma.programEnrollment.findMany({
    where: { userId, id: { startsWith: "pe_enr_" } },
    select: { id: true },
  });
  if (pes.length === 0) return [];
  const activityIds = quizIds.map((id) => `act_quiz_${id}`);
  const rows = await prisma.activityAttempt.findMany({
    where: {
      enrollmentId: { in: pes.map((p) => p.id) },
      activityId: { in: activityIds },
    },
    select: {
      id: true,
      score: true,
      submittedAt: true,
      createdAt: true,
      activityId: true,
      payload: true,
    },
    orderBy: { submittedAt: "desc" },
  });

  return rows.flatMap((row) => {
    const quizId = quizIdFromActivity(row.activityId);
    if (!quizId) return [];
    const payload = jsonObject(row.payload);
    const legacyId =
      typeof payload.legacyQuizAttemptId === "string"
        ? payload.legacyQuizAttemptId
        : row.id.startsWith("aa_qa_")
          ? row.id.slice("aa_qa_".length)
          : row.id;
    return [
      {
        id: legacyId,
        quizId,
        score: row.score ?? 0,
        attemptedAt: row.submittedAt ?? row.createdAt,
      },
    ];
  });
}

export async function getQuizAttemptForUser(
  userId: string,
  quizId: string,
): Promise<QuizAttemptRow | null> {
  if (!isNewProgressRepoEnabled()) {
    const row = await prisma.quizAttempt.findUnique({
      where: { userId_quizId: { userId, quizId } },
      select: { id: true, quizId: true, score: true, answers: true, attemptedAt: true },
    });
    if (!row) return null;
    return {
      id: row.id,
      quizId: row.quizId,
      score: row.score,
      answers: (row.answers as Record<string, string>) ?? {},
      attemptedAt: row.attemptedAt,
    };
  }

  const rows = await listQuizAttemptsForUser(userId, [quizId]);
  const match = rows.find((r) => r.quizId === quizId);
  if (!match) return null;
  const attempt = await prisma.activityAttempt.findFirst({
    where: {
      id: { startsWith: "aa_qa_" },
      activityId: `act_quiz_${quizId}`,
      enrollment: { userId, id: { startsWith: "pe_enr_" } },
    },
    select: { payload: true },
  });
  const fromCanonical = answersFromPayload(attempt?.payload ?? null);
  if (Object.keys(fromCanonical).length > 0) {
    return { ...match, answers: fromCanonical };
  }
  const historical = await prisma.quizAttempt.findUnique({
    where: { id: match.id },
    select: { answers: true },
  });
  return {
    ...match,
    answers: answersFromPayload(
      historical ? { answers: historical.answers } : attempt?.payload ?? null,
    ),
  };
}
