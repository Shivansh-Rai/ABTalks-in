/**
 * Demo 1 contact-payload contract.
 *   npm run test:demo1-security
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

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

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

console.log("\nDemo 1 contact payloads");

suite("hasContactAccess is the only unlock reader", () => {
  const src = read("src/features/hire/contact-access.ts");
  assert(src.includes("status: \"CONTACT_SHARED\""), "access is derived from CONTACT_SHARED");
  assert(src.includes("export async function loadProtectedContact"), "loadProtectedContact must exist");
  assert(
    src.includes("if (!allowed) return null"),
    "loadProtectedContact must refuse before selecting email/phone",
  );
});

suite("toPublicMatch never carries email or phone", () => {
  const code = stripComments(read("src/features/hire/to-public-match.ts"));
  assert(!/\bemail\s*:/.test(code), "toPublicMatch must not assign email");
  assert(!/\bphone\s*:/.test(code), "toPublicMatch must not assign phone");
});

suite("requests page does not select candidate.email on the list query", () => {
  const src = read("src/app/hire/requests/page.tsx");
  assert(src.includes("loadProtectedContacts"), "requests page must use loadProtectedContacts");
  assert(
    !src.includes("candidate: {") && !src.includes("email: true"),
    "list query must not select candidate.email",
  );
});

suite("guest search maps through toPublicMatch", () => {
  const src = read("src/app/actions/hire-guest-actions.ts");
  assert(src.includes("toPublicMatch"), "guest matches must go through toPublicMatch");
});

suite("pool released names use contactAccessFor on userId", () => {
  const src = read("src/features/talent-pool/pool.ts");
  assert(src.includes("contactAccessFor"), "shortlist must use contactAccessFor");
  assert(
    src.includes("released.has(i.member.userId)"),
    "released names are keyed on candidate userId",
  );
});

suite("inspector fetches contact only after unlock, never as a page prop", () => {
  const src = stripComments(read("src/components/hire/candidate-inspector.tsx"));
  assert(
    src.includes("revealContactAction"),
    "inspector must load contact through revealContactAction",
  );
  assert(
    !/email\s*[:=]\s*match/.test(src) && !/match\.email/.test(src),
    "inspector must not read email off the match card",
  );
});

suite("unlock reveal selects email/phone only through loadProtectedContact", () => {
  const src = read("src/features/hire/unlock-contact.ts");
  assert(
    src.includes("loadProtectedContact("),
    "revealUnlockedContact must call loadProtectedContact",
  );
  const stripped = stripComments(src);
  assert(
    !stripped.includes("email: true") && !stripped.includes("phone: true"),
    "unlock-contact.ts must not select email/phone itself",
  );
});

suite("inspector resume uses credit unlock, not the billing placeholder", () => {
  const src = read("src/components/hire/candidate-inspector.tsx");
  assert(
    !src.includes('setGate("resume")'),
    "resume must not open SubscriptionGate — billing is not enabled",
  );
  assert(
    src.includes("UnlockContactDialog"),
    "locked resume must go through the $10 credit unlock",
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
