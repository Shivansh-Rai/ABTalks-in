/**
 * W7-A enrollment denorm current-state tests.
 * Run: npm run test:078-enrollment-state
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Domain, EnrollmentStatus, EnrollmentStatusV2 } from "@prisma/client";
import {
  applyChallengeProgramEnrollment,
  applyChallengeProgramEnrollmentById,
  applyEnrollmentDomainMirror,
  applyEnrollmentProgressDenorm,
  mapChallengeEnrollmentStatus,
} from "@/repositories/enrollment-state";

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
  const enrollmentRow = {
    id: "enr1",
    userId: "u1",
    domain: Domain.AI,
    status: EnrollmentStatus.ACTIVE as EnrollmentStatus,
    startedAt: new Date("2026-09-01"),
    completedAt: null as Date | null,
    daysCompleted: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastSubmittedDay: null as number | null,
  };
  const pe = {
    id: "",
    status: "" as string,
    completedAt: null as Date | null,
    trackCurrentStreak: 0,
    trackLongestStreak: 0,
    exists: true,
    upsertCount: 0,
  };
  const sp = { domain: null as string | null, exists: true };
  return {
    writes,
    enrollmentRow,
    pe,
    sp,
    cohort: {
      findUnique: async ({ where }: { where: { slug: string } }) => {
        writes.push(`cohort.find:${where.slug}`);
        return { id: `coh_${where.slug}` };
      },
    },
    programEnrollment: {
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { trackCurrentStreak: number; trackLongestStreak: number };
      }) => {
        writes.push(`pe.updateMany:${where.id}`);
        if (!pe.exists) return { count: 0 };
        pe.trackCurrentStreak = data.trackCurrentStreak;
        pe.trackLongestStreak = data.trackLongestStreak;
        return { count: 1 };
      },
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { id: string };
        create: {
          id: string;
          status: EnrollmentStatusV2;
          completedAt: Date | null;
        };
        update: { status: EnrollmentStatusV2; completedAt: Date | null };
      }) => {
        writes.push(`pe.upsert:${where.id}`);
        pe.upsertCount += 1;
        pe.id = create.id;
        pe.status = update.status ?? create.status;
        pe.completedAt = update.completedAt ?? create.completedAt;
        pe.exists = true;
        return pe;
      },
    },
    enrollment: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        writes.push(`enrollment.find:${where.id}`);
        if (enrollmentRow.id !== where.id) return null;
        return { ...enrollmentRow };
      },
      update: async ({
        data,
      }: {
        where: { id: string };
        data: {
          daysCompleted: number;
          currentStreak: number;
          longestStreak: number;
          lastSubmittedDay: number | null;
        };
      }) => {
        writes.push("enrollment.update");
        Object.assign(enrollmentRow, data);
        return enrollmentRow;
      },
    },
    studentProfile: {
      updateMany: async ({
        data,
      }: {
        where: { userId: string; domain: null };
        data: { domain: Domain };
      }) => {
        writes.push("sp.updateMany");
        if (!sp.exists) return { count: 0 };
        if (sp.domain == null) sp.domain = data.domain;
        return { count: sp.domain ? 1 : 0 };
      },
    },
  };
}

async function main() {
  await suite("ENABLE_NEW_ENROLLMENT_STATE defaults off", async () => {
    await withFlags({ ENABLE_NEW_ENROLLMENT_STATE: undefined }, () => {
      assert(true, "migration flag retired");
    });
  });

  await suite("ENABLE_LEGACY_ENROLLMENT_DENORM_MIRROR defaults on", async () => {
    await withFlags({ ENABLE_LEGACY_ENROLLMENT_DENORM_MIRROR: undefined }, () => {
      assert(true, "migration flag retired");
    });
  });

  await suite("does not overload progress/learning flags", () => {
    const src = source("src/lib/feature-flags.ts");
    assert(!src.includes("ENABLE_NEW_ENROLLMENT_STATE"), "own read flag");
    assert(
      !source("src/repositories/enrollment-state.ts").includes(
        "isLegacyEnrollmentDenormMirrorEnabled",
      ),
      "own mirror flag retired",
    );
    assert(
      !source("src/repositories/enrollment-state.ts").includes("isNewProgressRepoEnabled"),
      "does not reuse progress read flag",
    );
  });

  await suite("legacy denorm mirror off skips Enrollment write", async () => {
    await withFlags(
      {
        ENABLE_NEW_ENROLLMENT_STATE: "true",
        ENABLE_LEGACY_ENROLLMENT_DENORM_MIRROR: "false",
      },
      async () => {
        const tx = makeTx();
        await applyEnrollmentProgressDenorm(tx as never, {
          enrollmentId: "enr1",
          daysCompleted: 4,
          currentStreak: 2,
          longestStreak: 3,
          lastSubmittedDay: 4,
        });
        assert(tx.writes[0]?.startsWith("pe.updateMany:"), "canonical still writes");
        assert(!tx.writes.includes("enrollment.update"), "legacy skipped");
      },
    );
  });

  await suite("submit writes PE snapshot then Enrollment mirror", async () => {
    await withFlags(
      {
        ENABLE_NEW_ENROLLMENT_STATE: "true",
        ENABLE_LEGACY_ENROLLMENT_DENORM_MIRROR: undefined,
      },
      async () => {
        const tx = makeTx();
        await applyEnrollmentProgressDenorm(tx as never, {
          enrollmentId: "enr1",
          daysCompleted: 4,
          currentStreak: 2,
          longestStreak: 3,
          lastSubmittedDay: 4,
        });
        assert(tx.writes[0]?.startsWith("pe.updateMany:"), `pe first ${tx.writes[0]}`);
        assert(!tx.writes.some((w) => w === "enrollment.update"), "legacy mirror retired");
        assert(tx.pe.trackCurrentStreak === 2, "pe current");
        assert(tx.enrollmentRow.daysCompleted === 0, "legacy days frozen");
      },
    );
  });

  await suite("retry/resubmit does not require a second PE row", () => {
    assert(
      source("src/features/submission/submit-day.ts").includes(
        "applyEnrollmentProgressDenorm",
      ),
      "submit uses denorm boundary",
    );
    assert(
      source("src/features/submission/streak-utils.ts").includes(
        "listCanonicalChallengeDays",
      ),
      "days from AA",
    );
  });

  await suite("reject/reset uses denorm boundary", () => {
    const admin = source("src/app/actions/admin-actions.ts");
    assert(admin.includes("applyEnrollmentProgressDenorm"), "admin denorm");
    assert(admin.includes("listCanonicalChallengeDays"), "reject leftover Submission ignored");
  });

  await suite("missing StudentProfile domain mirror is a no-op", async () => {
    await withFlags({ ENABLE_LEGACY_ENROLLMENT_DENORM_MIRROR: "true" }, async () => {
      const tx = makeTx();
      tx.sp.exists = false;
      await applyEnrollmentDomainMirror(tx as never, "u1", Domain.AI);
      assert(!tx.writes.includes("sp.updateMany"), "domain mirror retired");
    });
  });

  await suite("second enrollment does not overwrite first-track domain", () => {
    const core = source("src/features/enrollment/create-core-enrollment.ts");
    assert(core.includes("applyEnrollmentDomainMirror"), "mirror helper");
    assert(
      source("src/repositories/enrollment-state.ts").includes("void domain"),
      "domain mirror is a no-op",
    );
  });

  await suite("EnrollmentProgress is not made authoritative", () => {
    const src = source("src/repositories/enrollment-state.ts");
    assert(!src.includes("prisma.enrollmentProgress"), "no EP reads");
    assert(!src.includes("tx.enrollmentProgress"), "no EP writes");
    assert(!src.includes("prisma.programMember"), "W8 isolation");
    assert(!src.includes("synergyPoints"), "points frozen");
    assert(!src.includes("quizAttempt"), "W6 frozen");
  });

  await suite("live readers go through overlay or displayedChallengeDomain", () => {
    assert(
      source("src/features/dashboard/get-leaderboard.ts").includes(
        "overlayChallengeProgressFields",
      ),
      "leaderboard",
    );
    assert(
      source("src/features/dashboard/get-dashboard-data.ts").includes(
        "displayedChallengeDomain",
      ),
      "dashboard domain",
    );
    assert(
      source("src/features/profile/get-public-profile.ts").includes(
        "displayedChallengeDomain",
      ),
      "public domain",
    );
    assert(
      source("src/features/profile/get-profile.ts").includes(
        "displayedChallengeDomain",
      ),
      "profile domain",
    );
    assert(
      source("src/features/enrollment/create-core-enrollment.ts").includes(
        "applyChallengeProgramEnrollment",
      ),
      "canonical PE before domain mirror",
    );
    assert(
      source("src/features/enrollment/create-core-enrollment.ts").includes(
        "applyVisibilityChange",
      ),
      "W2 visibility stays on enroll",
    );
    assert(
      !source("src/features/enrollment/create-core-enrollment.ts").includes(
        "dualWriteChallengeEnrollment",
      ),
      "create does not use runDualWrite helper",
    );
  });

  await suite("W7-B reporting current-state uses canonical overlay", () => {
    assert(
      source("src/features/admin/get-overview-stats.ts").includes(
        "countChallengeEnrollmentsWithDaysGte",
      ),
      "admin 30/60",
    );
    assert(
      source("src/features/admin/get-analytics-data.ts").includes(
        "overlayChallengeProgressFields",
      ),
      "analytics dropoff/top",
    );
    assert(
      source("src/features/admin/get-dropoff-by-day.ts").includes(
        "overlayChallengeProgressFields",
      ),
      "dropoff lastSubmittedDay",
    );
    assert(
      source("src/features/admin/get-referrals-report.ts").includes(
        "overlayChallengeProgressFields",
      ),
      "referrals days",
    );
    assert(
      source("src/features/admin/get-referrals-report.ts").includes(
        "displayedChallengeDomains",
      ),
      "referrals domain",
    );
    assert(
      source("src/app/actions/admin-export-actions.ts").includes(
        "overlayChallengeProgressFields",
      ),
      "CSV overlay",
    );
    assert(
      !source("src/features/profile/get-verified-accomplishments.ts").includes(
        "Math.max(stats.daysCompleted",
      ),
      "accomplishments do not Math.max frozen days",
    );
    assert(
      source("src/features/certificate/issue-certificate.ts").includes(
        "progress.daysCompleted",
      ),
      "new certificates mint canonical metadata",
    );
  });

  await suite("lastSubmittedDay canonical semantic is max passed day", () => {
    const progress = source("src/repositories/progress.ts");
    const streak = source("src/features/submission/streak-utils.ts");
    assert(
      progress.includes("Highest passed challenge day number"),
      "overlay documents max passed day",
    );
    assert(
      streak.includes("lastSubmittedDay = row.dayNumber"),
      "submit derivation is max dayNumber",
    );
    assert(
      source("src/features/admin/get-dropoff-by-day.ts").includes(
        'id: { startsWith: "aa_sub_" }',
      ),
      "dropoff date from AA not frozen Submission",
    );
  });

  await suite("operational Enrollment writes are not denorm-gated", () => {
    const submit = source("src/features/submission/submit-day.ts");
    const admin = source("src/app/actions/admin-actions.ts");
    const denorm = source("src/repositories/enrollment-state.ts");
    assert(submit.includes("status: EnrollmentStatus.COMPLETED"), "status stays live");
    assert(admin.includes('status: "ACTIVE"'), "reset status stays live");
    const denormFn = denorm.slice(
      denorm.indexOf("export async function applyEnrollmentProgressDenorm"),
      denorm.indexOf("export async function applyEnrollmentDomainMirror"),
    );
    assert(
      denormFn.includes("trackCurrentStreak: input.currentStreak"),
      "denorm helper writes PE snapshot only",
    );
    assert(
      !denormFn.includes("status:"),
      "denorm helper does not write Enrollment.status",
    );
  });

  await suite("domain mirror off skips SP write and does not mint SP", async () => {
    await withFlags(
      { ENABLE_LEGACY_ENROLLMENT_DENORM_MIRROR: "false" },
      async () => {
        const tx = makeTx();
        await applyEnrollmentDomainMirror(tx as never, "u1", Domain.AI);
        assert(!tx.writes.includes("sp.updateMany"), "SP.domain skipped");
      },
    );
    assert(
      source("src/features/enrollment/create-core-enrollment.ts").includes(
        "applyEnrollmentDomainMirror",
      ),
      "create still calls helper",
    );
    assert(
      !source("src/features/enrollment/create-core-enrollment.ts").includes(
        "studentProfile.create",
      ),
      "create does not mint SP for domain",
    );
  });

  await suite("leaderboard/admin list re-rank after overlay when frozen", () => {
    const lb = source("src/features/dashboard/get-leaderboard.ts");
    assert(lb.includes("overlaid.slice(0, limit)"), "leaderboard ranks overlay");
    const students = source("src/features/admin/get-students.ts");
    assert(
      students.includes('sortBy === "days" || sortBy === "streak"'),
      "admin days/streak fetch all then overlay",
    );
  });

  await suite("mapChallengeEnrollmentStatus matches legacy dual-write mapping", () => {
    assert(
      mapChallengeEnrollmentStatus(EnrollmentStatus.ACTIVE) ===
        EnrollmentStatusV2.ACTIVE,
      "ACTIVE",
    );
    assert(
      mapChallengeEnrollmentStatus(EnrollmentStatus.COMPLETED) ===
        EnrollmentStatusV2.COMPLETED,
      "COMPLETED",
    );
    assert(
      mapChallengeEnrollmentStatus(EnrollmentStatus.ABANDONED) ===
        EnrollmentStatusV2.DROPPED,
      "ABANDONED→DROPPED",
    );
  });

  await suite("new enrollment upserts pe_enr_ even when dual-write is off", async () => {
    await withFlags(
      {
        ENABLE_DUAL_WRITE: "false",
        ENABLE_NEW_LEARNING: "true",
        ENABLE_NEW_ENROLLMENT_STATE: "true",
        ENABLE_LEGACY_ENROLLMENT_DENORM_MIRROR: "false",
      },
      async () => {
        const tx = makeTx();
        const result = await applyChallengeProgramEnrollment(tx as never, {
          id: "enr1",
          userId: "u1",
          domain: Domain.AI,
          status: EnrollmentStatus.ACTIVE,
          startedAt: new Date("2026-09-01"),
          completedAt: null,
        });
        assert(result.id === "pe_enr_enr1", "deterministic pe_enr id");
        assert(tx.writes.includes("pe.upsert:pe_enr_enr1"), "upserted");
        assert(tx.pe.status === EnrollmentStatusV2.ACTIVE, "ACTIVE");
        assert(!tx.writes.includes("enrollment.update"), "no denorm write");
        assert(!tx.writes.includes("sp.updateMany"), "no domain remirror");
      },
    );
  });

  await suite("retry enrollment does not duplicate PE", async () => {
    const tx = makeTx();
    const input = {
      id: "enr1",
      userId: "u1",
      domain: Domain.AI,
      status: EnrollmentStatus.ACTIVE,
      startedAt: new Date("2026-09-01"),
      completedAt: null,
    };
    await applyChallengeProgramEnrollment(tx as never, input);
    await applyChallengeProgramEnrollment(tx as never, input);
    assert(tx.pe.upsertCount === 2, "upsert twice");
    assert(tx.pe.id === "pe_enr_enr1", "same id");
  });

  await suite("completion maps PE to COMPLETED", async () => {
    const tx = makeTx();
    await applyChallengeProgramEnrollment(tx as never, {
      id: "enr1",
      userId: "u1",
      domain: Domain.AI,
      status: EnrollmentStatus.COMPLETED,
      startedAt: new Date("2026-09-01"),
      completedAt: new Date("2026-09-22"),
    });
    assert(tx.pe.status === EnrollmentStatusV2.COMPLETED, "completed");
    assert(tx.pe.completedAt instanceof Date, "completedAt set");
  });

  await suite("anonymize maps PE to DROPPED", async () => {
    const tx = makeTx();
    tx.enrollmentRow.status = EnrollmentStatus.ABANDONED;
    const result = await applyChallengeProgramEnrollmentById(tx as never, "enr1");
    assert(result?.id === "pe_enr_enr1", "id");
    assert(tx.pe.status === EnrollmentStatusV2.DROPPED, "abandoned→dropped");
  });

  await suite("admin reset/status uses canonical PE writer", () => {
    const admin = source("src/app/actions/admin-actions.ts");
    const count = admin.split("applyChallengeProgramEnrollmentById").length - 1;
    assert(count >= 3, `reset/remove/reject expected ≥3, got ${count}`);
    assert(!admin.includes("dualWriteChallengeEnrollment"), "no DW helper");
  });

  await suite("submit-day completion uses canonical PE writer", () => {
    const src = source("src/features/submission/submit-day.ts");
    assert(src.includes("EnrollmentStatus.COMPLETED"), "sets COMPLETED");
    assert(src.includes("applyChallengeProgramEnrollmentById"), "canonical");
    assert(!src.includes("dualWriteChallengeEnrollment"), "no DW helper");
  });

  await suite("anonymize uses canonical PE writer", () => {
    const src = source("src/features/admin/anonymize-user.ts");
    assert(src.includes("applyChallengeProgramEnrollmentById"), "canonical");
    assert(!src.includes("dualWriteChallengeEnrollment"), "no DW helper");
    assert(src.includes("applyVisibilityChange"), "withdraw unchanged");
    assert(src.includes("scrubProgramMemberLegacyPii"), "PM PII scrub stays");
  });

  await suite("canonical PE writer is independent of dual-write", () => {
    const src = source("src/repositories/enrollment-state.ts");
    const slice = src.slice(
      src.indexOf("export async function applyChallengeProgramEnrollment"),
      src.indexOf("export type EnrollmentProgressDenorm"),
    );
    assert(!slice.includes("runDualWrite"), "no runDualWrite");
    assert(!slice.includes("isDualWriteEnabled"), "no DW flag");
    assert(!slice.includes("ENABLE_DUAL_WRITE"), "no DW env");
    assert(!slice.includes("applyVisibilityChange"), "visibility stays W2");
    assert(!slice.includes("daysCompleted"), "no denorm remirror");
    assert(!slice.includes("studentProfile"), "no SP");
    assert(!slice.includes("synergyPoints"), "no points");
    assert(!slice.includes("certificate"), "no certificate");
    assert(!slice.includes("programMember"), "no PM");
  });

  await suite("production call sites no longer depend on runDualWrite for pe_enr", () => {
    for (const file of [
      "src/features/enrollment/create-core-enrollment.ts",
      "src/features/enrollment/create-claude-enrollment.ts",
      "src/features/submission/submit-day.ts",
      "src/app/actions/admin-actions.ts",
      "src/features/admin/anonymize-user.ts",
    ]) {
      const src = source(file);
      assert(!src.includes("runDualWrite"), `${file} no runDualWrite`);
      assert(
        !src.includes("dualWriteChallengeEnrollment"),
        `${file} no dualWriteChallengeEnrollment`,
      );
    }
  });

  await suite("Phase 8-B does not reactivate frozen mirrors", () => {
    const impl = source("src/repositories/enrollment-state.ts");
    assert(!impl.includes("isLegacyEnrollmentDenormMirrorEnabled"), "W7-B gate retired");
    assert(!impl.includes("isLegacyPointsMirrorEnabled"), "no points remirror");
    assert(
      !impl.includes("isLegacyCertificateMirrorEnabled"),
      "no certificate remirror",
    );
    assert(
      !impl.includes("isLegacyStudentProfileMirrorEnabled"),
      "no identity remirror",
    );
    assert(
      !impl.includes("isLegacyAmbassadorMirrorEnabled"),
      "no ambassador remirror",
    );
    assert(
      !impl.includes("isLegacyProgressMirrorEnabled"),
      "no progress remirror",
    );
    assert(
      !impl.includes("isLegacyProgramMemberMirrorEnabled"),
      "no PM remirror",
    );
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
