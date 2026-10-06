-- Plan 171: claim-and-complete emails for imported résumés.
--
-- Additive only: two enums, one table, one nullable column, four indexes.
-- No foreign keys (outreach history outlives a deleted user or import), and
-- nothing existing is altered beyond the new nullable ResumeImport.batchLabel.

-- CreateEnum
CREATE TYPE "ImportOutreachStage" AS ENUM ('INVITE', 'ONBOARD', 'STOPPED');

-- CreateEnum
CREATE TYPE "ImportOutreachStop" AS ENUM ('COMPLETE', 'FINISHED_SEQUENCE', 'NO_RESPONSE', 'UNSUBSCRIBED', 'REMOVED', 'BOUNCED', 'ADMIN');

-- AlterTable
ALTER TABLE "ResumeImport" ADD COLUMN     "batchLabel" TEXT;

-- CreateTable
CREATE TABLE "ResumeImportOutreach" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stage" "ImportOutreachStage" NOT NULL DEFAULT 'INVITE',
    "step" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "nextSendAt" TIMESTAMP(3),
    "lastSentAt" TIMESTAMP(3),
    "lastDeliveryId" TEXT,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "firstClickAt" TIMESTAMP(3),
    "stoppedAt" TIMESTAMP(3),
    "stopReason" "ImportOutreachStop",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeImportOutreach_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResumeImportOutreach_importId_key" ON "ResumeImportOutreach"("importId");

-- CreateIndex
CREATE INDEX "ResumeImportOutreach_stage_nextSendAt_idx" ON "ResumeImportOutreach"("stage", "nextSendAt");

-- CreateIndex
CREATE INDEX "ResumeImportOutreach_userId_idx" ON "ResumeImportOutreach"("userId");

-- CreateIndex
CREATE INDEX "ResumeImport_batchLabel_idx" ON "ResumeImport"("batchLabel");

