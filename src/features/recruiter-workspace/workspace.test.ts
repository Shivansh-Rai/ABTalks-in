/**
 * T-226 — one independent workspace per recruiter.
 *
 * The rule is a product contract, not a preference: every recruiter works
 * alone, and two recruiters on the same email domain must not be able to reach
 * each other's projects, credits, jobs, pipeline, assessments or outreach.
 *
 * The pure checks cover the slug, which is what actually separates two
 * recruiters at one company. The source assertions cover what a unit test
 * cannot see — that the workspace is resolved from the session rather than from
 * a caller-supplied id, that setup is ordered ahead of approval, and that the
 * old company-scoped slug has not survived anywhere.
 *
 * Run: npm run test:recruiter-workspace
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { recruiterWorkspaceSlug } from "@/features/hire/provision-recruiter";

let passed = 0;
let failed = 0;

function assert(cond: boolean | undefined, msg: string) {
  if (!cond) throw new Error(msg);
}

function suite(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}\n      ${(e as Error).message}`);
  }
}

const NEWLINE = String.fromCharCode(10);

function source(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

console.log("\nT-226 independent recruiter workspace\n");

/* ─── the slug is what keeps two colleagues apart ────────────────────────── */

suite("two recruiters at the same company get different workspaces", () => {
  const a = recruiterWorkspaceSlug("cluser000000000000000aaaa", "Acme Systems");
  const b = recruiterWorkspaceSlug("cluser000000000000000bbbb", "Acme Systems");
  assert(a !== b, `same company must not collide: ${a} === ${b}`);
});

suite("the slug is stable for one recruiter", () => {
  const id = "cluser000000000000000aaaa";
  assert(
    recruiterWorkspaceSlug(id, "Acme Systems") ===
      recruiterWorkspaceSlug(id, "Acme Systems"),
    "re-provisioning must resolve the same workspace",
  );
});

suite("the slug stays readable and url-safe", () => {
  const s = recruiterWorkspaceSlug("cluser000000000000000aaaa", "Acme Systems");
  assert(s.startsWith("acme-systems-"), `company half missing: ${s}`);
  assert(/^[a-z0-9-]+$/.test(s), `not url-safe: ${s}`);
  const odd = recruiterWorkspaceSlug("cluser000000000000000aaaa", "  &&&  ");
  assert(odd.startsWith("org-"), `empty company must fall back: ${odd}`);
});

suite("a long company name cannot crowd out the unique half", () => {
  const long = "A".repeat(200);
  const a = recruiterWorkspaceSlug("cluser000000000000000aaaa", long);
  const b = recruiterWorkspaceSlug("cluser000000000000000bbbb", long);
  assert(a !== b, "long names must still separate two recruiters");
});

/* ─── the company-scoped slug must not survive ───────────────────────────── */

suite("provisioning no longer keys the workspace on the company alone", () => {
  const src = source("src/features/hire/provision-recruiter.ts");
  assert(!src.includes("orgSlug("), "the old company-only slug is gone");
  assert(
    src.includes("recruiterWorkspaceSlug(input.userId"),
    "the slug is derived from the recruiter's own id",
  );
  // The old comment stated the opposite rule and would invite a revert.
  assert(
    !src.includes("must land in\n * the same Organization") &&
      !src.includes("must land in the same Organization"),
    "the shared-organization comment is gone",
  );
  assert(src.includes("T-226"), "the new rule names its ticket");
});

/* ─── the workspace is resolved on the server, from the session ──────────── */

suite("requireRecruiterWorkspace takes no id from the caller", () => {
  const src = source("src/features/recruiter-workspace/workspace.ts");
  assert(src.includes('import "server-only"'), "server-only");
  assert(src.includes("await auth()"), "resolves the caller from the session");
  assert(
    /export async function requireRecruiterWorkspace\(\s*\)/.test(src),
    "must take no parameters — a caller-supplied id is the bug class this closes",
  );
  assert(src.includes("ok: false"), "returns the result envelope");
});

suite("an unfinished or unapproved recruiter gets no workspace", () => {
  const src = source("src/features/recruiter-workspace/workspace.ts");
  const setup = src.indexOf("setupCompletedAt");
  const approved = src.indexOf("profile.approved");
  const member = src.indexOf("organizationMember.findFirst");
  assert(setup > 0 && approved > 0, "both gates present");
  assert(
    setup < member && approved < member,
    "both are checked before a workspace is handed out",
  );
});

/* ─── setup is ordered ahead of approval, and resumable ──────────────────── */

suite("setup_incomplete is decided before pending", () => {
  const src = source("src/features/talent-pool/recruiter-registration.ts");
  const fn = src.slice(src.indexOf("export async function getRecruiterState"));
  const incomplete = fn.indexOf('status: "setup_incomplete"');
  const pending = fn.indexOf('status: "pending"');
  assert(incomplete > 0 && pending > 0, "both states exist");
  assert(
    incomplete < pending,
    "an unfinished application must not be reported as under review",
  );
});

suite("every redirecting surface routes an unfinished setup", () => {
  for (const rel of [
    "src/app/talent/login/page.tsx",
    "src/app/talent/register/page.tsx",
    "src/app/talent/pending/page.tsx",
    "src/app/page.tsx",
  ]) {
    const src = source(rel);
    assert(
      src.includes('"setup_incomplete"') && src.includes('"/talent/setup"'),
      `${rel} must send an unfinished setup to /talent/setup`,
    );
  }
});

suite("registration hands off to sign-in, not a terminal panel", () => {
  const src = source("src/components/talent/recruiter-register-form.tsx");
  const finish = src.slice(src.indexOf("function finish()"));
  const stop = finish.indexOf("if (step === ");
  const body = stop > 0 ? finish.slice(0, stop) : finish;

  // Two bugs live here. The original one: registration flipped a local step to
  // "done" and rendered a panel the recruiter could not act on, so none of the
  // server-side guards ever ran. The one that replaced it: navigating to
  // /talent/setup, which registration cannot reach because it creates no
  // session — and doing it with router.push + router.refresh, which left
  // useTransition pending forever and spun the button after the write had
  // already committed.
  assert(
    body.includes("window.location.href = `/talent/login"),
    "registration hands off to sign-in with a full navigation",
  );
  // Calls, not prose — the comment above the fix names both by design.
  assert(
    !body.includes("router.push(") && !body.includes("router.refresh("),
    "no App Router transition — it never settles across a server redirect",
  );
  assert(
    !src.includes('setStep("done")') && !src.includes("we'll reach out soon"),
    "the terminal done panel is gone",
  );
  assert(
    body.includes("encodeURIComponent(email)"),
    "the email is carried over so it is not retyped",
  );
});

suite("the login page seeds the email it was handed", () => {
  const page = source("src/app/talent/login/page.tsx");
  assert(page.includes("email?: string"), "the page accepts ?email=");
  assert(page.includes("initialEmail={params.email"), "and forwards it");
  const form = source("src/components/talent/recruiter-login-form.tsx");
  assert(
    form.includes("useState(initialEmail)"),
    "the form seeds its email box from it",
  );
});

suite("recruiter sign-in lands on setup, not the Scout desk", () => {
  const src = source("src/components/talent/recruiter-login-form.tsx");
  const fn = src.slice(src.indexOf("function submitCode()"));
  const stop = fn.indexOf("if (step === ");
  const body = stop > 0 ? fn.slice(0, stop) : fn;

  // The bug this replaces: sign-in hard-navigated to `redirectTo`, which
  // defaults to /hire. That skipped every recruiter-state guard, so a recruiter
  // with setup still to finish landed on Scout as a guest and was asked to log
  // in again — a loop with no way into the wizard.
  assert(
    body.includes('window.location.href = "/talent/setup"'),
    "a successful sign-in navigates to the setup wizard",
  );
  assert(
    !body.includes("window.location.href = redirectTo"),
    "sign-in no longer jumps straight to the ?from= target",
  );
  assert(
    !/window\.location\.href\s*=\s*["'`]\/hire/.test(src),
    "/hire is not a post-login destination for the recruiter flow",
  );
});

suite("finishing setup does not bounce off its own guard", () => {
  const src = source("src/components/talent/recruiter-setup-form.tsx");
  const fn = src.slice(src.indexOf("function saveCompany()"));
  // Comments out first: the fix explains itself by naming the call it removed,
  // and a plain substring check would match the explanation instead of the code.
  const body = fn
    .slice(0, fn.indexOf("if (step ==="))
    .split(NEWLINE)
    .filter((l) => !l.trim().startsWith("//"))
    .join(NEWLINE);

  // The bug: setStep("COMPLETE") rendered "Workspace ready", then
  // router.refresh() re-rendered /talent/setup, whose pending guard redirected
  // to "Application received" a second later — a success message immediately
  // contradicted.
  assert(
    !body.includes("router.refresh("),
    "no refresh — the page guard would redirect out of the success state",
  );
  assert(
    src.includes("Workspace ready"),
    "the success state still exists",
  );
  // T-226's scope ends at a workspace, not at access. Say both.
  assert(
    src.includes("ABTalks confirms your company"),
    "the panel says approval is still to come",
  );
  assert(
    src.includes('href="/talent/pending"'),
    "and offers the next step instead of jumping there",
  );

  // The refresh was only half of it. In the App Router a revalidate issued from
  // a Server Action re-renders the route the caller is standing on, whichever
  // path it names — so any revalidatePath in the setup actions puts the
  // recruiter back through this page's pending guard.
  const actions = source("src/app/actions/recruiter-setup-actions.ts")
    .split(NEWLINE)
    .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
    .join(NEWLINE);
  assert(
    !actions.includes("revalidatePath("),
    "setup actions revalidate nothing — it would redirect off the success panel",
  );
});

suite("the setup page is reachable by an unapproved recruiter", () => {
  const src = source("src/app/talent/setup/page.tsx");
  // This page is reached BEFORE approval. Gating it on an admin or an approved
  // role is the failure mode that has bitten public/pending surfaces before.
  assert(!src.includes("requireAdmin"), "no admin gate");
  assert(!src.includes("requireRole"), "no role gate");
  assert(src.includes("await auth()"), "session required");
  assert(
    src.includes('redirect("/talent/register")'),
    "a non-recruiter is sent to register",
  );
});

suite("setup steps are saved server-side, one step at a time", () => {
  const src = source("src/app/actions/recruiter-setup-actions.ts");
  assert(src.includes('"use server"'), "server action");
  assert(
    src.includes("discriminatedUnion"),
    "each step validates its own fields",
  );
  assert(
    !/saveRecruiterSetupStepAction[\s\S]{0,400}userId:\s*(parsed|input)/.test(src),
    "the recruiter is never taken from the payload",
  );
  const complete = src.slice(
    src.indexOf("export async function completeRecruiterSetupAction"),
  );
  const tx = complete.indexOf("$transaction");
  const provision = complete.indexOf("provisionRecruiterIdentity");
  assert(tx > 0 && provision > tx, "provisioning happens inside the transaction");
});

/* ─── the migration must not disturb existing recruiters ─────────────────── */

suite("existing recruiters are migrated as already set up", () => {
  const sql = source(
    "prisma/migrations/20260909180000_recruiter_independent_workspace/migration.sql",
  );
  assert(sql.includes("CREATE TYPE \"RecruiterSetupStep\""), "enum created");
  assert(
    /UPDATE "RecruiterProfile"[\s\S]*'COMPLETE'/.test(sql),
    "existing rows are backfilled to COMPLETE, not left in the wizard",
  );
  assert(
    !/DROP\s+(TABLE|COLUMN)/i.test(sql),
    "additive only — nothing dropped",
  );
});

/* ─── T-225 must still hold ──────────────────────────────────────────────── */

suite("work-email enforcement is untouched", () => {
  for (const rel of [
    "src/app/actions/recruiter-auth-actions.ts",
    "src/features/talent-pool/recruiter-registration.ts",
  ]) {
    assert(
      source(rel).includes("isPersonalEmailDomain"),
      `${rel} still enforces T-225`,
    );
  }
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
