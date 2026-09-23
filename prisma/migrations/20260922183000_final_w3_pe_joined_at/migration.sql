-- 078 final Wave 3 additive: ProgramEnrollment.joinedAt for first-track order.
-- Distinct from startedAt, which can hold cohort-calendar dates.

BEGIN;

ALTER TABLE "ProgramEnrollment"
  ADD COLUMN "joinedAt" TIMESTAMP(3);

UPDATE "ProgramEnrollment" pe
SET "joinedAt" = e."createdAt"
FROM "Enrollment" e
WHERE pe.id = 'pe_enr_' || e.id
  AND pe."joinedAt" IS NULL;

UPDATE "ProgramEnrollment" pe
SET "joinedAt" = m."createdAt"
FROM "ProgramMember" m
WHERE pe.id = 'pe_pm_' || m.id
  AND pe."joinedAt" IS NULL;

UPDATE "ProgramEnrollment"
SET "joinedAt" = "createdAt"
WHERE "joinedAt" IS NULL;

ALTER TABLE "ProgramEnrollment"
  ALTER COLUMN "joinedAt" SET NOT NULL;

ALTER TABLE "ProgramEnrollment"
  ALTER COLUMN "joinedAt" SET DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "ProgramEnrollment_userId_joinedAt_idx"
  ON "ProgramEnrollment"("userId", "joinedAt");

COMMIT;
