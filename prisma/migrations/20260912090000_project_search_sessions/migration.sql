-- AlterTable
ALTER TABLE "TalentRequestMessage" ADD COLUMN     "sessionId" TEXT;

-- CreateTable
CREATE TABLE "TalentSearchSession" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "spec" JSONB,
    "resultCandidateIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resultSnapshot" JSONB,
    "overallGap" TEXT,
    "matchCount" INTEGER,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TalentSearchSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TalentProjectAssessment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "linkedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TalentProjectAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TalentSearchSession_requestId_createdAt_idx" ON "TalentSearchSession"("requestId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "TalentSearchSession_requestId_ordinal_key" ON "TalentSearchSession"("requestId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "TalentProjectAssessment_assessmentId_key" ON "TalentProjectAssessment"("assessmentId");

-- CreateIndex
CREATE INDEX "TalentProjectAssessment_requestId_idx" ON "TalentProjectAssessment"("requestId");

-- CreateIndex
CREATE INDEX "TalentRequestMessage_sessionId_createdAt_idx" ON "TalentRequestMessage"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "TalentRequestMessage" ADD CONSTRAINT "TalentRequestMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TalentSearchSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentSearchSession" ADD CONSTRAINT "TalentSearchSession_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "TalentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentProjectAssessment" ADD CONSTRAINT "TalentProjectAssessment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "TalentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentProjectAssessment" ADD CONSTRAINT "TalentProjectAssessment_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "RecruiterAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

