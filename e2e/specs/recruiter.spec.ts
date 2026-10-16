/**
 * Plan 195 — the hire desk, and the isolation between two recruiters.
 *
 * Two organizations exist in the cast on purpose: recruiter isolation is a real
 * invariant of this platform and one recruiter cannot test it. So the pipeline
 * fixture is applied to Test Hiring Co and then Second Hiring Co is asked what
 * it can see.
 *
 * Every fixture applied here is undone at the end of its test, so the specs can
 * run in any order and the baseline survives. `npm run test:env:reset` is the
 * belt and braces.
 */
import { expect, test } from "@playwright/test";

import { applyFixture } from "../fixtures";
import { stateFor } from "../identities";

/** The onboarding grant, which is what the bootstrap leaves both desks holding. */
const BASELINE_DOLLARS = 200;

test.describe("recruiter", () => {
  test.use({ storageState: stateFor("recruiter") });

  test("the desk opens on the recruiter's own organization", async ({ page }) => {
    await page.goto("/hire");
    await expect(page.getByText("WHO ARE YOU LOOKING FOR?")).toBeVisible();
    await expect(page.getByText("Test Hiring Co").first()).toBeVisible();
  });

  test("the credit balance on screen is the one the fixture set", async ({
    page,
  }) => {
    await applyFixture("recruiter-credits", { key: "recruiter", dollars: 350 });
    await page.goto("/hire/credits");
    await expect(page.getByText("Current balance")).toBeVisible();
    await expect(page.getByText("$350.00").first()).toBeVisible();

    // The empty desk is a state worth seeing too: it is what a recruiter who
    // has spent everything hits, and the paywall copy hangs off it.
    await applyFixture("recruiter-empty-desk", { key: "recruiter" });
    await page.goto("/hire/credits");
    await expect(page.getByText("$0.00").first()).toBeVisible();

    await applyFixture("recruiter-credits", {
      key: "recruiter",
      dollars: BASELINE_DOLLARS,
    });
  });

  test("the pipeline fixture puts real candidates on the pipeline board", async ({
    page,
  }) => {
    await page.goto("/hire/pipeline");
    await expect(page.getByText("No one in your pipeline yet.")).toBeVisible();

    await applyFixture("recruiter-pipeline", { key: "recruiter" });
    await page.goto("/hire/pipeline");

    /**
     * The fixture spreads five of the cast across stages. Asserted as the
     * board's own count plus the cards that are actually on screen: the nine
     * stage columns scroll, so only some cards are visible at any width, and
     * `toBeVisible` on all five would be asserting the viewport rather than
     * the data.
     */
    await expect(page.getByText("No one in your pipeline yet.")).toBeHidden();
    await expect(page.getByText("5 candidates across 9 stages.")).toBeVisible();
    await expect(page.getByText("Meera").first()).toBeVisible();

    await applyFixture("recruiter-empty-desk", { key: "recruiter" });
    await applyFixture("recruiter-credits", {
      key: "recruiter",
      dollars: BASELINE_DOLLARS,
    });
  });
});

test.describe("recruiter isolation", () => {
  test("a second organization cannot see the first organization's pipeline", async ({
    browser,
  }) => {
    await applyFixture("recruiter-pipeline", { key: "recruiter" });

    // Two contexts, so the two recruiters are genuinely two browsers rather
    // than one browser being asked to hold both — the per-host jars exist for
    // a person switching sides by hand, not for this.
    const first = await browser.newContext({ storageState: stateFor("recruiter") });
    const second = await browser.newContext({
      storageState: stateFor("recruiter2"),
    });

    try {
      const owner = await first.newPage();
      await owner.goto("/hire/pipeline");
      await expect(owner.getByText("Meera").first()).toBeVisible();

      const other = await second.newPage();
      await other.goto("/hire/pipeline");
      await expect(
        other.getByText("Second Hiring Co").first(),
        "the second recruiter should be looking at its own organization",
      ).toBeVisible();
      await expect(
        other.getByText("Meera"),
        "Second Hiring Co can see a candidate on Test Hiring Co's pipeline",
      ).toBeHidden();
      await expect(other.getByText("No one in your pipeline yet.")).toBeVisible();
    } finally {
      await first.close();
      await second.close();
      await applyFixture("recruiter-empty-desk", { key: "recruiter" });
      await applyFixture("recruiter-credits", {
        key: "recruiter",
        dollars: BASELINE_DOLLARS,
      });
    }
  });
});
