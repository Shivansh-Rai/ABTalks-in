-- CreateTable
CREATE TABLE "RecruiterReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "confidenceRating" INTEGER,
    "codingRating" INTEGER,
    "communicationRating" INTEGER,
    "headline" TEXT,
    "summary" TEXT,
    "strengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommendedRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "adminNote" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "shareToken" TEXT,
    "reviewedByAdminId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecruiterReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecruiterReview_userId_key" ON "RecruiterReview"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RecruiterReview_shareToken_key" ON "RecruiterReview"("shareToken");

-- CreateIndex
CREATE INDEX "RecruiterReview_shareToken_idx" ON "RecruiterReview"("shareToken");

-- AddForeignKey
ALTER TABLE "RecruiterReview" ADD CONSTRAINT "RecruiterReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
