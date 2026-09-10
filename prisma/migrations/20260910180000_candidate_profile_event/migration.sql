-- Plan 120. Additive analytics table for profile performance counters.
-- No existing table is altered; counts start at zero on the day this ships.

-- CreateEnum
CREATE TYPE "CandidateProfileEventType" AS ENUM ('DETAIL_VIEW', 'RESUME_UNLOCK');

-- CreateTable
CREATE TABLE "CandidateProfileEvent" (
    "id" TEXT NOT NULL,
    "candidateUserId" TEXT NOT NULL,
    "type" "CandidateProfileEventType" NOT NULL,
    "viewerKey" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateProfileEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CandidateProfileEvent_candidateUserId_type_occurredAt_idx" ON "CandidateProfileEvent"("candidateUserId", "type", "occurredAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "CandidateProfileEvent_candidateUserId_type_viewerKey_dayKey_key" ON "CandidateProfileEvent"("candidateUserId", "type", "viewerKey", "dayKey");

-- AddForeignKey
ALTER TABLE "CandidateProfileEvent" ADD CONSTRAINT "CandidateProfileEvent_candidateUserId_fkey" FOREIGN KEY ("candidateUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
