/**
 * T-268 — TC-A-006 acceptance test.
 *
 * Run with:
 *   npm run test:delivery-diagnosis
 *
 * Uses a real database. Seeds one succeeded notification delivery, one failed
 * (bounce) notification delivery and one failed outbound delivery, then asserts
 * that `searchDeliveries` returns each with its verbatim failure reason and a
 * readable retry state, filters correctly, and hides the raw recipient address
 * behind the hash prefix on outbound rows.
 *
 * Cleanup runs before AND after so a previously-aborted run does not leak.
 */
import { prisma } from "@/lib/db";
import { hashRecipient } from "@/lib/observability/notification-delivery";
import {
  searchDeliveries,
  searchDeliveriesInputSchema,
} from "./delivery-diagnosis";

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
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

const TEST_USER_ID = "t268-diagnosis-test-user";
const TEST_EMAIL = "t268-diagnosis@abtalks.dev";
const OUTBOUND_ID = "t268-outbound-failed";
const OUTBOUND_KIND = "recruiter.otp";

async function cleanup() {
  await prisma.notificationDelivery.deleteMany({
    where: { notification: { recipientUserId: TEST_USER_ID } },
  });
  await prisma.userNotification.deleteMany({
    where: { recipientUserId: TEST_USER_ID },
  });
  await prisma.outboundDelivery.deleteMany({ where: { id: OUTBOUND_ID } });
  await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
}

async function setup() {
  await cleanup();
  await prisma.user.create({
    data: {
      id: TEST_USER_ID,
      email: TEST_EMAIL,
      name: "T-268 Diagnosis Test User",
    },
    select: { id: true },
  });

  // A shipped notification with the email delivery marked SENT.
  const sentNotification = await prisma.userNotification.create({
    data: {
      recipientUserId: TEST_USER_ID,
      eventType: "profile.viewed",
      title: "Someone viewed your profile",
      dedupeKey: `t268-diagnosis:sent:${Date.now()}`,
    },
    select: { id: true },
  });
  await prisma.notificationDelivery.createMany({
    data: [
      {
        notificationId: sentNotification.id,
        channel: "in_app",
        state: "sent",
      },
      {
        notificationId: sentNotification.id,
        channel: "email",
        state: "sent",
        attemptCount: 1,
        lastAttemptAt: new Date(),
      },
    ],
  });

  // A failed notification email — the "bounce" case.
  const failedNotification = await prisma.userNotification.create({
    data: {
      recipientUserId: TEST_USER_ID,
      eventType: "application.status_changed",
      title: "Your application status updated",
      dedupeKey: `t268-diagnosis:failed:${Date.now()}`,
    },
    select: { id: true },
  });
  await prisma.notificationDelivery.createMany({
    data: [
      {
        notificationId: failedNotification.id,
        channel: "in_app",
        state: "sent",
      },
      {
        notificationId: failedNotification.id,
        channel: "email",
        state: "failed",
        attemptCount: 2,
        lastAttemptAt: new Date(),
        failureReason: "bounced (5.1.1 no such user)",
      },
    ],
  });

  // A failed outbound (T-259 side-table) — recruiter OTP that Brevo rejected.
  await prisma.outboundDelivery.create({
    data: {
      id: OUTBOUND_ID,
      channel: "EMAIL",
      kind: OUTBOUND_KIND,
      recipientHash: hashRecipient(TEST_EMAIL),
      status: "FAILED",
      failureReason: "provider error: 400 invalid recipient",
      requestId: "req_t268_test",
      sentryEventId: "sentry_t268_test",
    },
    select: { id: true },
  });
}

async function main() {
  console.log("\nT-268 delivery diagnosis");

  await setup();
  try {
    await suite("Zod rejects bad state", async () => {
      const bad = searchDeliveriesInputSchema.safeParse({ state: "banana" });
      assert(!bad.success, "should reject unknown state");
    });

    await suite(
      "Zod accepts an empty search — the default is a broad recent view",
      async () => {
        const ok = searchDeliveriesInputSchema.safeParse({});
        assert(ok.success, "empty input must parse");
      },
    );

    await suite(
      "Filter by state=failed returns the bounce AND the outbound failure",
      async () => {
        const rows = await searchDeliveries({ state: "failed" });
        const notif = rows.find(
          (r) =>
            r.source === "notification" &&
            r.state === "failed" &&
            r.failureReason?.includes("bounced"),
        );
        const outbound = rows.find(
          (r) => r.source === "outbound" && r.id === OUTBOUND_ID,
        );
        assert(notif !== undefined, "notification bounce must appear");
        assert(outbound !== undefined, "outbound failure must appear");
      },
    );

    await suite(
      "Failure reason is preserved verbatim (readable, not truncated to a code)",
      async () => {
        const rows = await searchDeliveries({ state: "failed" });
        const notif = rows.find(
          (r) => r.source === "notification" && r.state === "failed",
        );
        assert(notif !== undefined, "no notification failure found");
        assert(
          notif!.failureReason === "bounced (5.1.1 no such user)",
          `wrong reason: ${notif!.failureReason}`,
        );

        const outbound = rows.find(
          (r) => r.source === "outbound" && r.id === OUTBOUND_ID,
        );
        assert(outbound !== undefined, "no outbound failure found");
        assert(
          outbound!.failureReason === "provider error: 400 invalid recipient",
          `wrong reason: ${outbound!.failureReason}`,
        );
      },
    );

    await suite(
      "Retry state is derivable — attemptCount is present and non-zero on the failed row",
      async () => {
        const rows = await searchDeliveries({ state: "failed" });
        const notif = rows.find(
          (r) => r.source === "notification" && r.state === "failed",
        );
        assert(notif !== undefined, "no notification failure found");
        assert(notif!.attemptCount === 2, "attemptCount must round-trip");
        assert(notif!.lastAttemptAt !== null, "lastAttemptAt must round-trip");
      },
    );

    await suite(
      "Outbound rows never leak the raw recipient — only the hash prefix",
      async () => {
        const rows = await searchDeliveries({ state: "failed" });
        const outbound = rows.find(
          (r) => r.source === "outbound" && r.id === OUTBOUND_ID,
        );
        assert(outbound !== undefined, "outbound row missing");
        // Only outbound-shaped fields on the row.
        const asAny = outbound as unknown as Record<string, unknown>;
        assert(
          !("recipientEmail" in asAny),
          "outbound row must not carry recipientEmail",
        );
        assert(
          typeof asAny.recipientHashPrefix === "string" &&
            (asAny.recipientHashPrefix as string).length === 8,
          "recipientHashPrefix must be the 8-char preview",
        );
      },
    );

    await suite(
      "Search by recipient email — hashes for outbound, direct match for notification",
      async () => {
        const rows = await searchDeliveries({ recipient: TEST_EMAIL });
        const notif = rows.find(
          (r) => r.source === "notification" && r.recipientEmail === TEST_EMAIL,
        );
        const outbound = rows.find(
          (r) => r.source === "outbound" && r.id === OUTBOUND_ID,
        );
        assert(notif !== undefined, "notification row for this email missing");
        assert(
          outbound !== undefined,
          "outbound row for hashed email missing",
        );
      },
    );

    await suite(
      "Source=notification limits results to the notification table",
      async () => {
        const rows = await searchDeliveries({ source: "notification" });
        assert(
          rows.every((r) => r.source === "notification"),
          "outbound row leaked through source filter",
        );
      },
    );

    await suite(
      "Source=outbound limits results to the outbound side-table",
      async () => {
        const rows = await searchDeliveries({ source: "outbound" });
        assert(
          rows.every((r) => r.source === "outbound"),
          "notification row leaked through source filter",
        );
      },
    );

    await suite(
      "Filtering by eventType hides outbound rows (outbound has no eventType)",
      async () => {
        const rows = await searchDeliveries({
          eventType: "application.status_changed",
        });
        assert(
          rows.every((r) => r.source === "notification"),
          "outbound row must not match an eventType filter",
        );
      },
    );
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }

  console.log(`\n  ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
