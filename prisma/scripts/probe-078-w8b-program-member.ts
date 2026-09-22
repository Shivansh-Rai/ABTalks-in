/**
 * Controlled W8-B production probe: dedicated @abtalks.dev user.
 * Does not touch a real program member. Cleans up after itself.
 *
 * Requires PHASE2_ALLOW_PRODUCTION=1,
 * ENABLE_NEW_PROGRAM_STATE=true,
 * ENABLE_NEW_PROGRAM_STATE_WRITES=true,
 * ENABLE_LEGACY_PROGRAM_MEMBER_MIRROR=false,
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
  process.env.ENABLE_LEGACY_PROGRAM_MEMBER_MIRROR = "false";
  process.env.ENABLE_DUAL_WRITE = "true";
  process.env.ENABLE_NEW_VISIBILITY_WRITES = "true";

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
    throw new Error("ENABLE_LEGACY_PROGRAM_MEMBER_MIRROR must be false");
  }

  const { writeClient } = await import("../../src/lib/db");
  const {
    applyProgramMembershipChange,
    applyProgramScoreChange,
    applyProgramUnlockChange,
  } = await import("../../src/repositories/program-state");
  const prisma = writeClient();
  const stamp = Date.now().toString(36);
  const email = `w8b-probe-${stamp}@abtalks.dev`;

  const programCohort = await prisma.programCohort.findFirst({
    select: { id: true },
  });
  if (!programCohort) throw new Error("no ProgramCohort");

  const user = await prisma.user.create({
    data: { email, name: "W8B Probe" },
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
            fullName: "W8B Probe",
            githubUsername: "w8b-probe",
            githubRepoUrl: "https://github.com/abtalks/w8b-probe",
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
        fullName: true,
      },
    });
    if (pe?.status !== "ACTIVE") throw new Error("PE not ACTIVE");
    if (pm?.status !== "APPLIED") {
      throw new Error("PM mutable status must stay frozen at structural APPLIED");
    }
    if (pe.missionPoints !== 12 || pm.missionPoints !== 0) {
      throw new Error("score must live on PE; PM frozen");
    }
    if (pe.unlockFloorDay !== 4 || pm.highestUnlockedDay !== 1) {
      throw new Error("unlock must live on PE; PM frozen");
    }
    if (pm.fullName !== "") {
      throw new Error("anchor must not copy identity snapshot");
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
