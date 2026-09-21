/**
 * W6-A progress write-authority reconciliation (read-only).
 *
 * Submission / QuizAttempt / ProgramMissionSubmission vs ActivityAttempt +
 * ActivityEvaluation. Does not treat Enrollment.daysCompleted, frozen Points,
 * Certificate, identity, or ambassador drift as failure.
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
  isLegacyProgressMirrorEnabled,
  isNewProgressWritesEnabled,
} from "../../src/lib/feature-flags";
import { assertChildBranch } from "./migrate-078-shared";

const prisma = new PrismaClient();

function n(rows: Array<{ n: bigint | number }>): number {
  return Number(rows[0]?.n ?? 0);
}

async function main() {
  assertChildBranch();

  const coverage = await prisma.$queryRaw<
    Array<{
      submissions: bigint;
      submission_attempts: bigint;
      sub_missing_attempt: bigint;
      sub_orphan_attempt: bigint;
      sub_missing_eval: bigint;
      missions: bigint;
      mission_attempts: bigint;
      ms_missing_attempt: bigint;
      ms_orphan_attempt: bigint;
      ms_missing_eval: bigint;
      quiz_attempts: bigint;
      quiz_mapped_attempts: bigint;
      qa_missing_attempt: bigint;
      qa_orphan_attempt: bigint;
      qa_missing_eval: bigint;
      duplicate_attempts: bigint;
      duplicate_evals: bigint;
    }>
  >`
    SELECT
      (SELECT count(*)::bigint FROM "Submission") AS submissions,
      (SELECT count(*)::bigint FROM "ActivityAttempt" WHERE id LIKE 'aa_sub_%') AS submission_attempts,
      (SELECT count(*)::bigint FROM "Submission" s
        WHERE NOT EXISTS (SELECT 1 FROM "ActivityAttempt" a WHERE a.id = 'aa_sub_' || s.id)) AS sub_missing_attempt,
      (SELECT count(*)::bigint FROM "ActivityAttempt" a
        WHERE a.id LIKE 'aa_sub_%'
          AND NOT EXISTS (SELECT 1 FROM "Submission" s WHERE a.id = 'aa_sub_' || s.id)) AS sub_orphan_attempt,
      (SELECT count(*)::bigint FROM "ActivityAttempt" a
        WHERE a.id LIKE 'aa_sub_%'
          AND NOT EXISTS (
            SELECT 1 FROM "ActivityEvaluation" e WHERE e.id = 'ev_sub_' || substr(a.id, 8)
          )) AS sub_missing_eval,
      (SELECT count(*)::bigint FROM "ProgramMissionSubmission") AS missions,
      (SELECT count(*)::bigint FROM "ActivityAttempt" WHERE id LIKE 'aa_ms_%') AS mission_attempts,
      (SELECT count(*)::bigint FROM "ProgramMissionSubmission" pms
        WHERE NOT EXISTS (SELECT 1 FROM "ActivityAttempt" a WHERE a.id = 'aa_ms_' || pms.id)) AS ms_missing_attempt,
      (SELECT count(*)::bigint FROM "ActivityAttempt" a
        WHERE a.id LIKE 'aa_ms_%'
          AND NOT EXISTS (SELECT 1 FROM "ProgramMissionSubmission" pms WHERE a.id = 'aa_ms_' || pms.id)) AS ms_orphan_attempt,
      (SELECT count(*)::bigint FROM "ActivityAttempt" a
        WHERE a.id LIKE 'aa_ms_%'
          AND NOT EXISTS (
            SELECT 1 FROM "ActivityEvaluation" e WHERE e.id = 'ev_ms_' || substr(a.id, 7)
          )) AS ms_missing_eval,
      (SELECT count(*)::bigint FROM "QuizAttempt") AS quiz_attempts,
      (SELECT count(*)::bigint FROM "ActivityAttempt" WHERE id LIKE 'aa_qa_%') AS quiz_mapped_attempts,
      (SELECT count(*)::bigint FROM "QuizAttempt" qa
        WHERE NOT EXISTS (SELECT 1 FROM "ActivityAttempt" a WHERE a.id = 'aa_qa_' || qa.id)) AS qa_missing_attempt,
      (SELECT count(*)::bigint FROM "ActivityAttempt" a
        WHERE a.id LIKE 'aa_qa_%'
          AND NOT EXISTS (SELECT 1 FROM "QuizAttempt" qa WHERE a.id = 'aa_qa_' || qa.id)) AS qa_orphan_attempt,
      (SELECT count(*)::bigint FROM "ActivityAttempt" a
        WHERE a.id LIKE 'aa_qa_%'
          AND NOT EXISTS (
            SELECT 1 FROM "ActivityEvaluation" e WHERE e.id = 'ev_qa_' || substr(a.id, 7)
          )) AS qa_missing_eval,
      (SELECT count(*)::bigint FROM (
        SELECT "enrollmentId", "activityId", "attemptNumber"
        FROM "ActivityAttempt"
        GROUP BY 1, 2, 3
        HAVING count(*) > 1
      ) d) AS duplicate_attempts,
      (SELECT count(*)::bigint FROM (
        SELECT "attemptId" FROM "ActivityEvaluation" GROUP BY 1 HAVING count(*) > 1
      ) d) AS duplicate_evals
  `;

  const sub = await prisma.$queryRaw<
    Array<{
      submitted_at_mismatch: bigint;
      late_mismatch: bigint;
      ontime_mismatch: bigint;
      not_passed: bigint;
      eval_not_passed: bigint;
    }>
  >`
    SELECT
      count(*) FILTER (WHERE a."submittedAt" IS DISTINCT FROM s."submittedAt")::bigint AS submitted_at_mismatch,
      count(*) FILTER (WHERE s.status = 'LATE' AND a.lateness IS DISTINCT FROM 'LATE')::bigint AS late_mismatch,
      count(*) FILTER (WHERE s.status = 'ON_TIME' AND a.lateness IS DISTINCT FROM 'ON_TIME')::bigint AS ontime_mismatch,
      count(*) FILTER (WHERE a.id IS NOT NULL AND a.passed IS NOT TRUE)::bigint AS not_passed,
      count(*) FILTER (WHERE e.id IS NOT NULL AND e.passed IS NOT TRUE)::bigint AS eval_not_passed
    FROM "Submission" s
    LEFT JOIN "ActivityAttempt" a ON a.id = 'aa_sub_' || s.id
    LEFT JOIN "ActivityEvaluation" e ON e.id = 'ev_sub_' || s.id
  `;

  const quiz = await prisma.$queryRaw<
    Array<{ score_mismatch: bigint; passed_mismatch: bigint }>
  >`
    SELECT
      count(*) FILTER (WHERE a.id IS NOT NULL AND a.score IS DISTINCT FROM qa.score)::bigint AS score_mismatch,
      count(*) FILTER (
        WHERE a.id IS NOT NULL AND a.passed IS DISTINCT FROM (qa.score >= 60)
      )::bigint AS passed_mismatch
    FROM "QuizAttempt" qa
    LEFT JOIN "ActivityAttempt" a ON a.id = 'aa_qa_' || qa.id
  `;

  const mission = await prisma.$queryRaw<
    Array<{ pass_mismatch: bigint; points_mismatch: bigint; attempt_mismatch: bigint }>
  >`
    SELECT
      count(*) FILTER (WHERE a.id IS NOT NULL AND a.passed IS DISTINCT FROM pms.passed)::bigint AS pass_mismatch,
      count(*) FILTER (WHERE a.id IS NOT NULL AND a."pointsAwarded" IS DISTINCT FROM pms."pointsAwarded")::bigint AS points_mismatch,
      count(*) FILTER (WHERE a.id IS NOT NULL AND a."attemptNumber" IS DISTINCT FROM pms."attemptNumber")::bigint AS attempt_mismatch
    FROM "ProgramMissionSubmission" pms
    LEFT JOIN "ActivityAttempt" a ON a.id = 'aa_ms_' || pms.id
  `;

  const c = coverage[0]!;
  const report = {
    flags: {
      ENABLE_NEW_PROGRESS_WRITES: isNewProgressWritesEnabled(),
      ENABLE_LEGACY_PROGRESS_MIRROR: isLegacyProgressMirrorEnabled(),
    },
    submission: {
      legacy: Number(c.submissions),
      attempts: Number(c.submission_attempts),
      missingAttempt: Number(c.sub_missing_attempt),
      orphanAttempt: Number(c.sub_orphan_attempt),
      missingEval: Number(c.sub_missing_eval),
      ...Object.fromEntries(
        Object.entries(sub[0] ?? {}).map(([k, v]) => [k, Number(v)]),
      ),
    },
    quiz: {
      legacy: Number(c.quiz_attempts),
      attempts: Number(c.quiz_mapped_attempts),
      missingAttempt: Number(c.qa_missing_attempt),
      orphanAttempt: Number(c.qa_orphan_attempt),
      missingEval: Number(c.qa_missing_eval),
      ...Object.fromEntries(
        Object.entries(quiz[0] ?? {}).map(([k, v]) => [k, Number(v)]),
      ),
    },
    mission: {
      legacy: Number(c.missions),
      attempts: Number(c.mission_attempts),
      missingAttempt: Number(c.ms_missing_attempt),
      orphanAttempt: Number(c.ms_orphan_attempt),
      missingEval: Number(c.ms_missing_eval),
      ...Object.fromEntries(
        Object.entries(mission[0] ?? {}).map(([k, v]) => [k, Number(v)]),
      ),
    },
    duplicates: {
      attempts: Number(c.duplicate_attempts),
      evaluations: Number(c.duplicate_evals),
    },
    note: "Quiz old question-id blobs are not scored as drift. Enrollment.daysCompleted is W7.",
  };
  console.log(JSON.stringify(report, null, 2));

  const unexplained =
    report.submission.missingAttempt +
    report.submission.orphanAttempt +
    report.submission.missingEval +
    Number(report.submission.submitted_at_mismatch ?? 0) +
    Number(report.submission.late_mismatch ?? 0) +
    Number(report.submission.ontime_mismatch ?? 0) +
    Number(report.submission.not_passed ?? 0) +
    Number(report.submission.eval_not_passed ?? 0) +
    report.quiz.missingAttempt +
    report.quiz.orphanAttempt +
    report.quiz.missingEval +
    Number(report.quiz.score_mismatch ?? 0) +
    Number(report.quiz.passed_mismatch ?? 0) +
    report.mission.missingAttempt +
    report.mission.orphanAttempt +
    report.mission.missingEval +
    Number(report.mission.pass_mismatch ?? 0) +
    Number(report.mission.points_mismatch ?? 0) +
    Number(report.mission.attempt_mismatch ?? 0) +
    report.duplicates.attempts +
    report.duplicates.evaluations;

  if (unexplained !== 0) {
    throw new Error(`W6-A progress recon unexplained drift = ${unexplained}`);
  }
  console.log("W6-A progress recon unexplained drift = 0");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
