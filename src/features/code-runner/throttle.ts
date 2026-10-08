/**
 * In-memory cooldown for code execution requests.
 *
 * Per server instance and best-effort by design: it stops repeated clicks and
 * simple scripts from spamming the executor, it resets on a cold start, and it
 * is not shared across instances.
 *
 * It deliberately does not use `assertRateLimit` (`@/lib/rate-limit`). That
 * limiter inserts a RateLimitEvent row on every hit, and a Run must never
 * write to the database.
 */
const lastHitAt = new Map<string, number>();

const MAX_ENTRIES = 5_000;
const STALE_AFTER_MS = 60_000;

/** True when `key` may proceed now; records the hit when it does. */
export function allowHit(
  key: string,
  cooldownMs: number,
  now: number = Date.now(),
): boolean {
  const last = lastHitAt.get(key);
  if (last !== undefined && now - last < cooldownMs) return false;

  if (lastHitAt.size >= MAX_ENTRIES) {
    for (const [k, at] of lastHitAt) {
      if (now - at > STALE_AFTER_MS) lastHitAt.delete(k);
    }
  }
  lastHitAt.set(key, now);
  return true;
}
