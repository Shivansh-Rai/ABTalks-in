/**
 * Controlled W8-A production probe: dedicated @abtalks.dev user.
 * Does not touch a real program member. Cleans up after itself.
 *
 * Requires PHASE2_ALLOW_PRODUCTION=1,
 * ENABLE_NEW_PROGRAM_STATE=true,
 * ENABLE_NEW_PROGRAM_STATE_WRITES=true,
 * ENABLE_LEGACY_PROGRAM_MEMBER_MIRROR=true,
 * ENABLE_DUAL_WRITE=true.
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

  assertChildBranch();
  const {
    isLegacyProgramMemberMirrorEnabled,
    isNewProgramStateEnabled,
    isNewProgramStateWritesEnabled,
  } = await import("../../src/lib/feature-flags");
  if (!isNewProgramStateEnabled() || !isNewProgramStateWritesEnabled()) {
    throw new Error("W8-A flags must be true for this probe");
  }
  if (!isLegacyProgramMemberMirrorEnabled()) {
    throw new Error("ENABLE_LEGACY_PROGRAM_MEMBER_MIRROR must stay on");
  }

  const { writeClient } = await import("../../src/lib/db");
  const {
    applyProgramMembershipChange,
    applyProgramScoreChange,
    applyProgramUnlockChange,
  } = await import("../../src/repositories/program-state");
  const prisma = writeClient();
  const stamp = Date.now().toString(36);
  const email = `w8a-probe-${stamp}@abtalks.dev`;

  const programCohort = await prisma.programCohort.findFirst({
    select: { id: true },
  });
  if (!programCohort) throw new Error("no ProgramCohort");

  const user = await prisma.user.create({
    data: { email, name: "W8A Probe" },
    select: { id: true },
  });
  let memberId = "";
  try {
    const applied = await prisma.$transaction(
      async (tx) =>
        applyProgramMembershipChange(tx, {
          userId: user.id,
          programCohortId: programCohort.id,
          status: ProgramMemberStatus.APPLIED,
          identity: {
            fullName: "W8A Probe",
            githubUsername: "w8a-probe",
            githubRepoUrl: "https://github.com/abtalks/w8a-probe",
          },
        }),
      { maxWait: 10_000, timeout: 20_000 },
    );
    memberId = applied.memberId;
    await prisma.$transaction(
      async (tx) => {
        await applyProgramMembershipChange(tx, {
          memberId,
          userId: user.id,
          programCohortId: programCohort.id,
          status: ProgramMemberStatus.ENROLLED,
          enrolledAt: new Date(),
        });
        await applyProgramScoreChange(tx, { memberId, missionPoints: 12 });
        await applyProgramUnlockChange(tx, { memberId, highestUnlockedDay: 4 });
      },
      { maxWait: 10_000, timeout: 20_000 },
    );

    const pe = await prisma.programEnrollment.findUnique({
      where: { id: peIdForMember(memberId) },
      select: {
        status: true,
        missionPoints: true,
        unlockFloorDay: true,
      },
    });
    const pm = await prisma.programMember.findUnique({
      where: { id: memberId },
      select: {
        status: true,
        missionPoints: true,
        highestUnlockedDay: true,
      },
    });
    if (pe?.status !== "ACTIVE" || pm?.status !== "ENROLLED") {
      throw new Error("membership not canonical-first");
    }
    if (pe.missionPoints !== 12 || pm.missionPoints !== 12) {
      throw new Error("score mirror failed");
    }
    if (pe.unlockFloorDay !== 4 || pm.highestUnlockedDay !== 4) {
      throw new Error("unlock mirror failed");
    }
    console.log(JSON.stringify({ ok: true, email, memberId, pe, pm }, null, 2));
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
