-- AlterTable
ALTER TABLE "ProgramMember" ADD COLUMN "recruiterVisibilityConsentAt" TIMESTAMP(3);

-- CreateEnum
CREATE TYPE "LegalDocument" AS ENUM ('TERMS', 'PRIVACY');

-- CreateEnum
CREATE TYPE "DataRightsRequestType" AS ENUM ('ACCESS', 'CORRECTION', 'ERASURE', 'OTHER');

-- CreateEnum
CREATE TYPE "DataRightsRequestStatus" AS ENUM ('PENDING', 'DONE', 'REJECTED');

-- CreateTable
CREATE TABLE "LegalConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "document" "LegalDocument" NOT NULL,
    "version" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataRightsRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "type" "DataRightsRequestType" NOT NULL,
    "message" TEXT,
    "status" "DataRightsRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataRightsRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LegalConsent_userId_document_acceptedAt_idx" ON "LegalConsent"("userId", "document", "acceptedAt" DESC);

-- CreateIndex
CREATE INDEX "LegalConsent_email_acceptedAt_idx" ON "LegalConsent"("email", "acceptedAt" DESC);

-- CreateIndex
CREATE INDEX "LegalConsent_source_acceptedAt_idx" ON "LegalConsent"("source", "acceptedAt" DESC);

-- CreateIndex
CREATE INDEX "DataRightsRequest_status_createdAt_idx" ON "DataRightsRequest"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "DataRightsRequest_email_createdAt_idx" ON "DataRightsRequest"("email", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "LegalConsent" ADD CONSTRAINT "LegalConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRightsRequest" ADD CONSTRAINT "DataRightsRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
