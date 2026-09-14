import "server-only";

import { requireRecruiterWorkspace } from "@/features/recruiter-workspace/workspace";
import {
  resolveEligibleCandidates,
  type EligibleCandidate,
} from "@/features/hire/pool-policy";
import { decodeCandidateRef } from "@/features/hire/candidate-ref";
import { candidatePublicId } from "@/features/hire/public-id";
import {
  hasContactAccess,
  loadProtectedContact,
} from "@/features/hire/contact-access";
import { getCreditBalance } from "@/repositories/credits";
import { searchableUserWhere } from "@/repositories/talent";
import { prisma } from "@/lib/db";
import {
  REFUSAL_MESSAGE,
  unlockResolvedContact,
  type ResolvedUnlock,
  type UnlockRefusal,
  type UnlockResult,
} from "@/features/hire/unlock-transaction";

/**
 * Re-exported so callers have one import for the whole feature and do not have
 * to know which half of it a type happens to live in.
 */
export type {
  UnlockRefusal,
  UnlockResult,
  UnlockSuccess,
  UnlockFailure,
} from "@/features/hire/unlock-transaction";
import {
  CONTACT_UNLOCK_COST_KEY,
  getIntConfig,
} from "@/lib/platform-config";

/**
 * Paying to see a candidate's contact details (T-229, T-230).
 *
 * ## What an unlock actually is
 *
 * It is not a new kind of access. Access has one definition and keeps it:
 * `TalentEngagementRequest.status === "CONTACT_SHARED"`, read by
 * `hasContactAccess`, which this file does not touch and must not. What T-229
 * adds is a second legitimate way for such a row to come into existence —
 * paying for it — beside the admin introduction that already existed. Credits
 * decide whether the row may be written; they never become the check itself.
 *
 * That distinction is the reason `contact-access.ts` is unchanged by this
 * feature, and the reason a commercial gate can never widen what the privacy
 * gate permits.
 *
 * ## The order of the questions
 *
 * Has this recruiter already unlocked them · is this candidate still someone
 * they may reach · can they afford it. In that order, and the order is not
 * cosmetic: a recruiter told "you have run out of credits" when the truth is
 * that the candidate withdrew has been told something false about a person, and
 * has been invited to spend money to fix it. T-148 §5.
 *
 * A repeat unlock is free and is answered before any of the billing machinery
 * runs at all, so the free case cannot cost anything even in principle.
 *
 * ## Why one transaction
 *
 * The debit, the ledger row and the `CONTACT_SHARED` row commit together or not
 * at all (T-148 §4.4). Anything less has two failure modes that are both
 * unacceptable on this path: charged with no access, or access with no charge.
 * `applyCreditChange` takes a caller-supplied transaction for exactly this.
 *
 * `server-only`: this spends money and releases somebody's contact details.
 */

export type UnlockPreview =
  | {
      ok: true;
      /** True when they already have access; the dialog offers no charge. */
      alreadyUnlocked: boolean;
      costMinor: number;
      balanceMinor: number;
      /** balance − cost, floored at zero, purely for display. */
      remainingMinor: number;
      affordable: boolean;
      currency: string;
    }
  | { ok: false; reason: UnlockRefusal; message: string };

/**
 * Everything both the preview and the unlock need, resolved from the session
 * and re-checked against the pool. Shared so the two can never disagree about
 * who this candidate is or whether the recruiter may reach them.
 */
async function resolve(
  candidateRef: string,
): Promise<
  | { ok: true; data: ResolvedUnlock }
  | { ok: false; reason: UnlockRefusal; message?: string }
> {
  const workspace = await requireRecruiterWorkspace();
  // Carry the resolver's own words through. It distinguishes "not a recruiter"
  // from "finish setting up" from "still under review", and flattening those
  // into one generic line tells a recruiter awaiting approval to sign in —
  // which they already have. T-229 requires a refusal to name its real reason.
  if (!workspace.ok) {
    return { ok: false, reason: "NOT_A_RECRUITER", message: workspace.message };
  }

  // A ref is a name, not a capability. Re-checked against the pool every time,
  // which is also what refuses the fabricated `SAMPLE:` preview cards. An
  // applicant on a job this recruiter owns is a second legitimate address —
  // they applied, so unlock/message must not fail just because search would
  // not have shown them.
  const candidate = await resolveAddressableCandidate(
    workspace.data.userId,
    candidateRef,
  );
  if (!candidate) return { ok: false, reason: "CANDIDATE_UNAVAILABLE" };

  return {
    ok: true,
    data: {
      organizationId: workspace.data.organizationId,
      recruiterUserId: workspace.data.userId,
      candidateUserId: candidate.userId,
      candidatePublicId: candidate.publicId,
      programMemberId: candidate.programMemberId,
      source: candidate.source,
    },
  };
}

/**
 * What the dialog shows before the recruiter commits: the cost, what they have,
 * and what they would have left.
 *
 * A read, and only a read. The numbers here inform the decision; they do not
 * authorise it. `unlockContact` re-reads every one of them, because anything
 * computed for display can be stale by the time somebody clicks, and a price
 * that arrived from a browser is a price that can be edited.
 */
export async function previewUnlock(
  candidateRef: string,
): Promise<UnlockPreview> {
  const resolved = await resolve(candidateRef);
  if (!resolved.ok) {
    return {
      ok: false,
      reason: resolved.reason,
      message: resolved.message ?? REFUSAL_MESSAGE[resolved.reason],
    };
  }
  const { organizationId, recruiterUserId, candidateUserId } = resolved.data;

  const [alreadyUnlocked, costMinor, balanceMinor] = await Promise.all([
    hasContactAccess(recruiterUserId, candidateUserId),
    getIntConfig(CONTACT_UNLOCK_COST_KEY),
    getCreditBalance(organizationId),
  ]);

  const effectiveCost = alreadyUnlocked ? 0 : costMinor;
  return {
    ok: true,
    alreadyUnlocked,
    costMinor: effectiveCost,
    balanceMinor,
    remainingMinor: Math.max(balanceMinor - effectiveCost, 0),
    affordable: balanceMinor >= effectiveCost,
    currency: "USD",
  };
}

/**
 * Unlock one candidate's contact details for this recruiter.
 *
 * Idempotent by construction rather than by care: the ledger's unique
 * `idempotencyKey` means a retry, a double-click, a replayed request and two
 * genuinely simultaneous requests all converge on one charge. The pre-check
 * below is a fast path that keeps the common case cheap; it is not the
 * guarantee, and nothing here relies on the UI to prevent a second charge.
 */
export async function unlockContact(
  candidateRef: string,
): Promise<UnlockResult> {
  const resolved = await resolve(candidateRef);
  if (!resolved.ok) {
    // No balance lookup on NOT_A_RECRUITER — there is no workspace to read one
    // from, and inventing a zero would read as "you are broke".
    const balanceMinor =
      resolved.reason === "NOT_A_RECRUITER" ? 0 : await safeBalance(candidateRef);
    return {
      ok: false,
      reason: resolved.reason,
      message: resolved.message ?? REFUSAL_MESSAGE[resolved.reason],
      balanceMinor,
    };
  }

  return unlockResolvedContact(resolved.data);
}

/** Balance for a refusal message, without letting a lookup failure mask it. */
async function safeBalance(candidateRef: string): Promise<number> {
  void candidateRef;
  const workspace = await requireRecruiterWorkspace();
  if (!workspace.ok) return 0;
  try {
    return await getCreditBalance(workspace.data.organizationId);
  } catch {
    return 0;
  }
}

export type RevealedContact = {
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
};

/**
 * What the recruiter bought, for the surface they bought it on.
 *
 * T-229 says contact details appear after a successful unlock. They were
 * appearing — on `/hire/requests`, which is a different page from the one the
 * recruiter spent on, so from the desk the $10 looked like it bought nothing.
 * This reads the same protected loader that page uses.
 *
 * It authorises nothing. `loadProtectedContact` checks `hasContactAccess`
 * before it selects a single protected column, so an unpaid caller gets null
 * and no query for an email ever runs.
 */
export async function revealUnlockedContact(
  candidateRef: string,
): Promise<RevealedContact | null> {
  const resolved = await resolve(candidateRef);
  if (!resolved.ok) return null;
  return loadProtectedContact(
    resolved.data.recruiterUserId,
    resolved.data.candidateUserId,
  );
}

/**
 * Who this recruiter may unlock or message.
 *
 * The search pool is still the first door (`resolveEligibleCandidates`). A
 * PROFILE applicant on a job this recruiter owns is the second — they applied,
 * so Scout search emptiness must not block T-229/T-232. SAMPLE: and other
 * tracks are not admitted through this door. Deleted or withdrawn users are
 * still refused via `searchableUserWhere`.
 */
export async function resolveAddressableCandidate(
  recruiterUserId: string,
  candidateRef: string,
): Promise<EligibleCandidate | null> {
  const [fromPool] = await resolveEligibleCandidates([candidateRef]);
  if (fromPool) return fromPool;
  return resolveViaOwnedApplication(recruiterUserId, candidateRef);
}

async function resolveViaOwnedApplication(
  recruiterUserId: string,
  candidateRef: string,
): Promise<EligibleCandidate | null> {
  const parsed = decodeCandidateRef(candidateRef);
  if (!parsed || parsed.source !== "PROFILE") return null;
  const userId = parsed.id;
  const alive = await prisma.user.findFirst({
    where: { id: userId, ...searchableUserWhere() },
    select: { id: true },
  });
  if (!alive) return null;
  const applied = await prisma.jobApplication.findFirst({
    where: { userId, job: { recruiterId: recruiterUserId } },
    select: { id: true },
  });
  if (!applied) return null;
  return {
    candidateRef,
    source: "PROFILE",
    userId,
    programMemberId: null,
    publicId: candidatePublicId(userId),
  };
}
