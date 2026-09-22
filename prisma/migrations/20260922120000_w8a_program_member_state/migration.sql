-- W8-A additive ProgramEnrollment AI-cohort score/recommendation snapshot.
-- Does not freeze or drop ProgramMember. Does not disable dual-write.

ALTER TABLE "ProgramEnrollment"
  ADD COLUMN "missionPoints" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "conceptPoints" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "commitPoints" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "projectPoints" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "totalScore" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "cleanPassCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "aiRecommendation" TEXT,
  ADD COLUMN "aiRecommendationAt" TIMESTAMP(3);
