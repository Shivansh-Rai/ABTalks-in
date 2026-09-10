-- CreateEnum
CREATE TYPE "RateLimitBucket" AS ENUM ('UNLOCK', 'OUTREACH', 'SEARCH', 'EXPORT');

-- CreateTable
CREATE TABLE "RateLimitEvent" (
    "id" TEXT NOT NULL,
    "bucket" "RateLimitBucket" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateLimitEvent_bucket_subjectId_createdAt_idx" ON "RateLimitEvent"("bucket", "subjectId", "createdAt");
