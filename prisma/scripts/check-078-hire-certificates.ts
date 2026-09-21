/**
 * W3-B /hire Certificate vs Credential comparison (read-only).
 *
 * Semantic: challenge enrollment has an ISSUED completion credential.
 * Legacy: Enrollment.certificate.status === ISSUED
 * New: Credential COMPLETION + PROGRAM_ENROLLMENT + pe_enr_{enrollmentId} + ISSUED
 *
 * Does not mutate. Does not enable write flags.
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

function n(rows: Array<{ n: bigint | number }>): number {
  return Number(rows[0]?.n ?? 0);
}

async function main() {
  assertChildBranch();

  const certIssuedNotCredential = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
      FROM "Certificate" c
     WHERE c."enrollmentId" IS NOT NULL
       AND c.status = 'ISSUED'
       AND NOT EXISTS (
         SELECT 1 FROM "Credential" cr
          WHERE cr."sourceType" = 'PROGRAM_ENROLLMENT'
            AND cr.type = 'COMPLETION'
            AND cr.status = 'ISSUED'
            AND cr."sourceKey" = 'pe_enr_' || c."enrollmentId"
       )
  `);

  const credentialIssuedNotCert = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
      FROM "Credential" cr
     WHERE cr."sourceType" = 'PROGRAM_ENROLLMENT'
       AND cr.type = 'COMPLETION'
       AND cr.status = 'ISSUED'
       AND cr."sourceKey" LIKE 'pe_enr_%'
       AND NOT EXISTS (
         SELECT 1 FROM "Certificate" c
          WHERE c."enrollmentId" = substring(cr."sourceKey" from 8)
            AND c.status = 'ISSUED'
       )
  `);

  const statusMismatch = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
      FROM "Certificate" c
      JOIN "Credential" cr
        ON cr."sourceKey" = 'pe_enr_' || c."enrollmentId"
       AND cr."sourceType" = 'PROGRAM_ENROLLMENT'
       AND cr.type = 'COMPLETION'
     WHERE c."enrollmentId" IS NOT NULL
       AND c.status::text <> cr.status::text
  `);

  const report = {
    challengeCertIssuedMissingCredential: certIssuedNotCredential,
    challengeCredentialIssuedMissingCertificate: credentialIssuedNotCert,
    challengeStatusMismatch: statusMismatch,
  };
  console.log(JSON.stringify(report, null, 2));

  if (
    certIssuedNotCredential !== 0 ||
    credentialIssuedNotCert !== 0 ||
    statusMismatch !== 0
  ) {
    throw new Error("hire Certificate vs Credential comparison has unexpected differences");
  }
  console.log("W3-B hire Certificate vs Credential comparison passed.");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
