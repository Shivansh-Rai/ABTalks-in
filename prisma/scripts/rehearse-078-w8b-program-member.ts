/**
 * Child-only W8-B rehearsal.
 * ENABLE_NEW_PROGRAM_STATE=true
 * ENABLE_NEW_PROGRAM_STATE_WRITES=true
 * ENABLE_LEGACY_PROGRAM_MEMBER_MIRROR=false
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
  process.env.ENABLE_LEGACY_PROGRAM_MEMBER_MIRROR = "false";
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
    throw new Error("W8-B flags must keep ProgramEnrollment writes on");
  }
  if (isLegacyProgramMemberMirrorEnabled()) {
    throw new Error("W8-B rehearsal requires ProgramMember mirror off");
  }

  const { writeClient } = await import("../../src/lib/db");
  const {
    applyProgramMembershipChange,
    applyProgramScoreChange,
    applyProgramUnlockChange,
    applyProgramRecommendationChange,
    scrubProgramMemberLegacyPii,
  } = await import("../../src/repositories/program-state");
  const prisma = writeClient();
  const stamp = Date.now().toString(36);
  const email = `w8b-rehearse-${stamp}@abtalks.dev`;

  const programCohort = await prisma.programCohort.findFirst({
    select: { id: true },
  });
  if (!programCohort) throw new Error("no ProgramCohort");

  const user = await prisma.user.create({
    data: { email, name: "W8B Rehearse" },
    select: { id: true },
  });

  const identity = {
    fullName: "W8B Rehearse",
    githubUsername: "w8b-rehearse",
    githubRepoUrl: "https://github.com/abtalks/w8b-rehearse",
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
          aiRecommendation: "W8B rehearsal recommendation.",
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

    await prisma.$transaction(
      async (tx) => {
        await scrubProgramMemberLegacyPii(tx, user.id);
      },
      { maxWait: 10_000, timeout: 20_000 },
    );

    const pe = await prisma.programEnrollment.findUnique({
      where: { id: peIdForMember(memberId) },
      select: {
        status: true,
        missionPoints: true,
        totalScore: true,
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
        highestUnlockedDay: true,
        skipTokensUsed: true,
        aiRecommendation: true,
        fullName: true,
        githubUsername: true,
        skills: true,
      },
    });
    if (!pe || !pm) throw new Error("missing PE or PM anchor");
    if (pe.status !== "ACTIVE") throw new Error(`PE status ${pe.status}`);
    if (pm.status !== "APPLIED") {
      throw new Error(`PM status should stay structural APPLIED, got ${pm.status}`);
    }
    if (pe.missionPoints !== 24 || pm.missionPoints !== 0) {
      throw new Error("score must live on PE; PM frozen");
    }
    if (pe.unlockFloorDay !== 5 || pm.highestUnlockedDay !== 1) {
      throw new Error("unlock must live on PE; PM frozen");
    }
    if (pe.skipTokensUsed !== 1 || pm.skipTokensUsed !== 0) {
      throw new Error("skip tokens must live on PE; PM frozen");
    }
    if (pe.aiRecommendation !== "W8B rehearsal recommendation.") {
      throw new Error("recommendation must live on PE");
    }
    if (pm.aiRecommendation !== null) throw new Error("PM recommendation frozen");
    if (pm.fullName !== "Deleted User" || pm.githubUsername !== "deleted") {
      throw new Error("compliance wipe should still scrub PM PII");
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          email,
          memberId,
          peId: peIdForMember(memberId),
          pe,
          frozenPm: pm,
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
