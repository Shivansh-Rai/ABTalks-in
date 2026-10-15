/**
 * Plan 193/194 — both preview links in one browser.
 *
 * This drives the **real** `middleware.ts` with real `NextRequest`s, the same
 * way `src/lib/observability/request-id.test.ts` does, because the behaviour
 * under test only exists there. It cannot be checked by hand end to end:
 * middleware does not load under `next dev` in this project, and under
 * `next start` the session cookie is `__Secure-` prefixed, which plain
 * http://localhost will not carry. (Replaying a dev-minted token under the
 * production cookie name does not work either — next-auth derives the JWT
 * salt FROM the cookie name.)
 *
 * So the session is minted here with the same `encode` the runtime uses, and
 * the assertions are about what middleware decides.
 *
 * Run: npm run test:preview-sides
 */
import { NextRequest } from "next/server";
import { encode } from "next-auth/jwt";
import middleware from "../../../middleware";

const COOKIE = {
  session: "authjs.session-token.v2",
  candidate: "klymb_preview_candidate",
  recruiter: "klymb_preview_recruiter",
} as const;

const TOKEN = {
  candidate: "test-candidate-token",
  recruiter: "test-recruiter-token",
} as const;

const EMAIL = {
  candidate: "preview-candidate@klymb.ai",
  recruiter: "preview-recruiter@klymb.ai",
  real: "someone@example.com",
} as const;

let passed = 0;
let failed = 0;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function suite(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}\n      ${(e as Error).message}`);
  }
}

/** A session cookie the real middleware will decode, for `email`. */
async function sessionCookie(email: string, role = "STUDENT") {
  const value = await encode({
    token: {
      id: "preview-test-user",
      email,
      role,
      isAdmin: false,
      authTime: Math.floor(Date.now() / 1000),
    },
    secret: process.env.AUTH_SECRET!,
    // next-auth derives the encryption salt from the cookie name; it has to be
    // the same name the runtime reads, or the token will not decode.
    salt: COOKIE.session,
  });
  return `${COOKIE.session}=${value}`;
}

type Middleware = (req: NextRequest) => Promise<Response> | Response;

async function run(path: string, cookies: string[]) {
  return (middleware as unknown as Middleware)(
    new NextRequest(new URL(`https://app.klymb.ai${path}`), {
      headers: { cookie: cookies.join("; ") },
    }),
  );
}

const previewCookies = [
  `${COOKIE.candidate}=${TOKEN.candidate}`,
  `${COOKIE.recruiter}=${TOKEN.recruiter}`,
];

function location(res: Response): string {
  return res.headers.get("location") ?? "";
}

async function main() {
  console.log("\npreview links: both sides in one browser");

  await suite(
    "signed in as the candidate preview, /hire switches to the recruiter side",
    async () => {
      const res = await run("/hire", [
        ...previewCookies,
        await sessionCookie(EMAIL.candidate),
      ]);
      assert(
        location(res).includes("/preview/enter"),
        `expected a switch through /preview/enter, got ${location(res) || res.status}`,
      );
      assert(
        location(res).includes("side=recruiter"),
        `expected side=recruiter, got ${location(res)}`,
      );
    },
  );

  await suite(
    "signed in as the recruiter preview, /dashboard switches to the candidate side",
    async () => {
      const res = await run("/dashboard", [
        ...previewCookies,
        await sessionCookie(EMAIL.recruiter, "RECRUITER"),
      ]);
      assert(
        location(res).includes("side=candidate"),
        `expected side=candidate, got ${location(res) || res.status}`,
      );
    },
  );

  await suite(
    "a browser holding only ONE link is not bounced to a side it cannot open",
    async () => {
      const res = await run("/hire", [
        `${COOKIE.candidate}=${TOKEN.candidate}`,
        await sessionCookie(EMAIL.candidate),
      ]);
      assert(
        !location(res).includes("/preview/enter"),
        `no recruiter link is held, so there is nothing to switch to; got ${location(res)}`,
      );
    },
  );

  await suite("a real account's session is never switched", async () => {
    const res = await run("/hire", [
      ...previewCookies,
      await sessionCookie(EMAIL.real),
    ]);
    assert(
      !location(res).includes("/preview/enter"),
      `only the two preview accounts are ever swapped; got ${location(res)}`,
    );
  });

  await suite("the launch page itself is never a switch", async () => {
    const res = await run("/", [
      ...previewCookies,
      await sessionCookie(EMAIL.recruiter, "RECRUITER"),
    ]);
    assert(
      !location(res).includes("/preview/enter"),
      `/ is public and must render, not redirect; got ${location(res)}`,
    );
  });

  await suite("/preview/enter does not bounce off itself", async () => {
    const res = await run("/preview/enter?side=recruiter", [
      ...previewCookies,
      await sessionCookie(EMAIL.candidate),
    ]);
    assert(
      !location(res).includes("/preview/enter"),
      `the entry point must be allowed to run; got ${location(res)}`,
    );
  });

  console.log("\nHR invite: what the gate opens");

  await suite("an invited HR reaches /hr/signin with no cookies at all", async () => {
    const res = await run("/hr/signin?t=whatever", []);
    assert(
      !location(res).endsWith("app.klymb.ai/"),
      `the link must reach the route that spends the token; got ${location(res)}`,
    );
  });

  await suite("a recruiter SESSION opens the desk without a preview cookie", async () => {
    const res = await run("/hire", [
      await sessionCookie("hr@acme-test.com", "RECRUITER"),
    ]);
    assert(
      !location(res).endsWith("app.klymb.ai/"),
      `an invited HR must reach /hire; got ${location(res)}`,
    );
  });

  await suite("that rule does NOT open the candidate side", async () => {
    const res = await run("/dashboard", [
      await sessionCookie("hr@acme-test.com", "RECRUITER"),
    ]);
    assert(
      location(res).endsWith("app.klymb.ai/"),
      `a recruiter has no business on /dashboard; got ${location(res) || res.status}`,
    );
  });

  await suite("a candidate session still cannot open the desk", async () => {
    const res = await run("/hire", [await sessionCookie("someone@example.com")]);
    assert(
      location(res).endsWith("app.klymb.ai/"),
      `only a RECRUITER session passes; got ${location(res) || res.status}`,
    );
  });

  await suite("a stranger with no session is still shut out of the desk", async () => {
    const res = await run("/hire", []);
    assert(
      location(res).endsWith("app.klymb.ai/"),
      `the gate must still hold for the public; got ${location(res) || res.status}`,
    );
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

void main();
