/**
 * W5-A ambassador reconciliation (read-only).
 *
 * Compares StudentProfile ambassador columns with CampusAmbassadorApplication.
 * Does not mutate. Does not enable write flags.
 * Child by default. Production: PHASE2_ALLOW_PRODUCTION=1 + direct host.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

if (process.env.DATABASE_URL?.includes("-pooler.")) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace("-pooler.", ".");
}

import { PrismaClient } from "@prisma/client";
import {
  isLegacyAmbassadorMirrorEnabled,
  isNewAmbassadorWritesEnabled,
} from "../../src/lib/feature-flags";
import { assertChildBranch } from "./migrate-078-shared";

const prisma = new PrismaClient();

function n(rows: Array<{ n: bigint | number }>): number {
  return Number(rows[0]?.n ?? 0);
}

async function main() {
  assertChildBranch();

  const studentProfileCount = n(
    await prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint AS n FROM "StudentProfile"`,
  );
  const canonicalCount = n(
    await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n FROM "CampusAmbassadorApplication"
    `,
  );

  const spState = await prisma.$queryRaw<
    Array<{
      candidate_true: bigint;
      candidate_false: bigint;
      applied_set: bigint;
      dismissed_set: bigint;
      candidate_missing_applied: bigint;
      applied_not_candidate: bigint;
      dismissed_not_candidate: bigint;
      candidate_and_dismissed: bigint;
      any_state: bigint;
    }>
  >`
    SELECT
      COUNT(*) FILTER (WHERE "isCampusAmbassadorCandidate" = true)::bigint AS candidate_true,
      COUNT(*) FILTER (WHERE "isCampusAmbassadorCandidate" = false)::bigint AS candidate_false,
      COUNT(*) FILTER (WHERE "ambassadorAppliedAt" IS NOT NULL)::bigint AS applied_set,
      COUNT(*) FILTER (WHERE "ambassadorDismissedAt" IS NOT NULL)::bigint AS dismissed_set,
      COUNT(*) FILTER (WHERE "isCampusAmbassadorCandidate" = true AND "ambassadorAppliedAt" IS NULL)::bigint AS candidate_missing_applied,
      COUNT(*) FILTER (WHERE "isCampusAmbassadorCandidate" = false AND "ambassadorAppliedAt" IS NOT NULL)::bigint AS applied_not_candidate,
      COUNT(*) FILTER (WHERE "isCampusAmbassadorCandidate" = false AND "ambassadorDismissedAt" IS NOT NULL)::bigint AS dismissed_not_candidate,
      COUNT(*) FILTER (WHERE "isCampusAmbassadorCandidate" = true AND "ambassadorDismissedAt" IS NOT NULL)::bigint AS candidate_and_dismissed,
      COUNT(*) FILTER (
        WHERE "isCampusAmbassadorCandidate" = true
           OR "ambassadorAppliedAt" IS NOT NULL
           OR "ambassadorDismissedAt" IS NOT NULL
      )::bigint AS any_state
    FROM "StudentProfile"
  `;

  const legacyMissingCanonical = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
    FROM "StudentProfile" sp
    LEFT JOIN "CampusAmbassadorApplication" caa ON caa."userId" = sp."userId"
    WHERE caa.id IS NULL
      AND (
        sp."isCampusAmbassadorCandidate" = true
        OR sp."ambassadorAppliedAt" IS NOT NULL
        OR sp."ambassadorDismissedAt" IS NOT NULL
      )
  `);

  const mismatch = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
    FROM "CampusAmbassadorApplication" caa
    JOIN "StudentProfile" sp ON sp."userId" = caa."userId"
    WHERE caa."isCandidate" IS DISTINCT FROM sp."isCampusAmbassadorCandidate"
       OR caa."appliedAt" IS DISTINCT FROM sp."ambassadorAppliedAt"
       OR caa."dismissedAt" IS DISTINCT FROM sp."ambassadorDismissedAt"
  `);

  const canonicalWithoutSp = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
    FROM "CampusAmbassadorApplication" caa
    LEFT JOIN "StudentProfile" sp ON sp."userId" = caa."userId"
    WHERE sp.id IS NULL
  `);

  const canonicalWithoutUser = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
    FROM "CampusAmbassadorApplication" caa
    LEFT JOIN "User" u ON u.id = caa."userId"
    WHERE u.id IS NULL
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

  const ambassadorNoCandidateProfile = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
    FROM "StudentProfile" sp
    LEFT JOIN "CandidateProfile" cp ON cp."userId" = sp."userId"
    WHERE cp.id IS NULL
      AND (
        sp."isCampusAmbassadorCandidate" = true
        OR sp."ambassadorAppliedAt" IS NOT NULL
        OR sp."ambassadorDismissedAt" IS NOT NULL
      )
  `);

  const report = {
    flags: {
      ENABLE_NEW_AMBASSADOR_WRITES: isNewAmbassadorWritesEnabled(),
      ENABLE_LEGACY_AMBASSADOR_MIRROR: isLegacyAmbassadorMirrorEnabled(),
    },
    studentProfileCount,
    canonicalCount,
    studentProfile: {
      candidateTrue: Number(spState[0]?.candidate_true ?? 0),
      candidateFalse: Number(spState[0]?.candidate_false ?? 0),
      appliedSet: Number(spState[0]?.applied_set ?? 0),
      dismissedSet: Number(spState[0]?.dismissed_set ?? 0),
      candidateMissingApplied: Number(spState[0]?.candidate_missing_applied ?? 0),
      appliedNotCandidate: Number(spState[0]?.applied_not_candidate ?? 0),
      dismissedNotCandidate: Number(spState[0]?.dismissed_not_candidate ?? 0),
      candidateAndDismissed: Number(spState[0]?.candidate_and_dismissed ?? 0),
      anyState: Number(spState[0]?.any_state ?? 0),
    },
    recon: {
      legacyMissingCanonical,
      canonicalVsSpMismatch: mismatch,
      canonicalWithoutSp,
      canonicalWithoutUser,
      duplicates,
      ambassadorNoCandidateProfile,
    },
  };

  console.log(JSON.stringify(report, null, 2));

  if (canonicalWithoutUser !== 0 || duplicates !== 0) {
    throw new Error(
      `W5 ambassador recon blocking: noUser=${canonicalWithoutUser} dupes=${duplicates}`,
    );
  }

  const invalidCanonical = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
    FROM "CampusAmbassadorApplication"
    WHERE "isCandidate" = true AND "appliedAt" IS NULL
  `);
  if (invalidCanonical !== 0) {
    throw new Error(`W5 ambassador recon invalid canonical states=${invalidCanonical}`);
  }

  if (isLegacyAmbassadorMirrorEnabled()) {
    const unexplained = legacyMissingCanonical + mismatch;
    if (unexplained !== 0) {
      throw new Error(
        `W5-A ambassador recon unexplained drift = ${unexplained} (missing=${legacyMissingCanonical} mismatch=${mismatch})`,
      );
    }
  } else {
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
    console.log(
      JSON.stringify(
        {
          frozenAmbassadorCandidateDrift,
          frozenAmbassadorAppliedAtDrift,
          frozenAmbassadorDismissedAtDrift,
          note: "CP/CAA ≠ SP ambassador drift is expected after W5-B. Do not remirror.",
        },
        null,
        2,
      ),
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
