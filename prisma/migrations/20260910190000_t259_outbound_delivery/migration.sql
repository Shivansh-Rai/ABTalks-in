-- T-259: observability side-table for outbound mail.
-- Named OutboundDelivery so it does not collide with T-248's
-- NotificationDelivery (UserNotification channel state).
-- Purely additive: creates two enums and one new table, touches nothing existing.

-- CreateEnum
CREATE TYPE "OutboundDeliveryChannel" AS ENUM ('EMAIL');

-- CreateEnum
CREATE TYPE "OutboundDeliveryStatus" AS ENUM ('SKIPPED', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "OutboundDelivery" (
    "id" TEXT NOT NULL,
    "channel" "OutboundDeliveryChannel" NOT NULL DEFAULT 'EMAIL',
    "kind" TEXT NOT NULL,
    "recipientHash" TEXT NOT NULL,
    "subjectType" TEXT,
    "subjectId" TEXT,
    "status" "OutboundDeliveryStatus" NOT NULL,
    "failureReason" TEXT,
    "requestId" TEXT,
    "sentryEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboundDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutboundDelivery_status_createdAt_idx" ON "OutboundDelivery"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "OutboundDelivery_kind_createdAt_idx" ON "OutboundDelivery"("kind", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "OutboundDelivery_recipientHash_idx" ON "OutboundDelivery"("recipientHash");
