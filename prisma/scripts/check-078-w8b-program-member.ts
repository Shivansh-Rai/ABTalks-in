/**
 * W8-B ProgramMember freeze recon (read-only).
 *
 * Blocking:
 *   duplicate PE membership = 0
 *   missing required PE membership = 0
 *   PE without required PM anchor = 0
 *   invalid PE status is not counted here (enum-enforced)
 *
 * Informational after freeze (mirror OFF):
 *   frozenProgramMemberStatusDrift
 *   frozenProgramMemberScoreDrift
 *   frozenProgramMemberUnlockDrift
 *   frozenProgramMemberRecommendationDrift
 *
 * Before freeze (mirror ON): score/pool/unlock mismatches still fail, same as W8-A.
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
import {
  isLegacyProgramMemberMirrorEnabled,
  isNewProgramStateEnabled,
  isNewProgramStateWritesEnabled,
} from "../../src/lib/feature-flags";
import { assertChildBranch } from "./migrate-078-shared";

const prisma = new PrismaClient();

async function main() {
  assertChildBranch();

  const mapping = await prisma.$queryRaw<
    Array<{
      members: bigint;
      users: bigint;
      cohorts: bigint;
      pe_pm: bigint;
      member_missing_pe: bigint;
      pe_missing_member: bigint;
      dup_tuples: bigint;
      test_members: bigint;
    }>
  >`
    SELECT
      (SELECT count(*)::bigint FROM "ProgramMember") AS members,
      (SELECT count(distinct "userId")::bigint FROM "ProgramMember") AS users,
      (SELECT count(distinct "cohortId")::bigint FROM "ProgramMember") AS cohorts,
      (SELECT count(*)::bigint FROM "ProgramEnrollment" WHERE id LIKE 'pe_pm_%') AS pe_pm,
      (SELECT count(*)::bigint FROM "ProgramMember" m
        WHERE NOT EXISTS (
          SELECT 1 FROM "ProgramEnrollment" pe WHERE pe.id = 'pe_pm_' || m.id
        )) AS member_missing_pe,
      (SELECT count(*)::bigint FROM "ProgramEnrollment" pe
        WHERE pe.id LIKE 'pe_pm_%'
          AND NOT EXISTS (
            SELECT 1 FROM "ProgramMember" m WHERE pe.id = 'pe_pm_' || m.id
          )) AS pe_missing_member,
      (SELECT count(*)::bigint FROM (
        SELECT "userId", "cohortId" FROM "ProgramMember" GROUP BY 1,2 HAVING count(*) > 1
      ) d) AS dup_tuples,
      (SELECT count(*)::bigint FROM "ProgramMember" m
        JOIN "User" u ON u.id = m."userId"
        WHERE u.email LIKE '%@abtalks.dev') AS test_members
  `;

  const scores = await prisma.$queryRaw<
    Array<{
      compared: bigint;
      score_equal: bigint;
      status_equal: bigint;
      unlock_equal: bigint;
      skip_equal: bigint;
      reco_equal: bigint;
    }>
  >`
    SELECT
      count(*)::bigint AS compared,
      count(*) FILTER (
        WHERE pe."totalScore" IS NOT DISTINCT FROM m."totalScore"
      )::bigint AS score_equal,
      count(*) FILTER (
        WHERE (
          (m.status::text = 'ENROLLED' AND pe.status::text = 'ACTIVE')
          OR (m.status::text = pe.status::text)
        )
      )::bigint AS status_equal,
      count(*) FILTER (
        WHERE pe."unlockFloorDay" IS NOT DISTINCT FROM m."highestUnlockedDay"
      )::bigint AS unlock_equal,
      count(*) FILTER (
        WHERE pe."skipTokensUsed" IS NOT DISTINCT FROM m."skipTokensUsed"
      )::bigint AS skip_equal,
      count(*) FILTER (
        WHERE pe."aiRecommendation" IS NOT DISTINCT FROM m."aiRecommendation"
      )::bigint AS reco_equal
    FROM "ProgramMember" m
    JOIN "ProgramEnrollment" pe ON pe.id = 'pe_pm_' || m.id
  `;

  const pool = await prisma.$queryRaw<
    Array<{
      pm_pool: bigint;
      pe_pool: bigint;
      pm_not_pe: bigint;
      pe_not_pm: bigint;
    }>
  >`
    SELECT
      (SELECT count(*)::bigint FROM "ProgramMember"
        WHERE status::text IN ('ENROLLED','COMPLETED')) AS pm_pool,
      (SELECT count(*)::bigint FROM "ProgramEnrollment"
        WHERE id LIKE 'pe_pm_%' AND status::text IN ('ACTIVE','COMPLETED')) AS pe_pool,
      (SELECT count(*)::bigint FROM "ProgramMember" m
        WHERE m.status::text IN ('ENROLLED','COMPLETED')
          AND NOT EXISTS (
            SELECT 1 FROM "ProgramEnrollment" pe
            WHERE pe.id = 'pe_pm_' || m.id
              AND pe.status::text IN ('ACTIVE','COMPLETED')
          )) AS pm_not_pe,
      (SELECT count(*)::bigint FROM "ProgramEnrollment" pe
        WHERE pe.id LIKE 'pe_pm_%' AND pe.status::text IN ('ACTIVE','COMPLETED')
          AND NOT EXISTS (
            SELECT 1 FROM "ProgramMember" m
            WHERE pe.id = 'pe_pm_' || m.id
              AND m.status::text IN ('ENROLLED','COMPLETED')
          )) AS pe_not_pm
  `;

  const deps = await prisma.$queryRaw<
    Array<{
      projects: bigint;
      interviews: bigint;
      general_interviews: bigint;
      shortlist: bigint;
    }>
  >`
    SELECT
      (SELECT count(*)::bigint FROM "ProgramProject") AS projects,
      (SELECT count(*)::bigint FROM "ProgramInterview") AS interviews,
      (SELECT count(*)::bigint FROM "GeneralInterview") AS general_interviews,
      (SELECT count(*)::bigint FROM "RecruiterShortlistItem") AS shortlist
  `;

  const map = mapping[0]!;
  const sc = scores[0]!;
  const pl = pool[0]!;
  const compared = Number(sc.compared);
  const unexplainedMembership =
    Number(map.member_missing_pe) +
    Number(map.pe_missing_member) +
    Number(map.dup_tuples);
  const frozenStatus = compared - Number(sc.status_equal);
  const frozenScore = compared - Number(sc.score_equal);
  const frozenUnlock = compared - Number(sc.unlock_equal);
  const frozenReco = compared - Number(sc.reco_equal);
  const mirrorOn = isLegacyProgramMemberMirrorEnabled();
  const unexplainedPool = Number(pl.pm_not_pe) + Number(pl.pe_not_pm);

  const report = {
    flags: {
      ENABLE_NEW_PROGRAM_STATE: isNewProgramStateEnabled(),
      ENABLE_NEW_PROGRAM_STATE_WRITES: isNewProgramStateWritesEnabled(),
      ENABLE_LEGACY_PROGRAM_MEMBER_MIRROR: mirrorOn,
      W8B_CUTOVER_TIME: process.env.W8B_CUTOVER_TIME ?? null,
    },
    mapping: {
      members: Number(map.members),
      users: Number(map.users),
      cohorts: Number(map.cohorts),
      pe_pm: Number(map.pe_pm),
      member_missing_pe: Number(map.member_missing_pe),
      pe_missing_member: Number(map.pe_missing_member),
      dup_tuples: Number(map.dup_tuples),
      test_members: Number(map.test_members),
    },
    pool: {
      pm_pool: Number(pl.pm_pool),
      pe_pool: Number(pl.pe_pool),
      pm_not_pe: Number(pl.pm_not_pe),
      pe_not_pm: Number(pl.pe_not_pm),
    },
    informational: {
      frozenProgramMemberStatusDrift: frozenStatus,
      frozenProgramMemberScoreDrift: frozenScore,
      frozenProgramMemberUnlockDrift: frozenUnlock,
      frozenProgramMemberRecommendationDrift: frozenReco,
    },
    dependencies: {
      projects: Number(deps[0]!.projects),
      interviews: Number(deps[0]!.interviews),
      general_interviews: Number(deps[0]!.general_interviews),
      shortlist: Number(deps[0]!.shortlist),
    },
    blocking: {
      unexplainedMembership,
      anchorsWithoutPe: Number(map.member_missing_pe),
      peWithoutRequiredAnchor: Number(map.pe_missing_member),
    },
  };

  console.log(JSON.stringify(report, null, 2));

  const blockingFail = unexplainedMembership !== 0;
  const preFreezeFail =
    mirrorOn &&
    (unexplainedPool !== 0 ||
      frozenScore !== 0 ||
      frozenUnlock !== 0 ||
      frozenStatus !== 0);
  if (blockingFail || preFreezeFail) {
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
