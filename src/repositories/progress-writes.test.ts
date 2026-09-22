/**
 * W6-A progress write-authority tests.
 * Run: npm run test:078-progress-writes
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { SubmissionStatus } from "@prisma/client";
import {
  isLegacyProgressMirrorEnabled,
  isNewProgressWritesEnabled,
} from "@/lib/feature-flags";
import {
  applyChallengeSubmissionChange,
  applyDeleteChallengeSubmission,
  applyProgramMissionAttemptChange,
  applyQuizAttemptChange,
} from "@/repositories/progress-writes";
import { attemptIdForSubmission } from "@/repositories/ids";

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

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(full, acc);
    } else if (name.endsWith(".ts") || name.endsWith(".tsx")) {
      acc.push(full);
    }
  }
  return acc;
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

type AaRow = { id: string; passed?: boolean; score?: number | null; payload?: unknown };
type SubRow = { id: string; githubUrl: string | null; status: string };
type QaRow = { id: string; score: number };
type PmsRow = { id: string; passed: boolean; attemptNumber: number };

function makeTx() {
  const writes: string[] = [];
  const attempts = new Map<string, AaRow>();
  const evals = new Map<string, { id: string; passed: boolean }>();
  const submissions = new Map<string, SubRow>();
  const quizzes = new Map<string, QaRow>();
  const missions = new Map<string, PmsRow>();
  const tx = {
    writes,
    attempts,
    evals,
    submissions,
    quizzes,
    missions,
    $executeRawUnsafe: async () => 0,
    submission: {
      create: async ({ data }: { data: SubRow & { id?: string } }) => {
        const id = data.id ?? `sub_${writes.length}`;
        writes.push(`submission.create:${id}`);
        submissions.set(id, { id, githubUrl: data.githubUrl, status: data.status });
        return { id };
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<SubRow>;
      }) => {
        writes.push(`submission.update:${where.id}`);
        const cur = submissions.get(where.id) ?? {
          id: where.id,
          githubUrl: null,
          status: "ON_TIME",
        };
        submissions.set(where.id, { ...cur, ...data, id: where.id });
        return submissions.get(where.id);
      },
      delete: async ({ where }: { where: { id: string } }) => {
        writes.push(`submission.delete:${where.id}`);
        submissions.delete(where.id);
      },
      deleteMany: async ({ where }: { where: { id?: string; enrollmentId?: string } }) => {
        writes.push("submission.deleteMany");
        if (where.id) submissions.delete(where.id);
        return { count: 1 };
      },
      findUnique: async () => null,
    },
    quizAttempt: {
      create: async ({ data }: { data: { id?: string; score: number } }) => {
        const id = data.id ?? `qa_${writes.length}`;
        writes.push(`quizAttempt.create:${id}`);
        quizzes.set(id, { id, score: data.score });
        return { id, attemptedAt: new Date("2026-09-21T10:00:00.000Z") };
      },
      findUnique: async () => null,
    },
    programMissionSubmission: {
      create: async ({
        data,
      }: {
        data: { id?: string; passed: boolean; attemptNumber: number };
      }) => {
        const id = data.id ?? `pms_${writes.length}`;
        writes.push(`pms.create:${id}`);
        missions.set(id, {
          id,
          passed: data.passed,
          attemptNumber: data.attemptNumber,
        });
        return { id, createdAt: new Date("2026-09-21T10:00:00.000Z") };
      },
      deleteMany: async ({ where }: { where: { id: string } }) => {
        writes.push(`pms.deleteMany:${where.id}`);
        missions.delete(where.id);
        return { count: 1 };
      },
    },
    activityAttempt: {
      upsert: async ({
        where,
        create,
      }: {
        where: { id: string };
        create: AaRow;
      }) => {
        writes.push(`aa.upsert:${where.id}`);
        attempts.set(where.id, { ...create, id: where.id });
        return create;
      },
      findUnique: async () => null,
      deleteMany: async ({ where }: { where: { id?: string | { startsWith?: string } } }) => {
        const id = typeof where.id === "string" ? where.id : null;
        writes.push(`aa.deleteMany:${id ?? "prefix"}`);
        if (id) attempts.delete(id);
        return { count: 1 };
      },
    },
    activityEvaluation: {
      upsert: async ({
        where,
        create,
      }: {
        where: { id: string };
        create: { id: string; passed: boolean };
      }) => {
        writes.push(`ev.upsert:${where.id}`);
        evals.set(where.id, create);
        return create;
      },
    },
  };
  return tx;
}

async function main() {
  await suite("ENABLE_NEW_PROGRESS_WRITES defaults off", async () => {
    await withFlags({ ENABLE_NEW_PROGRESS_WRITES: undefined }, () => {
      assert(isNewProgressWritesEnabled() === false, "unset is false");
    });
  });

  await suite("ENABLE_LEGACY_PROGRESS_MIRROR defaults on", async () => {
    await withFlags({ ENABLE_LEGACY_PROGRESS_MIRROR: undefined }, () => {
      assert(isLegacyProgressMirrorEnabled() === true, "unset is true");
    });
    await withFlags({ ENABLE_LEGACY_PROGRESS_MIRROR: "false" }, () => {
      assert(isLegacyProgressMirrorEnabled() === false, "false is false");
    });
  });

  await suite("does not overload ENABLE_NEW_PROGRESS", () => {
    const src = source("src/lib/feature-flags.ts");
    assert(src.includes("ENABLE_NEW_PROGRESS_WRITES"), "write flag");
    assert(
      !source("src/repositories/progress-writes.ts").includes(
        "isNewProgressWritesEnabled",
      ),
      "runtime writer ignores write flag",
    );
    assert(
      !source("src/repositories/progress-writes.ts").includes(
        "isNewProgressRepoEnabled",
      ),
      "does not reuse read flag",
    );
  });

  await suite("live product writers go through apply*", () => {
    assert(
      source("src/features/submission/submit-day.ts").includes(
        "applyChallengeSubmissionChange",
      ),
      "challenge",
    );
    assert(
      source("src/features/quiz/submit-quiz.ts").includes("applyQuizAttemptChange"),
      "quiz",
    );
    assert(
      source("src/features/program/missions.ts").includes(
        "applyProgramMissionAttemptChange",
      ),
      "mission",
    );
    const admin = source("src/app/actions/admin-actions.ts");
    assert(admin.includes("applyDeleteChallengeSubmission"), "reject");
    assert(admin.includes("applyDeleteEnrollmentChallengeAttempts"), "reset");
    const boot = source("src/features/program/bootstrap-start-day.ts");
    assert(boot.includes("applyProgramMissionAttemptChange"), "waiver");
    assert(boot.includes("applyDeleteProgramMissionAttempt"), "stale waiver");
  });

  await suite("no invented admin pass/fail writer", () => {
    const admin = source("src/app/actions/admin-actions.ts");
    assert(!admin.includes("applyProgramMissionAttemptChange"), "no admin mission grade");
  });

  await suite("historical quiz answers are not rebuilt", () => {
    const src = source("src/features/quiz/submit-quiz.ts");
    assert(src.includes("answers as Prisma.InputJsonValue"), "stores submitted answers");
    assert(!src.includes("mapQuizAttemptAnswers"), "no historical remap on write");
  });

  const w6a = {
    ENABLE_NEW_PROGRESS_WRITES: "true",
    ENABLE_LEGACY_PROGRESS_MIRROR: "true",
    ENABLE_DUAL_WRITE: "true",
    PROGRESS_FAIL_LEGACY_MIRROR: undefined,
  };

  await suite("W6-A challenge create writes canonical then Submission", async () => {
    await withFlags(w6a, async () => {
      const tx = makeTx();
      const result = await applyChallengeSubmissionChange(tx as never, {
        id: "sub1",
        userId: "u1",
        enrollmentId: "enr1",
        dailyTaskId: "dt1",
        dayNumber: 1,
        githubUrl: "https://github.com/a/b",
        linkedinUrl: null,
        status: SubmissionStatus.ON_TIME,
        submittedAt: new Date("2026-09-21T10:00:00.000Z"),
        pointsAwarded: 10,
        mode: "create",
      });
      assert(result.id === "sub1", "id");
      assert(tx.writes[0] === `aa.upsert:${attemptIdForSubmission("sub1")}`, `aa first ${tx.writes[0]}`);
      assert(tx.writes[1]?.startsWith("ev.upsert:"), "eval second");
      assert(tx.writes.some((w) => w === "submission.create:sub1"), "legacy mirror");
      assert(tx.attempts.get(attemptIdForSubmission("sub1"))?.id === attemptIdForSubmission("sub1"), "aa row");
    });
  });

  await suite("W6-A challenge retry/resubmit upserts same attempt id", async () => {
    await withFlags(w6a, async () => {
      const tx = makeTx();
      const input = {
        id: "sub1",
        userId: "u1",
        enrollmentId: "enr1",
        dailyTaskId: "dt1",
        dayNumber: 1,
        githubUrl: "https://github.com/a/b",
        linkedinUrl: null,
        status: SubmissionStatus.ON_TIME,
        submittedAt: new Date("2026-09-21T10:00:00.000Z"),
        pointsAwarded: 10,
        mode: "create" as const,
      };
      await applyChallengeSubmissionChange(tx as never, input);
      await applyChallengeSubmissionChange(tx as never, {
        ...input,
        githubUrl: "https://github.com/a/c",
        mode: "update",
        pointsAwarded: 0,
      });
      const aaWrites = tx.writes.filter((w) => w.startsWith("aa.upsert:"));
      assert(aaWrites.length === 2, "two upserts");
      assert(aaWrites[0] === aaWrites[1], "same id");
      assert(tx.attempts.size === 1, "one attempt row");
    });
  });

  await suite("W6-A late metadata is preserved on canonical lateness", async () => {
    await withFlags(w6a, async () => {
      const tx = makeTx();
      await applyChallengeSubmissionChange(tx as never, {
        id: "sub_late",
        userId: "u1",
        enrollmentId: "enr1",
        dailyTaskId: "dt1",
        dayNumber: 2,
        githubUrl: null,
        linkedinUrl: null,
        status: SubmissionStatus.LATE,
        submittedAt: new Date("2026-09-21T10:00:00.000Z"),
        pointsAwarded: 0,
        mode: "create",
      });
      const aa = tx.attempts.get(attemptIdForSubmission("sub_late")) as {
        lateness?: string;
      };
      assert(aa?.lateness === "LATE", "lateness");
    });
  });

  await suite("W6-A quiz writes attempt+eval then QuizAttempt; completion is existence", async () => {
    await withFlags(w6a, async () => {
      const tx = makeTx();
      const result = await applyQuizAttemptChange(tx as never, {
        id: "qa1",
        userId: "u1",
        enrollmentId: "enr1",
        quizId: "quiz1",
        score: 40,
        answers: { q1: "A" },
        attemptedAt: new Date("2026-09-21T10:00:00.000Z"),
      });
      assert(result.id === "qa1", "id");
      assert(tx.writes[0]?.startsWith("aa.upsert:aa_qa_qa1"), `aa first ${tx.writes[0]}`);
      assert(tx.quizzes.get("qa1")?.score === 40, "legacy score");
      assert(tx.attempts.get("aa_qa_qa1")?.passed === false, "score<60 is not completion");
    });
  });

  await suite("W6-A mission fail then pass uses distinct attempt numbers", async () => {
    await withFlags(w6a, async () => {
      const tx = makeTx();
      const fail = await applyProgramMissionAttemptChange(tx as never, {
        id: "pms1",
        memberId: "m1",
        programDayId: "pd1",
        dayNumber: 5,
        attemptNumber: 1,
        payload: { code: "nope" },
        verdict: [{ check: "run", passed: false }],
        passed: false,
        pointsAwarded: 0,
        createdAt: new Date("2026-09-21T10:00:00.000Z"),
      });
      const pass = await applyProgramMissionAttemptChange(tx as never, {
        id: "pms2",
        memberId: "m1",
        programDayId: "pd1",
        dayNumber: 5,
        attemptNumber: 2,
        payload: { code: "ok" },
        verdict: [{ check: "run", passed: true }],
        passed: true,
        pointsAwarded: 10,
        createdAt: new Date("2026-09-21T10:01:00.000Z"),
      });
      assert(fail.id !== pass.id, "new legacy id");
      assert(tx.attempts.size === 2, "two canonical attempts");
      assert(tx.attempts.get("aa_ms_pms1")?.passed === false, "fail kept");
      assert(tx.attempts.get("aa_ms_pms2")?.passed === true, "pass");
    });
  });

  await suite("W6-A reject deletes canonical then mirrors Submission delete", async () => {
    await withFlags(w6a, async () => {
      const tx = makeTx();
      tx.attempts.set("aa_sub_sub1", { id: "aa_sub_sub1" });
      tx.submissions.set("sub1", { id: "sub1", githubUrl: null, status: "ON_TIME" });
      await applyDeleteChallengeSubmission(tx as never, "sub1");
      assert(tx.writes[0] === "aa.deleteMany:aa_sub_sub1", `aa first ${tx.writes[0]}`);
      assert(tx.writes.some((w) => w === "submission.deleteMany"), "legacy delete");
    });
  });

  await suite("W6-A waiver uses applyProgramMissionAttemptChange", () => {
    const boot = source("src/features/program/bootstrap-start-day.ts");
    assert(boot.includes('reason: "cohort_start_day"'), "waiver payload");
    assert(boot.includes("applyProgramMissionAttemptChange"), "apply");
  });

  await suite("W6-A Submission mirror failure keeps canonical", async () => {
    await withFlags(
      { ...w6a, PROGRESS_FAIL_LEGACY_MIRROR: "submission" },
      async () => {
        const tx = makeTx();
        const result = await applyChallengeSubmissionChange(tx as never, {
          id: "sub_fail",
          userId: "u1",
          enrollmentId: "enr1",
          dailyTaskId: "dt1",
          dayNumber: 1,
          githubUrl: null,
          linkedinUrl: null,
          status: SubmissionStatus.ON_TIME,
          submittedAt: new Date("2026-09-21T10:00:00.000Z"),
          pointsAwarded: 10,
          mode: "create",
        });
        assert(result.mirrorFailed === true, "flagged");
        assert(tx.attempts.has(attemptIdForSubmission("sub_fail")), "canonical kept");
        assert(!tx.writes.some((w) => w.startsWith("submission.create")), "no legacy");
      },
    );
  });

  await suite("W6-A QuizAttempt mirror failure keeps canonical", async () => {
    await withFlags({ ...w6a, PROGRESS_FAIL_LEGACY_MIRROR: "quiz" }, async () => {
      const tx = makeTx();
      const result = await applyQuizAttemptChange(tx as never, {
        id: "qa_fail",
        userId: "u1",
        enrollmentId: "enr1",
        quizId: "quiz1",
        score: 80,
        answers: { q1: "B" },
        attemptedAt: new Date("2026-09-21T10:00:00.000Z"),
      });
      assert(result.mirrorFailed === true, "flagged");
      assert(tx.attempts.has("aa_qa_qa_fail"), "canonical kept");
      assert(!tx.writes.some((w) => w.startsWith("quizAttempt.create")), "no legacy");
    });
  });

  await suite("W6-A PMS mirror failure keeps canonical", async () => {
    await withFlags({ ...w6a, PROGRESS_FAIL_LEGACY_MIRROR: "mission" }, async () => {
      const tx = makeTx();
      const result = await applyProgramMissionAttemptChange(tx as never, {
        id: "pms_fail",
        memberId: "m1",
        programDayId: "pd1",
        dayNumber: 5,
        attemptNumber: 1,
        payload: {},
        verdict: [],
        passed: true,
        pointsAwarded: 10,
        createdAt: new Date("2026-09-21T10:00:00.000Z"),
      });
      assert(result.mirrorFailed === true, "flagged");
      assert(tx.attempts.has("aa_ms_pms_fail"), "canonical kept");
      assert(!tx.writes.some((w) => w.startsWith("pms.create")), "no legacy");
    });
  });

  await suite("ENABLE_NEW_PROGRESS_WRITES=false still writes ActivityAttempt first", async () => {
    await withFlags(
      {
        ENABLE_NEW_PROGRESS_WRITES: undefined,
        ENABLE_LEGACY_PROGRESS_MIRROR: undefined,
        ENABLE_DUAL_WRITE: "true",
      },
      async () => {
        const tx = makeTx();
        await applyChallengeSubmissionChange(tx as never, {
          userId: "u1",
          enrollmentId: "enr1",
          dailyTaskId: "dt1",
          dayNumber: 1,
          githubUrl: null,
          linkedinUrl: null,
          status: SubmissionStatus.ON_TIME,
          submittedAt: new Date("2026-09-21T10:00:00.000Z"),
          pointsAwarded: 0,
          mode: "create",
        });
        assert(
          tx.writes[0]?.startsWith("aa.upsert:") || tx.writes[0]?.includes("activityAttempt"),
          `canonical first ${tx.writes[0]}`,
        );
        assert(!tx.writes[0]?.startsWith("submission.create:"), "legacy-first retired");
      },
    );
  });

  await suite("progress-writes does not touch domain/points/identity/ambassador", () => {
    const src = source("src/repositories/progress-writes.ts");
    assert(!src.includes("synergyPoints"), "no points columns");
    assert(!src.includes("studentProfile"), "no SP writes");
    assert(!src.includes("isCampusAmbassadorCandidate"), "no ambassador");
    assert(!src.includes("fullName"), "no identity");
  });

  await suite("078-native cohorts already write AA first and stay untouched", () => {
    const dbx = source("src/repositories/databricks.ts");
    assert(dbx.includes("activityAttempt.create"), "native AA");
    assert(!dbx.includes("applyChallengeSubmissionChange"), "not W6 wrapper");
    assert(!source("src/repositories/progress-writes.ts").includes("databricks"), "no cohort pull-in");
  });

  await suite("W6-B mirror off skips legacy Submission write", async () => {
    await withFlags(
      {
        ENABLE_NEW_PROGRESS_WRITES: "true",
        ENABLE_LEGACY_PROGRESS_MIRROR: "false",
      },
      async () => {
        const tx = makeTx();
        const result = await applyChallengeSubmissionChange(tx as never, {
          id: "sub1",
          userId: "u1",
          enrollmentId: "enr1",
          dailyTaskId: "dt1",
          dayNumber: 1,
          githubUrl: "https://github.com/a/b",
          linkedinUrl: null,
          status: SubmissionStatus.ON_TIME,
          submittedAt: new Date("2026-09-22T00:00:00Z"),
          pointsAwarded: 10,
          mode: "create",
        });
        assert(result.id === "sub1", "id");
        assert(tx.attempts.has(attemptIdForSubmission("sub1")), "canonical");
        assert(!tx.writes.some((w) => w.startsWith("submission.create")), "no legacy");
      },
    );
  });

  await suite("W6-B identity lookup prefers canonical AA over frozen Submission", () => {
    const src = source("src/repositories/progress-writes.ts");
    const fn = src.slice(src.indexOf("export async function findChallengeSubmissionId"));
    const aaIdx = fn.indexOf("activityAttempt.findUnique");
    const subIdx = fn.indexOf("submission.findUnique");
    assert(aaIdx >= 0 && (subIdx < 0 || aaIdx < subIdx), "AA first when writes on");
    const quizFn = src.slice(src.indexOf("export async function findQuizAttemptId"));
    const quizAa = quizFn.indexOf("activityAttempt.findUnique");
    const quizQa = quizFn.indexOf("quizAttempt.findUnique");
    assert(quizAa >= 0 && (quizQa < 0 || quizAa < quizQa), "quiz AA first when writes on");
  });

  await suite("W6-B quiz create skips QuizAttempt", async () => {
    await withFlags(
      {
        ENABLE_NEW_PROGRESS_WRITES: "true",
        ENABLE_LEGACY_PROGRESS_MIRROR: "false",
      },
      async () => {
        const tx = makeTx();
        await applyQuizAttemptChange(tx as never, {
          id: "qa1",
          userId: "u1",
          enrollmentId: "enr1",
          quizId: "quiz1",
          score: 40,
          answers: { q1: "A" },
          attemptedAt: new Date("2026-09-22T00:00:00Z"),
        });
        assert(tx.attempts.has("aa_qa_qa1"), "canonical");
        assert(!tx.writes.some((w) => w.startsWith("quizAttempt.create")), "no legacy");
      },
    );
  });

  await suite("W6-B mission fail then pass skips PMS", async () => {
    await withFlags(
      {
        ENABLE_NEW_PROGRESS_WRITES: "true",
        ENABLE_LEGACY_PROGRESS_MIRROR: "false",
      },
      async () => {
        const tx = makeTx();
        await applyProgramMissionAttemptChange(tx as never, {
          id: "pms_fail",
          memberId: "m1",
          programDayId: "pd1",
          dayNumber: 5,
          attemptNumber: 1,
          payload: {},
          verdict: [],
          passed: false,
          pointsAwarded: 0,
          createdAt: new Date("2026-09-22T00:00:00Z"),
        });
        await applyProgramMissionAttemptChange(tx as never, {
          id: "pms_pass",
          memberId: "m1",
          programDayId: "pd1",
          dayNumber: 5,
          attemptNumber: 2,
          payload: {},
          verdict: [],
          passed: true,
          pointsAwarded: 10,
          createdAt: new Date("2026-09-22T00:01:00Z"),
        });
        assert(tx.attempts.has("aa_ms_pms_fail"), "fail attempt");
        assert(tx.attempts.has("aa_ms_pms_pass"), "pass attempt");
        assert(!tx.writes.some((w) => w.startsWith("pms.create")), "no legacy");
      },
    );
  });

  await suite("W6-B reject deletes canonical and skips frozen Submission delete", async () => {
    await withFlags(
      {
        ENABLE_NEW_PROGRESS_WRITES: "true",
        ENABLE_LEGACY_PROGRESS_MIRROR: "false",
      },
      async () => {
        const tx = makeTx();
        tx.submissions.set("sub1", { id: "sub1", githubUrl: null, status: "ON_TIME" });
        tx.attempts.set("aa_sub_sub1", { id: "aa_sub_sub1", passed: true });
        await applyDeleteChallengeSubmission(tx as never, "sub1");
        assert(!tx.attempts.has("aa_sub_sub1"), "canonical gone");
        assert(tx.submissions.has("sub1"), "frozen leftover remains");
        assert(!tx.writes.some((w) => w.includes("submission.delete")), "no legacy delete");
      },
    );
  });

  await suite("W6-B GitHub uniqueness uses canonical AA index not Submission", () => {
    const src = source("src/features/submission/validate-github-url.ts");
    assert(src.includes("payload->>'githubUrl'"), "expression unique");
    assert(src.includes("listGithubUrlOwners"), "canonical owners");
    assert(
      source("prisma/migrations/20260820120000_platform_data_architecture_phase1/migration.sql").includes(
        "attempt_github_url_unique",
      ),
      "db unique exists",
    );
  });

  await suite("W6-B streak and daysCompleted source is ActivityAttempt", () => {
    const streak = source("src/features/submission/streak-utils.ts");
    assert(streak.includes("activityAttempt.findMany"), "canonical days");
    assert(
      source("src/features/submission/submit-day.ts").includes("listCanonicalChallengeDays"),
      "submit uses canonical count",
    );
    assert(
      source("src/app/actions/admin-actions.ts").includes("listCanonicalChallengeDays"),
      "reject/reset uses canonical count",
    );
  });

  await suite("W6-B admin/current-state consumers left Submission", () => {
    assert(
      source("src/features/admin/get-submissions-feed.ts").includes("listCanonicalChallengeFeed"),
      "feed",
    );
    assert(
      source("src/features/admin/get-student-detail.ts").includes("listQuizAttemptsForUser"),
      "quiz list",
    );
    assert(
      !source("src/features/admin/get-analytics-data.ts").includes("prisma.submission"),
      "analytics",
    );
    assert(
      source("src/repositories/progress.ts").includes('startsWith: "aa_ms_"'),
      "mission times",
    );
    assert(
      source("src/features/program/mentor.ts").includes("activityAttempt.update"),
      "mentor writes AA payload",
    );
  });

  await suite("no live Submission.create outside progress-writes in product paths", () => {
    const root = join(process.cwd(), "src");
    const allowed = new Set([
      join(root, "repositories/progress-writes.ts"),
    ]);
    const re =
      /submission\.create\(|quizAttempt\.create\(|programMissionSubmission\.create\(/;
    for (const file of walk(root)) {
      if (allowed.has(file)) continue;
      if (file.includes(".test.ts")) continue;
      const rel = file.slice(root.length + 1);
      const text = readFileSync(file, "utf8");
      assert(!re.test(text), `${rel} still creates legacy directly`);
    }
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
