/**
 * Plan 195 — one signed-in storage state per identity.
 *
 * Runs once, before the specs, and leaves a `storageState` JSON in `e2e/.auth/`
 * for each identity a spec needs. A spec then picks its identity with
 *
 *     test.use({ storageState: stateFor("recruiter") });
 *
 * and starts already signed in, which keeps the sign-in cost out of every test
 * and keeps the specs about the product rather than about the login form.
 *
 * WHY IT SIGNS IN OVER HTTP AND NOT THROUGH THE FORM. The form is worth testing
 * — but not seven times, and not as the precondition of every other test: a
 * flake in it would fail the whole suite for unrelated reasons. So this posts to
 * the real `password` provider, through the real CSRF handshake, with the real
 * scrypt check behind it. Nothing here forges a JWT: if the provider is broken,
 * this setup fails and every spec is marked as skipped rather than passing on a
 * hand-made session.
 */
import { existsSync, mkdirSync } from "node:fs";

import { test as setup, expect } from "@playwright/test";

import { E2E_IDENTITIES, signInAs, stateFor } from "./identities";
import { BASE_URL, STATE_DIR } from "../playwright.config";
/**
 * Statically imported, which matters twice over. Playwright transpiles the
 * static imports of a test file but hands a runtime `import()` of a `.ts` file
 * to Node, which cannot load it — so this cannot be deferred. And it need not
 * be: `src/lib/db` binds its PrismaClient to `DATABASE_URL` at module load, and
 * `playwright.config.ts` is evaluated in every worker before any test file is
 * loaded, so `.env.test` is already in the environment by the time this runs.
 */
import { prisma } from "../src/lib/db";
import { TEST_IDENTITIES } from "../src/lib/test-env";

setup("sign in as every identity the specs need", async ({ playwright }) => {
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });

  // A guard against the cast and this list drifting apart. Checked first,
  // because the sign-in failure a stale name produces would blame the login
  // form for a typo in a list.
  for (const key of E2E_IDENTITIES) {
    expect(
      TEST_IDENTITIES.some((i) => i.key === key),
      `E2E_IDENTITIES names "${key}", which is not in TEST_IDENTITIES`,
    ).toBeTruthy();
  }

  /**
   * The password checks below are real, and `authorizePassword` rate limits by
   * IP (100 a window) and by account (10). Several suite runs in a row would
   * trip the IP bucket and start failing for a reason that is not a product
   * fault, so the recorded events go first.
   */
  await prisma.rateLimitEvent.deleteMany({});

  for (const key of E2E_IDENTITIES) {
    /**
     * A context per identity, so one identity's cookies cannot end up in
     * another's storage state — which is exactly the failure this whole
     * environment exists to stop happening to a person.
     *
     * Signed in at `BASE_URL` rather than at the identity's own
     * `*.localhost` host: a storage state is loaded into a context of its own,
     * so there is no collision to avoid here, and keeping every state on one
     * origin means a spec can navigate with bare paths. The per-host jars are
     * what `specs/session-isolation.spec.ts` is for, and it signs in itself.
     */
    const request = await playwright.request.newContext({ baseURL: BASE_URL });
    try {
      const identity = await signInAs(request, key, BASE_URL);

      const state = await request.storageState();
      expect(
        state.cookies.some((c) => c.name === "authjs.session-token.v2"),
        `${identity.email} got no session cookie`,
      ).toBeTruthy();

      await request.storageState({ path: stateFor(key) });
      console.log(`   ✓ ${identity.email.padEnd(24)} → e2e/.auth/${key}.json`);
    } finally {
      await request.dispose();
    }
  }
});
