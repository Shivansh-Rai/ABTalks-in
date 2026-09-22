/**
 * Phase 8-D production probe after rollback-code retirement.
 * Dedicated @abtalks.dev users only. Cleans up after itself.
 *
 * Requires PHASE2_ALLOW_PRODUCTION=1 + nameless-term direct host.
 * ENABLE_DUAL_WRITE must remain false.
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
  EnrollmentStatusV2,
  PointsSourceType,
  ProgramMemberStatus,
  SubmissionStatus,
  UserType,
} from "@prisma/client";
import { assertChildBranch } from "./migrate-078-shared";
import {
  activityIdForDailyTask,
  attemptIdForSubmission,
  peIdForEnrollment,
  peIdForMember,
} from "../../src/repositories/ids";

const TX_OPTS = { maxWait: 20_000, timeout: 20_000 } as const;

function setProdFlags() {
  process.env.ENABLE_DUAL_WRITE = "false";
  process.env.ENABLE_NEW_POINTS = "true";
  process.env.ENABLE_NEW_POINTS_WRITES = "true";
  process.env.ENABLE_LEGACY_POINTS_MIRROR = "false";
  process.env.ENABLE_NEW_CREDENTIAL = "true";
  process.env.ENABLE_NEW_CREDENTIAL_WRITES = "true";
  process.env.ENABLE_LEGACY_CERTIFICATE_MIRROR = "false";
  process.env.ENABLE_NEW_CANDIDATE = "true";
  process.env.ENABLE_NEW_CANDIDATE_WRITES = "true";
  process.env.ENABLE_LEGACY_STUDENT_PROFILE_MIRROR = "false";
  process.env.ENABLE_NEW_AMBASSADOR_WRITES = "true";
  process.env.ENABLE_LEGACY_AMBASSADOR_MIRROR = "false";
  process.env.ENABLE_NEW_PROGRESS = "true";
  process.env.ENABLE_NEW_PROGRESS_WRITES = "true";
  process.env.ENABLE_LEGACY_PROGRESS_MIRROR = "false";
  process.env.ENABLE_NEW_ENROLLMENT_STATE = "true";
  process.env.ENABLE_LEGACY_ENROLLMENT_DENORM_MIRROR = "false";
  process.env.ENABLE_NEW_PROGRAM_STATE = "true";
  process.env.ENABLE_NEW_PROGRAM_STATE_WRITES = "true";
  process.env.ENABLE_LEGACY_PROGRAM_MEMBER_MIRROR = "false";
  process.env.ENABLE_NEW_VISIBILITY_WRITES = "true";
  process.env.ENABLE_NEW_LEARNING = "true";
  process.env.ENABLE_NEW_TALENT = "true";
}

async function main() {
  setProdFlags();
  assertChildBranch();
  const host =
    (process.env.DATABASE_URL ?? "").split("@")[1]?.split("/")[0] ?? "";
  console.log("HOST=" + host);
  if (!host.includes("ep-nameless-term-ams9a5e3")) {
    throw new Error("production probe requires nameless-term host");
  }
  if (host.includes("young-shadow")) throw new Error("refusing young-shadow");
  if (host.includes("-pooler.")) throw new Error("refusing pooler");

  const {
    isDualWriteEnabled,
    isLegacyPointsMirrorEnabled,
    isLegacyCertificateMirrorEnabled,
    isLegacyStudentProfileMirrorEnabled,
    isLegacyAmbassadorMirrorEnabled,
    isLegacyProgressMirrorEnabled,
    isLegacyEnrollmentDenormMirrorEnabled,
    isLegacyProgramMemberMirrorEnabled,
  } = await import("../../src/lib/feature-flags");
  if (isDualWriteEnabled()) {
    throw new Error("probe process must run with ENABLE_DUAL_WRITE=false");
  }
  if (
    isLegacyPointsMirrorEnabled() ||
    isLegacyCertificateMirrorEnabled() ||
    isLegacyStudentProfileMirrorEnabled() ||
    isLegacyAmbassadorMirrorEnabled() ||
    isLegacyProgressMirrorEnabled() ||
    isLegacyEnrollmentDenormMirrorEnabled() ||
    isLegacyProgramMemberMirrorEnabled()
  ) {
    throw new Error("dedicated legacy mirrors must stay false");
  }

  const { writeClient } = await import("../../src/lib/db");
  const { createCandidateIdentity, applyCandidateIdentityChange } = await import(
    "../../src/repositories/candidate-identity"
  );
  const { generateUniqueReferralCode } = await import(
    "../../src/features/registration/generate-referral-code"
  );
  const { applyPointsChange, withLegacyPointsMirrorFlush } = await import(
    "../../src/repositories/points"
  );
  const { applyChallengeProgramEnrollment } = await import(
    "../../src/repositories/enrollment-state"
  );
  const { applyVisibilityChange } = await import(
    "../../src/repositories/visibility"
  );
  const { applyChallengeSubmissionChange } = await import(
    "../../src/repositories/progress-writes"
  );
  const { applyCredentialIssue } = await import(
    "../../src/repositories/credentials-write"
  );
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
  const email = `p8d-probe-${stamp}@abtalks.dev`;
  const actorEmail = `p8d-actor-${stamp}@abtalks.dev`;
  const submissionId = `p8dpsub_${stamp}`;
  const report: Record<string, unknown> = { email, stamp };

  const actor = await prisma.user.create({
    data: { email: actorEmail, name: "P8C Actor" },
    select: { id: true },
  });
  const user = await prisma.user.create({
    data: { email, name: "P8C Probe" },
    select: { id: true },
  });

  let enrollmentId = "";
  let claudeEnrollmentId = "";
  let memberId = "";
  let credentialId: string | null = null;

  try {
    const referralCode = await generateUniqueReferralCode();
    await prisma.$transaction(async (tx) => {
      await createCandidateIdentity(tx, {
        userId: user.id,
        fullName: "P8C Probe",
        userType: UserType.STUDENT,
        referralCode,
        phone: "+919000000081",
        phoneVerified: true,
        college: "Probe College",
        collegeId: null,
        organization: null,
        role: null,
        yearsExperience: null,
        headline: "P8C",
        locationCity: "Bengaluru",
        locationRegion: "KA",
        countryCode: "IN",
        synergyPoints: 0,
      });
    }, TX_OPTS);

    const spBeforeIdentity = await prisma.studentProfile.findUnique({
      where: { userId: user.id },
      select: { fullName: true, phone: true, githubUsername: true },
    });
    await prisma.$transaction(async (tx) => {
      await applyCandidateIdentityChange(tx, user.id, {
        fullName: "P8C Probe Edited",
        githubUsername: "p8c-probe",
      });
    }, TX_OPTS);
    const cpAfter = await prisma.candidateProfile.findUnique({
      where: { userId: user.id },
      select: { fullName: true, githubUsername: true },
    });
    const spAfterIdentity = await prisma.studentProfile.findUnique({
      where: { userId: user.id },
      select: { fullName: true, phone: true, githubUsername: true },
    });
    if (cpAfter?.fullName !== "P8C Probe Edited") {
      throw new Error("candidate identity not updated");
    }
    if (JSON.stringify(spBeforeIdentity) !== JSON.stringify(spAfterIdentity)) {
      throw new Error("StudentProfile identity changed");
    }
    report.candidate = {
      canonical: cpAfter,
      legacy: spAfterIdentity,
    };

    await prisma.studentProfile.create({
      data: {
        userId: user.id,
        fullName: "P8C Probe SP",
        userType: UserType.STUDENT,
        college: "Probe College",
        referralCode: `sp_${stamp}`,
        skills: ["sql"],
        synergyPoints: 0,
        domain: Domain.AI,
        isCampusAmbassadorCandidate: false,
      },
    });

    const beforePoints = {
      pa: await prisma.pointsAccount.findUnique({
        where: { userId: user.id },
        select: { balance: true },
      }),
      txn: await prisma.pointsTransaction.count({ where: { userId: user.id } }),
      userSynergy: (
        await prisma.user.findUnique({
          where: { id: user.id },
          select: { synergyPoints: true },
        })
      )?.synergyPoints,
      spSynergy: (
        await prisma.studentProfile.findUnique({
          where: { userId: user.id },
          select: { synergyPoints: true },
        })
      )?.synergyPoints,
      events: await prisma.synergyEvent.count({ where: { userId: user.id } }),
    };
    const idempotencyKey = `p8c-grant:+1:${user.id}:${stamp}`;
    const granted = await withLegacyPointsMirrorFlush(() =>
      prisma.$transaction(
        (tx) =>
          applyPointsChange(tx, {
            userId: user.id,
            amount: 1,
            mode: "credit",
            sourceType: PointsSourceType.ADMIN_GRANT,
            sourceId: idempotencyKey,
            idempotencyKey,
            reason: "P8C dual-write-off probe +1",
            legacyEvent: { type: "COMMUNITY_GRANT" },
          }),
        TX_OPTS,
      ),
    );
    const afterPoints = {
      pa: await prisma.pointsAccount.findUnique({
        where: { userId: user.id },
        select: { balance: true },
      }),
      txn: await prisma.pointsTransaction.count({ where: { userId: user.id } }),
      userSynergy: (
        await prisma.user.findUnique({
          where: { id: user.id },
          select: { synergyPoints: true },
        })
      )?.synergyPoints,
      spSynergy: (
        await prisma.studentProfile.findUnique({
          where: { userId: user.id },
          select: { synergyPoints: true },
        })
      )?.synergyPoints,
      events: await prisma.synergyEvent.count({ where: { userId: user.id } }),
    };
    if (!granted.ok || granted.appliedAmount !== 1) {
      throw new Error("points grant failed");
    }
    if ((afterPoints.pa?.balance ?? 0) - (beforePoints.pa?.balance ?? 0) !== 1) {
      throw new Error("PointsAccount did not credit");
    }
    if (afterPoints.txn - beforePoints.txn !== 1) {
      throw new Error("PointsTransaction not written");
    }
    if (afterPoints.userSynergy !== beforePoints.userSynergy) {
      throw new Error("User.synergyPoints changed");
    }
    if (afterPoints.spSynergy !== beforePoints.spSynergy) {
      throw new Error("StudentProfile.synergyPoints changed");
    }
    if (afterPoints.events !== beforePoints.events) {
      throw new Error("SynergyEvent written");
    }
    report.points = { canonical: afterPoints, legacyFrozen: true };

    const aiChallenge = await prisma.challenge.findFirst({
      where: { domain: Domain.AI },
      select: { id: true, domain: true },
    });
    if (!aiChallenge) throw new Error("no AI challenge");
    const task = await prisma.dailyTask.findFirst({
      where: { challengeId: aiChallenge.id },
      select: { id: true, dayNumber: true },
    });
    if (!task) throw new Error("no DailyTask");
    const activity = await prisma.activity.findUnique({
      where: { id: activityIdForDailyTask(task.id) },
      select: { id: true },
    });
    if (!activity) throw new Error("missing Activity for DailyTask");

    const subBefore = await prisma.submission.count();
    enrollmentId = await prisma.$transaction(async (tx) => {
      const enrollment = await tx.enrollment.create({
        data: {
          userId: user.id,
          challengeId: aiChallenge.id,
          domain: Domain.AI,
          status: EnrollmentStatus.ACTIVE,
        },
        select: {
          id: true,
          userId: true,
          domain: true,
          status: true,
          startedAt: true,
          completedAt: true,
        },
      });
      await applyVisibilityChange(tx, {
        userId: user.id,
        kind: "challenge_enroll",
      });
      const pe = await applyChallengeProgramEnrollment(tx, enrollment);
      if (pe.id !== peIdForEnrollment(enrollment.id)) {
        throw new Error("canonical pe_enr id mismatch");
      }
      return enrollment.id;
    }, TX_OPTS);
    const peEnr = await prisma.programEnrollment.findUnique({
      where: { id: peIdForEnrollment(enrollmentId) },
      select: { id: true, status: true },
    });
    if (!peEnr || peEnr.status !== EnrollmentStatusV2.ACTIVE) {
      throw new Error("pe_enr missing or not ACTIVE");
    }
    report.challengeEnrollment = {
      enrollmentId,
      peId: peEnr.id,
      peStatus: peEnr.status,
    };

    await prisma.$transaction(async (tx) => {
      await applyChallengeSubmissionChange(tx, {
        id: submissionId,
        userId: user.id,
        enrollmentId,
        dailyTaskId: task.id,
        dayNumber: task.dayNumber,
        githubUrl: null,
        linkedinUrl: null,
        status: SubmissionStatus.ON_TIME,
        submittedAt: new Date(),
        pointsAwarded: 0,
        mode: "create",
      });
    }, TX_OPTS);
    const aa = await prisma.activityAttempt.findUnique({
      where: { id: attemptIdForSubmission(submissionId) },
      select: { id: true, passed: true },
    });
    const legacySub = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: { id: true },
    });
    const subAfter = await prisma.submission.count();
    if (!aa) throw new Error("canonical AA missing");
    if (legacySub) throw new Error("legacy Submission written");
    if (subAfter !== subBefore) throw new Error("Submission count changed");
    report.progress = { canonicalAttemptId: aa.id, legacySubmission: null };

    const claude = await prisma.challenge.findFirst({
      where: { domain: Domain.CLAUDE },
      select: { id: true },
    });
    if (!claude) throw new Error("no CLAUDE challenge");
    const certBefore = await prisma.certificate.count();
    claudeEnrollmentId = await prisma.$transaction(async (tx) => {
      const enrollment = await tx.enrollment.create({
        data: {
          userId: user.id,
          challengeId: claude.id,
          domain: Domain.CLAUDE,
          status: EnrollmentStatus.ACTIVE,
        },
        select: {
          id: true,
          userId: true,
          domain: true,
          status: true,
          startedAt: true,
          completedAt: true,
        },
      });
      await applyChallengeProgramEnrollment(tx, enrollment);
      return enrollment.id;
    }, TX_OPTS);
    const issued = await applyCredentialIssue(prisma, {
      kind: "claude",
      userId: user.id,
      enrollmentId: claudeEnrollmentId,
      recipientName: "P8C Probe",
      issuedAt: new Date(),
      domain: Domain.CLAUDE,
      metadata: { probe: true, daysCompleted: 56 },
    });
    const certAfter = await prisma.certificate.count();
    if (!issued.ok || issued.data.alreadyIssued) {
      throw new Error("expected new Credential");
    }
    if (certAfter !== certBefore) throw new Error("Certificate written");
    credentialId = issued.data.certificateId;
    report.credential = {
      canonicalId: credentialId,
      certificateCountUnchanged: true,
    };

    const spAmbBefore = await prisma.studentProfile.findUnique({
      where: { userId: user.id },
      select: {
        isCampusAmbassadorCandidate: true,
        ambassadorAppliedAt: true,
        ambassadorDismissedAt: true,
      },
    });
    await prisma.$transaction(async (tx) => {
      await applyAmbassadorChange(tx, user.id, { kind: "apply" });
    }, TX_OPTS);
    const caa = await prisma.campusAmbassadorApplication.findUnique({
      where: { userId: user.id },
      select: { appliedAt: true, dismissedAt: true },
    });
    const spAmbAfter = await prisma.studentProfile.findUnique({
      where: { userId: user.id },
      select: {
        isCampusAmbassadorCandidate: true,
        ambassadorAppliedAt: true,
        ambassadorDismissedAt: true,
      },
    });
    if (!caa?.appliedAt) throw new Error("CAA not applied");
    if (JSON.stringify(spAmbBefore) !== JSON.stringify(spAmbAfter)) {
      throw new Error("SP ambassador changed");
    }
    report.ambassador = { canonical: caa, legacy: spAmbAfter };

    const programCohort = await prisma.programCohort.findFirst({
      select: { id: true },
    });
    if (!programCohort) throw new Error("no ProgramCohort");
    const applied = await prisma.$transaction(
      async (tx) =>
        applyProgramMembershipChange(tx, {
          userId: user.id,
          programCohortId: programCohort.id,
          status: ProgramMemberStatus.APPLIED,
          identity: {
            fullName: "P8C Probe",
            githubUsername: "p8c-probe",
            githubRepoUrl: "https://github.com/abtalks/p8c-probe",
          },
        }),
      TX_OPTS,
    );
    memberId = applied.memberId;
    await prisma.$transaction(async (tx) => {
      await applyProgramMembershipChange(tx, {
        memberId,
        userId: user.id,
        programCohortId: programCohort.id,
        status: ProgramMemberStatus.ENROLLED,
        enrolledAt: new Date(),
      });
      await applyProgramScoreChange(tx, { memberId, missionPoints: 12 });
      await applyProgramUnlockChange(tx, { memberId, highestUnlockedDay: 4 });
    }, TX_OPTS);
    const pePm = await prisma.programEnrollment.findUnique({
      where: { id: peIdForMember(memberId) },
      select: {
        status: true,
        missionPoints: true,
        unlockFloorDay: true,
      },
    });
    const pm = await prisma.programMember.findUnique({
      where: { id: memberId },
      select: {
        status: true,
        missionPoints: true,
        highestUnlockedDay: true,
        fullName: true,
      },
    });
    if (pePm?.status !== EnrollmentStatusV2.ACTIVE) {
      throw new Error("pe_pm not ACTIVE");
    }
    if (pm?.status !== ProgramMemberStatus.APPLIED) {
      throw new Error("PM mutable status must stay frozen");
    }
    if (pePm.missionPoints !== 12 || pm.missionPoints !== 0) {
      throw new Error("score must live on PE");
    }
    report.program = { pe: pePm, pm };

    await prisma.$transaction(async (tx) => {
      await anonymizeUser(tx, { userId: user.id, adminUserId: actor.id });
    }, TX_OPTS);

    const anonUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true, name: true, anonymizedAt: true },
    });
    const anonCp = await prisma.candidateProfile.findUnique({
      where: { userId: user.id },
      select: { fullName: true },
    });
    const anonCv = await prisma.candidateVisibility.findUnique({
      where: { userId: user.id },
      select: { withdrawnAt: true, searchableByRecruiters: true },
    });
    const anonCaa = await prisma.campusAmbassadorApplication.findUnique({
      where: { userId: user.id },
      select: { isCandidate: true, appliedAt: true, dismissedAt: true },
    });
    const anonSp = await prisma.studentProfile.findUnique({
      where: { userId: user.id },
      select: { fullName: true, phone: true },
    });
    const anonEnr = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { status: true },
    });
    const anonPeEnr = await prisma.programEnrollment.findUnique({
      where: { id: peIdForEnrollment(enrollmentId) },
      select: { status: true },
    });
    const anonPePm = await prisma.programEnrollment.findUnique({
      where: { id: peIdForMember(memberId) },
      select: { status: true },
    });
    const anonPm = await prisma.programMember.findUnique({
      where: { id: memberId },
      select: { fullName: true, githubUsername: true, status: true },
    });
    if (!anonUser?.anonymizedAt) throw new Error("user not anonymized");
    if (anonCp?.fullName !== "Deleted User") {
      throw new Error("candidate wipe failed");
    }
    if (!anonCv?.withdrawnAt || anonCv.searchableByRecruiters) {
      throw new Error("visibility not withdrawn");
    }
    if (anonCaa?.isCandidate) {
      throw new Error("CAA wipe failed");
    }
    if (anonSp?.fullName !== "Deleted User") {
      throw new Error("SP compliance scrub failed");
    }
    if (anonEnr?.status !== EnrollmentStatus.ABANDONED) {
      throw new Error("enrollment not ABANDONED");
    }
    if (anonPeEnr?.status !== EnrollmentStatusV2.DROPPED) {
      throw new Error("pe_enr not DROPPED");
    }
    if (anonPePm?.status !== EnrollmentStatusV2.DROPPED) {
      throw new Error("pe_pm not DROPPED");
    }
    report.anonymize = {
      user: anonUser.email,
      candidate: anonCp,
      visibility: anonCv,
      ambassador: anonCaa,
      studentProfile: anonSp,
      enrollment: anonEnr,
      peEnr: anonPeEnr,
      pePm: anonPePm,
      programMember: anonPm,
    };

    console.log(JSON.stringify(report, null, 2));
    console.log("PROBE_OK");
  } finally {
    await prisma.adminAction.deleteMany({
      where: { OR: [{ targetUserId: user.id }, { adminUserId: actor.id }] },
    });
    await prisma.activityEvaluation.deleteMany({
      where: { attemptId: attemptIdForSubmission(submissionId) },
    });
    await prisma.activityAttempt.deleteMany({
      where: { id: attemptIdForSubmission(submissionId) },
    });
    await prisma.pointsTransaction.deleteMany({ where: { userId: user.id } });
    await prisma.pointsAccount.deleteMany({ where: { userId: user.id } });
    if (credentialId) {
      await prisma.credential.deleteMany({
        where: { credentialId },
      });
    }
    await prisma.campusAmbassadorApplication.deleteMany({
      where: { userId: user.id },
    });
    await prisma.candidateVisibility.deleteMany({ where: { userId: user.id } });
    if (memberId) {
      await prisma.programMember.deleteMany({ where: { id: memberId } });
      await prisma.programEnrollment.deleteMany({
        where: { id: peIdForMember(memberId) },
      });
    }
    if (enrollmentId) {
      await prisma.programEnrollment.deleteMany({
        where: { id: peIdForEnrollment(enrollmentId) },
      });
      await prisma.enrollment.deleteMany({ where: { id: enrollmentId } });
    }
    if (claudeEnrollmentId) {
      await prisma.programEnrollment.deleteMany({
        where: { id: peIdForEnrollment(claudeEnrollmentId) },
      });
      await prisma.enrollment.deleteMany({ where: { id: claudeEnrollmentId } });
    }
    await prisma.candidateProfile.deleteMany({ where: { userId: user.id } });
    await prisma.studentProfile.deleteMany({ where: { userId: user.id } });
    await prisma.user.deleteMany({ where: { id: { in: [user.id, actor.id] } } });
    console.log("PROBE_CLEANED");
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
