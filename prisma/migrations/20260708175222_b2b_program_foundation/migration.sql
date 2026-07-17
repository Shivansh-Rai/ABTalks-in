-- CreateEnum
CREATE TYPE "ProgramCohortStatus" AS ENUM ('DRAFT', 'ENROLLING', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProgramMemberStatus" AS ENUM ('APPLIED', 'WAITLISTED', 'ENROLLED', 'COMPLETED', 'DROPPED');

-- CreateEnum
CREATE TYPE "ProgramLanguage" AS ENUM ('PYTHON', 'SQL', 'JAVASCRIPT', 'YAML');

-- CreateEnum
CREATE TYPE "ProgramEntrySection" AS ENUM ('APTITUDE', 'TECHNICAL');

-- CreateEnum
CREATE TYPE "ProgramInterviewStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ProgramProjectStatus" AS ENUM ('SUBMITTED', 'GRADED');

-- CreateEnum
CREATE TYPE "ProgramMissionType" AS ENUM ('CODE_SPRINT', 'SHIP_IT', 'DATA_ROOM', 'PROMPT_FORGE', 'BOSS_BUILD');

-- CreateEnum
CREATE TYPE "ProgramDayState" AS ENUM ('LOCKED', 'AVAILABLE', 'PASSED', 'SKIPPED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'RECRUITER';

-- CreateTable
CREATE TABLE "ProgramCohort" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 100,
    "status" "ProgramCohortStatus" NOT NULL DEFAULT 'DRAFT',
    "resultsPublishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgramCohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "status" "ProgramMemberStatus" NOT NULL DEFAULT 'APPLIED',
    "fullName" TEXT NOT NULL,
    "jobRole" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "yearsExperience" INTEGER NOT NULL,
    "education" TEXT,
    "university" TEXT,
    "graduationYear" INTEGER,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "linkedinUrl" TEXT,
    "resumeUrl" TEXT,
    "phone" TEXT,
    "githubUsername" TEXT NOT NULL,
    "githubRepoUrl" TEXT NOT NULL,
    "highestUnlockedDay" INTEGER NOT NULL DEFAULT 1,
    "skipTokensUsed" INTEGER NOT NULL DEFAULT 0,
    "missionPoints" INTEGER NOT NULL DEFAULT 0,
    "conceptPoints" INTEGER NOT NULL DEFAULT 0,
    "commitPoints" INTEGER NOT NULL DEFAULT 0,
    "projectPoints" INTEGER NOT NULL DEFAULT 0,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "cleanPassCount" INTEGER NOT NULL DEFAULT 0,
    "aiRecommendation" TEXT,
    "aiRecommendationAt" TIMESTAMP(3),
    "enrolledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramModule" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "startDay" INTEGER NOT NULL,
    "endDay" INTEGER NOT NULL,

    CONSTRAINT "ProgramModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramDay" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "missionType" "ProgramMissionType" NOT NULL,
    "briefMd" TEXT NOT NULL,
    "assetsJson" JSONB,
    "missionSpec" JSONB NOT NULL,
    "starterCode" TEXT,
    "language" "ProgramLanguage",
    "objectives" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tools" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "estimatedMin" INTEGER NOT NULL DEFAULT 60,
    "missionPoints" INTEGER NOT NULL DEFAULT 12,
    "isProjectDay" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProgramDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramConceptQuestion" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "options" TEXT[],
    "correctIndex" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL,

    CONSTRAINT "ProgramConceptQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramMissionSubmission" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "verdict" JSONB NOT NULL,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "aiFeedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgramMissionSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramConceptAttempt" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "questionIds" JSONB NOT NULL,
    "answers" JSONB,
    "score" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgramConceptAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramEntryQuestion" (
    "id" TEXT NOT NULL,
    "section" "ProgramEntrySection" NOT NULL,
    "question" TEXT NOT NULL,
    "options" TEXT[],
    "correctIndex" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProgramEntryQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramEntryAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "questionIds" JSONB NOT NULL,
    "answers" JSONB,
    "aptitudeScore" INTEGER NOT NULL DEFAULT 0,
    "technicalScore" INTEGER NOT NULL DEFAULT 0,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "ProgramEntryAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramVideo" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "youtubeId" TEXT NOT NULL,
    "durationMin" INTEGER,

    CONSTRAINT "ProgramVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramExercise" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "language" "ProgramLanguage" NOT NULL,
    "moduleNumber" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "starterCode" TEXT NOT NULL,
    "setupSql" TEXT,
    "expectedOutput" TEXT,

    CONSTRAINT "ProgramExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramExerciseCompletion" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgramExerciseCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramCommitDay" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "commitCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProgramCommitDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramProject" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "moduleNumber" INTEGER NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "writeup" TEXT NOT NULL,
    "status" "ProgramProjectStatus" NOT NULL DEFAULT 'SUBMITTED',
    "aiScore" INTEGER,
    "aiFeedback" TEXT,
    "aiRubricJson" JSONB,
    "adminScore" INTEGER,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gradedAt" TIMESTAMP(3),

    CONSTRAINT "ProgramProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramInterview" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" "ProgramInterviewStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationSec" INTEGER,
    "transcript" JSONB,
    "commScore" INTEGER,
    "techScore" INTEGER,
    "problemScore" INTEGER,
    "overallScore" INTEGER,
    "summary" TEXT,
    "evaluatedAt" TIMESTAMP(3),
    "resetCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProgramInterview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruiterProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "phone" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "approvedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecruiterProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruiterShortlistItem" (
    "id" TEXT NOT NULL,
    "recruiterUserId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecruiterShortlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProgramMember_cohortId_totalScore_idx" ON "ProgramMember"("cohortId", "totalScore" DESC);

-- CreateIndex
CREATE INDEX "ProgramMember_cohortId_status_idx" ON "ProgramMember"("cohortId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramMember_userId_cohortId_key" ON "ProgramMember"("userId", "cohortId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramModule_number_key" ON "ProgramModule"("number");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramDay_dayNumber_key" ON "ProgramDay"("dayNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramConceptQuestion_dayId_order_key" ON "ProgramConceptQuestion"("dayId", "order");

-- CreateIndex
CREATE INDEX "ProgramMissionSubmission_memberId_dayNumber_idx" ON "ProgramMissionSubmission"("memberId", "dayNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramMissionSubmission_memberId_dayNumber_attemptNumber_key" ON "ProgramMissionSubmission"("memberId", "dayNumber", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramConceptAttempt_memberId_dayNumber_key" ON "ProgramConceptAttempt"("memberId", "dayNumber");

-- CreateIndex
CREATE INDEX "ProgramEntryQuestion_section_active_idx" ON "ProgramEntryQuestion"("section", "active");

-- CreateIndex
CREATE INDEX "ProgramEntryAttempt_userId_cohortId_idx" ON "ProgramEntryAttempt"("userId", "cohortId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramEntryAttempt_userId_cohortId_attemptNumber_key" ON "ProgramEntryAttempt"("userId", "cohortId", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramVideo_dayId_order_key" ON "ProgramVideo"("dayId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramExercise_slug_key" ON "ProgramExercise"("slug");

-- CreateIndex
CREATE INDEX "ProgramExercise_moduleNumber_order_idx" ON "ProgramExercise"("moduleNumber", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramExerciseCompletion_memberId_exerciseId_key" ON "ProgramExerciseCompletion"("memberId", "exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramCommitDay_memberId_date_key" ON "ProgramCommitDay"("memberId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramProject_memberId_moduleNumber_key" ON "ProgramProject"("memberId", "moduleNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramInterview_memberId_key" ON "ProgramInterview"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "RecruiterProfile_userId_key" ON "RecruiterProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RecruiterShortlistItem_recruiterUserId_memberId_key" ON "RecruiterShortlistItem"("recruiterUserId", "memberId");

-- AddForeignKey
ALTER TABLE "ProgramMember" ADD CONSTRAINT "ProgramMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramMember" ADD CONSTRAINT "ProgramMember_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "ProgramCohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramDay" ADD CONSTRAINT "ProgramDay_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "ProgramModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramConceptQuestion" ADD CONSTRAINT "ProgramConceptQuestion_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "ProgramDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramMissionSubmission" ADD CONSTRAINT "ProgramMissionSubmission_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "ProgramMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramConceptAttempt" ADD CONSTRAINT "ProgramConceptAttempt_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "ProgramMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramEntryAttempt" ADD CONSTRAINT "ProgramEntryAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramEntryAttempt" ADD CONSTRAINT "ProgramEntryAttempt_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "ProgramCohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramVideo" ADD CONSTRAINT "ProgramVideo_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "ProgramDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramExerciseCompletion" ADD CONSTRAINT "ProgramExerciseCompletion_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "ProgramMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramExerciseCompletion" ADD CONSTRAINT "ProgramExerciseCompletion_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "ProgramExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramCommitDay" ADD CONSTRAINT "ProgramCommitDay_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "ProgramMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramProject" ADD CONSTRAINT "ProgramProject_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "ProgramMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramInterview" ADD CONSTRAINT "ProgramInterview_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "ProgramMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruiterProfile" ADD CONSTRAINT "RecruiterProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruiterShortlistItem" ADD CONSTRAINT "RecruiterShortlistItem_recruiterUserId_fkey" FOREIGN KEY ("recruiterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruiterShortlistItem" ADD CONSTRAINT "RecruiterShortlistItem_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "ProgramMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
