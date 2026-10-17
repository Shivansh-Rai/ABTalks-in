/**
 * Plan 195 — the candidate side, and the door that should be shut to it.
 *
 * The fixtures are driven from inside the test rather than assumed: the
 * bootstrap puts Arjun on day 7, but "day 7" drifts to day 8 the next morning,
 * and a suite that silently depends on today's date is a suite that fails on a
 * Monday for no reason. Setting the day first makes the assertion about the
 * product, and incidentally proves the fixture reaches the screen — which is
 * the one thing a fixture is for and the one thing the CLI cannot show.
 */
import { expect, test } from "@playwright/test";

import { applyFixture } from "../fixtures";
import { stateFor } from "../identities";

test.describe("candidate", () => {
  test.use({ storageState: stateFor("arjun") });

  test("the dashboard shows the day the fixture put this candidate on", async ({
    page,
  }) => {
    await applyFixture("candidate-day", { key: "arjun", day: 30 });
    await page.goto("/dashboard");
    await expect(page.getByText("YOUR CHALLENGES")).toBeVisible();
    await expect(page.getByText("Day 30 of 60")).toBeVisible();

    /**
     * Note which number this is. The track card's "Day 30 of 60" is derived
     * from the enrollment's day anchor, which is what the fixture moves. The
     * grid beside it still reads "7 active days of 60", because that counts
     * real `ActivityAttempt` rows and the fixture deliberately does not invent
     * any — see the comment on `candidate-day` in
     * `scripts/test-env/fixtures.ts`. Asserting the wrong one of those two is
     * the mistake this comment exists to prevent.
     */
    await expect(page.getByText("7 active days of 60")).toBeVisible();

    // Moved again, to show the dashboard is reading the database rather than
    // something baked in at build time.
    await applyFixture("candidate-day", { key: "arjun", day: 45 });
    await page.goto("/dashboard");
    await expect(page.getByText("Day 45 of 60")).toBeVisible();

    // Back to the bootstrap's own day 7, so the next spec starts where the
    // baseline left it. `npm run test:env:reset` is the belt and braces.
    await applyFixture("candidate-day", { key: "arjun", day: 7 });
  });

  test("a candidate is refused at the hire desk", async ({ page }) => {
    /**
     * This is the assertion `scripts/test-env/smoke.ts` cannot make. Over HTTP
     * this route answers 200, so a status-based check would call it a leak;
     * what actually reaches the screen is a refusal. Recruiter isolation is an
     * invariant of this platform, so it is worth asserting on the screen.
     */
    await page.goto("/hire/pipeline");
    await expect(
      page.getByText("This account is not a recruiter account."),
    ).toBeVisible();

    // And none of the recruiter's furniture rendered.
    await expect(page.getByText("Hiring Pipeline")).toBeHidden();
  });

  test("the admin area is not reachable", async ({ page }) => {
    await page.goto("/admin");
    // Server-side `redirect("/dashboard")` in `requireAdmin`, so unlike the
    // hire desk this one never renders at all.
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("PLATFORM ADMIN")).toBeHidden();
  });
});

test.describe("an account with no candidate profile", () => {
  test.use({ storageState: stateFor("fresh") });

  test("lands in the registration funnel", async ({ page }) => {
    await page.goto("/register");
    // The point of this identity: signed in, but with no `CandidateProfile`,
    // so it exercises registration rather than the dashboard.
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByText("YOUR CHALLENGES")).toBeHidden();
  });
});
