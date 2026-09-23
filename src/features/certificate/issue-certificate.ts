import "server-only";
import {
  CredentialSourceType,
  CredentialType,
  Domain,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { issueClaudeCredential } from "@/repositories/credentials-write";
import { listChallengePeRows } from "@/repositories/enrollment-state";
import { peIdForEnrollment } from "@/repositories/ids";
import {
  getChallengeDaySubmission,
  getChallengeProgressStats,
} from "@/repositories/progress";
import { getCandidateProfile } from "@/repositories/candidate";

const CERTIFICATE_ELIGIBLE_DAYS = 50;
const CERTIFICATE_REQUIRED_DAY = 60;

export type IssueResult =
  | { ok: true; data: { certificateId: string; alreadyIssued: boolean } }
  | { ok: false; message: string };

export async function ensureClaudeCertificate(userId: string): Promise<IssueResult> {
  const [enrollment] = await listChallengePeRows({
    userId,
    domains: [Domain.CLAUDE],
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

  const candidate = await getCandidateProfile(userId);
  const fullName = candidate?.fullName?.trim() ?? "";
  if (!fullName) {
    const [existingCert, existingCred] = await Promise.all([
      prisma.historicalCertificate.findFirst({
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

  const college = candidate?.college ?? null;
  const organization = candidate?.organization ?? null;

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
