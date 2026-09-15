-- T-249: extend NotificationAudience enum with CANDIDATE and RECRUITER
-- so admin broadcasts can target the two role-based segments explicitly.
-- Additive only. Existing rows and callers are unaffected.

ALTER TYPE "NotificationAudience" ADD VALUE 'CANDIDATE';
ALTER TYPE "NotificationAudience" ADD VALUE 'RECRUITER';

