-- CreateEnum
CREATE TYPE "AssessmentEndReason" AS ENUM ('SUBMITTED', 'ENDED_EARLY', 'TIME_UP', 'TAB_SWITCH_LIMIT', 'FULLSCREEN_LIMIT', 'LEFT_PAGE');

-- AlterTable
ALTER TABLE "RecruiterAssessmentAssignment" ADD COLUMN     "endReason" "AssessmentEndReason";
