/**
 * T-228 — the credit ledger's database-backed proofs.
 *
 * Two jobs, in one script because they answer the same question from different
 * ends:
 *
 * 1. **Reconcile** every existing workspace. `SUM(CreditTransaction.amount)`,
 *    the newest row's `balanceAfter`, and the cached `CreditAccount.balance`
 *    must all be the same number. Read-only, safe anywhere.
 * 2. **Prove** the guarantees the design rests on — idempotency under
 *    concurrency, and that a conditional decrement makes overdraft impossible —
 *    by actually running them against Postgres. These write, so they run only
 *    on a scratch workspace, and only off production.
 *
 * A unit test cannot do part 2. Row locks, unique indexes and `WHERE balance +
 * amount >= 0` are database behaviour; asserting them against a mock proves
 * only that the mock agrees with whoever wrote it.
 *
 * Run: npm run db:check:credit-ledger          (reconcile only)
 *      npm run db:check:credit-ledger -- --prove   (also run the write proofs)
 */
import { PrismaClient } from "@prisma/client";
import type { CreditChangeResult } from "../../src/repositories/credits";
import {
  applyCreditChange,
  getCreditBalance,
  grantOnboardingCreditsAtomic,
  onboardingGrantKey,
  reconcileCreditAccount,
  sumLedgerBalance,
} from "../../src/repositories/credits";

const prisma = new PrismaClient();

/**
 * The allowance every credit movement runs under.
 *
 * Prisma's default is 5s, and a contended money path spends most of that
 * queueing behind somebody else's row lock over a Neon round trip. The real
 * callers pass this; the proofs must too, or they measure the timeout rather
 * than the guarantee. Same numbers `src/repositories/points.ts` uses.
 */
const TX_OPTIONS = { maxWait: 20_000, timeout: 20_000 } as const;

/** Same guard `src/repositories/points.ts` uses. Do not weaken it. */
const PRODUCTION_NEON_HOST_ID = "ep-nameless-term-ams9a5e3";

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ""}`);
  }
}

function isProduction(): boolean {
  return (process.env.DATABASE_URL ?? "").includes(PRODUCTION_NEON_HOST_ID);
}

/* ─── 1. reconcile what is already there ─────────────────────────────────── */

async function reconcileAll() {
  console.log("\nReconciling every workspace with a credit ledger\n");

  const orgs = await prisma.organization.findMany({
    where: {
      OR: [
        { creditTransactions: { some: {} } },
        { creditAccount: { isNot: null } },
      ],
    },
    select: { id: true, slug: true },
  });

  if (orgs.length === 0) {
    console.log("  (no workspace has moved credits yet — nothing to reconcile)");
    return;
  }

  for (const org of orgs) {
    const report = await reconcileCreditAccount(org.id);
    check(
      `${org.slug}: ledger ${report.ledgerSum} = latest ${report.latestBalanceAfter} = cache ${report.accountBalance} (${report.transactionCount} rows)`,
      report.reconciled,
      `DRIFT — sum=${report.ledgerSum} latestBalanceAfter=${report.latestBalanceAfter} accountBalance=${report.accountBalance}`,
    );

    // Every row's balanceBefore must be the previous row's balanceAfter, and
    // each row's own arithmetic must close. A chain that holds end to end is
    // the ledger proving itself.
    const rows = await prisma.creditTransaction.findMany({
      where: { organizationId: org.id },
      orderBy: { seq: "asc" },
      select: { seq: true, amount: true, balanceBefore: true, balanceAfter: true },
    });
    let running = 0;
    let chainOk = true;
    for (const row of rows) {
      if (row.balanceBefore !== running) chainOk = false;
      if (row.balanceAfter - row.balanceBefore !== row.amount) chainOk = false;
      running = row.balanceAfter;
    }
    check(`${org.slug}: balanceBefore/balanceAfter chain is unbroken`, chainOk);
  }
}

/* ─── 2. prove the guarantees, by doing them ─────────────────────────────── */

type Scratch = { organizationId: string; recruiterUserId: string };

async function makeScratch(): Promise<Scratch> {
  const stamp = Date.now();
  const user = await prisma.user.create({
    data: {
      email: `credit-proof-${stamp}@abtalks.dev`,
      name: "Credit ledger proof",
      role: "RECRUITER",
    },
    select: { id: true },
  });
  const org = await prisma.organization.create({
    data: { slug: `credit-proof-${stamp}`, name: "Credit ledger proof" },
    select: { id: true },
  });
  await prisma.organizationMember.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      role: "RECRUITER",
      status: "ACTIVE",
      joinedAt: new Date(),
    },
  });
  return { organizationId: org.id, recruiterUserId: user.id };
}

async function dropScratch(s: Scratch) {
  // Order matters: the ledger holds ON DELETE RESTRICT references to both the
  // organization and the recruiter, deliberately, so it goes first.
  await prisma.creditTransaction.deleteMany({
    where: { organizationId: s.organizationId },
  });
  await prisma.creditAccount.deleteMany({
    where: { organizationId: s.organizationId },
  });
  await prisma.organizationMember.deleteMany({
    where: { organizationId: s.organizationId },
  });
  await prisma.organization.delete({ where: { id: s.organizationId } });
  if (s.recruiterUserId) {
    await prisma.user.delete({ where: { id: s.recruiterUserId } });
  }
}

/**
 * Remove anything a previous crashed run left behind.
 *
 * The first run of these proofs aborted mid-teardown and left one scratch
 * workspace with a stale ledger row, which the reconcile pass then reported as
 * drift — a false alarm that cost more time to diagnose than this function
 * costs to write. A proof that can lie about the system when it crashes is
 * worse than no proof.
 */
async function cleanupStrays() {
  const strays = await prisma.organization.findMany({
    where: { slug: { startsWith: "credit-proof-" } },
    select: { id: true, members: { select: { userId: true } } },
  });
  if (strays.length === 0) return;

  console.log(
    `\n  (clearing ${strays.length} scratch workspace(s) from an earlier run)`,
  );
  for (const org of strays) {
    await dropScratch({
      organizationId: org.id,
      recruiterUserId: org.members[0]?.userId ?? "",
    }).catch(() => {});
  }
}

async function assertReconciled(s: Scratch, label: string) {
  const report = await reconcileCreditAccount(s.organizationId);
  check(
    `${label}: cache still equals the ledger`,
    report.reconciled,
    `sum=${report.ledgerSum} latest=${report.latestBalanceAfter} cache=${report.accountBalance}`,
  );
}

async function proveGrantIsIdempotent() {
  console.log("\nThe onboarding grant happens exactly once\n");
  const s = await makeScratch();
  try {
    const first = await grantOnboardingCreditsAtomic(s);
    check(
      "a new workspace is granted $200.00",
      first.ok && first.balance === 20_000,
      `got ${JSON.stringify(first)}`,
    );

    const second = await grantOnboardingCreditsAtomic(s);
    check(
      "granting again moves nothing and reports duplicate",
      second.ok && second.duplicate && second.balance === 20_000,
      `got ${JSON.stringify(second)}`,
    );

    const rows = await prisma.creditTransaction.count({
      where: { idempotencyKey: onboardingGrantKey(s.organizationId) },
    });
    check("exactly one GRANT_ONBOARDING row exists", rows === 1, `found ${rows}`);
    await assertReconciled(s, "after the grant");
  } finally {
    await dropScratch(s);
  }
}

async function proveConcurrentGrantsCollapse() {
  console.log("\nFive simultaneous grants still produce one ledger row\n");
  const s = await makeScratch();
  try {
    // allSettled, not all: `all` rejects on the first failure and leaves the
    // other four transactions in flight, so the teardown below would race
    // commits that have not happened yet. A proof about concurrency has to wait
    // for the concurrency.
    const settled = await Promise.allSettled(
      Array.from({ length: 5 }, () => grantOnboardingCreditsAtomic(s)),
    );
    const rejected = settled.filter((r) => r.status === "rejected");
    check(
      "no attempt threw",
      rejected.length === 0,
      rejected.map((r) => String((r as PromiseRejectedResult).reason)).join(" | "),
    );
    const results = settled
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<CreditChangeResult>).value);
    check(
      "every attempt reported success",
      results.length === 5 && results.every((r) => r.ok),
      JSON.stringify(results),
    );

    const rows = await prisma.creditTransaction.count({
      where: { organizationId: s.organizationId },
    });
    check("exactly one ledger row", rows === 1, `found ${rows}`);

    const balance = await getCreditBalance(s.organizationId);
    check("balance is $200.00, not $1000.00", balance === 20_000, `got ${balance}`);
    await assertReconciled(s, "after concurrent grants");
  } finally {
    await dropScratch(s);
  }
}

async function proveArithmetic() {
  console.log("\nPositive and negative movements, and the numbers they record\n");
  const s = await makeScratch();
  try {
    await grantOnboardingCreditsAtomic(s);

    const credit = await prisma.$transaction((tx) =>
      applyCreditChange(tx, {
        organizationId: s.organizationId,
        recruiterUserId: s.recruiterUserId,
        amount: 5_000,
        type: "ADMIN_ADJUSTMENT",
        sourceType: "ORGANIZATION",
        sourceId: s.organizationId,
        idempotencyKey: `proof:credit:${s.organizationId}`,
        reason: "Proof: a positive movement",
      }),
      TX_OPTIONS,
    );
    check(
      "a $50.00 credit takes the balance to $250.00",
      credit.ok && credit.balance === 25_000,
      JSON.stringify(credit),
    );

    const debit = await prisma.$transaction((tx) =>
      applyCreditChange(tx, {
        organizationId: s.organizationId,
        recruiterUserId: s.recruiterUserId,
        amount: -7_500,
        type: "UNLOCK_CONTACT",
        sourceType: "PROOF",
        idempotencyKey: `proof:debit:${s.organizationId}`,
        reason: "Proof: a negative movement",
      }),
      TX_OPTIONS,
    );
    check(
      "a $75.00 debit takes it to $175.00",
      debit.ok && debit.balance === 17_500,
      JSON.stringify(debit),
    );

    const rows = await prisma.creditTransaction.findMany({
      where: { organizationId: s.organizationId },
      orderBy: { seq: "asc" },
      select: { amount: true, balanceBefore: true, balanceAfter: true },
    });
    check(
      "every row's balanceBefore/balanceAfter bracket its own amount",
      rows.every((r) => r.balanceAfter - r.balanceBefore === r.amount),
      JSON.stringify(rows),
    );
    check(
      "each row starts where the last one ended",
      rows.every((r, i) => r.balanceBefore === (i === 0 ? 0 : rows[i - 1].balanceAfter)),
      JSON.stringify(rows),
    );

    const derived = await getCreditBalance(s.organizationId);
    const summed = await sumLedgerBalance(s.organizationId);
    check(
      "the balance read from the ledger equals the ledger's sum",
      derived === summed && derived === 17_500,
      `derived=${derived} summed=${summed}`,
    );
    await assertReconciled(s, "after mixed movements");
  } finally {
    await dropScratch(s);
  }
}

async function proveNoOverspend() {
  console.log("\nTen concurrent $20 debits against $100\n");
  const s = await makeScratch();
  try {
    await prisma.$transaction((tx) =>
      applyCreditChange(tx, {
        organizationId: s.organizationId,
        recruiterUserId: s.recruiterUserId,
        amount: 10_000,
        type: "ADMIN_ADJUSTMENT",
        sourceType: "PROOF",
        idempotencyKey: `proof:fund:${s.organizationId}`,
        reason: "Proof: fund the overspend test",
      }),
      TX_OPTIONS,
    );

    // allSettled so a thrown attempt is reported as a failure of the guarantee
    // rather than hidden, and so the teardown waits for every transaction.
    const settled = await Promise.allSettled(
      Array.from({ length: 10 }, (_unused, i) =>
        prisma.$transaction(
          (tx) =>
            applyCreditChange(tx, {
              organizationId: s.organizationId,
              recruiterUserId: s.recruiterUserId,
              amount: -2_000,
              type: "UNLOCK_CONTACT",
              sourceType: "PROOF",
              idempotencyKey: `proof:spend:${s.organizationId}:${i}`,
              reason: "Proof: concurrent spend",
            }),
          TX_OPTIONS,
        ),
      ),
    );

    const threw = settled.filter((r) => r.status === "rejected");
    check(
      "no attempt threw — every one got an answer",
      threw.length === 0,
      threw.map((r) => String((r as PromiseRejectedResult).reason)).join(" | "),
    );

    const attempts = settled
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<CreditChangeResult>).value);
    const won = attempts.filter((a) => a.ok).length;
    const refused = attempts.filter(
      (a) => !a.ok && a.reason === "INSUFFICIENT_CREDITS",
    ).length;

    check(`exactly 5 debits succeeded (got ${won})`, won === 5);
    check(`exactly 5 were refused for insufficient credits (got ${refused})`, refused === 5);

    const balance = await getCreditBalance(s.organizationId);
    check("the balance is $0.00 and never went below it", balance === 0, `got ${balance}`);

    const negative = await prisma.creditTransaction.count({
      where: { organizationId: s.organizationId, balanceAfter: { lt: 0 } },
    });
    check("no ledger row ever recorded a negative balance", negative === 0);

    const spendRows = await prisma.creditTransaction.count({
      where: { organizationId: s.organizationId, type: "UNLOCK_CONTACT" },
    });
    check(`only the 5 successful debits were written (got ${spendRows})`, spendRows === 5);
    await assertReconciled(s, "after the overspend race");
  } finally {
    await dropScratch(s);
  }
}

async function proveInsufficientIsClean() {
  console.log("\nA debit that cannot be paid changes nothing\n");
  const s = await makeScratch();
  try {
    await grantOnboardingCreditsAtomic(s);

    const before = await prisma.creditTransaction.count({
      where: { organizationId: s.organizationId },
    });
    const result = await prisma.$transaction((tx) =>
      applyCreditChange(tx, {
        organizationId: s.organizationId,
        recruiterUserId: s.recruiterUserId,
        amount: -20_001,
        type: "UNLOCK_CONTACT",
        sourceType: "PROOF",
        idempotencyKey: `proof:toomuch:${s.organizationId}`,
        reason: "Proof: one cent more than there is",
      }),
      TX_OPTIONS,
    );
    check(
      "it is refused, and says why",
      !result.ok && result.reason === "INSUFFICIENT_CREDITS",
      JSON.stringify(result),
    );

    const after = await prisma.creditTransaction.count({
      where: { organizationId: s.organizationId },
    });
    check("no ledger row was written", after === before);
    check(
      "the balance is untouched",
      (await getCreditBalance(s.organizationId)) === 20_000,
    );
    await assertReconciled(s, "after a refused debit");
  } finally {
    await dropScratch(s);
  }
}

async function proveConfigDrivesTheGrant() {
  console.log("\nChanging the configuration changes the next grant\n");
  const key = "credits.starting_grant_minor";
  const original = await prisma.platformConfig.findUnique({
    where: { key },
    select: { intValue: true },
  });

  const s = await makeScratch();
  try {
    await prisma.platformConfig.upsert({
      where: { key },
      create: { key, intValue: 10_000 },
      update: { intValue: 10_000 },
    });

    const result = await grantOnboardingCreditsAtomic(s);
    check(
      "a $100.00 configured grant produces a $100.00 balance, with no deployment",
      result.ok && result.balance === 10_000,
      JSON.stringify(result),
    );

    const row = await prisma.creditTransaction.findUnique({
      where: { idempotencyKey: onboardingGrantKey(s.organizationId) },
      select: { amount: true, metadata: true },
    });
    check(
      "the amount and the config it came from are frozen into the row",
      row?.amount === 10_000 &&
        JSON.stringify(row?.metadata).includes("10000"),
      JSON.stringify(row),
    );
  } finally {
    await dropScratch(s);
    if (original) {
      await prisma.platformConfig.update({
        where: { key },
        data: { intValue: original.intValue },
      });
    } else {
      await prisma.platformConfig.delete({ where: { key } }).catch(() => {});
    }
  }
}

/* ─── run ────────────────────────────────────────────────────────────────── */

async function main() {
  const prove = process.argv.includes("--prove");

  console.log("\nT-228 credit ledger checks");

  // Before reconciling, not after: rows a crashed run left behind would
  // otherwise be reported as drift in the real data.
  if (prove && !isProduction()) await cleanupStrays();

  await reconcileAll();

  if (!prove) {
    console.log(
      "\n(reconcile only — pass --prove to also run the write proofs on a dev branch)",
    );
  } else if (isProduction()) {
    console.log(
      "\nRefusing to run the write proofs against production. They create and delete rows.",
    );
    failed++;
  } else {
    await proveGrantIsIdempotent();
    await proveConcurrentGrantsCollapse();
    await proveArithmetic();
    await proveNoOverspend();
    await proveInsufficientIsClean();
    await proveConfigDrivesTheGrant();
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("Credit ledger check failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
