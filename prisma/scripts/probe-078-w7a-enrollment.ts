/**
 * Controlled W7-A production probe: dedicated @abtalks.dev user.
 * Does not touch a real learner. Cleans up after itself.
 *
 * Requires PHASE2_ALLOW_PRODUCTION=1, ENABLE_NEW_ENROLLMENT_STATE=true,
 * ENABLE_LEGACY_ENROLLMENT_DENORM_MIRROR=true.
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
  peIdForEnrollment,
} from "../../src/repositories/ids";

async function main() {
  process.env.ENABLE_NEW_ENROLLMENT_STATE = "true";
  process.env.ENABLE_LEGACY_ENROLLMENT_DENORM_MIRROR = "true";
  process.env.ENABLE_NEW_PROGRESS = "true";
  process.env.ENABLE_NEW_PROGRESS_WRITES = "true";
  process.env.ENABLE_LEGACY_PROGRESS_MIRROR = "false";
  process.env.ENABLE_DUAL_WRITE = "true";

  assertChildBranch();
  const {
    isLegacyEnrollmentDenormMirrorEnabled,
    isNewEnrollmentStateEnabled,
  } = await import("../../src/lib/feature-flags");
  if (!isNewEnrollmentStateEnabled()) {
    throw new Error("ENABLE_NEW_ENROLLMENT_STATE must be true for this probe");
  }
  if (!isLegacyEnrollmentDenormMirrorEnabled()) {
    throw new Error("ENABLE_LEGACY_ENROLLMENT_DENORM_MIRROR must stay on");
  }

  const { writeClient } = await import("../../src/lib/db");
  const { applyChallengeSubmissionChange, applyDeleteChallengeSubmission } =
    await import("../../src/repositories/progress-writes");
  const { applyEnrollmentProgressDenorm } = await import(
    "../../src/repositories/enrollment-state"
  );
  const prisma = writeClient();
  const stamp = Date.now().toString(36);
  const email = `w7a-probe-${stamp}@abtalks.dev`;
  const submissionId = `w7ap_${stamp}`;

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
    data: { email, name: "W7A Probe" },
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
  await prisma.programEnrollment.create({
    data: {
      id: peIdForEnrollment(enrollment.id),
      userId: user.id,
      cohortId: cohort.id,
      status: EnrollmentStatusV2.ACTIVE,
      startedAt: new Date(),
      enrolledAt: new Date(),
    },
  });

  try {
    const githubUrl = `https://github.com/w7a-probe-${stamp}/repo`;
    await prisma.$transaction(async (tx) => {
      await applyChallengeSubmissionChange(tx, {
        id: submissionId,
        userId: user.id,
        enrollmentId: enrollment.id,
        dailyTaskId: task.id,
        dayNumber: task.dayNumber,
        githubUrl,
        linkedinUrl: null,
        status: SubmissionStatus.ON_TIME,
        submittedAt: new Date(),
        pointsAwarded: 0,
        mode: "create",
      });
      await applyEnrollmentProgressDenorm(tx, {
        enrollmentId: enrollment.id,
        daysCompleted: 1,
        currentStreak: 1,
        longestStreak: 1,
        lastSubmittedDay: task.dayNumber,
      });
    });

    const pe = await prisma.programEnrollment.findUnique({
      where: { id: peIdForEnrollment(enrollment.id) },
      select: { trackCurrentStreak: true, trackLongestStreak: true },
    });
    const legacy = await prisma.enrollment.findUnique({
      where: { id: enrollment.id },
      select: { daysCompleted: true, currentStreak: true },
    });
    const aa = await prisma.activityAttempt.findUnique({
      where: { id: `aa_sub_${submissionId}` },
      select: { passed: true },
    });
    const sp = await prisma.studentProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!aa?.passed) throw new Error("canonical AA missing");
    if (pe?.trackCurrentStreak !== 1) throw new Error("PE snapshot");
    if (legacy?.daysCompleted !== 1 || legacy.currentStreak !== 1) {
      throw new Error("legacy mirror");
    }
    if (sp) throw new Error("probe must not mint StudentProfile");
    process.stdout.write(
      JSON.stringify(
        {
          email,
          pe,
          legacy,
          domainMirrorNoop: true,
        },
        null,
        2,
      ) + "\n",
    );

    await prisma.$transaction(async (tx) => {
      await applyDeleteChallengeSubmission(tx, submissionId);
    });
  } finally {
    await prisma.activityAttempt.deleteMany({
      where: { enrollmentId: peIdForEnrollment(enrollment.id) },
    });
    await prisma.programEnrollment.delete({
      where: { id: peIdForEnrollment(enrollment.id) },
    });
    await prisma.enrollment.delete({ where: { id: enrollment.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
