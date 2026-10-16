/**
 * Plan 195 — who the browser suite signs in as, and how it does it.
 *
 * A plain module, not a test file: Playwright refuses to let one test file
 * import another, so `auth.setup.ts` (which writes the storage states) and the
 * specs (which read them, and which sign in again per host) need somewhere
 * neutral to agree.
 */
import { resolve } from "node:path";

import { expect, type APIRequestContext, type Page } from "@playwright/test";

import { STATE_DIR } from "../playwright.config";
import { TEST_PORT, findIdentity, type TestIdentity } from "../src/lib/test-env";

/**
 * The subset of `TEST_IDENTITIES` the specs use. The rest of the cast is still
 * reachable — through the test console, or by adding a key here — but every
 * name in this list costs a real sign-in in `auth.setup.ts`, so it holds one
 * identity per audience rather than all fifteen.
 */
export const E2E_IDENTITIES = [
  "arjun", // candidate, day 7
  "fresh", // signed in, but no CandidateProfile
  "recruiter", // recruiter at Test Hiring Co
  "recruiter2", // recruiter in a different organization — the isolation counterparty
  "admin", // platform admin
  "program", // AI-cohort member
  "hackathon", // hackathon participant
] as const;

export type E2EIdentity = (typeof E2E_IDENTITIES)[number];

/** The `storageState` path for one identity, written by `auth.setup.ts`. */
export function stateFor(key: E2EIdentity): string {
  return resolve(STATE_DIR, `${key}.json`);
}

/** `http://<host>:3100` — the cookie jar an identity is meant to live in. */
export function originFor(key: string): string {
  const identity = findIdentity(key);
  if (!identity) throw new Error(`Unknown identity "${key}".`);
  return `http://${identity.host}:${TEST_PORT}`;
}

/**
 * Sign in as one identity, using the same handshake the browser would: GET the
 * CSRF token, POST it back with the credentials.
 *
 * Use this only against a host Node's own resolver can find — in practice
 * `localhost`. For a `*.localhost` host use `signInOnHost` below, which goes
 * through the browser instead and explains why.
 */
export async function signInAs(
  request: APIRequestContext,
  key: string,
  origin = originFor(key),
): Promise<TestIdentity> {
  const identity = findIdentity(key);
  if (!identity) throw new Error(`Unknown identity "${key}".`);

  const csrfResponse = await request.get(`${origin}/api/auth/csrf`);
  expect(
    csrfResponse.ok(),
    `GET ${origin}/api/auth/csrf answered ${csrfResponse.status()}`,
  ).toBeTruthy();
  const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };

  const response = await request.post(`${origin}/api/auth/callback/password`, {
    form: {
      csrfToken,
      email: identity.email,
      password: identity.password,
      audience: identity.audience,
      callbackUrl: `${origin}${identity.landing}`,
    },
    maxRedirects: 0,
  });

  // The provider answers with a redirect either way; a failure carries
  // `?error=` in the destination, which is the only explanation there is.
  const location = response.headers()["location"] ?? "(no redirect)";
  expect(
    location,
    `${identity.email} was refused at ${origin}. The provider redirected to ` +
      `${location}. If this is the admin, check ENABLE_DEV_AUTH=true is in ` +
      `.env.test — isGoogleOnlyAccount refuses a password for anyone holding ` +
      `an admin grant, and Google is deliberately not configured here.`,
  ).not.toContain("error=");

  return identity;
}

/**
 * Sign in as one identity *through the browser*, at `origin`.
 *
 * WHY THIS EXISTS ALONGSIDE `signInAs`. Playwright's request contexts resolve
 * hostnames with Node's resolver, which does not know `recruiter.localhost`
 * (glibc has no `*.localhost` rule; macOS does) — so the request-based sign-in
 * above cannot reach the very hosts this environment is built around. Chromium
 * is told to map them in `playwright.config.ts`, so doing the handshake inside
 * the page works everywhere.
 *
 * It is also the more honest test: the session cookie is set by the browser's
 * own network stack, into the browser's own jar, which is exactly the thing
 * whose per-host behaviour is under test.
 */
export async function signInOnHost(
  page: Page,
  key: string,
  origin = originFor(key),
): Promise<TestIdentity> {
  const identity = findIdentity(key);
  if (!identity) throw new Error(`Unknown identity "${key}".`);

  // Same-origin first, so the fetches below carry and receive this host's
  // cookies. `/login` is public, and reachable while signed out.
  await page.goto(`${origin}/login`);

  const signedInAs = await page.evaluate(
    async ({ email, password, audience }) => {
      const csrf = await fetch("/api/auth/csrf", { credentials: "include" });
      if (!csrf.ok) throw new Error(`/api/auth/csrf answered ${csrf.status}`);
      const { csrfToken } = (await csrf.json()) as { csrfToken: string };

      /**
       * `redirect: "manual"` is required, not stylistic. The provider answers
       * with a 302, and the dev server is bound with `-H 0.0.0.0`, so the
       * `Location` it builds points at `http://0.0.0.0:3100/` — an address the
       * browser will not fetch. Following the redirect therefore fails with a
       * bare "Failed to fetch" even though the sign-in itself worked. The
       * response is opaque this way, but the `Set-Cookie` on it is still
       * applied, which is the only part that matters.
       */
      await fetch("/api/auth/callback/password", {
        method: "POST",
        credentials: "include",
        redirect: "manual",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ csrfToken, email, password, audience }),
      });

      // So success is confirmed by asking who this host thinks we are, which
      // is a better question than "where did the redirect point" anyway.
      const session = await fetch("/api/auth/session", {
        credentials: "include",
      });
      const body = (await session.json()) as { user?: { email?: string } };
      return body.user?.email ?? null;
    },
    {
      email: identity.email,
      password: identity.password,
      audience: identity.audience,
    },
  );

  expect(
    signedInAs,
    `${identity.email} was refused at ${origin}. If this is the admin, check ` +
      `ENABLE_DEV_AUTH=true is in .env.test — isGoogleOnlyAccount refuses a ` +
      `password for anyone holding an admin grant, and Google is deliberately ` +
      `not configured here.`,
  ).toBe(identity.email);

  return identity;
}
