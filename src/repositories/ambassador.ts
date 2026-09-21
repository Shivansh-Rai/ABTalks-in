/**
 * W5 Campus Ambassador write/read boundary.
 *
 * ENABLE_NEW_AMBASSADOR_WRITES off (dark deploy): StudentProfile ambassador
 * columns stay the write that dual-writes onto CampusAmbassadorApplication.
 * ENABLE_NEW_AMBASSADOR_WRITES on: CampusAmbassadorApplication commits first;
 * StudentProfile ambassador columns are a compatibility mirror only while
 * ENABLE_LEGACY_AMBASSADOR_MIRROR is not `"false"`.
 *
 * W5-B: ENABLE_LEGACY_AMBASSADOR_MIRROR=false freezes those three SP columns.
 * Apply/dismiss do not write them. Anonymize wipe still scrubs them as a
 * documented compliance exception. Identity, points, and domain are untouched.
 */
import "server-only";
import type { Domain, Prisma, PrismaClient } from "@prisma/client";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/db";
import {
  isLegacyAmbassadorMirrorEnabled,
  isNewAmbassadorWritesEnabled,
} from "@/lib/feature-flags";
import { pickPrimaryEducation } from "@/repositories/candidate-primary";

type Tx = Prisma.TransactionClient | PrismaClient;

export type AmbassadorState = {
  isCandidate: boolean;
  appliedAt: Date | null;
  dismissedAt: Date | null;
};

export type AmbassadorChangeKind = "apply" | "dismiss" | "wipe";

export type ApplyAmbassadorResult = {
  state: AmbassadorState;
  created: boolean;
  updated: boolean;
  skipped: boolean;
  mirrorFailed: boolean;
};

export type AmbassadorCandidateListItem = {
  userId: string;
  fullName: string;
  phone: string | null;
  college: string | null;
  graduationYear: number | null;
  linkedinUrl: string | null;
  domain: Domain | null;
  ambassadorAppliedAt: Date | null;
  email: string;
};

const EMPTY_STATE: AmbassadorState = {
  isCandidate: false,
  appliedAt: null,
  dismissedAt: null,
};

function savepointName(label: string): string {
  const cleaned = label.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24);
  return `ambmir_${cleaned || "x"}`;
}

function shouldInjectLegacyMirrorFailure(): boolean {
  return process.env.AMBASSADOR_FAIL_LEGACY_MIRROR === "1";
}

function ambassadorStudentProfileData(
  state: AmbassadorState,
): Prisma.StudentProfileUpdateInput {
  return {
    isCampusAmbassadorCandidate: state.isCandidate,
    ambassadorAppliedAt: state.appliedAt,
    ambassadorDismissedAt: state.dismissedAt,
  };
}

function nextState(
  kind: AmbassadorChangeKind,
  current: AmbassadorState,
  at: Date,
): AmbassadorState {
  if (kind === "wipe") {
    return { isCandidate: false, appliedAt: null, dismissedAt: null };
  }
  if (kind === "apply") {
    return {
      isCandidate: true,
      appliedAt: current.appliedAt ?? at,
      dismissedAt: current.dismissedAt,
    };
  }
  return {
    isCandidate: current.isCandidate,
    appliedAt: current.appliedAt,
    dismissedAt: current.dismissedAt ?? at,
  };
}

function sameState(a: AmbassadorState, b: AmbassadorState): boolean {
  return (
    a.isCandidate === b.isCandidate &&
    (a.appliedAt?.getTime() ?? null) === (b.appliedAt?.getTime() ?? null) &&
    (a.dismissedAt?.getTime() ?? null) === (b.dismissedAt?.getTime() ?? null)
  );
}

async function loadCurrent(tx: Tx, userId: string): Promise<AmbassadorState> {
  const canonical = await tx.campusAmbassadorApplication.findUnique({
    where: { userId },
    select: { isCandidate: true, appliedAt: true, dismissedAt: true },
  });
  if (canonical) {
    return {
      isCandidate: canonical.isCandidate,
      appliedAt: canonical.appliedAt,
      dismissedAt: canonical.dismissedAt,
    };
  }
  if (isNewAmbassadorWritesEnabled()) return EMPTY_STATE;
  const sp = await tx.studentProfile.findUnique({
    where: { userId },
    select: {
      isCampusAmbassadorCandidate: true,
      ambassadorAppliedAt: true,
      ambassadorDismissedAt: true,
    },
  });
  if (!sp) return EMPTY_STATE;
  return {
    isCandidate: sp.isCampusAmbassadorCandidate,
    appliedAt: sp.ambassadorAppliedAt,
    dismissedAt: sp.ambassadorDismissedAt,
  };
}

async function upsertCanonical(
  tx: Tx,
  userId: string,
  state: AmbassadorState,
): Promise<{ created: boolean }> {
  const existing = await tx.campusAmbassadorApplication.findUnique({
    where: { userId },
    select: { userId: true },
  });
  await tx.campusAmbassadorApplication.upsert({
    where: { userId },
    create: {
      id: `caa_${userId}`,
      userId,
      isCandidate: state.isCandidate,
      appliedAt: state.appliedAt,
      dismissedAt: state.dismissedAt,
    },
    update: {
      isCandidate: state.isCandidate,
      appliedAt: state.appliedAt,
      dismissedAt: state.dismissedAt,
    },
  });
  return { created: !existing };
}

async function runStudentProfileAmbassadorMirror(
  tx: Tx,
  label: string,
  userId: string,
  fn: () => Promise<void>,
): Promise<boolean> {
  if (!isLegacyAmbassadorMirrorEnabled()) return false;
  if (shouldInjectLegacyMirrorFailure()) {
    logger.error(
      "[ambassador] legacy StudentProfile mirror failed; canonical state kept",
      { label, userId, error: "AMBASSADOR_FAIL_LEGACY_MIRROR" },
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
        logger.error("[ambassador] student profile ambassador mirror rollback failed", {
          label,
          userId,
          error: String(rollbackErr),
        });
      }
      logger.error(
        "[ambassador] legacy StudentProfile mirror failed; canonical state kept",
        {
          label,
          userId,
          error: err instanceof Error ? err.stack ?? err.message : String(err),
        },
      );
      return true;
    }
  } catch (err) {
    logger.error(
      "[ambassador] legacy StudentProfile mirror failed; canonical state kept",
      {
        label,
        userId,
        error: err instanceof Error ? err.stack ?? err.message : String(err),
      },
    );
    return true;
  }
}

/**
 * Sole live writer for Campus Ambassador candidacy / banner-dismiss.
 * StudentProfile ambassador columns are mirrored only; identity, points,
 * and domain are never written here.
 */
export async function applyAmbassadorChange(
  tx: Tx,
  userId: string,
  input: { kind: AmbassadorChangeKind; at?: Date },
): Promise<ApplyAmbassadorResult> {
  const at = input.at ?? new Date();
  const current = await loadCurrent(tx, userId);
  const state = nextState(input.kind, current, at);

  if (!isNewAmbassadorWritesEnabled()) {
    if (input.kind === "wipe") {
      await tx.studentProfile.updateMany({
        where: { userId },
        data: ambassadorStudentProfileData(state),
      });
    } else {
      await tx.studentProfile.update({
        where: { userId },
        data: ambassadorStudentProfileData(state),
      });
    }
    const { created } = await upsertCanonical(tx, userId, state);
    return {
      state,
      created,
      updated: !created,
      skipped: sameState(current, state),
      mirrorFailed: false,
    };
  }

  const { created } = await upsertCanonical(tx, userId, state);
  const mirrorFailed = await runStudentProfileAmbassadorMirror(
    tx,
    input.kind,
    userId,
    async () => {
      await tx.studentProfile.updateMany({
        where: { userId },
        data: ambassadorStudentProfileData(state),
      });
    },
  );
  if (input.kind === "wipe" && !isLegacyAmbassadorMirrorEnabled()) {
    await tx.studentProfile.updateMany({
      where: { userId },
      data: ambassadorStudentProfileData(state),
    });
    logger.info(
      "[ambassador] compliance wipe of frozen StudentProfile ambassador snapshots",
      { userId },
    );
  }
  return {
    state,
    created,
    updated: !created,
    skipped: sameState(current, state),
    mirrorFailed,
  };
}

function unspecifiedToNull(value: string | null | undefined): string | null {
  if (!value || value === "Not specified") return null;
  return value;
}

/**
 * Current-state ambassador candidacy. Canonical is the live source while
 * ENABLE_NEW_AMBASSADOR_WRITES is on. StudentProfile is a flag-off fallback
 * only (dormant W5-A rollback), never a current-state product read after W5-B.
 */
export async function getAmbassadorState(
  userId: string,
): Promise<AmbassadorState> {
  const canonical = await prisma.campusAmbassadorApplication.findUnique({
    where: { userId },
    select: { isCandidate: true, appliedAt: true, dismissedAt: true },
  });
  if (canonical) {
    return {
      isCandidate: canonical.isCandidate,
      appliedAt: canonical.appliedAt,
      dismissedAt: canonical.dismissedAt,
    };
  }
  if (isNewAmbassadorWritesEnabled()) return EMPTY_STATE;
  const sp = await prisma.studentProfile.findUnique({
    where: { userId },
    select: {
      isCampusAmbassadorCandidate: true,
      ambassadorAppliedAt: true,
      ambassadorDismissedAt: true,
    },
  });
  if (!sp) return EMPTY_STATE;
  return {
    isCandidate: sp.isCampusAmbassadorCandidate,
    appliedAt: sp.ambassadorAppliedAt,
    dismissedAt: sp.ambassadorDismissedAt,
  };
}

/**
 * Admin list of opted-in ambassador candidates. Ambassador filter is
 * canonical; name/college/phone/linkedin are candidate identity (CP, SP
 * fallback); domain remains the live StudentProfile later-family column.
 */
export async function listAmbassadorCandidates(
  search: string,
): Promise<AmbassadorCandidateListItem[]> {
  const trimmed = search.trim();
  const rows = await prisma.campusAmbassadorApplication.findMany({
    where: {
      isCandidate: true,
      ...(trimmed
        ? {
            OR: [
              {
                user: {
                  candidateProfile: {
                    fullName: { contains: trimmed, mode: "insensitive" },
                  },
                },
              },
              {
                user: {
                  candidateProfile: {
                    education: {
                      some: {
                        institutionName: { contains: trimmed, mode: "insensitive" },
                      },
                    },
                  },
                },
              },
              {
                user: {
                  studentProfile: {
                    fullName: { contains: trimmed, mode: "insensitive" },
                  },
                },
              },
              {
                user: {
                  studentProfile: {
                    college: { contains: trimmed, mode: "insensitive" },
                  },
                },
              },
            ],
          }
        : {}),
    },
    orderBy: { appliedAt: "desc" },
    select: {
      userId: true,
      appliedAt: true,
      user: {
        select: {
          email: true,
          candidateProfile: {
            select: {
              fullName: true,
              phone: true,
              linkedinUrl: true,
              education: {
                select: {
                  institutionName: true,
                  collegeId: true,
                  startYear: true,
                  startMonth: true,
                  graduationYear: true,
                  endMonth: true,
                  isCurrent: true,
                  sortOrder: true,
                },
              },
            },
          },
          studentProfile: {
            select: {
              fullName: true,
              phone: true,
              college: true,
              graduationYear: true,
              linkedinUrl: true,
              domain: true,
            },
          },
        },
      },
    },
  });

  return rows.map((row) => {
    const cp = row.user.candidateProfile;
    const sp = row.user.studentProfile;
    const education = cp ? pickPrimaryEducation(cp.education) : null;
    return {
      userId: row.userId,
      fullName: cp?.fullName || sp?.fullName || "Unnamed",
      phone: cp?.phone ?? sp?.phone ?? null,
      college:
        unspecifiedToNull(education?.institutionName) ?? sp?.college ?? null,
      graduationYear: education?.graduationYear ?? sp?.graduationYear ?? null,
      linkedinUrl: cp?.linkedinUrl ?? sp?.linkedinUrl ?? null,
      domain: sp?.domain ?? null,
      ambassadorAppliedAt: row.appliedAt,
      email: row.user.email,
    };
  });
}
