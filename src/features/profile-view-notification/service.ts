import type { ProfileViewStore } from "./store";

/**
 * The rolling dedup window. T-251 wants "at most one notification per
 * (recruiter, candidate) per rolling 24 hours"; this is the width of that
 * window.
 */
export const ROLLING_WINDOW_MS = 24 * 60 * 60 * 1000;

export type DispatchFn = (event: {
  eventType: string;
  recipientUserId: string;
  primaryEntityId: string;
  title: string;
  body?: string;
  href?: string;
  metadata?: Record<string, unknown>;
  /** Optional per-send dedupe key — used by T-251 for a rotating 24h bucket. */
  dedupeKey?: string;
}) => Promise<{ ok: true; deduplicated: boolean } | { ok: false; message: string }>;

export type ServiceDeps = {
  store: ProfileViewStore;
  dispatch: DispatchFn;
  now?: () => Date;
};

export type NotifyResult =
  | { ok: true; sent: true; deduplicated: boolean }
  | { ok: true; sent: false; reason: "self_view" | "window" }
  | { ok: false; message: string };

/**
 * Notify a candidate that a recruiter opened their profile.
 *
 * Enforces the rolling 24-hour window in two places:
 *   1. Pre-query — refuses to dispatch if a `profile.viewed` row already
 *      exists for (candidate, recruiter) inside the window.
 *   2. Rotating dedupeKey — the `dispatch()` unique-key protection uses a
 *      bucket that rotates every 24 hours, so a race between two parallel
 *      first-view events for the same pair inside the window still resolves
 *      to one notification.
 *
 * Callers MUST have already authenticated the recruiter session. Admin,
 * system, and cron paths must not call this function.
 */
export async function notifyProfileViewed(
  deps: ServiceDeps,
  input: { candidateUserId: string; recruiterUserId: string },
): Promise<NotifyResult> {
  if (input.candidateUserId === input.recruiterUserId) {
    return { ok: true, sent: false, reason: "self_view" };
  }

  const now = (deps.now ?? (() => new Date()))();
  const since = new Date(now.getTime() - ROLLING_WINDOW_MS);

  const recent = await deps.store.hasRecentNotification(
    input.candidateUserId,
    input.recruiterUserId,
    since,
  );
  if (recent) return { ok: true, sent: false, reason: "window" };

  // Bucket rotates every ROLLING_WINDOW_MS. Two attempts inside the same
  // bucket collide on this key at the DB unique index; the next bucket
  // opens a new key.
  const bucket = Math.floor(now.getTime() / ROLLING_WINDOW_MS);
  const dedupeKey = `profile.viewed:${input.candidateUserId}:${input.recruiterUserId}:${bucket}`;

  // Anonymous copy: never name the recruiter in title or body. Candidates
  // should feel noticed, not surveilled — and revealing which company/user
  // was looking at them turned out to be a privacy and product concern.
  // The `recruiterUserId` stays in `metadata` for the audit trail and for
  // any admin surface, but nothing that reaches the candidate's inbox or
  // bell exposes it.
  const res = await deps.dispatch({
    eventType: "profile.viewed",
    recipientUserId: input.candidateUserId,
    primaryEntityId: input.recruiterUserId,
    title: "You're getting noticed",
    body: "1 more recruiter viewed your profile.",
    href: "/profile",
    metadata: {
      recruiterUserId: input.recruiterUserId,
      at: now.toISOString(),
    },
    dedupeKey,
  });

  if (!res.ok) return { ok: false, message: res.message };
  return { ok: true, sent: true, deduplicated: res.deduplicated };
}
