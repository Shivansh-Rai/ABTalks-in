-- Professionals' current / expected CTC on the profile wizard, each with its
-- own currency (INR or USD). Additive and nullable: no backfill, no rewrite.
ALTER TABLE "CandidatePreference"
  ADD COLUMN "currentCtc" INTEGER,
  ADD COLUMN "currentCtcCurrency" CHAR(3),
  ADD COLUMN "expectedCtc" INTEGER,
  ADD COLUMN "expectedCtcCurrency" CHAR(3);
