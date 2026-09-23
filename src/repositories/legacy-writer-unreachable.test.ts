/**
 * Phase 8-D: frozen-family old-authority mutation branches must be unreachable
 * in normal runtime. Compliance wipes are explicitly whitelisted.
 *
 * Run: npm run test:078-legacy-writer-unreachable
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { SubmissionStatus } from "@prisma/client";
import { lockWalletBalance } from "@/repositories/points";
import { applyChallengeSubmissionChange } from "@/repositories/progress-writes";

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

function walkSrc(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walkSrc(full, acc);
    } else if (
      (name.endsWith(".ts") || name.endsWith(".tsx")) &&
      !name.endsWith(".test.ts") &&
      !name.endsWith(".test.tsx")
    ) {
      acc.push(full);
    }
  }
  return acc;
}

async function main() {
  console.log("\nPhase 8-D legacy writer unreachable\n");

  await suite("runtime ENABLE_DUAL_WRITE refs are only the unused helper", () => {
    const files = walkSrc(join(process.cwd(), "src"));
    const hits: string[] = [];
    for (const file of files) {
      const rel = file.slice(process.cwd().length + 1);
      if (rel === "src/lib/feature-flags.ts") continue;
      const text = readFileSync(file, "utf8");
      if (text.includes("isDualWriteEnabled(") || text.includes("ENABLE_DUAL_WRITE")) {
        // comments/docs in runtime files are allowed only if they do not call the helper
        if (text.includes("isDualWriteEnabled(")) {
          hits.push(`${rel}: isDualWriteEnabled(`);
        }
      }
    }
    assert(hits.length === 0, hits.join("; "));
    const flags = source("src/lib/feature-flags.ts");
    assert(!flags.includes("export function isDualWriteEnabled"), "helper removed");
  });

  await suite("production writers do not call runDualWrite / dualWrite*", () => {
    const files = walkSrc(join(process.cwd(), "src"));
    const allowed = new Set([
      join(process.cwd(), "src/repositories/dual-write.ts"),
    ]);
    const hits: string[] = [];
    for (const file of files) {
      if (allowed.has(file)) continue;
      const rel = file.slice(process.cwd().length + 1);
      const text = readFileSync(file, "utf8");
      if (text.includes("runDualWrite(")) hits.push(`${rel}: runDualWrite(`);
      if (/\bdualWrite[A-Z]\w*\(/.test(text)) hits.push(`${rel}: dualWrite* call`);
    }
    assert(hits.length === 0, hits.join("; "));
  });

  await suite("Points: applyLegacyAuthoritative unreachable", () => {
    const src = source("src/repositories/points.ts");
    assert(!src.includes("applyLegacyAuthoritative"), "deleted");
    assert(src.includes("applyNewAuthoritative"), "canonical writer");
    assert(!src.includes("writeLegacyWalletAndEvent"), "legacy wallet writer removed");
  });

  await suite("Credential: issueLegacyAuthoritative unreachable", () => {
    const src = source("src/repositories/credentials-write.ts");
    assert(!src.includes("issueLegacyAuthoritative"), "deleted");
    assert(src.includes("issueNewAuthoritative"), "canonical writer");
    assert(src.includes("findLegacyCertificate"), "historical Certificate catch-up retained");
  });

  await suite("Candidate: SP-first identity writer unreachable", () => {
    const src = source("src/repositories/candidate-identity.ts");
    assert(!src.includes("dualWriteCandidateIdentity"), "no DW helper");
    assert(!src.includes("if (!true)"), "no writes-OFF branch");
    assert(src.includes("isCandidateWritesAuthoritative"), "always true");
  });

  await suite("Ambassador: SP-first writer unreachable; wipe retained", () => {
    const src = source("src/repositories/ambassador.ts");
    assert(!src.includes("if (!true)"), "no writes-OFF branch");
    assert(src.includes('input.kind === "wipe"'), "compliance wipe");
    assert(src.includes("canonical CampusAmbassadorApplication wiped"), "wipe log");
  });

  await suite("Progress: legacy-first writers unreachable; QuizAttempt answers read retained", () => {
    const writes = source("src/repositories/progress-writes.ts");
    assert(!writes.includes("dualWriteSubmissionAttempt"), "no DW submit");
    assert(!writes.includes("dualWriteQuizAttempt"), "no DW quiz");
    assert(!writes.includes("dualWriteMissionAttempt"), "no DW mission");
    assert(!writes.includes("isNewProgressWritesEnabled"), "write flag unused");
    const reads = source("src/repositories/progress.ts");
    assert(reads.includes("historicalQuizAttempt.findUnique"), "historical answers archive");
    assert(reads.includes("answersFromPayload"), "canonical answers first");
    assert(!reads.includes("isNewProgressRepoEnabled"), "no frozen-progress current-state flag");
  });

  await suite("Enrollment denorm: displayedChallengeDomain ignores frozen SP.domain", () => {
    const src = source("src/repositories/enrollment-state.ts");
    assert(!src.includes("isNewEnrollmentStateEnabled"), "read flag unused in overlay");
    assert(src.includes("getPrimaryChallengeDomain"), "canonical domain");
    assert(src.includes("applyChallengeProgramEnrollment"), "pe_enr writer retained");
  });

  await suite("Program: PM-first dualWriteProgramMember unreachable; anchor+scrub retained", () => {
    const src = source("src/repositories/program-state.ts");
    assert(!src.includes("dualWriteProgramMember"), "no DW helper");
    assert(!src.includes("isNewProgramStateWritesEnabled"), "write flag unused");
    assert(!src.includes("ensureProgramMemberAnchor"), "no PM structural anchor");
    assert(src.includes("scrubProgramMemberLegacyPii"), "compliance PII");
  });

  await suite("writeClient remains direct-only", () => {
    const src = source("src/lib/db.ts");
    assert(src.includes("export function writeClient"), "exported");
    const start = src.indexOf("export function writeClient");
    const body = src.slice(start, start + 80);
    assert(body.includes("return directClient()"), "always direct");
    assert(!src.includes("isDualWriteEnabled"), "no DW import");
  });

  await suite("ENABLE_NEW_POINTS_WRITES=false still locks PointsAccount", async () => {
    const prev = process.env.ENABLE_NEW_POINTS_WRITES;
    process.env.ENABLE_NEW_POINTS_WRITES = "false";
    const tx = {
      pointsAccount: {
        findUnique: async () => null,
        update: async () => ({ balance: 7 }),
      },
      user: {
        update: async () => {
          throw new Error("User.synergyPoints must not be locked");
        },
      },
    };
    const result = await lockWalletBalance(tx as never, "u1");
    if (prev === undefined) delete process.env.ENABLE_NEW_POINTS_WRITES;
    else process.env.ENABLE_NEW_POINTS_WRITES = prev;
    assert(result === 0, `expected 0, got ${result}`);
  });

  await suite("ENABLE_NEW_PROGRESS_WRITES=false still upserts ActivityAttempt", async () => {
    const prev = process.env.ENABLE_NEW_PROGRESS_WRITES;
    process.env.ENABLE_NEW_PROGRESS_WRITES = "false";
    process.env.ENABLE_LEGACY_PROGRESS_MIRROR = "false";
    const writes: string[] = [];
    const tx = {
      $executeRawUnsafe: async () => 0,
      activityAttempt: {
        upsert: async ({ where }: { where: { id: string } }) => {
          writes.push(`aa:${where.id}`);
          return { id: where.id };
        },
        findUnique: async () => null,
      },
      activityEvaluation: {
        upsert: async () => ({}),
      },
      submission: {
        create: async () => {
          throw new Error("Submission must not be authoritative");
        },
      },
    };
    await applyChallengeSubmissionChange(tx as never, {
      id: "sub_flag_off",
      userId: "u1",
      enrollmentId: "enr1",
      dailyTaskId: "dt1",
      dayNumber: 1,
      githubUrl: null,
      linkedinUrl: null,
      status: SubmissionStatus.ON_TIME,
      submittedAt: new Date("2026-09-22T00:00:00Z"),
      pointsAwarded: 0,
      mode: "create",
    });
    if (prev === undefined) delete process.env.ENABLE_NEW_PROGRESS_WRITES;
    else process.env.ENABLE_NEW_PROGRESS_WRITES = prev;
    delete process.env.ENABLE_LEGACY_PROGRESS_MIRROR;
    assert(writes[0] === "aa:aa_sub_sub_flag_off", `canonical first ${writes[0]}`);
  });

  await suite("compliance exceptions remain in anonymizeUser", () => {
    const anon = source("src/features/admin/anonymize-user.ts");
    assert(anon.includes("applyAmbassadorChange"), "ambassador wipe");
    assert(anon.includes('{ kind: "wipe"'), "wipe kind");
    assert(anon.includes("scrubProgramMemberLegacyPii"), "PM PII");
    assert(anon.includes("historicalStudentProfile"), "historical SP snapshot scrub");
    assert(anon.includes("candidateProfile.updateMany"), "CP wipe");
    assert(anon.includes("applyVisibilityChange"), "CV wipe");
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main();
