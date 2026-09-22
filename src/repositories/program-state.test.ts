/**
 * W8-A ProgramMember current-state tests.
 * Run: npm run test:078-program-state
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EnrollmentStatusV2, ProgramMemberStatus } from "@prisma/client";
import {
  isLegacyProgramMemberMirrorEnabled,
  isNewProgramStateEnabled,
  isNewProgramStateWritesEnabled,
} from "@/lib/feature-flags";
import {
  applyProgramMembershipChange,
  applyProgramScoreChange,
  applyProgramUnlockChange,
  applyProgramRecommendationChange,
} from "@/repositories/program-state";

let passed = 0;
let failed = 0;

function assert(cond: boolean | undefined, msg: string) {
  if (!cond) throw new Error(msg);
}

function suite(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(
      () => {
        passed++;
        console.log(`  ✓ ${name}`);
      },
      (err: unknown) => {
        failed++;
        console.log(`  ✗ ${name}`);
        console.error(err instanceof Error ? err.stack ?? err.message : err);
      },
    );
}

function source(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

async function withFlags(
  flags: Record<string, string | undefined>,
  fn: () => void | Promise<void>,
): Promise<void> {
  const prev: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(flags)) {
    prev[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await fn();
  } finally {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function makeTx() {
  const writes: string[] = [];
  const pe: {
    exists: boolean;
    status: EnrollmentStatusV2;
    unlockFloorDay: number | null;
    skipTokensUsed: number;
    missionPoints: number;
    conceptPoints: number;
    commitPoints: number;
    projectPoints: number;
    totalScore: number;
    cleanPassCount: number;
    aiRecommendation: string | null;
    aiRecommendationAt: Date | null;
  } = {
    exists: true,
    status: EnrollmentStatusV2.APPLIED,
    unlockFloorDay: 1,
    skipTokensUsed: 0,
    missionPoints: 0,
    conceptPoints: 0,
    commitPoints: 0,
    projectPoints: 0,
    totalScore: 0,
    cleanPassCount: 0,
    aiRecommendation: null,
    aiRecommendationAt: null,
  };
  const pm = {
    exists: true,
    id: "pm1",
    status: ProgramMemberStatus.APPLIED,
    highestUnlockedDay: 1,
    skipTokensUsed: 0,
    missionPoints: 0,
    conceptPoints: 0,
    commitPoints: 0,
    projectPoints: 0,
    totalScore: 0,
    cleanPassCount: 0,
    aiRecommendation: null as string | null,
    aiRecommendationAt: null as Date | null,
  };
  return {
    writes,
    pe,
    pm,
    $executeRawUnsafe: async (sql: string) => {
      writes.push(`sql:${sql.split(" ")[0]}`);
    },
    cohort: {
      findUnique: async () => ({ id: "coh078" }),
    },
    programEnrollment: {
      findUnique: async () => (pe.exists ? { ...pe, id: "pe_pm_pm1" } : null),
      upsert: async ({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
        writes.push("pe.upsert");
        Object.assign(pe, pe.exists ? update : create);
        pe.exists = true;
        return pe;
      },
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        writes.push("pe.updateMany");
        if (!pe.exists) return { count: 0 };
        Object.assign(pe, data);
        return { count: 1 };
      },
    },
    programMember: {
      findUnique: async () => (pm.exists ? { ...pm } : null),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        writes.push("pm.create");
        Object.assign(pm, data);
        pm.exists = true;
        return pm;
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        writes.push("pm.update");
        Object.assign(pm, data);
        return pm;
      },
    },
    candidateVisibility: {
      findUnique: async () => ({
        withdrawnAt: null,
        searchableByRecruiters: true,
        consentSource: "platform_default",
        consentedAt: new Date(),
      }),
    },
  };
}

const identity = {
  fullName: "Ada",
  githubUsername: "ada",
  githubRepoUrl: "https://github.com/ada/repo",
};

async function main() {
  await suite("ENABLE_NEW_PROGRAM_STATE defaults off", async () => {
    await withFlags({ ENABLE_NEW_PROGRAM_STATE: undefined }, () => {
      assert(isNewProgramStateEnabled() === false, "unset is false");
    });
  });

  await suite("ENABLE_NEW_PROGRAM_STATE_WRITES defaults off", async () => {
    await withFlags({ ENABLE_NEW_PROGRAM_STATE_WRITES: undefined }, () => {
      assert(isNewProgramStateWritesEnabled() === false, "unset is false");
    });
  });

  await suite("ENABLE_LEGACY_PROGRAM_MEMBER_MIRROR defaults on", async () => {
    await withFlags({ ENABLE_LEGACY_PROGRAM_MEMBER_MIRROR: undefined }, () => {
      assert(isLegacyProgramMemberMirrorEnabled() === true, "unset is true");
    });
  });

  await suite("does not overload dual-write / progress / enrollment flags", () => {
    const flags = source("src/lib/feature-flags.ts");
    const impl = source("src/repositories/program-state.ts");
    assert(flags.includes("ENABLE_NEW_PROGRAM_STATE"), "own read flag");
    assert(flags.includes("ENABLE_NEW_PROGRAM_STATE_WRITES"), "own write flag");
    assert(flags.includes("ENABLE_LEGACY_PROGRAM_MEMBER_MIRROR"), "own mirror flag");
    assert(!impl.includes("isNewProgressRepoEnabled"), "no progress flag");
    assert(!impl.includes("isNewEnrollmentStateEnabled"), "no enrollment flag");
    assert(!impl.includes("ENABLE_DUAL_WRITE"), "does not overload dual-write");
  });

  await suite("membership writes ProgramEnrollment before ProgramMember", async () => {
    await withFlags(
      {
        ENABLE_NEW_PROGRAM_STATE_WRITES: "true",
        ENABLE_LEGACY_PROGRAM_MEMBER_MIRROR: "true",
        ENABLE_NEW_VISIBILITY_WRITES: "true",
        PROGRAM_MEMBER_FAIL_LEGACY_MIRROR: undefined,
      },
      async () => {
        const tx = makeTx();
        tx.pm.exists = true;
        await applyProgramMembershipChange(tx as never, {
          memberId: "pm1",
          userId: "u1",
          programCohortId: "pc1",
          status: ProgramMemberStatus.ENROLLED,
          enrolledAt: new Date(),
          identity,
        });
        const peIdx = tx.writes.indexOf("pe.upsert");
        const pmIdx = tx.writes.indexOf("pm.update");
        assert(peIdx >= 0, "pe wrote");
        assert(pmIdx >= 0, "pm mirrored");
        assert(peIdx < pmIdx, `pe first ${tx.writes.join(",")}`);
        assert(tx.pe.status === EnrollmentStatusV2.ACTIVE, "ENROLLED maps ACTIVE");
      },
    );
  });

  await suite("retry membership upsert does not duplicate", async () => {
    await withFlags(
      {
        ENABLE_NEW_PROGRAM_STATE_WRITES: "true",
        ENABLE_LEGACY_PROGRAM_MEMBER_MIRROR: "true",
      },
      async () => {
        const tx = makeTx();
        const first = await applyProgramMembershipChange(tx as never, {
          memberId: "pm1",
          userId: "u1",
          programCohortId: "pc1",
          status: ProgramMemberStatus.ENROLLED,
          identity,
        });
        const second = await applyProgramMembershipChange(tx as never, {
          memberId: "pm1",
          userId: "u1",
          programCohortId: "pc1",
          status: ProgramMemberStatus.ENROLLED,
          identity,
        });
        assert(first.memberId === second.memberId, "same member id");
        assert(first.memberId === "pm1", "stable id");
      },
    );
  });

  await suite("score writes PE first then ProgramMember mirror", async () => {
    await withFlags(
      {
        ENABLE_NEW_PROGRAM_STATE_WRITES: "true",
        ENABLE_NEW_PROGRAM_STATE: "true",
        ENABLE_LEGACY_PROGRAM_MEMBER_MIRROR: "true",
      },
      async () => {
        const tx = makeTx();
        const result = await applyProgramScoreChange(tx as never, {
          memberId: "pm1",
          missionPointsDelta: 12,
          cleanPassCountDelta: 1,
        });
        assert(tx.writes[0] === "pe.updateMany", `pe first ${tx.writes[0]}`);
        assert(tx.writes.includes("pm.update"), "pm mirror");
        assert(result.snapshot.missionPoints === 12, "mission");
        assert(result.snapshot.totalScore === 12, "total");
        assert(tx.pe.missionPoints === 12, "pe stored");
        assert(tx.pm.missionPoints === 12, "pm mirrored");
      },
    );
  });

  await suite("injected ProgramMember mirror failure keeps canonical score", async () => {
    await withFlags(
      {
        ENABLE_NEW_PROGRAM_STATE_WRITES: "true",
        ENABLE_LEGACY_PROGRAM_MEMBER_MIRROR: "true",
        PROGRAM_MEMBER_FAIL_LEGACY_MIRROR: "1",
      },
      async () => {
        const tx = makeTx();
        const result = await applyProgramScoreChange(tx as never, {
          memberId: "pm1",
          missionPoints: 24,
        });
        assert(result.mirrorFailed === true, "mirror flagged");
        assert(tx.pe.missionPoints === 24, "canonical kept");
        assert(tx.pm.missionPoints === 0, "pm lagged");
        assert(!tx.writes.includes("pm.update"), "pm not written");
      },
    );
  });

  await suite("unlock and recommendation use the same PE-first rule", async () => {
    await withFlags(
      {
        ENABLE_NEW_PROGRAM_STATE_WRITES: "true",
        ENABLE_LEGACY_PROGRAM_MEMBER_MIRROR: "true",
      },
      async () => {
        const tx = makeTx();
        await applyProgramUnlockChange(tx as never, {
          memberId: "pm1",
          highestUnlockedDay: 8,
          skipTokensUsed: 1,
        });
        await applyProgramRecommendationChange(tx as never, {
          memberId: "pm1",
          aiRecommendation: "Strong SQL.",
        });
        assert(tx.pe.unlockFloorDay === 8, "unlock pe");
        assert(tx.pe.skipTokensUsed === 1, "skip pe");
        assert(tx.pe.aiRecommendation === "Strong SQL.", "reco pe");
        assert(tx.pm.highestUnlockedDay === 8, "unlock pm");
        assert(tx.pm.aiRecommendation === "Strong SQL.", "reco pm");
      },
    );
  });

  await suite("live writers go through program-state boundaries", () => {
    const entry = source("src/features/program/entry.ts");
    const missions = source("src/features/program/missions.ts");
    const admin = source("src/features/program/admin.ts");
    const rec = source("src/features/program/recommendations.ts");
    const anon = source("src/features/admin/anonymize-user.ts");
    assert(entry.includes("applyProgramMembershipChange"), "entry membership");
    assert(missions.includes("applyProgramScoreChange"), "mission score");
    assert(admin.includes("applyProgramUnlockChange"), "admin unlock");
    assert(rec.includes("applyProgramRecommendationChange"), "reco write");
    assert(anon.includes("applyProgramMembershipChange"), "anonymize drop");
    assert(
      !source("src/features/program/entry.ts").includes("dualWriteProgramMember"),
      "entry no longer PM-first dual-write",
    );
  });

  await suite("hire pool permission stays CandidateVisibility", () => {
    const hire = source("src/repositories/hire.ts");
    assert(hire.includes("searchableUserWhere"), "visibility gate");
    assert(hire.includes("overlayProgramMemberState"), "score overlay");
    assert(hire.includes("RECRUITER_FIELD_POLICY.interviewResults"), "interview privacy");
    assert(hire.includes("isNewProgramStateEnabled"), "canonical pool refs");
  });

  await suite("does not remirror W7 frozen enrollment denorms", () => {
    const impl = source("src/repositories/program-state.ts");
    assert(!impl.includes("daysCompleted"), "no Enrollment.daysCompleted");
    assert(!impl.includes("lastSubmittedDay"), "no lastSubmittedDay");
    assert(!impl.includes("trackCurrentStreak"), "no W7 streak write");
    assert(!impl.includes("studentProfile"), "no SP.domain");
  });

  await suite("does not touch frozen W1-W6 families", () => {
    const impl = source("src/repositories/program-state.ts");
    assert(!impl.includes("synergyPoints"), "no points");
    assert(!impl.includes("SynergyEvent"), "no synergy event");
    assert(!impl.includes("quizAttempt"), "no quiz");
    assert(!impl.includes("programMissionSubmission"), "no PMS");
    assert(!impl.includes("certificate"), "no certificate");
  });

  await suite("does not overwrite CandidateSkill claimedByCandidate", () => {
    const impl = source("src/repositories/program-state.ts");
    assert(!impl.includes("CandidateSkill"), "no skill merge");
    assert(!impl.includes("claimedByCandidate"), "no claim overwrite");
    assert(!impl.includes("SkillEvidence"), "no evidence side effect");
  });

  await suite("W8-B splits anchor creation from mutable-state mirror", () => {
    const impl = source("src/repositories/program-state.ts");
    const flags = source("src/lib/feature-flags.ts");
    assert(impl.includes("ensureProgramMemberAnchor"), "anchor helper");
    assert(impl.includes("mirrorProgramMemberLegacyState"), "mirror helper");
    assert(impl.includes("scrubProgramMemberLegacyPii"), "compliance wipe");
    assert(impl.includes("canonicalProgramMemberWhere"), "PE-first where");
    assert(flags.includes("compliance exception"), "flag docs freeze vs scrub");
    assert(!impl.includes('ENABLE_DUAL_WRITE'), "does not overload dual-write");
  });

  await suite("mirror off creates minimal PM anchor and freezes mutable state", async () => {
    await withFlags(
      {
        ENABLE_NEW_PROGRAM_STATE: "true",
        ENABLE_NEW_PROGRAM_STATE_WRITES: "true",
        ENABLE_LEGACY_PROGRAM_MEMBER_MIRROR: "false",
        ENABLE_NEW_VISIBILITY_WRITES: "true",
      },
      async () => {
        const tx = makeTx();
        tx.pm.exists = false;
        const first = await applyProgramMembershipChange(tx as never, {
          memberId: "pm1",
          userId: "u1",
          programCohortId: "pc1",
          status: ProgramMemberStatus.ENROLLED,
          identity,
        });
        assert(first.memberId === "pm1", "stable pe_pm identity");
        assert(tx.writes.includes("pm.create"), "anchor created");
        assert(!tx.writes.includes("pm.update"), "no mutable remirror on create");
        assert(tx.pe.status === EnrollmentStatusV2.ACTIVE, "PE ACTIVE");
        assert(tx.pm.status === ProgramMemberStatus.APPLIED, "PM stays structural APPLIED");
        assert(tx.pm.missionPoints === 0, "no score snapshot on anchor");

        const retry = await applyProgramMembershipChange(tx as never, {
          memberId: "pm1",
          userId: "u1",
          programCohortId: "pc1",
          status: ProgramMemberStatus.ENROLLED,
          identity,
        });
        assert(retry.memberId === "pm1", "retry same id");
        assert(
          tx.writes.filter((w) => w === "pm.create").length === 1,
          "no duplicate anchor",
        );

        await applyProgramMembershipChange(tx as never, {
          memberId: "pm1",
          userId: "u1",
          programCohortId: "pc1",
          status: ProgramMemberStatus.COMPLETED,
        });
        assert(tx.pe.status === EnrollmentStatusV2.COMPLETED, "PE status mutates");
        assert(tx.pm.status === ProgramMemberStatus.APPLIED, "PM status frozen");

        await applyProgramScoreChange(tx as never, {
          memberId: "pm1",
          missionPoints: 12,
        });
        await applyProgramUnlockChange(tx as never, {
          memberId: "pm1",
          highestUnlockedDay: 8,
          skipTokensUsed: 1,
        });
        await applyProgramRecommendationChange(tx as never, {
          memberId: "pm1",
          aiRecommendation: "Strong SQL.",
        });
        assert(tx.pe.missionPoints === 12, "PE score");
        assert(tx.pm.missionPoints === 0, "PM score frozen");
        assert(tx.pe.unlockFloorDay === 8, "PE unlock");
        assert(tx.pm.highestUnlockedDay === 1, "PM unlock frozen");
        assert(tx.pe.aiRecommendation === "Strong SQL.", "PE reco");
        assert(tx.pm.aiRecommendation === null, "PM reco frozen");
      },
    );
  });

  await suite("live membership/pool readers use ProgramEnrollment not frozen PM status", () => {
    const hire = source("src/repositories/hire.ts");
    const pool = source("src/features/talent-pool/pool.ts");
    const leaderboard = source("src/features/program/leaderboard.ts");
    const admin = source("src/features/program/admin.ts");
    const entry = source("src/features/program/entry.ts");
    const interview = source("src/features/interview/provider.ts");
    const anon = source("src/features/admin/anonymize-user.ts");
    assert(hire.includes("canonicalProgramMemberWhere"), "hire PE-first where");
    assert(pool.includes("listCanonicalProgramMemberIds"), "talent pool PE ids");
    assert(leaderboard.includes("listCanonicalProgramMemberIds"), "leaderboard PE ids");
    assert(admin.includes("countCanonicalMembersByStatus"), "admin PE counts");
    assert(entry.includes("overlayProgramMemberState"), "entry PE status");
    assert(interview.includes("findActiveMembership"), "interview PE membership");
    assert(anon.includes("scrubProgramMemberLegacyPii"), "anonymize PII exception");
    assert(anon.includes("programEnrollment.findMany"), "anonymize drops via PE");
  });

  await suite("does not freeze earlier families or disable dual-write", () => {
    const impl = source("src/repositories/program-state.ts");
    assert(!impl.includes("synergyPoints"), "no points");
    assert(!impl.includes("daysCompleted"), "no W7 denorm");
    assert(!impl.includes("isCampusAmbassadorCandidate"), "no W5");
    assert(!source("src/lib/feature-flags.ts").includes("ENABLE_DUAL_WRITE=false"), "no hardcoded DW=false");
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main();
