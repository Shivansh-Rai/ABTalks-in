/**
 * Read-only W3-B admin provenance comparison. Production or child.
 * Does not mutate.
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

  const cohortWorkshop = await prisma.$queryRaw<
    Array<{
      sourceType: string;
      n: bigint;
      source_key_is_certificate_id: bigint;
      source_key_not_certificate_id: bigint;
    }>
  >`
    SELECT
      cr."sourceType"::text AS "sourceType",
      COUNT(*)::bigint AS n,
      COUNT(*) FILTER (WHERE cert.id IS NOT NULL)::bigint AS source_key_is_certificate_id,
      COUNT(*) FILTER (WHERE cert.id IS NULL)::bigint AS source_key_not_certificate_id
    FROM "Credential" cr
    LEFT JOIN "Certificate" cert ON cert.id = cr."sourceKey"
    WHERE cr."sourceType" IN ('COHORT', 'WORKSHOP_REGISTRATION')
    GROUP BY cr."sourceType"
  `;

  const hackathonKeys = await prisma.$queryRaw<
    Array<{ mapping: string; n: bigint }>
  >`
    SELECT
      CASE
        WHEN cardinality(string_to_array(cr."sourceKey", ':')) = 2 THEN 'historical_team_cert'
        WHEN cardinality(string_to_array(cr."sourceKey", ':')) = 4 THEN 'w3_stable'
        ELSE 'other'
      END AS mapping,
      COUNT(*)::bigint AS n
    FROM "Credential" cr
    WHERE cr."sourceType" = 'HACKATHON_TEAM'
    GROUP BY 1
  `;

  const evidenceCred = await prisma.$queryRaw<
    Array<{
      n: bigint;
      matches_credential_pk: bigint;
      matches_certificate_pk: bigint;
    }>
  >`
    SELECT
      COUNT(*)::bigint AS n,
      COUNT(*) FILTER (WHERE cr.id IS NOT NULL)::bigint AS matches_credential_pk,
      COUNT(*) FILTER (WHERE cert.id IS NOT NULL)::bigint AS matches_certificate_pk
    FROM "SkillEvidence" se
    LEFT JOIN "Credential" cr ON cr.id = se."sourceId"
    LEFT JOIN "Certificate" cert ON cert.id = se."sourceId"
    WHERE se."sourceType" = 'CREDENTIAL'
  `;

  const historicalHackathonCertMissing = n(await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
      FROM "Credential" cr
     WHERE cr."sourceType" = 'HACKATHON_TEAM'
       AND cardinality(string_to_array(cr."sourceKey", ':')) = 2
       AND NOT EXISTS (
         SELECT 1 FROM "Certificate" cert
          WHERE cert.id = split_part(cr."sourceKey", ':', 2)
       )
  `);

  console.log(
    JSON.stringify(
      {
        cohortWorkshop,
        hackathonKeys,
        skillEvidenceCredential: evidenceCred[0] ?? null,
        historicalHackathonCertMissing,
      },
      (_, v) => (typeof v === "bigint" ? Number(v) : v),
      2,
    ),
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
