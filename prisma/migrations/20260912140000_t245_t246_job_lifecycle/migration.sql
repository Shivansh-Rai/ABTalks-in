-- T-245 / T-246: recruiter job lifecycle + candidate application status.
-- These columns landed in schema.prisma on 2026-09-10 via db push on a
-- different branch and were never recorded as a migration, so development
-- still has the 20260604 Job / JobApplication shape. Additive only.
-- Existing Job rows become PUBLISHED (enum default); existing applications
-- become APPLIED. No row rewrites.

CREATE TYPE "JobStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');
CREATE TYPE "JobWorkMode" AS ENUM ('REMOTE', 'HYBRID', 'ONSITE');
CREATE TYPE "JobApplicationStatus" AS ENUM ('APPLIED', 'REVIEWING', 'ACCEPTED', 'REJECTED');

ALTER TABLE "Job"
  ADD COLUMN "workMode" "JobWorkMode",
  ADD COLUMN "skills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "status" "JobStatus" NOT NULL DEFAULT 'PUBLISHED',
  ADD COLUMN "recruiterId" TEXT,
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "closedAt" TIMESTAMP(3);

CREATE INDEX "Job_status_createdAt_idx" ON "Job"("status", "createdAt" DESC);
CREATE INDEX "Job_recruiterId_createdAt_idx" ON "Job"("recruiterId", "createdAt" DESC);

ALTER TABLE "Job"
  ADD CONSTRAINT "Job_recruiterId_fkey"
  FOREIGN KEY ("recruiterId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JobApplication"
  ADD COLUMN "status" "JobApplicationStatus" NOT NULL DEFAULT 'APPLIED',
  ADD COLUMN "resumeUrl" TEXT,
  ADD COLUMN "coverLetter" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DROP INDEX "JobApplication_jobId_userId_key";
CREATE UNIQUE INDEX "JobApplication_userId_jobId_key" ON "JobApplication"("userId", "jobId");
CREATE INDEX "JobApplication_userId_createdAt_idx" ON "JobApplication"("userId", "createdAt" DESC);
