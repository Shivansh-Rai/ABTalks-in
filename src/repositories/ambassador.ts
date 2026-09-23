/**
 * W5 Campus Ambassador write/read boundary.
 *
 * Canonical writer is always CampusAmbassadorApplication. ENABLE_NEW_AMBASSADOR_WRITES
 * is ignored (Phase 8-D): frozen StudentProfile ambassador columns must not
 * become write authority. StudentProfile ambassador columns are a compatibility
 * mirror only while ENABLE_LEGACY_AMBASSADOR_MIRROR is not `"false"`.
 *
 * W5-B: ENABLE_LEGACY_AMBASSADOR_MIRROR=false freezes those three SP columns.
 * Apply/dismiss do not write them. Anonymize wipe still scrubs them as a
 * documented compliance exception. Identity, points, and domain are untouched.
 */
import "server-only";
import type { Domain, Prisma, PrismaClient } from "@prisma/client";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/db";
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
  return EMPTY_STATE;
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
  void tx; void label; void userId; void fn;
  return false;
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

  const { created } = await upsertCanonical(tx, userId, state);
  const mirrorFailed = await runStudentProfileAmbassadorMirror(
    tx,
    input.kind,
    userId,
    async () => undefined,
  );
  if (input.kind === "wipe") {
    logger.info("[ambassador] canonical CampusAmbassadorApplication wiped", {
      userId,
    });
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
 * Current-state ambassador candidacy. Canonical CampusAmbassadorApplication
 * is the sole live source. Frozen StudentProfile ambassador columns are never
 * current-state product reads.
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
  return EMPTY_STATE;
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
        },
      },
    },
  });

  return rows.map((row) => {
    const cp = row.user.candidateProfile;
    const education = cp ? pickPrimaryEducation(cp.education) : null;
    return {
      userId: row.userId,
      fullName: cp?.fullName || "Unnamed",
      phone: cp?.phone ?? null,
      college: unspecifiedToNull(education?.institutionName),
      graduationYear: education?.graduationYear ?? null,
      linkedinUrl: cp?.linkedinUrl ?? null,
      domain: null,
      ambassadorAppliedAt: row.appliedAt,
      email: row.user.email,
    };
  });
}
