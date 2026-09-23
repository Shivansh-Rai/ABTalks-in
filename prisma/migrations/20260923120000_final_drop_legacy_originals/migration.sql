-- 078 final destructive rehearsal/production drop of original legacy tables.
-- Archives already hold unique history. Order respects remaining FKs:
-- SynergyEvent → Submission → Enrollment; Certificate → Enrollment.
-- Inbound FKs to ProgramMember are already 0.

-- A/B ProgramMember is independent of the challenge stack.
-- C-J follow Enrollment/Submission/Certificate/Quiz/PMS/Synergy/StudentProfile.

BEGIN;

DROP TABLE IF EXISTS "SynergyEvent";
DROP TABLE IF EXISTS "QuizAttempt";
DROP TABLE IF EXISTS "ProgramMissionSubmission";
DROP TABLE IF EXISTS "Certificate";
DROP TABLE IF EXISTS "Submission";
DROP TABLE IF EXISTS "Enrollment";
DROP TABLE IF EXISTS "ProgramMember";
DROP TABLE IF EXISTS "StudentProfile";

DROP INDEX IF EXISTS "User_synergyPoints_idx";
ALTER TABLE "User" DROP COLUMN IF EXISTS "synergyPoints";

COMMIT;
