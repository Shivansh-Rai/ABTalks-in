"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { allowHit } from "@/features/code-runner/throttle";
import {
  PRACTICE_BASE,
  PRACTICE_SUBMIT_COOLDOWN_MS,
} from "@/features/coding-practice/constants";
import {
  submitPracticeSolution,
  type PracticeSubmitData,
} from "@/features/coding-practice/submit";
import { isCodingPracticeEnabled } from "@/lib/feature-flags";
import { logger } from "@/lib/logger";
import {
  practiceEnrollSchema,
  practiceSubmitSchema,
} from "@/lib/validations/coding-practice";
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

/**
 * Submit a solution. Runs every test on the server and saves the solution
 * only when it is accepted. A failed Submit writes nothing.
 */
export async function submitPracticeSolutionAction(
  input: unknown,
): Promise<
  { ok: true; data: PracticeSubmitData } | { ok: false; message: string }
> {
  if (!isCodingPracticeEnabled()) {
    return { ok: false, message: "Coding practice is not available right now." };
  }
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, message: "Please sign in to continue." };

  const parsed = practiceSubmitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid submission." };

  if (!allowHit(`submit:${userId}`, PRACTICE_SUBMIT_COOLDOWN_MS)) {
    return {
      ok: false,
      message: "Please wait a few seconds before submitting again.",
    };
  }

  try {
    const result = await submitPracticeSolution(userId, parsed.data);
    if (result.ok && result.data.kind === "accepted") {
      revalidatePath(`${PRACTICE_BASE}/${parsed.data.challenge}`);
    }
    return result;
  } catch (error) {
    logger.error("[coding-practice] submit", {
      challenge: parsed.data.challenge,
      day: parsed.data.day,
      slot: parsed.data.slot,
      error: String(error),
    });
    return {
      ok: false,
      message: "Could not submit your solution. Please try again.",
    };
  }
}
