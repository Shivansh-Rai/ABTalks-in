-- CreateEnum
CREATE TYPE "AssessmentAssignmentStatus" AS ENUM ('ASSIGNED', 'STARTED', 'SUBMITTED');

-- CreateTable
CREATE TABLE "RecruiterAssessmentAssignment" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "candidateUserId" TEXT NOT NULL,
    "candidateRef" TEXT NOT NULL,
    "status" "AssessmentAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "scorePercent" INTEGER,
    "passed" BOOLEAN,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecruiterAssessmentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecruiterAssessmentAssignment_candidateUserId_assignedAt_idx" ON "RecruiterAssessmentAssignment"("candidateUserId", "assignedAt" DESC);

-- CreateIndex
CREATE INDEX "RecruiterAssessmentAssignment_assessmentId_status_idx" ON "RecruiterAssessmentAssignment"("assessmentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RecruiterAssessmentAssignment_assessmentId_candidateUserId_key" ON "RecruiterAssessmentAssignment"("assessmentId", "candidateUserId");

-- AddForeignKey
ALTER TABLE "RecruiterAssessmentAssignment" ADD CONSTRAINT "RecruiterAssessmentAssignment_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "RecruiterAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruiterAssessmentAssignment" ADD CONSTRAINT "RecruiterAssessmentAssignment_candidateUserId_fkey" FOREIGN KEY ("candidateUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

