/**
 * Child-only W7-B rehearsal.
 * ENABLE_NEW_ENROLLMENT_STATE=true
 * ENABLE_LEGACY_ENROLLMENT_DENORM_MIRROR=false
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

import { SubmissionStatus, UserType } from "@prisma/client";
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

function denorm(row: {
  daysCompleted: number;
  lastSubmittedDay: number | null;
  currentStreak: number;
  longestStreak: number;
} | null) {
  if (!row) throw new Error("missing enrollment snapshot");
  return {
    daysCompleted: row.daysCompleted,
    lastSubmittedDay: row.lastSubmittedDay,
    currentStreak: row.currentStreak,
    longestStreak: row.longestStreak,
  };
}

function sameDenorm(
  a: ReturnType<typeof denorm>,
  b: ReturnType<typeof denorm>,
): boolean {
  return (
    a.daysCompleted === b.daysCompleted &&
    a.lastSubmittedDay === b.lastSubmittedDay &&
    a.currentStreak === b.currentStreak &&
    a.longestStreak === b.longestStreak
  );
}

async function main() {
  process.env.ENABLE_NEW_ENROLLMENT_STATE = "true";
  process.env.ENABLE_LEGACY_ENROLLMENT_DENORM_MIRROR = "false";
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
  if (isLegacyEnrollmentDenormMirrorEnabled()) {
    throw new Error("W7-B mirror must be off");
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
  const tasks = await prisma.dailyTask.findMany({
    where: { challengeId: challenge.id },
    orderBy: { dayNumber: "asc" },
    select: { id: true, dayNumber: true },
    take: 3,
  });
  const task = tasks[0];
  const task2 = tasks[1];
  const task3 = tasks[2];
  if (!task) throw new Error("no DailyTask");
  for (const t of tasks) {
    const activity = await prisma.activity.findUnique({
      where: { id: activityIdForDailyTask(t.id) },
      select: { id: true },
    });
    if (!activity) throw new Error(`missing Activity for day ${t.dayNumber}`);
  }

  const withSpEmail = `w7b-rehearse-${stamp}@abtalks.dev`;
  const noSpEmail = `w7b-rehearse-nosp-${stamp}@abtalks.dev`;
  const createdIds: string[] = [];

  try {
    const withSp = await prisma.user.create({
      data: { email: withSpEmail, name: "W7B Rehearse SP" },
      select: { id: true },
    });
    createdIds.push(withSp.id);
    await prisma.studentProfile.create({
      data: {
        userId: withSp.id,
        fullName: "W7B Rehearse SP",
        userType: UserType.STUDENT,
        referralCode: `w7b${stamp}a`.slice(0, 12),
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
        daysCompleted: true,
        lastSubmittedDay: true,
        currentStreak: true,
        longestStreak: true,
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
    if (sp1?.domain !== null) throw new Error("SP.domain must stay frozen/null");
    if (derived1 !== challenge.domain) throw new Error("canonical domain");
    log("enroll-with-sp", { frozenDomain: sp1.domain, derived: derived1 });

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
      const derived2 = await getPrimaryChallengeDomain(withSp.id);
      const sp2 = await prisma.studentProfile.findUnique({
        where: { userId: withSp.id },
        select: { domain: true },
      });
      if (derived2 !== challenge.domain) throw new Error("first-track semantic");
      if (sp2?.domain !== null) throw new Error("second enroll must not write SP.domain");
      log("second-track", { derived: derived2, frozenDomain: sp2.domain });
    }

    const noSp = await prisma.user.create({
      data: { email: noSpEmail, name: "W7B Rehearse NoSP" },
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

    const before = denorm(
      await prisma.enrollment.findUnique({
        where: { id: enr1.id },
        select: {
          daysCompleted: true,
          lastSubmittedDay: true,
          currentStreak: true,
          longestStreak: true,
        },
      }),
    );
    const domainBefore = (
      await prisma.studentProfile.findUnique({
        where: { userId: withSp.id },
        select: { domain: true },
      })
    )?.domain ?? null;

    const githubUrl = `https://github.com/w7b-rehearse-${stamp}/repo`;
    const subId = `w7bs_${stamp}`;
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
    const afterSubmit = denorm(
      await prisma.enrollment.findUnique({
        where: { id: enr1.id },
        select: {
          daysCompleted: true,
          lastSubmittedDay: true,
          currentStreak: true,
          longestStreak: true,
        },
      }),
    );
    if (!sameDenorm(before, afterSubmit)) {
      throw new Error("submit mutated frozen Enrollment denorm");
    }
    const pe = await prisma.programEnrollment.findUnique({
      where: { id: peIdForEnrollment(enr1.id) },
      select: { trackCurrentStreak: true, trackLongestStreak: true, status: true },
    });
    const overlay = await overlayChallengeProgressFields([
      {
        id: enr1.id,
        daysCompleted: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastSubmittedDay: null,
      },
    ]);
    if (overlay[0]?.daysCompleted !== 1) throw new Error("canonical days");
    if (overlay[0]?.lastSubmittedDay !== task.dayNumber) {
      throw new Error("canonical lastSubmittedDay");
    }
    if (pe?.trackCurrentStreak !== 1 || pe.trackLongestStreak !== 1) {
      throw new Error("PE streak snapshot");
    }
    if (overlay[0]?.currentStreak !== 1) throw new Error("canonical streak overlay");
    log("submit", { frozen: afterSubmit, pe, overlay: overlay[0] });

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
    const afterRetry = denorm(
      await prisma.enrollment.findUnique({
        where: { id: enr1.id },
        select: {
          daysCompleted: true,
          lastSubmittedDay: true,
          currentStreak: true,
          longestStreak: true,
        },
      }),
    );
    const retryOverlay = await overlayChallengeProgressFields([
      {
        id: enr1.id,
        daysCompleted: afterRetry.daysCompleted,
        currentStreak: afterRetry.currentStreak,
        longestStreak: afterRetry.longestStreak,
        lastSubmittedDay: afterRetry.lastSubmittedDay,
      },
    ]);
    if (retryOverlay[0]?.daysCompleted !== 1) throw new Error("retry double-count");
    if (!sameDenorm(before, afterRetry)) throw new Error("retry mutated frozen denorm");
    log("retry", { frozen: afterRetry, canonicalDays: retryOverlay[0]?.daysCompleted });

    if (task2) {
      const lateId = `w7bl_${stamp}`;
      await prisma.$transaction(async (tx) => {
        await applyChallengeSubmissionChange(tx, {
          id: lateId,
          userId: withSp.id,
          enrollmentId: enr1.id,
          dailyTaskId: task2.id,
          dayNumber: task2.dayNumber,
          githubUrl: `${githubUrl}-late`,
          linkedinUrl: null,
          status: SubmissionStatus.LATE,
          submittedAt: new Date("2026-09-24T10:00:00.000Z"),
          pointsAwarded: 0,
          mode: "create",
        });
        await applyEnrollmentProgressDenorm(tx, {
          enrollmentId: enr1.id,
          daysCompleted: 2,
          currentStreak: 0,
          longestStreak: 1,
          lastSubmittedDay: task2.dayNumber,
        });
      });
      const afterLate = denorm(
        await prisma.enrollment.findUnique({
          where: { id: enr1.id },
          select: {
            daysCompleted: true,
            lastSubmittedDay: true,
            currentStreak: true,
            longestStreak: true,
          },
        }),
      );
      if (!sameDenorm(before, afterLate)) throw new Error("late mutated frozen denorm");
      const lateOverlay = await overlayChallengeProgressFields([
        {
          id: enr1.id,
          daysCompleted: afterLate.daysCompleted,
          currentStreak: afterLate.currentStreak,
          longestStreak: afterLate.longestStreak,
          lastSubmittedDay: afterLate.lastSubmittedDay,
        },
      ]);
      if (lateOverlay[0]?.daysCompleted !== 2) throw new Error("late canonical days");
      const peLate = await prisma.programEnrollment.findUnique({
        where: { id: peIdForEnrollment(enr1.id) },
        select: { trackCurrentStreak: true, trackLongestStreak: true },
      });
      if (peLate?.trackCurrentStreak !== 0 || peLate.trackLongestStreak !== 1) {
        throw new Error("late/gap PE streak");
      }
      log("late", { frozen: afterLate, pe: peLate, overlay: lateOverlay[0] });
      await prisma.$transaction(async (tx) => {
        await applyDeleteChallengeSubmission(tx, lateId);
      });
    }

    if (task2 && task3) {
      const onTime2 = `w7b2_${stamp}`;
      await prisma.$transaction(async (tx) => {
        await applyChallengeSubmissionChange(tx, {
          id: onTime2,
          userId: withSp.id,
          enrollmentId: enr1.id,
          dailyTaskId: task2.id,
          dayNumber: task2.dayNumber,
          githubUrl: `${githubUrl}-d2`,
          linkedinUrl: null,
          status: SubmissionStatus.ON_TIME,
          submittedAt: new Date("2026-09-23T10:00:00.000Z"),
          pointsAwarded: 0,
          mode: "create",
        });
        await applyEnrollmentProgressDenorm(tx, {
          enrollmentId: enr1.id,
          daysCompleted: 2,
          currentStreak: 2,
          longestStreak: 2,
          lastSubmittedDay: task2.dayNumber,
        });
      });
      const peSeq = await prisma.programEnrollment.findUnique({
        where: { id: peIdForEnrollment(enr1.id) },
        select: { trackCurrentStreak: true, trackLongestStreak: true },
      });
      if (peSeq?.trackCurrentStreak !== 2) throw new Error("ON_TIME sequence PE");
      const frozenSeq = denorm(
        await prisma.enrollment.findUnique({
          where: { id: enr1.id },
          select: {
            daysCompleted: true,
            lastSubmittedDay: true,
            currentStreak: true,
            longestStreak: true,
          },
        }),
      );
      if (!sameDenorm(before, frozenSeq)) throw new Error("sequence mutated frozen denorm");
      log("ontime-sequence", { pe: peSeq, frozen: frozenSeq });
      await prisma.$transaction(async (tx) => {
        await applyDeleteChallengeSubmission(tx, onTime2);
      });
    }

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
    const afterReject = denorm(
      await prisma.enrollment.findUnique({
        where: { id: enr1.id },
        select: {
          daysCompleted: true,
          lastSubmittedDay: true,
          currentStreak: true,
          longestStreak: true,
        },
      }),
    );
    if (!sameDenorm(before, afterReject)) throw new Error("reject mutated frozen denorm");
    const rejectOverlay = await overlayChallengeProgressFields([
      {
        id: enr1.id,
        daysCompleted: 9,
        currentStreak: 9,
        longestStreak: 9,
        lastSubmittedDay: 9,
      },
    ]);
    if (rejectOverlay[0]?.daysCompleted !== 0) {
      throw new Error("reject must drop canonical days");
    }
    const peReject = await prisma.programEnrollment.findUnique({
      where: { id: peIdForEnrollment(enr1.id) },
      select: { trackCurrentStreak: true, trackLongestStreak: true },
    });
    if (peReject?.trackCurrentStreak !== 0) throw new Error("reject PE streak");
    log("reject", { frozen: afterReject, overlay: rejectOverlay[0], pe: peReject });

    const domainAfter = (
      await prisma.studentProfile.findUnique({
        where: { userId: withSp.id },
        select: { domain: true },
      })
    )?.domain ?? null;
    if (domainAfter !== domainBefore) throw new Error("SP.domain mutated");

    const operational = await prisma.enrollment.findUnique({
      where: { id: enr1.id },
      select: { status: true, startedAt: true, domain: true },
    });
    if (operational?.status !== "ACTIVE") throw new Error("operational status");
    if (operational.domain !== challenge.domain) throw new Error("operational domain");

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
    log("w7b-rehearse", "ok");
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
