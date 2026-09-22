/**
 * W8-A ProgramMember current-state / write-authority boundary.
 *
 * Membership, unlock, skip tokens, score snapshots, and AI recommendations:
 * ProgramEnrollment pe_pm_<memberId> is canonical when
 * ENABLE_NEW_PROGRAM_STATE / ENABLE_NEW_PROGRAM_STATE_WRITES are on.
 * ProgramMember remains a compatibility mirror while
 * ENABLE_LEGACY_PROGRAM_MEMBER_MIRROR is not `"false"`.
 *
 * Identity (name/phone/linkedin/github/skills[]) stays CandidateProfile (W4).
 * Recruiter permission stays CandidateVisibility (W2).
 * Projects stay ProgramProject; interviews stay ProgramInterview /
 * GeneralInterview. Those FKs keep memberId.
 *
 * Does not take Enrollment denorms, StudentProfile.domain, frozen W1–W7
 * families, or EnrollmentProgress.
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
import {
  isLegacyProgramMemberMirrorEnabled,
  isNewProgramStateEnabled,
  isNewProgramStateWritesEnabled,
  isNewVisibilityWritesEnabled,
} from "@/lib/feature-flags";
import {
  dualWriteProgramMember,
  mapMemberStatus,
} from "@/repositories/dual-write";
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

async function runProgramMemberMirror(
  tx: Tx,
  label: string,
  fn: () => Promise<void>,
): Promise<boolean> {
  if (!isLegacyProgramMemberMirrorEnabled()) return false;
  if (injectedMirrorFailure()) {
    logger.error(
      "[program-state] injected ProgramMember mirror failure; canonical kept",
      { label },
    );
    return true;
  }
  const sp = savepointName(label);
  try {
    await tx.$executeRawUnsafe(`SAVEPOINT ${sp}`);
    try {
      await fn();
      await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${sp}`);
      return false;
    } catch (err) {
      try {
        await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${sp}`);
      } catch (rollbackErr) {
        logger.error("[program-state] ProgramMember mirror rollback failed", {
          label,
          error: String(rollbackErr),
        });
      }
      logger.error(
        "[program-state] ProgramMember mirror failed; canonical kept",
        {
          label,
          error: err instanceof Error ? err.stack ?? err.message : String(err),
        },
      );
      return true;
    }
  } catch (err) {
    logger.error("[program-state] ProgramMember mirror failed; canonical kept", {
      label,
      error: err instanceof Error ? err.stack ?? err.message : String(err),
    });
    return true;
  }
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
  if (!memberId && isNewProgramStateWritesEnabled()) {
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

  if (!isNewProgramStateWritesEnabled()) {
    const identity = input.identity;
    if (!identity && created) {
      throw new Error("ProgramMember create requires identity snapshot");
    }
    const row = existing
      ? await tx.programMember.update({
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
          select: { id: true },
        })
      : await tx.programMember.create({
          data: {
            id: memberId,
            userId: input.userId,
            cohortId: input.programCohortId,
            status: input.status,
            enrolledAt: input.enrolledAt ?? null,
            completedAt: input.completedAt ?? null,
            ...identity!,
          },
          select: { id: true },
        });
    await dualWriteProgramMember(tx as Prisma.TransactionClient, row.id);
    return { memberId: row.id, created, mirrorFailed: false };
  }

  const visibilityFirst = isNewVisibilityWritesEnabled();
  if (visibilityFirst) {
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

  if (!visibilityFirst) {
    await ensureDiscoverable(
      tx,
      input.userId,
      input.recruiterVisibilityConsentAt,
    );
  }

  const mirrorFailed = await runProgramMemberMirror(tx, "membership", async () => {
    const identity = input.identity;
    if (existing) {
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
      return;
    }
    if (!identity) {
      throw new Error("ProgramMember create requires identity snapshot");
    }
    await tx.programMember.create({
      data: {
        id: memberId,
        userId: input.userId,
        cohortId: input.programCohortId,
        status: input.status,
        enrolledAt,
        completedAt: input.completedAt ?? null,
        ...identity,
      },
    });
  });

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
  if (!isNewProgramStateWritesEnabled()) {
    await tx.programMember.update({
      where: { id: input.memberId },
      data: {
        ...(input.highestUnlockedDay !== undefined
          ? { highestUnlockedDay: input.highestUnlockedDay }
          : {}),
        ...(input.skipTokensUsed !== undefined
          ? { skipTokensUsed: input.skipTokensUsed }
          : {}),
        ...(input.githubRepoUrl !== undefined
          ? { githubRepoUrl: input.githubRepoUrl }
          : {}),
      },
    });
    await dualWriteProgramMember(tx as Prisma.TransactionClient, input.memberId);
    return { mirrorFailed: false };
  }

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

  const mirrorFailed = await runProgramMemberMirror(tx, "unlock", async () => {
    await tx.programMember.update({
      where: { id: input.memberId },
      data: {
        ...(input.highestUnlockedDay !== undefined
          ? { highestUnlockedDay: input.highestUnlockedDay }
          : {}),
        ...(input.skipTokensUsed !== undefined
          ? { skipTokensUsed: input.skipTokensUsed }
          : {}),
        ...(input.githubRepoUrl !== undefined
          ? { githubRepoUrl: input.githubRepoUrl }
          : {}),
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

  if (!isNewProgramStateWritesEnabled()) {
    await tx.programMember.update({
      where: { id: input.memberId },
      data: next,
    });
    const peUpdated = await tx.programEnrollment.updateMany({
      where: { id: peIdForMember(input.memberId) },
      data: next,
    });
    if (peUpdated.count === 0) {
      logger.error(
        "[program-state] ProgramEnrollment missing for score dual-write",
        { memberId: input.memberId },
      );
    }
    return { snapshot: next, mirrorFailed: false };
  }

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

  const mirrorFailed = await runProgramMemberMirror(tx, "score", async () => {
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

  if (!isNewProgramStateWritesEnabled()) {
    await tx.programMember.update({
      where: { id: input.memberId },
      data,
    });
    await tx.programEnrollment.updateMany({
      where: { id: peIdForMember(input.memberId) },
      data,
    });
    return { mirrorFailed: false };
  }

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

  const mirrorFailed = await runProgramMemberMirror(
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
  if (isNewProgramStateWritesEnabled() || isNewProgramStateEnabled()) {
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
  }
  const member = await tx.programMember.findUnique({
    where: { id: memberId },
    select: {
      missionPoints: true,
      conceptPoints: true,
      commitPoints: true,
      projectPoints: true,
      totalScore: true,
      cleanPassCount: true,
    },
  });
  if (!member) {
    return {
      missionPoints: 0,
      conceptPoints: 0,
      commitPoints: 0,
      projectPoints: 0,
      totalScore: 0,
      cleanPassCount: 0,
    };
  }
  return member;
}

export async function countEnrolledProgramMembers(
  tx: Tx,
  programCohortId: string,
): Promise<number> {
  if (isNewProgramStateEnabled() || isNewProgramStateWritesEnabled()) {
    const slug = cohortSlugForProgramCohort(programCohortId);
    return tx.programEnrollment.count({
      where: {
        id: { startsWith: "pe_pm_" },
        status: EnrollmentStatusV2.ACTIVE,
        cohort: { slug },
      },
    });
  }
  return tx.programMember.count({
    where: { cohortId: programCohortId, status: "ENROLLED" },
  });
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
  if (!isNewProgramStateEnabled() || rows.length === 0) return rows;
  const snaps = await listProgramMemberSnapshots(rows.map((r) => r.id));
  return rows.map((row) => {
    const snap = snaps.get(row.id);
    if (!snap) return row;
    const next = { ...row } as T & Record<string, unknown>;
    for (const key of OVERLAY_KEYS) {
      if (key in row) next[key] = snap[key];
    }
    return next;
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
