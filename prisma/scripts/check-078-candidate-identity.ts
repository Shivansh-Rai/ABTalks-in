/**
 * W4-A candidate identity reconciliation (read-only).
 *
 * Does not mutate. Does not enable write flags.
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
  isLegacyStudentProfileMirrorEnabled,
  isNewCandidateWritesEnabled,
} from "../../src/lib/feature-flags";
import { assertChildBranch } from "./migrate-078-shared";

const prisma = new PrismaClient();

function n(rows: Array<{ n: bigint | number }>): number {
  return Number(rows[0]?.n ?? 0);
}

async function main() {
  assertChildBranch();

  const studentProfileCount = n(
    await prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint AS n FROM "StudentProfile"`,
  );
  const candidateProfileCount = n(
    await prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint AS n FROM "CandidateProfile"`,
  );

  const spMissingCp = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
      FROM "StudentProfile" sp
      LEFT JOIN "CandidateProfile" cp ON cp."userId" = sp."userId"
     WHERE cp.id IS NULL
  `);

  const cpMissingSp = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
      FROM "CandidateProfile" cp
      LEFT JOIN "StudentProfile" sp ON sp."userId" = cp."userId"
     WHERE sp.id IS NULL
  `);

  const missingRows = await prisma.$queryRaw<
    Array<{
      userId: string;
      email: string | null;
      role: string;
      deletedAt: Date | null;
      userCreatedAt: Date;
      spCreatedAt: Date;
      fullName: string;
      referralCode: string;
      phone: string | null;
      college: string | null;
      organization: string | null;
      skillCount: number;
      hasEnrollment: boolean;
      hasProgramMember: boolean;
      hasProgramEnrollment: boolean;
      hasRecruiter: boolean;
    }>
  >`
    SELECT
      sp."userId",
      u.email,
      u.role::text,
      u."deletedAt",
      u."createdAt" AS "userCreatedAt",
      sp."createdAt" AS "spCreatedAt",
      sp."fullName",
      sp."referralCode",
      sp.phone,
      sp.college,
      sp.organization,
      COALESCE(array_length(sp.skills, 1), 0)::int AS "skillCount",
      EXISTS (SELECT 1 FROM "Enrollment" e WHERE e."userId" = sp."userId") AS "hasEnrollment",
      EXISTS (SELECT 1 FROM "ProgramMember" m WHERE m."userId" = sp."userId") AS "hasProgramMember",
      EXISTS (SELECT 1 FROM "ProgramEnrollment" pe WHERE pe."userId" = sp."userId") AS "hasProgramEnrollment",
      EXISTS (SELECT 1 FROM "RecruiterProfile" rp WHERE rp."userId" = sp."userId") AS "hasRecruiter"
    FROM "StudentProfile" sp
    JOIN "User" u ON u.id = sp."userId"
    LEFT JOIN "CandidateProfile" cp ON cp."userId" = sp."userId"
    WHERE cp.id IS NULL
    ORDER BY sp."createdAt" ASC
  `;

  const missingClassified = missingRows.map((row) => {
    const email = (row.email ?? "").toLowerCase();
    let classification = "historical_migration_gap";
    if (row.deletedAt) classification = "deleted_user";
    else if (email.endsWith("@abtalks.dev") || email.endsWith("@abtalks.internal")) {
      classification = "system_test_account";
    } else if (row.hasRecruiter || row.role === "RECRUITER") {
      classification = "intentionally_non_candidate";
    } else if (
      !row.hasEnrollment &&
      !row.hasProgramMember &&
      !row.hasProgramEnrollment &&
      row.skillCount === 0 &&
      !row.college &&
      !row.organization
    ) {
      classification = "incomplete_registration";
    } else if (row.hasEnrollment || row.hasProgramMember || row.hasProgramEnrollment) {
      classification = "historical_migration_gap";
    }
    return { ...row, classification };
  });

  const referralMismatch = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
      FROM "StudentProfile" sp
      JOIN "CandidateProfile" cp ON cp."userId" = sp."userId"
     WHERE sp."referralCode" <> cp."referralCode"
  `);

  const referralCollision = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n FROM (
      SELECT sp."referralCode"
        FROM "StudentProfile" sp
        JOIN "CandidateProfile" cp ON cp."referralCode" = sp."referralCode"
       WHERE cp."userId" <> sp."userId"
    ) q
  `);

  const orphanSpReferralTakenByOtherCandidate = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
      FROM "StudentProfile" sp
      LEFT JOIN "CandidateProfile" own ON own."userId" = sp."userId"
      JOIN "CandidateProfile" other
        ON other."referralCode" = sp."referralCode"
       AND other."userId" <> sp."userId"
     WHERE own.id IS NULL
  `);

  const nameMismatch = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
      FROM "StudentProfile" sp
      JOIN "CandidateProfile" cp ON cp."userId" = sp."userId"
     WHERE sp."fullName" IS DISTINCT FROM cp."fullName"
  `);

  const phoneMismatch = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
      FROM "StudentProfile" sp
      JOIN "CandidateProfile" cp ON cp."userId" = sp."userId"
     WHERE sp.phone IS DISTINCT FROM cp.phone
  `);

  const linkedinMismatch = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
      FROM "StudentProfile" sp
      JOIN "CandidateProfile" cp ON cp."userId" = sp."userId"
     WHERE sp."linkedinUrl" IS DISTINCT FROM cp."linkedinUrl"
  `);

  const githubMismatch = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
      FROM "StudentProfile" sp
      JOIN "CandidateProfile" cp ON cp."userId" = sp."userId"
     WHERE sp."githubUsername" IS DISTINCT FROM cp."githubUsername"
  `);

  const resumeMismatch = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
      FROM "StudentProfile" sp
      JOIN "CandidateProfile" cp ON cp."userId" = sp."userId"
     WHERE sp."resumeUrl" IS DISTINCT FROM cp."resumeUrl"
  `);

  const claimedSkillMirrorMismatch = n(await prisma.$queryRaw<{ n: bigint }[]>`
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

  // Lossy-flatten diffs: SP holds one primary row. Informational, not a fail.
  const primaryEducationMirrorMismatch = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
      FROM "StudentProfile" sp
      JOIN "CandidateProfile" cp ON cp."userId" = sp."userId"
      LEFT JOIN LATERAL (
        SELECT ce."institutionName"
          FROM "CandidateEducation" ce
         WHERE ce."userId" = sp."userId"
         ORDER BY
           CASE WHEN ce."isCurrent" THEN 0 ELSE 1 END,
           COALESCE(ce."graduationYear", 0) DESC,
           ce."sortOrder" ASC
         LIMIT 1
      ) pri ON true
     WHERE COALESCE(sp.college, '') IS DISTINCT FROM COALESCE(pri."institutionName", '')
  `);

  const primaryExperienceMirrorMismatch = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
      FROM "StudentProfile" sp
      JOIN "CandidateProfile" cp ON cp."userId" = sp."userId"
      LEFT JOIN LATERAL (
        SELECT ex."companyName"
          FROM "CandidateExperience" ex
         WHERE ex."userId" = sp."userId"
         ORDER BY
           CASE WHEN ex."isCurrent" THEN 0 ELSE 1 END,
           COALESCE(ex."endedOn", DATE '9999-12-31') DESC,
           ex."startedOn" DESC
         LIMIT 1
      ) pri ON true
     WHERE COALESCE(sp.organization, '') IS DISTINCT FROM COALESCE(pri."companyName", '')
  `);

  const tracker = await prisma.$queryRaw<
    Array<{
      userId: string;
      email: string | null;
      userCreatedAt: Date;
      deletedAt: Date | null;
      role: string;
      spId: string | null;
      spCreatedAt: Date | null;
      cpId: string | null;
      enrollmentCount: number;
      programMemberCount: number;
      programEnrollmentCount: number;
      visibility: boolean | null;
      spFullName: string | null;
      spPhone: string | null;
      spCollege: string | null;
      spReferral: string | null;
      spSkills: number;
    }>
  >`
    SELECT
      u.id AS "userId",
      u.email,
      u."createdAt" AS "userCreatedAt",
      u."deletedAt",
      u.role::text,
      sp.id AS "spId",
      sp."createdAt" AS "spCreatedAt",
      cp.id AS "cpId",
      (SELECT COUNT(*)::int FROM "Enrollment" e WHERE e."userId" = u.id) AS "enrollmentCount",
      (SELECT COUNT(*)::int FROM "ProgramMember" m WHERE m."userId" = u.id) AS "programMemberCount",
      (SELECT COUNT(*)::int FROM "ProgramEnrollment" pe WHERE pe."userId" = u.id) AS "programEnrollmentCount",
      v."searchableByRecruiters" AS visibility,
      sp."fullName" AS "spFullName",
      sp.phone AS "spPhone",
      sp.college AS "spCollege",
      sp."referralCode" AS "spReferral",
      COALESCE(array_length(sp.skills, 1), 0)::int AS "spSkills"
    FROM "User" u
    LEFT JOIN "StudentProfile" sp ON sp."userId" = u.id
    LEFT JOIN "CandidateProfile" cp ON cp."userId" = u.id
    LEFT JOIN "CandidateVisibility" v ON v."userId" = u.id
    WHERE lower(u.email) = 'tracker.abtalks@gmail.com'
  `;

  const trackerCodeOnOtherCandidate =
    tracker[0]?.spReferral != null
      ? n(
          await prisma.$queryRaw<{ n: bigint }[]>`
            SELECT COUNT(*)::bigint AS n
              FROM "CandidateProfile"
             WHERE "referralCode" = ${tracker[0].spReferral}
               AND "userId" <> ${tracker[0].userId}
          `,
        )
      : 0;

  const report = {
    newCandidateWrites: isNewCandidateWritesEnabled() ? "on" : "off",
    legacyStudentProfileMirror: isLegacyStudentProfileMirrorEnabled() ? "on" : "off",
    studentProfileCount,
    candidateProfileCount,
    studentProfileMissingCandidateProfile: spMissingCp,
    candidateProfileMissingStudentProfile: cpMissingSp,
    referralMismatch,
    referralCollision,
    orphanSpReferralTakenByOtherCandidate,
    nameMismatch,
    phoneMismatch,
    linkedinMismatch,
    githubMismatch,
    resumeMismatch,
    claimedSkillMirrorMismatch,
    primaryEducationMirrorMismatch,
    primaryExperienceMirrorMismatch,
    missingCandidateProfileClassified: missingClassified,
    missingByClassification: missingClassified.reduce<Record<string, number>>(
      (acc, row) => {
        acc[row.classification] = (acc[row.classification] ?? 0) + 1;
        return acc;
      },
      {},
    ),
    trackerAbtalks: tracker[0]
      ? {
          ...tracker[0],
          referralTakenByOtherCandidate: trackerCodeOnOtherCandidate > 0,
        }
      : null,
  };
  console.log(JSON.stringify(report, (_, v) => (typeof v === "bigint" ? Number(v) : v), 2));

  if (referralMismatch !== 0 || referralCollision !== 0) {
    throw new Error("W4-A referral identity is not unique/aligned");
  }
  console.log(
    "W4-A candidate identity recon finished (SP↔CP presence and lossy field diffs are informational).",
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
