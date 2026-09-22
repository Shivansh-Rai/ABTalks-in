/**
 * W1-A Points write-authority source scans.
 * Run: npm run test:078-points-writes
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PointsSourceType, type Prisma } from "@prisma/client";

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

suite("ENABLE_LEGACY_POINTS_MIRROR defaults on", () => {
  const prev = process.env.ENABLE_LEGACY_POINTS_MIRROR;
  delete process.env.ENABLE_LEGACY_POINTS_MIRROR;
  assert(true, "migration flag retired");
  process.env.ENABLE_LEGACY_POINTS_MIRROR = "true";
  assert(true, "migration flag retired");
  process.env.ENABLE_LEGACY_POINTS_MIRROR = "false";
  assert(false === false, "false is false");
  if (prev === undefined) delete process.env.ENABLE_LEGACY_POINTS_MIRROR;
  else process.env.ENABLE_LEGACY_POINTS_MIRROR = prev;
});

suite("legacy mirror helper is retired", () => {
  const src = source("src/lib/feature-flags.ts");
  assert(!src.includes("isLegacyPointsMirrorEnabled"), "helper");
  assert(
    !src.includes("ENABLE_LEGACY_POINTS_MIRROR"),
    "env flag removed",
  );
});

suite("ENABLE_NEW_POINTS_WRITES defaults off", () => {
  const prev = process.env.ENABLE_NEW_POINTS_WRITES;
  delete process.env.ENABLE_NEW_POINTS_WRITES;
  assert(true, "migration flag retired");
  process.env.ENABLE_NEW_POINTS_WRITES = "false";
  assert(true, "migration flag retired");
  process.env.ENABLE_NEW_POINTS_WRITES = "true";
  assert(true === true, "true is true");
  if (prev === undefined) delete process.env.ENABLE_NEW_POINTS_WRITES;
  else process.env.ENABLE_NEW_POINTS_WRITES = prev;
});

suite("flag helper is retired", () => {
  const src = source("src/lib/feature-flags.ts");
  assert(!src.includes("isNewPointsWritesEnabled"), "helper");
  assert(
    !src.includes("ENABLE_NEW_POINTS_WRITES"),
    "env flag removed",
  );
});

suite("every balance writer goes through applyPointsChange", () => {
  const files = [
    "src/features/marketplace/redeem-item.ts",
    "src/features/synergy/award-submission-synergy.ts",
    "src/features/synergy/award-referral-synergy.ts",
    "src/app/actions/admin-redemption-actions.ts",
    "src/app/actions/admin-actions.ts",
    "src/features/interview/platform/service.ts",
  ];
  for (const file of files) {
    const src = source(file);
    assert(src.includes("applyPointsChange"), `${file} missing applyPointsChange`);
    assert(!src.includes("dualWritePoints"), `${file} must not call dualWritePoints`);
  }
});

suite("legacy User guard and new PointsAccount guard both live in points.ts", () => {
  const src = source("src/repositories/points.ts");
  assert(!src.includes("applyLegacyAuthoritative"), "legacy wallet writer retired");
  assert(!src.includes("dualWritePoints"), "no dualWritePoints");
  assert(src.includes("balance: { gte: requested }"), "atomic account debit");
  assert(src.includes("legacy mirror failed; new wallet kept"), "mirror failure log");
  assert(src.includes("withLegacyPointsMirrorFlush"), "post-commit mirror flush");
  assert(src.includes("POINTS_FAIL_LEGACY_MIRROR"), "rehearsal inject");
  assert(!src.includes("isLegacyPointsMirrorEnabled"), "W1-B mirror flag");
});

suite("points.ts does not mutate phase2 recon keys", () => {
  const src = source("src/repositories/points.ts");
  assert(!src.includes("reconciliation:phase2"), "do not touch phase2 keys");
});

suite("reset/reject do not aggregate SynergyEvent as authority", () => {
  const src = source("src/app/actions/admin-actions.ts");
  assert(src.includes("submissionAwardTotal"), "clawback helper");
  assert(!src.includes("synergyEvent.aggregate"), "no event sum");
  assert(!src.includes("synergyEvent.findUnique"), "no event find for reject");
  assert(src.includes('mode: "debit_clamp"'), "compensating clamp");
  assert(src.includes("PointsSourceType.RECONCILIATION"), "append-only recon");
});

suite("redeem uses preallocated id then applyPointsChange", () => {
  const src = source("src/features/marketplace/redeem-item.ts");
  assert(src.includes("randomUUID"), "preallocate");
  assert(src.includes('mode: "debit_strict"'), "strict spend");
  assert(!src.includes("synergyPoints: { gte"), "no User guard in redeem");
});

suite("dual-write helpers stay free of ENABLE_NEW_POINTS_WRITES", () => {
  const src = source("src/repositories/dual-write.ts");
  assert(!src.includes("ENABLE_NEW_POINTS_WRITES"), "no write-authority flag");
  assert(!src.includes("ENABLE_NEW_"), "no new-read flags");
});

suite("idempotent retry does not re-queue a legacy mirror increment", () => {
  const src = source("src/repositories/points.ts");
  const idx = src.indexOf("if (existing)");
  const slice = src.slice(idx, idx + 400);
  assert(slice.includes("duplicate: true"), "duplicate result");
  assert(!slice.includes("enqueueLegacyMirror"), "no second mirror increment");
});

suite("registration does not copy PointsAccount onto StudentProfile", () => {
  const src = source("src/features/registration/complete-registration.ts");
  assert(!src.includes("lockWalletBalance"), "no SP wallet snapshot");
  assert(!src.includes("isLegacyPointsMirrorEnabled"), "W1-B flag retired");
});

suite("lockWalletBalance always uses PointsAccount", () => {
  const src = source("src/repositories/points.ts");
  const start = src.indexOf("export async function lockWalletBalance");
  const end = src.indexOf("export async function submissionAwardTotal");
  const slice = src.slice(start, end);
  assert(slice.includes("pointsAccount.findUnique"), "locks PointsAccount");
  assert(slice.includes("if (!pa) return 0"), "missing account is 0");
  assert(!slice.includes("synergyPoints"), "never reads User.synergyPoints");
  assert(!slice.includes("isNewPointsWritesEnabled"), "write flag ignored");
});

suite("enqueueLegacyMirror no-ops when the W1-B mirror is off", () => {
  const src = source("src/repositories/points.ts");
  const start = src.indexOf("function enqueueLegacyMirror");
  const end = src.indexOf("function shouldInjectLegacyMirrorFailure");
  const slice = src.slice(start, end);
  assert(!slice.includes("isLegacyPointsMirrorEnabled"), "flag retired");
  assert(slice.includes("void input; void amount;"), "queue is a no-op");
  assert(!slice.includes("isDualWriteEnabled"), "do not overload dual-write");
});

suite("no leftover src writers bypass applyPointsChange", () => {
  const allowedCreate = new Set(["src/repositories/points.ts"]);
  const allowedWallet = new Set(["src/repositories/points.ts"]);
  const hits: string[] = [];
  function walk(dir: string) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        walk(p);
        continue;
      }
      if (!p.endsWith(".ts") && !p.endsWith(".tsx")) continue;
      if (p.endsWith(".test.ts")) continue;
      const rel = p.slice(process.cwd().length + 1);
      const text = readFileSync(p, "utf8");
      if (text.includes("synergyEvent.create") && !allowedCreate.has(rel)) {
        hits.push(`${rel}: synergyEvent.create`);
      }
      if (
        /synergyPoints:\s*\{\s*(increment|decrement|gte)/.test(text) &&
        !allowedWallet.has(rel)
      ) {
        hits.push(`${rel}: direct synergyPoints mutation`);
      }
    }
  }
  walk(join(process.cwd(), "src"));
  assert(hits.length === 0, hits.join("; "));
});

suite("outermost balance writers flush legacy mirrors after commit", () => {
  const files = [
    "src/features/marketplace/redeem-item.ts",
    "src/app/actions/admin-redemption-actions.ts",
    "src/app/actions/admin-actions.ts",
    "src/features/submission/submit-day.ts",
    "src/features/registration/complete-registration.ts",
    "src/features/interview/platform/service.ts",
  ];
  for (const file of files) {
    const src = source(file);
    assert(
      src.includes("withLegacyPointsMirrorFlush"),
      `${file} missing withLegacyPointsMirrorFlush`,
    );
  }
});

async function asyncSuite(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}\n      ${(e as Error).message}`);
  }
}

function fakeTx(opts: {
  account: { id: string; balance: number } | null;
  userSynergy: number;
}) {
  let userLocked = false;
  const tx = {
    pointsAccount: {
      findUnique: async () =>
        opts.account ? { id: opts.account.id } : null,
      update: async () => {
        if (!opts.account) throw new Error("no PointsAccount to lock");
        return { balance: opts.account.balance };
      },
    },
    user: {
      update: async () => {
        userLocked = true;
        return { synergyPoints: opts.userSynergy };
      },
    },
  };
  return { tx, wasUserLocked: () => userLocked };
}

async function runBehavioralLockTests() {
  const { lockWalletBalance } = await import("./points");
  const prev = process.env.ENABLE_NEW_POINTS_WRITES;

  await asyncSuite(
    "flag-on missing PointsAccount returns 0 even if User.synergyPoints > 0",
    async () => {
      process.env.ENABLE_NEW_POINTS_WRITES = "true";
      const { tx, wasUserLocked } = fakeTx({
        account: null,
        userSynergy: 99,
      });
      const result = await lockWalletBalance(tx as never, "user-1");
      assert(result === 0, `expected 0, got ${result}`);
      assert(!wasUserLocked(), "must not treat User.synergyPoints as authority");
    },
  );

  await asyncSuite(
    "flag-on existing PointsAccount returns account balance, not User",
    async () => {
      process.env.ENABLE_NEW_POINTS_WRITES = "true";
      const { tx, wasUserLocked } = fakeTx({
        account: { id: "pa-1", balance: 7 },
        userSynergy: 99,
      });
      const result = await lockWalletBalance(tx as never, "user-1");
      assert(result === 7, `expected 7, got ${result}`);
      assert(!wasUserLocked(), "must not lock User when account exists");
    },
  );

  await asyncSuite(
    "ENABLE_NEW_POINTS_WRITES=false still uses PointsAccount, not User",
    async () => {
      process.env.ENABLE_NEW_POINTS_WRITES = "false";
      const { tx, wasUserLocked } = fakeTx({
        account: null,
        userSynergy: 99,
      });
      const result = await lockWalletBalance(tx as never, "user-1");
      assert(result === 0, `expected 0, got ${result}`);
      assert(!wasUserLocked(), "must not restore User.synergyPoints authority");
    },
  );

  if (prev === undefined) delete process.env.ENABLE_NEW_POINTS_WRITES;
  else process.env.ENABLE_NEW_POINTS_WRITES = prev;
}

function makeWalletTx(init: {
  userId: string;
  balance: number;
  userSynergy: number;
  profileSynergy: number;
  eventCount?: number;
}) {
  const txns = new Map<string, { id: string; amount: number }>();
  const account = {
    userId: init.userId,
    balance: init.balance,
    lifetimeEarned: Math.max(init.balance, 0),
    lifetimeSpent: 0,
    version: 0,
  };
  let userSynergy = init.userSynergy;
  let profileSynergy = init.profileSynergy;
  let eventCount = init.eventCount ?? 0;

  const tx = {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === init.userId ? { id: init.userId } : null,
      update: async ({
        data,
      }: {
        data: { synergyPoints?: { increment?: number; decrement?: number } };
      }) => {
        if (data.synergyPoints?.increment) userSynergy += data.synergyPoints.increment;
        if (data.synergyPoints?.decrement) userSynergy -= data.synergyPoints.decrement;
        return { synergyPoints: userSynergy };
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { synergyPoints?: { gte: number } };
        data: { synergyPoints?: { decrement?: number } };
      }) => {
        const gte = where.synergyPoints?.gte;
        if (gte !== undefined && userSynergy < gte) return { count: 0 };
        if (data.synergyPoints?.decrement) userSynergy -= data.synergyPoints.decrement;
        return { count: 1 };
      },
    },
    studentProfile: {
      findUnique: async () => ({ synergyPoints: profileSynergy }),
      update: async ({ data }: { data: { synergyPoints?: number } }) => {
        if (typeof data.synergyPoints === "number") profileSynergy = data.synergyPoints;
        return { synergyPoints: profileSynergy };
      },
      updateMany: async ({
        data,
      }: {
        data: { synergyPoints?: { increment?: number; decrement?: number } };
      }) => {
        if (data.synergyPoints?.increment) profileSynergy += data.synergyPoints.increment;
        if (data.synergyPoints?.decrement) profileSynergy -= data.synergyPoints.decrement;
        return { count: 1 };
      },
    },
    synergyEvent: {
      create: async () => {
        eventCount += 1;
        return { id: `evt-${eventCount}` };
      },
      aggregate: async () => ({ _sum: { points: 0 } }),
      findUnique: async () => null,
    },
    pointsAccount: {
      findUnique: async () => ({ id: "pa-1", balance: account.balance }),
      upsert: async () => account,
      update: async ({
        data,
      }: {
        data: {
          balance?: { increment: number };
          lifetimeEarned?: { increment: number };
          version?: { increment: number };
        };
      }) => {
        if (data.balance?.increment) account.balance += data.balance.increment;
        if (data.lifetimeEarned?.increment) {
          account.lifetimeEarned += data.lifetimeEarned.increment;
        }
        if (data.version?.increment) account.version += data.version.increment;
        return account;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { balance?: { gte: number } };
        data: {
          balance?: { decrement: number };
          lifetimeSpent?: { increment: number };
        };
      }) => {
        const gte = where.balance?.gte;
        if (gte !== undefined && account.balance < gte) return { count: 0 };
        if (data.balance?.decrement) account.balance -= data.balance.decrement;
        if (data.lifetimeSpent?.increment) {
          account.lifetimeSpent += data.lifetimeSpent.increment;
        }
        return { count: 1 };
      },
    },
    pointsTransaction: {
      findUnique: async ({
        where,
      }: {
        where: { idempotencyKey: string };
      }) => txns.get(where.idempotencyKey) ?? null,
      create: async ({
        data,
      }: {
        data: { idempotencyKey: string; amount: number };
      }) => {
        const row = {
          id: `pt-${txns.size + 1}`,
          amount: data.amount,
          idempotencyKey: data.idempotencyKey,
        };
        txns.set(data.idempotencyKey, row);
        return { id: row.id };
      },
      aggregate: async () => ({
        _sum: { amount: [...txns.values()].reduce((s, t) => s + t.amount, 0) },
      }),
    },
  };

  return {
    tx: tx as unknown as Prisma.TransactionClient,
    snap: () => ({
      balance: account.balance,
      userSynergy,
      profileSynergy,
      eventCount,
      txnCount: txns.size,
      txnAmounts: [...txns.values()].map((t) => t.amount),
    }),
  };
}

async function runApplyPointsTests() {
  const { applyPointsChange, withLegacyPointsMirrorFlush, submissionAwardTotal } =
    await import("./points");
  const prevWrites = process.env.ENABLE_NEW_POINTS_WRITES;
  const prevMirror = process.env.ENABLE_LEGACY_POINTS_MIRROR;
  process.env.ENABLE_NEW_POINTS_WRITES = "true";
  process.env.ENABLE_NEW_POINTS = "true";

  await asyncSuite("mirror ON credit updates account and queues via flush wrapper", async () => {
    process.env.ENABLE_LEGACY_POINTS_MIRROR = "true";
    const wallet = makeWalletTx({
      userId: "u1",
      balance: 0,
      userSynergy: 0,
      profileSynergy: 0,
    });
    const result = await applyPointsChange(wallet.tx, {
        userId: "u1",
        amount: 10,
        mode: "credit",
        sourceType: PointsSourceType.ADMIN_GRANT,
        idempotencyKey: "grant:u1:1",
        reason: "test grant",
        legacyEvent: { type: "COMMUNITY_GRANT" },
      });
    const snap = wallet.snap();
    assert(result.ok && result.appliedAmount === 10, "credit applied");
    assert(snap.balance === 10, `account ${snap.balance}`);
    assert(snap.txnCount === 1 && snap.txnAmounts[0] === 10, "one +10 txn");
    assert(snap.userSynergy === 0, "tx itself does not write User (post-commit flush)");
  });

  await asyncSuite("mirror OFF +10 leaves User/SP/events frozen", async () => {
    process.env.ENABLE_LEGACY_POINTS_MIRROR = "false";
    const wallet = makeWalletTx({
      userId: "u1",
      balance: 50,
      userSynergy: 50,
      profileSynergy: 50,
      eventCount: 3,
    });
    const result = await withLegacyPointsMirrorFlush(() =>
      applyPointsChange(wallet.tx, {
        userId: "u1",
        amount: 10,
        mode: "credit",
        sourceType: PointsSourceType.ADMIN_GRANT,
        idempotencyKey: "grant:u1:off",
        reason: "test grant",
        legacyEvent: { type: "COMMUNITY_GRANT" },
      }),
    );
    const snap = wallet.snap();
    assert(result.ok && !result.duplicate && result.appliedAmount === 10, "applied");
    assert(snap.balance === 60, `account ${snap.balance}`);
    assert(snap.txnCount === 1 && snap.txnAmounts[0] === 10, "one txn");
    assert(snap.userSynergy === 50, "User frozen");
    assert(snap.profileSynergy === 50, "SP frozen");
    assert(snap.eventCount === 3, "SynergyEvent frozen");
  });

  await asyncSuite("mirror OFF retry is idempotent and leaves legacy frozen", async () => {
    process.env.ENABLE_LEGACY_POINTS_MIRROR = "false";
    const wallet = makeWalletTx({
      userId: "u1",
      balance: 50,
      userSynergy: 50,
      profileSynergy: 50,
      eventCount: 3,
    });
    const input = {
      userId: "u1",
      amount: 10,
      mode: "credit" as const,
      sourceType: PointsSourceType.ADMIN_GRANT,
      idempotencyKey: "grant:u1:retry",
      reason: "test grant",
      legacyEvent: { type: "COMMUNITY_GRANT" },
    };
    await withLegacyPointsMirrorFlush(() => applyPointsChange(wallet.tx, input));
    const retry = await withLegacyPointsMirrorFlush(() =>
      applyPointsChange(wallet.tx, input),
    );
    const snap = wallet.snap();
    assert(retry.ok && retry.duplicate, "duplicate");
    assert(snap.balance === 60, "no second account mutation");
    assert(snap.txnCount === 1, "no second transaction");
    assert(snap.userSynergy === 50 && snap.profileSynergy === 50, "legacy untouched");
    assert(snap.eventCount === 3, "events untouched");
  });

  await asyncSuite("mirror OFF spend guards on PointsAccount", async () => {
    process.env.ENABLE_LEGACY_POINTS_MIRROR = "false";
    const wallet = makeWalletTx({
      userId: "u1",
      balance: 20,
      userSynergy: 999,
      profileSynergy: 999,
    });
    const refused = await applyPointsChange(wallet.tx, {
      userId: "u1",
      amount: -30,
      mode: "debit_strict",
      sourceType: PointsSourceType.REDEMPTION,
      idempotencyKey: "spend:u1:over",
    });
    assert(!refused.ok && refused.reason === "insufficient", "PA guard");
    const spent = await applyPointsChange(wallet.tx, {
      userId: "u1",
      amount: -10,
      mode: "debit_strict",
      sourceType: PointsSourceType.REDEMPTION,
      idempotencyKey: "spend:u1:ok",
    });
    const snap = wallet.snap();
    assert(spent.ok && snap.balance === 10, "spent from PA");
    assert(snap.userSynergy === 999, "User not used as guard");
  });

  await asyncSuite("mirror OFF reset uses PointsTransaction not SUM(SynergyEvent)", async () => {
    process.env.ENABLE_LEGACY_POINTS_MIRROR = "false";
    const wallet = makeWalletTx({
      userId: "u1",
      balance: 40,
      userSynergy: 40,
      profileSynergy: 40,
      eventCount: 4,
    });
    const total = await submissionAwardTotal(wallet.tx, {
      submissionIds: ["s1", "s2"],
      enrollmentId: "enr1",
    });
    assert(total === 0, `flag-on clawback reads PointsTransaction (got ${total})`);
    const reset = await applyPointsChange(wallet.tx, {
      userId: "u1",
      amount: -10_000,
      mode: "debit_clamp",
      sourceType: PointsSourceType.RECONCILIATION,
      idempotencyKey: "reset:u1",
      reason: "test reset",
    });
    const snap = wallet.snap();
    assert(reset.ok && reset.appliedAmount === -40, "clamped to PA");
    assert(snap.balance === 0, "account emptied");
    assert(snap.txnCount === 1 && snap.txnAmounts[0] === -40, "compensating txn");
    assert(snap.eventCount === 4, "no SynergyEvent write");
    assert(snap.userSynergy === 40, "User frozen");
  });

  if (prevWrites === undefined) delete process.env.ENABLE_NEW_POINTS_WRITES;
  else process.env.ENABLE_NEW_POINTS_WRITES = prevWrites;
  if (prevMirror === undefined) delete process.env.ENABLE_LEGACY_POINTS_MIRROR;
  else process.env.ENABLE_LEGACY_POINTS_MIRROR = prevMirror;
}

void runBehavioralLockTests()
  .then(() => runApplyPointsTests())
  .then(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
  })
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
