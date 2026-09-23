/**
 * Challenge ProgramEnrollment current-state writer (`pe_enr_*`).
 *
 * Days/lastSubmittedDay are derived from challenge ActivityAttempt.
 * Track streaks live on ProgramEnrollment. Recruiter permission stays
 * CandidateVisibility. Does not write EnrollmentProgress.
 */
import "server-only";
import {
  Domain,
  EnrollmentStatus,
  EnrollmentStatusV2,
  type Prisma,
  type PrismaClient,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  cohortSlugForDomain,
  domainFromChallengeCohortSlug,
  enrollmentIdFromPe,
  peIdForEnrollment,
} from "@/repositories/ids";

type Tx = Prisma.TransactionClient | PrismaClient;

export type ChallengeEnrollmentState = {
  id: string;
  userId: string;
  domain: string;
  status: EnrollmentStatus;
  startedAt: Date;
  completedAt: Date | null;
};

export function mapChallengeEnrollmentStatus(
  status: EnrollmentStatus,
): EnrollmentStatusV2 {
  if (status === EnrollmentStatus.COMPLETED) return EnrollmentStatusV2.COMPLETED;
  if (status === EnrollmentStatus.ABANDONED) return EnrollmentStatusV2.DROPPED;
  return EnrollmentStatusV2.ACTIVE;
}

/**
 * Canonical challenge ProgramEnrollment writer (`pe_enr_*`).
 * Does not stamp CandidateVisibility.
 */
export async function applyChallengeProgramEnrollment(
  tx: Tx,
  enrollment: ChallengeEnrollmentState,
): Promise<{ id: string }> {
  const peId = peIdForEnrollment(enrollment.id);
  const slug = cohortSlugForDomain(enrollment.domain);
  const cohort = await tx.cohort.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!cohort) throw new Error(`Missing cohort ${slug}`);
  const status = mapChallengeEnrollmentStatus(enrollment.status);
  await tx.programEnrollment.upsert({
    where: { id: peId },
    create: {
      id: peId,
      userId: enrollment.userId,
      cohortId: cohort.id,
      status,
      startedAt: enrollment.startedAt,
      enrolledAt: enrollment.startedAt,
      joinedAt: enrollment.startedAt,
      completedAt: enrollment.completedAt,
    },
    update: {
      status,
      completedAt: enrollment.completedAt,
    },
  });
  return { id: peId };
}

export async function applyChallengeProgramEnrollmentById(
  tx: Tx,
  enrollmentId: string,
): Promise<{ id: string } | null> {
  const peId = peIdForEnrollment(enrollmentId);
  const pe = await tx.programEnrollment.findUnique({
    where: { id: peId },
    select: {
      id: true,
      userId: true,
      status: true,
      startedAt: true,
      completedAt: true,
      cohort: { select: { slug: true } },
    },
  });
  if (!pe) return null;
  const domain = domainFromChallengeCohortSlug(pe.cohort.slug);
  if (!domain) return null;
  return applyChallengeProgramEnrollment(tx, {
    id: enrollmentIdFromPe(pe.id) ?? enrollmentId,
    userId: pe.userId,
    domain,
    status:
      pe.status === EnrollmentStatusV2.COMPLETED
        ? EnrollmentStatus.COMPLETED
        : pe.status === EnrollmentStatusV2.DROPPED
          ? EnrollmentStatus.ABANDONED
          : EnrollmentStatus.ACTIVE,
    startedAt: pe.startedAt,
    completedAt: pe.completedAt,
  });
}

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

  return { mirrorFailed: false };
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
  void tx; void userId; void domain;
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
  const pes = await prisma.programEnrollment.findMany({
    where: {
      userId: { in: unique },
      id: { startsWith: "pe_enr_" },
    },
    orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
    select: { userId: true, cohort: { select: { slug: true } } },
  });
  for (const pe of pes) {
    if (out.has(pe.userId)) continue;
    const domain = domainFromChallengeCohortSlug(pe.cohort.slug);
    if (domain) out.set(pe.userId, domain);
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
  void legacy;
  return getPrimaryChallengeDomain(userId);
}

export async function displayedChallengeDomains(
  entries: Array<{ userId: string; legacy: Domain | null | undefined }>,
): Promise<Map<string, Domain | null>> {
  if (entries.length === 0) return new Map();
  return listPrimaryChallengeDomains(entries.map((entry) => entry.userId));
}

export async function listChallengePeRows(input: {
  userId?: string;
  userIds?: string[];
  domains?: Domain[];
  excludeAbandoned?: boolean;
  searchName?: string;
}): Promise<
  Array<{
    id: string;
    userId: string;
    domain: Domain;
    status: EnrollmentStatus;
    startedAt: Date;
    completedAt: Date | null;
    daysCompleted: number;
    currentStreak: number;
    longestStreak: number;
    lastSubmittedDay: number | null;
  }>
> {
  const slugs = (input.domains ?? []).map((d) => cohortSlugForDomain(d));
  const pes = await prisma.programEnrollment.findMany({
    where: {
      id: { startsWith: "pe_enr_" },
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.userIds ? { userId: { in: input.userIds } } : {}),
      ...(input.excludeAbandoned
        ? { status: { not: EnrollmentStatusV2.DROPPED } }
        : {}),
      ...(slugs.length ? { cohort: { slug: { in: slugs } } } : {}),
      ...(input.searchName
        ? {
            user: {
              candidateProfile: {
                fullName: { contains: input.searchName, mode: "insensitive" },
              },
            },
          }
        : {}),
    },
    select: {
      id: true,
      userId: true,
      status: true,
      joinedAt: true,
      startedAt: true,
      completedAt: true,
      trackCurrentStreak: true,
      trackLongestStreak: true,
      cohort: { select: { slug: true } },
    },
  });
  const rows = pes.flatMap((pe) => {
    const enrollmentId = enrollmentIdFromPe(pe.id);
    const domain = domainFromChallengeCohortSlug(pe.cohort.slug);
    if (!enrollmentId || !domain) return [];
    if (input.domains && !input.domains.includes(domain)) return [];
    return [
      {
        id: enrollmentId,
        userId: pe.userId,
        domain,
        status:
          pe.status === EnrollmentStatusV2.COMPLETED
            ? EnrollmentStatus.COMPLETED
            : pe.status === EnrollmentStatusV2.DROPPED
              ? EnrollmentStatus.ABANDONED
              : EnrollmentStatus.ACTIVE,
        startedAt: pe.joinedAt ?? pe.startedAt,
        completedAt: pe.completedAt,
        daysCompleted: 0,
        currentStreak: pe.trackCurrentStreak,
        longestStreak: pe.trackLongestStreak,
        lastSubmittedDay: null as number | null,
      },
    ];
  });
  const { overlayChallengeProgressFields } = await import(
    "@/repositories/progress"
  );
  return overlayChallengeProgressFields(rows);
}
