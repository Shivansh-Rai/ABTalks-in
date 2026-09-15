-- T-272 / T-270 / T-217 / T-277. Child-branch only.

-- User freeze + JWT invalidation
ALTER TABLE "User" ADD COLUMN "disabledAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "disabledReason" TEXT;
ALTER TABLE "User" ADD COLUMN "disabledByUserId" TEXT;
ALTER TABLE "User" ADD COLUMN "sessionInvalidatedAt" TIMESTAMP(3);

CREATE INDEX "User_disabledAt_idx" ON "User"("disabledAt");

-- AdminAction T-270 columns
ALTER TABLE "AdminAction" ADD COLUMN "entityType" TEXT;
ALTER TABLE "AdminAction" ADD COLUMN "entityId" TEXT;
ALTER TABLE "AdminAction" ADD COLUMN "previousState" JSONB;
ALTER TABLE "AdminAction" ADD COLUMN "newState" JSONB;
ALTER TABLE "AdminAction" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "AdminAction" ADD COLUMN "actorUserId" TEXT;

UPDATE "AdminAction" SET "actorUserId" = "adminUserId" WHERE "actorUserId" IS NULL;

ALTER TABLE "AdminAction" ALTER COLUMN "actorUserId" SET NOT NULL;

ALTER TABLE "AdminAction" ALTER COLUMN "targetUserId" DROP NOT NULL;
ALTER TABLE "AdminAction" ALTER COLUMN "adminUserId" DROP NOT NULL;

ALTER TABLE "AdminAction" DROP CONSTRAINT "AdminAction_adminUserId_fkey";
ALTER TABLE "AdminAction" DROP CONSTRAINT "AdminAction_targetUserId_fkey";
ALTER TABLE "AdminAction" ADD CONSTRAINT "AdminAction_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdminAction" ADD CONSTRAINT "AdminAction_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AdminAction_entityType_entityId_createdAt_idx" ON "AdminAction"("entityType", "entityId", "createdAt" DESC);
CREATE INDEX "AdminAction_actorUserId_createdAt_idx" ON "AdminAction"("actorUserId", "createdAt" DESC);

-- Candidate-owned Restrict → Cascade
ALTER TABLE "Certificate" DROP CONSTRAINT "Certificate_userId_fkey";
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Credential" DROP CONSTRAINT "Credential_userId_fkey";
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SynergyEvent" DROP CONSTRAINT "SynergyEvent_userId_fkey";
ALTER TABLE "SynergyEvent" ADD CONSTRAINT "SynergyEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PointsTransaction" DROP CONSTRAINT "PointsTransaction_userId_fkey";
ALTER TABLE "PointsTransaction" ADD CONSTRAINT "PointsTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CandidateAchievement" DROP CONSTRAINT "CandidateAchievement_userId_fkey";
ALTER TABLE "CandidateAchievement" ADD CONSTRAINT "CandidateAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssessmentReport" DROP CONSTRAINT "AssessmentReport_candidateUserId_fkey";
ALTER TABLE "AssessmentReport" ADD CONSTRAINT "AssessmentReport_candidateUserId_fkey" FOREIGN KEY ("candidateUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Recruiter-owned pointers → SetNull
ALTER TABLE "CreditTransaction" DROP CONSTRAINT "CreditTransaction_candidateUserId_fkey";
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_candidateUserId_fkey" FOREIGN KEY ("candidateUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TalentEngagementRequest" DROP CONSTRAINT "TalentEngagementRequest_candidateUserId_fkey";
ALTER TABLE "TalentEngagementRequest" ALTER COLUMN "candidateUserId" DROP NOT NULL;
ALTER TABLE "TalentEngagementRequest" ADD CONSTRAINT "TalentEngagementRequest_candidateUserId_fkey" FOREIGN KEY ("candidateUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Mock interview point debit
ALTER TYPE "PointsSourceType" ADD VALUE 'MOCK_INTERVIEW';
