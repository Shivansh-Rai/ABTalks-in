-- Workshop events become admin-editable data.
--
-- Additive only: creates one new table and touches nothing that exists.
-- `WorkshopRegistration` is deliberately left alone — no foreign key is added
-- from its `eventId` to `WorkshopEvent.id`, because rosters outlive their
-- workshop rows and the constraint would fail on any environment holding an
-- eventId the seed does not create.
--
-- Run `npm run db:seed:workshop-events` immediately after this migration. The
-- seed inserts the seven workshop-track events with their EXISTING ids, which
-- is what keeps every WorkshopRegistration attached to the same workshop.

-- CreateTable
CREATE TABLE "WorkshopEvent" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "accent" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "desc" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "registrationOpen" BOOLEAN NOT NULL DEFAULT true,
    "durationMinutes" INTEGER,
    "posterSrc" TEXT,
    "youtubeId" TEXT,
    "duration" TEXT,
    "titleAccents" TEXT[],
    "topics" TEXT[],
    "takeaways" TEXT[],
    "resources" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkshopEvent_date_idx" ON "WorkshopEvent"("date");
