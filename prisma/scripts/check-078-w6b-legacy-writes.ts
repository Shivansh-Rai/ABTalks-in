/**
 * W6-B accidental legacy progress-write sentinel (read-only).
 *
 * After ENABLE_LEGACY_PROGRESS_MIRROR=false and W6B_CUTOVER_TIME:
 *   new Submission / QuizAttempt / ProgramMissionSubmission rows = 0.
 *
 * Source-path audit lives in progress-writes.test.ts.
 * Production: PHASE2_ALLOW_PRODUCTION=1 + direct host.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

if (process.env.DATABASE_URL?.includes("-pooler.")) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace("-pooler.", ".");
}

import { PrismaClient } from "@prisma/client";
import { isLegacyProgressMirrorEnabled } from "../../src/lib/feature-flags";
import { assertChildBranch } from "./migrate-078-shared";

const prisma = new PrismaClient();

function n(rows: Array<{ n: bigint | number }>): number {
  return Number(rows[0]?.n ?? 0);
}

async function main() {
  assertChildBranch();
  const raw = process.env.W6B_CUTOVER_TIME?.trim();
  const cutover = raw ? new Date(raw) : null;
  if (raw && Number.isNaN(cutover?.getTime())) {
    throw new Error(`W6B_CUTOVER_TIME is not a valid date: ${raw}`);
  }

  if (cutover && isLegacyProgressMirrorEnabled()) {
    throw new Error(
      "W6B_CUTOVER_TIME is set but ENABLE_LEGACY_PROGRESS_MIRROR is not false",
    );
  }

  const newSubmissions = cutover
    ? n(await prisma.$queryRaw<{ n: bigint }[]>`
        SELECT count(*)::bigint AS n FROM "Submission" WHERE "submittedAt" >= ${cutover}
      `)
    : 0;
  const newQuizzes = cutover
    ? n(await prisma.$queryRaw<{ n: bigint }[]>`
        SELECT count(*)::bigint AS n FROM "QuizAttempt" WHERE "attemptedAt" >= ${cutover}
      `)
    : 0;
  const newMissions = cutover
    ? n(await prisma.$queryRaw<{ n: bigint }[]>`
        SELECT count(*)::bigint AS n FROM "ProgramMissionSubmission" WHERE "createdAt" >= ${cutover}
      `)
    : 0;

  const report = {
    w6bCutoverTime: raw ?? null,
    legacyProgressMirror: isLegacyProgressMirrorEnabled() ? "on" : "off",
    newSubmissionsSinceCutover: newSubmissions,
    newQuizAttemptsSinceCutover: newQuizzes,
    newMissionSubmissionsSinceCutover: newMissions,
    note: "createdAt/submittedAt only. Source audit is progress-writes.test.ts.",
  };
  console.log(JSON.stringify(report, null, 2));

  if (cutover && (newSubmissions !== 0 || newQuizzes !== 0 || newMissions !== 0)) {
    throw new Error(
      `W6-B sentinel: new legacy rows since cutover sub=${newSubmissions} quiz=${newQuizzes} mission=${newMissions}`,
    );
  }
  console.log("W6-B legacy-write sentinel finished.");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
