/**
 * W1-A / W1-B Points recon gate (read-only).
 *
 * Child by default. Production: PHASE2_ALLOW_PRODUCTION=1 + direct host.
 * Does not mutate. Does not enable ENABLE_NEW_POINTS_WRITES.
 *
 * Mirror ON (ENABLE_LEGACY_POINTS_MIRROR !== "false"):
 *   PointsAccount.balance == User.synergyPoints
 *   SUM(PointsTransaction) == PointsAccount.balance
 *
 * Mirror OFF (ENABLE_LEGACY_POINTS_MIRROR=false):
 *   gate is only SUM(PointsTransaction) == PointsAccount.balance
 *   User/SP/SynergyEvent diffs are informational.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { PrismaClient } from "@prisma/client";
import { isLegacyPointsMirrorEnabled } from "../../src/lib/feature-flags";
import { assertChildBranch } from "./migrate-078-shared";

const prisma = new PrismaClient();

async function main() {
  assertChildBranch();
  const mirrorOn = isLegacyPointsMirrorEnabled();

  const pointsVsUser = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
      FROM "PointsAccount" pa
      JOIN "User" u ON u.id = pa."userId"
     WHERE pa.balance <> u."synergyPoints"
  `;
  const pointsVsProfile = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
      FROM "PointsAccount" pa
      JOIN "StudentProfile" sp ON sp."userId" = pa."userId"
     WHERE pa.balance <> sp."synergyPoints"
  `;
  const ledgerVsAccount = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n FROM (
      SELECT pa."userId"
        FROM "PointsAccount" pa
        LEFT JOIN "PointsTransaction" pt ON pt."userId" = pa."userId"
       GROUP BY pa."userId", pa.balance
      HAVING pa.balance <> COALESCE(SUM(pt.amount), 0)
    ) q
  `;
  const missingAccount = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
      FROM "User" u
     WHERE u."synergyPoints" <> 0
       AND NOT EXISTS (
         SELECT 1 FROM "PointsAccount" pa WHERE pa."userId" = u.id)
  `;
  const phase2Recon = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
      FROM "PointsTransaction"
     WHERE "idempotencyKey" LIKE 'reconciliation:phase2:%'
  `;
  const synergyCount = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n FROM "SynergyEvent"
  `;
  const pointsTxCount = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
      FROM "PointsTransaction"
     WHERE "idempotencyKey" NOT LIKE 'reconciliation:phase2:%'
  `;

  const report = {
    legacyPointsMirror: mirrorOn ? "on" : "off",
    pointsAccountVsUserSynergy: Number(pointsVsUser[0]?.n ?? 0),
    pointsLedgerVsAccount: Number(ledgerVsAccount[0]?.n ?? 0),
    nonzeroWalletsMissingPointsAccount: Number(missingAccount[0]?.n ?? 0),
    phase2ReconRows: Number(phase2Recon[0]?.n ?? 0),
    legacyUserMirrorDrift: Number(pointsVsUser[0]?.n ?? 0),
    legacyStudentProfileMirrorDrift: Number(pointsVsProfile[0]?.n ?? 0),
    legacySynergyEventDelta:
      Number(synergyCount[0]?.n ?? 0) - Number(pointsTxCount[0]?.n ?? 0),
  };
  console.log(JSON.stringify(report, null, 2));

  const failures: string[] = [];
  if (mirrorOn && report.pointsAccountVsUserSynergy !== 0) {
    failures.push("pointsAccountVsUserSynergy");
  }
  if (report.pointsLedgerVsAccount !== 0) {
    failures.push("pointsLedgerVsAccount");
  }
  if (report.nonzeroWalletsMissingPointsAccount !== 0) {
    failures.push("nonzeroWalletsMissingPointsAccount");
  }
  if (failures.length > 0) {
    throw new Error(`Points recon failed: ${failures.join(", ")}`);
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
