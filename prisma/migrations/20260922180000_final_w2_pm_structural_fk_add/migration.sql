-- 078 final Wave 2 additive: canonical programEnrollmentId / candidateUserId
-- alongside existing ProgramMember FKs. No drops. No FKs on the new columns
-- until backfill proves missing = 0.

ALTER TABLE "ProgramMissionSubmission"
  ADD COLUMN "programEnrollmentId" TEXT;
CREATE INDEX "ProgramMissionSubmission_programEnrollmentId_idx"
  ON "ProgramMissionSubmission"("programEnrollmentId");

ALTER TABLE "ProgramConceptAttempt"
  ADD COLUMN "programEnrollmentId" TEXT;
CREATE INDEX "ProgramConceptAttempt_programEnrollmentId_idx"
  ON "ProgramConceptAttempt"("programEnrollmentId");

ALTER TABLE "ProgramExerciseCompletion"
  ADD COLUMN "programEnrollmentId" TEXT;
CREATE INDEX "ProgramExerciseCompletion_programEnrollmentId_idx"
  ON "ProgramExerciseCompletion"("programEnrollmentId");

ALTER TABLE "ProgramCommitDay"
  ADD COLUMN "programEnrollmentId" TEXT;
CREATE INDEX "ProgramCommitDay_programEnrollmentId_idx"
  ON "ProgramCommitDay"("programEnrollmentId");

ALTER TABLE "ProgramProject"
  ADD COLUMN "programEnrollmentId" TEXT;
CREATE INDEX "ProgramProject_programEnrollmentId_idx"
  ON "ProgramProject"("programEnrollmentId");

ALTER TABLE "ProgramInterview"
  ADD COLUMN "programEnrollmentId" TEXT;
CREATE INDEX "ProgramInterview_programEnrollmentId_idx"
  ON "ProgramInterview"("programEnrollmentId");

ALTER TABLE "GeneralInterview"
  ADD COLUMN "programEnrollmentId" TEXT;
CREATE INDEX "GeneralInterview_programEnrollmentId_idx"
  ON "GeneralInterview"("programEnrollmentId");

ALTER TABLE "RecruiterShortlistItem"
  ADD COLUMN "candidateUserId" TEXT;
CREATE INDEX "RecruiterShortlistItem_candidateUserId_idx"
  ON "RecruiterShortlistItem"("candidateUserId");
