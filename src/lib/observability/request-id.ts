/**
 * T-259 — request correlation.
 *
 * `middleware.ts` stamps every request with `x-request-id` (generated, or the
 * caller's own when it is a well-formed one) and echoes it on the response.
 * Everything downstream — Server Components, Server Actions, route handlers —
 * reads it back from here, so one incident has one id across the response
 * header, the operational log and the Sentry event.
 *
 * The regex is duplicated in `middleware.ts` on purpose: middleware may not
 * import from `@/lib/*` (1 MB Edge bundle limit), the same way the consent
 * cookie constants are duplicated there. Keep the two in sync by hand.
 */

export const REQUEST_ID_HEADER = "x-request-id";

/** Accepts a UUID or any other short opaque token a proxy might already set. */
const REQUEST_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

export function isValidRequestId(value: string | null | undefined): boolean {
  return typeof value === "string" && REQUEST_ID_RE.test(value);
}

/**
 * The current request's id, or `undefined` outside a request (a cron script, a
 * seed, a unit test). Never throws — correlation is a nice-to-have and must
 * not be able to break the path it is observing.
 */
export async function getRequestId(): Promise<string | undefined> {
  try {
    // Imported lazily so this module stays usable from non-request code
    // (scripts, tests) where `next/headers` is not resolvable.
    const { headers } = await import("next/headers");
    const value = (await headers()).get(REQUEST_ID_HEADER);
    return isValidRequestId(value) ? value! : undefined;
  } catch {
    return undefined;
  }
}
