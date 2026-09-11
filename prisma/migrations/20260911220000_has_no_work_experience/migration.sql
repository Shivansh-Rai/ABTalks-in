-- Explicit fresher skip for profile completion. Additive, default false,
-- zero-downtime. Existing rows stay "not a skip" until the candidate opts in.
-- Completeness scoring ignores this flag whenever any experience row exists.

ALTER TABLE "CandidateProfile" ADD COLUMN "hasNoWorkExperience" BOOLEAN NOT NULL DEFAULT false;
