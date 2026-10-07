-- Plan 185: recruiter-owned assessment templates.
--
-- Additive: one new table. No existing table, column or row changes.
-- Private to one recruiter: every query filters on organizationId +
-- createdByUserId. Rollback: DROP TABLE "RecruiterAssessmentTemplate";

-- CreateTable
CREATE TABLE "RecruiterAssessmentTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "content" JSONB NOT NULL,
    "questionCount" INTEGER NOT NULL,
    "durationMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecruiterAssessmentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecruiterAssessmentTemplate_organizationId_createdByUserId__idx" ON "RecruiterAssessmentTemplate"("organizationId", "createdByUserId", "updatedAt" DESC);

-- AddForeignKey
ALTER TABLE "RecruiterAssessmentTemplate" ADD CONSTRAINT "RecruiterAssessmentTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruiterAssessmentTemplate" ADD CONSTRAINT "RecruiterAssessmentTemplate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

