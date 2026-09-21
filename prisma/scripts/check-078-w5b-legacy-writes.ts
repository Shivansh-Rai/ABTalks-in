/**
 * W5-B accidental StudentProfile-ambassador-write sentinel (read-only).
 *
 * StudentProfile.updatedAt is insufficient: domain and other later families
 * still write the same table. This script:
 *  1. Requires ENABLE_LEGACY_AMBASSADOR_MIRROR=false when cutover is set.
 *  2. Reports frozen CAA vs SP ambassador drift (expected to grow after freeze).
 *  3. Fails on duplicate canonical rows, missing User, or candidate-without-appliedAt.
 *
 * Source-path audit lives in src/repositories/ambassador.test.ts.
 * Production: PHASE2_ALLOW_PRODUCTION=1 + direct host.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

if (process.env.DATABASE_URL?.includes("-pooler.")) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace("-pooler.", ".");
}

import { PrismaClient } from "@prisma/client";
import { isLegacyAmbassadorMirrorEnabled } from "../../src/lib/feature-flags";
import { assertChildBranch } from "./migrate-078-shared";

const prisma = new PrismaClient();

function n(rows: Array<{ n: bigint | number }>): number {
  return Number(rows[0]?.n ?? 0);
}

async function main() {
  assertChildBranch();
  const raw = process.env.W5B_CUTOVER_TIME?.trim();
  const cutover = raw ? new Date(raw) : null;
  if (raw && Number.isNaN(cutover?.getTime())) {
    throw new Error(`W5B_CUTOVER_TIME is not a valid date: ${raw}`);
  }

  if (cutover && isLegacyAmbassadorMirrorEnabled()) {
    throw new Error(
      "W5B_CUTOVER_TIME is set but ENABLE_LEGACY_AMBASSADOR_MIRROR is not false",
    );
  }

  const canonicalCount = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n FROM "CampusAmbassadorApplication"
  `);
  const canonicalCandidates = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
    FROM "CampusAmbassadorApplication"
    WHERE "isCandidate" = true
  `);
  const canonicalDismissed = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
    FROM "CampusAmbassadorApplication"
    WHERE "dismissedAt" IS NOT NULL
  `);

  const duplicates = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
    FROM (
      SELECT "userId"
      FROM "CampusAmbassadorApplication"
      GROUP BY "userId"
      HAVING COUNT(*) > 1
    ) d
  `);
  const canonicalWithoutUser = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
    FROM "CampusAmbassadorApplication" caa
    LEFT JOIN "User" u ON u.id = caa."userId"
    WHERE u.id IS NULL
  `);
  const invalidCanonical = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
    FROM "CampusAmbassadorApplication"
    WHERE "isCandidate" = true AND "appliedAt" IS NULL
  `);

  const frozenAmbassadorCandidateDrift = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
    FROM "CampusAmbassadorApplication" caa
    JOIN "StudentProfile" sp ON sp."userId" = caa."userId"
    WHERE caa."isCandidate" IS DISTINCT FROM sp."isCampusAmbassadorCandidate"
  `);
  const frozenAmbassadorAppliedAtDrift = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
    FROM "CampusAmbassadorApplication" caa
    JOIN "StudentProfile" sp ON sp."userId" = caa."userId"
    WHERE caa."appliedAt" IS DISTINCT FROM sp."ambassadorAppliedAt"
  `);
  const frozenAmbassadorDismissedAtDrift = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
    FROM "CampusAmbassadorApplication" caa
    JOIN "StudentProfile" sp ON sp."userId" = caa."userId"
    WHERE caa."dismissedAt" IS DISTINCT FROM sp."ambassadorDismissedAt"
  `);

  const report = {
    w5bCutoverTime: raw ?? null,
    legacyAmbassadorMirror: isLegacyAmbassadorMirrorEnabled() ? "on" : "off",
    canonicalCount,
    canonicalCandidates,
    canonicalDismissed,
    duplicates,
    canonicalWithoutUser,
    invalidCanonical,
    frozenAmbassadorCandidateDrift,
    frozenAmbassadorAppliedAtDrift,
    frozenAmbassadorDismissedAtDrift,
    note: "CAA ≠ SP ambassador drift is expected after W5-B. Do not remirror.",
  };
  console.log(JSON.stringify(report, null, 2));

  if (duplicates !== 0 || canonicalWithoutUser !== 0 || invalidCanonical !== 0) {
    throw new Error(
      `W5-B: blocking canonical checks failed (dupes=${duplicates} noUser=${canonicalWithoutUser} invalid=${invalidCanonical})`,
    );
  }
  console.log("W5-B sentinel finished (frozen ambassador drift is informational).");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
