import type { Prisma } from "@prisma/client";
import {
  EnrollmentStatus,
  EnrollmentStatusV2,
  ProgramMemberStatus,
} from "@prisma/client";
import { applyChallengeProgramEnrollment } from "@/repositories/enrollment-state";
import { applyVisibilityChange } from "@/repositories/visibility";
import { applyAmbassadorChange } from "@/repositories/ambassador";
import {
  applyProgramMembershipChange,
  scrubProgramMemberLegacyPii,
} from "@/repositories/program-state";
import {
  domainFromChallengeCohortSlug,
  enrollmentIdFromPe,
  memberIdFromPe,
  programCohortIdFromSlug,
} from "@/repositories/ids";

type Tx = Prisma.TransactionClient;

export class AnonymizeUserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnonymizeUserError";
  }
}

/**
 * Soft-delete a user in place (078 I15). Never hard-deletes the User row.
 * Call only inside writeClient().$transaction.
 * Caller must refuse platform admins before invoking (hasPlatformAdmin).
 */
export async function anonymizeUser(
  tx: Tx,
  input: { userId: string; adminUserId: string },
): Promise<void> {
  const { userId, adminUserId } = input;

  if (userId === adminUserId) {
    throw new AnonymizeUserError("You cannot delete your own account");
  }

  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { id: true, deletedAt: true },
  });
  if (!user) {
    throw new AnonymizeUserError("User not found");
  }
  if (user.deletedAt) {
    throw new AnonymizeUserError("User account is already deleted");
  }

  const now = new Date();

  // Audit while PII is still readable.
  await tx.adminAction.create({
    data: {
      adminUserId,
      actorUserId: adminUserId,
      targetUserId: userId,
      actionType: "DELETE_USER_ACCOUNT",
      metadata: { softDelete: true },
    },
  });

  await tx.user.update({
    where: { id: userId },
    data: {
      deletedAt: now,
      anonymizedAt: now,
      email: `deleted+${userId}@deleted.local`,
      name: "Deleted User",
      image: null,
      password: null,
      emailVerified: null,
    },
  });

  await tx.account.deleteMany({ where: { userId } });
  await tx.session.deleteMany({ where: { userId } });

  // One deleted referral code on both tables. Never mint a second deleted
  // namespace — CandidateProfile.referralCode must stay equal to StudentProfile.
  const deletedReferralCode = `del_${userId}`;
  const candidateWipe = {
    fullName: "Deleted User",
    headline: null,
    summary: null,
    awards: null,
    gender: null,
    phone: null,
    phoneVerified: false,
    phoneVerifiedAt: null,
    locationCity: null,
    locationRegion: null,
    countryCode: null,
    linkedinUrl: null,
    githubUsername: null,
    portfolioUrl: null,
    resumeUrl: null,
    referralCode: deletedReferralCode,
    isReadyForInterview: false,
    isCampusAmbassadorCandidate: false,
    ambassadorAppliedAt: null,
    ambassadorDismissedAt: null,
  };

  // Canonical wipe always. Archive StudentProfile PII is scrubbed below.
  await applyAmbassadorChange(tx, userId, { kind: "wipe", at: now });

  await tx.candidateProfile.updateMany({
    where: { userId },
    data: candidateWipe,
  });
  const archives = await tx.historicalStudentProfile.findMany({
    where: { userId },
    select: { id: true, snapshot: true },
  });
  for (const archive of archives) {
    const snap =
      archive.snapshot &&
      typeof archive.snapshot === "object" &&
      !Array.isArray(archive.snapshot)
        ? { ...(archive.snapshot as Record<string, unknown>) }
        : {};
    snap.fullName = "Deleted User";
    snap.college = null;
    snap.organization = null;
    snap.role = null;
    snap.referralCode = deletedReferralCode;
    await tx.historicalStudentProfile.update({
      where: { id: archive.id },
      data: { snapshot: snap as Prisma.InputJsonValue },
    });
  }

  await tx.phoneVerification.deleteMany({ where: { userId } });

  // Admin-only moderation stop. `withdrawnAt` is what keeps it durable: W2
  // applyVisibilityChange and both dual-write helpers return early on it, so
  // no later enrollment can make this user searchable again. There are no
  // per-field flags to clear — what a recruiter sees is RECRUITER_FIELD_POLICY
  // (plan 133).
  await applyVisibilityChange(tx, {
    userId,
    kind: "admin_withdraw",
    at: now,
  });

  const challengePes = await tx.programEnrollment.findMany({
    where: {
      userId,
      id: { startsWith: "pe_enr_" },
      status: EnrollmentStatusV2.ACTIVE,
    },
    select: {
      id: true,
      startedAt: true,
      completedAt: true,
      cohort: { select: { slug: true } },
    },
  });
  for (const pe of challengePes) {
    const enrollmentId = enrollmentIdFromPe(pe.id);
    const domain = domainFromChallengeCohortSlug(pe.cohort.slug);
    if (!enrollmentId || !domain) continue;
    await applyChallengeProgramEnrollment(tx, {
      id: enrollmentId,
      userId,
      domain,
      status: EnrollmentStatus.ABANDONED,
      startedAt: pe.startedAt,
      completedAt: pe.completedAt,
    });
  }

  const openMembers = await tx.programEnrollment.findMany({
    where: {
      userId,
      id: { startsWith: "pe_pm_" },
      status: {
        in: [
          EnrollmentStatusV2.APPLIED,
          EnrollmentStatusV2.WAITLISTED,
          EnrollmentStatusV2.ACTIVE,
        ],
      },
    },
    select: { id: true, cohort: { select: { slug: true } } },
  });
  for (const pe of openMembers) {
    const memberId = memberIdFromPe(pe.id);
    const cohortId = programCohortIdFromSlug(pe.cohort.slug);
    if (!memberId || !cohortId) continue;
    await applyProgramMembershipChange(tx, {
      memberId,
      userId,
      programCohortId: cohortId,
      status: ProgramMemberStatus.DROPPED,
    });
  }

  // W8-B compliance exception: freeze does not skip PII wipe on frozen PM
  // identity snapshots. This is not an authority / remirror write.
  await scrubProgramMemberLegacyPii(tx, userId);

  await tx.programEnrollment.updateMany({
    where: {
      userId,
      status: {
        in: [
          EnrollmentStatusV2.APPLIED,
          EnrollmentStatusV2.WAITLISTED,
          EnrollmentStatusV2.ACTIVE,
        ],
      },
    },
    data: {
      status: EnrollmentStatusV2.DROPPED,
      droppedAt: now,
    },
  });

  await tx.userRoleAssignment.updateMany({
    where: { userId, revokedAt: null },
    data: {
      revokedAt: now,
      revokedReason: "Account soft-deleted by admin",
    },
  });
}
