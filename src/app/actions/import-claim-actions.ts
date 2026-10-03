"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { assertRateLimit, rateLimitSubjectFromHeaders } from "@/lib/rate-limit";
import { removeImportedProfile } from "@/features/resume/import/outreach";

/**
 * "Remove my data" from the imported-profile claim page (plan 171).
 *
 * PUBLIC on purpose: the person has never signed in. The signed token is the
 * only authorisation, and `removeImportedProfile` re-checks that it names a
 * still-REGISTERED import and the user it registered. Rate-limited per client
 * address so the endpoint cannot be used to hammer token guesses.
 */

export type RemoveProfileState =
  | { ok: true; data: { removed: true } }
  | { ok: false; message: string }
  | null;

const schema = z.object({ token: z.string().min(1).max(1024) });

export async function removeImportedProfileAction(
  _prev: RemoveProfileState,
  formData: FormData,
): Promise<RemoveProfileState> {
  const parsed = schema.safeParse({ token: formData.get("token") });
  if (!parsed.success) return { ok: false, message: "This link is no longer valid." };

  const limited = await assertRateLimit({
    bucket: "EMAIL_CODE_IP",
    subjectId: `claim-remove:${await rateLimitSubjectFromHeaders(await headers())}`,
  });
  if (!limited.ok) return { ok: false, message: "Too many attempts. Try again in a few minutes." };

  try {
    const res = await removeImportedProfile(parsed.data.token);
    return res.ok ? { ok: true, data: { removed: true } } : res;
  } catch (error) {
    logger.error("[resume-import] remove imported profile failed", { error: String(error) });
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}
