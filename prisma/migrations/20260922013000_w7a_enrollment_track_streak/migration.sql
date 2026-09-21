-- W7-A additive ProgramEnrollment challenge-track streak snapshot.
-- Does not drop Enrollment denorm columns or StudentProfile.domain.
-- Does not make EnrollmentProgress authoritative.

ALTER TABLE "ProgramEnrollment"
  ADD COLUMN "trackCurrentStreak" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "trackLongestStreak" INTEGER NOT NULL DEFAULT 0;
