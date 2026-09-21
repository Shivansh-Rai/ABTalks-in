import "server-only";
import {
  CredentialSourceType,
  CredentialType,
  Domain,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { issueClaudeCredential } from "@/repositories/credentials-write";
import { peIdForEnrollment } from "@/repositories/ids";
import {
  getChallengeDaySubmission,
  getChallengeProgressStats,
} from "@/repositories/progress";

const CERTIFICATE_ELIGIBLE_DAYS = 50;
const CERTIFICATE_REQUIRED_DAY = 60;

export type IssueResult =
  | { ok: true; data: { certificateId: string; alreadyIssued: boolean } }
  | { ok: false; message: string };

export async function ensureClaudeCertificate(userId: string): Promise<IssueResult> {
  const enrollment = await prisma.enrollment.findFirst({
    where: { userId, domain: Domain.CLAUDE },
    select: {
      id: true,
      daysCompleted: true,
      longestStreak: true,
      completedAt: true,
      user: {
        select: {
          studentProfile: {
            select: { fullName: true, college: true, organization: true },
          },
        },
      },
    },
  });

  if (!enrollment) {
    return { ok: false, message: "Not enrolled in the Claude challenge" };
  }

  const [progress, day60Submission] = await Promise.all([
    getChallengeProgressStats(enrollment.id),
    getChallengeDaySubmission(enrollment.id, CERTIFICATE_REQUIRED_DAY),
  ]);

  const eligible =
    day60Submission != null &&
    progress.daysCompleted >= CERTIFICATE_ELIGIBLE_DAYS;

  if (!eligible) {
    return { ok: false, message: "Challenge not completed yet" };
  }

  const fullName = enrollment.user.studentProfile?.fullName?.trim() ?? "";
  if (!fullName) {
    const [existingCert, existingCred] = await Promise.all([
      prisma.certificate.findUnique({
        where: { enrollmentId: enrollment.id },
        select: { certificateId: true },
      }),
      prisma.credential.findUnique({
        where: {
          type_sourceType_sourceKey: {
            type: CredentialType.COMPLETION,
            sourceType: CredentialSourceType.PROGRAM_ENROLLMENT,
            sourceKey: peIdForEnrollment(enrollment.id),
          },
        },
        select: { credentialId: true },
      }),
    ]);
    if (!existingCert && !existingCred) {
      return {
        ok: false,
        message: "Complete your profile name before claiming your certificate",
      };
    }
  }

  const college = enrollment.user.studentProfile?.college ?? null;
  const organization = enrollment.user.studentProfile?.organization ?? null;

  return issueClaudeCredential({
    userId,
    enrollmentId: enrollment.id,
    recipientName: fullName,
    issuedAt: enrollment.completedAt ?? new Date(),
    domain: Domain.CLAUDE,
    metadata: {
      daysCompleted: progress.daysCompleted,
      longestStreak: progress.longestStreak,
      completedAt: enrollment.completedAt?.toISOString() ?? null,
      college,
      organization,
    },
  });
}
