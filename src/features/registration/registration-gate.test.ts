/**
 * Post-auth registration gate + the slimmed /register payload.
 *
 * Two things are checked here. The pure helpers — `safeNextPath`,
 * `registerHref`, `postRegisterDestination` — because `next` comes straight out
 * of a query string and an unvalidated one is an open redirect. And source
 * assertions on the invariants that are cheap to break and invisible in a unit
 * test: that no candidate destination waves a profile-less user past the gate,
 * that the résumé requirement is checked against the stored row rather than a
 * client flag, and that the fields the résumé now fills in have actually left
 * the form.
 *
 * Run: npm run test:registration-gate
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  REGISTRATION_DEFAULT_NEXT,
  postRegisterDestination,
  registerHref,
  safeNextPath,
} from "@/features/registration/registration-gate";

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

function source(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

console.log("\nPost-auth registration gate\n");

/* ─── safeNextPath: the open-redirect boundary ───────────────────────────── */

suite("safeNextPath keeps ordinary same-origin paths", () => {
  assert(safeNextPath("/dashboard") === "/dashboard", "plain path");
  assert(
    safeNextPath("/hackathon/dashboard") === "/hackathon/dashboard",
    "nested path",
  );
  assert(
    safeNextPath("/register?domain=CLAUDE") === "/register?domain=CLAUDE",
    "query string survives",
  );
});

suite("safeNextPath refuses anything that leaves the origin", () => {
  const fallback = REGISTRATION_DEFAULT_NEXT;
  for (const hostile of [
    "//evil.com",
    "//evil.com/path",
    "/\\evil.com", // protocol-relative to some browsers
    "https://evil.com",
    "http://evil.com",
    "javascript:alert(1)",
    "evil.com",
    "",
    "   ",
  ]) {
    assert(
      safeNextPath(hostile) === fallback,
      `rejected: ${JSON.stringify(hostile)}`,
    );
  }
  assert(safeNextPath(undefined) === fallback, "undefined");
  assert(safeNextPath(null) === fallback, "null");
});

suite("safeNextPath honours an explicit fallback", () => {
  assert(
    safeNextPath("//evil.com", "/hackathon/dashboard") === "/hackathon/dashboard",
    "caller's fallback wins",
  );
});

/* ─── registerHref ───────────────────────────────────────────────────────── */

suite("registerHref omits next when it is the default destination", () => {
  assert(registerHref() === "/register", "no args");
  assert(registerHref("/dashboard") === "/register", "default destination");
});

suite("registerHref carries a non-default destination", () => {
  assert(
    registerHref("/hackathon/dashboard") ===
      "/register?next=%2Fhackathon%2Fdashboard",
    `encoded next, got ${registerHref("/hackathon/dashboard")}`,
  );
});

suite("registerHref refuses to carry an off-origin next", () => {
  assert(registerHref("//evil.com") === "/register", "hostile next dropped");
});

suite("registerHref carries only a well-formed referral code", () => {
  assert(
    registerHref("/dashboard", "abc123") === "/register?ref=ABC123",
    "normalised to upper case",
  );
  assert(
    registerHref("/dashboard", "ab-c1 23") === "/register?ref=ABC123",
    "punctuation stripped",
  );
  assert(registerHref("/dashboard", "abc") === "/register", "too short dropped");
  assert(registerHref("/dashboard", "") === "/register", "empty dropped");
  assert(
    registerHref("/hackathon/dashboard", "ABC123") ===
      "/register?next=%2Fhackathon%2Fdashboard&ref=ABC123",
    "both together",
  );
});

/* ─── postRegisterDestination ────────────────────────────────────────────── */

suite("hackathon arrivals all land on the hackathon dashboard", () => {
  for (const from of [
    "/hackathon",
    "/hackathon/register",
    "/hackathon/dashboard",
    "/hackathon/submission",
  ]) {
    assert(
      postRegisterDestination(from) === "/hackathon/dashboard",
      `${from} → /hackathon/dashboard`,
    );
  }
});

suite("everything else passes through unchanged", () => {
  assert(postRegisterDestination("/dashboard") === "/dashboard", "hub");
  assert(postRegisterDestination("/claude") === "/claude", "track");
  assert(
    postRegisterDestination("/register?domain=CLAUDE") ===
      "/register?domain=CLAUDE",
    "claude funnel intent survives",
  );
  // Not the hackathon: a prefix match must not capture a sibling route.
  assert(
    postRegisterDestination("/hackathons-archive") === "/hackathons-archive",
    "sibling route untouched",
  );
});

/* ─── The gate is actually wired in ──────────────────────────────────────── */

suite("login no longer waves /dashboard or /hackathon past the check", () => {
  const src = source("src/app/login/page.tsx");
  const bypass = src.slice(
    src.indexOf("redirectTo.startsWith(\"/program\")"),
    src.indexOf("const profile = await studentProfile.findUnique"),
  );
  assert(bypass.length > 0, "bypass block located");
  assert(!bypass.includes("/hackathon"), "hackathon no longer bypasses");
  assert(!bypass.includes("\"/dashboard\""), "dashboard no longer bypasses");
  // Recruiters have no StudentProfile and never will — they must still bypass,
  // or the candidate check would loop them forever.
  assert(bypass.includes("/hire"), "recruiters still bypass");
  assert(bypass.includes("/talent"), "talent still bypasses");
});

suite("candidate destinations call the gate", () => {
  for (const rel of [
    "src/app/dashboard/page.tsx",
    "src/app/hackathon/dashboard/page.tsx",
    "src/app/hackathon/register/page.tsx",
  ]) {
    const src = source(rel);
    assert(src.includes("registrationRedirect"), `${rel} calls the gate`);
  }
});

suite("the gate is never imported by edge middleware", () => {
  // middleware.ts may import only next-auth and next/server — a `@/lib/*` or
  // `@/features/*` import blows the 1 MB Edge bundle limit. Matched on real
  // import specifiers: the file names `@/lib/*` in a comment explaining the rule.
  const specifiers = [
    ...source("middleware.ts").matchAll(/from\s+["']([^"']+)["']/g),
  ].map((m) => m[1]!);
  assert(specifiers.length > 0, "import specifiers located");
  for (const spec of specifiers) {
    assert(
      !spec.startsWith("@/lib/") && !spec.startsWith("@/features/"),
      `middleware must not import ${spec}`,
    );
  }
});

/* ─── The slimmed payload ────────────────────────────────────────────────── */

suite("register payload drops what the résumé fills in", () => {
  const src = source("src/lib/validations/register.ts");
  const payload = src.slice(src.indexOf("const studentFields"));
  for (const gone of [
    "linkedinUrl",
    "githubUsername",
    "skills",
    "graduationYear",
  ]) {
    assert(!payload.includes(gone), `${gone} is no longer collected`);
  }
});

suite("register payload carries the basic-info block", () => {
  const src = source("src/lib/validations/register.ts");
  for (const field of [
    "headline",
    "locationCity",
    "locationRegion",
    "countryCode",
  ]) {
    assert(src.includes(field), `${field} is collected`);
  }
  // The dialing code and the ISO-2 country are two different facts and were the
  // same key until the basic-info fields moved onto this form.
  assert(src.includes("phoneCountryCode"), "dialing code has its own key");
});

suite("the form no longer renders the removed fields", () => {
  const src = source("src/app/register/registration-form.tsx");
  assert(!src.includes("linkedinUrl"), "no LinkedIn input");
  assert(!src.includes("githubUsername"), "no GitHub input");
  assert(!src.includes("addSkillsFromDraft"), "no skills chips");
  assert(!src.includes("GRADUATION_YEARS"), "no graduation year select");
});

/* ─── Résumé: required, and checked server-side ──────────────────────────── */

suite("the résumé requirement reads the stored row, not a client flag", () => {
  const src = source("src/app/actions/registration-actions.ts");
  assert(src.includes("getResumeView"), "reads the stored résumé");
  const gate = src.indexOf("getResumeView");
  const register = src.indexOf("completeRegistration(");
  assert(gate > 0 && register > gate, "checked before the profile is created");
  assert(
    !src.includes("formData.get(\"resumeUploaded\")"),
    "no client-supplied résumé flag",
  );
});

suite("the deferred merge runs after the profile exists", () => {
  // Positions are compared over the body only — both names also appear in the
  // import block at the top of the file, in the other order.
  const file = source("src/app/actions/registration-actions.ts");
  const action = file.slice(file.indexOf("export async function"));
  const register = action.indexOf("await completeRegistration(");
  const merge = action.indexOf("await applyStoredResumeToProfile(");
  assert(register > 0, "registration call located");
  assert(merge > register, "merge follows registration");

  // Registration is already committed by then; enrichment must not undo it.
  const tail = action.slice(register);
  assert(tail.includes("try {"), "merge is wrapped");
  assert(tail.includes("logger.error"), "a failed merge is logged, not thrown");

  const service = source("src/features/resume/service.ts");
  assert(
    service.includes("export async function applyStoredResumeToProfile"),
    "the service exposes the deferred merge",
  );
  const fn = service.slice(
    service.indexOf("export async function applyStoredResumeToProfile"),
  );
  // It re-uses the stored document; a second parse would cost a model call for
  // bytes that have not changed.
  assert(!fn.includes("parseResumeDocument"), "no re-parse");
  assert(fn.includes("getResumeRow"), "reads the stored document");
});

suite("registration writes the CandidateProfile-only basic-info fields", () => {
  const src = source("src/features/registration/complete-registration.ts");
  const identity = src.indexOf("dualWriteCandidateIdentity(tx");
  const basic = src.indexOf("dualWriteCandidateBasicInfo(tx");
  assert(identity > 0, "identity dual-write present");
  assert(
    basic > identity,
    "basic info runs after the row it writes to is created",
  );

  const dw = source("src/repositories/dual-write.ts");
  const fn = dw.slice(dw.indexOf("export async function dualWriteCandidateBasicInfo"));
  // `update` would throw when the identity savepoint rolled back and left no
  // CandidateProfile row; zero rows written is the right outcome there.
  assert(fn.includes("updateMany"), "tolerates a missing row");
  assert(fn.includes("runDualWrite"), "goes through the dual-write guard");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
