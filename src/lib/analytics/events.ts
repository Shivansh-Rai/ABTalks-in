/**
 * T-253 — the GA4 event vocabulary and the PII filter that stands between
 * ABTalks and Google Analytics.
 *
 * Plain module: no React, no `"use client"`, no `next/headers`, no `window`.
 * Every decision here is a pure function of its arguments, so the tests can
 * exercise all of it without a browser — the same split T-252 used for
 * `components/analytics/ga4-loader-gate.ts`.
 *
 * The transport lives in `use-track.ts`; this file never touches `window.gtag`.
 *
 * Names follow the `<track>_<object>_<verb_past_tense>` convention fixed by
 * docs/plans/114-ga4-event-taxonomy.md §3.
 */
import { toGaConsent } from "@/lib/analytics/consent";
import type { CookieChoice } from "@/lib/cookies";

export const ANALYTICS_EVENTS = {
  /** Recruiter finished signup — OTP verified and the profile row was written. */
  recruiterRegSubmitted: "recruiter_reg_submitted",
  /** A recruiter opened one candidate's profile. */
  recruiterCandidateViewed: "recruiter_candidate_viewed",
  /** An engagement request reached CONTACT_SHARED — identity actually released. */
  recruiterContactUnlocked: "recruiter_contact_unlocked",
  /** A candidate saved one section of their profile. */
  siteProfileUpdated: "site_profile_updated",
  /** A candidate's save added at least one skill they did not have before. */
  siteSkillAdded: "site_skill_added",
  /** A job application row was created. */
  siteJobApplied: "site_job_applied",
  /** A candidate submitted an assessment and the server returned a score. */
  siteTestCompleted: "site_test_completed",
} as const;

export type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

// ── Bounded parameter value sets ─────────────────────────────────────────────
// Plan 114 §4 requires every parameter to have either a bounded value set or a
// bucket rule. These are the bounded sets; the bucket rules are below them.

export const PROFILE_SECTIONS = [
  "basic",
  "skills",
  "links",
  "education",
  "experience",
  "projects",
  "certifications",
  "preferences",
] as const;
export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

export const SKILL_COUNT_BUCKETS = ["1-3", "4-10", "11+"] as const;
export type SkillCountBucket = (typeof SKILL_COUNT_BUCKETS)[number];

export const SCORE_BUCKETS = ["low", "mid", "high"] as const;
export type ScoreBucket = (typeof SCORE_BUCKETS)[number];

export const SIGNUP_METHODS = ["otp"] as const;
export type SignupMethod = (typeof SIGNUP_METHODS)[number];

/**
 * The runtime contract: for each event, every parameter it may carry and the
 * complete set of values that parameter may take.
 *
 * This is the whole PII defence, and it is an allowlist on purpose. A denylist
 * of forbidden strings (plan 114 §7) can only catch the leaks somebody thought
 * of; an allowlist of eight bounded enums cannot carry a name, an email, a
 * phone number, a note, an answer or a row id no matter what a call site
 * passes, because none of those values are in any of these arrays.
 *
 * An empty object means the event takes no parameters at all — which is the
 * right answer whenever the event's existence is the entire signal.
 */
const EVENT_PARAMS = {
  recruiter_reg_submitted: { method: SIGNUP_METHODS },
  recruiter_candidate_viewed: {},
  recruiter_contact_unlocked: {},
  site_profile_updated: { section: PROFILE_SECTIONS },
  site_skill_added: { skill_count_bucket: SKILL_COUNT_BUCKETS },
  site_job_applied: {},
  site_test_completed: { score_bucket: SCORE_BUCKETS },
} as const satisfies Record<
  AnalyticsEventName,
  Readonly<Record<string, readonly string[]>>
>;

/**
 * The compile-time mirror of EVENT_PARAMS. Spelled out rather than derived so
 * a call site's mistake reads as "section must be one of …" instead of a
 * conditional-type error, and so the two shapes can be checked against each
 * other in the tests.
 */
export type AnalyticsEventParams = {
  recruiter_reg_submitted: { method: SignupMethod };
  recruiter_candidate_viewed: undefined;
  recruiter_contact_unlocked: undefined;
  site_profile_updated: { section: ProfileSection };
  site_skill_added: { skill_count_bucket: SkillCountBucket };
  site_job_applied: undefined;
  site_test_completed: { score_bucket: ScoreBucket };
};

/** Introspection for the tests and for anyone auditing what a name may carry. */
export function allowedParamsFor(
  name: AnalyticsEventName,
): Readonly<Record<string, readonly string[]>> {
  return EVENT_PARAMS[name];
}

/**
 * Reduces whatever a call site passed to the subset this event is allowed to
 * send. Unknown keys are dropped, and so is any value outside the declared set
 * — including a well-named key holding free text.
 *
 * Returns a fresh object, never the caller's, so nothing that was filtered out
 * can travel by reference.
 */
export function sanitizeParams(
  name: AnalyticsEventName,
  params?: Readonly<Record<string, unknown>>,
): Record<string, string> {
  const allowed = EVENT_PARAMS[name] as Readonly<
    Record<string, readonly string[]>
  >;
  const safe: Record<string, string> = {};
  if (!params) return safe;

  for (const [key, values] of Object.entries(allowed)) {
    const candidate = params[key];
    if (typeof candidate !== "string") continue;
    if (!values.includes(candidate)) continue;
    safe[key] = candidate;
  }
  return safe;
}

// ── Bucket rules ─────────────────────────────────────────────────────────────

/**
 * How many skills the candidate now claims, as a band.
 *
 * The count is bucketed rather than sent — and the skill *names* never leave
 * the browser at all, per plan 114 §7 ("Skill names entered by candidates …
 * could contain employer names or other identifying context").
 */
export function skillCountBucket(total: number): SkillCountBucket {
  if (total <= 3) return "1-3";
  if (total <= 10) return "4-10";
  return "11+";
}

/**
 * An assessment result as a band, from the correct-answer count and the number
 * of questions. Takes both so no call site has to compute a percentage — and
 * so neither the raw score nor the question count is ever what gets sent.
 *
 * A zero-question quiz cannot be scored, so it reads as `low` rather than
 * dividing by zero.
 */
export function scoreBucket(correct: number, total: number): ScoreBucket {
  if (total <= 0) return "low";
  const pct = (correct / total) * 100;
  if (pct < 40) return "low";
  if (pct < 75) return "mid";
  return "high";
}

// ── Consent gate ─────────────────────────────────────────────────────────────

/**
 * Whether this consent choice permits an analytics event to be sent.
 *
 * Derived from T-252's `toGaConsent` rather than re-listing `limited` and
 * `all`, so the emit gate and the Consent Mode defaults the loader sets can
 * never drift apart.
 *
 * Plan 114 §6 requires this check at the emit site and not only at the loader:
 * the `analytics_storage` signal alone is not enough, because a script that
 * loaded before a downgrade would still have a callable `gtag`.
 */
export function hasAnalyticsConsent(choice: CookieChoice | null): boolean {
  return toGaConsent(choice).analytics_storage === "granted";
}
