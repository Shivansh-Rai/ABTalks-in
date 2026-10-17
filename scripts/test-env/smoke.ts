/**
 * Plan 195 — the route × role sweep.
 *
 *   npm run test:env:dev                 (in one terminal)
 *   npm run test:env:smoke               (in another)
 *   npm run test:env:smoke -- --update   accept the current matrix as the baseline
 *   npm run test:env:smoke -- --only=/hire,/admin    sweep a slice
 *
 * MEMORY. Every route this touches is compiled on demand by the dev server,
 * and Turbopack holds the results: measured here, a full sweep walked the dev
 * server up to ~13 GB and got it OOM-killed partway through. So the sweep
 * treats a server that stops answering as a first-class outcome and says what
 * to do about it, and `--only` exists to walk the app in slices on a machine
 * that cannot hold all of it at once. Restarting the dev server between slices
 * is the cheap fix; nothing is lost, because each slice updates only its own
 * rows of the baseline.
 *
 * What this answers: across every important route and every audience, does
 * anything 500, and has anything *changed* since the matrix was last accepted?
 *
 * WHY IT COMPARES A BASELINE RATHER THAN ASSERTING AUTHORIZATION. The obvious
 * design — "a candidate must not be served /hire/pipeline" — cannot be written
 * at this level, because in this codebase being turned away is usually not an
 * HTTP status. Measured against the running product:
 *
 *   /dashboard                 anonymous → 200, and the visible text is "Loading"
 *   /hire/pipeline             anonymous → 200, with "Please sign in to continue."
 *   /program/ai-cohort/…       anonymous → 200, a loading shell
 *   /challenge/today           candidate → 307 → /challenge/8
 *   /register                  candidate → 307 → /dashboard
 *
 * The gated surfaces render a shell and decide after hydration, so an HTTP
 * sweep that treated 200 as "served the product" would report a dozen security
 * leaks that are not there — which is exactly what the first version of this
 * file did. Authorization is therefore asserted in `e2e/`, where a browser can
 * see what actually ends up on the screen; what this sweep is good at is
 * breadth: one process, seven audiences, every route, a few seconds, and it
 * notices the day a route starts throwing or quietly redirects somewhere new.
 *
 * So: it records an outcome per route × role, compares the whole matrix to
 * `smoke-baseline.json`, and fails on any difference and on any 5xx. A change
 * is not automatically a bug — it is something to look at and then accept with
 * `--update`, which is the point.
 *
 * WHY IT DOES NOT USE THE PER-HOST COOKIE JARS. The `*.localhost` hosts exist
 * to stop a *browser* evicting its own sessions. A script attaches whichever
 * `Cookie` header it likes per request, so it talks to 127.0.0.1 throughout.
 * That also keeps the sweep working where the resolver does not map
 * `*.localhost` to loopback (glibc does not by default; macOS does), which
 * would otherwise fail for a reason that has nothing to do with the product.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { enterTestEnv } from "./guard";
import { TEST_PORT, findIdentity } from "../../src/lib/test-env";

enterTestEnv("Route × role smoke sweep");

const BASE = `http://127.0.0.1:${TEST_PORT}`;
const BASELINE = resolve(process.cwd(), "scripts/test-env/smoke-baseline.json");

/**
 * The audiences. `anon` holds no cookie; the rest sign in as the identity named
 * here, so the matrix reads as roles rather than as people.
 */
const ROLES = [
  { role: "anon", key: null },
  { role: "candidate", key: "arjun" },
  { role: "fresh", key: "fresh" },
  { role: "recruiter", key: "recruiter" },
  { role: "admin", key: "admin" },
  { role: "program", key: "program" },
  { role: "hackathon", key: "hackathon" },
] as const;

type Role = (typeof ROLES)[number]["role"];

/**
 * Static routes only. A sweep that had to invent ids for `[day]`, `[id]` and
 * `[token]` would be asserting against made-up data and would fail for that
 * reason rather than a real one; the dynamic routes belong to the browser
 * suite, which can reach them from a page that knows the real ids.
 */
const ROUTES: string[] = [
  // Public
  "/",
  "/login",
  "/register",
  "/terms",
  "/privacy",
  "/contact",
  "/explore",
  "/challenges",
  "/workshop",
  "/ai-cohort-register",
  "/ai-cohort-india",
  // Candidate / challenge
  "/dashboard",
  "/challenge/today",
  "/profile",
  "/achievements",
  "/settings/security",
  "/practice",
  "/marketplace",
  // Recruiter / hire desk
  "/hire",
  "/hire/pipeline",
  "/hire/credits",
  "/hire/settings",
  "/hire/jobs",
  "/hire/requests",
  "/hire/messages",
  "/hire/matches",
  "/hire/evidence",
  // Admin
  "/admin",
  "/admin/students",
  "/admin/recruiters",
  "/admin/credits",
  "/admin/platform-admins",
  "/admin/settings",
  "/admin/program",
  "/admin/hackathon",
  "/admin/search",
  // AI Cohort program
  "/program/ai-cohort",
  "/program/ai-cohort/dashboard",
  "/program/ai-cohort/curriculum",
  "/program/ai-cohort/leaderboard",
  // Hackathon
  "/hackathon",
  "/hackathon/dashboard",
  "/hackathon/submission",
  // Talent portal
  "/talent/login",
  "/talent/shortlist",
  // The console itself — deliberately not behind a session, since it is how you
  // obtain one, so every audience should reach it here.
  "/dev/test-console",
];

// ---------------------------------------------------------------------------
// Sign-in over HTTP
// ---------------------------------------------------------------------------

/** The subset of a Set-Cookie jar this needs: name → value, no attributes. */
type Jar = Map<string, string>;

function absorb(jar: Jar, response: Response): Jar {
  for (const line of response.headers.getSetCookie()) {
    const [pair] = line.split(";");
    const index = pair.indexOf("=");
    if (index > 0) jar.set(pair.slice(0, index).trim(), pair.slice(index + 1));
  }
  return jar;
}

function header(jar: Jar): string {
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

/**
 * Sign in through the plan-154 `password` provider exactly as the login form
 * does: fetch a CSRF token, post it back with the credentials. Nothing here
 * mints a session by hand — a sweep that forged its own JWT would pass while
 * the real door was broken.
 *
 * The admin identity only gets through because `.env.test` sets
 * `ENABLE_DEV_AUTH=true`: `isGoogleOnlyAccount` otherwise refuses a password
 * for anyone holding an admin grant, and Google is not configured here.
 */
async function signIn(key: string): Promise<Jar> {
  const identity = findIdentity(key);
  if (!identity) throw new Error(`Unknown identity "${key}".`);

  const jar: Jar = new Map();

  const csrfResponse = await fetch(`${BASE}/api/auth/csrf`);
  if (!csrfResponse.ok) {
    throw new Error(`GET /api/auth/csrf answered ${csrfResponse.status}.`);
  }
  absorb(jar, csrfResponse);
  const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };

  const response = await fetch(`${BASE}/api/auth/callback/password`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: header(jar),
    },
    body: new URLSearchParams({
      csrfToken,
      email: identity.email,
      password: identity.password,
      audience: identity.audience,
      callbackUrl: `${BASE}${identity.landing}`,
    }),
  });
  absorb(jar, response);

  if (!jar.has("authjs.session-token.v2")) {
    // The provider answers with a redirect carrying `?error=`, so the
    // destination is where the reason is.
    const where = response.headers.get("location") ?? "(no redirect)";
    throw new Error(
      `${identity.email} did not get a session. Provider redirected to ${where}`,
    );
  }
  return jar;
}

// ---------------------------------------------------------------------------
// Classifying what came back
// ---------------------------------------------------------------------------

/**
 * Words that appear on every page — the header, the footer links, the loading
 * placeholder. Removed before judging whether a 200 actually carried content,
 * so a bare shell is not mistaken for a rendered page.
 */
const CHROME = new Set(
  (
    "klymb ai loading sign in terms privacy cookies contact mission all rights " +
    "reserved skip to content menu close toggle theme light dark system"
  ).split(" "),
);

function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * `page` — a rendered page with content of its own.
 * `wall` — 200, but the only thing on it is an invitation to sign in.
 * `shell` — 200 carrying nothing but the loading placeholder, i.e. this surface
 *           decides what to show after hydration, so HTTP cannot see the answer.
 *
 * A heuristic, and labelled as one: it exists to make the matrix readable by a
 * person. The regression signal is the baseline comparison, which does not
 * depend on these labels being philosophically right — only on them being
 * stable, which they are, because they are computed from the same markup every
 * run.
 */
function classify(html: string): "page" | "wall" | "shell" {
  const text = visibleText(html);
  const substantive = text
    .toLowerCase()
    .split(/[^a-z0-9’']+/)
    .filter((word) => word.length > 1 && !CHROME.has(word));

  if (/please sign in to continue/i.test(text) && substantive.length < 12) {
    return "wall";
  }
  if (substantive.length < 8) return "shell";
  return "page";
}

/**
 * Numbers out of redirect targets, so a baseline does not go stale simply
 * because time passed: `/challenge/today` sends a candidate to whichever day
 * they are on, which is day 8 today and day 11 three days from now, with no
 * change to the product.
 */
function normalisePath(path: string): string {
  return path.replace(/\/\d+(?=\/|$)/g, "/:n");
}

type Outcome = string;

/** The dev server stopped answering — thrown so the sweep can explain itself. */
class ServerGone extends Error {
  constructor(readonly path: string) {
    super(`The dev server stopped answering at ${path}.`);
  }
}

async function visit(path: string, jar: Jar | null): Promise<Outcome> {
  const response = await fetch(`${BASE}${path}`, {
    redirect: "manual",
    headers: jar ? { cookie: header(jar) } : {},
  }).catch(() => {
    throw new ServerGone(path);
  });

  const location = response.headers.get("location");
  if (location) {
    let to = location;
    try {
      to = new URL(location, BASE).pathname;
    } catch {
      /* a non-URL Location, kept verbatim */
    }
    // The body is drained below for every branch; a redirect carries none.
    await response.arrayBuffer().catch(() => undefined);
    return `${response.status}→${normalisePath(to)}`;
  }

  const body = await response.text().catch(() => "");
  if (response.status >= 500) return `${response.status}`;
  if (response.status !== 200) return `${response.status}`;
  return `200 ${classify(body)}`;
}

// ---------------------------------------------------------------------------
// The sweep
// ---------------------------------------------------------------------------

type Matrix = Record<string, Record<string, Outcome>>;

function readBaseline(): Matrix | null {
  try {
    return JSON.parse(readFileSync(BASELINE, "utf8")) as Matrix;
  } catch {
    return null;
  }
}

function paint(outcome: Outcome, changed: boolean): string {
  const short = outcome.startsWith("200 ")
    ? { "200 page": "page", "200 wall": "wall", "200 shell": "shell" }[outcome] ??
      outcome
    : outcome.replace(/→.*/, "→");
  const cell = short.padEnd(7);
  if (/^5\d\d/.test(outcome)) return `\u001b[31m${cell}\u001b[0m`;
  if (changed) return `\u001b[33m${cell}\u001b[0m`;
  return cell;
}

async function main() {
  const update = process.argv.includes("--update");

  // `--only=/hire,/admin` — the routes whose path starts with any of these.
  const onlyArg = process.argv.find((a) => a.startsWith("--only="));
  const prefixes = onlyArg
    ? onlyArg
        .slice("--only=".length)
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
    : null;
  // Matched by path segment, not by raw string: a plain `startsWith` would make
  // `--only=/` mean "everything", which is not a slice, and `--only=/admin`
  // would also drag in a future `/administrators`.
  const routes =
    prefixes === null
      ? ROUTES
      : ROUTES.filter((path) =>
          prefixes.some((p) => path === p || path.startsWith(`${p}/`)),
        );
  if (routes.length === 0) {
    throw new Error(`--only matched no routes: ${prefixes?.join(", ")}`);
  }

  // The sign-ins below are real password checks, and `authorizePassword` rate
  // limits by IP (100 a window) and by account (10). Successive sweeps would
  // eventually trip the IP bucket and start failing for a reason that is not a
  // product fault, so the recorded events go first. Same thing the
  // `clear-rate-limits` fixture does, inlined because a sweep that needed a
  // fixture run first is a sweep people forget to set up.
  const { prisma } = await import("../../src/lib/db");

  try {
    const probe = await fetch(`${BASE}/api/auth/csrf`).catch(() => null);
    if (!probe?.ok) {
      console.error(
        [
          `  No server on ${BASE}${probe ? ` (it answered ${probe.status})` : ""}.`,
          "",
          "  Start it first, in another terminal:",
          "",
          "      npm run test:env:dev",
          "",
        ].join("\n"),
      );
      process.exit(1);
    }

    const { count } = await prisma.rateLimitEvent.deleteMany({});
    if (count > 0) console.log(`   cleared ${count} rate-limit event(s)`);

    // Signed in up front, once each, so the sweep is pure GETs afterwards and
    // no route's result depends on how many sign-ins preceded it.
    const jars = new Map<Role, Jar | null>();
    for (const { role, key } of ROLES) {
      jars.set(role, key === null ? null : await signIn(key));
    }
    console.log(`   signed in: ${ROLES.map((r) => r.role).join(", ")}\n`);

    const baseline = readBaseline();
    const matrix: Matrix = {};
    const width = Math.max(...routes.map((r) => r.length)) + 2;

    console.log(
      " ".repeat(width) + ROLES.map((r) => r.role.slice(0, 7).padEnd(8)).join(""),
    );

    const errors: string[] = [];
    const changes: string[] = [];

    for (const path of routes) {
      const row: Record<string, Outcome> = {};
      const cells: string[] = [];

      for (const { role } of ROLES) {
        const outcome = await visit(path, jars.get(role) ?? null);
        row[role] = outcome;

        const was = baseline?.[path]?.[role];
        const changed = baseline !== null && was !== undefined && was !== outcome;
        if (/^5\d\d/.test(outcome)) {
          errors.push(`${path} as ${role} — HTTP ${outcome}`);
        }
        if (changed) {
          changes.push(`${path} as ${role} — was "${was}", now "${outcome}"`);
        }
        if (baseline !== null && was === undefined) {
          changes.push(`${path} as ${role} — new, "${outcome}"`);
        }
        cells.push(paint(outcome, changed) + " ");
      }

      matrix[path] = row;
      console.log(path.padEnd(width) + cells.join(""));
    }

    console.log(
      `\n   page = rendered   wall = "please sign in"   shell = loading only` +
        `\n   NNN→ = redirect   red = server error   yellow = changed` +
        `\n   ${routes.length} routes × ${ROLES.length} roles = ` +
        `${routes.length * ROLES.length} requests` +
        `${prefixes ? `  (slice: ${prefixes.join(", ")})` : ""}\n`,
    );

    if (update) {
      // Merged, not replaced: a `--only` slice must not drop the rows it did
      // not sweep, or walking the app in slices would leave a baseline holding
      // only the last slice.
      const merged: Matrix = { ...(baseline ?? {}), ...matrix };
      writeFileSync(BASELINE, `${JSON.stringify(merged, null, 2)}\n`);
      console.log(
        `   baseline written — ${Object.keys(matrix).length} route(s) updated, ` +
          `${Object.keys(merged).length} in total\n`,
      );
      process.exit(errors.length === 0 ? 0 : 1);
    }

    if (baseline === null) {
      console.log(
        "   No baseline yet. Check the matrix above reads right, then:\n" +
          "       npm run test:env:smoke -- --update\n",
      );
      process.exit(errors.length === 0 ? 0 : 1);
    }

    // Only meaningful for a whole-app sweep: during a slice, every route
    // outside the slice is legitimately absent from this run's matrix.
    if (prefixes === null) {
      for (const path of Object.keys(baseline).filter((p) => !(p in matrix))) {
        changes.push(`${path} — in the baseline but no longer swept`);
      }
    }

    if (errors.length > 0) {
      console.log(`   ${errors.length} server error(s):`);
      for (const line of errors) console.log(`     ! ${line}`);
      console.log("");
    }
    if (changes.length > 0) {
      console.log(`   ${changes.length} change(s) from the baseline:`);
      for (const line of changes) console.log(`     ~ ${line}`);
      console.log(
        "\n   If these are intended:  npm run test:env:smoke -- --update\n",
      );
    }
    if (errors.length === 0 && changes.length === 0) {
      console.log("   No server errors, and the matrix matches the baseline.\n");
    }

    process.exit(errors.length + changes.length === 0 ? 0 : 1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  if (error instanceof ServerGone) {
    console.error(
      [
        "",
        `✗ ${error.message}`,
        "",
        "  Nothing is wrong with that route in particular. The dev server",
        "  compiles each route as the sweep reaches it and Turbopack keeps the",
        "  results, so a sweep of the whole app walks it up to several GB — on",
        "  this codebase it has been OOM-killed around the 26th route.",
        "",
        "  Restart it and sweep in slices:",
        "",
        "      npm run test:env:dev",
        "      npm run test:env:smoke -- --only=/,/dashboard,/challenge,/profile",
        "      npm run test:env:smoke -- --only=/hire",
        "      npm run test:env:smoke -- --only=/admin",
        "      npm run test:env:smoke -- --only=/program,/hackathon,/talent,/dev",
        "",
        "  Each slice compares and updates only its own rows of the baseline.",
        "",
      ].join("\n"),
    );
    process.exit(1);
  }
  console.error(`\n✗ ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
