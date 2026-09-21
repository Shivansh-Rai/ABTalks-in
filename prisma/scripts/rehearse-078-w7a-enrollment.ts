/**
 * Child-only W7-A rehearsal.
 * ENABLE_NEW_ENROLLMENT_STATE=true
 * ENABLE_LEGACY_ENROLLMENT_DENORM_MIRROR=true
 * ENABLE_NEW_PROGRESS=true ENABLE_NEW_PROGRESS_WRITES=true
 * ENABLE_LEGACY_PROGRESS_MIRROR=false
 * Refuses production. Cleans up @abtalks.dev fixtures.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

if (process.env.DATABASE_URL?.includes("-pooler.")) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace("-pooler.", ".");
}
process.env.DIRECT_URL = process.env.DATABASE_URL;

import { Domain, EnrollmentStatusV2, SubmissionStatus, UserType } from "@prisma/client";
import { assertChildBranch } from "./migrate-078-shared";
import {
  activityIdForDailyTask,
  peIdForEnrollment,
} from "../../src/repositories/ids";

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
  if (!isNewEnrollmentStateEnabled()) throw new Error("reads must be on");
  if (!isLegacyEnrollmentDenormMirrorEnabled()) {
    throw new Error("W7-A mirror must stay on");
  }

  const prisma = await db();
  const { applyChallengeSubmissionChange, applyDeleteChallengeSubmission } =
    await import("../../src/repositories/progress-writes");
  const {
    applyEnrollmentDomainMirror,
    applyEnrollmentProgressDenorm,
    getPrimaryChallengeDomain,
  } = await import("../../src/repositories/enrollment-state");
  const { dualWriteChallengeEnrollment } = await import(
    "../../src/repositories/dual-write"
  );
  const { overlayChallengeProgressFields } = await import(
    "../../src/repositories/progress"
  );

  const stamp = Date.now().toString(36);
  const membersBefore = await prisma.programMember.count();
  const progressBefore = await prisma.enrollmentProgress.count();
  const frozenBefore = {
    submission: await prisma.submission.count(),
    quizAttempt: await prisma.quizAttempt.count(),
    mission: await prisma.programMissionSubmission.count(),
  };

  const challenges = await prisma.challenge.findMany({
    select: { id: true, domain: true },
    take: 2,
  });
  const challenge = challenges[0];
  const otherChallenge = challenges[1];
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
  if (!activity) throw new Error("missing Activity");

  const withSpEmail = `w7a-rehearse-${stamp}@abtalks.dev`;
  const noSpEmail = `w7a-rehearse-nosp-${stamp}@abtalks.dev`;
  const createdIds: string[] = [];

  try {
    const withSp = await prisma.user.create({
      data: { email: withSpEmail, name: "W7A Rehearse SP" },
      select: { id: true },
    });
    createdIds.push(withSp.id);
    await prisma.studentProfile.create({
      data: {
        userId: withSp.id,
        fullName: "W7A Rehearse SP",
        userType: UserType.STUDENT,
        referralCode: `w7a${stamp}a`.slice(0, 12),
        domain: null,
      },
    });
    const enr1 = await prisma.enrollment.create({
      data: {
        userId: withSp.id,
        challengeId: challenge.id,
        domain: challenge.domain,
        status: "ACTIVE",
      },
      select: {
        id: true,
        userId: true,
        domain: true,
        status: true,
        startedAt: true,
        completedAt: true,
      },
    });
    await prisma.$transaction(async (tx) => {
      await dualWriteChallengeEnrollment(tx, enr1);
      await applyEnrollmentDomainMirror(tx, withSp.id, challenge.domain);
    });
    const sp1 = await prisma.studentProfile.findUnique({
      where: { userId: withSp.id },
      select: { domain: true },
    });
    const derived1 = await getPrimaryChallengeDomain(withSp.id);
    if (sp1?.domain !== challenge.domain) throw new Error("SP domain mirror");
    if (derived1 !== challenge.domain) throw new Error("canonical domain");
    log("enroll-with-sp", { domain: sp1.domain, derived: derived1 });

    if (otherChallenge && otherChallenge.domain !== challenge.domain) {
      const enr2 = await prisma.enrollment.create({
        data: {
          userId: withSp.id,
          challengeId: otherChallenge.id,
          domain: otherChallenge.domain,
          status: "ACTIVE",
        },
        select: {
          id: true,
          userId: true,
          domain: true,
          status: true,
          startedAt: true,
          completedAt: true,
        },
      });
      await prisma.$transaction(async (tx) => {
        await dualWriteChallengeEnrollment(tx, enr2);
        await applyEnrollmentDomainMirror(tx, withSp.id, otherChallenge.domain);
      });
      const sp2 = await prisma.studentProfile.findUnique({
        where: { userId: withSp.id },
        select: { domain: true },
      });
      if (sp2?.domain !== challenge.domain) {
        throw new Error("second enrollment overwrote first-track domain");
      }
      log("multi-program", { kept: sp2.domain, second: otherChallenge.domain });
    }

    const noSp = await prisma.user.create({
      data: { email: noSpEmail, name: "W7A Rehearse no SP" },
      select: { id: true },
    });
    createdIds.push(noSp.id);
    const enrNoSp = await prisma.enrollment.create({
      data: {
        userId: noSp.id,
        challengeId: challenge.id,
        domain: challenge.domain,
        status: "ACTIVE",
      },
      select: {
        id: true,
        userId: true,
        domain: true,
        status: true,
        startedAt: true,
        completedAt: true,
      },
    });
    await prisma.$transaction(async (tx) => {
      await dualWriteChallengeEnrollment(tx, enrNoSp);
      await applyEnrollmentDomainMirror(tx, noSp.id, challenge.domain);
    });
    const spMissing = await prisma.studentProfile.findUnique({
      where: { userId: noSp.id },
      select: { id: true },
    });
    const peNoSp = await prisma.programEnrollment.findUnique({
      where: { id: peIdForEnrollment(enrNoSp.id) },
      select: { id: true },
    });
    if (spMissing) throw new Error("must not mint StudentProfile");
    if (!peNoSp) throw new Error("canonical enrollment failed without SP");
    log("missing-sp", { pe: true, spCreated: false });

    const githubUrl = `https://github.com/w7a-rehearse-${stamp}/repo`;
    const subId = `w7as_${stamp}`;
    await prisma.$transaction(async (tx) => {
      await applyChallengeSubmissionChange(tx, {
        id: subId,
        userId: withSp.id,
        enrollmentId: enr1.id,
        dailyTaskId: task.id,
        dayNumber: task.dayNumber,
        githubUrl,
        linkedinUrl: null,
        status: SubmissionStatus.ON_TIME,
        submittedAt: new Date("2026-09-22T10:00:00.000Z"),
        pointsAwarded: 10,
        mode: "create",
      });
      await applyEnrollmentProgressDenorm(tx, {
        enrollmentId: enr1.id,
        daysCompleted: 1,
        currentStreak: 1,
        longestStreak: 1,
        lastSubmittedDay: task.dayNumber,
      });
    });
    const [legacy, pe, overlay] = await Promise.all([
      prisma.enrollment.findUnique({
        where: { id: enr1.id },
        select: {
          daysCompleted: true,
          currentStreak: true,
          longestStreak: true,
          lastSubmittedDay: true,
        },
      }),
      prisma.programEnrollment.findUnique({
        where: { id: peIdForEnrollment(enr1.id) },
        select: { trackCurrentStreak: true, trackLongestStreak: true },
      }),
      overlayChallengeProgressFields([
        {
          id: enr1.id,
          daysCompleted: 0,
          currentStreak: 0,
          longestStreak: 0,
          lastSubmittedDay: null,
        },
      ]),
    ]);
    if (legacy?.daysCompleted !== 1) throw new Error("legacy days mirror");
    if (pe?.trackCurrentStreak !== 1 || pe.trackLongestStreak !== 1) {
      throw new Error("PE streak snapshot");
    }
    if (overlay[0]?.daysCompleted !== 1) throw new Error("canonical days read");
    if (overlay[0]?.currentStreak !== 1) throw new Error("canonical streak read");
    log("submit", { legacy, pe, overlay: overlay[0] });

    await prisma.$transaction(async (tx) => {
      await applyChallengeSubmissionChange(tx, {
        id: subId,
        userId: withSp.id,
        enrollmentId: enr1.id,
        dailyTaskId: task.id,
        dayNumber: task.dayNumber,
        githubUrl,
        linkedinUrl: null,
        status: SubmissionStatus.ON_TIME,
        submittedAt: new Date("2026-09-22T11:00:00.000Z"),
        pointsAwarded: 0,
        mode: "update",
      });
      await applyEnrollmentProgressDenorm(tx, {
        enrollmentId: enr1.id,
        daysCompleted: 1,
        currentStreak: 1,
        longestStreak: 1,
        lastSubmittedDay: task.dayNumber,
      });
    });
    const retryDays = await prisma.enrollment.findUnique({
      where: { id: enr1.id },
      select: { daysCompleted: true },
    });
    if (retryDays?.daysCompleted !== 1) throw new Error("retry double-count");
    log("retry", retryDays);

    await prisma.$transaction(async (tx) => {
      await applyDeleteChallengeSubmission(tx, subId);
      await applyEnrollmentProgressDenorm(tx, {
        enrollmentId: enr1.id,
        daysCompleted: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastSubmittedDay: null,
      });
    });
    const afterReject = await overlayChallengeProgressFields([
      {
        id: enr1.id,
        daysCompleted: 9,
        currentStreak: 9,
        longestStreak: 9,
        lastSubmittedDay: 9,
      },
    ]);
    if (afterReject[0]?.daysCompleted !== 0) {
      throw new Error("reject must drop canonical days");
    }
    log("reject", afterReject[0]);

    const membersAfter = await prisma.programMember.count();
    const progressAfter = await prisma.enrollmentProgress.count();
    const frozenAfter = {
      submission: await prisma.submission.count(),
      quizAttempt: await prisma.quizAttempt.count(),
      mission: await prisma.programMissionSubmission.count(),
    };
    if (membersAfter !== membersBefore) throw new Error("ProgramMember mutated");
    if (progressAfter !== progressBefore) {
      throw new Error("EnrollmentProgress mutated");
    }
    if (
      frozenAfter.submission !== frozenBefore.submission ||
      frozenAfter.quizAttempt !== frozenBefore.quizAttempt ||
      frozenAfter.mission !== frozenBefore.mission
    ) {
      throw new Error("W6 frozen tables mutated");
    }
    log("isolation", { membersAfter, progressAfter, frozenAfter });
  } finally {
    await prisma.activityAttempt.deleteMany({
      where: { enrollment: { userId: { in: createdIds } } },
    });
    await prisma.programEnrollment.deleteMany({
      where: { userId: { in: createdIds } },
    });
    await prisma.enrollment.deleteMany({
      where: { userId: { in: createdIds } },
    });
    await prisma.studentProfile.deleteMany({
      where: { userId: { in: createdIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
