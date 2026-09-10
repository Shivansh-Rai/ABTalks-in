/**
 * Credits as a person reads them. `20000` → `"$200.00"`.
 *
 * Its own file, deliberately. The reads that produce this number live in
 * `features/hire/credits.ts`, which is `server-only` because it resolves a
 * workspace from the session — and a balance is exactly the sort of thing a
 * Client Component ends up rendering. A formatter behind a server-only import
 * is a formatter that gets quietly re-written, slightly differently, in the
 * first component that needs it, and two roundings of the same money is a bug
 * report nobody enjoys.
 *
 * Pure: no DB, no `server-only`. Safe on both sides of the boundary.
 */

/**
 * @param minor USD minor units (cents). Always an integer — the ledger has no
 * other kind of amount, and dividing only happens here, at the very last step.
 */
export function formatCreditsMinor(minor: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(minor / 100);
}
