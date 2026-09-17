/**
 * T-267 unlock diagnosis. Run with:
 *   npm run test:unlock-diagnosis
 *
 * No network, no database. Three things are pinned here:
 *
 *  1. Every distinguishable reason gets named for what it really is —
 *     suspended account, no workspace, candidate withdrawn, candidate not
 *     reachable, insufficient credits, already unlocked. A generic "unlock
 *     unavailable" is exactly what this ticket exists to remove.
 *  2. The order is the live path's order. A broke recruiter chasing a withdrawn
 *     candidate is told about the candidate, not about money — telling them to
 *     buy credits for a person they can never reach is the failure T-148 §5
 *     names.
 *  3. Plan limits never block, because `checkPlanLimit` is a stub the unlock
 *     path does not call.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  diagnoseUnlock,
  type UnlockDiagnosisFacts,
} from "@/features/admin/unlock-diagnosis";

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

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const root = process.cwd();
const code = (rel: string) => stripComments(readFileSync(join(root, rel), "utf8"));

/** A recruiter who can unlock a reachable candidate and can afford it. */
function healthy(): UnlockDiagnosisFacts {
  return {
    recruiter: {
      name: "Asha Rao",
      deletedAt: null,
      disabledAt: null,
      disabledReason: null,
      hasRecruiterProfile: true,
      organizationId: "org_1",
    },
    candidate: {
      publicId: "AB-1234",
      label: "Priya N",
      deletedAt: null,
      disabledAt: null,
      visibility: {
        exists: true,
        searchableByRecruiters: true,
        withdrawnAt: null,
      },
    },
    addressable: true,
    addressableVia: "POOL",
    alreadyUnlocked: false,
    unlockedAt: null,
    planLimit: { allowed: false, remaining: null, reason: "NOT_IMPLEMENTED" },
    costMinor: 1000,
    balanceMinor: 20000,
    chargedAt: null,
    failures: [],
  };
}

console.log("\nT-267 unlock diagnosis\n");

suite("a healthy pair reports that the unlock would succeed", () => {
  const d = diagnoseUnlock(healthy());
  assert(d.canUnlock, "nothing should block");
  assert(d.outcome === "WOULD_SUCCEED", `got ${d.outcome}`);
  assert(d.blocker === null, "there should be no blocker");
  assert(d.verdict.includes("$10.00"), "the verdict should carry the real cost");
});

suite("a suspended recruiter is named as suspended, not as broke", () => {
  const facts = healthy();
  facts.recruiter.disabledAt = new Date("2026-09-01T00:00:00Z");
  facts.recruiter.disabledReason = "Fraud review";
  facts.balanceMinor = 0;
  const d = diagnoseUnlock(facts);
  assert(d.outcome === "ACCOUNT_BLOCKED", `got ${d.outcome}`);
  assert(d.blocker?.id === "recruiter-disabled", `got ${d.blocker?.id}`);
  assert(
    d.verdict.includes("suspended"),
    "the verdict must say the account is suspended",
  );
  assert(
    d.blocker?.detail.includes("Fraud review"),
    "the reason on file must be shown",
  );
});

suite("no workspace is its own reason", () => {
  const facts = healthy();
  facts.recruiter.organizationId = null;
  facts.balanceMinor = 0;
  const d = diagnoseUnlock(facts);
  assert(d.outcome === "NOT_A_RECRUITER", `got ${d.outcome}`);
  assert(d.blocker?.id === "no-workspace", `got ${d.blocker?.id}`);
});

suite("an unregistered account is distinguished from a missing workspace", () => {
  const facts = healthy();
  facts.recruiter.hasRecruiterProfile = false;
  facts.recruiter.organizationId = null;
  const d = diagnoseUnlock(facts);
  assert(d.blocker?.id === "no-recruiter-profile", `got ${d.blocker?.id}`);
});

suite("insufficient credits names the shortfall in money", () => {
  const facts = healthy();
  facts.balanceMinor = 300;
  const d = diagnoseUnlock(facts);
  assert(d.outcome === "INSUFFICIENT_CREDITS", `got ${d.outcome}`);
  assert(
    d.blocker?.detail.includes("$7.00"),
    `the shortfall should be spelled out, got: ${d.blocker?.detail}`,
  );
  assert(
    d.blocker?.detail.includes("Nothing is charged"),
    "it must say nothing was charged",
  );
});

suite("a withdrawn candidate beats an empty balance", () => {
  const facts = healthy();
  facts.balanceMinor = 0;
  facts.candidate.visibility.withdrawnAt = new Date("2026-08-20T00:00:00Z");
  const d = diagnoseUnlock(facts);
  assert(d.outcome === "CANDIDATE_UNAVAILABLE", `got ${d.outcome}`);
  assert(d.blocker?.id === "candidate-withdrawn", `got ${d.blocker?.id}`);
  assert(
    !d.verdict.toLowerCase().includes("credit"),
    "a candidate blocker must never be explained as a money problem",
  );
});

suite("a deleted candidate, a disabled one and an unindexed one differ", () => {
  const deleted = healthy();
  deleted.candidate.deletedAt = new Date("2026-08-01T00:00:00Z");
  assert(
    diagnoseUnlock(deleted).blocker?.id === "candidate-deleted",
    "deleted candidate",
  );

  const disabled = healthy();
  disabled.candidate.disabledAt = new Date("2026-08-01T00:00:00Z");
  assert(
    diagnoseUnlock(disabled).blocker?.id === "candidate-disabled",
    "disabled candidate",
  );

  const unindexed = healthy();
  unindexed.candidate.visibility = {
    exists: false,
    searchableByRecruiters: false,
    withdrawnAt: null,
  };
  assert(
    diagnoseUnlock(unindexed).blocker?.id === "candidate-not-searchable",
    "no visibility row",
  );

  const unreachable = healthy();
  unreachable.addressable = false;
  unreachable.addressableVia = null;
  assert(
    diagnoseUnlock(unreachable).blocker?.id === "candidate-not-addressable",
    "searchable but not in this recruiter's pool",
  );
});

suite("an already-unlocked pair is not a failure", () => {
  const facts = healthy();
  facts.alreadyUnlocked = true;
  facts.unlockedAt = new Date("2026-09-10T00:00:00Z");
  facts.chargedAt = new Date("2026-09-10T00:00:00Z");
  facts.balanceMinor = 0;
  const d = diagnoseUnlock(facts);
  assert(d.canUnlock, "an existing unlock is not blocked");
  assert(d.outcome === "ALREADY_UNLOCKED", `got ${d.outcome}`);
  assert(
    d.checks.some((c) => c.id === "credits-ok" && c.detail.includes("free")),
    "a repeat unlock must be reported as free even at a zero balance",
  );
});

suite("plan limits are context, never a blocker", () => {
  const facts = healthy();
  facts.planLimit = { allowed: false, remaining: null, reason: "NOT_IMPLEMENTED" };
  const d = diagnoseUnlock(facts);
  const plan = d.checks.find((c) => c.id === "plan-limit");
  assert(plan?.status === "INFO", `plan row should be INFO, got ${plan?.status}`);
  assert(d.canUnlock, "a stubbed entitlement must not block an unlock");
});

suite("recorded failures are reported as delivery failures, not refusals", () => {
  const facts = healthy();
  facts.failures = [
    {
      id: "m1",
      kind: "OUTREACH_EMAIL",
      at: new Date("2026-09-12T00:00:00Z"),
      reason: "Mailbox does not exist.",
    },
  ];
  const d = diagnoseUnlock(facts);
  const row = d.checks.find((c) => c.id === "recorded-failures");
  assert(row?.status === "INFO", "failures are context");
  assert(
    row?.detail.includes("not unlock refusals"),
    "it must not imply the platform records failed unlock attempts",
  );
});

suite("no check ever says 'unlock unavailable' without a reason", () => {
  const facts = healthy();
  facts.addressable = false;
  const d = diagnoseUnlock(facts);
  for (const c of d.checks) {
    assert(c.detail.trim().length > 20, `${c.id} has no real explanation`);
  }
  assert(
    d.blocker?.summary !== null && (d.blocker?.summary?.length ?? 0) > 5,
    "a blocker must carry a summary phrase for the verdict line",
  );
});

suite("the panel is a read-only Server Component on the admin page", () => {
  const panel = code("src/components/admin/unlock-diagnosis-panel.tsx");
  assert(!panel.includes('"use client"'), "the panel must stay a Server Component");
  assert(
    !panel.includes("@/app/actions"),
    "the panel must not import Server Actions",
  );
  const page = code("src/app/admin/recruiters/[userId]/page.tsx");
  assert(
    page.includes("UnlockDiagnosisPanel"),
    "the recruiter detail page must mount the panel",
  );
  assert(page.includes("requireAdmin"), "the page must stay admin-gated");
});

suite("the loader reuses the real gates rather than re-deriving them", () => {
  const loader = code("src/features/admin/get-unlock-diagnosis.ts");
  for (const fn of [
    "hasContactAccess",
    "resolveAddressableCandidate",
    "getCreditBalance",
    "CONTACT_UNLOCK_COST_KEY",
  ]) {
    assert(loader.includes(fn), `the loader must read the real ${fn}`);
  }
  assert(loader.includes('import "server-only"'), "the loader must be server-only");
  for (const write of ["prisma.$transaction", ".create(", ".update(", ".delete("]) {
    assert(!loader.includes(write), `the diagnosis must not write (${write})`);
  }
});

if (failed > 0) {
  console.log(`\n${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`\n${passed} passed`);
