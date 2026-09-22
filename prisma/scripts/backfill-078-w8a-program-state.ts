/**
 * W8-A catch-up: copy ProgramMember score/unlock/skip/recommendation snapshots
 * onto pe_pm_ ProgramEnrollment. Insert-only on missing mapping is not done
 * here — missing PE is a mapping defect, fail instead of inventing rows.
 *
 * Idempotent. Never overwrites richer PE values with zeros unless PM is also 0.
 * Copies PM → PE only when the PE snapshot still looks unfilled relative to PM
 * (any score/unlock/skip/reco mismatch). Source-preserving: PE is set to PM
 * values, not recomputed.
 *
 * Child by default. Production: PHASE2_ALLOW_PRODUCTION=1.
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

async function main() {
  assertChildBranch();

  const missing = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT count(*)::bigint AS n
    FROM "ProgramMember" m
    WHERE NOT EXISTS (
      SELECT 1 FROM "ProgramEnrollment" pe WHERE pe.id = 'pe_pm_' || m.id
    )
  `;
  const missingN = Number(missing[0]?.n ?? 0);
  if (missingN > 0) {
    throw new Error(
      `W8-A backfill refused: ${missingN} ProgramMember rows lack pe_pm_ ProgramEnrollment`,
    );
  }

  const result = await prisma.$executeRaw`
    UPDATE "ProgramEnrollment" pe
    SET
      "missionPoints" = m."missionPoints",
      "conceptPoints" = m."conceptPoints",
      "commitPoints" = m."commitPoints",
      "projectPoints" = m."projectPoints",
      "totalScore" = m."totalScore",
      "cleanPassCount" = m."cleanPassCount",
      "aiRecommendation" = m."aiRecommendation",
      "aiRecommendationAt" = m."aiRecommendationAt",
      "unlockFloorDay" = m."highestUnlockedDay",
      "skipTokensUsed" = m."skipTokensUsed",
      "githubRepoUrl" = m."githubRepoUrl",
      "updatedAt" = NOW()
    FROM "ProgramMember" m
    WHERE pe.id = 'pe_pm_' || m.id
      AND (
        pe."missionPoints" IS DISTINCT FROM m."missionPoints"
        OR pe."conceptPoints" IS DISTINCT FROM m."conceptPoints"
        OR pe."commitPoints" IS DISTINCT FROM m."commitPoints"
        OR pe."projectPoints" IS DISTINCT FROM m."projectPoints"
        OR pe."totalScore" IS DISTINCT FROM m."totalScore"
        OR pe."cleanPassCount" IS DISTINCT FROM m."cleanPassCount"
        OR pe."aiRecommendation" IS DISTINCT FROM m."aiRecommendation"
        OR pe."aiRecommendationAt" IS DISTINCT FROM m."aiRecommendationAt"
        OR pe."unlockFloorDay" IS DISTINCT FROM m."highestUnlockedDay"
        OR pe."skipTokensUsed" IS DISTINCT FROM m."skipTokensUsed"
        OR pe."githubRepoUrl" IS DISTINCT FROM m."githubRepoUrl"
      )
  `;

  console.log(JSON.stringify({ updated: Number(result) }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
