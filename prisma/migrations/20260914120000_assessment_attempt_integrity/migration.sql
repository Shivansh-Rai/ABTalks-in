-- CreateEnum
CREATE TYPE "AssessmentAttemptEventType" AS ENUM ('SESSION_STARTED', 'PAGE_LEFT', 'FULLSCREEN_ENTERED', 'FULLSCREEN_EXITED', 'VISIBILITY_HIDDEN', 'VISIBILITY_VISIBLE', 'WINDOW_BLURRED', 'WINDOW_FOCUSED', 'COPY_BLOCKED', 'CUT_BLOCKED', 'PASTE_BLOCKED', 'DROP_BLOCKED', 'LINK_PASTED', 'UPLOAD_LINK_OPENED', 'CAMERA_ON', 'CAMERA_OFF');

-- AlterTable
ALTER TABLE "RecruiterAssessment" ADD COLUMN     "cameraRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "strictMode" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AssessmentAttemptSession" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "clientSessionId" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentAttemptSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentAttemptEvent" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" "AssessmentAttemptEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "clientOccurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "questionId" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AssessmentAttemptEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssessmentAttemptSession_assignmentId_firstSeenAt_idx" ON "AssessmentAttemptSession"("assignmentId", "firstSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentAttemptSession_assignmentId_clientSessionId_key" ON "AssessmentAttemptSession"("assignmentId", "clientSessionId");

-- CreateIndex
CREATE INDEX "AssessmentAttemptEvent_assignmentId_occurredAt_idx" ON "AssessmentAttemptEvent"("assignmentId", "occurredAt");

-- CreateIndex
CREATE INDEX "AssessmentAttemptEvent_questionId_idx" ON "AssessmentAttemptEvent"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentAttemptEvent_assignmentId_sessionId_seq_key" ON "AssessmentAttemptEvent"("assignmentId", "sessionId", "seq");

-- AddForeignKey
ALTER TABLE "AssessmentAttemptSession" ADD CONSTRAINT "AssessmentAttemptSession_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "RecruiterAssessmentAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAttemptEvent" ADD CONSTRAINT "AssessmentAttemptEvent_assignmentId_sessionId_fkey" FOREIGN KEY ("assignmentId", "sessionId") REFERENCES "AssessmentAttemptSession"("assignmentId", "clientSessionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAttemptEvent" ADD CONSTRAINT "AssessmentAttemptEvent_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AssessmentQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

