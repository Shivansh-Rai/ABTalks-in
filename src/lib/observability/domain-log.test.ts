/**
 * T-259 — the published log contract, per plan 116 §8 ("helper shape contract"
 * and "Sentry init gating").
 *   npm run test:observability:contract
 *
 * `logMoney`, `logContact` and `logNotificationDelivery` are what T-248,
 * T-268 and the money tasks (T-228/229/230/232) will call. This pins the shape
 * they emit, so a later edit that renames `area` or drops `outcome` fails here
 * rather than in someone else's parser two weeks from now.
 */
import { Writable } from "node:stream";

import { createLoggerTo, type AppLogger } from "@/lib/logger";
import {
  logContact,
  logMoney,
  logNotificationDelivery,
} from "@/lib/observability/domain-log";

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

function capture(): { log: AppLogger; lines: () => Record<string, unknown>[] } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(c, _e, cb) {
      chunks.push(c.toString());
      cb();
    },
  });
  return {
    log: createLoggerTo(stream),
    lines: () =>
      chunks
        .join("")
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l) as Record<string, unknown>),
  };
}

function one(fn: (log: AppLogger) => void): Record<string, unknown> {
  const c = capture();
  fn(c.log);
  const lines = c.lines();
  assert(lines.length === 1, `expected exactly one line, got ${lines.length}`);
  return lines[0];
}

console.log("\nT-259 domain log contract");

suite("logMoney writes area=money with the ctx fields", () => {
  const line = one((log) =>
    logMoney("credit.debit", {
      outcome: "success",
      userId: "cmuser1",
      recruiterId: "cmrec1",
      candidateId: "cmcand1",
      amount: -250,
      ledgerEntryId: "cmledger1",
      idempotencyKey: "redeem:abc",
      newBalance: 750,
      log,
    }),
  );

  assert(line.area === "money", `area should be money, got ${line.area}`);
  assert(line.op === "credit.debit", `op should be set, got ${line.op}`);
  assert(line.outcome === "success", "outcome must be present");
  assert(line.event === "credit.debit.success", `event was ${line.event}`);
  assert(line.userId === "cmuser1", "userId must survive");
  assert(line.recruiterId === "cmrec1", "recruiterId must survive");
  assert(line.candidateId === "cmcand1", "candidateId must survive");
  assert(line.amount === -250, "the signed amount must survive");
  assert(line.ledgerEntryId === "cmledger1", "ledgerEntryId must survive");
  assert(line.idempotencyKey === "redeem:abc", "idempotencyKey must survive");
  assert(line.newBalance === 750, "newBalance must survive");
  assert(line.level === "info", "a success is info");
});

suite("logContact writes area=contact with the ctx fields", () => {
  const line = one((log) =>
    logContact("unlock", {
      outcome: "success",
      recruiterId: "cmrec1",
      candidateId: "cmcand1",
      unlockId: "cmengage1",
      log,
    }),
  );

  assert(line.area === "contact", `area should be contact, got ${line.area}`);
  assert(line.op === "unlock", "op must be set");
  assert(line.event === "unlock.success", `event was ${line.event}`);
  assert(line.unlockId === "cmengage1", "unlockId must survive");
});

suite("logNotificationDelivery writes the shape T-268 reads", () => {
  const line = one((log) =>
    logNotificationDelivery({
      outcome: "failed",
      deliveryId: "del-1",
      channel: "email",
      kind: "recruiter.otp",
      recipientHash: "a".repeat(64),
      provider: "brevo",
      providerStatus: 400,
      attempt: 1,
      reason: "Bad Request (status=400)",
      requestId: "req-12345678",
      log,
    }),
  );

  assert(line.area === "notification", "area must be notification");
  assert(line.op === "notification", "op must be set");
  assert(line.outcome === "failed", "outcome must be present");
  assert(line.event === "notification.failed", `event was ${line.event}`);
  assert(line.deliveryId === "del-1", "deliveryId is the join key");
  assert(line.channel === "email", "channel must be present");
  assert(line.provider === "brevo", "provider must be present");
  assert(line.providerStatus === 400, "providerStatus must be present");
  assert(line.attempt === 1, "attempt must be present");
  assert(line.reason === "Bad Request (status=400)", "reason must be present");
  assert(line.requestId === "req-12345678", "requestId correlates the line");
  assert(line.level === "error", "a failure must log at error level");
});

suite("outcome drives the level, so alerts fire on faults only", () => {
  const level = (outcome: "attempt" | "success" | "refused" | "skipped" | "failed") =>
    one((log) => logMoney("credit.debit", { outcome, log })).level;

  assert(level("attempt") === "info", "attempt is info");
  assert(level("success") === "info", "success is info");
  // A declined redemption is a business answer, not an incident.
  assert(level("refused") === "warn", "refused is warn");
  assert(level("skipped") === "warn", "skipped is warn");
  assert(level("failed") === "error", "failed is error");
});

suite("null and undefined fields are omitted, not written as nulls", () => {
  const line = one((log) =>
    logContact("contact.resolve", {
      outcome: "attempt",
      recruiterId: "cmrec1",
      candidateId: null,
      unlockId: undefined,
      log,
    }),
  );
  assert(!("candidateId" in line), "a null field must be dropped");
  assert(!("unlockId" in line), "an undefined field must be dropped");
  assert(line.recruiterId === "cmrec1", "a present field must survive");
});

suite("redaction still applies underneath the helpers", () => {
  // The types forbid `email` at the call site; this is the runtime backstop for
  // a value that arrives through an `unknown`-typed field.
  const line = one((log) =>
    logContact("unlock", {
      outcome: "success",
      recruiterId: "cmrec1",
      note: "reach her on priya.sharma@example.com or +91 98765 43210",
      log,
    }),
  );
  const json = JSON.stringify(line);
  assert(!json.includes("priya.sharma"), "an address slipped through a free field");
  assert(!json.includes("98765 43210"), "a phone slipped through a free field");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exitCode = 1;
