/**
 * W7-B enrollment denorm recon (read-only).
 *
 * Blocking:
 *   Enrollment ↔ pe_enr_ mapping errors = 0
 *   duplicate pe_enr_ (userId, cohortId) = 0
 *   canonical domain derivation (PE cohort slug vs Enrollment.domain) = 0
 *   PE streak snapshot missing for challenge PE = 0
 *
 * Pre-cutover (mirror ON): unexplained days / lastSubmittedDay / streak = 0;
 * domain value mismatches must equal the 4 historical exceptions.
 *
 * Post-cutover (mirror OFF): frozen denorm drift is informational.
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
  isLegacyEnrollmentDenormMirrorEnabled,
  isNewEnrollmentStateEnabled,
} from "../../src/lib/feature-flags";
import { assertChildBranch } from "./migrate-078-shared";

const ACCEPTED_HISTORICAL_DOMAIN_EXCEPTIONS = 4;

const prisma = new PrismaClient();

function n(rows: Array<{ n: bigint | number }>): number {
  return Number(rows[0]?.n ?? 0);
}

async function main() {
  assertChildBranch();

  const mapping = await prisma.$queryRaw<
    Array<{
      enrollments: bigint;
      pe_challenge: bigint;
      enr_missing_pe: bigint;
      pe_missing_enr: bigint;
      duplicate_pe_identity: bigint;
    }>
  >`
    SELECT
      (SELECT count(*)::bigint FROM "Enrollment") AS enrollments,
      (SELECT count(*)::bigint FROM "ProgramEnrollment" WHERE id LIKE 'pe_enr_%') AS pe_challenge,
      (SELECT count(*)::bigint FROM "Enrollment" e
        WHERE NOT EXISTS (
          SELECT 1 FROM "ProgramEnrollment" pe WHERE pe.id = 'pe_enr_' || e.id
        )) AS enr_missing_pe,
      (SELECT count(*)::bigint FROM "ProgramEnrollment" pe
        WHERE pe.id LIKE 'pe_enr_%'
          AND NOT EXISTS (
            SELECT 1 FROM "Enrollment" e WHERE pe.id = 'pe_enr_' || e.id
          )) AS pe_missing_enr,
      (
        SELECT count(*)::bigint FROM (
          SELECT "userId", "cohortId"
          FROM "ProgramEnrollment"
          WHERE id LIKE 'pe_enr_%'
          GROUP BY "userId", "cohortId"
          HAVING count(*) > 1
        ) d
      ) AS duplicate_pe_identity
  `;

  const days = await prisma.$queryRaw<
    Array<{
      compared: bigint;
      equal: bigint;
      legacy_higher: bigint;
      canonical_higher: bigint;
      enrollment_without_aa: bigint;
    }>
  >`
    WITH canon AS (
      SELECT
        substr(aa."enrollmentId", 8) AS enrollment_id,
        count(DISTINCT act."dayNumber") FILTER (
          WHERE act."dayNumber" IS NOT NULL
            AND COALESCE(ev.passed, aa.passed)
        )::int AS days
      FROM "ActivityAttempt" aa
      JOIN "Activity" act ON act.id = aa."activityId"
      LEFT JOIN LATERAL (
        SELECT ev.passed
        FROM "ActivityEvaluation" ev
        WHERE ev."attemptId" = aa.id AND ev."isAuthoritative" = true
        LIMIT 1
      ) ev ON true
      WHERE aa.id LIKE 'aa_sub_%'
        AND aa."activityId" LIKE 'act_dt_%'
      GROUP BY 1
    )
    SELECT
      count(*)::bigint AS compared,
      count(*) FILTER (WHERE e."daysCompleted" = COALESCE(c.days, 0))::bigint AS equal,
      count(*) FILTER (WHERE e."daysCompleted" > COALESCE(c.days, 0))::bigint AS legacy_higher,
      count(*) FILTER (WHERE e."daysCompleted" < COALESCE(c.days, 0))::bigint AS canonical_higher,
      count(*) FILTER (WHERE c.enrollment_id IS NULL AND e."daysCompleted" > 0)::bigint AS enrollment_without_aa
    FROM "Enrollment" e
    LEFT JOIN canon c ON c.enrollment_id = e.id
  `;

  const lastSubmitted = await prisma.$queryRaw<
    Array<{
      compared: bigint;
      equal: bigint;
      mismatch: bigint;
    }>
  >`
    WITH canon AS (
      SELECT
        substr(aa."enrollmentId", 8) AS enrollment_id,
        max(act."dayNumber") FILTER (
          WHERE act."dayNumber" IS NOT NULL
            AND COALESCE(ev.passed, aa.passed)
        )::int AS last_day
      FROM "ActivityAttempt" aa
      JOIN "Activity" act ON act.id = aa."activityId"
      LEFT JOIN LATERAL (
        SELECT ev.passed
        FROM "ActivityEvaluation" ev
        WHERE ev."attemptId" = aa.id AND ev."isAuthoritative" = true
        LIMIT 1
      ) ev ON true
      WHERE aa.id LIKE 'aa_sub_%'
        AND aa."activityId" LIKE 'act_dt_%'
      GROUP BY 1
    )
    SELECT
      count(*)::bigint AS compared,
      count(*) FILTER (
        WHERE COALESCE(e."lastSubmittedDay", 0) = COALESCE(c.last_day, 0)
      )::bigint AS equal,
      count(*) FILTER (
        WHERE COALESCE(e."lastSubmittedDay", 0) IS DISTINCT FROM COALESCE(c.last_day, 0)
      )::bigint AS mismatch
    FROM "Enrollment" e
    LEFT JOIN canon c ON c.enrollment_id = e.id
  `;

  const streakSnapshot = await prisma.$queryRaw<
    Array<{
      compared: bigint;
      current_equal: bigint;
      longest_equal: bigint;
      current_mismatch: bigint;
      longest_mismatch: bigint;
      pe_missing: bigint;
    }>
  >`
    SELECT
      count(*)::bigint AS compared,
      count(*) FILTER (
        WHERE pe.id IS NOT NULL AND pe."trackCurrentStreak" = e."currentStreak"
      )::bigint AS current_equal,
      count(*) FILTER (
        WHERE pe.id IS NOT NULL AND pe."trackLongestStreak" = e."longestStreak"
      )::bigint AS longest_equal,
      count(*) FILTER (
        WHERE pe.id IS NOT NULL AND pe."trackCurrentStreak" IS DISTINCT FROM e."currentStreak"
      )::bigint AS current_mismatch,
      count(*) FILTER (
        WHERE pe.id IS NOT NULL AND pe."trackLongestStreak" IS DISTINCT FROM e."longestStreak"
      )::bigint AS longest_mismatch,
      count(*) FILTER (WHERE pe.id IS NULL)::bigint AS pe_missing
    FROM "Enrollment" e
    LEFT JOIN "ProgramEnrollment" pe ON pe.id = 'pe_enr_' || e.id
  `;

  const domain = await prisma.$queryRaw<
    Array<{
      sp_with_domain: bigint;
      matches: bigint;
      value_mismatch: bigint;
      legacy_only: bigint;
      canonical_only: bigint;
      sp_absent_with_pe: bigint;
      pe_domain_mismatch: bigint;
    }>
  >`
    WITH first_enr AS (
      SELECT DISTINCT ON (e."userId")
        e."userId",
        e.domain::text AS domain
      FROM "Enrollment" e
      ORDER BY e."userId", e."createdAt" ASC, e.id ASC
    )
    SELECT
      (SELECT count(*)::bigint FROM "StudentProfile" WHERE domain IS NOT NULL) AS sp_with_domain,
      count(*) FILTER (
        WHERE sp.domain IS NOT NULL AND f.domain IS NOT NULL AND sp.domain::text = f.domain
      )::bigint AS matches,
      count(*) FILTER (
        WHERE sp.domain IS NOT NULL AND f.domain IS NOT NULL AND sp.domain::text IS DISTINCT FROM f.domain
      )::bigint AS value_mismatch,
      count(*) FILTER (WHERE sp.domain IS NOT NULL AND f.domain IS NULL)::bigint AS legacy_only,
      count(*) FILTER (WHERE (sp.domain IS NULL OR sp.id IS NULL) AND f.domain IS NOT NULL)::bigint AS canonical_only,
      count(*) FILTER (WHERE sp.id IS NULL AND f.domain IS NOT NULL)::bigint AS sp_absent_with_pe,
      (
        SELECT count(*)::bigint
        FROM "Enrollment" e
        JOIN "ProgramEnrollment" pe ON pe.id = 'pe_enr_' || e.id
        JOIN "Cohort" c ON c.id = pe."cohortId"
        WHERE c.slug IS DISTINCT FROM ('legacy-' || lower(e.domain::text))
      ) AS pe_domain_mismatch
    FROM first_enr f
    FULL OUTER JOIN "StudentProfile" sp ON sp."userId" = f."userId"
  `;

  const isolation = await prisma.$queryRaw<
    Array<{
      program_members: bigint;
      enrollment_progress: bigint;
      submissions: bigint;
      quiz_attempts: bigint;
      mission_submissions: bigint;
    }>
  >`
    SELECT
      (SELECT count(*)::bigint FROM "ProgramMember") AS program_members,
      (SELECT count(*)::bigint FROM "EnrollmentProgress") AS enrollment_progress,
      (SELECT count(*)::bigint FROM "Submission") AS submissions,
      (SELECT count(*)::bigint FROM "QuizAttempt") AS quiz_attempts,
      (SELECT count(*)::bigint FROM "ProgramMissionSubmission") AS mission_submissions
  `;

  const map = mapping[0]!;
  const day = days[0]!;
  const last = lastSubmitted[0]!;
  const streak = streakSnapshot[0]!;
  const dom = domain[0]!;
  const iso = isolation[0]!;

  const frozenDaysDrift =
    n([{ n: day.legacy_higher }]) + n([{ n: day.canonical_higher }]);
  const frozenLastSubmittedDayDrift = n([{ n: last.mismatch }]);
  const frozenCurrentStreakDrift = n([{ n: streak.current_mismatch }]);
  const frozenLongestStreakDrift = n([{ n: streak.longest_mismatch }]);
  const historicalDomainExceptions = n([{ n: dom.value_mismatch }]);
  const unexplainedDomain = Math.max(
    0,
    historicalDomainExceptions - ACCEPTED_HISTORICAL_DOMAIN_EXCEPTIONS,
  );
  const mappingErrors =
    n([{ n: map.enr_missing_pe }]) + n([{ n: map.pe_missing_enr }]);
  const duplicatePeIdentity = n([{ n: map.duplicate_pe_identity }]);
  const canonicalDomainDerivationErrors = n([{ n: dom.pe_domain_mismatch }]);
  const peStreakIntegrityErrors = n([{ n: streak.pe_missing }]);
  const canonicalDaysErrors = n([{ n: day.enrollment_without_aa }]);
  const mirrorOff = !isLegacyEnrollmentDenormMirrorEnabled();

  const result = {
    flags: {
      ENABLE_NEW_ENROLLMENT_STATE: isNewEnrollmentStateEnabled(),
      ENABLE_LEGACY_ENROLLMENT_DENORM_MIRROR:
        isLegacyEnrollmentDenormMirrorEnabled(),
      W7B_CUTOVER_TIME: process.env.W7B_CUTOVER_TIME ?? null,
    },
    mapping: {
      enrollments: n([{ n: map.enrollments }]),
      peChallenge: n([{ n: map.pe_challenge }]),
      enrollmentMissingPe: n([{ n: map.enr_missing_pe }]),
      peMissingEnrollment: n([{ n: map.pe_missing_enr }]),
      duplicatePeIdentity,
    },
    days: {
      compared: n([{ n: day.compared }]),
      equal: n([{ n: day.equal }]),
      legacyHigher: n([{ n: day.legacy_higher }]),
      canonicalHigher: n([{ n: day.canonical_higher }]),
      enrollmentWithoutAa: n([{ n: day.enrollment_without_aa }]),
    },
    lastSubmittedDay: {
      compared: n([{ n: last.compared }]),
      equal: n([{ n: last.equal }]),
      mismatch: n([{ n: last.mismatch }]),
      semantic: "highest passed challenge dayNumber (not timestamp, not ON_TIME-only)",
    },
    streakSnapshot: {
      compared: n([{ n: streak.compared }]),
      currentEqual: n([{ n: streak.current_equal }]),
      longestEqual: n([{ n: streak.longest_equal }]),
      currentMismatch: n([{ n: streak.current_mismatch }]),
      longestMismatch: n([{ n: streak.longest_mismatch }]),
      peMissing: n([{ n: streak.pe_missing }]),
    },
    domain: {
      spWithDomain: n([{ n: dom.sp_with_domain }]),
      matches: n([{ n: dom.matches }]),
      valueMismatch: n([{ n: dom.value_mismatch }]),
      historicalDomainExceptions,
      acceptedHistoricalDomainExceptions: ACCEPTED_HISTORICAL_DOMAIN_EXCEPTIONS,
      unexplainedDomain,
      legacyOnly: n([{ n: dom.legacy_only }]),
      canonicalOnly: n([{ n: dom.canonical_only }]),
      spAbsentWithPe: n([{ n: dom.sp_absent_with_pe }]),
      peDomainMismatch: n([{ n: dom.pe_domain_mismatch }]),
    },
    isolation: {
      programMembers: n([{ n: iso.program_members }]),
      enrollmentProgress: n([{ n: iso.enrollment_progress }]),
      submissions: n([{ n: iso.submissions }]),
      quizAttempts: n([{ n: iso.quiz_attempts }]),
      missionSubmissions: n([{ n: iso.mission_submissions }]),
    },
    gates: {
      mappingErrors,
      duplicatePeIdentity,
      canonicalDaysErrors,
      peStreakIntegrityErrors,
      canonicalDomainDerivationErrors,
      unexplainedDomain,
    },
    informational: mirrorOff
      ? {
          frozenEnrollmentDaysDrift: frozenDaysDrift,
          frozenLastSubmittedDayDrift,
          frozenCurrentStreakDrift,
          frozenLongestStreakDrift,
          frozenStudentProfileDomainDrift: historicalDomainExceptions,
        }
      : {
          unexplainedDays: frozenDaysDrift,
          unexplainedLastSubmittedDay: frozenLastSubmittedDayDrift,
          unexplainedStreak:
            frozenCurrentStreakDrift + frozenLongestStreakDrift,
        },
  };

  console.log(JSON.stringify(result, null, 2));

  if (mappingErrors !== 0) process.exitCode = 1;
  if (duplicatePeIdentity !== 0) process.exitCode = 1;
  if (canonicalDomainDerivationErrors !== 0) process.exitCode = 1;
  if (peStreakIntegrityErrors !== 0) process.exitCode = 1;
  if (canonicalDaysErrors !== 0) process.exitCode = 1;
  if (unexplainedDomain !== 0) process.exitCode = 1;
  if (!mirrorOff) {
    if (frozenDaysDrift !== 0) process.exitCode = 1;
    if (frozenLastSubmittedDayDrift !== 0) process.exitCode = 1;
    if (frozenCurrentStreakDrift !== 0 || frozenLongestStreakDrift !== 0) {
      process.exitCode = 1;
    }
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
