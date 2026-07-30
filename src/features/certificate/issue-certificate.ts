import "server-only";
import {
  CertificateType,
  Domain,
  EnrollmentStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { generateCertificateId } from "./generate-certificate-id";

const CERTIFICATE_ELIGIBLE_DAYS = 50;

export type IssueResult =
  | { ok: true; data: { certificateId: string; alreadyIssued: boolean } }
  | { ok: false; message: string };

export async function ensureClaudeCertificate(userId: string): Promise<IssueResult> {
  const enrollment = await prisma.enrollment.findFirst({
    where: { userId, domain: Domain.CLAUDE },
    select: {
      id: true,
      status: true,
      daysCompleted: true,
      longestStreak: true,
      completedAt: true,
      challenge: { select: { totalDays: true } },
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

  const eligible =
    enrollment.status === EnrollmentStatus.COMPLETED ||
    enrollment.daysCompleted >= CERTIFICATE_ELIGIBLE_DAYS;

  if (!eligible) {
    return { ok: false, message: "Challenge not completed yet" };
  }

  const existing = await prisma.certificate.findUnique({
    where: { enrollmentId: enrollment.id },
    select: { certificateId: true },
  });
  if (existing) {
    return {
      ok: true,
      data: { certificateId: existing.certificateId, alreadyIssued: true },
    };
  }

  const fullName = enrollment.user.studentProfile?.fullName?.trim() ?? "";
  if (!fullName) {
    return {
      ok: false,
      message: "Complete your profile name before claiming your certificate",
    };
  }

  const college = enrollment.user.studentProfile?.college ?? null;
  const organization = enrollment.user.studentProfile?.organization ?? null;

  try {
    const certificateId = await generateCertificateId(
      CertificateType.CLAUDE_CHALLENGE,
    );
    const created = await prisma.certificate.create({
      data: {
        certificateId,
        userId,
        type: CertificateType.CLAUDE_CHALLENGE,
        recipientName: fullName,
        domain: Domain.CLAUDE,
        enrollmentId: enrollment.id,
        issuedAt: enrollment.completedAt ?? new Date(),
        metadata: {
          daysCompleted: enrollment.daysCompleted,
          longestStreak: enrollment.longestStreak,
          completedAt: enrollment.completedAt?.toISOString() ?? null,
          college,
          organization,
        },
      },
      select: { certificateId: true },
    });

    return {
      ok: true,
      data: { certificateId: created.certificateId, alreadyIssued: false },
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const raced = await prisma.certificate.findUnique({
        where: { enrollmentId: enrollment.id },
        select: { certificateId: true },
      });
      if (raced) {
        return {
          ok: true,
          data: { certificateId: raced.certificateId, alreadyIssued: true },
        };
      }
    }

    logger.error("Could not issue certificate", {
      userId,
      error: String(error),
    });
    return { ok: false, message: "Could not issue certificate" };
  }
}
