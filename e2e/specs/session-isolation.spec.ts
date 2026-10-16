/**
 * Plan 195 — THE acceptance test.
 *
 * The problem this environment was built to solve: one browser could hold only
 * one identity. `auth.config.ts` declares a single session cookie,
 * `authjs.session-token.v2`, host-only with no `domain`, so signing in at
 * `/hire` evicted the candidate session at `/dashboard`. Testing the platform
 * meant signing out and in again for every switch.
 *
 * The fix needed no authentication change at all. Because that cookie is
 * host-only and every `*.localhost` name resolves to loopback, each test host
 * is an independent cookie jar. This spec is the proof: ONE browser context —
 * one cookie jar, as a person's browser is — holding a candidate, a recruiter
 * and an admin session at the same time, each surviving the others.
 *
 * It deliberately does NOT load a storage state. The whole claim is about what
 * happens when three sign-ins land in the same browser, so it does the three
 * sign-ins itself.
 *
 * WHAT IT ASSERTS, AND WHY IN THIS SHAPE. Identity is read from
 * `/api/auth/session`, fetched from inside a page on each host, so the browser
 * decides which cookies to attach — that is precisely the question, and the
 * answer is a string rather than a guess about which copy of an email in which
 * responsive nav happens to be visible. Alongside it, one visible marker per
 * host confirms the right *product* rendered and not merely a valid session.
 */
import { expect, test, type Page } from "@playwright/test";

import { originFor, signInOnHost } from "../identities";

/** Who this host thinks we are, as the browser itself would be told. */
async function sessionEmailOn(page: Page, origin: string): Promise<string | null> {
  // A page on the host first, so the fetch below is same-origin and carries
  // that host's cookies. `/login` is public and renders while signed out.
  if (!page.url().startsWith(origin)) await page.goto(`${origin}/login`);
  return page.evaluate(async () => {
    const response = await fetch("/api/auth/session", { credentials: "include" });
    // Signed out, this route answers a bare `null`, not an empty object.
    const body = (await response.json()) as { user?: { email?: string } } | null;
    return body?.user?.email ?? null;
  });
}

test.describe("three identities, one browser", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("candidate, recruiter and admin sessions coexist and survive each other", async ({
    context,
    page,
  }) => {
    const candidate = originFor("arjun"); //     http://localhost:3100
    const recruiter = originFor("recruiter"); // http://recruiter.localhost:3100
    const admin = originFor("admin"); //         http://admin.localhost:3100

    // Three hosts, three jars, one browser. This is the moment that used to be
    // impossible: the third sign-in would have evicted the first.
    await signInOnHost(page, "arjun", candidate);
    await signInOnHost(page, "recruiter", recruiter);
    await signInOnHost(page, "admin", admin);

    // Each host kept its own session token, and they are three different
    // tokens rather than one shared between them.
    const sessionCookies = (await context.cookies()).filter(
      (c) => c.name === "authjs.session-token.v2",
    );
    expect(
      sessionCookies.map((c) => c.domain).sort(),
      "expected one host-only session cookie per test host — if this collapses " +
        "to a single entry, the cookie has grown a `domain` attribute and the " +
        "isolation this environment depends on is gone",
    ).toEqual(["admin.localhost", "localhost", "recruiter.localhost"]);
    expect(new Set(sessionCookies.map((c) => c.value)).size).toBe(3);

    // And all three are live at once, each as its own product.
    expect(await sessionEmailOn(page, candidate)).toBe("arjun@abtalks.dev");
    await page.goto(`${candidate}/dashboard`);
    await expect(page.getByText("YOUR CHALLENGES")).toBeVisible();

    expect(await sessionEmailOn(page, recruiter)).toBe("recruiter@abtalks.dev");
    await page.goto(`${recruiter}/hire`);
    await expect(page.getByText("WHO ARE YOU LOOKING FOR?")).toBeVisible();

    expect(await sessionEmailOn(page, admin)).toBe("admin@abtalks.dev");
    await page.goto(`${admin}/admin`);
    await expect(page.getByText("PLATFORM ADMIN")).toBeVisible();

    // Going back is the part that used to fail: returning to the candidate
    // after signing in twice elsewhere is exactly the journey that produced
    // "the cookies are getting messed up".
    await page.goto(`${candidate}/dashboard`);
    await expect(page.getByText("YOUR CHALLENGES")).toBeVisible();
    await page.reload();
    await expect(page.getByText("YOUR CHALLENGES")).toBeVisible();
    expect(await sessionEmailOn(page, candidate)).toBe("arjun@abtalks.dev");

    // …and the recruiter is still signed in after all of that.
    expect(await sessionEmailOn(page, recruiter)).toBe("recruiter@abtalks.dev");
  });

  test("the candidate host does not carry the recruiter session", async ({
    page,
  }) => {
    // The other half of the claim: the jars are separate, so a session in one
    // is genuinely absent from the other rather than merely unused.
    await signInOnHost(page, "recruiter", originFor("recruiter"));

    expect(
      await sessionEmailOn(page, originFor("arjun")),
      "localhost saw the session signed in at recruiter.localhost",
    ).toBeNull();

    // And the recruiter's own host still has it.
    expect(await sessionEmailOn(page, originFor("recruiter"))).toBe(
      "recruiter@abtalks.dev",
    );
  });
});
