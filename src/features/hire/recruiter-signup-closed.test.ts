/**
 * "There must be no way for a recruiter to make themselves an account, except
 * the temporary invite."
 *
 * That is true today because `ENABLE_RECRUITER_AUTH=false` closes the OTP
 * dialog, /talent/login, /talent/register, /recruiter-onboarding and the
 * server actions behind them — but "true today" is a thing somebody checked
 * once. This makes it a property the repository keeps: every place that can
 * bring a RecruiterProfile into existence has to be accounted for here, and a
 * new one fails this test until it is classified.
 *
 * Run: npm run test:recruiter-signup-closed
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");

/** Creators that are allowed to exist, and why each is not self-serve. */
const ACCOUNTED_FOR: Record<string, string> = {
  "src/app/actions/recruiter-auth-actions.ts":
    "the OTP registration path — refuses unless isRecruiterAuthEnabled()",
  "src/features/talent-pool/recruiter-registration.ts":
    "registerRecruiter(), reached only through registerRecruiterAction, which refuses unless isRecruiterAuthEnabled()",
  "src/features/admin/create-recruiter.ts":
    "admin creates the account by hand — requireAdmin() in admin-recruiter-actions",
  "src/features/preview/preview-accounts.ts":
    "the team's preview recruiter — needs the preview token AND the launch gate on",
  "src/features/hire/hr-invite.ts":
    "the HR trial invite — requireAdmin() in admin-hr-invite-actions",
};

/**
 * The registration entry points, which must ALSO honour ENABLE_RECRUITER_SIGNUP.
 *
 * ENABLE_RECRUITER_AUTH alone is not enough any more: it governs sign-in too,
 * so turning it off to stop strangers registering would also lock out the
 * recruiters an admin created and emailed a password to.
 */
const MUST_HONOUR_SIGNUP_FLAG = [
  "src/app/actions/talent-actions.ts",
  "src/app/actions/recruiter-auth-actions.ts",
  "src/app/talent/register/page.tsx",
  "src/app/recruiter-onboarding/page.tsx",
  "src/app/recruiter-onboarding/signup/page.tsx",
];

/** Files whose caller must check the recruiter-auth flag. */
const MUST_BE_FLAG_GATED = [
  "src/app/actions/recruiter-auth-actions.ts",
  "src/features/talent-pool/recruiter-registration.ts",
];

/** Files whose caller must require an admin. */
const MUST_BE_ADMIN_GATED: Record<string, string> = {
  "src/features/admin/create-recruiter.ts": "src/app/actions/admin-recruiter-actions.ts",
  "src/features/hire/hr-invite.ts": "src/app/actions/admin-hr-invite-actions.ts",
};

let passed = 0;
let failed = 0;

function assert(cond: unknown, msg: string): asserts cond {
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

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

function rel(path: string): string {
  return path.slice(process.cwd().length + 1);
}

function main() {
  console.log("\nrecruiter self-signup is closed");

  const creators = walk(SRC)
    .filter((f) => {
      const src = readFileSync(f, "utf8");
      return /recruiterProfile\.(create|upsert)\s*\(/.test(src);
    })
    .map(rel)
    .sort();

  suite("every RecruiterProfile creator is accounted for", () => {
    const unknown = creators.filter((f) => !(f in ACCOUNTED_FOR));
    assert(
      unknown.length === 0,
      "a new way to create a recruiter account appeared. Classify it here and " +
        `say why it is not self-serve:\n        ${unknown.join("\n        ")}`,
    );
  });

  suite("none of the accounted-for creators has disappeared", () => {
    const missing = Object.keys(ACCOUNTED_FOR).filter((f) => !creators.includes(f));
    assert(
      missing.length === 0,
      `these no longer create a RecruiterProfile; drop them from the list:\n        ${missing.join("\n        ")}`,
    );
  });

  for (const file of MUST_BE_FLAG_GATED) {
    suite(`${file.split("/").pop()} stays behind ENABLE_RECRUITER_AUTH`, () => {
      const own = readFileSync(join(process.cwd(), file), "utf8");
      const gatedHere = own.includes("isRecruiterAuthEnabled");
      // registerRecruiter is gated by its only caller rather than itself.
      const gatedByCaller =
        file.endsWith("recruiter-registration.ts") &&
        readFileSync(join(process.cwd(), "src/app/actions/talent-actions.ts"), "utf8")
          .includes("isRecruiterAuthEnabled");
      assert(
        gatedHere || gatedByCaller,
        `${file} can create a recruiter without the flag being checked — ` +
          "setting ENABLE_RECRUITER_AUTH=false would no longer close signups",
      );
    });
  }

  for (const [file, caller] of Object.entries(MUST_BE_ADMIN_GATED)) {
    suite(`${file.split("/").pop()} is reachable only by an admin`, () => {
      const src = readFileSync(join(process.cwd(), caller), "utf8");
      assert(
        src.includes("requireAdmin"),
        `${caller} no longer requires an admin, so ${file} became self-serve`,
      );
    });
  }

  for (const file of MUST_HONOUR_SIGNUP_FLAG) {
    suite(`${file.split("/").pop()} closes when ENABLE_RECRUITER_SIGNUP=false`, () => {
      const src = readFileSync(join(process.cwd(), file), "utf8");
      assert(
        src.includes("isRecruiterSignupEnabled"),
        `${file} would still take a registration with signups closed`,
      );
    });
  }

  suite("sign-in does NOT depend on the signup flag", () => {
    // The whole point of splitting them: an admin-created recruiter must be
    // able to sign in with the password they were emailed while registration
    // is shut.
    const src = readFileSync(join(process.cwd(), "src/lib/email-auth.ts"), "utf8");
    assert(
      !src.includes("isRecruiterSignupEnabled"),
      "authorizePassword now checks the signup flag, so closing registration " +
        "would stop admin-created recruiters signing in — the exact thing the " +
        "split exists to prevent",
    );
  });

  suite("the invite link does not depend on the recruiter-auth flag", () => {
    const auth = readFileSync(join(process.cwd(), "src/auth.ts"), "utf8");
    const start = auth.indexOf('id: "hr-invite"');
    assert(start > 0, "the hr-invite provider is gone");
    // To the start of the NEXT provider, not a fixed number of characters —
    // a fixed window spilled into the recruiter-otp provider below, which does
    // check the flag, and reported a problem that was not there.
    const next = auth.indexOf("Credentials({", start);
    const block = auth.slice(start, next > start ? next : undefined);
    assert(
      !block.includes("isRecruiterAuthEnabled"),
      "the invite provider now checks ENABLE_RECRUITER_AUTH — turning signups " +
        "off would also kill every HR's invite link, which is the opposite of the point",
    );
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

main();
