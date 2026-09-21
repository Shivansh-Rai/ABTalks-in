/**
 * W7-A enrollment denorm current-state boundary.
 *
 * Days/lastSubmittedDay: derived from challenge ActivityAttempt (already W6-B).
 * Track streaks: ProgramEnrollment.trackCurrentStreak / trackLongestStreak
 * (historical snapshots are not fully re-derivable from AA).
 * StudentProfile.domain: first-joined challenge track; SP write is a
 * best-effort mirror and must not fail canonical enrollment.
 *
 * Does not take EnrollmentProgress, ProgramMember, points, certificate,
 * candidate identity, or W6 frozen progress tables.
 */
import "server-only";
import { Domain, type Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { isLegacyEnrollmentDenormMirrorEnabled, isNewEnrollmentStateEnabled } from "@/lib/feature-flags";
import {
  enrollmentIdFromPe,
  peIdForEnrollment,
} from "@/repositories/ids";

type Tx = Prisma.TransactionClient | PrismaClient;

export type EnrollmentProgressDenorm = {
  enrollmentId: string;
  daysCompleted: number;
  currentStreak: number;
  longestStreak: number;
  lastSubmittedDay: number | null;
};

export async function applyEnrollmentProgressDenorm(
  tx: Tx,
  input: EnrollmentProgressDenorm,
): Promise<{ mirrorFailed: boolean }> {
  const peId = peIdForEnrollment(input.enrollmentId);
  const peUpdated = await tx.programEnrollment.updateMany({
    where: { id: peId },
    data: {
      trackCurrentStreak: input.currentStreak,
      trackLongestStreak: input.longestStreak,
    },
  });
  if (peUpdated.count === 0) {
    logger.error(
      "[enrollment-state] ProgramEnrollment snapshot missing; canonical days still AA-derived",
      { enrollmentId: input.enrollmentId, peId },
    );
  }

  if (!isLegacyEnrollmentDenormMirrorEnabled()) {
    return { mirrorFailed: false };
  }

  try {
    await tx.enrollment.update({
      where: { id: input.enrollmentId },
      data: {
        daysCompleted: input.daysCompleted,
        currentStreak: input.currentStreak,
        longestStreak: input.longestStreak,
        lastSubmittedDay: input.lastSubmittedDay,
      },
    });
    return { mirrorFailed: false };
  } catch (err) {
    logger.error(
      "[enrollment-state] Enrollment denorm mirror failed; canonical snapshot kept",
      {
        enrollmentId: input.enrollmentId,
        error: err instanceof Error ? err.stack ?? err.message : String(err),
      },
    );
    return { mirrorFailed: true };
  }
}

/**
 * First-joined challenge track. Never overwrites an already-set SP.domain.
 * Missing StudentProfile is a no-op (0 rows). Canonical enrollment must not fail.
 */
export async function applyEnrollmentDomainMirror(
  tx: Tx,
  userId: string,
  domain: Domain,
): Promise<void> {
  if (!isLegacyEnrollmentDenormMirrorEnabled()) return;
  try {
    await tx.studentProfile.updateMany({
      where: { userId, domain: null },
      data: { domain },
    });
  } catch (err) {
    logger.error(
      "[enrollment-state] StudentProfile.domain mirror failed; canonical enrollment kept",
      {
        userId,
        domain,
        error: err instanceof Error ? err.stack ?? err.message : String(err),
      },
    );
  }
}

export async function listTrackStreakSnapshots(
  enrollmentIds: string[],
): Promise<Map<string, { currentStreak: number; longestStreak: number }>> {
  const out = new Map<string, { currentStreak: number; longestStreak: number }>();
  if (enrollmentIds.length === 0) return out;
  const pes = await prisma.programEnrollment.findMany({
    where: { id: { in: enrollmentIds.map(peIdForEnrollment) } },
    select: {
      id: true,
      trackCurrentStreak: true,
      trackLongestStreak: true,
    },
  });
  for (const pe of pes) {
    const enrollmentId = enrollmentIdFromPe(pe.id);
    if (!enrollmentId) continue;
    out.set(enrollmentId, {
      currentStreak: pe.trackCurrentStreak,
      longestStreak: pe.trackLongestStreak,
    });
  }
  return out;
}

export async function listPrimaryChallengeDomains(
  userIds: string[],
): Promise<Map<string, Domain | null>> {
  const out = new Map<string, Domain | null>();
  if (userIds.length === 0) return out;
  const unique = [...new Set(userIds)];
  // First-joined track uses Enrollment.createdAt, not PE.startedAt.
  // Phase 2 backfill copied cohort calendar starts onto PE.startedAt
  // (and some Enrollment.startedAt), which is not join order.
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: { in: unique } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { userId: true, domain: true },
  });
  for (const row of enrollments) {
    if (out.has(row.userId)) continue;
    out.set(row.userId, row.domain);
  }
  for (const id of unique) {
    if (!out.has(id)) out.set(id, null);
  }
  return out;
}

export async function getPrimaryChallengeDomain(
  userId: string,
): Promise<Domain | null> {
  const map = await listPrimaryChallengeDomains([userId]);
  return map.get(userId) ?? null;
}

export async function displayedChallengeDomain(
  userId: string,
  legacy: Domain | null | undefined,
): Promise<Domain | null> {
  if (!isNewEnrollmentStateEnabled()) return legacy ?? null;
  return getPrimaryChallengeDomain(userId);
}

export async function displayedChallengeDomains(
  entries: Array<{ userId: string; legacy: Domain | null | undefined }>,
): Promise<Map<string, Domain | null>> {
  const out = new Map<string, Domain | null>();
  if (entries.length === 0) return out;
  if (!isNewEnrollmentStateEnabled()) {
    for (const entry of entries) out.set(entry.userId, entry.legacy ?? null);
    return out;
  }
  return listPrimaryChallengeDomains(entries.map((entry) => entry.userId));
}
