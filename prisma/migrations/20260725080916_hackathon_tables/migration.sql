-- CreateEnum
CREATE TYPE "HackathonEntryType" AS ENUM ('SOLO', 'TEAM');

-- CreateTable
CREATE TABLE "HackathonTeam" (
    "id" TEXT NOT NULL,
    "entryType" "HackathonEntryType" NOT NULL,
    "teamName" TEXT,
    "teamCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HackathonTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HackathonParticipant" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "isLeader" BOOLEAN NOT NULL DEFAULT false,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "college" TEXT NOT NULL,
    "graduationYear" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HackathonParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HackathonEvent" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "problemStatement" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HackathonEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HackathonTeam_teamCode_key" ON "HackathonTeam"("teamCode");

-- CreateIndex
CREATE INDEX "HackathonTeam_createdAt_idx" ON "HackathonTeam"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "HackathonParticipant_userId_key" ON "HackathonParticipant"("userId");

-- CreateIndex
CREATE INDEX "HackathonParticipant_teamId_idx" ON "HackathonParticipant"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "HackathonParticipant_teamId_slotIndex_key" ON "HackathonParticipant"("teamId", "slotIndex");

-- AddForeignKey
ALTER TABLE "HackathonParticipant" ADD CONSTRAINT "HackathonParticipant_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "HackathonTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HackathonParticipant" ADD CONSTRAINT "HackathonParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
