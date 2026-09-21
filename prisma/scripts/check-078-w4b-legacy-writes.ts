/**
 * W4-B accidental W4-identity StudentProfile-write sentinel (read-only).
 *
 * StudentProfile.updatedAt is insufficient: later families still write the
 * same table. This script:
 *  1. Requires ENABLE_LEGACY_STUDENT_PROFILE_MIRROR=false when cutover is set.
 *  2. Reports frozen CP vs SP identity drift (expected to grow after freeze).
 *  3. Fails on SP missing CP, referral collisions, or referral mismatches
 *     that would mean a live referral identity rewrite.
 *
 * Source-path audit lives in src/repositories/candidate-identity.test.ts.
 * Production: PHASE2_ALLOW_PRODUCTION=1 + direct host.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

if (process.env.DATABASE_URL?.includes("-pooler.")) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace("-pooler.", ".");
}

import { PrismaClient } from "@prisma/client";
import { isLegacyStudentProfileMirrorEnabled } from "../../src/lib/feature-flags";
import { assertChildBranch } from "./migrate-078-shared";

const prisma = new PrismaClient();

function n(rows: Array<{ n: bigint | number }>): number {
  return Number(rows[0]?.n ?? 0);
}

async function main() {
  assertChildBranch();
  const raw = process.env.W4B_CUTOVER_TIME?.trim();
  const cutover = raw ? new Date(raw) : null;
  if (raw && Number.isNaN(cutover?.getTime())) {
    throw new Error(`W4B_CUTOVER_TIME is not a valid date: ${raw}`);
  }

  if (cutover && isLegacyStudentProfileMirrorEnabled()) {
    throw new Error(
      "W4B_CUTOVER_TIME is set but ENABLE_LEGACY_STUDENT_PROFILE_MIRROR is not false",
    );
  }

  const spMissingCp = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
      FROM "StudentProfile" sp
      LEFT JOIN "CandidateProfile" cp ON cp."userId" = sp."userId"
     WHERE cp.id IS NULL
  `);

  const referralCollision = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n FROM (
      SELECT sp."referralCode"
        FROM "StudentProfile" sp
        JOIN "CandidateProfile" cp ON cp."referralCode" = sp."referralCode"
       WHERE cp."userId" <> sp."userId"
    ) q
  `);

  const referralMismatch = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
      FROM "StudentProfile" sp
      JOIN "CandidateProfile" cp ON cp."userId" = sp."userId"
     WHERE sp."referralCode" <> cp."referralCode"
  `);

  const frozenStudentProfileNameDrift = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
      FROM "StudentProfile" sp
      JOIN "CandidateProfile" cp ON cp."userId" = sp."userId"
     WHERE sp."fullName" IS DISTINCT FROM cp."fullName"
  `);

  const frozenStudentProfilePhoneDrift = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
      FROM "StudentProfile" sp
      JOIN "CandidateProfile" cp ON cp."userId" = sp."userId"
     WHERE sp.phone IS DISTINCT FROM cp.phone
        OR sp."phoneVerified" IS DISTINCT FROM cp."phoneVerified"
  `);

  const frozenStudentProfileSkillDrift = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
      FROM "StudentProfile" sp
      JOIN "CandidateProfile" cp ON cp."userId" = sp."userId"
     WHERE (
       SELECT COALESCE(array_agg(sk.name ORDER BY sk.name), ARRAY[]::text[])
         FROM "CandidateSkill" cs
         JOIN "Skill" sk ON sk.id = cs."skillId"
        WHERE cs."userId" = sp."userId"
          AND cs."claimedByCandidate" = true
     ) IS DISTINCT FROM (
       SELECT COALESCE(array_agg(x ORDER BY x), ARRAY[]::text[])
         FROM unnest(sp.skills) AS x
     )
  `);

  const report = {
    w4bCutoverTime: raw ?? null,
    legacyStudentProfileMirror: isLegacyStudentProfileMirrorEnabled() ? "on" : "off",
    studentProfileMissingCandidateProfile: spMissingCp,
    referralCollision,
    referralMismatch,
    frozenStudentProfileNameDrift,
    frozenStudentProfilePhoneDrift,
    frozenStudentProfileSkillDrift,
    note: "CP≠SP identity drift is expected after W4-B. Do not remirror.",
  };
  console.log(JSON.stringify(report, null, 2));

  if (spMissingCp !== 0) {
    throw new Error("W4-B: StudentProfile rows missing CandidateProfile");
  }
  if (referralCollision !== 0 || referralMismatch !== 0) {
    throw new Error("W4-B: referral identity is not unique/aligned");
  }
  console.log("W4-B sentinel finished (frozen identity drift is informational).");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
