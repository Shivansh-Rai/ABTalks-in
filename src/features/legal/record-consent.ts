import "server-only";

import { LegalDocument, Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import { prisma } from "@/lib/db";

export type ConsentSource =
  | "register"
  | "workshop"
  | "hackathon"
  | "program_apply"
  | "talent_register"
  | "cohort_us"
  | "cohort_india";

type RecordConsentArgs = {
  userId?: string | null;
  email?: string | null;
  source: ConsentSource;
  /** When false, skip reading request headers (e.g. tests). Default true. */
  captureRequestMeta?: boolean;
};

async function requestMeta(capture: boolean): Promise<{
  ip: string | null;
  userAgent: string | null;
}> {
  if (!capture) return { ip: null, userAgent: null };
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    const ip =
      forwarded?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      null;
    return { ip, userAgent: h.get("user-agent") };
  } catch {
    return { ip: null, userAgent: null };
  }
}

/** Writes TERMS + PRIVACY consent rows for the current document versions. */
export async function recordLegalConsents(
  args: RecordConsentArgs,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const db = tx ?? prisma;
  const email = args.email?.trim().toLowerCase() || null;
  const userId = args.userId || null;
  if (!userId && !email) {
    throw new Error("recordLegalConsents requires userId or email");
  }

  const { ip, userAgent } = await requestMeta(args.captureRequestMeta !== false);
  const base = {
    userId,
    email,
    source: args.source,
    ip,
    userAgent,
  };

  await db.legalConsent.createMany({
    data: [
      {
        ...base,
        document: LegalDocument.TERMS,
        version: TERMS_VERSION,
      },
      {
        ...base,
        document: LegalDocument.PRIVACY,
        version: PRIVACY_VERSION,
      },
    ],
  });
}
