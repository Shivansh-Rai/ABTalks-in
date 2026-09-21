/**
 * W6-B progress recon (read-only).
 *
 * Mirror ON: bidirectional legacy↔canonical parity required (same as W6-A)
 * plus Enrollment.daysCompleted / GitHub URL / streak-source comparisons.
 * Mirror OFF: bidirectional gaps are informational; blocking gates are
 * duplicates, orphan evaluations, and joined-row semantic errors.
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
  const mirrorOn = isLegacyProgressMirrorEnabled();
  const cutoverRaw = process.env.W6B_CUTOVER_TIME?.trim() ?? null;

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
      count(*) FILTER (
        WHERE a.id IS NOT NULL AND a."submittedAt" IS DISTINCT FROM s."submittedAt"
      )::bigint AS submitted_at_mismatch,
      count(*) FILTER (
        WHERE a.id IS NOT NULL AND s.status = 'LATE' AND a.lateness IS DISTINCT FROM 'LATE'
      )::bigint AS late_mismatch,
      count(*) FILTER (
        WHERE a.id IS NOT NULL AND s.status = 'ON_TIME' AND a.lateness IS DISTINCT FROM 'ON_TIME'
      )::bigint AS ontime_mismatch,
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

  const githubMismatch = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*)::bigint AS n
    FROM "Submission" s
    JOIN "ActivityAttempt" a ON a.id = 'aa_sub_' || s.id
    WHERE (a.payload->>'githubUrl') IS DISTINCT FROM s."githubUrl"
  `);

  const daysCompletedMismatch = n(await prisma.$queryRaw<{ n: bigint }[]>`
    WITH sub AS (
      SELECT "enrollmentId" AS eid, count(*)::int AS n
      FROM "Submission"
      GROUP BY 1
    ),
    aa AS (
      SELECT substr(a."enrollmentId", 8) AS eid, count(*)::int AS n
      FROM "ActivityAttempt" a
      WHERE a.id LIKE 'aa_sub_%' AND a."enrollmentId" LIKE 'pe_enr_%'
      GROUP BY 1
    )
    SELECT count(*)::bigint AS n
    FROM sub
    FULL OUTER JOIN aa ON sub.eid = aa.eid
    WHERE coalesce(sub.n, 0) IS DISTINCT FROM coalesce(aa.n, 0)
  `);

  const onTimeDayMismatch = n(await prisma.$queryRaw<{ n: bigint }[]>`
    WITH sub AS (
      SELECT "enrollmentId" AS eid,
             coalesce(array_agg("dayNumber" ORDER BY "dayNumber"), '{}') AS days
      FROM "Submission"
      WHERE status = 'ON_TIME'
      GROUP BY 1
    ),
    aa AS (
      SELECT substr(a."enrollmentId", 8) AS eid,
             coalesce(array_agg(act."dayNumber" ORDER BY act."dayNumber"), '{}') AS days
      FROM "ActivityAttempt" a
      JOIN "Activity" act ON act.id = a."activityId"
      WHERE a.id LIKE 'aa_sub_%'
        AND a."enrollmentId" LIKE 'pe_enr_%'
        AND a.lateness = 'ON_TIME'
      GROUP BY 1
    )
    SELECT count(*)::bigint AS n
    FROM sub
    FULL OUTER JOIN aa ON sub.eid = aa.eid
    WHERE sub.days IS DISTINCT FROM aa.days
  `);

  const invalidMapping = await prisma.$queryRaw<
    Array<{
      challenge: bigint;
      quiz: bigint;
      mission: bigint;
    }>
  >`
    SELECT
      (SELECT count(*)::bigint FROM "ActivityAttempt"
        WHERE id LIKE 'aa_sub_%' AND "activityId" NOT LIKE 'act_dt_%') AS challenge,
      (SELECT count(*)::bigint FROM "ActivityAttempt"
        WHERE id LIKE 'aa_qa_%' AND "activityId" NOT LIKE 'act_quiz_%') AS quiz,
      (SELECT count(*)::bigint FROM "ActivityAttempt"
        WHERE id LIKE 'aa_ms_%' AND "activityId" NOT LIKE 'act_pd_%') AS mission
  `;

  const c = coverage[0]!;
  const report = {
    flags: {
      ENABLE_NEW_PROGRESS_WRITES: isNewProgressWritesEnabled(),
      ENABLE_LEGACY_PROGRESS_MIRROR: mirrorOn,
      W6B_CUTOVER_TIME: cutoverRaw,
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
    denorm: {
      githubUrlMismatch: githubMismatch,
      daysCompletedSourceMismatch: daysCompletedMismatch,
      onTimeDayMismatch,
    },
    invalidActivityMapping: {
      challenge: Number(invalidMapping[0]?.challenge ?? 0),
      quiz: Number(invalidMapping[0]?.quiz ?? 0),
      mission: Number(invalidMapping[0]?.mission ?? 0),
    },
    informational: {
      postCutoverChallengeAttemptsWithoutSubmission: Number(c.sub_orphan_attempt),
      postCutoverQuizAttemptsWithoutQuizAttempt: Number(c.qa_orphan_attempt),
      postCutoverMissionAttemptsWithoutPMS: Number(c.ms_orphan_attempt),
    },
    note: mirrorOn
      ? "Mirror ON: bidirectional parity required. Enrollment denorm still written (W7 not started)."
      : "Mirror OFF: canonical-without-legacy is expected. Do not backfill frozen tables.",
  };
  console.log(JSON.stringify(report, null, 2));

  const semantic =
    Number(report.submission.submitted_at_mismatch ?? 0) +
    Number(report.submission.late_mismatch ?? 0) +
    Number(report.submission.ontime_mismatch ?? 0) +
    Number(report.submission.not_passed ?? 0) +
    Number(report.submission.eval_not_passed ?? 0) +
    Number(report.quiz.score_mismatch ?? 0) +
    Number(report.quiz.passed_mismatch ?? 0) +
    Number(report.mission.pass_mismatch ?? 0) +
    Number(report.mission.points_mismatch ?? 0) +
    Number(report.mission.attempt_mismatch ?? 0);

  const blocking = mirrorOn
    ? report.submission.missingAttempt +
      report.submission.orphanAttempt +
      report.submission.missingEval +
      report.quiz.missingAttempt +
      report.quiz.orphanAttempt +
      report.quiz.missingEval +
      report.mission.missingAttempt +
      report.mission.orphanAttempt +
      report.mission.missingEval +
      report.duplicates.attempts +
      report.duplicates.evaluations +
      semantic +
      githubMismatch +
      daysCompletedMismatch +
      onTimeDayMismatch +
      report.invalidActivityMapping.challenge +
      report.invalidActivityMapping.quiz +
      report.invalidActivityMapping.mission
    : report.submission.missingEval +
      report.quiz.missingEval +
      report.mission.missingEval +
      report.duplicates.attempts +
      report.duplicates.evaluations +
      semantic +
      report.invalidActivityMapping.challenge +
      report.invalidActivityMapping.quiz +
      report.invalidActivityMapping.mission;

  if (blocking !== 0) {
    throw new Error(`W6-B progress recon blocking = ${blocking}`);
  }
  console.log(
    mirrorOn
      ? "W6-B progress recon unexplained drift = 0 (mirror on)"
      : "W6-B progress recon blocking gates = 0 (mirror off; canonical-without-legacy expected)",
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
