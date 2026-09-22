/**
 * W8 ProgramMember current-state / write-authority boundary.
 *
 * Membership, unlock, skip tokens, score snapshots, and AI recommendations
 * always write ProgramEnrollment pe_pm_<memberId>. ENABLE_NEW_PROGRAM_STATE
 * / ENABLE_NEW_PROGRAM_STATE_WRITES are ignored (Phase 8-D): frozen
 * ProgramMember mutable values must not overwrite ProgramEnrollment.
 * ProgramMember mutable current-state is a compatibility mirror while
 * ENABLE_LEGACY_PROGRAM_MEMBER_MIRROR is not `"false"`.
 *
 * W8-B Outcome A: ProgramMember.id remains the structural FK anchor for
 * ProgramProject, ProgramInterview, GeneralInterview, RecruiterShortlistItem,
 * ProgramCommitDay, and frozen W6 ProgramMissionSubmission. Anchor creation
 * (`ensureProgramMemberAnchor`) is independent of the mutable-state mirror.
 *
 * Identity stays CandidateProfile (W4). Recruiter permission stays
 * CandidateVisibility (W2). Does not take Enrollment denorms,
 * StudentProfile.domain, frozen W1–W7 families, or EnrollmentProgress.
 */
import "server-only";
import {
  EnrollmentStatusV2,
  ProgramMemberStatus,
  type Prisma,
  type PrismaClient,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { mapMemberStatus } from "@/repositories/dual-write";
import {
  cohortSlugForProgramCohort,
  memberIdFromPe,
  mintProgressRowId,
  peIdForMember,
} from "@/repositories/ids";
import { applyVisibilityChange } from "@/repositories/visibility";

type Tx = Prisma.TransactionClient | PrismaClient;

export type ProgramMemberIdentitySnapshot = {
  fullName: string;
  jobRole?: string | null;
  company?: string | null;
  yearsExperience?: number | null;
  education?: string | null;
  university?: string | null;
  graduationYear?: number | null;
  skills?: string[];
  linkedinUrl?: string | null;
  resumeUrl?: string | null;
  phone?: string | null;
  githubUsername: string;
  githubRepoUrl: string;
};

export type ProgramScoreSnapshot = {
  missionPoints: number;
  conceptPoints: number;
  commitPoints: number;
  projectPoints: number;
  totalScore: number;
  cleanPassCount: number;
};

export type ProgramMemberStateSnapshot = ProgramScoreSnapshot & {
  status: ProgramMemberStatus;
  highestUnlockedDay: number;
  skipTokensUsed: number;
  githubRepoUrl: string | null;
  aiRecommendation: string | null;
  aiRecommendationAt: Date | null;
  enrolledAt: Date | null;
  completedAt: Date | null;
};

function savepointName(label: string): string {
  const cleaned = label.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24);
  return `pmmir_${cleaned || "x"}`;
}

function injectedMirrorFailure(): boolean {
  return process.env.PROGRAM_MEMBER_FAIL_LEGACY_MIRROR === "1";
}

function mapPeStatusToMember(
  status: EnrollmentStatusV2,
): ProgramMemberStatus {
  switch (status) {
    case EnrollmentStatusV2.APPLIED:
      return ProgramMemberStatus.APPLIED;
    case EnrollmentStatusV2.WAITLISTED:
      return ProgramMemberStatus.WAITLISTED;
    case EnrollmentStatusV2.COMPLETED:
      return ProgramMemberStatus.COMPLETED;
    case EnrollmentStatusV2.DROPPED:
      return ProgramMemberStatus.DROPPED;
    default:
      return ProgramMemberStatus.ENROLLED;
  }
}

function pmGithubData(
  githubRepoUrl: string | null | undefined,
): { githubRepoUrl: string } | Record<string, never> {
  if (githubRepoUrl === undefined) return {};
  return { githubRepoUrl: githubRepoUrl ?? "" };
}

function totalFrom(parts: {
  missionPoints: number;
  conceptPoints: number;
  commitPoints: number;
  projectPoints: number;
}): number {
  return (
    parts.missionPoints +
    parts.conceptPoints +
    parts.commitPoints +
    parts.projectPoints
  );
}

async function resolveCohortId(
  tx: Tx,
  programCohortId: string,
): Promise<string> {
  const slug = cohortSlugForProgramCohort(programCohortId);
  const cohort = await tx.cohort.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!cohort) throw new Error(`Missing cohort ${slug}`);
  return cohort.id;
}

/**
 * W8-B Outcome A: ProgramMember.id is still required by FKs
 * (ProgramProject, ProgramInterview, GeneralInterview, RecruiterShortlistItem,
 * ProgramCommitDay, frozen ProgramMissionSubmission). Create a row with
 * Prisma-required columns only. Do not copy scores, unlock, recommendation,
 * identity, or recruiter-consent snapshots. Mutable state is mirrored
 * separately, and only while ENABLE_LEGACY_PROGRAM_MEMBER_MIRROR is on.
 */
async function ensureProgramMemberAnchor(
  tx: Tx,
  input: {
    memberId: string;
    userId: string;
    programCohortId: string;
    existingId: string | null;
  },
): Promise<{ created: boolean }> {
  if (input.existingId) return { created: false };
  const already = await tx.programMember.findUnique({
    where: { id: input.memberId },
    select: { id: true },
  });
  if (already) return { created: false };
  await tx.programMember.create({
    data: {
      id: input.memberId,
      userId: input.userId,
      cohortId: input.programCohortId,
      status: ProgramMemberStatus.APPLIED,
      fullName: "",
      githubUsername: "",
      githubRepoUrl: "",
    },
  });
  return { created: true };
}

async function mirrorProgramMemberLegacyState(
  tx: Tx,
  label: string,
  fn: () => Promise<void>,
): Promise<boolean> {
  void tx; void label; void fn;
  return false;
}

async function ensureDiscoverable(
  tx: Tx,
  userId: string,
  consentedAt: Date | null | undefined,
): Promise<void> {
  await applyVisibilityChange(tx, {
    userId,
    kind: "program_member",
    consentedAt: consentedAt ?? null,
  });
}

export async function applyProgramMembershipChange(
  tx: Tx,
  input: {
    memberId?: string;
    userId: string;
    programCohortId: string;
    status: ProgramMemberStatus;
    enrolledAt?: Date | null;
    completedAt?: Date | null;
    githubRepoUrl?: string;
    identity?: ProgramMemberIdentitySnapshot;
    recruiterVisibilityConsentAt?: Date | null;
  },
): Promise<{ memberId: string; created: boolean; mirrorFailed: boolean }> {
  const existing = await tx.programMember.findUnique({
    where: {
      userId_cohortId: {
        userId: input.userId,
        cohortId: input.programCohortId,
      },
    },
    select: { id: true },
  });
  let memberId = input.memberId ?? existing?.id;
  if (!memberId) {
    const cohortId = await resolveCohortId(tx, input.programCohortId);
    const existingPe = await tx.programEnrollment.findUnique({
      where: { userId_cohortId: { userId: input.userId, cohortId } },
      select: { id: true },
    });
    const fromPe = existingPe ? memberIdFromPe(existingPe.id) : null;
    memberId = fromPe ?? mintProgressRowId();
  }
  memberId = memberId ?? mintProgressRowId();
  const created = !existing;

  {
    await ensureDiscoverable(
      tx,
      input.userId,
      input.recruiterVisibilityConsentAt,
    );
  }

  const cohortId = await resolveCohortId(tx, input.programCohortId);
  const peId = peIdForMember(memberId);
  const now = new Date();
  const enrolledAt =
    input.enrolledAt !== undefined
      ? input.enrolledAt
      : input.status === ProgramMemberStatus.ENROLLED
        ? now
        : null;
  await tx.programEnrollment.upsert({
    where: { id: peId },
    create: {
      id: peId,
      userId: input.userId,
      cohortId,
      status: mapMemberStatus(input.status),
      startedAt: enrolledAt ?? now,
      joinedAt: now,
      enrolledAt,
      completedAt: input.completedAt ?? null,
      droppedAt:
        input.status === ProgramMemberStatus.DROPPED ? now : null,
      githubRepoUrl: input.identity?.githubRepoUrl ?? input.githubRepoUrl,
    },
    update: {
      status: mapMemberStatus(input.status),
      ...(input.enrolledAt !== undefined ? { enrolledAt: input.enrolledAt } : {}),
      ...(input.completedAt !== undefined
        ? { completedAt: input.completedAt }
        : {}),
      ...(input.status === ProgramMemberStatus.DROPPED ? { droppedAt: now } : {}),
      ...(input.githubRepoUrl !== undefined
        ? { githubRepoUrl: input.githubRepoUrl }
        : input.identity?.githubRepoUrl
          ? { githubRepoUrl: input.identity.githubRepoUrl }
          : {}),
    },
  });

  // Structural FK anchor is independent of the mutable-state mirror.
  await ensureProgramMemberAnchor(tx, {
    memberId,
    userId: input.userId,
    programCohortId: input.programCohortId,
    existingId: existing?.id ?? null,
  });

  const mirrorFailed = await mirrorProgramMemberLegacyState(
    tx,
    "membership",
    async () => {
      const identity = input.identity;
      await tx.programMember.update({
        where: { id: memberId },
        data: {
          status: input.status,
          ...(input.enrolledAt !== undefined
            ? { enrolledAt: input.enrolledAt }
            : {}),
          ...(input.completedAt !== undefined
            ? { completedAt: input.completedAt }
            : {}),
          ...(identity ?? {}),
        },
      });
    },
  );

  return { memberId, created, mirrorFailed };
}

export async function applyProgramUnlockChange(
  tx: Tx,
  input: {
    memberId: string;
    highestUnlockedDay?: number;
    skipTokensUsed?: number;
    githubRepoUrl?: string | null;
  },
): Promise<{ mirrorFailed: boolean }> {
  const peUpdated = await tx.programEnrollment.updateMany({
    where: { id: peIdForMember(input.memberId) },
    data: {
      ...(input.highestUnlockedDay !== undefined
        ? { unlockFloorDay: input.highestUnlockedDay }
        : {}),
      ...(input.skipTokensUsed !== undefined
        ? { skipTokensUsed: input.skipTokensUsed }
        : {}),
      ...(input.githubRepoUrl !== undefined
        ? { githubRepoUrl: input.githubRepoUrl }
        : {}),
    },
  });
  if (peUpdated.count === 0) {
    logger.error(
      "[program-state] ProgramEnrollment missing for unlock change",
      { memberId: input.memberId },
    );
  }

  const mirrorFailed = await mirrorProgramMemberLegacyState(tx, "unlock", async () => {
    await tx.programMember.update({
      where: { id: input.memberId },
      data: {
        ...(input.highestUnlockedDay !== undefined
          ? { highestUnlockedDay: input.highestUnlockedDay }
          : {}),
        ...(input.skipTokensUsed !== undefined
          ? { skipTokensUsed: input.skipTokensUsed }
          : {}),
        ...pmGithubData(input.githubRepoUrl),
      },
    });
  });
  return { mirrorFailed };
}

export async function applyProgramScoreChange(
  tx: Tx,
  input: {
    memberId: string;
    missionPoints?: number;
    conceptPoints?: number;
    commitPoints?: number;
    projectPoints?: number;
    cleanPassCount?: number;
    missionPointsDelta?: number;
    cleanPassCountDelta?: number;
  },
): Promise<{ snapshot: ProgramScoreSnapshot; mirrorFailed: boolean }> {
  const current = await readScoreAuthority(tx, input.memberId);
  const next: ProgramScoreSnapshot = {
    missionPoints:
      input.missionPoints ??
      current.missionPoints + (input.missionPointsDelta ?? 0),
    conceptPoints: input.conceptPoints ?? current.conceptPoints,
    commitPoints: input.commitPoints ?? current.commitPoints,
    projectPoints: input.projectPoints ?? current.projectPoints,
    cleanPassCount:
      input.cleanPassCount ??
      current.cleanPassCount + (input.cleanPassCountDelta ?? 0),
    totalScore: 0,
  };
  next.totalScore = totalFrom(next);

  const peUpdated = await tx.programEnrollment.updateMany({
    where: { id: peIdForMember(input.memberId) },
    data: next,
  });
  if (peUpdated.count === 0) {
    logger.error(
      "[program-state] ProgramEnrollment missing for score change",
      { memberId: input.memberId },
    );
  }

  const mirrorFailed = await mirrorProgramMemberLegacyState(tx, "score", async () => {
    await tx.programMember.update({
      where: { id: input.memberId },
      data: next,
    });
  });
  return { snapshot: next, mirrorFailed };
}

export async function applyProgramRecommendationChange(
  tx: Tx,
  input: {
    memberId: string;
    aiRecommendation: string;
    aiRecommendationAt?: Date;
  },
): Promise<{ mirrorFailed: boolean }> {
  const at = input.aiRecommendationAt ?? new Date();
  const data = {
    aiRecommendation: input.aiRecommendation,
    aiRecommendationAt: at,
  };

  const peUpdated = await tx.programEnrollment.updateMany({
    where: { id: peIdForMember(input.memberId) },
    data,
  });
  if (peUpdated.count === 0) {
    logger.error(
      "[program-state] ProgramEnrollment missing for recommendation",
      { memberId: input.memberId },
    );
  }

  const mirrorFailed = await mirrorProgramMemberLegacyState(
    tx,
    "recommendation",
    async () => {
      await tx.programMember.update({
        where: { id: input.memberId },
        data,
      });
    },
  );
  return { mirrorFailed };
}

async function readScoreAuthority(
  tx: Tx,
  memberId: string,
): Promise<ProgramScoreSnapshot> {
  const pe = await tx.programEnrollment.findUnique({
    where: { id: peIdForMember(memberId) },
    select: {
      missionPoints: true,
      conceptPoints: true,
      commitPoints: true,
      projectPoints: true,
      totalScore: true,
      cleanPassCount: true,
    },
  });
  if (pe) return pe;
  return {
    missionPoints: 0,
    conceptPoints: 0,
    commitPoints: 0,
    projectPoints: 0,
    totalScore: 0,
    cleanPassCount: 0,
  };
}

export async function countEnrolledProgramMembers(
  tx: Tx,
  programCohortId: string,
): Promise<number> {
  const slug = cohortSlugForProgramCohort(programCohortId);
  return tx.programEnrollment.count({
    where: {
      id: { startsWith: "pe_pm_" },
      status: EnrollmentStatusV2.ACTIVE,
      cohort: { slug },
    },
  });
}

const DEFAULT_LIVE_STATUSES: ProgramMemberStatus[] = [
  ProgramMemberStatus.ENROLLED,
  ProgramMemberStatus.COMPLETED,
];

function asStatusList(
  status: Prisma.ProgramMemberWhereInput["status"],
): ProgramMemberStatus[] | null {
  if (!status) return null;
  if (typeof status === "string") return [status as ProgramMemberStatus];
  if (
    typeof status === "object" &&
    status !== null &&
    "in" in status &&
    Array.isArray(status.in)
  ) {
    return status.in.filter(
      (s): s is ProgramMemberStatus => typeof s === "string",
    );
  }
  if (
    typeof status === "object" &&
    status !== null &&
    "equals" in status &&
    typeof status.equals === "string"
  ) {
    return [status.equals as ProgramMemberStatus];
  }
  return null;
}

function asIdList(value: unknown): string[] | undefined {
  if (typeof value === "string") return [value];
  if (
    value &&
    typeof value === "object" &&
    "in" in value &&
    Array.isArray((value as { in: unknown }).in)
  ) {
    return (value as { in: unknown[] }).in.filter(
      (s): s is string => typeof s === "string",
    );
  }
  return undefined;
}

/**
 * Live membership ids from ProgramEnrollment.
 * Frozen ProgramMember.status is not used.
 */
export async function listCanonicalProgramMemberIds(
  input: {
    programCohortId?: string;
    programCohortIds?: string[];
    userId?: string;
    statuses?: ProgramMemberStatus[];
  } = {},
): Promise<string[]> {
  const statuses = input.statuses ?? DEFAULT_LIVE_STATUSES;
  const programCohortIds = [
    ...(input.programCohortId ? [input.programCohortId] : []),
    ...(input.programCohortIds ?? []),
  ];
  const slugs = programCohortIds.map(cohortSlugForProgramCohort);
  const pes = await prisma.programEnrollment.findMany({
    where: {
      id: { startsWith: "pe_pm_" },
      status: { in: statuses.map(mapMemberStatus) },
      ...(input.userId ? { userId: input.userId } : {}),
      ...(slugs.length ? { cohort: { slug: { in: slugs } } } : {}),
    },
    select: { id: true },
  });
  return pes.flatMap((pe) => {
    const id = memberIdFromPe(pe.id);
    return id ? [id] : [];
  });
}

/**
 * Rewrite a ProgramMember where-clause so `status` is evaluated against
 * ProgramEnrollment, not frozen ProgramMember.status.
 */
export async function canonicalProgramMemberWhere(
  where: Prisma.ProgramMemberWhereInput,
): Promise<Prisma.ProgramMemberWhereInput> {
  const statuses = asStatusList(where.status);
  if (!statuses) return where;
  const ids = await listCanonicalProgramMemberIds({
    programCohortIds: asIdList(where.cohortId),
    userId: typeof where.userId === "string" ? where.userId : undefined,
    statuses,
  });
  const rest: Prisma.ProgramMemberWhereInput = { ...where };
  delete rest.status;
  return { AND: [rest, { id: { in: ids } }] };
}

export async function countCanonicalMembersByStatus(
  programCohortId: string,
): Promise<Array<{ status: ProgramMemberStatus; _count: { id: number } }>> {
  const slug = cohortSlugForProgramCohort(programCohortId);
  const groups = await prisma.programEnrollment.groupBy({
    by: ["status"],
    where: { id: { startsWith: "pe_pm_" }, cohort: { slug } },
    _count: { id: true },
  });
  const merged = new Map<ProgramMemberStatus, number>();
  for (const g of groups) {
    const status = mapPeStatusToMember(g.status);
    merged.set(status, (merged.get(status) ?? 0) + g._count.id);
  }
  return [...merged.entries()].map(([status, id]) => ({
    status,
    _count: { id },
  }));
}

/**
 * W8-B compliance exception: wipe ProgramMember PII snapshots even when
 * the mutable-state mirror is frozen. This is not an authority write.
 */
export async function scrubProgramMemberLegacyPii(
  tx: Tx,
  userId: string,
): Promise<void> {
  await tx.programMember.updateMany({
    where: { userId },
    data: {
      fullName: "Deleted User",
      phone: null,
      linkedinUrl: null,
      githubUsername: "deleted",
      githubRepoUrl: "",
      resumeUrl: null,
      jobRole: null,
      company: null,
      university: null,
      education: null,
      graduationYear: null,
      yearsExperience: null,
      skills: [],
    },
  });
  logger.info(
    "[program-state] compliance wipe of frozen ProgramMember identity snapshots",
    { userId },
  );
}

export async function listProgramMemberSnapshots(
  memberIds: string[],
): Promise<Map<string, ProgramMemberStateSnapshot>> {
  const out = new Map<string, ProgramMemberStateSnapshot>();
  if (memberIds.length === 0) return out;
  const pes = await prisma.programEnrollment.findMany({
    where: { id: { in: memberIds.map(peIdForMember) } },
    select: {
      id: true,
      status: true,
      unlockFloorDay: true,
      skipTokensUsed: true,
      githubRepoUrl: true,
      missionPoints: true,
      conceptPoints: true,
      commitPoints: true,
      projectPoints: true,
      totalScore: true,
      cleanPassCount: true,
      aiRecommendation: true,
      aiRecommendationAt: true,
      enrolledAt: true,
      completedAt: true,
    },
  });
  for (const pe of pes) {
    const memberId = pe.id.startsWith("pe_pm_") ? pe.id.slice("pe_pm_".length) : null;
    if (!memberId) continue;
    out.set(memberId, {
      status: mapPeStatusToMember(pe.status),
      highestUnlockedDay: pe.unlockFloorDay ?? 1,
      skipTokensUsed: pe.skipTokensUsed,
      githubRepoUrl: pe.githubRepoUrl,
      missionPoints: pe.missionPoints,
      conceptPoints: pe.conceptPoints,
      commitPoints: pe.commitPoints,
      projectPoints: pe.projectPoints,
      totalScore: pe.totalScore,
      cleanPassCount: pe.cleanPassCount,
      aiRecommendation: pe.aiRecommendation,
      aiRecommendationAt: pe.aiRecommendationAt,
      enrolledAt: pe.enrolledAt,
      completedAt: pe.completedAt,
    });
  }
  return out;
}

const OVERLAY_KEYS = [
  "status",
  "highestUnlockedDay",
  "skipTokensUsed",
  "githubRepoUrl",
  "missionPoints",
  "conceptPoints",
  "commitPoints",
  "projectPoints",
  "totalScore",
  "cleanPassCount",
  "aiRecommendation",
  "aiRecommendationAt",
  "enrolledAt",
  "completedAt",
] as const;

export async function overlayProgramMemberState<T extends { id: string }>(
  rows: T[],
): Promise<T[]> {
  if (rows.length === 0) return rows;
  const snaps = await listProgramMemberSnapshots(rows.map((r) => r.id));
  return rows.map((row) => {
    const snap = snaps.get(row.id);
    if (!snap) return row;
    const next: Record<string, unknown> = { ...row };
    for (const key of OVERLAY_KEYS) {
      if (Object.prototype.hasOwnProperty.call(row, key)) {
        next[key] = snap[key];
      }
    }
    return next as T;
  });
}

export function compareProgramScoreRows<
  T extends {
    totalScore: number;
    projectPoints?: number;
    missionPoints?: number;
    enrolledAt?: Date | null;
    fullName?: string;
    id?: string;
  },
>(a: T, b: T): number {
  if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
  if ((b.projectPoints ?? 0) !== (a.projectPoints ?? 0)) {
    return (b.projectPoints ?? 0) - (a.projectPoints ?? 0);
  }
  if ((b.missionPoints ?? 0) !== (a.missionPoints ?? 0)) {
    return (b.missionPoints ?? 0) - (a.missionPoints ?? 0);
  }
  const ae = a.enrolledAt?.getTime() ?? 0;
  const be = b.enrolledAt?.getTime() ?? 0;
  if (ae !== be) return ae - be;
  const an = a.fullName ?? "";
  const bn = b.fullName ?? "";
  if (an !== bn) return an.localeCompare(bn);
  return (a.id ?? "").localeCompare(b.id ?? "");
}
