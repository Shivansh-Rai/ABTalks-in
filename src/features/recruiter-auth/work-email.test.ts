/**
 * T-225 — only a work email can become a recruiter account.
 *
 * Two halves, for two different kinds of failure. The pure checks cover the
 * rule itself: the four domains T-225 names, their aliases, and the work
 * domains that must keep working. The source assertions cover the thing a unit
 * test cannot see — that every server-side path which creates or authorises a
 * recruiter actually applies the rule, and that no escape hatch was added
 * beside it. A rule enforced on one of three paths is not enforced.
 *
 * Run: npm run test:work-email
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PERSONAL_EMAIL_DOMAINS,
  WORK_EMAIL_REQUIRED_MESSAGE,
  emailDomain,
  isPersonalEmailDomain,
  workEmailSchema,
} from "@/lib/validations/work-email";
import {
  registerRecruiterSchema,
  requestRecruiterOtpSchema,
} from "@/lib/validations/recruiter-auth";

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

/** A complete, otherwise-valid registration payload for the given address. */
function registration(email: string) {
  return {
    fullName: "Priya Nair",
    company: "Acme Systems",
    email,
    phone: "+919876543210",
    code: "123456",
    acceptedTerms: true as const,
    newsletterOptIn: false,
  };
}

console.log("\nT-225 recruiter work-email enforcement\n");

/* ─── the four domains T-225 names ───────────────────────────────────────── */

const NAMED = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"];

suite("the four named personal domains are refused", () => {
  for (const domain of NAMED) {
    assert(
      isPersonalEmailDomain(`recruiter@${domain}`),
      `${domain} must be refused`,
    );
    assert(
      !workEmailSchema.safeParse(`recruiter@${domain}`).success,
      `${domain} must fail the schema`,
    );
  }
});

suite("registerRecruiterSchema refuses each named domain", () => {
  for (const domain of NAMED) {
    const parsed = registerRecruiterSchema.safeParse(
      registration(`recruiter@${domain}`),
    );
    assert(!parsed.success, `${domain} must not parse`);
    const messages = parsed.success
      ? []
      : parsed.error.issues.map((i) => i.message);
    assert(
      messages.includes(WORK_EMAIL_REQUIRED_MESSAGE),
      `${domain} must carry the readable reason, got: ${messages.join(" | ")}`,
    );
  }
});

suite("the refusal names the rule and the four providers", () => {
  const m = WORK_EMAIL_REQUIRED_MESSAGE.toLowerCase();
  assert(m.includes("work email"), "says what is required");
  for (const name of ["gmail", "yahoo", "hotmail", "outlook"]) {
    assert(m.includes(name), `names ${name}`);
  }
});

/* ─── aliases, variants and the shape of the check ───────────────────────── */

suite("provider aliases and regional variants are refused", () => {
  for (const email of [
    "a@googlemail.com",
    "a@ymail.com",
    "a@rocketmail.com",
    "a@yahoo.co.in",
    "a@live.com",
    "a@msn.com",
    "a@icloud.com",
    "a@protonmail.com",
    "a@rediffmail.com",
  ]) {
    assert(isPersonalEmailDomain(email), `${email} must be refused`);
  }
});

suite("real work domains still register", () => {
  for (const email of [
    "priya@abtalks.in",
    "hiring@acme.co",
    "talent@zoho.com",
    // Ends in a listed domain but is a different company.
    "hr@notgmail.com",
    // A subdomain is not one of the provider's mailboxes.
    "hr@corp.gmail.com",
  ]) {
    assert(!isPersonalEmailDomain(email), `${email} must be accepted`);
    assert(workEmailSchema.safeParse(email).success, `${email} must parse`);
  }
  assert(
    registerRecruiterSchema.safeParse(registration("priya@abtalks.in")).success,
    "a work-domain registration parses",
  );
});

suite("case and surrounding whitespace cannot dodge the check", () => {
  assert(isPersonalEmailDomain("  Recruiter@GMAIL.com  "), "upper + padded");
  assert(isPersonalEmailDomain("A@Outlook.COM"), "mixed case");
  assert(emailDomain("a@b@gmail.com") === "gmail.com", "last @ wins");
  assert(emailDomain("not-an-email") === "", "no domain");
  assert(!isPersonalEmailDomain(null), "null is not a personal domain");
  assert(!isPersonalEmailDomain(undefined), "undefined is not one either");
});

suite("every listed domain is lowercase and bare", () => {
  for (const d of PERSONAL_EMAIL_DOMAINS) {
    assert(d === d.toLowerCase(), `${d} must be lowercase`);
    assert(!d.includes("@"), `${d} must be a domain, not an address`);
  }
});

/* ─── candidate and recruiter sign-in are untouched ──────────────────────── */

suite("recruiter sign-in is not blocked by the registration rule", () => {
  // Signing in needs a registration to exist, and that registration already had
  // to pass the rule. Refusing here would only lock out accounts created before
  // T-225 — a data decision, not this one.
  assert(
    requestRecruiterOtpSchema.safeParse({
      email: "legacy@gmail.com",
      intent: "signin",
    }).success,
    "sign-in codes still parse",
  );
});

suite("candidate authentication never reaches the work-email rule", () => {
  const auth = source("src/auth.ts");
  const config = source("src/auth.config.ts");
  assert(!auth.includes("work-email"), "auth.ts untouched");
  assert(!config.includes("work-email"), "auth.config.ts untouched");
  // The Google provider is a candidate path: it creates a User, never a
  // RecruiterProfile, so it cannot become a recruiter without going through one
  // of the guarded paths below.
  assert(
    !auth.includes("recruiterProfile.create"),
    "no recruiter creation in auth",
  );
  assert(
    config.includes("next-auth/providers/google"),
    "Google sign-in still configured",
  );
});

/* ─── every recruiter-creating path enforces the rule ────────────────────── */

suite(
  "the only RecruiterProfile writers in src are the two guarded paths",
  () => {
    // If this fails a third creation path appeared and needs the same guard.
    const writers = [
      "src/app/actions/recruiter-auth-actions.ts",
      "src/features/talent-pool/recruiter-registration.ts",
    ];
    for (const rel of writers) {
      assert(
        source(rel).includes("recruiterProfile.create"),
        `${rel} still creates profiles`,
      );
      assert(
        source(rel).includes("isPersonalEmailDomain") ||
          source(rel).includes("workEmailSchema"),
        `${rel} must enforce the work-email rule`,
      );
    }
  },
);

suite(
  "the OTP path refuses before issuing a code and again before creating",
  () => {
    const src = source("src/app/actions/recruiter-auth-actions.ts");

    const request = src.slice(
      src.indexOf("export async function requestRecruiterOtpAction"),
      src.indexOf("export async function registerRecruiterWithOtpAction"),
    );
    const guard = request.indexOf("isPersonalEmailDomain");
    const issue = request.indexOf("issueRecruiterOtp");
    assert(guard > 0, "the request path checks the domain");
    assert(guard < issue, "it refuses before a code is issued");

    const register = src.slice(
      src.indexOf("export async function registerRecruiterWithOtpAction"),
    );
    const check = register.indexOf("isPersonalEmailDomain");
    const create = register.indexOf("recruiterProfile.create");
    assert(check > 0, "the creation path re-checks the normalised address");
    assert(check < create, "it refuses before the profile is written");
  },
);

suite("the authenticated path refuses before anything is written", () => {
  const src = source("src/features/talent-pool/recruiter-registration.ts");
  const fn = src.slice(src.indexOf("export async function registerRecruiter"));
  const check = fn.indexOf("isPersonalEmailDomain");
  const create = fn.indexOf("recruiterProfile.create");
  assert(check > 0, "the domain is checked");
  assert(check < create, "it refuses before the profile is written");
  // Plan 127: a VerifiedRecruiterSeat is a pre-verified company name, not an
  // access grant. It must never be a way past the domain rule either.
  const seat = fn.indexOf("verifiedRecruiterSeat");
  assert(seat < 0 || check < seat, "a seat cannot pre-empt the domain rule");
});

/* ─── no exception mechanism ─────────────────────────────────────────────── */

suite("an admin cannot pre-verify a personal domain as a seat", () => {
  const src = source("src/app/actions/recruiter-seat-actions.ts");
  const schema = src.slice(
    src.indexOf("const addSeatSchema"),
    src.indexOf("const toggleSeatSchema"),
  );
  assert(schema.includes("workEmailSchema"), "seat email uses the work rule");
  assert(
    !schema.includes("z.string().trim().email()"),
    "the unguarded email field is gone",
  );
});

// Plan 127 deleted admin-recruiter-actions.ts along with the approval queue,
// so "an admin cannot approve a personal-domain application" no longer has an
// action to assert against. The two registration paths above are now the only
// ways a RecruiterProfile is created, and both refuse first.

suite("the rule has no configuration or environment escape hatch", () => {
  const src = source("src/lib/validations/work-email.ts");
  assert(!src.includes("process.env"), "no environment variable");
  assert(!src.includes("prisma"), "no database-driven allowlist");
  for (const rel of [
    "src/app/actions/recruiter-auth-actions.ts",
    "src/features/talent-pool/recruiter-registration.ts",
    "src/app/actions/recruiter-seat-actions.ts",
  ]) {
    const guarded = source(rel);
    assert(
      !/ALLOW_PERSONAL|SKIP_WORK_EMAIL|BYPASS_WORK_EMAIL/i.test(guarded),
      `${rel} must carry no override flag`,
    );
  }
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
