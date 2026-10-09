"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { PRACTICE_BASE } from "@/features/coding-practice/constants";
import { isCodingPracticeEnabled } from "@/lib/feature-flags";
import { logger } from "@/lib/logger";
import { practiceEnrollSchema } from "@/lib/validations/coding-practice";
import { getProfileSummary } from "@/repositories/candidate";
import { createPracticeEnrollment } from "@/repositories/coding-practice";

type ActionResult = { ok: true } | { ok: false; message: string };

/** Start a coding practice challenge. Day 1 opens at once. */
export async function enrollInPracticeAction(
  input: unknown,
): Promise<ActionResult> {
  if (!isCodingPracticeEnabled()) {
    return { ok: false, message: "Coding practice is not available right now." };
  }
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, message: "Please sign in to continue." };

  const parsed = practiceEnrollSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Challenge not found." };

  try {
    const profile = await getProfileSummary(userId);
    if (!profile) {
      return { ok: false, message: "Complete your registration first." };
    }
    const result = await createPracticeEnrollment(userId, parsed.data.challenge);
    if (!result.ok) {
      return { ok: false, message: "This challenge is not open right now." };
    }
  } catch (error) {
    logger.error("[coding-practice] enrol", {
      challenge: parsed.data.challenge,
      error: String(error),
    });
    return { ok: false, message: "Could not start the challenge. Please try again." };
  }

  revalidatePath(`${PRACTICE_BASE}/${parsed.data.challenge}`);
  return { ok: true };
}
