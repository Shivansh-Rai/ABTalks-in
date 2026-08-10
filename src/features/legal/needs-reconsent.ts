import "server-only";

import { LegalDocument } from "@prisma/client";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * True when the user's most recent acceptance predates the current document
 * versions. Nothing compared these before, so bumping a version used to leave
 * every existing user silently on the old text.
 */
export async function needsReconsent(userId: string): Promise<boolean> {
  try {
    const [terms, privacy] = await Promise.all([
      prisma.legalConsent.findFirst({
        where: { userId, document: LegalDocument.TERMS },
        orderBy: { acceptedAt: "desc" },
        select: { version: true },
      }),
      prisma.legalConsent.findFirst({
        where: { userId, document: LegalDocument.PRIVACY },
        orderBy: { acceptedAt: "desc" },
        select: { version: true },
      }),
    ]);

    // No prior consent at all: these are pre-057 accounts. Asking them to
    // accept the current documents is exactly the point of the banner.
    return (
      terms?.version !== TERMS_VERSION || privacy?.version !== PRIVACY_VERSION
    );
  } catch (error) {
    // The banner is advisory; the dashboard is not. If LegalConsent is
    // unreachable — most likely migration 20260808120000_legal_consent_and_rights
    // has not been applied to this database — log it and render no banner
    // rather than 500 the main page for every user.
    logger.error("[legal] needsReconsent query failed", {
      userId,
      error: String(error),
    });
    return false;
  }
}
