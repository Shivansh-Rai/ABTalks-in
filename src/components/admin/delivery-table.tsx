"use client";

import { Fragment, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DeliveryRow } from "@/features/notification/delivery-diagnosis";

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function stateBadgeVariant(
  state: DeliveryRow["state"],
): "default" | "secondary" | "destructive" | "outline" {
  if (state === "sent") return "default";
  if (state === "failed") return "destructive";
  if (state === "sending") return "secondary";
  return "outline";
}

function recipientDisplay(row: DeliveryRow): string {
  if (row.source === "notification") return row.recipientEmail;
  return `hash:${row.recipientHashPrefix}…`;
}

function eventDisplay(row: DeliveryRow): string {
  if (row.source === "notification") return row.eventType;
  return row.kind;
}

export function DeliveryTable({ rows }: { rows: DeliveryRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
        No delivery attempts match the current filters. Try widening the date
        range or clearing the recipient.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Source</TableHead>
            <TableHead>Event / Kind</TableHead>
            <TableHead>Channel</TableHead>
            <TableHead>State</TableHead>
            <TableHead>Recipient</TableHead>
            <TableHead>Attempts</TableHead>
            <TableHead>Last attempt</TableHead>
            <TableHead>Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const key = `${row.source}:${row.id}`;
            const isExpanded = expandedId === key;

            return (
              <Fragment key={key}>
                <TableRow
                  className="cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : key)}
                >
                  <TableCell>
                    <Badge variant="outline">
                      {row.source === "notification" ? "notif" : "outbound"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {eventDisplay(row)}
                  </TableCell>
                  <TableCell className="text-xs">{row.channel}</TableCell>
                  <TableCell>
                    <Badge variant={stateBadgeVariant(row.state)}>
                      {row.state}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {recipientDisplay(row)}
                  </TableCell>
                  <TableCell className="text-xs">{row.attemptCount}</TableCell>
                  <TableCell className="text-xs">
                    {formatWhen(row.lastAttemptAt)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {formatWhen(row.updatedAt)}
                  </TableCell>
                </TableRow>
                {isExpanded ? (
                  <TableRow className="bg-muted/40">
                    <TableCell colSpan={8}>
                      <dl className="grid gap-2 p-2 text-xs md:grid-cols-2">
                        <DetailRow label="Delivery id" value={row.id} />
                        {row.source === "notification" ? (
                          <>
                            <DetailRow
                              label="Notification id"
                              value={row.notificationId}
                            />
                            <DetailRow label="Title" value={row.title} />
                            <DetailRow
                              label="Recipient userId"
                              value={row.recipientUserId}
                            />
                            <DetailRow
                              label="Recipient name"
                              value={row.recipientName ?? "—"}
                            />
                          </>
                        ) : (
                          <>
                            <DetailRow
                              label="Subject type"
                              value={row.subjectType ?? "—"}
                            />
                            <DetailRow
                              label="Subject id"
                              value={row.subjectId ?? "—"}
                            />
                            <DetailRow
                              label="Request id"
                              value={row.requestId ?? "—"}
                            />
                            <DetailRow
                              label="Sentry event id"
                              value={row.sentryEventId ?? "—"}
                            />
                          </>
                        )}
                        <DetailRow
                          label="Created"
                          value={formatWhen(row.createdAt)}
                        />
                        <DetailRow
                          label="Retry state"
                          value={
                            row.state === "failed" && row.attemptCount > 0
                              ? `will retry (attempt ${row.attemptCount} of 5)`
                              : row.state === "sending"
                                ? "in flight"
                                : "n/a"
                          }
                        />
                        {row.failureReason ? (
                          <div className="md:col-span-2">
                            <dt className="font-semibold text-destructive">
                              Failure reason
                            </dt>
                            <dd className="mt-1 whitespace-pre-wrap font-mono text-[11px]">
                              {row.failureReason}
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-semibold text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-mono text-[11px] break-all">{value}</dd>
    </div>
  );
}
