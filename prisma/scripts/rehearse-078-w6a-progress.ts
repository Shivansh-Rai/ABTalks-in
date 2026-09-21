/**
 * Child-only W6-A progress write-authority rehearsal.
 * ENABLE_NEW_PROGRESS=true ENABLE_NEW_PROGRESS_WRITES=true
 * ENABLE_LEGACY_PROGRESS_MIRROR=true
 * Refuses production. Cleans up the @abtalks.dev fixture.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

if (process.env.DATABASE_URL?.includes("-pooler.")) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace("-pooler.", ".");
}
process.env.DIRECT_URL = process.env.DATABASE_URL;

import { EnrollmentStatusV2, SubmissionStatus } from "@prisma/client";
import { assertChildBranch } from "./migrate-078-shared";
import { activityIdForDailyTask, peIdForEnrollment } from "../../src/repositories/ids";

async function db() {
  const { writeClient } = await import("../../src/lib/db");
  return writeClient();
}

function log(label: string, value: unknown): void {
  process.stdout.write(
    `${label}: ${typeof value === "string" ? value : JSON.stringify(value)}\n`,
  );
}

async function main() {
  process.env.ENABLE_NEW_PROGRESS = "true";
  process.env.ENABLE_NEW_PROGRESS_WRITES = "true";
  process.env.ENABLE_LEGACY_PROGRESS_MIRROR = "true";
  process.env.ENABLE_DUAL_WRITE = "true";
  delete process.env.PROGRESS_FAIL_LEGACY_MIRROR;

  assertChildBranch();
  const {
    isNewProgressWritesEnabled,
    isLegacyProgressMirrorEnabled,
  } = await import("../../src/lib/feature-flags");
  if (!isNewProgressWritesEnabled()) throw new Error("writes must be on");
  if (!isLegacyProgressMirrorEnabled()) throw new Error("mirror must be on");

  const prisma = await db();
  const {
    applyChallengeSubmissionChange,
    applyDeleteChallengeSubmission,
    applyQuizAttemptChange,
    applyProgramMissionAttemptChange,
  } = await import("../../src/repositories/progress-writes");

  const stamp = Date.now().toString(36);
  const email = `w6a-rehearse-${stamp}@abtalks.dev`;

  const challenge = await prisma.challenge.findFirst({
    select: { id: true, domain: true },
  });
  if (!challenge) throw new Error("no Challenge");
  const task = await prisma.dailyTask.findFirst({
    where: { challengeId: challenge.id },
    select: { id: true, dayNumber: true },
  });
  if (!task) throw new Error("no DailyTask");
  const activity = await prisma.activity.findUnique({
    where: { id: activityIdForDailyTask(task.id) },
    select: { id: true },
  });
  if (!activity) throw new Error(`missing Activity ${activityIdForDailyTask(task.id)}`);

  const user = await prisma.user.create({
    data: { email, name: "W6A Rehearse" },
    select: { id: true },
  });
  const enrollment = await prisma.enrollment.create({
    data: {
      userId: user.id,
      challengeId: challenge.id,
      domain: challenge.domain,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  const peId = peIdForEnrollment(enrollment.id);
  const cohort = await prisma.cohort.findFirst({
    where: { slug: { startsWith: "legacy-" } },
    select: { id: true },
  });
  if (!cohort) throw new Error("missing legacy cohort");
  await prisma.programEnrollment.upsert({
    where: { id: peId },
    create: {
      id: peId,
      userId: user.id,
      cohortId: cohort.id,
      status: EnrollmentStatusV2.ACTIVE,
      startedAt: new Date(),
      enrolledAt: new Date(),
    },
    update: {},
  });

  try {
    const submittedAt = new Date("2026-09-21T10:00:00.000Z");
    await prisma.$transaction(async (tx) => {
      await applyChallengeSubmissionChange(tx, {
        id: `sub_${stamp}`,
        userId: user.id,
        enrollmentId: enrollment.id,
        dailyTaskId: task.id,
        dayNumber: task.dayNumber,
        githubUrl: null,
        linkedinUrl: null,
        status: SubmissionStatus.ON_TIME,
        submittedAt,
        pointsAwarded: 10,
        mode: "create",
      });
    });
    const aa = await prisma.activityAttempt.findUnique({
      where: { id: `aa_sub_sub_${stamp}` },
      select: { passed: true, lateness: true, pointsAwarded: true },
    });
    const sub = await prisma.submission.findUnique({
      where: { id: `sub_${stamp}` },
      select: { id: true, status: true },
    });
    if (!aa?.passed) throw new Error("apply: canonical missing");
    if (!sub) throw new Error("apply: legacy mirror missing");
    log("challenge-apply", { aa, sub });

    await prisma.$transaction(async (tx) => {
      await applyChallengeSubmissionChange(tx, {
        id: `sub_${stamp}`,
        userId: user.id,
        enrollmentId: enrollment.id,
        dailyTaskId: task.id,
        dayNumber: task.dayNumber,
        githubUrl: null,
        linkedinUrl: null,
        status: SubmissionStatus.ON_TIME,
        submittedAt: new Date("2026-09-21T11:00:00.000Z"),
        pointsAwarded: 0,
        mode: "update",
      });
    });
    const attempts = await prisma.activityAttempt.count({
      where: { id: `aa_sub_sub_${stamp}` },
    });
    if (attempts !== 1) throw new Error("retry duplicated attempt");
    log("challenge-retry", { attempts });

    const quiz = await prisma.quiz.findFirst({
      where: { challengeId: challenge.id },
      select: { id: true },
    });
    if (quiz) {
      const quizActivity = await prisma.activity.findUnique({
        where: { id: `act_quiz_${quiz.id}` },
        select: { id: true },
      });
      if (quizActivity) {
        await prisma.$transaction(async (tx) => {
          await applyQuizAttemptChange(tx, {
            id: `qa_${stamp}`,
            userId: user.id,
            enrollmentId: enrollment.id,
            quizId: quiz.id,
            score: 40,
            answers: { old: "A" },
            attemptedAt: submittedAt,
          });
        });
        const qaAa = await prisma.activityAttempt.findUnique({
          where: { id: `aa_qa_qa_${stamp}` },
          select: { passed: true, score: true },
        });
        const qa = await prisma.quizAttempt.findUnique({
          where: { id: `qa_${stamp}` },
          select: { score: true },
        });
        if (!qaAa || qaAa.passed !== false || qaAa.score !== 40) {
          throw new Error("quiz canonical");
        }
        if (qa?.score !== 40) throw new Error("quiz mirror");
        log("quiz", { qaAa, qa });
      }
    }

    const member = await prisma.programMember.findFirst({
      where: { status: "ENROLLED" },
      select: { id: true },
    });
    const day = await prisma.programDay.findFirst({
      where: { dayNumber: 1 },
      select: { id: true, dayNumber: true },
    });
    if (member && day) {
      const pePm = `pe_pm_${member.id}`;
      const peExists = await prisma.programEnrollment.findUnique({
        where: { id: pePm },
        select: { id: true },
      });
      const dayActivity = await prisma.activity.findUnique({
        where: { id: `act_pd_${day.id}` },
        select: { id: true },
      });
      if (peExists && dayActivity) {
        await prisma.$transaction(async (tx) => {
          await applyProgramMissionAttemptChange(tx, {
            id: `pmsf_${stamp}`,
            memberId: member.id,
            programDayId: day.id,
            dayNumber: day.dayNumber,
            attemptNumber: 9001,
            payload: { rehearsed: true },
            verdict: [{ check: "rehearse", passed: false }],
            passed: false,
            pointsAwarded: 0,
            createdAt: submittedAt,
          });
          await applyProgramMissionAttemptChange(tx, {
            id: `pmsp_${stamp}`,
            memberId: member.id,
            programDayId: day.id,
            dayNumber: day.dayNumber,
            attemptNumber: 9002,
            payload: { rehearsed: true },
            verdict: [{ check: "rehearse", passed: true }],
            passed: true,
            pointsAwarded: 0,
            createdAt: submittedAt,
          });
        });
        const fail = await prisma.activityAttempt.findUnique({
          where: { id: `aa_ms_pmsf_${stamp}` },
          select: { passed: true },
        });
        const pass = await prisma.activityAttempt.findUnique({
          where: { id: `aa_ms_pmsp_${stamp}` },
          select: { passed: true },
        });
        if (fail?.passed !== false || pass?.passed !== true) {
          throw new Error("mission fail→pass");
        }
        log("mission-fail-pass", { fail, pass });
        await prisma.activityAttempt.deleteMany({
          where: { id: { in: [`aa_ms_pmsf_${stamp}`, `aa_ms_pmsp_${stamp}`] } },
        });
        await prisma.programMissionSubmission.deleteMany({
          where: { id: { in: [`pmsf_${stamp}`, `pmsp_${stamp}`] } },
        });
      }
    }

    await prisma.$transaction(async (tx) => {
      await applyDeleteChallengeSubmission(tx, `sub_${stamp}`);
    });
    const afterDelete = await prisma.activityAttempt.findUnique({
      where: { id: `aa_sub_sub_${stamp}` },
      select: { id: true },
    });
    if (afterDelete) throw new Error("reject did not delete canonical");
    log("admin-reject", { deleted: true });

    process.stdout.write("W6-A rehearsal OK\n");
  } finally {
    await prisma.quizAttempt.deleteMany({ where: { id: `qa_${stamp}` } });
    await prisma.activityAttempt.deleteMany({
      where: {
        id: {
          in: [
            `aa_sub_sub_${stamp}`,
            `aa_qa_qa_${stamp}`,
            `aa_ms_pmsf_${stamp}`,
            `aa_ms_pmsp_${stamp}`,
          ],
        },
      },
    });
    await prisma.submission.deleteMany({ where: { id: `sub_${stamp}` } });
    await prisma.programMissionSubmission.deleteMany({
      where: { id: { in: [`pmsf_${stamp}`, `pmsp_${stamp}`] } },
    });
    await prisma.programEnrollment.deleteMany({ where: { id: peId } });
    await prisma.enrollment.deleteMany({ where: { id: enrollment.id } });
    await prisma.user.deleteMany({ where: { email } });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
