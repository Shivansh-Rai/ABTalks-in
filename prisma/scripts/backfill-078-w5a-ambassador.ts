/**
 * W5-A historical backfill: StudentProfile ambassador columns →
 * CampusAmbassadorApplication.
 *
 * Idempotent insert-only (ON CONFLICT DO NOTHING). Does not overwrite a
 * canonical row that already exists. Maps only known SP fields — does not
 * invent approved/active/completed.
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
    SELECT COUNT(*)::bigint AS n FROM "CampusAmbassadorApplication"
  `);

  await prisma.$executeRaw`
    INSERT INTO "CampusAmbassadorApplication" (
      "id",
      "userId",
      "isCandidate",
      "appliedAt",
      "dismissedAt",
      "createdAt",
      "updatedAt"
    )
    SELECT
      'caa_' || sp."userId",
      sp."userId",
      sp."isCampusAmbassadorCandidate",
      sp."ambassadorAppliedAt",
      sp."ambassadorDismissedAt",
      NOW(),
      NOW()
    FROM "StudentProfile" sp
    WHERE sp."isCampusAmbassadorCandidate" = true
       OR sp."ambassadorAppliedAt" IS NOT NULL
       OR sp."ambassadorDismissedAt" IS NOT NULL
    ON CONFLICT ("userId") DO NOTHING
  `;

  const after = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n FROM "CampusAmbassadorApplication"
  `);
  const candidates = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
    FROM "CampusAmbassadorApplication"
    WHERE "isCandidate" = true
  `);
  const dismissedOnly = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
    FROM "CampusAmbassadorApplication"
    WHERE "isCandidate" = false AND "dismissedAt" IS NOT NULL
  `);

  console.log(
    JSON.stringify(
      {
        before,
        after,
        inserted: after - before,
        candidates,
        dismissedOnly,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
