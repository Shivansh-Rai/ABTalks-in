-- 078 final Wave 2c: drop ProgramMember inbound FKs. Keep memberId scalars.
-- Canonical FKs are already programEnrollmentId / candidateUserId.
-- Does not drop ProgramMember or memberId columns.

ALTER TABLE "GeneralInterview" DROP CONSTRAINT "GeneralInterview_memberId_fkey";
ALTER TABLE "ProgramCommitDay" DROP CONSTRAINT "ProgramCommitDay_memberId_fkey";
ALTER TABLE "ProgramConceptAttempt" DROP CONSTRAINT "ProgramConceptAttempt_memberId_fkey";
ALTER TABLE "ProgramExerciseCompletion" DROP CONSTRAINT "ProgramExerciseCompletion_memberId_fkey";
ALTER TABLE "ProgramInterview" DROP CONSTRAINT "ProgramInterview_memberId_fkey";
ALTER TABLE "ProgramMissionSubmission" DROP CONSTRAINT "ProgramMissionSubmission_memberId_fkey";
ALTER TABLE "ProgramProject" DROP CONSTRAINT "ProgramProject_memberId_fkey";
ALTER TABLE "RecruiterShortlistItem" DROP CONSTRAINT "RecruiterShortlistItem_memberId_fkey";
