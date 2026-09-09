-- Accomplishments section: the candidate's free-text awards & recognitions.
--
-- Additive, nullable, zero-downtime. One prose column rather than a repeatable
-- table because the product is a single "what you were recognised for" text
-- area — nothing queries, ranks or filters on it, so rows would be structure
-- with no reader.
--
-- Deliberately NOT stored on CandidateAchievement: that table is the
-- platform-derived evidence surface (read by features/profile/get-evidence.ts),
-- and self-authored prose sitting there would be rendered as though ABTalks had
-- verified it. Verified Accomplishments stay derived from Certificate /
-- Credential / Enrollment / ProgramEnrollment / HackathonParticipant.
--
-- NULL means "never written". An empty text area saves as NULL, not ''.

ALTER TABLE "CandidateProfile" ADD COLUMN "awards" TEXT;
