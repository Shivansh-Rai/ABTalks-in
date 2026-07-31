-- CreateEnum
CREATE TYPE "HackathonRemovalActor" AS ENUM ('LEADER', 'ADMIN');

-- CreateTable
CREATE TABLE "HackathonRemoval" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "teamCode" TEXT NOT NULL,
    "teamName" TEXT,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "college" TEXT NOT NULL,
    "graduationYear" INTEGER NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "sourceSlug" TEXT,
    "originalJoinedAt" TIMESTAMP(3) NOT NULL,
    "removedByUserId" TEXT NOT NULL,
    "removedByRole" "HackathonRemovalActor" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HackathonRemoval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HackathonRemoval_userId_createdAt_idx" ON "HackathonRemoval"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "HackathonRemoval_teamId_idx" ON "HackathonRemoval"("teamId");

-- CreateIndex
CREATE INDEX "HackathonRemoval_createdAt_idx" ON "HackathonRemoval"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "HackathonRemoval" ADD CONSTRAINT "HackathonRemoval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
