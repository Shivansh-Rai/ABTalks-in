import "server-only";
import { Role } from "@prisma/client";
import { writeClient } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  PROFILE_DEFAULT_CONSENT_SOURCE,
  applyVisibilityChange,
} from "@/repositories/visibility";

export { PROFILE_DEFAULT_CONSENT_SOURCE };

/**
 * The platform default discovery record, for a candidate whose profile has
 * become usable.
 *
 * Plan 117 made discoverability derive from profile state: a usable profile —
 * a name and at least one claimed skill — is what puts someone in the PROFILE
 * track. Enrolment dual-write used to be the only CandidateVisibility writer,
 * so a candidate who filled a profile without enrolling had no row, and
 * `searchableUserWhere()` treated no row as not searchable.
 *
 * CREATE ONLY. Any existing row is a decision already made and is left as-is.
 * W2 writes go through `applyVisibilityChange` (kind `usable_profile`).
 *
 * Plan 133 still holds: no candidate-controlled visibility switch.
 */
export async function ensureDiscoveryRecordForUsableProfile(
  userId: string,
): Promise<boolean> {
  const db = writeClient();
  const usable = await db.candidateProfile.count({
    where: {
      userId,
      fullName: { not: "" },
      skills: { some: { claimedByCandidate: true } },
      user: { role: Role.STUDENT, deletedAt: null, disabledAt: null },
    },
  });
  if (usable === 0) return false;

  const result = await applyVisibilityChange(db, {
    userId,
    kind: "usable_profile",
  });
  if (result.created) {
    logger.info("[discovery] default record created for usable profile", { userId });
  }
  return result.created;
}

/**
 * The profile save's call: never lets a discovery-record failure fail the save
 * the candidate just made. The record is retried on their next save.
 */
export async function ensureDiscoveryRecordAfterProfileSave(userId: string): Promise<void> {
  try {
    await ensureDiscoveryRecordForUsableProfile(userId);
  } catch (error) {
    logger.error("[discovery] default record not created", {
      userId,
      error: String(error).slice(0, 240),
    });
  }
}
