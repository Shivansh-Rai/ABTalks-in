import { Domain, EnrollmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

export type CreateClaudeEnrollmentResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "not_authenticated"
        | "no_user"
        | "no_challenge"
        | "already_enrolled"
        | "internal_error";
      message: string;
    };

/**
 * Adds a CLAUDE challenge enrollment for an existing user (dashboard modal).
 * Does not modify StudentProfile.domain — primary dashboard stays on original track.
 */
export async function createClaudeEnrollment(
  userId: string,
): Promise<CreateClaudeEnrollmentResult> {
  const userExists = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!userExists) {
    return {
      ok: false,
      reason: "no_user",
      message: "Session expired. Please sign in again.",
    };
  }

  const challenge = await prisma.challenge.findUnique({
    where: { domain: Domain.CLAUDE },
    select: { id: true },
  });
  if (!challenge) {
    return {
      ok: false,
      reason: "no_challenge",
      message: "Claude challenge is not yet available. Please try again later.",
    };
  }

  const existing = await prisma.enrollment.findFirst({
    where: {
      userId,
      challengeId: challenge.id,
    },
    select: { id: true },
  });
  if (existing) {
    return {
      ok: false,
      reason: "already_enrolled",
      message: "You are already enrolled in the Claude Challenge.",
    };
  }

  try {
    await prisma.enrollment.create({
      data: {
        userId,
        challengeId: challenge.id,
        domain: Domain.CLAUDE,
        status: EnrollmentStatus.ACTIVE,
        daysCompleted: 0,
        currentStreak: 0,
        longestStreak: 0,
      },
    });
    return { ok: true };
  } catch (e) {
    console.error("[enrollment] createClaudeEnrollment:", e);
    return {
      ok: false,
      reason: "internal_error",
      message: "Something went wrong. Please try again.",
    };
  }
}
