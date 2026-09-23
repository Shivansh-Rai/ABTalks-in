-- 078 final Wave 2b: canonical FKs to ProgramEnrollment / User.
-- Requires Wave 2 additive backfill missing = 0. Does not drop memberId.

ALTER TABLE "ProgramCommitDay"
  ALTER COLUMN "programEnrollmentId" SET NOT NULL;
ALTER TABLE "ProgramCommitDay"
  ADD CONSTRAINT "ProgramCommitDay_programEnrollmentId_fkey"
  FOREIGN KEY ("programEnrollmentId") REFERENCES "ProgramEnrollment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "ProgramCommitDay_programEnrollmentId_date_key"
  ON "ProgramCommitDay"("programEnrollmentId", "date");

ALTER TABLE "ProgramInterview"
  ALTER COLUMN "programEnrollmentId" SET NOT NULL;
ALTER TABLE "ProgramInterview"
  ADD CONSTRAINT "ProgramInterview_programEnrollmentId_fkey"
  FOREIGN KEY ("programEnrollmentId") REFERENCES "ProgramEnrollment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "ProgramInterview_programEnrollmentId_key"
  ON "ProgramInterview"("programEnrollmentId");

ALTER TABLE "GeneralInterview"
  ALTER COLUMN "programEnrollmentId" SET NOT NULL;
ALTER TABLE "GeneralInterview"
  ADD CONSTRAINT "GeneralInterview_programEnrollmentId_fkey"
  FOREIGN KEY ("programEnrollmentId") REFERENCES "ProgramEnrollment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "GeneralInterview_one_completed_per_pe_blueprint"
  ON "GeneralInterview" ("programEnrollmentId", "blueprint")
  WHERE "status" = 'COMPLETED';

ALTER TABLE "ProgramConceptAttempt"
  ALTER COLUMN "programEnrollmentId" SET NOT NULL;
ALTER TABLE "ProgramConceptAttempt"
  ADD CONSTRAINT "ProgramConceptAttempt_programEnrollmentId_fkey"
  FOREIGN KEY ("programEnrollmentId") REFERENCES "ProgramEnrollment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "ProgramConceptAttempt_programEnrollmentId_dayNumber_key"
  ON "ProgramConceptAttempt"("programEnrollmentId", "dayNumber");

ALTER TABLE "ProgramExerciseCompletion"
  ALTER COLUMN "programEnrollmentId" SET NOT NULL;
ALTER TABLE "ProgramExerciseCompletion"
  ADD CONSTRAINT "ProgramExerciseCompletion_programEnrollmentId_fkey"
  FOREIGN KEY ("programEnrollmentId") REFERENCES "ProgramEnrollment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "ProgramExerciseCompletion_programEnrollmentId_exerciseId_key"
  ON "ProgramExerciseCompletion"("programEnrollmentId", "exerciseId");

ALTER TABLE "ProgramProject"
  ALTER COLUMN "programEnrollmentId" SET NOT NULL;
ALTER TABLE "ProgramProject"
  ADD CONSTRAINT "ProgramProject_programEnrollmentId_fkey"
  FOREIGN KEY ("programEnrollmentId") REFERENCES "ProgramEnrollment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "ProgramProject_programEnrollmentId_moduleNumber_key"
  ON "ProgramProject"("programEnrollmentId", "moduleNumber");

ALTER TABLE "ProgramMissionSubmission"
  ALTER COLUMN "programEnrollmentId" SET NOT NULL;
ALTER TABLE "ProgramMissionSubmission"
  ADD CONSTRAINT "ProgramMissionSubmission_programEnrollmentId_fkey"
  FOREIGN KEY ("programEnrollmentId") REFERENCES "ProgramEnrollment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RecruiterShortlistItem"
  ADD CONSTRAINT "RecruiterShortlistItem_candidateUserId_fkey"
  FOREIGN KEY ("candidateUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
