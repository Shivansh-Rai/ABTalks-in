/**
 * W6-A progress write boundary.
 *
 * ENABLE_NEW_PROGRESS_WRITES off (dark deploy): Submission / QuizAttempt /
 * ProgramMissionSubmission stay the write that dual-writes onto
 * ActivityAttempt + ActivityEvaluation.
 * ENABLE_NEW_PROGRESS_WRITES on: attempt + evaluation commit first; legacy
 * rows are a compatibility mirror while ENABLE_LEGACY_PROGRESS_MIRROR is not
 * `"false"`.
 *
 * Typed per family. Does not take Enrollment / ProgramEnrollment /
 * StudentProfile.domain / Points authority. Dual-write stays on.
 */
import "server-only";
import type { Prisma, PrismaClient, SubmissionStatus } from "@prisma/client";
import { logger } from "@/lib/logger";
import {
  isLegacyProgressMirrorEnabled,
  isNewProgressWritesEnabled,
} from "@/lib/feature-flags";
import {
  activityIdForDailyTask,
  activityIdForQuiz,
  mintProgressRowId,
  peIdForEnrollment,
  quizAttemptIdFromAttemptId,
  submissionIdFromAttemptId,
} from "@/repositories/ids";
import {
  dualWriteDeleteEnrollmentSubmissions,
  dualWriteDeleteMissionAttempt,
  dualWriteDeleteSubmissionAttempt,
  dualWriteMissionAttempt,
  dualWriteQuizAttempt,
  dualWriteSubmissionAttempt,
  upsertMissionAttemptRows,
  upsertQuizAttemptRows,
  upsertSubmissionAttemptRows,
} from "@/repositories/dual-write";

type Tx = Prisma.TransactionClient | PrismaClient;

export type ProgressMirrorFamily = "submission" | "quiz" | "mission";

export type ApplyProgressResult = {
  id: string;
  created: boolean;
  updated: boolean;
  mirrorFailed: boolean;
};

function savepointName(label: string): string {
  const cleaned = label.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24);
  return `prmir_${cleaned || "x"}`;
}

function isPrismaUniqueConflict(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}

function injectedMirrorFamily(): ProgressMirrorFamily | null {
  const raw = process.env.PROGRESS_FAIL_LEGACY_MIRROR?.trim();
  if (raw !== "submission" && raw !== "quiz" && raw !== "mission") return null;
  return raw;
}

async function runLegacyProgressMirror(
  tx: Tx,
  family: ProgressMirrorFamily,
  label: string,
  fn: () => Promise<void>,
): Promise<boolean> {
  if (!isLegacyProgressMirrorEnabled()) return false;
  if (injectedMirrorFamily() === family) {
    logger.error(
      "[progress] legacy progress mirror failed; canonical attempt kept",
      { label, family, error: "PROGRESS_FAIL_LEGACY_MIRROR" },
    );
    return true;
  }
  const sp = savepointName(label);
  try {
    await tx.$executeRawUnsafe(`SAVEPOINT ${sp}`);
    try {
      await fn();
      await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${sp}`);
      return false;
    } catch (err) {
      try {
        await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${sp}`);
      } catch (rollbackErr) {
        logger.error("[progress] legacy progress mirror rollback failed", {
          label,
          family,
          error: String(rollbackErr),
        });
      }
      if (isPrismaUniqueConflict(err)) throw err;
      logger.error(
        "[progress] legacy progress mirror failed; canonical attempt kept",
        {
          label,
          family,
          error: err instanceof Error ? err.stack ?? err.message : String(err),
        },
      );
      return true;
    }
  } catch (err) {
    if (isPrismaUniqueConflict(err)) throw err;
    logger.error(
      "[progress] legacy progress mirror failed; canonical attempt kept",
      {
        label,
        family,
        error: err instanceof Error ? err.stack ?? err.message : String(err),
      },
    );
    return true;
  }
}

export type ChallengeSubmissionWrite = {
  id?: string;
  userId: string;
  enrollmentId: string;
  dailyTaskId: string;
  dayNumber: number;
  githubUrl: string | null;
  linkedinUrl: string | null;
  status: SubmissionStatus;
  submittedAt: Date;
  pointsAwarded: number;
  mode: "create" | "update";
};

export async function findChallengeSubmissionId(
  tx: Tx,
  input: { enrollmentId: string; dailyTaskId: string; dayNumber: number },
): Promise<string | null> {
  const existing = await tx.submission.findUnique({
    where: {
      enrollmentId_dayNumber: {
        enrollmentId: input.enrollmentId,
        dayNumber: input.dayNumber,
      },
    },
    select: { id: true },
  });
  if (existing) return existing.id;
  if (!isNewProgressWritesEnabled()) return null;
  const attempt = await tx.activityAttempt.findUnique({
    where: {
      enrollmentId_activityId_attemptNumber: {
        enrollmentId: peIdForEnrollment(input.enrollmentId),
        activityId: activityIdForDailyTask(input.dailyTaskId),
        attemptNumber: 1,
      },
    },
    select: { id: true },
  });
  return attempt ? submissionIdFromAttemptId(attempt.id) : null;
}

export async function applyChallengeSubmissionChange(
  tx: Tx,
  input: ChallengeSubmissionWrite,
): Promise<ApplyProgressResult> {
  const id =
    input.mode === "update"
      ? (input.id ?? mintProgressRowId())
      : (input.id ?? mintProgressRowId());
  const payload = {
    id,
    enrollmentId: input.enrollmentId,
    dailyTaskId: input.dailyTaskId,
    githubUrl: input.githubUrl,
    linkedinUrl: input.linkedinUrl,
    status: input.status,
    submittedAt: input.submittedAt,
    pointsAwarded: input.pointsAwarded,
  };

  if (!isNewProgressWritesEnabled()) {
    if (input.mode === "create") {
      const created = await tx.submission.create({
        data: {
          ...(input.id ? { id: input.id } : {}),
          userId: input.userId,
          enrollmentId: input.enrollmentId,
          dailyTaskId: input.dailyTaskId,
          dayNumber: input.dayNumber,
          githubUrl: input.githubUrl,
          linkedinUrl: input.linkedinUrl,
          status: input.status,
          submittedAt: input.submittedAt,
        },
        select: { id: true },
      });
      await dualWriteSubmissionAttempt(tx, {
        ...payload,
        id: created.id,
      });
      return {
        id: created.id,
        created: true,
        updated: false,
        mirrorFailed: false,
      };
    }
    await tx.submission.update({
      where: { id },
      data: {
        githubUrl: input.githubUrl,
        linkedinUrl: input.linkedinUrl,
        status: input.status,
        submittedAt: input.submittedAt,
      },
    });
    await dualWriteSubmissionAttempt(tx, payload);
    return { id, created: false, updated: true, mirrorFailed: false };
  }

  await upsertSubmissionAttemptRows(tx, payload);
  const mirrorFailed = await runLegacyProgressMirror(
    tx,
    "submission",
    input.mode === "create" ? "submitDayCreate" : "submitDayUpdate",
    async () => {
      if (input.mode === "create") {
        await tx.submission.create({
          data: {
            id,
            userId: input.userId,
            enrollmentId: input.enrollmentId,
            dailyTaskId: input.dailyTaskId,
            dayNumber: input.dayNumber,
            githubUrl: input.githubUrl,
            linkedinUrl: input.linkedinUrl,
            status: input.status,
            submittedAt: input.submittedAt,
          },
        });
      } else {
        await tx.submission.update({
          where: { id },
          data: {
            githubUrl: input.githubUrl,
            linkedinUrl: input.linkedinUrl,
            status: input.status,
            submittedAt: input.submittedAt,
          },
        });
      }
    },
  );
  return {
    id,
    created: input.mode === "create",
    updated: input.mode === "update",
    mirrorFailed,
  };
}

export type QuizAttemptWrite = {
  id?: string;
  userId: string;
  enrollmentId: string;
  quizId: string;
  score: number;
  answers: Prisma.InputJsonValue;
  attemptedAt: Date;
};

export async function findQuizAttemptId(
  tx: Tx,
  input: { userId: string; quizId: string; enrollmentId: string },
): Promise<string | null> {
  const existing = await tx.quizAttempt.findUnique({
    where: { userId_quizId: { userId: input.userId, quizId: input.quizId } },
    select: { id: true },
  });
  if (existing) return existing.id;
  if (!isNewProgressWritesEnabled()) return null;
  const attempt = await tx.activityAttempt.findUnique({
    where: {
      enrollmentId_activityId_attemptNumber: {
        enrollmentId: peIdForEnrollment(input.enrollmentId),
        activityId: activityIdForQuiz(input.quizId),
        attemptNumber: 1,
      },
    },
    select: { id: true },
  });
  return attempt ? quizAttemptIdFromAttemptId(attempt.id) : null;
}

export async function applyQuizAttemptChange(
  tx: Tx,
  input: QuizAttemptWrite,
): Promise<ApplyProgressResult> {
  if (!isNewProgressWritesEnabled()) {
    const created = await tx.quizAttempt.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        userId: input.userId,
        quizId: input.quizId,
        score: input.score,
        answers: input.answers,
        attemptedAt: input.attemptedAt,
      },
      select: { id: true, attemptedAt: true },
    });
    await dualWriteQuizAttempt(tx, {
      id: created.id,
      enrollmentId: input.enrollmentId,
      quizId: input.quizId,
      score: input.score,
      answers: input.answers,
      attemptedAt: created.attemptedAt,
    });
    return {
      id: created.id,
      created: true,
      updated: false,
      mirrorFailed: false,
    };
  }

  const id = input.id ?? mintProgressRowId();
  const attemptedAt = input.attemptedAt;
  await upsertQuizAttemptRows(tx, {
    id,
    enrollmentId: input.enrollmentId,
    quizId: input.quizId,
    score: input.score,
    answers: input.answers,
    attemptedAt,
  });
  const mirrorFailed = await runLegacyProgressMirror(
    tx,
    "quiz",
    "submitQuiz",
    async () => {
      await tx.quizAttempt.create({
        data: {
          id,
          userId: input.userId,
          quizId: input.quizId,
          score: input.score,
          answers: input.answers,
          attemptedAt,
        },
      });
    },
  );
  return { id, created: true, updated: false, mirrorFailed };
}

export type ProgramMissionAttemptWrite = {
  id?: string;
  memberId: string;
  programDayId: string;
  dayNumber: number;
  attemptNumber: number;
  payload: Prisma.InputJsonValue;
  verdict: Prisma.InputJsonValue;
  passed: boolean;
  pointsAwarded: number;
  createdAt: Date;
};

export async function applyProgramMissionAttemptChange(
  tx: Tx,
  input: ProgramMissionAttemptWrite,
): Promise<ApplyProgressResult> {
  if (!isNewProgressWritesEnabled()) {
    const created = await tx.programMissionSubmission.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        memberId: input.memberId,
        dayNumber: input.dayNumber,
        attemptNumber: input.attemptNumber,
        payload: input.payload,
        verdict: input.verdict,
        passed: input.passed,
        pointsAwarded: input.pointsAwarded,
        createdAt: input.createdAt,
      },
      select: { id: true, createdAt: true },
    });
    await dualWriteMissionAttempt(tx, {
      id: created.id,
      memberId: input.memberId,
      programDayId: input.programDayId,
      attemptNumber: input.attemptNumber,
      payload: input.payload,
      verdict: input.verdict,
      passed: input.passed,
      pointsAwarded: input.pointsAwarded,
      createdAt: created.createdAt,
    });
    return {
      id: created.id,
      created: true,
      updated: false,
      mirrorFailed: false,
    };
  }

  const id = input.id ?? mintProgressRowId();
  await upsertMissionAttemptRows(tx, {
    id,
    memberId: input.memberId,
    programDayId: input.programDayId,
    attemptNumber: input.attemptNumber,
    payload: input.payload,
    verdict: input.verdict,
    passed: input.passed,
    pointsAwarded: input.pointsAwarded,
    createdAt: input.createdAt,
  });
  const mirrorFailed = await runLegacyProgressMirror(
    tx,
    "mission",
    "verifyMission",
    async () => {
      await tx.programMissionSubmission.create({
        data: {
          id,
          memberId: input.memberId,
          dayNumber: input.dayNumber,
          attemptNumber: input.attemptNumber,
          payload: input.payload,
          verdict: input.verdict,
          passed: input.passed,
          pointsAwarded: input.pointsAwarded,
          createdAt: input.createdAt,
        },
      });
    },
  );
  return { id, created: true, updated: false, mirrorFailed };
}

export async function applyDeleteChallengeSubmission(
  tx: Tx,
  submissionId: string,
): Promise<{ mirrorFailed: boolean }> {
  if (!isNewProgressWritesEnabled()) {
    await tx.submission.delete({ where: { id: submissionId } });
    await dualWriteDeleteSubmissionAttempt(tx, submissionId);
    return { mirrorFailed: false };
  }
  await tx.activityAttempt.deleteMany({
    where: { id: `aa_sub_${submissionId}` },
  });
  const mirrorFailed = await runLegacyProgressMirror(
    tx,
    "submission",
    "deleteSubmission",
    async () => {
      await tx.submission.deleteMany({ where: { id: submissionId } });
    },
  );
  return { mirrorFailed };
}

export async function applyDeleteEnrollmentChallengeAttempts(
  tx: Tx,
  enrollmentId: string,
): Promise<{ mirrorFailed: boolean }> {
  if (!isNewProgressWritesEnabled()) {
    await tx.submission.deleteMany({ where: { enrollmentId } });
    await dualWriteDeleteEnrollmentSubmissions(tx, enrollmentId);
    return { mirrorFailed: false };
  }
  await tx.activityAttempt.deleteMany({
    where: {
      enrollmentId: peIdForEnrollment(enrollmentId),
      id: { startsWith: "aa_sub_" },
    },
  });
  const mirrorFailed = await runLegacyProgressMirror(
    tx,
    "submission",
    "resetSubmissions",
    async () => {
      await tx.submission.deleteMany({ where: { enrollmentId } });
    },
  );
  return { mirrorFailed };
}

export async function applyDeleteProgramMissionAttempt(
  tx: Tx,
  missionSubmissionId: string,
): Promise<{ mirrorFailed: boolean }> {
  if (!isNewProgressWritesEnabled()) {
    await dualWriteDeleteMissionAttempt(tx, missionSubmissionId);
    await tx.programMissionSubmission.deleteMany({
      where: { id: missionSubmissionId },
    });
    return { mirrorFailed: false };
  }
  await tx.activityAttempt.deleteMany({
    where: { id: `aa_ms_${missionSubmissionId}` },
  });
  const mirrorFailed = await runLegacyProgressMirror(
    tx,
    "mission",
    "deleteMission",
    async () => {
      await tx.programMissionSubmission.deleteMany({
        where: { id: missionSubmissionId },
      });
    },
  );
  return { mirrorFailed };
}
