-- Plan 117. Two additive enum values. No table is rewritten and no row changes.
--
-- 1. TalentCandidateSource.PROFILE — candidates who are discoverable from their
--    profile alone (searchable, not withdrawn, at least one claimed skill) and
--    have no cohort, challenge or hackathon record. Without this value their
--    matches and engagement requests cannot be WRITTEN, because
--    `persistableSource` narrows against this enum on purpose.
--
-- 2. TalentEmploymentType.FREELANCE — the fifth engagement type. The candidate
--    side (`OpportunityType`) has always had all five; the recruiter side was
--    missing this one, so a recruiter asking for freelancers was parsed to
--    nothing and silently ignored.
--
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block on PostgreSQL
-- versions before 12; Neon is well past that, and Prisma issues these outside a
-- transaction anyway.

ALTER TYPE "TalentCandidateSource" ADD VALUE IF NOT EXISTS 'PROFILE';
ALTER TYPE "TalentEmploymentType" ADD VALUE IF NOT EXISTS 'FREELANCE';
