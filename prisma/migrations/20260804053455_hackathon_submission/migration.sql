-- CreateTable
CREATE TABLE "HackathonProblem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HackathonProblem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HackathonSubmission" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "problemId" TEXT,
    "repoUrl" TEXT NOT NULL,
    "liveUrl" TEXT NOT NULL,
    "aiLogUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HackathonSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HackathonProblem_sortOrder_idx" ON "HackathonProblem"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "HackathonSubmission_teamId_key" ON "HackathonSubmission"("teamId");

-- CreateIndex
CREATE INDEX "HackathonSubmission_problemId_idx" ON "HackathonSubmission"("problemId");

-- AddForeignKey
ALTER TABLE "HackathonSubmission" ADD CONSTRAINT "HackathonSubmission_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "HackathonTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HackathonSubmission" ADD CONSTRAINT "HackathonSubmission_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "HackathonProblem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
