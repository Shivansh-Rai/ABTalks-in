/**
 * Plan 194 — the invite token's lifecycle.
 *
 * These are the properties the link's safety rests on, so they are asserted
 * rather than assumed: peeking does not spend it, spending works exactly once,
 * and a spent or unknown token yields nobody.
 *
 * Writes to a database, so point it at the SAMPLE one:
 *   npm run test:hr-invite
 */
import { prisma } from "@/lib/db";
import {
  createHrInvite,
  consumeHrInvite,
  peekHrInviteEmail,
} from "@/features/hire/hr-invite";

const EMAIL = `hr-invite-test-${Date.now()}@klymb-test.ai`;

let passed = 0;
let failed = 0;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function suite(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}\n      ${(e as Error).message}`);
  }
}

async function main() {
  console.log("\nHR invite tokens");

  const created = await createHrInvite({
    email: EMAIL,
    name: "Invite Test",
    company: "Test Co",
  });
  assert(created.ok, `the invite could not be created: ${created.ok ? "" : created.message}`);
  const token = created.data.token;

  await suite("the account is provisioned as a usable recruiter", async () => {
    const profile = await prisma.recruiterProfile.findUnique({
      where: { userId: created.data.userId },
      select: { setupCompletedAt: true, approved: true },
    });
    assert(profile, "no RecruiterProfile — getRecruiterState would report 'none'");
    assert(profile.setupCompletedAt, "setup never completed, so the desk stays shut");
  });

  await suite("peeking says who it is for and does NOT spend it", async () => {
    const first = await peekHrInviteEmail(token);
    const second = await peekHrInviteEmail(token);
    assert(first === EMAIL, `expected ${EMAIL}, got ${first}`);
    assert(second === EMAIL, "a second peek found nothing — peeking consumed the token");
  });

  await suite("an unknown token is nobody", async () => {
    assert(
      (await peekHrInviteEmail("not-a-real-token")) === null,
      "a made-up token must not resolve",
    );
    assert(
      (await consumeHrInvite("not-a-real-token")) === null,
      "a made-up token must not sign anyone in",
    );
  });

  await suite("spending it returns the invited recruiter", async () => {
    const holder = await consumeHrInvite(token);
    assert(holder, "the token would not spend");
    assert(holder.email === EMAIL, `signed in as ${holder.email}`);
    assert(holder.id === created.data.userId, "spent to a different account");
  });

  await suite("it spends exactly once", async () => {
    assert(
      (await consumeHrInvite(token)) === null,
      "a spent link still works — a forwarded or logged URL would stay live",
    );
    assert(
      (await peekHrInviteEmail(token)) === null,
      "a spent link still resolves on peek",
    );
  });

  // Leave the sample database as it was found.
  await prisma.recruiterProfile.deleteMany({ where: { userId: created.data.userId } });
  await prisma.verificationToken.deleteMany({
    where: { identifier: `hr-invite:${EMAIL}` },
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  console.log(
    `note: left the test's User and Organization rows in place (${created.data.userId}) —\n` +
      "deleting an org is refused by the credit ledger's RESTRICT, by design.\n",
  );
  if (failed > 0) process.exitCode = 1;
  await prisma.$disconnect();
}

void main();
