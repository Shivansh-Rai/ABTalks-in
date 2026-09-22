/**
 * Child-only Phase 8-B rehearsal.
 * ENABLE_DUAL_WRITE=false with current dedicated production flags.
 * Refuses production. Cleans up @abtalks.dev fixtures.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

if (process.env.DATABASE_URL?.includes("-pooler.")) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace("-pooler.", ".");
}
process.env.DIRECT_URL = process.env.DATABASE_URL;

import {
  Domain,
  EnrollmentStatus,
  EnrollmentStatusV2,
  PointsSourceType,
  ProgramMemberStatus,
} from "@prisma/client";
import { assertChildBranch } from "./migrate-078-shared";
import { peIdForEnrollment } from "../../src/repositories/ids";

async function main() {
  process.env.ENABLE_DUAL_WRITE = "false";
  process.env.ENABLE_NEW_LEARNING = "true";
  process.env.ENABLE_NEW_ENROLLMENT_STATE = "true";
  process.env.ENABLE_LEGACY_ENROLLMENT_DENORM_MIRROR = "false";
  process.env.ENABLE_NEW_POINTS = "true";
  process.env.ENABLE_NEW_POINTS_WRITES = "true";
  process.env.ENABLE_LEGACY_POINTS_MIRROR = "false";
  process.env.ENABLE_NEW_VISIBILITY_WRITES = "true";
  process.env.ENABLE_NEW_PROGRAM_STATE = "true";
  process.env.ENABLE_NEW_PROGRAM_STATE_WRITES = "true";
  process.env.ENABLE_LEGACY_PROGRAM_MEMBER_MIRROR = "false";

  assertChildBranch();
  const host = (process.env.DATABASE_URL ?? "").split("@")[1]?.split("/")[0] ?? "";
  console.log("HOST=" + host);
  if (host.includes("ep-nameless-term-ams9a5e3") || host.includes("young-shadow")) {
    throw new Error("refusing production/mis-target host");
  }

  const { isDualWriteEnabled } = await import("../../src/lib/feature-flags");
  if (isDualWriteEnabled()) throw new Error("rehearsal requires ENABLE_DUAL_WRITE=false");

  const { writeClient } = await import("../../src/lib/db");
  const { applyChallengeProgramEnrollment } = await import(
    "../../src/repositories/enrollment-state"
  );
  const { applyVisibilityChange } = await import("../../src/repositories/visibility");
  const { applyPointsChange } = await import("../../src/repositories/points");
  const { applyProgramMembershipChange } = await import(
    "../../src/repositories/program-state"
  );

  const prisma = writeClient();
  const stamp = Date.now().toString(36);
  const email = `p8b-rehearse-${stamp}@abtalks.dev`;

  const challenge = await prisma.challenge.findFirst({
    where: { domain: Domain.AI },
    select: { id: true },
  });
  if (!challenge) throw new Error("no AI challenge");

  const user = await prisma.user.create({
    data: { email, name: "P8B Rehearse" },
    select: { id: true },
  });

  let enrollmentId = "";
  try {
    enrollmentId = await prisma.$transaction(
      async (tx) => {
        const enrollment = await tx.enrollment.create({
          data: {
            userId: user.id,
            challengeId: challenge.id,
            domain: Domain.AI,
            status: EnrollmentStatus.ACTIVE,
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
        await applyVisibilityChange(tx, {
          userId: user.id,
          kind: "challenge_enroll",
        });
        const pe = await applyChallengeProgramEnrollment(tx, enrollment);
        if (pe.id !== peIdForEnrollment(enrollment.id)) {
          throw new Error("pe id mismatch");
        }
        return enrollment.id;
      },
      { maxWait: 20000, timeout: 20000 },
    );

    const peId = peIdForEnrollment(enrollmentId);
    const created = await prisma.programEnrollment.findUnique({
      where: { id: peId },
      select: { id: true, status: true, userId: true },
    });
    if (!created || created.status !== EnrollmentStatusV2.ACTIVE) {
      throw new Error("pe_enr_ missing after create with DW=false");
    }

    await prisma.$transaction(
      async (tx) => {
        await applyChallengeProgramEnrollment(tx, {
          id: enrollmentId,
          userId: user.id,
          domain: Domain.AI,
          status: EnrollmentStatus.ACTIVE,
          startedAt: new Date(),
          completedAt: null,
        });
      },
      { maxWait: 20000, timeout: 20000 },
    );
    const retryCount = await prisma.programEnrollment.count({
      where: { id: peId },
    });
    if (retryCount !== 1) throw new Error("duplicate pe_enr_ on retry");

    await prisma.$transaction(
      async (tx) => {
        await tx.enrollment.update({
          where: { id: enrollmentId },
          data: {
            status: EnrollmentStatus.COMPLETED,
            completedAt: new Date(),
          },
        });
        await applyChallengeProgramEnrollment(tx, {
          id: enrollmentId,
          userId: user.id,
          domain: Domain.AI,
          status: EnrollmentStatus.COMPLETED,
          startedAt: new Date(),
          completedAt: new Date(),
        });
      },
      { maxWait: 20000, timeout: 20000 },
    );
    const completed = await prisma.programEnrollment.findUnique({
      where: { id: peId },
      select: { status: true },
    });
    if (completed?.status !== EnrollmentStatusV2.COMPLETED) {
      throw new Error("completion did not map PE");
    }

    await prisma.$transaction(
      async (tx) => {
        await tx.enrollment.update({
          where: { id: enrollmentId },
          data: { status: EnrollmentStatus.ABANDONED },
        });
        await applyChallengeProgramEnrollment(tx, {
          id: enrollmentId,
          userId: user.id,
          domain: Domain.AI,
          status: EnrollmentStatus.ABANDONED,
          startedAt: new Date(),
          completedAt: null,
        });
      },
      { maxWait: 20000, timeout: 20000 },
    );
    const abandoned = await prisma.programEnrollment.findUnique({
      where: { id: peId },
      select: { status: true },
    });
    if (abandoned?.status !== EnrollmentStatusV2.DROPPED) {
      throw new Error("anonymize mapping did not drop PE");
    }

    const legacyDays = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { daysCompleted: true, currentStreak: true },
    });
    if ((legacyDays?.daysCompleted ?? -1) !== 0) {
      throw new Error("W7 denorm remirror detected");
    }

    await prisma.$transaction(
      async (tx) => {
        const grant = await applyPointsChange(tx, {
          userId: user.id,
          amount: 10,
          mode: "credit",
          sourceType: PointsSourceType.ADMIN_GRANT,
          idempotencyKey: `p8b-rehearse:${user.id}`,
        });
        if (!grant.ok) throw new Error("points grant failed");
      },
      { maxWait: 20000, timeout: 20000 },
    );

    const programCohort = await prisma.programCohort.findFirst({
      select: { id: true },
    });
    if (programCohort) {
      await prisma.$transaction(
        async (tx) =>
          applyProgramMembershipChange(tx, {
            userId: user.id,
            programCohortId: programCohort.id,
            status: ProgramMemberStatus.APPLIED,
            identity: {
              fullName: "P8B Rehearse",
              githubUsername: "p8b-rehearse",
              githubRepoUrl: "https://github.com/abtalks/p8b-rehearse",
              skills: ["SQL"],
            },
          }),
        { maxWait: 20000, timeout: 20000 },
      );
    }

    console.log("PHASE8B_CHILD_REHEARSAL_OK");
    console.log("enrollmentId=" + enrollmentId);
    console.log("peId=" + peId);
  } finally {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
