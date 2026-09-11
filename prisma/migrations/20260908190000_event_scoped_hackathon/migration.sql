-- Existing Hackathon records predate explicit event boundaries. The non-null
-- default marks every historic row as `legacy` during this additive change.
ALTER TABLE "HackathonTeam"
ADD COLUMN "eventId" TEXT NOT NULL DEFAULT 'legacy';

ALTER TABLE "HackathonParticipant"
ADD COLUMN "eventId" TEXT NOT NULL DEFAULT 'legacy';

ALTER TABLE "HackathonRemoval"
ADD COLUMN "eventId" TEXT NOT NULL DEFAULT 'legacy';

-- A user and a generated team code are unique within an event, not forever.
DROP INDEX "HackathonParticipant_userId_key";
DROP INDEX "HackathonTeam_teamCode_key";

CREATE UNIQUE INDEX "HackathonParticipant_eventId_userId_key"
ON "HackathonParticipant"("eventId", "userId");

CREATE UNIQUE INDEX "HackathonTeam_eventId_teamCode_key"
ON "HackathonTeam"("eventId", "teamCode");

-- Preserve efficient current-event reads without removing historic audit indexes.
CREATE INDEX "HackathonParticipant_eventId_teamId_idx"
ON "HackathonParticipant"("eventId", "teamId");

CREATE INDEX "HackathonParticipant_userId_idx"
ON "HackathonParticipant"("userId");

CREATE INDEX "HackathonRemoval_eventId_userId_createdAt_idx"
ON "HackathonRemoval"("eventId", "userId", "createdAt" DESC);

CREATE INDEX "HackathonRemoval_eventId_teamId_idx"
ON "HackathonRemoval"("eventId", "teamId");

CREATE INDEX "HackathonTeam_eventId_createdAt_idx"
ON "HackathonTeam"("eventId", "createdAt" DESC);
