-- Align WorkshopEvent to the plan 163 schema.
--
-- Production still has a pre-163 WorkshopEvent (date/time as text, icon/desc/
-- posterSrc naming, no track / publishedAt / archivedAt, and no WorkshopTrack
-- enum). `20260929120000_workshop_events_table` was marked applied without
-- running, so Prisma thought the new shape existed while the old table stayed.
--
-- Safe here: the table has 0 rows and no foreign keys. WorkshopRegistration
-- (382 rows) is untouched — there is deliberately no FK from its eventId.

DROP TABLE IF EXISTS "WorkshopEvent";

DO $$ BEGIN
    CREATE TYPE "WorkshopTrack" AS ENUM ('WORKSHOP', 'HACKATHON', 'COHORT', 'CHALLENGE');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE "WorkshopEvent" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "timeLabel" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "accent" TEXT NOT NULL,
    "iconName" TEXT NOT NULL,
    "track" "WorkshopTrack" NOT NULL,
    "posterUrl" TEXT,
    "registrationOpen" BOOLEAN NOT NULL DEFAULT true,
    "register" BOOLEAN NOT NULL DEFAULT false,
    "externalHref" TEXT,
    "ctaLabel" TEXT,
    "youtubeId" TEXT,
    "duration" TEXT,
    "titleAccents" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "takeaways" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resources" JSONB,
    "durationMinutes" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkshopEvent_date_idx" ON "WorkshopEvent"("date" DESC);

CREATE INDEX "WorkshopEvent_publishedAt_archivedAt_date_idx" ON "WorkshopEvent"("publishedAt", "archivedAt", "date");
