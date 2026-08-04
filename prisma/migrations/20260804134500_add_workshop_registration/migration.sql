-- CreateTable
CREATE TABLE "WorkshopRegistration" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "organization" TEXT,
    "graduationYear" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkshopRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkshopRegistration_eventId_createdAt_idx" ON "WorkshopRegistration"("eventId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "WorkshopRegistration_userId_idx" ON "WorkshopRegistration"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopRegistration_eventId_userId_key" ON "WorkshopRegistration"("eventId", "userId");

-- AddForeignKey
ALTER TABLE "WorkshopRegistration" ADD CONSTRAINT "WorkshopRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
