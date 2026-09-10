"use server";

import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { unlockContactSchema } from "@/lib/validations/hire-unlock";
import {
  previewUnlock,
  revealUnlockedContact,
  unlockContact,
  type RevealedContact,
  type UnlockPreview,
  type UnlockResult,
} from "@/features/hire/unlock-contact";

/**
 * Contact unlock, from the browser (T-229, T-230).
 *
 * Both actions take a candidate handle and nothing else. The cost is read from
 * configuration on the server every time — it is never accepted from, and never
 * confirmed against, anything the client sends. The dialog's numbers are a
 * courtesy to the person deciding; the server decides.
 */

export async function previewUnlockAction(
  input: unknown,
): Promise<UnlockPreview> {
  const parsed = unlockContactSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "CANDIDATE_UNAVAILABLE",
      message: "This candidate is no longer available.",
    };
  }

  try {
    return await previewUnlock(parsed.data.candidateRef);
  } catch (error) {
    logger.error("[hire] previewUnlockAction", { error: String(error) });
    return {
      ok: false,
      reason: "UNAVAILABLE",
      message: "Could not load the cost. Try again.",
    };
  }
}

export async function unlockContactAction(
  input: unknown,
): Promise<UnlockResult> {
  const parsed = unlockContactSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "CANDIDATE_UNAVAILABLE",
      message: "This candidate is no longer available.",
      balanceMinor: 0,
    };
  }

  const result = await unlockContact(parsed.data.candidateRef);

  // Only on a successful unlock. Revalidating a refusal would re-render the
  // desk for no reason, and a refused unlock changed nothing to show.
  if (result.ok) {
    revalidatePath("/hire");
    revalidatePath("/hire/requests");
  }

  return result;
}

/**
 * The contact details this recruiter has already paid for.
 *
 * Read-only, and it grants nothing: `loadProtectedContact` refuses before it
 * selects an email or a phone unless a `CONTACT_SHARED` row already exists for
 * this pair. Calling it without an unlock returns null, which is what the
 * inspector renders as "still locked".
 */
export async function revealContactAction(
  input: unknown,
): Promise<RevealedContact | null> {
  const parsed = unlockContactSchema.safeParse(input);
  if (!parsed.success) return null;

  try {
    return await revealUnlockedContact(parsed.data.candidateRef);
  } catch (error) {
    logger.error("[hire] revealContactAction", { error: String(error) });
    return null;
  }
}
