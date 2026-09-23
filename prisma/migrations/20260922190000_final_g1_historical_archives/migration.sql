-- 078 final Gate 1: immutable historical archives. Source tables retained.
-- No drops. No current-state writers.

BEGIN;

CREATE TABLE "HistoricalQuizAttempt" (
  "id" TEXT NOT NULL,
  "legacyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "quizId" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "answers" JSONB NOT NULL,
  "attemptedAt" TIMESTAMP(3) NOT NULL,
  "activityAttemptId" TEXT,
  "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HistoricalQuizAttempt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HistoricalQuizAttempt_legacyId_key" ON "HistoricalQuizAttempt"("legacyId");
CREATE INDEX "HistoricalQuizAttempt_userId_quizId_idx" ON "HistoricalQuizAttempt"("userId", "quizId");

INSERT INTO "HistoricalQuizAttempt" ("id", "legacyId", "userId", "quizId", "score", "answers", "attemptedAt", "activityAttemptId")
SELECT
  'hqa_' || qa.id,
  qa.id,
  qa."userId",
  qa."quizId",
  qa.score,
  qa.answers,
  qa."attemptedAt",
  CASE WHEN aa.id IS NULL THEN NULL ELSE aa.id END
FROM "QuizAttempt" qa
LEFT JOIN "ActivityAttempt" aa ON aa.id = 'aa_qa_' || qa.id;

CREATE TABLE "HistoricalProgramMission" (
  "id" TEXT NOT NULL,
  "legacyId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "programEnrollmentId" TEXT,
  "dayNumber" INTEGER NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "payload" JSONB NOT NULL,
  "verdict" JSONB NOT NULL,
  "passed" BOOLEAN NOT NULL,
  "pointsAwarded" INTEGER NOT NULL,
  "aiFeedback" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "activityAttemptId" TEXT,
  "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HistoricalProgramMission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HistoricalProgramMission_legacyId_key" ON "HistoricalProgramMission"("legacyId");
CREATE INDEX "HistoricalProgramMission_programEnrollmentId_dayNumber_idx"
  ON "HistoricalProgramMission"("programEnrollmentId", "dayNumber");
CREATE INDEX "HistoricalProgramMission_memberId_dayNumber_idx"
  ON "HistoricalProgramMission"("memberId", "dayNumber");

INSERT INTO "HistoricalProgramMission" (
  "id", "legacyId", "memberId", "programEnrollmentId", "dayNumber", "attemptNumber",
  "payload", "verdict", "passed", "pointsAwarded", "aiFeedback", "createdAt", "activityAttemptId"
)
SELECT
  'hpm_' || pms.id,
  pms.id,
  pms."memberId",
  pms."programEnrollmentId",
  pms."dayNumber",
  pms."attemptNumber",
  pms.payload,
  pms.verdict,
  pms.passed,
  pms."pointsAwarded",
  pms."aiFeedback",
  pms."createdAt",
  CASE WHEN aa.id IS NULL THEN NULL ELSE aa.id END
FROM "ProgramMissionSubmission" pms
LEFT JOIN "ActivityAttempt" aa ON aa.id = 'aa_ms_' || pms.id;

CREATE TABLE "HistoricalCertificate" (
  "id" TEXT NOT NULL,
  "legacyId" TEXT NOT NULL,
  "certificateId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "recipientName" TEXT NOT NULL,
  "domain" TEXT,
  "enrollmentId" TEXT,
  "issuedAt" TIMESTAMP(3) NOT NULL,
  "metadata" JSONB,
  "revokedAt" TIMESTAMP(3),
  "revokedReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HistoricalCertificate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HistoricalCertificate_legacyId_key" ON "HistoricalCertificate"("legacyId");
CREATE UNIQUE INDEX "HistoricalCertificate_certificateId_key" ON "HistoricalCertificate"("certificateId");
CREATE INDEX "HistoricalCertificate_userId_type_idx" ON "HistoricalCertificate"("userId", "type");
CREATE INDEX "HistoricalCertificate_enrollmentId_idx" ON "HistoricalCertificate"("enrollmentId");

INSERT INTO "HistoricalCertificate" (
  "id", "legacyId", "certificateId", "userId", "type", "status", "recipientName",
  "domain", "enrollmentId", "issuedAt", "metadata", "revokedAt", "revokedReason", "createdAt"
)
SELECT
  'hcert_' || c.id,
  c.id,
  c."certificateId",
  c."userId",
  c.type::text,
  c.status::text,
  c."recipientName",
  c.domain::text,
  c."enrollmentId",
  c."issuedAt",
  c.metadata,
  c."revokedAt",
  c."revokedReason",
  c."createdAt"
FROM "Certificate" c;

CREATE TABLE "HistoricalSubmission" (
  "id" TEXT NOT NULL,
  "legacyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "dailyTaskId" TEXT NOT NULL,
  "dayNumber" INTEGER NOT NULL,
  "githubUrl" TEXT,
  "linkedinUrl" TEXT,
  "status" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL,
  "activityAttemptId" TEXT,
  "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HistoricalSubmission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HistoricalSubmission_legacyId_key" ON "HistoricalSubmission"("legacyId");
CREATE INDEX "HistoricalSubmission_userId_dayNumber_idx" ON "HistoricalSubmission"("userId", "dayNumber");
CREATE INDEX "HistoricalSubmission_enrollmentId_idx" ON "HistoricalSubmission"("enrollmentId");

INSERT INTO "HistoricalSubmission" (
  "id", "legacyId", "userId", "enrollmentId", "dailyTaskId", "dayNumber",
  "githubUrl", "linkedinUrl", "status", "submittedAt", "activityAttemptId"
)
SELECT
  'hsub_' || s.id,
  s.id,
  s."userId",
  s."enrollmentId",
  s."dailyTaskId",
  s."dayNumber",
  s."githubUrl",
  s."linkedinUrl",
  s.status::text,
  s."submittedAt",
  CASE WHEN aa.id IS NULL THEN NULL ELSE aa.id END
FROM "Submission" s
LEFT JOIN "ActivityAttempt" aa ON aa.id = 'aa_sub_' || s.id;

CREATE TABLE "HistoricalSynergyEvent" (
  "id" TEXT NOT NULL,
  "legacyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "points" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "submissionId" TEXT,
  "enrollmentId" TEXT,
  "dayNumber" INTEGER,
  "rankAtAward" INTEGER,
  "reason" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HistoricalSynergyEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HistoricalSynergyEvent_legacyId_key" ON "HistoricalSynergyEvent"("legacyId");
CREATE INDEX "HistoricalSynergyEvent_userId_createdAt_idx" ON "HistoricalSynergyEvent"("userId", "createdAt");

INSERT INTO "HistoricalSynergyEvent" (
  "id", "legacyId", "userId", "points", "type", "submissionId", "enrollmentId",
  "dayNumber", "rankAtAward", "reason", "createdByAdminId", "createdAt"
)
SELECT
  'hse_' || e.id,
  e.id,
  e."userId",
  e.points,
  e.type,
  e."submissionId",
  e."enrollmentId",
  e."dayNumber",
  e."rankAtAward",
  e.reason,
  e."createdByAdminId",
  e."createdAt"
FROM "SynergyEvent" e;

CREATE TABLE "HistoricalStudentProfile" (
  "id" TEXT NOT NULL,
  "legacyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HistoricalStudentProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HistoricalStudentProfile_legacyId_key" ON "HistoricalStudentProfile"("legacyId");
CREATE INDEX "HistoricalStudentProfile_userId_idx" ON "HistoricalStudentProfile"("userId");

INSERT INTO "HistoricalStudentProfile" ("id", "legacyId", "userId", "snapshot", "createdAt")
SELECT
  'hsp_' || sp.id,
  sp.id,
  sp."userId",
  jsonb_build_object(
    'fullName', sp."fullName",
    'userType', sp."userType"::text,
    'college', sp.college,
    'collegeId', sp."collegeId",
    'graduationYear', sp."graduationYear",
    'organization', sp.organization,
    'role', sp.role,
    'yearsExperience', sp."yearsExperience",
    'domain', sp.domain::text,
    'skills', to_jsonb(sp.skills),
    'referralCode', sp."referralCode",
    'createdAt', sp."createdAt"
  ),
  sp."createdAt"
FROM "StudentProfile" sp;

COMMIT;
