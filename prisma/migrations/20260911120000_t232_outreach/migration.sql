-- CreateEnum
CREATE TYPE "OutreachAuthor" AS ENUM ('RECRUITER', 'CANDIDATE');

-- CreateEnum
CREATE TYPE "OutreachEmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED', 'NONE');

-- CreateTable
CREATE TABLE "OutreachThread" (
    "id" TEXT NOT NULL,
    "recruiterUserId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "candidateUserId" TEXT NOT NULL,
    "engagementId" TEXT,
    "subject" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageBy" "OutreachAuthor" NOT NULL,
    "recruiterLastReadAt" TIMESTAMP(3),
    "candidateLastReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutreachThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "author" "OutreachAuthor" NOT NULL,
    "authorUserId" TEXT,
    "body" TEXT NOT NULL,
    "clientRequestId" TEXT NOT NULL,
    "emailStatus" "OutreachEmailStatus" NOT NULL DEFAULT 'NONE',
    "emailFailureReason" TEXT,
    "emailDeliveryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutreachThread_recruiterUserId_lastMessageAt_idx" ON "OutreachThread"("recruiterUserId", "lastMessageAt" DESC);

-- CreateIndex
CREATE INDEX "OutreachThread_candidateUserId_lastMessageAt_idx" ON "OutreachThread"("candidateUserId", "lastMessageAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "OutreachThread_recruiterUserId_candidateUserId_key" ON "OutreachThread"("recruiterUserId", "candidateUserId");

-- CreateIndex
CREATE INDEX "OutreachMessage_threadId_createdAt_idx" ON "OutreachMessage"("threadId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OutreachMessage_threadId_clientRequestId_key" ON "OutreachMessage"("threadId", "clientRequestId");

-- AddForeignKey
ALTER TABLE "OutreachThread" ADD CONSTRAINT "OutreachThread_recruiterUserId_fkey" FOREIGN KEY ("recruiterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachThread" ADD CONSTRAINT "OutreachThread_candidateUserId_fkey" FOREIGN KEY ("candidateUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachThread" ADD CONSTRAINT "OutreachThread_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachMessage" ADD CONSTRAINT "OutreachMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "OutreachThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachMessage" ADD CONSTRAINT "OutreachMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

