-- Gender on the candidate profile.
--
-- Additive, nullable, zero-downtime. NULL means "not stated" — it is the
-- absence of an answer, not a fourth category, so the enum carries only the
-- three legally recognised values and nothing has to be backfilled.

CREATE TYPE "CandidateGender" AS ENUM ('MALE', 'FEMALE', 'TRANSGENDER');

ALTER TABLE "CandidateProfile" ADD COLUMN "gender" "CandidateGender";
