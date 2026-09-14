import type { Prisma } from "@prisma/client";
import {
  EnrollmentStatus,
  EnrollmentStatusV2,
  ProgramMemberStatus,
} from "@prisma/client";
import {
  dualWriteChallengeEnrollmentById,
  dualWriteProgramMember,
} from "@/repositories/dual-write";

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

  await tx.studentProfile.updateMany({
    where: { userId },
    data: {
      fullName: "Deleted User",
      phone: null,
      phoneVerified: false,
      phoneVerifiedAt: null,
      college: null,
      collegeId: null,
      graduationYear: null,
      organization: null,
      role: null,
      yearsExperience: null,
      linkedinUrl: null,
      githubUsername: null,
      resumeUrl: null,
      skills: [],
      referralCode: `del_${userId}`,
      isReadyForInterview: false,
      isCampusAmbassadorCandidate: false,
      ambassadorAppliedAt: null,
      ambassadorDismissedAt: null,
    },
  });

  await tx.candidateProfile.updateMany({
    where: { userId },
    data: {
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
      referralCode: `delc_${userId}`,
      isReadyForInterview: false,
      isCampusAmbassadorCandidate: false,
      ambassadorAppliedAt: null,
      ambassadorDismissedAt: null,
    },
  });

  await tx.phoneVerification.deleteMany({ where: { userId } });

  // Admin-only moderation stop. `withdrawnAt` is what keeps it durable: both
  // dual-write visibility helpers return early on it, so no later enrollment
  // can make this user searchable again. There are no per-field flags to clear
  // — what a recruiter sees is the platform's RECRUITER_FIELD_POLICY (plan 133).
  await tx.candidateVisibility.updateMany({
    where: { userId },
    data: {
      searchableByRecruiters: false,
      withdrawnAt: now,
    },
  });

  const activeEnrollments = await tx.enrollment.findMany({
    where: { userId, status: EnrollmentStatus.ACTIVE },
    select: { id: true },
  });
  for (const enrollment of activeEnrollments) {
    await tx.enrollment.update({
      where: { id: enrollment.id },
      data: { status: EnrollmentStatus.ABANDONED },
    });
    await dualWriteChallengeEnrollmentById(tx, enrollment.id);
  }

  const openMembers = await tx.programMember.findMany({
    where: {
      userId,
      status: {
        in: [
          ProgramMemberStatus.APPLIED,
          ProgramMemberStatus.WAITLISTED,
          ProgramMemberStatus.ENROLLED,
        ],
      },
    },
    select: { id: true },
  });
  for (const member of openMembers) {
    await tx.programMember.update({
      where: { id: member.id },
      data: { status: ProgramMemberStatus.DROPPED },
    });
    await dualWriteProgramMember(tx, member.id);
  }

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
