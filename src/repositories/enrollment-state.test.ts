/**
 * W7-A enrollment denorm current-state tests.
 * Run: npm run test:078-enrollment-state
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Domain } from "@prisma/client";
import {
  isLegacyEnrollmentDenormMirrorEnabled,
  isNewEnrollmentStateEnabled,
} from "@/lib/feature-flags";
import { applyEnrollmentDomainMirror, applyEnrollmentProgressDenorm } from "@/repositories/enrollment-state";

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
    daysCompleted: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastSubmittedDay: null as number | null,
  };
  const pe = { trackCurrentStreak: 0, trackLongestStreak: 0, exists: true };
  const sp = { domain: null as string | null, exists: true };
  return {
    writes,
    enrollmentRow,
    pe,
    sp,
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
    },
    enrollment: {
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
      assert(isNewEnrollmentStateEnabled() === false, "unset is false");
    });
  });

  await suite("ENABLE_LEGACY_ENROLLMENT_DENORM_MIRROR defaults on", async () => {
    await withFlags({ ENABLE_LEGACY_ENROLLMENT_DENORM_MIRROR: undefined }, () => {
      assert(isLegacyEnrollmentDenormMirrorEnabled() === true, "unset is true");
    });
  });

  await suite("does not overload progress/learning flags", () => {
    const src = source("src/lib/feature-flags.ts");
    assert(src.includes("ENABLE_NEW_ENROLLMENT_STATE"), "own read flag");
    assert(
      source("src/repositories/enrollment-state.ts").includes(
        "isLegacyEnrollmentDenormMirrorEnabled",
      ),
      "own mirror flag",
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
        assert(tx.writes.some((w) => w === "enrollment.update"), "legacy mirror");
        assert(tx.pe.trackCurrentStreak === 2, "pe current");
        assert(tx.enrollmentRow.daysCompleted === 4, "legacy days");
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
    const tx = makeTx();
    tx.sp.exists = false;
    await applyEnrollmentDomainMirror(tx as never, "u1", Domain.AI);
    assert(tx.writes.includes("sp.updateMany"), "attempted");
  });

  await suite("second enrollment does not overwrite first-track domain", () => {
    const core = source("src/features/enrollment/create-core-enrollment.ts");
    assert(core.includes("applyEnrollmentDomainMirror"), "mirror helper");
    assert(
      source("src/repositories/enrollment-state.ts").includes("domain: null"),
      "only null SP.domain",
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
        "dualWriteChallengeEnrollment",
      ),
      "PE before domain mirror",
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
    assert(
      denorm.includes("daysCompleted: input.daysCompleted"),
      "denorm helper only writes W7 fields",
    );
    assert(
      !denorm.includes("status:"),
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

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
