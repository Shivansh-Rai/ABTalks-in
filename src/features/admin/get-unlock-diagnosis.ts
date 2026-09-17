import "server-only";

import { prisma } from "@/lib/db";
import { getCreditBalance } from "@/repositories/credits";
import { checkPlanLimit } from "@/features/hire/entitlements";
import { hasContactAccess } from "@/features/hire/contact-access";
import { resolveAddressableCandidate } from "@/features/hire/unlock-contact";
import { resolveEligibleCandidates } from "@/features/hire/pool-policy";
import { encodeCandidateRef } from "@/features/hire/candidate-ref";
import { candidatePublicId } from "@/features/hire/public-id";
import {
  CONTACT_UNLOCK_COST_KEY,
  getIntConfig,
} from "@/lib/platform-config";
import {
  diagnoseUnlock,
  type UnlockDiagnosis,
  type UnlockFailureRow,
} from "@/features/admin/unlock-diagnosis";

/**
 * T-267 — gather the facts `diagnoseUnlock` reports on, for one
 * (recruiter, candidate) pair.
 *
 * Every fact here is produced by the gate that really decides it. The point of
 * this file is that support and the recruiter get the same answer from the same
 * code: `hasContactAccess` for access, `resolveAddressableCandidate` for
 * availability, `getCreditBalance` for money, `getIntConfig` for the price.
 * Nothing is re-implemented, and nothing is written — this is a read.
 *
 * The one thing it does not reuse is `previewUnlock`, which resolves the
 * recruiter from the session. An admin is not the recruiter, so the ids come
 * from the route instead. `requireAdmin` on the page is what authorises that;
 * this function must never be reachable from a recruiter surface.
 *
 * `server-only`: it reads a workspace balance and somebody's availability.
 */
export async function getUnlockDiagnosis(
  recruiterUserId: string,
  candidateUserId: string,
): Promise<UnlockDiagnosis | null> {
  const [recruiterUser, candidateUser] = await Promise.all([
    prisma.user.findUnique({
      where: { id: recruiterUserId },
      select: {
        name: true,
        email: true,
        deletedAt: true,
        disabledAt: true,
        disabledReason: true,
        recruiterProfile: { select: { fullName: true } },
      },
    }),
    prisma.user.findUnique({
      where: { id: candidateUserId },
      select: {
        name: true,
        deletedAt: true,
        disabledAt: true,
        candidateProfile: { select: { fullName: true } },
        visibility: {
          select: { searchableByRecruiters: true, withdrawnAt: true },
        },
      },
    }),
  ]);
  if (!recruiterUser || !candidateUser) return null;

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: recruiterUserId, status: "ACTIVE" },
    select: { organizationId: true },
  });
  const organizationId = membership?.organizationId ?? null;

  // PROFILE is the only ref that can be formed from a user id: every other
  // track addresses its candidates by a membership row id. That matches the
  // two doors `resolveAddressableCandidate` actually opens for an unlock — the
  // profile pool, and an applicant on a job this recruiter owns.
  const ref = encodeCandidateRef("PROFILE", candidateUserId);

  const [alreadyUnlocked, fromPool, addressable, costMinor, planLimit, engagement, charge, failures] =
    await Promise.all([
      hasContactAccess(recruiterUserId, candidateUserId),
      // The two doors, probed separately so the panel can say which one opened.
      resolveEligibleCandidates([ref]),
      resolveAddressableCandidate(recruiterUserId, ref),
      getIntConfig(CONTACT_UNLOCK_COST_KEY),
      checkPlanLimit(recruiterUserId, "CONTACT_UNLOCK"),
      prisma.talentEngagementRequest.findFirst({
        where: { recruiterUserId, candidateUserId, status: "CONTACT_SHARED" },
        orderBy: { decidedAt: "desc" },
        select: { decidedAt: true, createdAt: true },
      }),
      prisma.creditTransaction.findFirst({
        where: { recruiterUserId, candidateUserId, type: "UNLOCK_CONTACT" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      listPairFailures(recruiterUserId, candidateUserId),
    ]);

  const balanceMinor = organizationId
    ? await getCreditBalance(organizationId)
    : 0;

  const candidateLabel =
    candidateUser.candidateProfile?.fullName?.trim() ||
    candidateUser.name?.trim() ||
    "This candidate";

  return diagnoseUnlock({
    recruiter: {
      name:
        recruiterUser.recruiterProfile?.fullName?.trim() ||
        recruiterUser.name?.trim() ||
        recruiterUser.email ||
        "This recruiter",
      deletedAt: recruiterUser.deletedAt,
      disabledAt: recruiterUser.disabledAt,
      disabledReason: recruiterUser.disabledReason,
      hasRecruiterProfile: recruiterUser.recruiterProfile !== null,
      organizationId,
    },
    candidate: {
      publicId: candidatePublicId(candidateUserId),
      label: candidateLabel,
      deletedAt: candidateUser.deletedAt,
      disabledAt: candidateUser.disabledAt,
      visibility: {
        exists: candidateUser.visibility !== null,
        searchableByRecruiters:
          candidateUser.visibility?.searchableByRecruiters ?? false,
        withdrawnAt: candidateUser.visibility?.withdrawnAt ?? null,
      },
    },
    addressable: addressable !== null,
    addressableVia:
      addressable === null
        ? null
        : fromPool.length > 0
          ? "POOL"
          : "OWNED_APPLICATION",
    alreadyUnlocked,
    unlockedAt: engagement?.decidedAt ?? engagement?.createdAt ?? null,
    planLimit: {
      allowed: planLimit.allowed,
      remaining: planLimit.remaining,
      reason: planLimit.reason,
    },
    costMinor,
    balanceMinor,
    chargedAt: charge?.createdAt ?? null,
    failures,
  });
}

/**
 * Failures the platform really recorded for this pair.
 *
 * Outreach email failures only, and deliberately: there is no failed-unlock
 * table, because a refused unlock returns its reason and writes nothing (that
 * is what makes "nothing was charged" true). Inventing a history of attempts
 * here would be inventing data. The recruiter-wide delivery failures live on
 * the recruiter detail page, which reads the Delivery Log.
 */
async function listPairFailures(
  recruiterUserId: string,
  candidateUserId: string,
): Promise<UnlockFailureRow[]> {
  const rows = await prisma.outreachMessage.findMany({
    where: {
      emailStatus: "FAILED",
      thread: { recruiterUserId, candidateUserId },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, createdAt: true, emailFailureReason: true },
  });
  return rows.map((r) => ({
    id: r.id,
    kind: "OUTREACH_EMAIL" as const,
    at: r.createdAt,
    reason: r.emailFailureReason ?? "No reason recorded on the message row.",
  }));
}
