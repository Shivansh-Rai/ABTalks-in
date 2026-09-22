/**
 * W8-A ProgramMember recon (read-only).
 *
 * Membership: ProgramMember ↔ pe_pm_ ProgramEnrollment.
 * Scores/unlock/skip/recommendation: PM vs PE snapshot columns.
 * Talent pool: ENROLLED/COMPLETED members vs PE ACTIVE/COMPLETED pe_pm_.
 * Skills: PM.skills populated vs CandidateSkill (informational, different concept).
 * Projects: ProgramProject count (canonical relation, not PM scalar).
 * Interviews: ProgramInterview / GeneralInterview counts (canonical models).
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

function n(rows: Array<{ n: bigint | number }>): number {
  return Number(rows[0]?.n ?? 0);
}

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
      mission_equal: bigint;
      concept_equal: bigint;
      commit_equal: bigint;
      project_equal: bigint;
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
        WHERE pe."missionPoints" IS NOT DISTINCT FROM m."missionPoints"
      )::bigint AS mission_equal,
      count(*) FILTER (
        WHERE pe."conceptPoints" IS NOT DISTINCT FROM m."conceptPoints"
      )::bigint AS concept_equal,
      count(*) FILTER (
        WHERE pe."commitPoints" IS NOT DISTINCT FROM m."commitPoints"
      )::bigint AS commit_equal,
      count(*) FILTER (
        WHERE pe."projectPoints" IS NOT DISTINCT FROM m."projectPoints"
      )::bigint AS project_equal,
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

  const pops = await prisma.$queryRaw<
    Array<{
      with_skills: bigint;
      candidate_skills: bigint;
      projects: bigint;
      interviews: bigint;
      general_interviews: bigint;
      with_score: bigint;
      with_concept: bigint;
      with_reco: bigint;
    }>
  >`
    SELECT
      (SELECT count(*)::bigint FROM "ProgramMember" WHERE cardinality(skills) > 0) AS with_skills,
      (SELECT count(*)::bigint FROM "CandidateSkill") AS candidate_skills,
      (SELECT count(*)::bigint FROM "ProgramProject") AS projects,
      (SELECT count(*)::bigint FROM "ProgramInterview") AS interviews,
      (SELECT count(*)::bigint FROM "GeneralInterview") AS general_interviews,
      (SELECT count(*)::bigint FROM "ProgramMember" WHERE "totalScore" > 0) AS with_score,
      (SELECT count(*)::bigint FROM "ProgramMember" WHERE "conceptPoints" > 0) AS with_concept,
      (SELECT count(*)::bigint FROM "ProgramMember" WHERE "aiRecommendation" IS NOT NULL) AS with_reco
  `;

  const map = mapping[0]!;
  const sc = scores[0]!;
  const pl = pool[0]!;
  const unexplainedMembership =
    Number(map.member_missing_pe) + Number(map.pe_missing_member) + Number(map.dup_tuples);
  const unexplainedPool = Number(pl.pm_not_pe) + Number(pl.pe_not_pm);
  const unexplainedScore =
    Number(sc.compared) - Number(sc.score_equal);
  const unexplainedUnlock = Number(sc.compared) - Number(sc.unlock_equal);
  const unexplainedSkip = Number(sc.compared) - Number(sc.skip_equal);

  const report = {
    flags: {
      ENABLE_NEW_PROGRAM_STATE: isNewProgramStateEnabled(),
      ENABLE_NEW_PROGRAM_STATE_WRITES: isNewProgramStateWritesEnabled(),
      ENABLE_LEGACY_PROGRAM_MEMBER_MIRROR: isLegacyProgramMemberMirrorEnabled(),
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
    scores: {
      compared: Number(sc.compared),
      score_equal: Number(sc.score_equal),
      mission_equal: Number(sc.mission_equal),
      concept_equal: Number(sc.concept_equal),
      commit_equal: Number(sc.commit_equal),
      project_equal: Number(sc.project_equal),
      unlock_equal: Number(sc.unlock_equal),
      skip_equal: Number(sc.skip_equal),
      reco_equal: Number(sc.reco_equal),
    },
    pool: {
      pm_pool: Number(pl.pm_pool),
      pe_pool: Number(pl.pe_pool),
      pm_not_pe: Number(pl.pm_not_pe),
      pe_not_pm: Number(pl.pe_not_pm),
    },
    populations: {
      with_skills: Number(pops[0]!.with_skills),
      candidate_skills: Number(pops[0]!.candidate_skills),
      projects: Number(pops[0]!.projects),
      interviews: Number(pops[0]!.interviews),
      general_interviews: Number(pops[0]!.general_interviews),
      with_score: Number(pops[0]!.with_score),
      with_concept: Number(pops[0]!.with_concept),
      with_reco: Number(pops[0]!.with_reco),
    },
    unexplained: {
      membership: unexplainedMembership,
      pool: unexplainedPool,
      score: unexplainedScore,
      unlock: unexplainedUnlock,
      skip: unexplainedSkip,
    },
  };

  console.log(JSON.stringify(report, null, 2));
  if (
    unexplainedMembership !== 0 ||
    unexplainedPool !== 0 ||
    unexplainedScore !== 0 ||
    unexplainedUnlock !== 0 ||
    unexplainedSkip !== 0
  ) {
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
