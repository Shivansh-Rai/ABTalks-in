/**
 * Wave 2 additive programEnrollmentId / candidateUserId audit + backfill.
 * Child-only unless PHASE2_ALLOW_PRODUCTION=1 and host is nameless-term.
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

function n(v: bigint | number | undefined): number {
  return Number(v ?? 0);
}

async function counts() {
  const rows = await prisma.$queryRaw<
    Array<{
      members: bigint;
      pe_pm: bigint;
      pm_missing_pe: bigint;
      commit_days: bigint;
      commit_missing: bigint;
      commit_orphan_pe: bigint;
      interviews: bigint;
      interview_missing: bigint;
      general: bigint;
      general_missing: bigint;
      concept: bigint;
      concept_missing: bigint;
      exercise: bigint;
      exercise_missing: bigint;
      projects: bigint;
      project_missing: bigint;
      pms: bigint;
      pms_missing: bigint;
      shortlist: bigint;
      shortlist_missing_user: bigint;
    }>
  >`
    SELECT
      (SELECT count(*)::bigint FROM "ProgramMember") AS members,
      (SELECT count(*)::bigint FROM "ProgramEnrollment" WHERE id LIKE 'pe_pm_%') AS pe_pm,
      (SELECT count(*)::bigint FROM "ProgramMember" m
        WHERE NOT EXISTS (
          SELECT 1 FROM "ProgramEnrollment" pe WHERE pe.id = 'pe_pm_' || m.id
        )) AS pm_missing_pe,
      (SELECT count(*)::bigint FROM "ProgramCommitDay") AS commit_days,
      (SELECT count(*)::bigint FROM "ProgramCommitDay"
        WHERE "programEnrollmentId" IS NULL) AS commit_missing,
      (SELECT count(*)::bigint FROM "ProgramCommitDay" d
        WHERE d."programEnrollmentId" IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM "ProgramEnrollment" pe WHERE pe.id = d."programEnrollmentId"
          )) AS commit_orphan_pe,
      (SELECT count(*)::bigint FROM "ProgramInterview") AS interviews,
      (SELECT count(*)::bigint FROM "ProgramInterview"
        WHERE "programEnrollmentId" IS NULL) AS interview_missing,
      (SELECT count(*)::bigint FROM "GeneralInterview") AS general,
      (SELECT count(*)::bigint FROM "GeneralInterview"
        WHERE "programEnrollmentId" IS NULL) AS general_missing,
      (SELECT count(*)::bigint FROM "ProgramConceptAttempt") AS concept,
      (SELECT count(*)::bigint FROM "ProgramConceptAttempt"
        WHERE "programEnrollmentId" IS NULL) AS concept_missing,
      (SELECT count(*)::bigint FROM "ProgramExerciseCompletion") AS exercise,
      (SELECT count(*)::bigint FROM "ProgramExerciseCompletion"
        WHERE "programEnrollmentId" IS NULL) AS exercise_missing,
      (SELECT count(*)::bigint FROM "ProgramProject") AS projects,
      (SELECT count(*)::bigint FROM "ProgramProject"
        WHERE "programEnrollmentId" IS NULL) AS project_missing,
      (SELECT count(*)::bigint FROM "ProgramMissionSubmission") AS pms,
      (SELECT count(*)::bigint FROM "ProgramMissionSubmission"
        WHERE "programEnrollmentId" IS NULL) AS pms_missing,
      (SELECT count(*)::bigint FROM "RecruiterShortlistItem") AS shortlist,
      (SELECT count(*)::bigint FROM "RecruiterShortlistItem"
        WHERE "candidateUserId" IS NULL) AS shortlist_missing_user
  `;
  const r = rows[0];
  return {
    members: n(r.members),
    pe_pm: n(r.pe_pm),
    pm_missing_pe: n(r.pm_missing_pe),
    commit_days: n(r.commit_days),
    commit_missing: n(r.commit_missing),
    commit_orphan_pe: n(r.commit_orphan_pe),
    interviews: n(r.interviews),
    interview_missing: n(r.interview_missing),
    general: n(r.general),
    general_missing: n(r.general_missing),
    concept: n(r.concept),
    concept_missing: n(r.concept_missing),
    exercise: n(r.exercise),
    exercise_missing: n(r.exercise_missing),
    projects: n(r.projects),
    project_missing: n(r.project_missing),
    pms: n(r.pms),
    pms_missing: n(r.pms_missing),
    shortlist: n(r.shortlist),
    shortlist_missing_user: n(r.shortlist_missing_user),
  };
}

async function backfill() {
  await prisma.$executeRawUnsafe(`
    UPDATE "ProgramCommitDay"
    SET "programEnrollmentId" = 'pe_pm_' || "memberId"
    WHERE "programEnrollmentId" IS NULL
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "ProgramInterview"
    SET "programEnrollmentId" = 'pe_pm_' || "memberId"
    WHERE "programEnrollmentId" IS NULL
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "GeneralInterview"
    SET "programEnrollmentId" = 'pe_pm_' || "memberId"
    WHERE "programEnrollmentId" IS NULL
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "ProgramConceptAttempt"
    SET "programEnrollmentId" = 'pe_pm_' || "memberId"
    WHERE "programEnrollmentId" IS NULL
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "ProgramExerciseCompletion"
    SET "programEnrollmentId" = 'pe_pm_' || "memberId"
    WHERE "programEnrollmentId" IS NULL
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "ProgramProject"
    SET "programEnrollmentId" = 'pe_pm_' || "memberId"
    WHERE "programEnrollmentId" IS NULL
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "ProgramMissionSubmission"
    SET "programEnrollmentId" = 'pe_pm_' || "memberId"
    WHERE "programEnrollmentId" IS NULL
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "RecruiterShortlistItem" s
    SET "candidateUserId" = m."userId"
    FROM "ProgramMember" m
    WHERE s."memberId" = m.id
      AND s."candidateUserId" IS NULL
  `);
}

async function main() {
  assertChildBranch();
  const host =
    (process.env.DATABASE_URL ?? "").split("@")[1]?.split("/")[0] ?? "";
  const database =
    (process.env.DATABASE_URL ?? "").split("/").pop()?.split("?")[0] ?? "";
  console.log(JSON.stringify({ host, database, step: "start" }));
  if (host.includes("young-shadow")) throw new Error("refusing young-shadow");

  const before = await counts();
  console.log(JSON.stringify({ step: "before", ...before }));

  if (process.argv.includes("--backfill")) {
    if (before.pm_missing_pe > 0) {
      throw new Error(`HARD BLOCKER: ${before.pm_missing_pe} ProgramMember rows missing pe_pm_ ProgramEnrollment`);
    }
    await backfill();
    const after = await counts();
    console.log(JSON.stringify({ step: "after", ...after }));
    const missing =
      after.commit_missing +
      after.interview_missing +
      after.general_missing +
      after.concept_missing +
      after.exercise_missing +
      after.project_missing +
      after.pms_missing +
      after.shortlist_missing_user;
    const orphans = after.commit_orphan_pe;
    if (missing !== 0 || orphans !== 0) {
      throw new Error(`HARD BLOCKER: backfill missing=${missing} orphans=${orphans}`);
    }
    console.log(JSON.stringify({ ok: true, backfillMissing: 0, orphans: 0 }));
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
