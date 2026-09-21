/**
 * Targeted W4-A repair: StudentProfile exists, CandidateProfile missing.
 *
 * Source-preserving copy via dualWriteCandidateIdentity (historical exception).
 * Does not mint a new referral code. Does not overwrite existing Candidate*.
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
  const { dualWriteCandidateIdentity } = await import(
    "../../src/repositories/dual-write"
  );
  const prisma = writeClient();

  const gaps = await prisma.$queryRaw<
    Array<{ userId: string; email: string | null; referralCode: string }>
  >`
    SELECT sp."userId", u.email, sp."referralCode"
      FROM "StudentProfile" sp
      JOIN "User" u ON u.id = sp."userId"
      LEFT JOIN "CandidateProfile" cp ON cp."userId" = sp."userId"
     WHERE cp.id IS NULL
       AND u."deletedAt" IS NULL
       AND u.role = 'STUDENT'
  `;

  const repaired: string[] = [];
  for (const row of gaps) {
    await prisma.$transaction(async (tx) => {
      const exists = await tx.candidateProfile.findUnique({
        where: { userId: row.userId },
        select: { userId: true },
      });
      if (exists) return;
      await dualWriteCandidateIdentity(tx, row.userId);
    });
    const cp = await prisma.candidateProfile.findUnique({
      where: { userId: row.userId },
      select: { referralCode: true },
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

  console.log(
    JSON.stringify(
      { gapCount: gaps.length, repaired },
      null,
      2,
    ),
  );
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
