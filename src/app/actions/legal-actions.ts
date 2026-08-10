"use server";

import { auth } from "@/auth";
import {
  clearAttributionCookies,
  setConsentCookie,
  setRefCookie,
  setSrcCookie,
} from "@/lib/cookies";
import { prisma } from "@/lib/db";
import {
  cookieConsentSchema,
  dataRightsRequestSchema,
} from "@/lib/validations/legal";

export async function submitDataRightsRequestAction(input: unknown) {
  const parsed = dataRightsRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const session = await auth();
  const email = parsed.data.email.trim().toLowerCase();

  await prisma.dataRightsRequest.create({
    data: {
      userId: session?.user?.id ?? null,
      email,
      type: parsed.data.type,
      message: parsed.data.message?.trim() || null,
    },
    select: { id: true },
  });

  return { ok: true as const };
}

/**
 * Records the visitor's cookie choice and applies it immediately.
 *
 * Middleware sets no attribution cookies before a choice exists, so the client
 * passes through whatever `?ref=` / `?s=` are on the current URL; the cookie
 * helpers re-validate both. No database row is written — for anonymous
 * visitors there is no identifier, and logging an IP per visitor would itself
 * be a privacy cost. The cookie is the record.
 */
export async function setCookieConsentAction(input: unknown) {
  const parsed = cookieConsentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { choice, ref, src } = parsed.data;
  await setConsentCookie(choice);

  if (choice === "essential") {
    await clearAttributionCookies();
  } else {
    if (ref) await setRefCookie(ref);
    if (src) await setSrcCookie(src);
  }

  return { ok: true as const, data: { choice } };
}
