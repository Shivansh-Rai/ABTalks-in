/**
 * W7-A additive backfill: Enrollment streak snapshots →
 * ProgramEnrollment.trackCurrentStreak / trackLongestStreak.
 *
 * Copies stored values exactly. Does not recompute from ActivityAttempt.
 * Idempotent: only updates rows that still differ.
 *
 * Child by default. Production: PHASE2_ALLOW_PRODUCTION=1 + direct host.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

if (process.env.DATABASE_URL?.includes("-pooler.")) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace("-pooler.", ".");
}

import { PrismaClient } from "@prisma/client";
import { assertChildBranch } from "./migrate-078-shared";

const prisma = new PrismaClient();

function n(rows: Array<{ n: bigint | number }>): number {
  return Number(rows[0]?.n ?? 0);
}

async function main() {
  assertChildBranch();

  const before = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*)::bigint AS n
    FROM "Enrollment" e
    JOIN "ProgramEnrollment" pe ON pe.id = 'pe_enr_' || e.id
    WHERE pe."trackCurrentStreak" IS DISTINCT FROM e."currentStreak"
       OR pe."trackLongestStreak" IS DISTINCT FROM e."longestStreak"
  `);

  const updated = await prisma.$executeRaw`
    UPDATE "ProgramEnrollment" pe
    SET
      "trackCurrentStreak" = e."currentStreak",
      "trackLongestStreak" = e."longestStreak",
      "updatedAt" = NOW()
    FROM "Enrollment" e
    WHERE pe.id = 'pe_enr_' || e.id
      AND (
        pe."trackCurrentStreak" IS DISTINCT FROM e."currentStreak"
        OR pe."trackLongestStreak" IS DISTINCT FROM e."longestStreak"
      )
  `;

  const after = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*)::bigint AS n
    FROM "Enrollment" e
    JOIN "ProgramEnrollment" pe ON pe.id = 'pe_enr_' || e.id
    WHERE pe."trackCurrentStreak" IS DISTINCT FROM e."currentStreak"
       OR pe."trackLongestStreak" IS DISTINCT FROM e."longestStreak"
  `);

  console.log(
    JSON.stringify(
      {
        mismatchedBefore: before,
        rowsUpdated: Number(updated),
        mismatchedAfter: after,
      },
      null,
      2,
    ),
  );

  if (after !== 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
