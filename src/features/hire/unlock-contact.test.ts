/**
 * T-229 + T-230 — contact unlock.
 *
 * Pure checks for the arithmetic and the key; source assertions for the rules a
 * unit test structurally cannot see — the order the refusals are decided in,
 * that no price ever arrives from a browser, that access is still derived from
 * one place. The guarantees that are the database's — one charge under
 * concurrency, no ledger row on refusal — are proved against real Postgres by
 * `npm run db:check:credit-ledger -- --prove`, because asserting a row lock
 * against a mock proves only that the mock agrees with whoever wrote it.
 *
 * Run: npm run test:unlock
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { formatCreditsMinor } from "@/lib/credits-format";
import { unlockIdempotencyKey } from "@/repositories/credits";

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

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const UNLOCK = "src/features/hire/unlock-contact.ts";
/** The money half. Split from the session half so it can be proved against a DB. */
const TXN = "src/features/hire/unlock-transaction.ts";
const ACTION = "src/app/actions/hire-unlock-actions.ts";
const DIALOG = "src/components/hire/unlock-contact-dialog.tsx";
const VALIDATION = "src/lib/validations/hire-unlock.ts";

console.log("\nT-229 / T-230 contact unlock\n");

/* ─── the numbers the dialog must show ───────────────────────────────────── */

console.log("Cost shown first");

suite("cost, balance and remaining are consistent", () => {
  // What previewUnlock computes: remaining = balance - cost, floored at zero.
  const cases = [
    { balance: 20_000, cost: 1_000, remaining: 19_000, affordable: true },
    { balance: 1_000, cost: 1_000, remaining: 0, affordable: true },
    { balance: 500, cost: 1_000, remaining: 0, affordable: false },
    { balance: 0, cost: 1_000, remaining: 0, affordable: false },
  ];
  for (const c of cases) {
    const remaining = Math.max(c.balance - c.cost, 0);
    assert(
      remaining === c.remaining,
      `balance ${c.balance} − cost ${c.cost} should leave ${c.remaining}, got ${remaining}`,
    );
    assert(
      c.balance >= c.cost === c.affordable,
      `affordability wrong for ${JSON.stringify(c)}`,
    );
  }
});

suite("$200 balance and a $10 unlock read as money", () => {
  assert(formatCreditsMinor(20_000) === "$200.00", "20000 → $200.00");
  assert(formatCreditsMinor(1_000) === "$10.00", "1000 → $10.00");
  assert(formatCreditsMinor(19_000) === "$190.00", "19000 → $190.00");
});

suite("a repeat unlock costs nothing", () => {
  // previewUnlock zeroes the cost when access already exists, so the dialog
  // cannot offer to charge for something the recruiter already has.
  const src = source(UNLOCK) + source(TXN);
  assert(
    src.includes("const effectiveCost = alreadyUnlocked ? 0 : costMinor"),
    "the preview must zero the cost when already unlocked",
  );
  assert(
    /charged: false,\s*costMinor: 0/.test(src),
    "the repeat-unlock result must report charged:false and cost 0",
  );
});

suite("the dialog states all three figures before confirming", () => {
  const src = source(DIALOG);
  // The three figures T-229 requires before confirmation: what it costs, what
  // they have, and what they will be left with.
  for (const label of ["This unlock costs", "Your balance", "After unlock"]) {
    assert(src.includes(label), `the dialog must state "${label}"`);
  }
});

/* ─── the order of the questions ─────────────────────────────────────────── */

console.log("\nRefusal order and honesty");

suite("candidate availability is decided before affordability", () => {
  const src = source(UNLOCK) + source(TXN);
  const availability = src.indexOf("CANDIDATE_UNAVAILABLE");
  const credits = src.indexOf("INSUFFICIENT_CREDITS");
  assert(availability > -1 && credits > -1, "both refusals must exist");
  assert(
    availability < credits,
    "a withdrawn candidate must never be reported as a money problem (T-148 §5)",
  );
});

suite("the already-unlocked check runs before any billing", () => {
  const src = source(TXN);
  const body = src.slice(src.indexOf("export async function unlockResolvedContact"));
  const already = body.indexOf("findSharedEngagement");
  const cost = body.indexOf("getIntConfig(CONTACT_UNLOCK_COST_KEY)");
  const charge = body.indexOf("applyCreditChange");
  assert(already > -1 && cost > -1 && charge > -1, "expected all three steps");
  assert(already < cost, "free case must be answered before the price is read");
  assert(already < charge, "free case must be answered before any charge");
});

suite("a refusal carries no candidate PII", () => {
  const src = source(TXN);
  const failure = src.slice(
    src.indexOf("export type UnlockFailure"),
    src.indexOf("export type UnlockResult"),
  );
  for (const leak of ["email", "phone", "name", "candidateUserId"]) {
    assert(
      !new RegExp(`\\b${leak}\\b`).test(failure.replace(/\/\*[\s\S]*?\*\//g, "")),
      `UnlockFailure must not carry ${leak}`,
    );
  }
});

/* ─── the client decides nothing ─────────────────────────────────────────── */

console.log("\nThe server decides");

suite("the unlock payload is a candidate handle and nothing else", () => {
  const src = source(VALIDATION);
  assert(
    src.includes("candidateRef: candidateRefSchema"),
    "the schema must take candidateRef",
  );
  for (const field of ["cost", "amount", "price", "balance", "organizationId", "userId"]) {
    assert(
      !new RegExp(`${field}\\s*:`).test(src.replace(/\/\*[\s\S]*?\*\//g, "")),
      `the unlock payload must not accept ${field}`,
    );
  }
});

suite("the action never reads a cost from its input", () => {
  const src = source(ACTION);
  assert(
    !/parsed\.data\.(cost|amount|price)/.test(src),
    "the action must not take a price from the payload",
  );
  assert(
    src.includes("unlockContactSchema.safeParse"),
    "the action must validate at the boundary",
  );
});

suite("the price is read from configuration, never hard-coded", () => {
  const src = source(TXN);
  assert(
    src.includes("getIntConfig(CONTACT_UNLOCK_COST_KEY)"),
    "the cost must come from PlatformConfig",
  );
  assert(
    !/1_?000/.test(src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/20_?000/g, "")),
    "the unlock price must not appear as a literal",
  );
});

suite("workspace and candidate are resolved server-side, never from the client", () => {
  const src = source(UNLOCK);
  assert(
    src.includes("requireRecruiterWorkspace()"),
    "the workspace must come from the session",
  );
  assert(
    src.includes("resolveEligibleCandidates([candidateRef])"),
    "the candidate must be re-checked against the pool",
  );
});

suite("owned-application fallback is a second door, not a pool widening", () => {
  const unlock = source(UNLOCK);
  assert(
    unlock.includes("resolveAddressableCandidate"),
    "unlock resolve must go through the shared addressability helper",
  );
  assert(
    unlock.includes("resolveViaOwnedApplication"),
    "an applicant on an owned job must be addressable when the pool misses",
  );
  assert(
    unlock.includes('parsed.source !== "PROFILE"'),
    "the fallback admits PROFILE refs only",
  );
  assert(
    unlock.includes("searchableUserWhere()"),
    "deleted or withdrawn users stay refused",
  );
  assert(
    unlock.includes("recruiterId: recruiterUserId"),
    "the fallback must bind the job to the session recruiter",
  );
  const outreach = source("src/app/actions/outreach-actions.ts");
  assert(
    outreach.includes("resolveAddressableCandidate"),
    "outreach send must use the same helper as unlock",
  );
  const pool = source("src/features/hire/pool-policy.ts");
  assert(
    !/jobApplication/i.test(pool),
    "the search pool must not grow a job-application path",
  );
});

/* ─── safety: T-230 ──────────────────────────────────────────────────────── */

console.log("\nUnlock safety");

suite("the idempotency key is deterministic and workspace-scoped", () => {
  assert(
    unlockIdempotencyKey("org_a", "cand_1") === "unlock:org_a:cand_1",
    `unexpected key: ${unlockIdempotencyKey("org_a", "cand_1")}`,
  );
  assert(
    unlockIdempotencyKey("org_a", "cand_1") === unlockIdempotencyKey("org_a", "cand_1"),
    "the key must be stable",
  );
  assert(
    unlockIdempotencyKey("org_a", "cand_1") !== unlockIdempotencyKey("org_b", "cand_1"),
    "two workspaces must not share an unlock key",
  );
  assert(
    unlockIdempotencyKey("org_a", "cand_1") !== unlockIdempotencyKey("org_a", "cand_2"),
    "two candidates must not share an unlock key",
  );
});

suite("debit, ledger and CONTACT_SHARED commit in one transaction", () => {
  const src = source(TXN);
  const tx = src.slice(src.indexOf("prisma.$transaction(async (tx)"));
  assert(tx.indexOf("applyCreditChange(tx,") > -1, "the debit must be in the transaction");
  assert(
    tx.indexOf('status: "CONTACT_SHARED"') > -1,
    "the access row must be written in the same transaction",
  );
  assert(
    (src.match(/prisma\.\$transaction\(/g) ?? []).length === 1,
    "there must be exactly one transaction on the unlock path",
  );
});

suite("the transaction carries the 20s allowance, not Prisma's 5s default", () => {
  const src = source(TXN);
  assert(
    src.includes("maxWait: 20_000") && src.includes("timeout: 20_000"),
    "credit movements must not run on the 5s default (T-228)",
  );
  assert(src.includes("TX_OPTIONS"), "the options must be passed to the transaction");
});

suite("the concurrent-loser catch recognises an unmapped 23505", () => {
  const src = source(TXN);
  assert(
    src.includes("isUniqueViolation(error)"),
    "reuse the shared check — the narrow P2002-only one is the bug T-228's proofs caught",
  );
  assert(
    !/error\.code === "P2002"/.test(src),
    "do not re-implement the narrow check here",
  );
});

suite("nothing relies on the UI to prevent a second charge", () => {
  const src = source(DIALOG);
  assert(
    src.includes("is a courtesy, not a safeguard"),
    "the dialog must say its disabled state is not the safeguard",
  );
  assert(
    src.includes("ledger's unique key, not by this component"),
    "the dialog must name where the real guarantee lives",
  );
});

/* ─── neighbours are untouched ───────────────────────────────────────────── */

console.log("\nNeighbours");

suite("access is still derived from CONTACT_SHARED in one place", () => {
  const src = source("src/features/hire/contact-access.ts");
  const body = src.slice(src.indexOf("export async function hasContactAccess"));
  const fn = body.slice(0, body.indexOf("\n}") + 2).replace(/\s+/g, " ");
  // The query, not the whole function: T-259 wrapped it in logging, which
  // broke the old whole-text match without changing who gets access.
  assert(
    fn.includes(
      'prisma.talentEngagementRequest.findFirst({ where: { recruiterUserId, candidateUserId, status: "CONTACT_SHARED", }, select: { id: true }, });',
    ),
    "hasContactAccess must still derive access from CONTACT_SHARED alone (T-148 §6)",
  );
});

suite("no second source of access truth was introduced", () => {
  // Code only. `contact-access.ts` names the forbidden field in the comment
  // that explains why it does not exist, and this file carries the pattern
  // itself — neither is a second source of truth.
  const offenders = walk("src")
    .filter((f) => !f.endsWith("unlock-contact.test.ts"))
    .filter((f) =>
      /contactVisible|contactUnlocked\s*:|hasUnlocked\s*:/.test(
        stripComments(readFileSync(f, "utf8")),
      ),
    );
  assert(
    offenders.length === 0,
    `access must stay derived, not stored: ${offenders.join(", ")}`,
  );
});

suite("entitlements.ts still fails closed — plans are T-231", () => {
  const src = source("src/features/hire/entitlements.ts");
  assert(
    src.includes('reason: "NOT_IMPLEMENTED"') && src.includes("allowed: false"),
    "checkPlanLimit must still refuse",
  );
});

suite("the admin introduction path is unchanged", () => {
  const src = source("src/app/actions/hire-request-actions.ts");
  assert(
    src.includes("placeEngagementRequestAction"),
    "the intro action must still exist",
  );
  assert(
    !/applyCreditChange|unlockContact/.test(src),
    "the intro path must not have grown a credit dependency",
  );
});

suite("the ledger is still written in exactly one place", () => {
  const writers = walk("src").filter((f) =>
    /\.creditTransaction\.(create|createMany|update|updateMany|upsert|delete|deleteMany)/.test(
      readFileSync(f, "utf8"),
    ),
  );
  const allowed = new Set([
    join(process.cwd(), "src/repositories/credits.ts"),
    join(process.cwd(), "src/app/actions/recruiter-setup-actions.ts"),
  ]);
  const extra = writers.filter((f) => !allowed.has(f));
  assert(extra.length === 0, `unexpected ledger writers: ${extra.join(", ")}`);
});

/* ─── helpers ────────────────────────────────────────────────────────────── */

function walk(rel: string): string[] {
  const root = join(process.cwd(), rel);
  const out: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (!dir) continue;
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) stack.push(full);
      else if (full.endsWith(".ts") || full.endsWith(".tsx")) out.push(full);
    }
  }
  return out;
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
