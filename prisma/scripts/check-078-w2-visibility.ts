/**
 * W2 recruiter-visibility comparison (read-only).
 *
 * Child by default. Production: PHASE2_ALLOW_PRODUCTION=1 + direct host.
 * Does not mutate. Does not enable ENABLE_NEW_VISIBILITY_WRITES.
 *
 * Leak definition after plan 117/133:
 *   searchable, no ProgramMember, consentSource is not a platform default
 *   (`platform_default` or `platform_default_profile`).
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

async function main() {
  assertChildBranch();

  const counts = await prisma.$queryRawUnsafe<Array<Record<string, bigint | number>>>(`
    SELECT
      (SELECT COUNT(*)::int FROM "CandidateVisibility") AS total_rows,
      (SELECT COUNT(*)::int FROM "CandidateVisibility" v
        WHERE v."searchableByRecruiters" AND v."withdrawnAt" IS NULL) AS searchable_rows,
      (SELECT COUNT(*)::int FROM "CandidateVisibility" v
        WHERE v."withdrawnAt" IS NOT NULL) AS withdrawn_rows,
      (SELECT COUNT(*)::int FROM "CandidateVisibility" v
        WHERE v."searchableByRecruiters" AND v."withdrawnAt" IS NULL
          AND EXISTS (SELECT 1 FROM "ProgramMember" m WHERE m."userId" = v."userId"))
        AS searchable_program_members,
      (SELECT COUNT(*)::int FROM "CandidateVisibility" v
        WHERE v."searchableByRecruiters" AND v."withdrawnAt" IS NULL
          AND NOT EXISTS (SELECT 1 FROM "ProgramMember" m WHERE m."userId" = v."userId"))
        AS searchable_non_program_members,
      (SELECT COUNT(*)::int FROM "CandidateVisibility" v
        WHERE v."searchableByRecruiters" AND v."withdrawnAt" IS NULL
          AND NOT EXISTS (SELECT 1 FROM "CandidateProfile" cp WHERE cp."userId" = v."userId"))
        AS searchable_missing_candidate_profile,
      (SELECT COUNT(*)::int FROM "CandidateVisibility" v
        WHERE v."searchableByRecruiters" AND v."withdrawnAt" IS NULL
          AND EXISTS (
            SELECT 1 FROM "ProgramMember" m
             WHERE m."userId" = v."userId" AND m."recruiterVisibilityConsentAt" IS NOT NULL))
        AS searchable_with_legacy_consent,
      (SELECT COUNT(DISTINCT m."userId")::int FROM "ProgramMember" m
        WHERE m."recruiterVisibilityConsentAt" IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM "CandidateVisibility" v WHERE v."userId" = m."userId"))
        AS legacy_consent_without_visibility,
      (SELECT COUNT(*)::int FROM "CandidateVisibility" v
        WHERE v."searchableByRecruiters"
          AND v."consentSource" IS DISTINCT FROM 'platform_default'
          AND v."consentSource" IS DISTINCT FROM 'platform_default_profile'
          AND NOT EXISTS (SELECT 1 FROM "ProgramMember" m WHERE m."userId" = v."userId"))
        AS visibility_leak,
      (SELECT COUNT(*)::int FROM "CandidateVisibility" v
        WHERE v."searchableByRecruiters" AND v."withdrawnAt" IS NOT NULL)
        AS withdrawn_but_searchable_flag,
      (SELECT COUNT(*)::int FROM "CandidateVisibility" v
        WHERE v."consentSource" = 'platform_default_profile') AS consent_source_profile_default
  `);
  const row = counts[0] ?? {};
  const n = (k: string) => Number(row[k] ?? 0);
  const report = {
    totalCandidateVisibilityRows: n("total_rows"),
    searchableRows: n("searchable_rows"),
    withdrawnRows: n("withdrawn_rows"),
    searchableProgramMembers: n("searchable_program_members"),
    searchableNonProgramMembers: n("searchable_non_program_members"),
    searchableMissingCandidateProfile: n("searchable_missing_candidate_profile"),
    searchableWithLegacyConsent: n("searchable_with_legacy_consent"),
    legacyConsentWithoutCandidateVisibility: n("legacy_consent_without_visibility"),
    visibilityLeak: n("visibility_leak"),
    withdrawnCandidatesExposed: n("withdrawn_but_searchable_flag"),
    consentSourceProfileDefault: n("consent_source_profile_default"),
  };
  console.log(JSON.stringify(report, null, 2));

  const failures: string[] = [];
  if (report.visibilityLeak !== 0) failures.push("visibilityLeak");
  if (report.withdrawnCandidatesExposed !== 0) failures.push("withdrawnCandidatesExposed");
  if (failures.length > 0) {
    throw new Error(`W2 visibility comparison failed: ${failures.join(", ")}`);
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
