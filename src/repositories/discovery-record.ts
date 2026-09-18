import "server-only";
import { Role } from "@prisma/client";
import { writeClient } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * The platform default discovery record, for a candidate whose profile has
 * become usable.
 *
 * Plan 117 made discoverability derive from profile state: a usable profile —
 * a name and at least one claimed skill — is what puts someone in the PROFILE
 * track. But the only code that created a `CandidateVisibility` row was
 * challenge and cohort enrolment (`repositories/dual-write.ts`), so a candidate
 * who signed up and filled in a full profile without enrolling had no row, and
 * `searchableUserWhere()` treats no row as not searchable. Since 2026-09-01, 11
 * of the 25 people who built a profile were invisible to every recruiter for
 * that reason alone (search-qa audit, 2026-09-17).
 *
 * The same default the enrolment path applies, and nothing more:
 *
 *   - CREATE ONLY. Any existing row is a decision already made — hidden by
 *     moderation, withdrawn by the candidate, closed by the 2b backfill, or
 *     already searchable — and it is never read for its value or changed.
 *     Opening the ~2,150 closed historical rows is a product and legal
 *     decision (published copy still calls discoverability opt-in), not
 *     something a profile save may do.
 *   - Decided by the platform from stored state. Nothing the candidate submits
 *     reaches this function; it takes a user id and reads the profile back.
 *   - `createMany … skipDuplicates` is `ON CONFLICT DO NOTHING`, so two saves
 *     racing cannot fail or produce a second row.
 *
 * Plan 133's rule — no candidate-controlled visibility — still holds: there is
 * no switch, no field and no action; a candidate cannot hide or reveal
 * themselves through the profile, only become eligible for the default.
 */

/** Recorded as the consent source, distinct from the enrolment default. */
export const PROFILE_DEFAULT_CONSENT_SOURCE = "platform_default_profile";

/**
 * Create the default discovery record when the profile is usable and no record
 * exists. Returns whether a row was created.
 *
 * Mirrors `listProfileCandidates` in `repositories/hire.ts` — the PROFILE
 * track's own definition of usable — so a row is created exactly when the
 * search would otherwise have found the candidate; and only for a live
 * candidate (STUDENT) account.
 */
export async function ensureDiscoveryRecordForUsableProfile(
  userId: string,
): Promise<boolean> {
  const db = writeClient();
  const existing = await db.candidateVisibility.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (existing) return false;

  const usable = await db.candidateProfile.count({
    where: {
      userId,
      fullName: { not: "" },
      skills: { some: { claimedByCandidate: true } },
      // Candidate accounts only. A recruiter or admin who fills in a profile
      // is not thereby offered to recruiters — the audit already found two
      // recruiter accounts in the pool through other paths.
      user: { role: Role.STUDENT, deletedAt: null, disabledAt: null },
    },
  });
  if (usable === 0) return false;

  const created = await db.candidateVisibility.createMany({
    data: [
      {
        userId,
        searchableByRecruiters: true,
        consentSource: PROFILE_DEFAULT_CONSENT_SOURCE,
        consentedAt: new Date(),
      },
    ],
    skipDuplicates: true,
  });
  if (created.count > 0) {
    logger.info("[discovery] default record created for usable profile", { userId });
  }
  return created.count > 0;
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
