/**
 * W7-B accidental denorm-write sentinel (read-only).
 *
 * After ENABLE_LEGACY_ENROLLMENT_DENORM_MIRROR=false and W7B_CUTOVER_TIME:
 * enrollments that first-passed a new challenge day after cutover must not
 * have Enrollment.daysCompleted / lastSubmittedDay remirrored to canonical.
 *
 * Does not flag Enrollment.status / startedAt / completedAt or other
 * StudentProfile later-family updates.
 *
 * Source-path audit lives in enrollment-state.test.ts.
 * Production: PHASE2_ALLOW_PRODUCTION=1 + direct host.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

if (process.env.DATABASE_URL?.includes("-pooler.")) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace("-pooler.", ".");
}

import { PrismaClient } from "@prisma/client";
import { isLegacyEnrollmentDenormMirrorEnabled } from "../../src/lib/feature-flags";
import { assertChildBranch } from "./migrate-078-shared";

const prisma = new PrismaClient();

function n(rows: Array<{ n: bigint | number }>): number {
  return Number(rows[0]?.n ?? 0);
}

async function main() {
  assertChildBranch();
  const raw = process.env.W7B_CUTOVER_TIME?.trim();
  const cutover = raw ? new Date(raw) : null;
  if (raw && Number.isNaN(cutover?.getTime())) {
    throw new Error(`W7B_CUTOVER_TIME is not a valid date: ${raw}`);
  }

  if (cutover && isLegacyEnrollmentDenormMirrorEnabled()) {
    throw new Error(
      "W7B_CUTOVER_TIME is set but ENABLE_LEGACY_ENROLLMENT_DENORM_MIRROR is not false",
    );
  }

  const remirroredDays = cutover
    ? n(
        await prisma.$queryRaw<{ n: bigint }[]>`
          WITH first_pass AS (
            SELECT
              substr(aa."enrollmentId", 8) AS enrollment_id,
              act."dayNumber" AS day_number,
              min(aa."submittedAt") AS first_passed_at
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
              AND act."dayNumber" IS NOT NULL
              AND COALESCE(ev.passed, aa.passed)
            GROUP BY 1, 2
          ),
          new_days AS (
            SELECT enrollment_id
            FROM first_pass
            WHERE first_passed_at >= ${cutover}
          ),
          canon AS (
            SELECT
              substr(aa."enrollmentId", 8) AS enrollment_id,
              count(DISTINCT act."dayNumber") FILTER (
                WHERE act."dayNumber" IS NOT NULL
                  AND COALESCE(ev.passed, aa.passed)
              )::int AS days,
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
          SELECT count(*)::bigint AS n
          FROM "Enrollment" e
          JOIN new_days nd ON nd.enrollment_id = e.id
          JOIN canon c ON c.enrollment_id = e.id
          WHERE e."daysCompleted" = c.days
             OR (
               e."lastSubmittedDay" IS NOT NULL
               AND e."lastSubmittedDay" = c.last_day
               AND EXISTS (
                 SELECT 1 FROM first_pass fp
                 WHERE fp.enrollment_id = e.id
                   AND fp.day_number = c.last_day
                   AND fp.first_passed_at >= ${cutover}
               )
             )
        `,
      )
    : 0;

  const remirroredStreak = cutover
    ? n(
        await prisma.$queryRaw<{ n: bigint }[]>`
          WITH first_pass AS (
            SELECT DISTINCT substr(aa."enrollmentId", 8) AS enrollment_id
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
              AND COALESCE(ev.passed, aa.passed)
            GROUP BY substr(aa."enrollmentId", 8), act."dayNumber"
            HAVING min(aa."submittedAt") >= ${cutover}
          )
          SELECT count(*)::bigint AS n
          FROM "Enrollment" e
          JOIN first_pass fp ON fp.enrollment_id = e.id
          JOIN "ProgramEnrollment" pe ON pe.id = 'pe_enr_' || e.id
          WHERE pe."updatedAt" >= ${cutover}
            AND e."currentStreak" = pe."trackCurrentStreak"
            AND e."longestStreak" = pe."trackLongestStreak"
        `,
      )
    : 0;

  const report = {
    w7bCutoverTime: raw ?? null,
    legacyEnrollmentDenormMirror: isLegacyEnrollmentDenormMirrorEnabled()
      ? "on"
      : "off",
    remirroredDaysOrLastSubmittedDay: remirroredDays,
    remirroredStreakSnapshots: remirroredStreak,
    note: "Flags W7 denorm field remirrors after a new first-passed challenge day. Enrollment.status and other SP families are ignored.",
  };
  console.log(JSON.stringify(report, null, 2));

  if (cutover && (remirroredDays !== 0 || remirroredStreak !== 0)) {
    throw new Error(
      `W7-B sentinel: unintended denorm writes days=${remirroredDays} streak=${remirroredStreak}`,
    );
  }
  console.log("W7-B legacy-write sentinel finished.");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
