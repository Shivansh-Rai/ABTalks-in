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
  assert(
    !/match\.linkedinUrl/.test(src),
    "inspector must not read linkedinUrl off the match card",
  );
});

suite("linkedinUrl is released only through loadProtectedContact after CONTACT_SHARED", () => {
  const access = read("src/features/hire/contact-access.ts");
  const refuse = access.indexOf("if (!allowed) return null");
  const select = access.indexOf("linkedinUrl: true");
  assert(refuse >= 0, "loadProtectedContact must refuse before selecting");
  assert(
    select > refuse,
    "linkedinUrl is selected only after hasContactAccess grants",
  );
  const match = stripComments(read("src/features/hire/to-public-match.ts"));
  assert(
    !match.includes("linkedinUrl"),
    "toPublicMatch must never carry linkedinUrl",
  );
  const inspector = stripComments(
    read("src/components/hire/candidate-inspector.tsx"),
  );
  assert(
    inspector.includes("Unlock contact to open LinkedIn"),
    "locked LinkedIn badge must open the unlock dialog",
  );
  assert(
    inspector.includes("Open LinkedIn profile"),
    "unlocked LinkedIn badge must be an accessible link",
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

suite("full name unblurs only after CONTACT_SHARED", () => {
  const card = stripComments(read("src/components/hire/desk-match-card.tsx"));
  assert(
    /function MaskedName\([\s\S]*revealed\?: boolean/.test(card) ||
      card.includes("revealed?: boolean"),
    "MaskedName must take a revealed flag",
  );
  assert(
    card.includes('match.engagementStatus === "CONTACT_SHARED"'),
    "desk card must show the full name after CONTACT_SHARED",
  );
  const inspector = stripComments(
    read("src/components/hire/candidate-inspector.tsx"),
  );
  assert(
    inspector.includes('match.engagementStatus === "CONTACT_SHARED"'),
    "inspector must unmask when this recruiter already holds CONTACT_SHARED",
  );
  assert(
    inspector.includes("contact !== null"),
    "inspector must unmask as soon as revealContactAction returns contact",
  );
  assert(
    inspector.includes("<MaskedName"),
    "locked inspector names still go through MaskedName",
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

suite("inspector Experience is fetched jobs, not the track", () => {
  const src = read("src/components/hire/candidate-inspector.tsx");
  assert(
    src.includes("loadInspectorWorkHistoryAction"),
    "inspector loads work history on open",
  );
  assert(
    src.includes('label: "ABTalks Evidence"'),
    "ABTalks Evidence tab exists",
  );
  const expStart = src.indexOf('data-section="experience"');
  const evStart = src.indexOf('data-section="evidence"');
  assert(expStart >= 0 && evStart > expStart, "Experience then Evidence");
  const exp = src.slice(expStart, evStart);
  assert(
    exp.includes("No work experience recorded"),
    "empty Experience copy",
  );
  assert(
    !exp.includes("track ??"),
    "Experience must not use the track as employer",
  );
  const ev = src.slice(evStart);
  assert(
    ev.includes("loadInspectorTrackEvidenceAction") ||
      src.includes("loadInspectorTrackEvidenceAction"),
    "inspector loads completions on open",
  );
  assert(
    ev.includes("No completed tracks or placements recorded."),
    "empty Evidence copy",
  );
  assert(!ev.includes("Days shipped"), "Evidence is not live days shipped");
  assert(
    ev.includes("Verified work on ABTalks"),
    "completions sit in ABTalks Evidence",
  );
});

suite("work-history action gates on the pool and never selects contact", () => {
  const src = read("src/app/actions/hire-view-actions.ts");
  assert(
    src.includes("resolveInspectorCandidate"),
    "re-tests the ref for inspector addressability",
  );
  assert(
    src.includes("listPublicWorkHistory"),
    "reads the public work-history function",
  );
  const stripped = stripComments(src);
  assert(
    !stripped.includes("email: true") && !stripped.includes("phone: true"),
    "action must not select email/phone",
  );
  assert(
    !stripped.includes("getCandidateDetail"),
    "must not call the full profile read",
  );
});

suite("track-evidence action gates on the pool and uses wins-only accomplishments", () => {
  const src = read("src/app/actions/hire-view-actions.ts");
  const start = src.indexOf("export async function loadInspectorTrackEvidenceAction");
  assert(start >= 0, "loadInspectorTrackEvidenceAction must exist");
  const fn = src.slice(start);
  assert(
    fn.includes("resolveInspectorCandidate"),
    "re-tests the ref for inspector addressability",
  );
  assert(
    fn.includes('getVerifiedAccomplishments(eligible.userId, "wins-only")'),
    "reads wins-only accomplishments",
  );
  assert(!fn.includes("getCandidateDetail"), "must not call the full profile read");
  const stripped = stripComments(fn);
  assert(
    !stripped.includes("email: true") && !stripped.includes("phone: true"),
    "action must not select email/phone",
  );
});

suite("inspector addressability skips challenge minDays", () => {
  const src = read("src/features/hire/pool-policy.ts");
  const start = src.indexOf("export async function resolveInspectorCandidate");
  assert(start >= 0, "resolveInspectorCandidate must exist");
  const fn = src.slice(start);
  assert(
    fn.includes("resolveChallengeRefs"),
    "challenge refs still re-checked for enrollment + searchable",
  );
  assert(
    !fn.includes("minDays") && !fn.includes("hireChallengePool"),
    "inspector gate must not apply HIRE_CHALLENGE_POOL minDays",
  );
  const eligible = src.slice(
    src.indexOf("export async function resolveEligibleCandidates"),
    start,
  );
  assert(
    eligible.includes("flag.minDays"),
    "search/engagement eligibility still uses minDays",
  );
});

suite("listPublicWorkHistory select has no contact fields", () => {
  const src = read("src/repositories/candidate-detail.ts");
  const start = src.indexOf("export async function listPublicWorkHistory");
  const end = src.indexOf("Declared GitHub / LeetCode / CodeChef links");
  assert(start >= 0 && end > start, "listPublicWorkHistory must exist");
  const fn = stripComments(src.slice(start, end));
  assert(!fn.includes("phone: true"), "must not select phone");
  assert(!fn.includes("email: true"), "must not select email");
  assert(!fn.includes("linkedinUrl"), "must not select linkedinUrl");
  assert(!fn.includes("resumeUrl"), "must not select resumeUrl");
  assert(!fn.includes("githubUsername"), "must not select githubUsername");
  assert(fn.includes("companyName: true"), "must select companyName");
  assert(fn.includes("hasNoWorkExperience: true"), "must select the skip flag");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
