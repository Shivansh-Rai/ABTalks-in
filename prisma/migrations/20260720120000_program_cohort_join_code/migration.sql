-- AlterTable: add nullable joinCode, backfill, then enforce NOT NULL + unique
ALTER TABLE "ProgramCohort" ADD COLUMN "joinCode" TEXT;

-- Backfill existing rows with deterministic unique codes derived from id
UPDATE "ProgramCohort"
SET "joinCode" = UPPER(SUBSTR(REPLACE(id, '-', ''), 1, 8))
WHERE "joinCode" IS NULL;

-- Resolve any collisions by appending row number suffix (unlikely with cuid)
WITH ranked AS (
  SELECT id, "joinCode",
    ROW_NUMBER() OVER (PARTITION BY "joinCode" ORDER BY "createdAt") AS rn
  FROM "ProgramCohort"
)
UPDATE "ProgramCohort" c
SET "joinCode" = LEFT(r."joinCode", 6) || LPAD(r.rn::text, 2, '0')
FROM ranked r
WHERE c.id = r.id AND r.rn > 1;

ALTER TABLE "ProgramCohort" ALTER COLUMN "joinCode" SET NOT NULL;
CREATE UNIQUE INDEX "ProgramCohort_joinCode_key" ON "ProgramCohort"("joinCode");
