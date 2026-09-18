/**
 * Plan 153. Pure predicates that decide whether the client bell should refetch
 * the notification feed. Extracted from `notification-provider.tsx` so the
 * decision logic has a unit test — the provider itself is a React client
 * component and needs a DOM harness the project does not have.
 *
 * The predicate is `now - cachedAt > staleMs`. Trivial. What matters is that
 * `null` and future timestamps do not silently return `false` (both used to
 * suppress a needed refetch on the old inline version).
 */

/**
 * True if a cached feed is older than `staleMs` and therefore worth
 * refetching. A null cache is always "stale enough". A cache with a future
 * timestamp (clock drift, replayed test data) is also treated as stale — the
 * safe direction, since a false negative here is the bug this fix exists to
 * prevent (silent bell).
 */
export function shouldRefetch(
  cachedAt: number | null | undefined,
  now: number,
  staleMs: number,
): boolean {
  if (cachedAt == null) return true;
  const age = now - cachedAt;
  if (age < 0) return true; // future timestamp — treat as stale
  return age > staleMs;
}
