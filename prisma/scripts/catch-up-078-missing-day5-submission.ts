/**
 * Targeted 078 catch-up for one missed Day-5 dual-write, plus SP-only
 * snapshot repairs where User == PointsAccount and StudentProfile drifted.
 *
 * Submission.id = cmtcz02hy0001vfat1968kfmg
 *
 * Does NOT:
 * - create SynergyEvent
 * - increment User.synergyPoints / StudentProfile.synergyPoints for the catch-up
 * - rewrite PointsTransaction history
 * - run the blanket PA→User/SP mirror repair
 * - touch V4 / V7 rows
 *
 * Dry-run unless --apply. Production: PHASE2_ALLOW_PRODUCTION=1 + direct host.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

if (process.env.DATABASE_URL?.includes("-pooler.")) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace("-pooler.", ".");
}

import {
  AttemptLateness,
  AttemptStatus,
  EvaluatorType,
  PointsSourceType,
  PrismaClient,
} from "@prisma/client";
import { SYNERGY_BASE_SUBMISSION } from "../../src/features/synergy/scoring";
import {
  activityIdForDailyTask,
  attemptIdForSubmission,
  peIdForEnrollment,
} from "../../src/repositories/ids";
import { assertChildBranch } from "./migrate-078-shared";

const TARGET_SUBMISSION_ID = "cmtcz02hy0001vfat1968kfmg";
const EVAL_ID = `ev_sub_${TARGET_SUBMISSION_ID}`;
const IDEMPOTENCY_KEY = `submission:${TARGET_SUBMISSION_ID}`;
const TX_OPTS = { maxWait: 20000, timeout: 20000 } as const;

const prisma = new PrismaClient();

type WalletSnap = {
  paBalance: number | null;
  paLifetimeEarned: number | null;
  paVersion: number | null;
  ledgerSum: number;
  ledgerCount: number;
  userSynergy: number | null;
  profileSynergy: number | null;
  eventSum: number;
  eventCount: number;
};

async function snapshot(userId: string): Promise<WalletSnap> {
  const [pa, ledger, user, profile, events] = await Promise.all([
    prisma.pointsAccount.findUnique({
      where: { userId },
      select: { balance: true, lifetimeEarned: true, version: true },
    }),
    prisma.pointsTransaction.aggregate({
      where: { userId },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { synergyPoints: true },
    }),
    prisma.studentProfile.findUnique({
      where: { userId },
      select: { synergyPoints: true },
    }),
    prisma.synergyEvent.aggregate({
      where: { userId },
      _sum: { points: true },
      _count: true,
    }),
  ]);
  return {
    paBalance: pa?.balance ?? null,
    paLifetimeEarned: pa?.lifetimeEarned ?? null,
    paVersion: pa?.version ?? null,
    ledgerSum: ledger._sum.amount ?? 0,
    ledgerCount: ledger._count,
    userSynergy: user?.synergyPoints ?? null,
    profileSynergy: profile?.synergyPoints ?? null,
    eventSum: events._sum.points ?? 0,
    eventCount: events._count,
  };
}

async function listSpOnlyDrift() {
  return prisma.$queryRaw<
    Array<{
      userId: string;
      email: string;
      paBalance: number;
      userSynergy: number;
      profileSynergy: number;
    }>
  >`
    SELECT pa."userId" AS "userId",
           u.email AS email,
           pa.balance AS "paBalance",
           u."synergyPoints" AS "userSynergy",
           sp."synergyPoints" AS "profileSynergy"
      FROM "PointsAccount" pa
      JOIN "User" u ON u.id = pa."userId"
      JOIN "StudentProfile" sp ON sp."userId" = pa."userId"
     WHERE u."synergyPoints" = pa.balance
       AND sp."synergyPoints" <> pa.balance
     ORDER BY pa."userId"
  `;
}

async function validateTarget() {
  const submission = await prisma.submission.findUnique({
    where: { id: TARGET_SUBMISSION_ID },
    select: {
      id: true,
      userId: true,
      enrollmentId: true,
      dailyTaskId: true,
      dayNumber: true,
      githubUrl: true,
      linkedinUrl: true,
      status: true,
      submittedAt: true,
    },
  });
  if (!submission) {
    throw new Error(`Submission ${TARGET_SUBMISSION_ID} not found`);
  }
  if (submission.dayNumber !== 5) {
    throw new Error(`expected day 5, got ${submission.dayNumber}`);
  }

  const event = await prisma.synergyEvent.findUnique({
    where: { submissionId: TARGET_SUBMISSION_ID },
    select: {
      id: true,
      userId: true,
      points: true,
      type: true,
      reason: true,
      createdAt: true,
    },
  });
  if (!event) {
    throw new Error("legacy SynergyEvent missing; refusing to invent a reward");
  }
  if (event.type !== "SUBMISSION" || event.points !== SYNERGY_BASE_SUBMISSION) {
    throw new Error(
      `legacy event is ${event.type}/${event.points}, expected SUBMISSION/${SYNERGY_BASE_SUBMISSION}`,
    );
  }
  if (event.userId !== submission.userId) {
    throw new Error("SynergyEvent userId does not match Submission");
  }

  const pe = await prisma.programEnrollment.findUnique({
    where: { id: peIdForEnrollment(submission.enrollmentId) },
    select: { id: true },
  });
  if (!pe) {
    throw new Error(
      `ProgramEnrollment ${peIdForEnrollment(submission.enrollmentId)} missing`,
    );
  }
  const activity = await prisma.activity.findUnique({
    where: { id: activityIdForDailyTask(submission.dailyTaskId) },
    select: { id: true },
  });
  if (!activity) {
    throw new Error(
      `Activity ${activityIdForDailyTask(submission.dailyTaskId)} missing`,
    );
  }

  const [attempt, evaluation, txn] = await Promise.all([
    prisma.activityAttempt.findUnique({
      where: { id: attemptIdForSubmission(submission.id) },
      select: { id: true, pointsAwarded: true },
    }),
    prisma.activityEvaluation.findUnique({
      where: { id: EVAL_ID },
      select: { id: true },
    }),
    prisma.pointsTransaction.findUnique({
      where: { idempotencyKey: IDEMPOTENCY_KEY },
      select: { id: true, amount: true, userId: true, createdAt: true },
    }),
  ]);
  if (txn && txn.amount !== SYNERGY_BASE_SUBMISSION) {
    throw new Error(
      `existing PointsTransaction amount ${txn.amount} != ${SYNERGY_BASE_SUBMISSION}`,
    );
  }
  if (txn && txn.userId !== submission.userId) {
    throw new Error("existing PointsTransaction userId mismatch");
  }

  return { submission, event, attempt, evaluation, txn };
}

async function catchUpSubmission(apply: boolean) {
  const { submission, event, attempt, evaluation, txn } = await validateTarget();
  const before = await snapshot(submission.userId);
  const plan = {
    submissionId: submission.id,
    userId: submission.userId,
    attemptId: attemptIdForSubmission(submission.id),
    evaluationId: EVAL_ID,
    idempotencyKey: IDEMPOTENCY_KEY,
    amount: SYNERGY_BASE_SUBMISSION,
    wouldCreateAttempt: !attempt,
    wouldCreateEvaluation: !evaluation,
    wouldCreateTransaction: !txn,
    wouldIncrementAccount: !txn,
    freezeLegacy:
      "no SynergyEvent create; no User/StudentProfile synergy increment",
  };

  if (!apply) {
    return { apply, before, plan, after: before };
  }

  await prisma.$transaction(async (tx) => {
    await tx.activityAttempt.upsert({
      where: { id: attemptIdForSubmission(submission.id) },
      create: {
        id: attemptIdForSubmission(submission.id),
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
        pointsAwarded: SYNERGY_BASE_SUBMISSION,
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
        pointsAwarded: SYNERGY_BASE_SUBMISSION,
      },
    });
    await tx.activityEvaluation.upsert({
      where: { id: EVAL_ID },
      create: {
        id: EVAL_ID,
        attemptId: attemptIdForSubmission(submission.id),
        evaluatorType: EvaluatorType.AUTO,
        passed: true,
        score: 100,
        maxScore: 100,
        isAuthoritative: true,
        createdAt: submission.submittedAt,
      },
      update: { passed: true },
    });

    const existingTxn = await tx.pointsTransaction.findUnique({
      where: { idempotencyKey: IDEMPOTENCY_KEY },
      select: { id: true, amount: true },
    });
    if (!existingTxn) {
      await tx.pointsTransaction.create({
        data: {
          userId: submission.userId,
          amount: SYNERGY_BASE_SUBMISSION,
          sourceType: PointsSourceType.ACTIVITY_ATTEMPT,
          sourceId: submission.id,
          idempotencyKey: IDEMPOTENCY_KEY,
          reason: event.reason ?? `submission day ${submission.dayNumber}`,
          createdAt: event.createdAt,
        },
      });
      const account = await tx.pointsAccount.updateMany({
        where: { userId: submission.userId },
        data: {
          balance: { increment: SYNERGY_BASE_SUBMISSION },
          lifetimeEarned: { increment: SYNERGY_BASE_SUBMISSION },
          version: { increment: 1 },
          reconciledAt: new Date(),
        },
      });
      if (account.count !== 1) {
        throw new Error("PointsAccount increment did not match one row");
      }
    } else if (existingTxn.amount !== SYNERGY_BASE_SUBMISSION) {
      throw new Error(
        `refusing to reuse idempotency key with amount ${existingTxn.amount}`,
      );
    }
  }, TX_OPTS);

  const after = await snapshot(submission.userId);
  if (after.userSynergy !== before.userSynergy) {
    throw new Error("User.synergyPoints changed; catch-up must freeze it");
  }
  if (after.profileSynergy !== before.profileSynergy) {
    throw new Error(
      "StudentProfile.synergyPoints changed; catch-up must freeze it",
    );
  }
  if (after.eventCount !== before.eventCount || after.eventSum !== before.eventSum) {
    throw new Error("SynergyEvent changed; catch-up must not write events");
  }
  if (after.paBalance !== after.userSynergy) {
    throw new Error(
      `PointsAccount ${after.paBalance} != User.synergyPoints ${after.userSynergy}`,
    );
  }
  if (after.ledgerSum !== after.paBalance) {
    throw new Error(
      `SUM(PointsTransaction) ${after.ledgerSum} != PointsAccount ${after.paBalance}`,
    );
  }
  return { apply, before, plan, after };
}

async function repairSpOnly(apply: boolean) {
  const before = await listSpOnlyDrift();
  if (!apply) {
    return { apply, before, updated: 0, after: before };
  }
  const updated = await prisma.$executeRaw`
    UPDATE "StudentProfile" sp
       SET "synergyPoints" = pa.balance
      FROM "PointsAccount" pa
      JOIN "User" u ON u.id = pa."userId"
     WHERE sp."userId" = pa."userId"
       AND u."synergyPoints" = pa.balance
       AND sp."synergyPoints" <> pa.balance
  `;
  const after = await listSpOnlyDrift();
  return { apply, before, updated: Number(updated), after };
}

async function main() {
  assertChildBranch();
  const apply = process.argv.includes("--apply");

  const submission = await catchUpSubmission(apply);
  const spOnly = await repairSpOnly(apply);

  console.log(
    JSON.stringify(
      {
        apply,
        targetSubmissionId: TARGET_SUBMISSION_ID,
        submission,
        spOnly,
      },
      null,
      2,
    ),
  );

  if (!apply) {
    console.log("Dry run. Pass --apply to mutate.");
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.stack ?? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
