-- CreateTable
CREATE TABLE "HackathonLink" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HackathonLink_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "HackathonParticipant" ADD COLUMN "sourceSlug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "HackathonLink_slug_key" ON "HackathonLink"("slug");

-- CreateIndex
CREATE INDEX "HackathonParticipant_sourceSlug_idx" ON "HackathonParticipant"("sourceSlug");
