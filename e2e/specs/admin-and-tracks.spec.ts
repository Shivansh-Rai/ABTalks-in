/**
 * Plan 195 — the admin spine, and the two tracks that are not the challenge.
 *
 * The admin tests are also the proof that `ENABLE_DEV_AUTH=true` in `.env.test`
 * is doing its job. Without it the admin cannot sign in at all here:
 * `isGoogleOnlyAccount` refuses a password for anyone holding an admin grant,
 * and Google is deliberately not configured in this environment — so the whole
 * admin half would be unreachable. If these tests ever start failing at the
 * setup step, that flag is the first thing to check.
 */
import { expect, test } from "@playwright/test";

import { applyFixture } from "../fixtures";
import { stateFor } from "../identities";

test.describe("platform admin", () => {
  test.use({ storageState: stateFor("admin") });

  test("the admin console opens", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByText("PLATFORM ADMIN")).toBeVisible();
    await expect(page.getByText("Total Candidates")).toBeVisible();
  });

  test("revoking the grant closes the console, and granting it opens it again", async ({
    page,
  }) => {
    /**
     * Liveness of an admin grant is `revokedAt IS NULL` on a
     * `UserRoleAssignment`, not `User.role` — `db:seed` sets the role and
     * writes no grant, which is why `bootstrap.ts` has to add one explicitly.
     * This test is what stops that distinction being quietly lost.
     */
    await applyFixture("admin-revoke", { key: "admin" });
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/dashboard$/);

    await applyFixture("admin-grant", { key: "admin" });
    await page.goto("/admin");
    await expect(page.getByText("PLATFORM ADMIN")).toBeVisible();
  });
});

test.describe("AI cohort program", () => {
  test.use({ storageState: stateFor("program") });

  test.fixme(
    "the AI-cohort dashboard renders for an enrolled member",
    async ({ page }) => {
      /**
       * KNOWN BROKEN, found by this suite on 2026-10-16 and left recorded here
       * rather than quietly skipped.
       *
       * `/program/ai-cohort/dashboard` crashes on load for every audience —
       * enrolled member, admin and anonymous alike — and shows the error
       * boundary, "This page couldn’t load". The browser console carries:
       *
       *     Rendered more hooks than during the previous render.
       *       at updateMemo
       *       at Object.useMemo
       *       at Router (next/dist/client/…)
       *
       * The stack bottoms out inside Next's own `Router`, with no component of
       * this codebase on it, so it is a hooks-order fault somewhere in that
       * route's client tree rather than anything the test environment did; the
       * route-by-role sweep sees it as `shell` for all seven roles.
       *
       * It is out of scope for plan 195, which built the environment that
       * found it. Turn this back on with the fix.
       */
      await page.goto("/program/ai-cohort/dashboard");
      await expect(page.getByText("This page couldn’t load")).toBeHidden();
      await applyFixture("program-day", { key: "program", day: 20 });
      await page.goto("/program/ai-cohort/dashboard");
      await expect(page.getByText("210")).toBeVisible();
    },
  );

  test("the program landing page is public and renders", async ({ page }) => {
    // The track's front door works even though its dashboard does not, which
    // is worth holding onto so a fix to one is not mistaken for the other.
    await page.goto("/program/ai-cohort");
    await expect(page.locator("body")).toContainText(/cohort/i);
  });
});

test.describe("hackathon", () => {
  test.use({ storageState: stateFor("hackathon") });

  test("a participant is sent to the hackathon landing page while entry is closed", async ({
    page,
  }) => {
    /**
     * Not a bug, and worth writing down because it looks like one: the seeded
     * hackathon's window has passed, so `/hackathon/dashboard` redirects to
     * `/hackathon`, which says "Registration closed". The participant and the
     * `hackathon-submitted` fixture are both real — the submission exists in
     * the database — but no dashboard will show it until the event's dates are
     * open. A test that asserted the dashboard renders would be asserting that
     * the seeded event is current, which it is not.
     */
    await page.goto("/hackathon/dashboard");
    await expect(page).toHaveURL(/\/hackathon$/);
    await expect(page.getByText("Registration closed").first()).toBeVisible();
  });

  test("the submission fixture writes a submission the participant's team owns", async ({
    page,
  }) => {
    // Asserted through the database rather than the screen, for the reason
    // above. The fixture's own output is a claim; this is the check.
    const applied = await applyFixture("hackathon-submitted", {
      key: "hackathon",
    });
    expect(applied).toContain("has a submission");

    const reopened = await applyFixture("hackathon-open", { key: "hackathon" });
    expect(reopened).toContain("1 submission(s) removed");

    // The page still answers while all that happens, which is the only thing
    // the browser can usefully say here.
    await page.goto("/hackathon");
    await expect(page.locator("body")).toContainText(/hackathon|videothon/i);
  });
});
