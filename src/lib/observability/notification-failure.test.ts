/**
 * T-259 Test A — a failed notification produces all three views, and none of
 * them contains the recipient's address.
 *   npm run test:observability:notification
 *
 * No network, no database, no Sentry project. The two edges of the bridge are
 * injected (`__setDeliveryPersisterForTests`, `__setSentryCaptureForTests`) so
 * the assertion is about what the bridge *writes*, which is the part that has
 * to be right.
 *
 * The provider error is shaped like a real Brevo rejection: Brevo echoes the
 * request back inside the message, recipient address and API key included.
 * That is the specific thing `String(error)` used to put straight into the log,
 * and it is what this test exists to keep out.
 */
import { Writable } from "node:stream";

import { createLoggerTo } from "@/lib/logger";
import { __setSentryCaptureForTests } from "@/lib/observability/capture";
import {
  __setDeliveryPersisterForTests,
  hashRecipient,
  newDeliveryId,
  recordDelivery,
  type DeliveryRow,
} from "@/lib/observability/notification-delivery";

let passed = 0;
let failed = 0;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function suite(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}\n      ${(e as Error).message}`);
  }
}

const RECIPIENT = "priya.sharma@example.com";
const API_KEY = "xkeysib-0123456789abcdef0123456789abcdef";

/** What Brevo actually throws: the whole request, echoed back. */
function brevoRejection() {
  return Object.assign(
    new Error(
      `Bad Request: {"to":[{"email":"${RECIPIENT}"}],` +
        `"headers":{"api-key":"${API_KEY}"},"code":"invalid_parameter"}`,
    ),
    { status: 400, statusCode: 400 },
  );
}

type Harness = {
  rows: DeliveryRow[];
  captures: { error: unknown; tags: Record<string, string> }[];
  logs: () => string;
  logLines: () => Record<string, unknown>[];
};

function harness(): Harness & { log: ReturnType<typeof createLoggerTo> } {
  const rows: DeliveryRow[] = [];
  const captures: { error: unknown; tags: Record<string, string> }[] = [];
  const chunks: string[] = [];

  __setDeliveryPersisterForTests(async (row) => {
    rows.push(row);
  });
  __setSentryCaptureForTests((error, tags) => {
    captures.push({ error, tags });
    return "sentry-event-0123456789abcdef";
  });

  const stream = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(chunk.toString());
      cb();
    },
  });

  const logs = () => chunks.join("");
  return {
    rows,
    captures,
    logs,
    logLines: () =>
      logs()
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l) as Record<string, unknown>),
    log: createLoggerTo(stream),
  };
}

function reset() {
  __setDeliveryPersisterForTests(null);
  __setSentryCaptureForTests(null);
}

async function main() {
  console.log("\nT-259 notification failure bridge");

  await suite("a failed send writes the row, the log and the Sentry event", async () => {
  const h = harness();
  const deliveryId = newDeliveryId();
  const error = brevoRejection();

  const result = await recordDelivery(
    deliveryId,
    {
      kind: "recruiter.otp",
      recipient: RECIPIENT,
      subjectType: "recruiterProfile",
      subjectId: "cmrecruiter001",
      requestId: "0198f2c1-aaaa-bbbb-cccc-000000000001",
      log: h.log,
    },
    { status: "FAILED", error },
  );
  reset();

  // --- view 1: the database row -------------------------------------------
  assert(h.rows.length === 1, `expected one delivery row, got ${h.rows.length}`);
  const row = h.rows[0];
  assert(row.id === deliveryId, "the row must carry the delivery id");
  assert(row.status === "FAILED", `expected FAILED, got ${row.status}`);
  assert(
    typeof row.failureReason === "string" && row.failureReason.length > 0,
    "the failure reason must be persisted",
  );
  assert(
    row.requestId === "0198f2c1-aaaa-bbbb-cccc-000000000001",
    "the row must carry the request id",
  );
  assert(
    row.sentryEventId === "sentry-event-0123456789abcdef",
    "the row must carry the Sentry event id",
  );
  assert(
    row.recipientHash === hashRecipient(RECIPIENT),
    "the row identifies the recipient by hash",
  );

  // --- view 2: the structured log -----------------------------------------
  const lines = h.logLines();
  const fail = lines.find((l) => l.event === "notification.failed");
  assert(fail, `no notification.failed line in: ${h.logs()}`);
  assert(fail.deliveryId === deliveryId, "the log line must carry the delivery id");
  assert(fail.channel === "email", "the log line must carry the channel");
  assert(fail.area === "notification", "a failure needs the same shape as a success");
  assert(fail.outcome === "failed", "the published contract field `outcome`");
  assert(fail.kind === "recruiter.otp", "the log line must carry the kind");
  assert(
    fail.requestId === "0198f2c1-aaaa-bbbb-cccc-000000000001",
    "the log line must carry the request id",
  );
  assert(
    typeof fail.reason === "string" && (fail.reason as string).includes("400"),
    `the reason must keep the diagnosis, got ${JSON.stringify(fail.reason)}`,
  );
  assert(
    fail.sentryEventId === "sentry-event-0123456789abcdef",
    "the log line must carry the Sentry event id",
  );

  // --- view 3: Sentry ------------------------------------------------------
  assert(h.captures.length === 1, `expected one capture, got ${h.captures.length}`);
  const capture = h.captures[0];
  assert(capture.error === error, "the original error must reach Sentry");
  assert(capture.tags.deliveryId === deliveryId, "Sentry needs the delivery id tag");
  assert(capture.tags.channel === "email", "Sentry needs the channel tag");
  assert(
    capture.tags.requestId === "0198f2c1-aaaa-bbbb-cccc-000000000001",
    "Sentry needs the request id tag",
  );

  // --- the caller gets the same handles ------------------------------------
  assert(result.deliveryId === deliveryId, "recordDelivery returns the id");
  assert(result.sentryEventId === "sentry-event-0123456789abcdef", "…and the event id");
});

  await suite("no recipient address, and no API key, in any of the three", async () => {
  const h = harness();
  await recordDelivery(
    newDeliveryId(),
    { kind: "hire.alert", recipient: RECIPIENT, log: h.log },
    { status: "FAILED", error: brevoRejection() },
  );
  reset();

  const surfaces: [string, string][] = [
    ["structured log", h.logs()],
    ["delivery row", JSON.stringify(h.rows)],
    ["sentry tags", JSON.stringify(h.captures.map((c) => c.tags))],
  ];
  for (const [where, text] of surfaces) {
    assert(!text.includes(RECIPIENT), `${where} leaked the recipient address`);
    assert(!text.includes("priya.sharma"), `${where} leaked the local part`);
    assert(!text.includes(API_KEY), `${where} leaked the provider API key`);
  }
});

  await suite("a successful send is recorded too, still without the address", async () => {
  const h = harness();
  const deliveryId = newDeliveryId();
  await recordDelivery(
    deliveryId,
    { kind: "recruiter.approved", recipient: RECIPIENT, log: h.log },
    { status: "SENT" },
  );
  reset();

  assert(h.rows[0]?.status === "SENT", "the row must record the success");
  assert(h.rows[0]?.failureReason === null, "a success has no failure reason");
  assert(h.captures.length === 0, "a success must not raise a Sentry event");

  const sent = h.logLines().find((l) => l.event === "notification.success");
  assert(sent, `no notification.success line in: ${h.logs()}`);
  assert(sent.area === "notification", "the published contract field `area`");
  assert(sent.outcome === "success", "the published contract field `outcome`");
  assert(sent.deliveryId === deliveryId, "the success line carries the delivery id");
  assert(!h.logs().includes(RECIPIENT), "the success line leaked the address");
});

  await suite("a skipped send is distinguishable from a failure", async () => {
  const h = harness();
  await recordDelivery(
    newDeliveryId(),
    { kind: "contact.form", recipient: "seed@abtalks.dev", log: h.log },
    { status: "SKIPPED", reason: "test address" },
  );
  reset();

  assert(h.rows[0]?.status === "SKIPPED", "the row must say SKIPPED, not FAILED");
  assert(h.rows[0]?.failureReason === "test address", "the reason must be kept");
  assert(h.captures.length === 0, "a deliberate skip is not a Sentry incident");
});

  await suite("a persister that throws does not break the send path", async () => {
  const h = harness();
  __setDeliveryPersisterForTests(async () => {
    // What a missing table looks like between deploy and migrate.
    throw new Error("relation \"OutboundDelivery\" does not exist");
  });

  let threw = false;
  try {
    await recordDelivery(
      newDeliveryId(),
      { kind: "hire.alert", recipient: RECIPIENT, log: h.log },
      { status: "FAILED", error: brevoRejection() },
    );
  } catch {
    threw = true;
  }
  reset();

  assert(!threw, "observability must never take down the path it observes");
  assert(
    h.logLines().some((l) => l.event === "notification.failed"),
    "the log line is written before the row, so it must survive",
  );
});

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

void main();
