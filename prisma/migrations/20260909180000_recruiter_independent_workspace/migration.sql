-- T-226: a recruiter's setup can be interrupted and resumed, so the profile has
-- to remember where it got to.
CREATE TYPE "RecruiterSetupStep" AS ENUM ('PROFILE', 'COMPANY', 'COMPLETE');

ALTER TABLE "RecruiterProfile"
  ADD COLUMN "setupStep" "RecruiterSetupStep" NOT NULL DEFAULT 'PROFILE',
  ADD COLUMN "setupCompletedAt" TIMESTAMP(3);

-- Every recruiter that already exists has a working account and must not be
-- dropped into a setup wizard on their next sign-in. The default above is for
-- rows created from here on, not for history.
UPDATE "RecruiterProfile"
SET "setupStep" = 'COMPLETE',
    "setupCompletedAt" = "createdAt"
WHERE "setupCompletedAt" IS NULL;
