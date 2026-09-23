/**
 * Progress write boundary.
 *
 * Canonical writers are always ActivityAttempt + ActivityEvaluation.
 */
import "server-only";
import {
  AttemptLateness,
  AttemptStatus,
  EvaluatorType,
  type Prisma,
  type PrismaClient,
  type SubmissionStatus,
} from "@prisma/client";
import {
  activityIdForDailyTask,
  activityIdForProgramDay,
  activityIdForQuiz,
  attemptIdForMission,
  attemptIdForQuizAttempt,
  attemptIdForSubmission,
  mintProgressRowId,
  peIdForEnrollment,
  peIdForMember,
  quizAttemptIdFromAttemptId,
  submissionIdFromAttemptId,
} from "@/repositories/ids";

type Tx = Prisma.TransactionClient | PrismaClient;

async function upsertSubmissionAttemptRows(
  tx: Tx,
  submission: {
    id: string;
    enrollmentId: string;
    dailyTaskId: string;
    githubUrl: string | null;
    linkedinUrl: string | null;
    status: string;
    submittedAt: Date;
    pointsAwarded: number;
  },
): Promise<void> {
  const attemptId = attemptIdForSubmission(submission.id);
  await tx.activityAttempt.upsert({
    where: { id: attemptId },
    create: {
      id: attemptId,
      enrollmentId: peIdForEnrollment(submission.enrollmentId),
      activityId: activityIdForDailyTask(submission.dailyTaskId),
      attemptNumber: 1,
      status: AttemptStatus.EVALUATED,
      lateness:
        submission.status === "LATE"
          ? AttemptLateness.LATE
          : AttemptLateness.ON_TIME,
      payload: {
        githubUrl: submission.githubUrl,
        linkedinUrl: submission.linkedinUrl,
        legacySubmissionId: submission.id,
      },
      passed: true,
      pointsAwarded: submission.pointsAwarded,
      startedAt: submission.submittedAt,
      submittedAt: submission.submittedAt,
    },
    update: {
      payload: {
        githubUrl: submission.githubUrl,
        linkedinUrl: submission.linkedinUrl,
        legacySubmissionId: submission.id,
      },
      submittedAt: submission.submittedAt,
      passed: true,
      status: AttemptStatus.EVALUATED,
      lateness:
        submission.status === "LATE"
          ? AttemptLateness.LATE
          : AttemptLateness.ON_TIME,
      ...(submission.pointsAwarded > 0
        ? { pointsAwarded: submission.pointsAwarded }
        : {}),
    },
  });
  await tx.activityEvaluation.upsert({
    where: { id: `ev_sub_${submission.id}` },
    create: {
      id: `ev_sub_${submission.id}`,
      attemptId,
      evaluatorType: EvaluatorType.AUTO,
      passed: true,
      score: 100,
      maxScore: 100,
      isAuthoritative: true,
      createdAt: submission.submittedAt,
    },
    update: { passed: true },
  });
}

async function upsertQuizAttemptRows(
  tx: Tx,
  row: {
    id: string;
    enrollmentId: string;
    quizId: string;
    score: number;
    answers: Prisma.InputJsonValue;
    attemptedAt: Date;
  },
): Promise<void> {
  const attemptId = attemptIdForQuizAttempt(row.id);
  const passed = row.score >= 60;
  await tx.activityAttempt.upsert({
    where: { id: attemptId },
    create: {
      id: attemptId,
      enrollmentId: peIdForEnrollment(row.enrollmentId),
      activityId: activityIdForQuiz(row.quizId),
      attemptNumber: 1,
      status: AttemptStatus.EVALUATED,
      lateness: AttemptLateness.NOT_APPLICABLE,
      payload: {
        answers: row.answers,
        legacyQuizAttemptId: row.id,
      },
      passed,
      score: row.score,
      pointsAwarded: row.score,
      startedAt: row.attemptedAt,
      submittedAt: row.attemptedAt,
    },
    update: {
      payload: {
        answers: row.answers,
        legacyQuizAttemptId: row.id,
      },
      passed,
      score: row.score,
      pointsAwarded: row.score,
      submittedAt: row.attemptedAt,
      status: AttemptStatus.EVALUATED,
    },
  });
  await tx.activityEvaluation.upsert({
    where: { id: `ev_qa_${row.id}` },
    create: {
      id: `ev_qa_${row.id}`,
      attemptId,
      evaluatorType: EvaluatorType.AUTO,
      passed,
      score: row.score,
      maxScore: 100,
      isAuthoritative: true,
      createdAt: row.attemptedAt,
    },
    update: { passed, score: row.score },
  });
}

async function upsertMissionAttemptRows(
  tx: Tx,
  row: {
    id: string;
    memberId: string;
    programDayId: string;
    attemptNumber: number;
    payload: Prisma.InputJsonValue;
    verdict: Prisma.InputJsonValue;
    passed: boolean;
    pointsAwarded: number;
    createdAt: Date;
  },
): Promise<void> {
  const attemptId = attemptIdForMission(row.id);
  await tx.activityAttempt.upsert({
    where: { id: attemptId },
    create: {
      id: attemptId,
      enrollmentId: peIdForMember(row.memberId),
      activityId: activityIdForProgramDay(row.programDayId),
      attemptNumber: row.attemptNumber,
      status: AttemptStatus.EVALUATED,
      lateness: AttemptLateness.NOT_APPLICABLE,
      payload: {
        ...(typeof row.payload === "object" && row.payload && !Array.isArray(row.payload)
          ? (row.payload as Record<string, unknown>)
          : {}),
        legacyMissionSubmissionId: row.id,
      } as Prisma.InputJsonValue,
      passed: row.passed,
      pointsAwarded: row.pointsAwarded,
      startedAt: row.createdAt,
      submittedAt: row.createdAt,
    },
    update: {
      passed: row.passed,
      pointsAwarded: row.pointsAwarded,
      submittedAt: row.createdAt,
    },
  });
  await tx.activityEvaluation.upsert({
    where: { id: `ev_ms_${row.id}` },
    create: {
      id: `ev_ms_${row.id}`,
      attemptId,
      evaluatorType: EvaluatorType.AUTO,
      passed: row.passed,
      score: row.passed ? 100 : 0,
      maxScore: 100,
      detailJson: row.verdict,
      isAuthoritative: true,
      createdAt: row.createdAt,
    },
    update: { passed: row.passed, detailJson: row.verdict },
  });
}

export type ProgressMirrorFamily = "submission" | "quiz" | "mission";

export type ApplyProgressResult = {
  id: string;
  created: boolean;
  updated: boolean;
  mirrorFailed: boolean;
};

function isPrismaUniqueConflict(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
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
  void input.dayNumber;
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

  await upsertSubmissionAttemptRows(tx, payload);
  return {
    id,
    created: input.mode === "create",
    updated: input.mode === "update",
    mirrorFailed: false,
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
  void input.userId;
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
  return { id, created: true, updated: false, mirrorFailed: false };
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
  return { id, created: true, updated: false, mirrorFailed: false };
}

export async function applyDeleteChallengeSubmission(
  tx: Tx,
  submissionId: string,
): Promise<{ mirrorFailed: boolean }> {
  await tx.activityAttempt.deleteMany({
    where: { id: `aa_sub_${submissionId}` },
  });
  return { mirrorFailed: false };
}

export async function applyDeleteEnrollmentChallengeAttempts(
  tx: Tx,
  enrollmentId: string,
): Promise<{ mirrorFailed: boolean }> {
  await tx.activityAttempt.deleteMany({
    where: {
      enrollmentId: peIdForEnrollment(enrollmentId),
      id: { startsWith: "aa_sub_" },
    },
  });
  return { mirrorFailed: false };
}

export async function applyDeleteProgramMissionAttempt(
  tx: Tx,
  missionSubmissionId: string,
): Promise<{ mirrorFailed: boolean }> {
  await tx.activityAttempt.deleteMany({
    where: { id: `aa_ms_${missionSubmissionId}` },
  });
  return { mirrorFailed: false };
}
