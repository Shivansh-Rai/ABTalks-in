-- T-254: first-touch UTM attribution on User. All nullable so the migration
-- is safe against existing rows; first-touch semantics live in the writer.

ALTER TABLE "User" ADD COLUMN "utmSource"     TEXT;
ALTER TABLE "User" ADD COLUMN "utmMedium"     TEXT;
ALTER TABLE "User" ADD COLUMN "utmCampaign"   TEXT;
ALTER TABLE "User" ADD COLUMN "utmTerm"       TEXT;
ALTER TABLE "User" ADD COLUMN "utmContent"    TEXT;
ALTER TABLE "User" ADD COLUMN "utmCapturedAt" TIMESTAMP(3);
