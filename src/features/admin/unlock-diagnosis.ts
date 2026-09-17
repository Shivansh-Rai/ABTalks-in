import { formatCreditsMinor } from "@/lib/credits-format";
import { formatDateTimeIST } from "@/lib/date-utils";

/**
 * T-267 — why this recruiter cannot unlock this candidate.
 *
 * Pure: facts in, checks out. No Prisma, no `server-only`. The loader is
 * `get-unlock-diagnosis.ts`; the test drives this function directly. Built the
 * same way as `candidate-discoverability.ts`, for the same reason: a support
 * answer is only worth reading if every row on it is a condition that really
 * runs.
 *
 * ## The order is the product
 *
 * `unlock-contact.ts` asks its questions in a fixed order — already unlocked,
 * is the candidate still reachable, can they afford it — and says why: a
 * recruiter told "you have run out of credits" when the truth is that the
 * candidate withdrew has been told something false and invited to spend money
 * to fix it (T-148 §5). This file reports the same order, so support and the
 * recruiter are never looking at two different explanations.
 *
 * Before any of that come two conditions the unlock path never reaches because
 * auth refuses first: a deleted or disabled recruiter cannot hold a session
 * (the `signIn` callback in `src/auth.ts`), and somebody with no recruiter
 * workspace is refused by `requireRecruiterWorkspace` in its own words.
 *
 * ## What this must not do
 *
 * It decides nothing. Every fact it reads was produced by the real gate —
 * `hasContactAccess`, `resolveAddressableCandidate`, `getCreditBalance`,
 * `getIntConfig` — and this file only puts them in order and writes the
 * sentence. Changing an answer here to make the page tidier would make it lie,
 * which is the one thing a diagnosis page cannot do.
 *
 * Plan limits are reported, never invented: `checkPlanLimit` is a documented
 * stub and the unlock path does not call it, so its row is context, not a
 * blocker. Saying otherwise would name a restriction nothing enforces.
 */

export type UnlockCheckStatus = "OK" | "BLOCKING" | "INFO";

export type UnlockCheckGroup =
  | "account"
  | "workspace"
  | "access"
  | "candidate"
  | "plan"
  | "credits"
  | "failures";

/** Rendered in this order, which is also blocker priority: hardest gate first. */
export const UNLOCK_GROUP_ORDER: readonly UnlockCheckGroup[] = [
  "account",
  "workspace",
  "access",
  "candidate",
  "plan",
  "credits",
  "failures",
] as const;

export const UNLOCK_GROUP_LABEL: Record<UnlockCheckGroup, string> = {
  account: "Recruiter account",
  workspace: "Workspace",
  access: "Existing access",
  candidate: "Candidate availability",
  plan: "Plan and limits",
  credits: "Credits",
  failures: "Recent failures",
};

export type UnlockCheck = {
  id: string;
  group: UnlockCheckGroup;
  label: string;
  status: UnlockCheckStatus;
  /** The actual state, in plain words, with the consequence spelled out. */
  detail: string;
  /** Short phrase naming the blocker for the verdict line. Blocking rows only. */
  summary: string | null;
  /** What support can do about it. Null when there is nothing to do. */
  action: string | null;
};

/** The answer the live unlock path would give, named in its own words. */
export type UnlockOutcome =
  | "ALREADY_UNLOCKED"
  | "WOULD_SUCCEED"
  | "NOT_A_RECRUITER"
  | "ACCOUNT_BLOCKED"
  | "CANDIDATE_UNAVAILABLE"
  | "INSUFFICIENT_CREDITS";

export type UnlockFailureRow = {
  id: string;
  /** Where the failure was recorded. */
  kind: "OUTREACH_EMAIL" | "NOTIFICATION";
  at: Date;
  /** The stored, recruiter-readable reason. Never a raw provider payload. */
  reason: string;
};

export type UnlockDiagnosisFacts = {
  recruiter: {
    name: string;
    deletedAt: Date | null;
    disabledAt: Date | null;
    disabledReason: string | null;
    /** Being a recruiter at all: the `RecruiterProfile` row. */
    hasRecruiterProfile: boolean;
    /** An ACTIVE `OrganizationMember` row — the T-226 workspace. */
    organizationId: string | null;
  };
  candidate: {
    publicId: string;
    label: string;
    deletedAt: Date | null;
    disabledAt: Date | null;
    /** The discovery record `searchableUserWhere()` joins to. */
    visibility: {
      exists: boolean;
      searchableByRecruiters: boolean;
      withdrawnAt: Date | null;
    };
  };
  /** Live probe: `resolveAddressableCandidate` returned this candidate. */
  addressable: boolean;
  /** How they were reachable. Null when they were not. */
  addressableVia: "POOL" | "OWNED_APPLICATION" | null;
  /** Live probe: `hasContactAccess` — a CONTACT_SHARED engagement exists. */
  alreadyUnlocked: boolean;
  /** When that engagement was decided, where the row records it. */
  unlockedAt: Date | null;
  /** `checkPlanLimit` as it answers today. Reported, never enforced here. */
  planLimit: { allowed: boolean; remaining: number | null; reason: string };
  /** `PlatformConfig` contact unlock cost, in USD minor units. */
  costMinor: number;
  /** Derived from the ledger by `getCreditBalance`, in USD minor units. */
  balanceMinor: number;
  /** The unlock ledger row for this pair, when one exists. */
  chargedAt: Date | null;
  /** Real recorded failures touching this pair, newest first. */
  failures: UnlockFailureRow[];
};

export type UnlockDiagnosis = {
  /** Whether an unlock attempted right now would go through. */
  canUnlock: boolean;
  outcome: UnlockOutcome;
  /** One line naming the real reason, in the words support should repeat. */
  verdict: string;
  /** The blocking check the verdict names. Null when nothing blocks. */
  blocker: UnlockCheck | null;
  checks: UnlockCheck[];
};

function when(date: Date): string {
  return formatDateTimeIST(date);
}

/**
 * The first blocking row, in group order. The live path stops at the first
 * closed gate, so the verdict names that one and not a later, louder one.
 */
function firstBlocker(checks: UnlockCheck[]): UnlockCheck | null {
  for (const group of UNLOCK_GROUP_ORDER) {
    const hit = checks.find((c) => c.group === group && c.status === "BLOCKING");
    if (hit) return hit;
  }
  return null;
}

export function diagnoseUnlock(facts: UnlockDiagnosisFacts): UnlockDiagnosis {
  const checks: UnlockCheck[] = [];
  const { recruiter, candidate } = facts;

  // ── Account ───────────────────────────────────────────────────────────────
  if (recruiter.deletedAt) {
    checks.push({
      id: "recruiter-deleted",
      group: "account",
      label: "Recruiter account deleted",
      status: "BLOCKING",
      detail: `This account was deleted on ${when(recruiter.deletedAt)}. It cannot sign in, so no unlock can be attempted from it.`,
      summary: "the recruiter account is deleted",
      action: "Nothing to unblock here. A deleted account is not restored from this page.",
    });
  } else if (recruiter.disabledAt) {
    const reason = recruiter.disabledReason
      ? ` Reason on file: ${recruiter.disabledReason}.`
      : "";
    checks.push({
      id: "recruiter-disabled",
      group: "account",
      label: "Recruiter account suspended",
      status: "BLOCKING",
      detail: `Disabled on ${when(recruiter.disabledAt)}.${reason} Sign-in is refused, so the unlock path is never reached — the recruiter sees a sign-in failure, not a credits message.`,
      summary: "the recruiter account is suspended",
      action: "Restore the account from the recruiter row above if the suspension no longer applies.",
    });
  } else {
    checks.push({
      id: "recruiter-active",
      group: "account",
      label: "Account state",
      status: "OK",
      detail: "Active: not disabled, not deleted. Sign-in is permitted.",
      summary: null,
      action: null,
    });
  }

  // ── Workspace ─────────────────────────────────────────────────────────────
  if (!recruiter.hasRecruiterProfile) {
    checks.push({
      id: "no-recruiter-profile",
      group: "workspace",
      label: "Not a recruiter account",
      status: "BLOCKING",
      detail:
        "There is no RecruiterProfile row for this user, so requireRecruiterWorkspace refuses with “This account is not a recruiter account.”",
      summary: "the account is not registered as a recruiter",
      action: "Ask them to register at /hire, which provisions the profile and the workspace together.",
    });
  } else if (!recruiter.organizationId) {
    checks.push({
      id: "no-workspace",
      group: "workspace",
      label: "No workspace provisioned",
      status: "BLOCKING",
      detail:
        "Registered as a recruiter, but there is no ACTIVE OrganizationMember row — so there is no workspace to hold credits and nothing to charge.",
      summary: "the recruiter has no workspace",
      action: "The workspace is provisioned on their next visit to a recruiter surface. If it does not appear, check provisionRecruiterIdentity.",
    });
  } else {
    checks.push({
      id: "workspace-ready",
      group: "workspace",
      label: "Workspace",
      status: "OK",
      detail: "One active workspace, which is what holds the credits an unlock spends.",
      summary: null,
      action: null,
    });
  }

  // ── Existing access ───────────────────────────────────────────────────────
  if (facts.alreadyUnlocked) {
    const at = facts.unlockedAt ? ` on ${when(facts.unlockedAt)}` : "";
    const charged = facts.chargedAt
      ? ` The ledger carries the charge from ${when(facts.chargedAt)}.`
      : " No unlock charge is on the ledger for this pair, so this access came from an admin introduction rather than a purchase.";
    checks.push({
      id: "already-unlocked",
      group: "access",
      label: "Already unlocked",
      status: "OK",
      detail: `This recruiter already holds a CONTACT_SHARED engagement for ${candidate.publicId}${at}, so contact details are already visible to them. A repeat unlock is answered before any billing runs and costs nothing.${charged}`,
      summary: null,
      action: "If they say they cannot see the contact details, the problem is the surface they are looking at, not the unlock.",
    });
  } else {
    checks.push({
      id: "not-yet-unlocked",
      group: "access",
      label: "Existing access",
      status: "INFO",
      detail: `No CONTACT_SHARED engagement for ${candidate.publicId}. This would be a first, chargeable unlock.`,
      summary: null,
      action: null,
    });
  }

  // ── Candidate availability ────────────────────────────────────────────────
  const vis = candidate.visibility;
  if (candidate.deletedAt) {
    checks.push({
      id: "candidate-deleted",
      group: "candidate",
      label: "Candidate deleted",
      status: "BLOCKING",
      detail: `${candidate.label} deleted their account on ${when(candidate.deletedAt)}. The search gate excludes them, so the unlock refuses with “This candidate is no longer available.”`,
      summary: "the candidate deleted their account",
      action: "Nothing to unblock. Tell the recruiter the candidate is gone, not that they are out of credits.",
    });
  } else if (candidate.disabledAt) {
    checks.push({
      id: "candidate-disabled",
      group: "candidate",
      label: "Candidate account disabled",
      status: "BLOCKING",
      detail: `Disabled on ${when(candidate.disabledAt)}. The search gate excludes disabled users, so the unlock refuses with CANDIDATE_UNAVAILABLE.`,
      summary: "the candidate's account is disabled",
      action: "Restore the candidate's account if the suspension no longer applies.",
    });
  } else if (vis.withdrawnAt) {
    checks.push({
      id: "candidate-withdrawn",
      group: "candidate",
      label: "Candidate withdrawn from discovery",
      status: "BLOCKING",
      detail: `The CandidateVisibility record was withdrawn on ${when(vis.withdrawnAt)}. That is an admin moderation record, not a candidate preference — but it closes the same gate, and the unlock refuses with CANDIDATE_UNAVAILABLE.`,
      summary: "the candidate is withdrawn from discovery",
      action: "Reinstate the visibility record if the withdrawal was a moderation action that no longer applies.",
    });
  } else if (!vis.exists || !vis.searchableByRecruiters) {
    checks.push({
      id: "candidate-not-searchable",
      group: "candidate",
      label: "Candidate not in the search index",
      status: "BLOCKING",
      detail: vis.exists
        ? "CandidateVisibility.searchableByRecruiters is false, so searchableUserWhere() excludes them and the unlock refuses with CANDIDATE_UNAVAILABLE."
        : "There is no CandidateVisibility row. The gate is a relation filter, so a missing row fails it and the unlock refuses with CANDIDATE_UNAVAILABLE.",
      summary: "the candidate is not searchable by recruiters",
      action: "The candidate's own page names the same blocker in full, on its Recruiter search panel.",
    });
  } else if (!facts.addressable) {
    checks.push({
      id: "candidate-not-addressable",
      group: "candidate",
      label: "Candidate not reachable by this recruiter",
      status: "BLOCKING",
      detail: `${candidate.label} passes the account and visibility gates, but resolveAddressableCandidate did not return them: they are not in the searchable profile pool, and they have not applied to a job this recruiter owns. The unlock refuses with CANDIDATE_UNAVAILABLE.`,
      summary: "the candidate is not in this recruiter's reachable pool",
      action: "The candidate's own page explains which pool condition they miss — usually a missing profile name or no claimed skill.",
    });
  } else {
    checks.push({
      id: "candidate-addressable",
      group: "candidate",
      label: "Candidate availability",
      status: "OK",
      detail:
        facts.addressableVia === "OWNED_APPLICATION"
          ? `${candidate.label} is reachable because they applied to a job this recruiter owns.`
          : `${candidate.label} is searchable and in the profile pool this recruiter can reach.`,
      summary: null,
      action: null,
    });
  }

  // ── Plan and limits ───────────────────────────────────────────────────────
  // Context, never a blocker: checkPlanLimit is a documented stub and the
  // unlock path does not call it. A row naming it as the reason would be naming
  // a restriction nothing enforces.
  checks.push({
    id: "plan-limit",
    group: "plan",
    label: "Plan limit on contact unlocks",
    status: "INFO",
    detail:
      facts.planLimit.reason === "NOT_IMPLEMENTED"
        ? "There is no plan tier on this platform yet: checkPlanLimit answers NOT_IMPLEMENTED and the unlock path does not call it. Credits are the only limit in force, so a plan restriction is never the reason an unlock fails today."
        : `checkPlanLimit answers ${facts.planLimit.reason}${facts.planLimit.remaining === null ? "" : `, ${facts.planLimit.remaining} remaining`}. The unlock path does not consult it, so it does not block.`,
    summary: null,
    action: null,
  });

  // ── Credits ───────────────────────────────────────────────────────────────
  const affordable =
    facts.alreadyUnlocked || facts.balanceMinor >= facts.costMinor;
  if (!affordable) {
    const short = facts.costMinor - facts.balanceMinor;
    checks.push({
      id: "insufficient-credits",
      group: "credits",
      label: "Insufficient credits",
      status: "BLOCKING",
      detail: `An unlock costs ${formatCreditsMinor(facts.costMinor)} and this workspace has ${formatCreditsMinor(facts.balanceMinor)} — ${formatCreditsMinor(short)} short. Nothing is charged when this refusal is returned.`,
      summary: "the workspace cannot afford the unlock",
      action: "Add credits with an ADMIN_ADJUSTMENT on the ledger. Never edit CreditAccount.balance by hand.",
    });
  } else {
    checks.push({
      id: "credits-ok",
      group: "credits",
      label: "Credits",
      status: "OK",
      detail: facts.alreadyUnlocked
        ? `Balance ${formatCreditsMinor(facts.balanceMinor)}. A repeat unlock is free, so the balance is not consulted.`
        : `Balance ${formatCreditsMinor(facts.balanceMinor)} against a cost of ${formatCreditsMinor(facts.costMinor)}. Affordable, leaving ${formatCreditsMinor(facts.balanceMinor - facts.costMinor)}.`,
      summary: null,
      action: null,
    });
  }

  // ── Recorded failures ─────────────────────────────────────────────────────
  if (facts.failures.length > 0) {
    const newest = facts.failures[0]!;
    checks.push({
      id: "recorded-failures",
      group: "failures",
      label: `${facts.failures.length} recorded failure${facts.failures.length === 1 ? "" : "s"} on this pair`,
      status: "INFO",
      detail: `Most recent: ${newest.kind === "OUTREACH_EMAIL" ? "an outreach email" : "a notification"} on ${when(newest.at)} — ${newest.reason}. These are delivery failures after an unlock, not unlock refusals; the platform records no failed unlock attempts of its own.`,
      summary: null,
      action: "The Delivery Log carries the full, redacted technical reason for each row.",
    });
  }

  const blocker = firstBlocker(checks);

  let outcome: UnlockOutcome;
  if (blocker?.group === "account") outcome = "ACCOUNT_BLOCKED";
  else if (blocker?.group === "workspace") outcome = "NOT_A_RECRUITER";
  else if (blocker?.group === "candidate") outcome = "CANDIDATE_UNAVAILABLE";
  else if (blocker?.group === "credits") outcome = "INSUFFICIENT_CREDITS";
  else if (facts.alreadyUnlocked) outcome = "ALREADY_UNLOCKED";
  else outcome = "WOULD_SUCCEED";

  return {
    canUnlock: blocker === null,
    outcome,
    verdict: verdictFor(outcome, facts, blocker),
    blocker,
    checks,
  };
}

function verdictFor(
  outcome: UnlockOutcome,
  facts: UnlockDiagnosisFacts,
  blocker: UnlockCheck | null,
): string {
  const who = facts.recruiter.name;
  const whom = facts.candidate.publicId;
  if (outcome === "ALREADY_UNLOCKED") {
    return `${who} has already unlocked ${whom}. Nothing is blocked, and a repeat costs nothing.`;
  }
  if (outcome === "WOULD_SUCCEED") {
    return `${who} can unlock ${whom} right now: ${formatCreditsMinor(facts.costMinor)} against a balance of ${formatCreditsMinor(facts.balanceMinor)}.`;
  }
  return `${who} cannot unlock ${whom} because ${blocker?.summary ?? "of a blocked condition"}.`;
}
