"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { notifyDataRightsRequest } from "@/features/legal/notify-data-request";
import { recordLegalConsents } from "@/features/legal/record-consent";
import { getAdminContext } from "@/lib/admin-auth";
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
  resolveDataRightsRequestSchema,
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

  const message = parsed.data.message?.trim() || null;

  const created = await prisma.dataRightsRequest.create({
    data: {
      userId: session?.user?.id ?? null,
      email,
      type: parsed.data.type,
      message,
    },
    select: { id: true },
  });

  // Best-effort: the request is already recorded, so a mail failure must not
  // surface to the user or change the result.
  await notifyDataRightsRequest({
    id: created.id,
    email,
    type: parsed.data.type,
    message,
  });

  return { ok: true as const };
}

/** Records fresh TERMS + PRIVACY consent at the current versions. */
export async function acceptCurrentLegalVersionsAction() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { ok: false as const, message: "Not signed in" };
  }

  await recordLegalConsents({
    userId,
    email: session.user.email ?? null,
    source: "reconsent",
  });

  return { ok: true as const };
}

/** Admin-only: close out a data-rights request. */
export async function resolveDataRightsRequestAction(input: unknown) {
  const admin = await getAdminContext();
  if (!admin) {
    return { ok: false as const, message: "Not authorized" };
  }

  const parsed = resolveDataRightsRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  await prisma.dataRightsRequest.update({
    where: { id: parsed.data.id },
    data: { status: parsed.data.status },
    select: { id: true },
  });

  revalidatePath("/admin/data-requests");
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
