-- Add location column to Organization for recruiter workspace profile (T-227).
-- Additive, nullable, zero-downtime.

ALTER TABLE "Organization" ADD COLUMN "location" TEXT;
