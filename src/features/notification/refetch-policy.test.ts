/**
 * Plan 153 acceptance tests for the notification-provider refetch predicate.
 *   npx tsx src/features/notification/refetch-policy.test.ts
 */
import { shouldRefetch } from "./refetch-policy";

let passed = 0;
let failed = 0;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function suite(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}\n      ${(e as Error).message}`);
  }
}

console.log("refetch-policy.test.ts (plan 153)");

const STALE = 10_000;
const NOW = 1_700_000_000_000;

suite("null cache is always stale (first mount)", () => {
  assert(shouldRefetch(null, NOW, STALE) === true, "null → true");
  assert(shouldRefetch(undefined, NOW, STALE) === true, "undefined → true");
});

suite("fresh cache (age < staleMs) does NOT trigger refetch", () => {
  assert(shouldRefetch(NOW - 1_000, NOW, STALE) === false, "1s old → false");
  assert(shouldRefetch(NOW - 9_999, NOW, STALE) === false, "9.999s old → false");
});

suite("cache exactly at the boundary does NOT refetch", () => {
  // Strict `>`: at the boundary itself, still fresh. Matches the inline
  // provider behaviour and gives the cache a full ten seconds of grace.
  assert(shouldRefetch(NOW - STALE, NOW, STALE) === false, "at boundary → false");
});

suite("cache older than staleMs triggers refetch", () => {
  assert(shouldRefetch(NOW - STALE - 1, NOW, STALE) === true, "just over → true");
  assert(shouldRefetch(NOW - 60_000, NOW, STALE) === true, "60s old → true");
  assert(shouldRefetch(NOW - 24 * 60 * 60_000, NOW, STALE) === true, "24h old → true");
});

suite("cache with a future timestamp (clock drift) is stale", () => {
  // The pre-fix inline predicate `Date.now() - t > TTL_MS` returned false for
  // a future `t`, silently suppressing a refetch. That is precisely the "bell
  // never updates" symptom this plan exists to fix, so the new predicate
  // treats a negative age as stale.
  assert(shouldRefetch(NOW + 5_000, NOW, STALE) === true, "future 5s → true");
  assert(shouldRefetch(NOW + 60_000, NOW, STALE) === true, "future 60s → true");
});

suite("staleMs of 0 refetches on any nonzero age", () => {
  assert(shouldRefetch(NOW - 1, NOW, 0) === true, "1ms old → true");
  assert(shouldRefetch(NOW, NOW, 0) === false, "0ms old → false (at boundary)");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
