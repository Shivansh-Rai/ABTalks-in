/**
 * Targeted W4-A repair: StudentProfile exists, CandidateProfile missing.
 *
 * Source-preserving copy of identity/referral only. Does not mint a new
 * referral code. Does not overwrite existing Candidate* rows.
 * Child by default. Production: PHASE2_ALLOW_PRODUCTION=1.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

if (process.env.DATABASE_URL?.includes("-pooler.")) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace("-pooler.", ".");
}
process.env.DIRECT_URL = process.env.DATABASE_URL;

import { assertChildBranch } from "./migrate-078-shared";

async function main() {
  assertChildBranch();
  const { writeClient } = await import("../../src/lib/db");
  const { personaFromUserType, educationIdForStudentProfile } = await import(
    "../../src/repositories/dual-write"
  );
  const prisma = writeClient();

  const gaps = await prisma.$queryRaw<
    Array<{
      userId: string;
      email: string | null;
      referralCode: string;
      fullName: string;
      userType: "STUDENT" | "PROFESSIONAL";
      phone: string | null;
      phoneVerified: boolean;
      phoneVerifiedAt: Date | null;
      linkedinUrl: string | null;
      githubUsername: string | null;
      resumeUrl: string | null;
      isReadyForInterview: boolean;
      college: string | null;
      collegeId: string | null;
      graduationYear: number | null;
    }>
  >`
    SELECT
      sp."userId",
      u.email,
      sp."referralCode",
      sp."fullName",
      sp."userType"::text AS "userType",
      sp.phone,
      sp."phoneVerified",
      sp."phoneVerifiedAt",
      sp."linkedinUrl",
      sp."githubUsername",
      sp."resumeUrl",
      sp."isReadyForInterview",
      sp.college,
      sp."collegeId",
      sp."graduationYear"
      FROM "StudentProfile" sp
      JOIN "User" u ON u.id = sp."userId"
      LEFT JOIN "CandidateProfile" cp ON cp."userId" = sp."userId"
     WHERE cp.id IS NULL
       AND u."deletedAt" IS NULL
       AND u.role = 'STUDENT'
  `;

  const repaired: string[] = [];
  for (const row of gaps) {
    await prisma.$transaction(
      async (tx) => {
        const exists = await tx.candidateProfile.findUnique({
          where: { userId: row.userId },
          select: { userId: true },
        });
        if (exists) return;
        await tx.candidateProfile.create({
          data: {
            id: `cp_${row.userId}`,
            userId: row.userId,
            fullName: row.fullName,
            primaryPersona: personaFromUserType(row.userType),
            phone: row.phone,
            phoneVerified: row.phoneVerified,
            phoneVerifiedAt: row.phoneVerifiedAt,
            linkedinUrl: row.linkedinUrl,
            githubUsername: row.githubUsername,
            resumeUrl: row.resumeUrl,
            referralCode: row.referralCode,
            isReadyForInterview: row.isReadyForInterview,
          },
        });
        if (row.college) {
          await tx.candidateEducation.create({
            data: {
              id: educationIdForStudentProfile(row.userId),
              userId: row.userId,
              institutionName: row.college,
              collegeId: row.collegeId,
              graduationYear: row.graduationYear,
              sortOrder: 0,
            },
          });
        }
      },
      { maxWait: 10000, timeout: 20000 },
    );
    const cp = await prisma.candidateProfile.findUnique({
      where: { userId: row.userId },
      select: { referralCode: true, fullName: true },
    });
    if (!cp) {
      throw new Error(`repair failed for ${row.email ?? row.userId}`);
    }
    if (cp.referralCode !== row.referralCode) {
      throw new Error(
        `repair reminted referral for ${row.email ?? row.userId}`,
      );
    }
    repaired.push(row.email ?? row.userId);
  }

  console.log(JSON.stringify({ gapCount: gaps.length, repaired }, null, 2));
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
