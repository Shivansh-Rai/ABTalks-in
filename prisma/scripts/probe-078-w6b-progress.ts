/**
 * Controlled W6-B production probe: one challenge-like attempt for a dedicated
 * @abtalks.dev user. Does not touch a real learner. Cleans up after itself.
 *
 * Requires PHASE2_ALLOW_PRODUCTION=1, ENABLE_NEW_PROGRESS_WRITES=true,
 * ENABLE_LEGACY_PROGRESS_MIRROR=false.
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
import {
  activityIdForDailyTask,
  attemptIdForSubmission,
  peIdForEnrollment,
} from "../../src/repositories/ids";

async function main() {
  process.env.ENABLE_NEW_PROGRESS = "true";
  process.env.ENABLE_NEW_PROGRESS_WRITES = "true";
  process.env.ENABLE_LEGACY_PROGRESS_MIRROR = "false";
  process.env.ENABLE_DUAL_WRITE = "true";

  assertChildBranch();
  const { isNewProgressWritesEnabled, isLegacyProgressMirrorEnabled } =
    await import("../../src/lib/feature-flags");
  if (!isNewProgressWritesEnabled()) {
    throw new Error("ENABLE_NEW_PROGRESS_WRITES must be true for this probe");
  }
  if (isLegacyProgressMirrorEnabled()) {
    throw new Error("ENABLE_LEGACY_PROGRESS_MIRROR must be false for this probe");
  }

  const { writeClient } = await import("../../src/lib/db");
  const { applyChallengeSubmissionChange, applyDeleteChallengeSubmission } =
    await import("../../src/repositories/progress-writes");
  const prisma = writeClient();
  const stamp = Date.now().toString(36);
  const email = `w6b-probe-${stamp}@abtalks.dev`;
  const submissionId = `w6bp_${stamp}`;

  const before = {
    submission: await prisma.submission.count(),
    quizAttempt: await prisma.quizAttempt.count(),
    mission: await prisma.programMissionSubmission.count(),
  };

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
  if (!activity) throw new Error("missing Activity for DailyTask");
  const cohort = await prisma.cohort.findFirst({
    where: { slug: { startsWith: "legacy-" } },
    select: { id: true },
  });
  if (!cohort) throw new Error("missing legacy cohort");

  const user = await prisma.user.create({
    data: { email, name: "W6B Probe" },
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
  await prisma.programEnrollment.create({
    data: {
      id: peId,
      userId: user.id,
      cohortId: cohort.id,
      status: EnrollmentStatusV2.ACTIVE,
      startedAt: new Date(),
      enrolledAt: new Date(),
    },
  });

  try {
    const submittedAt = new Date();
    await prisma.$transaction(async (tx) => {
      await applyChallengeSubmissionChange(tx, {
        id: submissionId,
        userId: user.id,
        enrollmentId: enrollment.id,
        dailyTaskId: task.id,
        dayNumber: task.dayNumber,
        githubUrl: null,
        linkedinUrl: null,
        status: SubmissionStatus.ON_TIME,
        submittedAt,
        pointsAwarded: 0,
        mode: "create",
      });
    });
    await prisma.$transaction(async (tx) => {
      await applyChallengeSubmissionChange(tx, {
        id: submissionId,
        userId: user.id,
        enrollmentId: enrollment.id,
        dailyTaskId: task.id,
        dayNumber: task.dayNumber,
        githubUrl: null,
        linkedinUrl: null,
        status: SubmissionStatus.ON_TIME,
        submittedAt: new Date(),
        pointsAwarded: 0,
        mode: "update",
      });
    });

    const canonical = await prisma.activityAttempt.findUnique({
      where: { id: attemptIdForSubmission(submissionId) },
      select: { id: true, passed: true },
    });
    const evalRow = await prisma.activityEvaluation.findUnique({
      where: { id: `ev_sub_${submissionId}` },
      select: { passed: true, score: true },
    });
    const legacy = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: { id: true },
    });
    const after = {
      submission: await prisma.submission.count(),
      quizAttempt: await prisma.quizAttempt.count(),
      mission: await prisma.programMissionSubmission.count(),
    };
    if (!canonical?.passed) throw new Error("canonical missing");
    if (!evalRow?.passed) throw new Error("evaluation missing");
    if (legacy) throw new Error("legacy Submission was written");
    if (after.submission !== before.submission) throw new Error("Submission count changed");
    if (after.quizAttempt !== before.quizAttempt) throw new Error("QuizAttempt count changed");
    if (after.mission !== before.mission) throw new Error("PMS count changed");

    await prisma.$transaction(async (tx) => {
      await applyDeleteChallengeSubmission(tx, submissionId);
    });

    console.log(
      JSON.stringify(
        {
          email,
          canonical: { id: canonical.id, passed: canonical.passed },
          evaluation: evalRow,
          legacyAbsent: true,
          retrySameAttempt: true,
          legacyCountsUnchanged: true,
          cleaned: true,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.activityAttempt.deleteMany({
      where: { id: attemptIdForSubmission(submissionId) },
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
