import { Domain, EnrollmentStatus } from "@prisma/client";
import { prisma, writeClient } from "@/lib/db";
import { logger } from "@/lib/logger";
import { applyChallengeProgramEnrollment } from "@/repositories/enrollment-state";
import { applyVisibilityChange } from "@/repositories/visibility";
import { mintProgressRowId } from "@/repositories/ids";
import { findChallengeEnrollment, getChallengeByDomain } from "@/repositories/learning";

export type CoreDomain = Extract<Domain, "AI" | "DS" | "SE">;

export const CORE_TRACK_PATH: Record<CoreDomain, string> = {
  AI: "/ai",
  DS: "/ds",
  SE: "/se",
};

export function isCoreDomain(value: string | undefined): value is CoreDomain {
  return value === "AI" || value === "DS" || value === "SE";
}

export type CreateCoreEnrollmentResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "no_user"
        | "no_challenge"
        | "already_enrolled"
        | "abandoned"
        | "internal_error";
      message: string;
    };

/**
 * Adds an AI / DS / SE challenge enrollment for an existing user joining a
 * second (or third) core track. First track joined backfills a null profile domain.
 */
export async function createCoreEnrollment(
  userId: string,
  domain: CoreDomain,
): Promise<CreateCoreEnrollmentResult> {
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

  const challenge = await getChallengeByDomain(domain);
  if (!challenge) {
    return {
      ok: false,
      reason: "no_challenge",
      message: "Challenge for this track is not available yet.",
    };
  }

  const existing = await findChallengeEnrollment(userId, { domain });
  if (existing?.status === EnrollmentStatus.ABANDONED) {
    return {
      ok: false,
      reason: "abandoned",
      message: "You were removed from this track and cannot re-join it.",
    };
  }
  if (existing) {
    return {
      ok: false,
      reason: "already_enrolled",
      message: "You are already enrolled in this track.",
    };
  }

  try {
    await writeClient().$transaction(async (tx) => {
      const handle = mintProgressRowId();
      await applyVisibilityChange(tx, {
        userId,
        kind: "challenge_enroll",
      });
      await applyChallengeProgramEnrollment(tx, {
        id: handle,
        userId,
        domain,
        status: EnrollmentStatus.ACTIVE,
        startedAt: new Date(),
        completedAt: null,
      });
    });
    return { ok: true };
  } catch (e) {
    logger.error("[enrollment] createCoreEnrollment failed", {
      error: String(e),
    });
    return {
      ok: false,
      reason: "internal_error",
      message: "Something went wrong. Please try again.",
    };
  }
}
