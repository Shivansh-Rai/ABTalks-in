import "server-only";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashRecipient } from "@/lib/observability/notification-delivery";

/**
 * T-268 — read-only search over the two delivery side-tables.
 *
 * `NotificationDelivery` (T-248) tracks per-user notification channel attempts.
 * `OutboundDelivery` (T-259) tracks non-notification outbound mail. Neither
 * table has ever surfaced to an admin before; this repository is the entire
 * read boundary for the diagnosis console.
 *
 * The recipient email is only ever stored as a hash on `OutboundDelivery`. The
 * caller supplies the raw email to search by; this file hashes it before the
 * WHERE clause and never returns the raw value. Notification rows do carry the
 * recipient's email through the `User` relation — that is the whole point of
 * per-user notifications — and are returned as-is.
 */

const PER_SOURCE_CAP = 200;
const DEFAULT_LIMIT = 50;

const stateSchema = z.enum(["created", "sending", "sent", "failed"]);
const channelSchema = z.enum(["in_app", "email"]);
const sourceSchema = z.enum(["notification", "outbound"]);

export const searchDeliveriesInputSchema = z.object({
  recipient: z.string().trim().max(320).optional(),
  eventType: z.string().trim().max(120).optional(),
  state: stateSchema.optional(),
  channel: channelSchema.optional(),
  source: sourceSchema.optional(),
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
  limit: z.number().int().positive().max(PER_SOURCE_CAP).optional(),
});

export type SearchDeliveriesInput = z.infer<typeof searchDeliveriesInputSchema>;

type BaseRow = {
  id: string;
  channel: "in_app" | "email";
  state: "created" | "sending" | "sent" | "failed";
  failureReason: string | null;
  attemptCount: number;
  lastAttemptAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NotificationDeliveryRow = BaseRow & {
  source: "notification";
  notificationId: string;
  eventType: string;
  title: string;
  recipientUserId: string;
  recipientEmail: string;
  recipientName: string | null;
};

export type OutboundDeliveryRow = BaseRow & {
  source: "outbound";
  kind: string;
  recipientHashPrefix: string;
  subjectType: string | null;
  subjectId: string | null;
  requestId: string | null;
  sentryEventId: string | null;
};

export type DeliveryRow = NotificationDeliveryRow | OutboundDeliveryRow;

function isEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

function normalizeOutboundState(
  status: "SENT" | "FAILED" | "SKIPPED",
): "sent" | "failed" | "created" {
  if (status === "SENT") return "sent";
  if (status === "FAILED") return "failed";
  return "created";
}

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

/**
 * Search both delivery tables in a single call.
 *
 * Filters:
 *   - `recipient`: email address OR user id. For notification rows it matches
 *     the joined User; for outbound rows an email is hashed and matched, a
 *     non-email string is treated as a userId and returns no outbound rows.
 *   - `state`, `channel`: apply verbatim.
 *   - `eventType`: notification rows only. When set, outbound rows are omitted.
 *   - `source`: restricts to one side of the union.
 *   - `since`, `until`: bounded by `createdAt` on both sides.
 *
 * Results are two independent finds unioned in memory (cap `PER_SOURCE_CAP`
 * each) and returned sorted by `updatedAt` desc.
 */
export async function searchDeliveries(
  input: SearchDeliveriesInput,
): Promise<DeliveryRow[]> {
  const limit = input.limit ?? DEFAULT_LIMIT;
  const since = input.since ? new Date(input.since) : undefined;
  const until = input.until ? new Date(input.until) : undefined;

  const wantNotification = input.source !== "outbound";
  const wantOutbound = input.source !== "notification" && !input.eventType;

  const rows: DeliveryRow[] = [];

  if (wantNotification) {
    const where: Prisma.NotificationDeliveryWhereInput = {};
    if (input.state) where.state = input.state;
    if (input.channel) where.channel = input.channel;
    if (since || until) {
      where.createdAt = {};
      if (since) where.createdAt.gte = since;
      if (until) where.createdAt.lte = until;
    }
    const notificationWhere: Prisma.UserNotificationWhereInput = {};
    if (input.eventType) notificationWhere.eventType = input.eventType;
    if (input.recipient) {
      if (isEmail(input.recipient)) {
        notificationWhere.recipient = {
          email: { equals: input.recipient, mode: "insensitive" },
        };
      } else {
        notificationWhere.recipientUserId = input.recipient;
      }
    }
    if (Object.keys(notificationWhere).length > 0) {
      where.notification = notificationWhere;
    }

    const notificationRows = await prisma.notificationDelivery.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: {
        id: true,
        notificationId: true,
        channel: true,
        state: true,
        attemptCount: true,
        lastAttemptAt: true,
        failureReason: true,
        createdAt: true,
        updatedAt: true,
        notification: {
          select: {
            eventType: true,
            title: true,
            recipientUserId: true,
            recipient: { select: { email: true, name: true } },
          },
        },
      },
    });

    for (const r of notificationRows) {
      rows.push({
        source: "notification",
        id: r.id,
        notificationId: r.notificationId,
        channel: r.channel as "in_app" | "email",
        state: r.state as BaseRow["state"],
        failureReason: r.failureReason,
        attemptCount: r.attemptCount,
        lastAttemptAt: iso(r.lastAttemptAt),
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        eventType: r.notification.eventType,
        title: r.notification.title,
        recipientUserId: r.notification.recipientUserId,
        recipientEmail: r.notification.recipient.email,
        recipientName: r.notification.recipient.name,
      });
    }
  }

  if (wantOutbound) {
    // channel="in_app" never matches outbound rows (which are all EMAIL).
    if (input.channel && input.channel !== "email") {
      // skip
    } else {
      const where: Prisma.OutboundDeliveryWhereInput = {};
      if (input.state === "sent") where.status = "SENT";
      else if (input.state === "failed") where.status = "FAILED";
      else if (input.state === "created") where.status = "SKIPPED";
      // "sending" has no outbound analogue.
      else if (input.state === "sending") {
        return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      }

      if (since || until) {
        where.createdAt = {};
        if (since) where.createdAt.gte = since;
        if (until) where.createdAt.lte = until;
      }

      if (input.recipient) {
        if (isEmail(input.recipient)) {
          where.recipientHash = hashRecipient(input.recipient);
        } else {
          // A non-email recipient (a userId) cannot match outbound rows.
          // Skip this side entirely.
          return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        }
      }

      const outboundRows = await prisma.outboundDelivery.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          kind: true,
          recipientHash: true,
          subjectType: true,
          subjectId: true,
          status: true,
          failureReason: true,
          requestId: true,
          sentryEventId: true,
          createdAt: true,
        },
      });

      for (const r of outboundRows) {
        const createdAtIso = r.createdAt.toISOString();
        rows.push({
          source: "outbound",
          id: r.id,
          channel: "email",
          state: normalizeOutboundState(r.status),
          failureReason: r.failureReason,
          // OutboundDelivery has no attempt counter today; one row = one attempt.
          attemptCount: 1,
          lastAttemptAt: createdAtIso,
          createdAt: createdAtIso,
          updatedAt: createdAtIso,
          kind: r.kind,
          recipientHashPrefix: r.recipientHash.slice(0, 8),
          subjectType: r.subjectType,
          subjectId: r.subjectId,
          requestId: r.requestId,
          sentryEventId: r.sentryEventId,
        });
      }
    }
  }

  return rows
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);
}

/**
 * Compact counters for the header of the console page — how many deliveries in
 * each state over the last 24h. Bounded, indexed reads on `state`.
 */
export async function getDeliveryHealthSummary(): Promise<{
  since: string;
  notification: Record<"created" | "sending" | "sent" | "failed", number>;
  outbound: Record<"SENT" | "FAILED" | "SKIPPED", number>;
}> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [notificationGroups, outboundGroups] = await Promise.all([
    prisma.notificationDelivery.groupBy({
      by: ["state"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.outboundDelivery.groupBy({
      by: ["status"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
  ]);

  const notification: Record<
    "created" | "sending" | "sent" | "failed",
    number
  > = { created: 0, sending: 0, sent: 0, failed: 0 };
  for (const row of notificationGroups) {
    const key = row.state as keyof typeof notification;
    if (key in notification) notification[key] = row._count._all;
  }

  const outbound: Record<"SENT" | "FAILED" | "SKIPPED", number> = {
    SENT: 0,
    FAILED: 0,
    SKIPPED: 0,
  };
  for (const row of outboundGroups) {
    outbound[row.status] = row._count._all;
  }

  return { since: since.toISOString(), notification, outbound };
}
