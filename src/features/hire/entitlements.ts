import "server-only";

/**
 * THE server-side entitlement check for recruiter plan limits.
 *
 * STUB — T-003. Returns `NOT_IMPLEMENTED` and, deliberately, `allowed: false`.
 * T-033 grows this file into the real check and T-032 supplies the numbers.
 *
 * ## Why it fails closed
 *
 * A stub that answers `allowed: true` is not a placeholder, it is an absent
 * gate: every consumer written against it this week ships a path that permits
 * whatever it was meant to restrict, and nothing fails until someone reads the
 * database. The first limit this file will carry gates paid access to a
 * candidate's contact details, so the wrong default is a privacy failure as
 * well as a commercial one.
 *
 * `reason` exists so a consumer can tell "you have run out" from "this is not
 * built yet" without either one being mistaken for permission.
 *
 * ## Where it sits in the unlock
 *
 * Never on its own, and never first. The unlock asks three questions in order —
 * has this recruiter already been granted access, is this candidate still
 * visible, and only then is there allowance left — so a refusal never reads as
 * "buy more credits" when the real reason is that the candidate said no. See
 * docs/plans/112-t029-recruiter-contact-access-flow.md §6.
 *
 * `server-only`: this decides an entitlement, and a Client Component that could
 * import it is a check the browser can be asked to make about itself.
 */

/**
 * The limits a recruiter plan can carry.
 *
 * One member today. A union rather than a string means a typo is a compile
 * error instead of a limit that silently does not exist — and a limit that does
 * not exist is a limit that does not apply.
 */
export type PlanLimitKey = "CONTACT_UNLOCK";

export type PlanLimitReason =
  | "NOT_IMPLEMENTED"
  | "WITHIN_LIMIT"
  | "LIMIT_REACHED"
  | "NO_PLAN";

export type PlanLimitResult = {
  allowed: boolean;
  /** Remaining allowance where it is known. Null when it is not — never 0. */
  remaining: number | null;
  reason: PlanLimitReason;
};

export async function checkPlanLimit(
  recruiterUserId: string,
  key: PlanLimitKey,
): Promise<PlanLimitResult> {
  void recruiterUserId;
  void key;
  return { allowed: false, remaining: null, reason: "NOT_IMPLEMENTED" };
}
