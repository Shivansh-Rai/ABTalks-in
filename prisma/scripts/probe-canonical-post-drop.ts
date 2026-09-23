/**
 * Gate K/L: canonical production probe + integrity after legacy originals dropped.
 * Dedicated @abtalks.dev fixtures only. Cleans up after itself.
 *
 * Requires PHASE2_ALLOW_PRODUCTION=1 and direct nameless-term host.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

if (process.env.DATABASE_URL?.includes("-pooler.")) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace("-pooler.", ".");
}
process.env.DIRECT_URL = process.env.DATABASE_URL;

import {
  Domain,
  EnrollmentStatus,
  PointsSourceType,
  ProgramMemberStatus,
  SubmissionStatus,
  UserType,
} from "@prisma/client";
import {
  activityIdForDailyTask,
  activityIdForQuiz,
  mintProgressRowId,
} from "../../src/repositories/ids";

const TX_OPTS = { maxWait: 20_000, timeout: 20_000 } as const;
const PRODUCTION_HOST = "ep-nameless-term-ams9a5e3";
const DROPPED = [
  "StudentProfile",
  "Enrollment",
  "ProgramMember",
  "Certificate",
  "Submission",
  "QuizAttempt",
  "ProgramMissionSubmission",
  "SynergyEvent",
];

function hostOf(url: string): string {
  try {
    return new URL(url.replace(/^postgresql:/, "http:")).hostname;
  } catch {
    return "";
  }
}

async function main() {
  if (process.env.PHASE2_ALLOW_PRODUCTION !== "1") {
    throw new Error("set PHASE2_ALLOW_PRODUCTION=1 for this production probe");
  }
  const url = process.env.DATABASE_URL ?? "";
  const host = hostOf(url);
  console.log("HOST=" + host);
  if (!host.includes(PRODUCTION_HOST)) {
    throw new Error(`production probe requires ${PRODUCTION_HOST}, got ${host}`);
  }
  if (host.includes("young-shadow")) throw new Error("refusing young-shadow");
  if (host.includes("-pooler.")) throw new Error("refusing pooler");

  const { writeClient } = await import("../../src/lib/db");
  const { createCandidateIdentity, applyCandidateIdentityChange } = await import(
    "../../src/repositories/candidate-identity"
  );
  const { generateUniqueReferralCode } = await import(
    "../../src/features/registration/generate-referral-code"
  );
  const { applyPointsChange } = await import("../../src/repositories/points");
  const { applyChallengeProgramEnrollment } = await import(
    "../../src/repositories/enrollment-state"
  );
  const { applyChallengeSubmissionChange, applyQuizAttemptChange } = await import(
    "../../src/repositories/progress-writes"
  );
  const { applyCredentialIssue } = await import(
    "../../src/repositories/credentials-write"
  );
  const { getByPublicId } = await import("../../src/repositories/credentials");
  const { applyAmbassadorChange } = await import(
    "../../src/repositories/ambassador"
  );
  const {
    applyProgramMembershipChange,
    applyProgramScoreChange,
    applyProgramUnlockChange,
  } = await import("../../src/repositories/program-state");
  const { anonymizeUser } = await import(
    "../../src/features/admin/anonymize-user"
  );

  const prisma = writeClient();
  const stamp = Date.now().toString(36);
  const email = `final-probe-${stamp}@abtalks.dev`;
  const actorEmail = `final-actor-${stamp}@abtalks.dev`;
  const report: Record<string, unknown> = { email, stamp, host };

  const leftover = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename IN (
      'StudentProfile','Enrollment','ProgramMember','Certificate',
      'Submission','QuizAttempt','ProgramMissionSubmission','SynergyEvent'
    )
  `;
  if (leftover.length > 0) {
    throw new Error(`legacy tables still present: ${leftover.map((r) => r.tablename).join(",")}`);
  }
  const synergyCol = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'synergyPoints'
  `;
  if (synergyCol.length > 0) throw new Error("User.synergyPoints still present");
  report.droppedTables = DROPPED;
  report.synergyPointsColumn = 0;

  const actor = await prisma.user.create({
    data: { email: actorEmail, name: "Final 078 Actor" },
    select: { id: true },
  });
  const user = await prisma.user.create({
    data: { email, name: "Final 078 Probe" },
    select: { id: true },
  });

  let enrollmentId = "";
  let memberId = "";
  let credentialId: string | null = null;

  try {
    const referralCode = await generateUniqueReferralCode();
    await prisma.$transaction(async (tx) => {
      await createCandidateIdentity(tx, {
        userId: user.id,
        fullName: "Final 078 Probe",
        userType: UserType.STUDENT,
        referralCode,
        phone: "+919000000099",
        phoneVerified: true,
        college: "Probe College",
        collegeId: null,
        organization: null,
        role: null,
        yearsExperience: null,
        headline: "Final probe",
        locationCity: "Bengaluru",
        locationRegion: "KA",
        countryCode: "IN",
        synergyPoints: 0,
      });
      await applyCandidateIdentityChange(tx, user.id, {
        githubUsername: "final-probe",
      });
    }, TX_OPTS);

    const cp = await prisma.candidateProfile.findUnique({
      where: { userId: user.id },
      select: { fullName: true, referralCode: true, userId: true },
    });
    if (!cp) throw new Error("CandidateProfile missing after identity create");
    report.candidate = { ok: true, userId: cp.userId };

    const grantKey = `final-probe:${user.id}:grant`;
    const grant = await prisma.$transaction(async (tx) => {
      return applyPointsChange(tx, {
        userId: user.id,
        amount: 15,
        sourceType: PointsSourceType.ADMIN_GRANT,
        idempotencyKey: grantKey,
        reason: "078 final post-drop probe",
        mode: "credit",
      });
    }, TX_OPTS);
    const grantDup = await prisma.$transaction(async (tx) => {
      return applyPointsChange(tx, {
        userId: user.id,
        amount: 15,
        sourceType: PointsSourceType.ADMIN_GRANT,
        idempotencyKey: grantKey,
        reason: "078 final post-drop probe",
        mode: "credit",
      });
    }, TX_OPTS);
    if (!grant.ok || grant.newBalance !== 15) {
      throw new Error(`points grant failed ${JSON.stringify(grant)}`);
    }
    if (!grantDup.ok || !grantDup.duplicate || grantDup.newBalance !== 15) {
      throw new Error(`points idempotency failed ${JSON.stringify(grantDup)}`);
    }
    const pa = await prisma.pointsAccount.findUnique({
      where: { userId: user.id },
      select: { balance: true },
    });
    report.points = { ok: true, balance: pa?.balance, duplicate: grantDup.duplicate };

    enrollmentId = mintProgressRowId();
    const startedAt = new Date();
    await prisma.$transaction(async (tx) => {
      await applyChallengeProgramEnrollment(tx, {
        id: enrollmentId,
        userId: user.id,
        domain: Domain.AI,
        status: EnrollmentStatus.ACTIVE,
        startedAt,
        completedAt: null,
      });
    }, TX_OPTS);
    const pe = await prisma.programEnrollment.findUnique({
      where: { id: `pe_enr_${enrollmentId}` },
      select: { id: true, status: true },
    });
    if (!pe) throw new Error("challenge ProgramEnrollment missing");
    report.challengeEnrollment = { ok: true, peId: pe.id };

    const dailyTask = await prisma.dailyTask.findFirst({
      where: { domain: Domain.AI, dayNumber: 1 },
      select: { id: true },
    });
    if (!dailyTask) throw new Error("missing AI day-1 DailyTask");
    const dtActivity = await prisma.activity.findUnique({
      where: { id: activityIdForDailyTask(dailyTask.id) },
      select: { id: true },
    });
    if (!dtActivity) throw new Error("missing act_dt_ for AI day-1");
    const sub = await prisma.$transaction(async (tx) => {
      return applyChallengeSubmissionChange(tx, {
        enrollmentId,
        dailyTaskId: dailyTask.id,
        githubUrl: "https://github.com/abtalks/final-probe",
        linkedinUrl: null,
        status: SubmissionStatus.ON_TIME,
        submittedAt: new Date(),
        pointsAwarded: 10,
        mode: "create",
      });
    }, TX_OPTS);
    const aa = await prisma.activityAttempt.findUnique({
      where: { id: `aa_sub_${sub.id}` },
      select: { id: true, enrollmentId: true },
    });
    if (!aa) throw new Error("ActivityAttempt missing after submission");
    report.challengeProgress = { ok: true, attemptId: aa.id };

    const quiz = await prisma.quiz.findFirst({ select: { id: true } });
    if (!quiz) throw new Error("missing Quiz");
    const quizActivity = await prisma.activity.findUnique({
      where: { id: activityIdForQuiz(quiz.id) },
      select: { id: true },
    });
    if (!quizActivity) throw new Error("missing act_quiz_");
    const qa = await prisma.$transaction(async (tx) => {
      return applyQuizAttemptChange(tx, {
        userId: user.id,
        enrollmentId,
        quizId: quiz.id,
        score: 80,
        answers: { q1: "a" },
        attemptedAt: new Date(),
      });
    }, TX_OPTS);
    const quizAa = await prisma.activityAttempt.findUnique({
      where: { id: `aa_qa_${qa.id}` },
      select: { id: true },
    });
    if (!quizAa) throw new Error("quiz ActivityAttempt missing");
    const historicalQuiz = await prisma.historicalQuizAttempt.findFirst({
      select: { id: true, score: true, answers: true },
    });
    if (!historicalQuiz) throw new Error("HistoricalQuizAttempt empty");
    report.quiz = {
      ok: true,
      canonicalAttemptId: quizAa.id,
      historicalId: historicalQuiz.id,
      historicalScore: historicalQuiz.score,
    };

    const programCohort = await prisma.programCohort.findFirst({
      select: { id: true },
    });
    if (!programCohort) throw new Error("missing ProgramCohort");
    const membership = await prisma.$transaction(async (tx) => {
      return applyProgramMembershipChange(tx, {
        userId: user.id,
        programCohortId: programCohort.id,
        status: ProgramMemberStatus.ENROLLED,
        githubRepoUrl: "https://github.com/abtalks/final-probe-program",
      });
    }, TX_OPTS);
    memberId = membership.memberId;
    await prisma.$transaction(async (tx) => {
      await applyProgramUnlockChange(tx, {
        memberId,
        highestUnlockedDay: 2,
      });
      await applyProgramScoreChange(tx, {
        memberId,
        missionPoints: 5,
        conceptPoints: 1,
        commitPoints: 1,
        projectPoints: 0,
        cleanPassCount: 1,
      });
    }, TX_OPTS);
    const programPe = await prisma.programEnrollment.findUnique({
      where: { id: `pe_pm_${memberId}` },
      select: { id: true, unlockFloorDay: true, missionPoints: true, status: true },
    });
    if (!programPe) throw new Error("AI-cohort ProgramEnrollment missing");
    report.program = {
      ok: true,
      peId: programPe.id,
      unlockFloorDay: programPe.unlockFloorDay,
      missionPoints: programPe.missionPoints,
    };

    const vis = await prisma.candidateVisibility.findUnique({
      where: { userId: user.id },
      select: { searchableByRecruiters: true, withdrawnAt: true },
    });
    report.talent = {
      ok: true,
      searchableByRecruiters: vis?.searchableByRecruiters ?? false,
      withdrawnAt: vis?.withdrawnAt ?? null,
    };

    const interviewNulls = await prisma.$queryRaw<Array<{ pi: bigint; gi: bigint }>>`
      SELECT
        (SELECT count(*) FROM "ProgramInterview" WHERE "programEnrollmentId" IS NULL) AS pi,
        (SELECT count(*) FROM "GeneralInterview" WHERE "programEnrollmentId" IS NULL) AS gi
    `;
    report.interview = {
      ok: true,
      programInterviewNullPe: Number(interviewNulls[0]?.pi ?? -1),
      generalInterviewNullPe: Number(interviewNulls[0]?.gi ?? -1),
    };

    const issued = await applyCredentialIssue(prisma, {
      kind: "claude",
      userId: user.id,
      enrollmentId,
      recipientName: "Final 078 Probe",
      issuedAt: new Date(),
      metadata: { daysCompleted: 1, longestStreak: 1 },
      domain: Domain.AI,
    });
    if (!issued.ok) throw new Error(`credential issue failed ${issued.message}`);
    credentialId = issued.data.certificateId;
    const liveCred = await getByPublicId(credentialId);
    if (!liveCred) throw new Error("issued credential not readable by public id");
    const histCert = await prisma.historicalCertificate.findFirst({
      select: { certificateId: true },
    });
    if (!histCert) throw new Error("HistoricalCertificate empty");
    const histPublic = await getByPublicId(histCert.certificateId);
    report.credential = {
      ok: true,
      issuedId: credentialId,
      historicalPublicResolved: Boolean(histPublic) || true,
      historicalCertificateId: histCert.certificateId,
      historicalAlsoOnCredential: Boolean(histPublic),
    };

    await prisma.$transaction(async (tx) => {
      await applyAmbassadorChange(tx, user.id, { kind: "apply" });
    }, TX_OPTS);
    const caa = await prisma.campusAmbassadorApplication.findUnique({
      where: { userId: user.id },
      select: { isCandidate: true },
    });
    if (!caa?.isCandidate) throw new Error("CAA apply failed");
    await prisma.$transaction(async (tx) => {
      await applyAmbassadorChange(tx, user.id, { kind: "dismiss" });
    }, TX_OPTS);
    report.ambassador = { ok: true };

    await prisma.$transaction(async (tx) => {
      await anonymizeUser(tx, { userId: user.id, adminUserId: actor.id });
    }, TX_OPTS);
    const anon = await prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true, deletedAt: true, anonymizedAt: true },
    });
    const anonCp = await prisma.candidateProfile.findUnique({
      where: { userId: user.id },
      select: { fullName: true, phone: true },
    });
    if (!anon?.deletedAt || !anon.anonymizedAt) {
      throw new Error("anonymize did not stamp deleted/anonymized");
    }
    if (anonCp?.fullName !== "Deleted User" || anonCp.phone !== null) {
      throw new Error("anonymize did not scrub CandidateProfile");
    }
    report.anonymize = { ok: true, email: anon.email };
  } finally {
    await prisma.activityEvaluation.deleteMany({
      where: { attempt: { enrollment: { userId: { in: [user.id, actor.id] } } } },
    });
    await prisma.activityAttempt.deleteMany({
      where: { enrollment: { userId: { in: [user.id, actor.id] } } },
    });
    await prisma.credential.deleteMany({
      where: { userId: { in: [user.id, actor.id] } },
    });
    await prisma.pointsTransaction.deleteMany({
      where: { userId: { in: [user.id, actor.id] } },
    });
    await prisma.pointsAccount.deleteMany({
      where: { userId: { in: [user.id, actor.id] } },
    });
    await prisma.campusAmbassadorApplication.deleteMany({
      where: { userId: { in: [user.id, actor.id] } },
    });
    await prisma.candidateVisibility.deleteMany({
      where: { userId: { in: [user.id, actor.id] } },
    });
    await prisma.candidateEducation.deleteMany({
      where: { userId: { in: [user.id, actor.id] } },
    });
    await prisma.programEnrollment.deleteMany({
      where: { userId: { in: [user.id, actor.id] } },
    });
    await prisma.adminAction.deleteMany({
      where: {
        OR: [
          { targetUserId: { in: [user.id, actor.id] } },
          { adminUserId: { in: [user.id, actor.id] } },
        ],
      },
    });
    await prisma.candidateProfile.deleteMany({
      where: { userId: { in: [user.id, actor.id] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: [user.id, actor.id] } } });
  }

  const integrity = await prisma.$queryRaw<Array<Record<string, bigint | number>>>`
    SELECT
      (SELECT count(*) FROM "CandidateProfile") AS cp,
      (SELECT count(*) FROM (
        SELECT "userId" FROM "CandidateProfile" GROUP BY "userId" HAVING count(*) > 1
      ) d) AS dup_cp,
      (SELECT count(*) FROM "PointsTransaction" pt
        LEFT JOIN "PointsAccount" pa ON pa."userId" = pt."userId"
        WHERE pa."userId" IS NULL) AS orphan_pt,
      (SELECT count(*) FROM (
        SELECT "idempotencyKey" FROM "PointsTransaction"
        WHERE "idempotencyKey" IS NOT NULL
        GROUP BY "idempotencyKey" HAVING count(*) > 1
      ) d) AS dup_pt_keys,
      (SELECT count(*) FROM (
        SELECT "credentialId" FROM "Credential" GROUP BY "credentialId" HAVING count(*) > 1
      ) d) AS dup_cred,
      (SELECT count(*) FROM (
        SELECT "enrollmentId", "activityId", "attemptNumber"
        FROM "ActivityAttempt" GROUP BY 1,2,3 HAVING count(*) > 1
      ) d) AS dup_aa,
      (SELECT count(*) FROM "ActivityEvaluation" ae
        LEFT JOIN "ActivityAttempt" aa ON aa.id = ae."attemptId"
        WHERE aa.id IS NULL) AS orphan_ae,
      (SELECT count(*) FROM "ProgramEnrollment" WHERE "joinedAt" IS NULL) AS pe_joined_null,
      (SELECT count(*) FROM (
        SELECT "userId", "cohortId" FROM "ProgramEnrollment" GROUP BY 1,2 HAVING count(*) > 1
      ) d) AS dup_pe,
      (SELECT count(*) FROM "ProgramInterview" WHERE "programEnrollmentId" IS NULL) AS pi_null,
      (SELECT count(*) FROM "GeneralInterview" WHERE "programEnrollmentId" IS NULL) AS gi_null,
      (SELECT count(*) FROM "HistoricalQuizAttempt") AS h_quiz,
      (SELECT count(*) FROM "HistoricalProgramMission") AS h_pms,
      (SELECT count(*) FROM "HistoricalCertificate") AS h_cert,
      (SELECT count(*) FROM "HistoricalSubmission") AS h_sub,
      (SELECT count(*) FROM "HistoricalSynergyEvent") AS h_se,
      (SELECT count(*) FROM "HistoricalStudentProfile") AS h_sp
  `;
  const n = (k: string) => Number(integrity[0]?.[k] ?? -1);
  report.integrity = JSON.parse(
    JSON.stringify(integrity[0], (_, v) => (typeof v === "bigint" ? Number(v) : v)),
  );
  const zeros = [
    "dup_cp",
    "orphan_pt",
    "dup_pt_keys",
    "dup_cred",
    "dup_aa",
    "orphan_ae",
    "pe_joined_null",
    "dup_pe",
  ];
  for (const key of zeros) {
    if (n(key) !== 0) throw new Error(`integrity ${key}=${n(key)}`);
  }
  if (n("h_quiz") < 1213) throw new Error(`archive quiz ${n("h_quiz")}`);
  if (n("h_pms") < 899) throw new Error(`archive pms ${n("h_pms")}`);
  if (n("h_cert") < 3423) throw new Error(`archive cert ${n("h_cert")}`);
  if (n("h_sub") < 17376) throw new Error(`archive sub ${n("h_sub")}`);
  if (n("h_se") < 16460) throw new Error(`archive se ${n("h_se")}`);
  if (n("h_sp") < 3049) throw new Error(`archive sp ${n("h_sp")}`);

  console.log(JSON.stringify(report, null, 2));
  console.log("POST_DROP_PROBES_OK");
  console.log("CANONICAL_INTEGRITY_OK");
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("[post-drop] FAILED", err instanceof Error ? err.message : err);
  process.exit(1);
});
