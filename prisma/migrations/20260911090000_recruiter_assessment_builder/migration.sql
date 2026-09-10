-- Plan 121. Recruiter assessment builder (additive only).
-- Two enums + three tables. No existing table is altered.

-- CreateEnum
CREATE TYPE "RecruiterAssessmentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AssessmentQuestionType" AS ENUM ('MULTIPLE_CHOICE', 'PARAGRAPH', 'FILE_UPLOAD');

-- CreateTable
CREATE TABLE "RecruiterAssessment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subheading" TEXT,
    "instructions" TEXT,
    "status" "RecruiterAssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "durationMinutes" INTEGER,
    "passMarkPercent" INTEGER NOT NULL DEFAULT 60,
    "shortlistRefs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecruiterAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentQuestion" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "type" "AssessmentQuestionType" NOT NULL,
    "title" TEXT NOT NULL,
    "helpText" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "points" INTEGER NOT NULL DEFAULT 1,
    "allowMultipleCorrect" BOOLEAN NOT NULL DEFAULT false,
    "maxWords" INTEGER,
    "uploadDestinationUrl" TEXT,
    "sectionId" TEXT,

    CONSTRAINT "AssessmentQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentQuestionOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AssessmentQuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecruiterAssessment_organizationId_createdByUserId_updatedAt_idx" ON "RecruiterAssessment"("organizationId", "createdByUserId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "RecruiterAssessment_status_idx" ON "RecruiterAssessment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentQuestion_assessmentId_position_key" ON "AssessmentQuestion"("assessmentId", "position");

-- CreateIndex
CREATE INDEX "AssessmentQuestion_assessmentId_position_idx" ON "AssessmentQuestion"("assessmentId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentQuestionOption_questionId_position_key" ON "AssessmentQuestionOption"("questionId", "position");

-- CreateIndex
CREATE INDEX "AssessmentQuestionOption_questionId_isCorrect_idx" ON "AssessmentQuestionOption"("questionId", "isCorrect");

-- AddForeignKey
ALTER TABLE "RecruiterAssessment" ADD CONSTRAINT "RecruiterAssessment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruiterAssessment" ADD CONSTRAINT "RecruiterAssessment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentQuestion" ADD CONSTRAINT "AssessmentQuestion_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "RecruiterAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentQuestionOption" ADD CONSTRAINT "AssessmentQuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AssessmentQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
