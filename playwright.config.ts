/**
 * Plan 195 — the browser suite.
 *
 *   npm run test:env:e2e
 *   npm run test:env:e2e:ui
 *
 * This exists for the assertions `scripts/test-env/smoke.ts` cannot make. The
 * gated surfaces in this product answer 200 with a loading shell and decide
 * what to show after hydration, so "was this candidate actually let into the
 * hire desk" is a question about the screen, not about a status code. A browser
 * can see the screen.
 *
 * It also carries the acceptance test for the whole of plan 195 — three
 * identities signed in at once in ONE browser, in `specs/session-isolation`.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { defineConfig, devices } from "@playwright/test";
import { config as loadEnvFile } from "dotenv";

import { TEST_PORT, isLoopbackDatabase, databaseHost } from "./src/lib/test-env";

/**
 * `.env.test` before anything else, with `override`, exactly as
 * `scripts/test-env/guard.ts` does and for the same reason: `.env.local` sets
 * `DATABASE_URL` to a Neon host holding real users, dotenv will not replace an
 * already-set variable, and this config file is loaded afresh by every worker
 * process — so this is where each of them learns which database it is allowed
 * to touch.
 */
const envPath = resolve(__dirname, ".env.test");
if (!existsSync(envPath)) {
  throw new Error("Missing .env.test. Run `npm run test:env:setup` first.");
}
loadEnvFile({ path: envPath, override: true });

// The same refusal the scripts make, for the same reason: the suite signs in,
// spends credits and rewrites rows. There is no override flag.
if (!isLoopbackDatabase()) {
  throw new Error(
    `REFUSING TO RUN — DATABASE_URL host is ${databaseHost() ?? "(unparseable)"}, not loopback.`,
  );
}

export const BASE_URL = `http://localhost:${TEST_PORT}`;

/** Where `e2e/auth.setup.ts` leaves one signed-in storage state per identity. */
export const STATE_DIR = resolve(__dirname, "e2e/.auth");

export default defineConfig({
  testDir: "./e2e",
  /**
   * Serial, one worker. These tests share one database — a parallel run would
   * have one spec's fixture land in the middle of another's assertions, and the
   * failure would look like a product bug. Breadth is `smoke.ts`'s job; this
   * suite is small and deliberate.
   */
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],

  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: BASE_URL,
    // Dev-server renders are slow on a cold route, and every route here is
    // cold the first time the suite touches it.
    navigationTimeout: 45_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      args: [
        /**
         * The session-isolation spec needs `recruiter.localhost` and
         * `admin.localhost` to be this machine. macOS's resolver does that
         * already; glibc does not, so on Linux the spec would fail for a
         * reason that has nothing to do with the product. Telling Chromium
         * directly makes it true everywhere and needs no `/etc/hosts` entry
         * and no sudo.
         */
        "--host-resolver-rules=MAP *.localhost 127.0.0.1",
        /**
         * This suite only ever talks to the dev server on loopback, so it has
         * no use for a proxy — and a proxy is actively harmful here. A
         * container that sets `HTTPS_PROXY` typically exempts `localhost` and
         * `127.0.0.1` in `no_proxy` but says nothing about `*.localhost`, so
         * Chromium sends `recruiter.localhost` to the proxy and every request
         * fails with a bare "Failed to fetch". Refusing a proxy outright is
         * both the fix and the honest description of what these tests need.
         */
        "--no-proxy-server",
      ],
    },
  },

  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "e2e",
      testMatch: /specs\/.*\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  /**
   * Starts the test dev server if it is not already up, and reuses it if it is.
   * `test:env:dev` is the only launcher that puts `.env.test` into the server's
   * environment before Next reads `.env.local`, so it is the only correct way
   * to start it — hence the npm script rather than `next dev` directly.
   *
   * Two minutes because a cold Turbopack start plus the first compile is slow.
   */
  webServer: {
    command: "npm run test:env:dev",
    url: `${BASE_URL}/api/auth/csrf`,
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
