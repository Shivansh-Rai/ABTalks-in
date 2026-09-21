/**
 * W3 Credential comparison (read-only).
 *
 * Mirror ON (ENABLE_LEGACY_CERTIFICATE_MIRROR !== "false"):
 *   Certificate ↔ Credential parity is a gate.
 *
 * Mirror OFF (ENABLE_LEGACY_CERTIFICATE_MIRROR=false):
 *   Credential uniqueness/semantic gates remain.
 *   credentialMissingCertificate is expected for post-cutover issues
 *   and is informational. Certificate missing Credential is still a gate.
 *
 * Child by default. Production: PHASE2_ALLOW_PRODUCTION=1 + direct host.
 * Does not mutate. Does not enable write flags.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

if (process.env.DATABASE_URL?.includes("-pooler.")) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace("-pooler.", ".");
}

import { PrismaClient } from "@prisma/client";
import { isLegacyCertificateMirrorEnabled } from "../../src/lib/feature-flags";
import { assertChildBranch } from "./migrate-078-shared";

const prisma = new PrismaClient();

function n(rows: Array<{ n: bigint | number }>): number {
  return Number(rows[0]?.n ?? 0);
}

async function main() {
  assertChildBranch();

  const certificateCount = n(
    await prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint AS n FROM "Certificate"`,
  );
  const credentialCount = n(
    await prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint AS n FROM "Credential"`,
  );

  const certMissingCredential = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
      FROM "Certificate" c
      LEFT JOIN "Credential" cr ON cr."credentialId" = c."certificateId"
     WHERE cr.id IS NULL
  `);

  const credMissingCertificate = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
      FROM "Credential" cr
      LEFT JOIN "Certificate" c ON c."certificateId" = cr."credentialId"
     WHERE c.id IS NULL
  `);

  const userMismatch = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
      FROM "Certificate" c
      JOIN "Credential" cr ON cr."credentialId" = c."certificateId"
     WHERE c."userId" <> cr."userId"
  `);

  const typeMismatch = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
      FROM "Certificate" c
      JOIN "Credential" cr ON cr."credentialId" = c."certificateId"
     WHERE cr.type <> (
       CASE
         WHEN c.type = 'HACKATHON' AND c.metadata ? 'hackathonVariant'
           AND jsonb_typeof(c.metadata->'hackathonVariant') = 'string'
           THEN 'PLACEMENT'::"CredentialType"
         WHEN c.type = 'HACKATHON' THEN 'PARTICIPATION'::"CredentialType"
         WHEN c.type = 'WORKSHOP' THEN 'PARTICIPATION'::"CredentialType"
         ELSE 'COMPLETION'::"CredentialType"
       END
     )
  `);

  const statusMismatch = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
      FROM "Certificate" c
      JOIN "Credential" cr ON cr."credentialId" = c."certificateId"
     WHERE c.status::text <> cr.status::text
  `);

  const recipientMismatch = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
      FROM "Certificate" c
      JOIN "Credential" cr ON cr."credentialId" = c."certificateId"
     WHERE c."recipientName" <> cr."recipientName"
  `);

  const issuedAtMismatch = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
      FROM "Certificate" c
      JOIN "Credential" cr ON cr."credentialId" = c."certificateId"
     WHERE c."issuedAt" <> cr."issuedAt"
  `);

  const titleMismatch = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
      FROM "Certificate" c
      JOIN "Credential" cr ON cr."credentialId" = c."certificateId"
     WHERE cr.title <> c.type::text
  `);

  const duplicatePublicIds = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n FROM (
      SELECT "credentialId" FROM "Credential" GROUP BY "credentialId" HAVING COUNT(*) > 1
    ) q
  `);

  const duplicateSourceKeys = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n FROM (
      SELECT type, "sourceType", "sourceKey"
        FROM "Credential"
       GROUP BY type, "sourceType", "sourceKey"
      HAVING COUNT(*) > 1
    ) q
  `);

  const sourceKeyMappingDrift = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
      FROM "Certificate" c
      JOIN "Credential" cr ON cr."credentialId" = c."certificateId"
     WHERE cr."sourceKey" IS DISTINCT FROM (
       CASE
         WHEN c.type = 'HACKATHON' AND c.metadata ? 'teamId'
           AND jsonb_typeof(c.metadata->'teamId') = 'string'
           THEN (c.metadata->>'teamId') || ':' || c.id
         WHEN c."enrollmentId" IS NOT NULL THEN 'pe_enr_' || c."enrollmentId"
         ELSE c.id
       END
     )
  `);

  const invalidCredentialRows = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
      FROM "Credential"
     WHERE "credentialId" = ''
        OR "sourceKey" = ''
        OR "recipientName" = ''
  `);

  const mirrorOn = isLegacyCertificateMirrorEnabled();
  const report = {
    legacyCertificateMirror: mirrorOn ? "on" : "off",
    certificateCount,
    credentialCount,
    certificateMissingCredential: certMissingCredential,
    credentialMissingCertificate: credMissingCertificate,
    publicIdMismatch:
      certMissingCredential + (mirrorOn ? credMissingCertificate : 0),
    userMismatch,
    typeMismatch,
    statusMismatch,
    recipientMismatch,
    issuedAtMismatch,
    titleMismatch,
    duplicatePublicIds,
    duplicateSourceKeys,
    sourceKeyMappingDrift,
    invalidCredentialRows,
    postW3bCredentialsWithoutCertificate: mirrorOn ? 0 : credMissingCertificate,
  };
  console.log(JSON.stringify(report, null, 2));

  const blocking = [
    certMissingCredential,
    userMismatch,
    typeMismatch,
    statusMismatch,
    recipientMismatch,
    issuedAtMismatch,
    titleMismatch,
    duplicatePublicIds,
    duplicateSourceKeys,
    invalidCredentialRows,
  ];
  if (mirrorOn) blocking.push(credMissingCertificate);
  if (blocking.some((v) => v !== 0)) {
    throw new Error("W3 credential recon failed: missing or semantic mismatch is non-zero");
  }
  console.log(
    mirrorOn
      ? "W3 credential recon passed (sourceKeyMappingDrift is informational)."
      : "W3-B credential recon passed (Credential-without-Certificate is expected).",
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
