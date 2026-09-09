import "server-only";

/**
 * T-259 — the notification bridge.
 *
 * Every outbound message records one `NotificationDelivery` row, one structured
 * log line and (on failure) one Sentry event, all carrying the same
 * `deliveryId`. Given any one of the three, the other two are one lookup away.
 *
 * The recipient's address never appears in any of them. `recipientHash` is what
 * makes a support question ("did Priya's code arrive?") answerable: hash the
 * address they give you and look the hash up.
 */

import { createHash, randomUUID } from "node:crypto";
import type { NotificationDeliveryStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import { logger, safeErrorMessage, type AppLogger } from "@/lib/logger";
import { captureFailure } from "./capture";
import { logNotificationDelivery } from "./domain-log";
import { getRequestId } from "./request-id";

export type DeliveryOutcome =
  | { status: "SENT" }
  | { status: "SKIPPED"; reason: string }
  | { status: "FAILED"; error: unknown };

export type DeliveryContext = {
  /** Stable name for this kind of message: "recruiter.otp", "hire.alert", … */
  kind: string;
  /** The recipient address. Hashed immediately; never stored or logged. */
  recipient: string;
  /** Domain entity this send belongs to, when there is one. */
  subjectType?: string;
  subjectId?: string;
  /** Supplied by callers that already know it; otherwise read from headers. */
  requestId?: string;
  log?: AppLogger;
};

export type DeliveryRecord = {
  deliveryId: string;
  /** Redacted, persistable reason. Present for SKIPPED and FAILED. */
  reason?: string;
  sentryEventId?: string;
};

export function hashRecipient(recipient: string): string {
  return createHash("sha256").update(recipient.trim().toLowerCase()).digest("hex");
}

/**
 * Allocate the id before the send, so a provider call that hangs or crashes the
 * process still has an id in the `notification.attempt` line to look for.
 */
export function newDeliveryId(): string {
  return randomUUID();
}

/**
 * Record the outcome of one send: log, persist, and report failures.
 *
 * Persistence is best-effort. An observability side-table that can take down
 * the mail path is worse than no side-table, and the log line — which has
 * already been written by then — carries everything the row would have.
 */
export async function recordDelivery(
  deliveryId: string,
  ctx: DeliveryContext,
  outcome: DeliveryOutcome,
): Promise<DeliveryRecord> {
  const requestId = ctx.requestId ?? (await getRequestId());
  const log = ctx.log ?? logger;
  const recipientHash = hashRecipient(ctx.recipient);

  // The shape T-268's admin delivery view reads. See `./domain-log`.
  const base = {
    deliveryId,
    channel: "email" as const,
    kind: ctx.kind,
    recipientHash,
    subjectType: ctx.subjectType,
    subjectId: ctx.subjectId,
    provider: "brevo",
    // Nothing retries a send today; see the field's note in `domain-log.ts`.
    attempt: 1,
    requestId,
    log,
  };

  let reason: string | undefined;
  let sentryEventId: string | undefined;

  if (outcome.status === "SENT") {
    logNotificationDelivery({ ...base, outcome: "success" });
  } else if (outcome.status === "SKIPPED") {
    reason = outcome.reason;
    logNotificationDelivery({ ...base, outcome: "skipped", reason });
  } else {
    // The failure line is written by captureFailure so that the Sentry event id
    // it returns lands on the same line. `extra` carries the contract fields
    // (`area`/`op`/`outcome`) so a failure has the same shape as a success -
    // T-268 must not need two parsers.
    const captured = await captureFailure(outcome.error, {
      event: "notification.failed",
      message: "notification failed",
      log,
      tags: {
        deliveryId,
        channel: "email",
        kind: ctx.kind,
        requestId,
        subjectId: ctx.subjectId,
      },
      extra: {
        area: "notification",
        op: "notification",
        outcome: "failed",
        recipientHash,
        subjectType: ctx.subjectType,
        provider: "brevo",
      },
    });
    reason = captured.reason;
    sentryEventId = captured.sentryEventId;
  }

  await persist({
    id: deliveryId,
    kind: ctx.kind,
    recipientHash,
    subjectType: ctx.subjectType ?? null,
    subjectId: ctx.subjectId ?? null,
    status: outcome.status as NotificationDeliveryStatus,
    failureReason: reason ?? null,
    requestId: requestId ?? null,
    sentryEventId: sentryEventId ?? null,
  });

  return { deliveryId, reason, sentryEventId };
}

export type DeliveryRow = {
  id: string;
  kind: string;
  recipientHash: string;
  subjectType: string | null;
  subjectId: string | null;
  status: NotificationDeliveryStatus;
  failureReason: string | null;
  requestId: string | null;
  sentryEventId: string | null;
};

type Persister = (row: DeliveryRow) => Promise<void>;

let persisterOverride: Persister | null = null;

/**
 * Swap the database write out. Test-only: the notification-failure test asserts
 * what lands on the row without standing up Postgres.
 */
export function __setDeliveryPersisterForTests(fn: Persister | null): void {
  persisterOverride = fn;
}

async function persist(row: DeliveryRow): Promise<void> {
  try {
    if (persisterOverride) {
      await persisterOverride(row);
      return;
    }
    await prisma.notificationDelivery.create({
      data: row,
      select: { id: true },
    });
  } catch (error) {
    // Includes the window between deploying this code and running the
    // migration that creates the table.
    logger.warn(
      {
        event: "notification.delivery.persist_failed",
        deliveryId: row.id,
        reason: safeErrorMessage(error),
      },
      "could not persist delivery record",
    );
  }
}
