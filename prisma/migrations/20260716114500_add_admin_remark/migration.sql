-- CreateTable
CREATE TABLE "AdminRemark" (
    "id" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminRemark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminRemark_studentUserId_createdAt_idx" ON "AdminRemark"("studentUserId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "AdminRemark" ADD CONSTRAINT "AdminRemark_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminRemark" ADD CONSTRAINT "AdminRemark_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
