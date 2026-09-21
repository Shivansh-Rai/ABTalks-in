-- W5-A additive Campus Ambassador canonical table.
-- Does not drop or alter StudentProfile ambassador columns.

-- CreateTable
CREATE TABLE "CampusAmbassadorApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isCandidate" BOOLEAN NOT NULL DEFAULT false,
    "appliedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampusAmbassadorApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CampusAmbassadorApplication_userId_key" ON "CampusAmbassadorApplication"("userId");

-- CreateIndex
CREATE INDEX "CampusAmbassadorApplication_isCandidate_idx" ON "CampusAmbassadorApplication"("isCandidate");

-- CreateIndex
CREATE INDEX "CampusAmbassadorApplication_appliedAt_idx" ON "CampusAmbassadorApplication"("appliedAt" DESC);

-- AddForeignKey
ALTER TABLE "CampusAmbassadorApplication" ADD CONSTRAINT "CampusAmbassadorApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
