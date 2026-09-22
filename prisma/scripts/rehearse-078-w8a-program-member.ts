/**
 * Child-only W8-A rehearsal.
 * ENABLE_NEW_PROGRAM_STATE=true
 * ENABLE_NEW_PROGRAM_STATE_WRITES=true
 * ENABLE_LEGACY_PROGRAM_MEMBER_MIRROR=true
 * ENABLE_DUAL_WRITE=true
 * Refuses production. Cleans up @abtalks.dev fixtures.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

if (process.env.DATABASE_URL?.includes("-pooler.")) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace("-pooler.", ".");
}
process.env.DIRECT_URL = process.env.DATABASE_URL;

import { ProgramMemberStatus } from "@prisma/client";
import { assertChildBranch } from "./migrate-078-shared";
import { peIdForMember } from "../../src/repositories/ids";

async function main() {
  process.env.ENABLE_NEW_PROGRAM_STATE = "true";
  process.env.ENABLE_NEW_PROGRAM_STATE_WRITES = "true";
  process.env.ENABLE_LEGACY_PROGRAM_MEMBER_MIRROR = "true";
  process.env.ENABLE_DUAL_WRITE = "true";
  process.env.ENABLE_NEW_VISIBILITY_WRITES = "true";
  delete process.env.PROGRAM_MEMBER_FAIL_LEGACY_MIRROR;

  assertChildBranch();
  const {
    isLegacyProgramMemberMirrorEnabled,
    isNewProgramStateEnabled,
    isNewProgramStateWritesEnabled,
  } = await import("../../src/lib/feature-flags");
  if (!isNewProgramStateEnabled() || !isNewProgramStateWritesEnabled()) {
    throw new Error("W8-A flags must be on for rehearsal");
  }
  if (!isLegacyProgramMemberMirrorEnabled()) {
    throw new Error("W8-A must keep ProgramMember mirror on");
  }

  const { writeClient } = await import("../../src/lib/db");
  const {
    applyProgramMembershipChange,
    applyProgramScoreChange,
    applyProgramUnlockChange,
    applyProgramRecommendationChange,
  } = await import("../../src/repositories/program-state");
  const prisma = writeClient();
  const stamp = Date.now().toString(36);
  const email = `w8a-rehearse-${stamp}@abtalks.dev`;

  const programCohort = await prisma.programCohort.findFirst({
    select: { id: true },
  });
  if (!programCohort) throw new Error("no ProgramCohort");

  const user = await prisma.user.create({
    data: { email, name: "W8A Rehearse" },
    select: { id: true },
  });

  const identity = {
    fullName: "W8A Rehearse",
    githubUsername: "w8a-rehearse",
    githubRepoUrl: "https://github.com/abtalks/w8a-rehearse",
    skills: ["SQL"],
  };

  let memberId = "";
  try {
    const applied = await prisma.$transaction(
      async (tx) =>
        applyProgramMembershipChange(tx, {
          userId: user.id,
          programCohortId: programCohort.id,
          status: ProgramMemberStatus.APPLIED,
          identity,
        }),
      { maxWait: 10_000, timeout: 20_000 },
    );
    memberId = applied.memberId;
    if (applied.created !== true) throw new Error("expected create");

    const enrolled = await prisma.$transaction(
      async (tx) =>
        applyProgramMembershipChange(tx, {
          memberId,
          userId: user.id,
          programCohortId: programCohort.id,
          status: ProgramMemberStatus.ENROLLED,
          enrolledAt: new Date(),
          identity,
        }),
      { maxWait: 10_000, timeout: 20_000 },
    );
    if (enrolled.memberId !== memberId) throw new Error("retry id drift");

    await prisma.$transaction(
      async (tx) => {
        await applyProgramScoreChange(tx, {
          memberId,
          missionPointsDelta: 12,
          cleanPassCountDelta: 1,
        });
      },
      { maxWait: 10_000, timeout: 20_000 },
    );
    await prisma.$transaction(
      async (tx) => {
        await applyProgramUnlockChange(tx, {
          memberId,
          highestUnlockedDay: 5,
          skipTokensUsed: 1,
        });
      },
      { maxWait: 10_000, timeout: 20_000 },
    );
    await prisma.$transaction(
      async (tx) => {
        await applyProgramRecommendationChange(tx, {
          memberId,
          aiRecommendation: "W8A rehearsal recommendation.",
        });
      },
      { maxWait: 10_000, timeout: 20_000 },
    );

    const retry = await prisma.$transaction(
      async (tx) =>
        applyProgramScoreChange(tx, {
          memberId,
          missionPointsDelta: 12,
        }),
      { maxWait: 10_000, timeout: 20_000 },
    );
    if (retry.snapshot.missionPoints !== 24) {
      throw new Error(`retry score ${retry.snapshot.missionPoints}`);
    }

    const pe = await prisma.programEnrollment.findUnique({
      where: { id: peIdForMember(memberId) },
      select: {
        status: true,
        missionPoints: true,
        totalScore: true,
        cleanPassCount: true,
        unlockFloorDay: true,
        skipTokensUsed: true,
        aiRecommendation: true,
      },
    });
    const pm = await prisma.programMember.findUnique({
      where: { id: memberId },
      select: {
        status: true,
        missionPoints: true,
        totalScore: true,
        cleanPassCount: true,
        highestUnlockedDay: true,
        skipTokensUsed: true,
        aiRecommendation: true,
      },
    });
    if (!pe || !pm) throw new Error("missing pe/pm");
    if (pe.status !== "ACTIVE" || pm.status !== "ENROLLED") {
      throw new Error("status mapping failed");
    }
    if (
      pe.missionPoints !== 24 ||
      pm.missionPoints !== 24 ||
      pe.unlockFloorDay !== 5 ||
      pm.highestUnlockedDay !== 5 ||
      pe.skipTokensUsed !== 1 ||
      pm.skipTokensUsed !== 1 ||
      pe.aiRecommendation !== "W8A rehearsal recommendation."
    ) {
      throw new Error(`mirror mismatch pe=${JSON.stringify(pe)} pm=${JSON.stringify(pm)}`);
    }

    process.env.PROGRAM_MEMBER_FAIL_LEGACY_MIRROR = "1";
    await prisma.$transaction(
      async (tx) => {
        await applyProgramScoreChange(tx, {
          memberId,
          commitPoints: 6,
        });
      },
      { maxWait: 10_000, timeout: 20_000 },
    );
    delete process.env.PROGRAM_MEMBER_FAIL_LEGACY_MIRROR;
    const peAfter = await prisma.programEnrollment.findUnique({
      where: { id: peIdForMember(memberId) },
      select: { commitPoints: true, totalScore: true },
    });
    const pmAfter = await prisma.programMember.findUnique({
      where: { id: memberId },
      select: { commitPoints: true, totalScore: true },
    });
    if (peAfter?.commitPoints !== 6) throw new Error("canonical score not kept");
    if (pmAfter?.commitPoints !== 0) throw new Error("pm should lag on injected failure");

    console.log(
      JSON.stringify(
        {
          ok: true,
          email,
          memberId,
          peId: peIdForMember(memberId),
          canonical: peAfter,
          laggedPm: pmAfter,
        },
        null,
        2,
      ),
    );
  } finally {
    if (memberId) {
      await prisma.programMember.deleteMany({ where: { id: memberId } });
      await prisma.programEnrollment.deleteMany({
        where: { id: peIdForMember(memberId) },
      });
    }
    await prisma.candidateVisibility.deleteMany({ where: { userId: user.id } });
    await prisma.user.deleteMany({ where: { id: user.id } });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
