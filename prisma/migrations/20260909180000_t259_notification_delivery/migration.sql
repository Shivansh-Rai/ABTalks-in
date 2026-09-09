-- T-259: observability side-table for outbound notifications.
-- Purely additive: creates two enums and one new table, touches nothing existing.

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('SKIPPED', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'EMAIL',
    "kind" TEXT NOT NULL,
    "recipientHash" TEXT NOT NULL,
    "subjectType" TEXT,
    "subjectId" TEXT,
    "status" "NotificationDeliveryStatus" NOT NULL,
    "failureReason" TEXT,
    "requestId" TEXT,
    "sentryEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationDelivery_status_createdAt_idx" ON "NotificationDelivery"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "NotificationDelivery_kind_createdAt_idx" ON "NotificationDelivery"("kind", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "NotificationDelivery_recipientHash_idx" ON "NotificationDelivery"("recipientHash");
