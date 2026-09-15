import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin-auth";
import {
  getDeliveryHealthSummary,
  searchDeliveries,
} from "@/features/notification/delivery-diagnosis";
import { DeliveryFilters } from "@/components/admin/delivery-filters";
import { DeliveryTable } from "@/components/admin/delivery-table";

export const metadata: Metadata = {
  title: "Deliveries | Admin",
};

const VALID_STATES = ["created", "sending", "sent", "failed"] as const;
const VALID_CHANNELS = ["in_app", "email"] as const;
const VALID_SOURCES = ["notification", "outbound"] as const;

function pick<T extends readonly string[]>(
  value: string | undefined,
  allowed: T,
): T[number] | undefined {
  if (!value) return undefined;
  return (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : undefined;
}

function toIso(local: string | undefined): string | undefined {
  if (!local) return undefined;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export default async function AdminDeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<{
    recipient?: string;
    event?: string;
    state?: string;
    channel?: string;
    source?: string;
    since?: string;
    until?: string;
  }>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const [rows, summary] = await Promise.all([
    searchDeliveries({
      recipient: sp.recipient?.trim() || undefined,
      eventType: sp.event?.trim() || undefined,
      state: pick(sp.state, VALID_STATES),
      channel: pick(sp.channel, VALID_CHANNELS),
      source: pick(sp.source, VALID_SOURCES),
      since: toIso(sp.since),
      until: toIso(sp.until),
    }),
    getDeliveryHealthSummary(),
  ]);

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">
          Deliveries
        </h1>
        <p className="text-sm text-muted-foreground">
          Every notification and outbound-mail attempt with its state, failure
          reason and retry state. Read-only. Filter to answer &ldquo;why did
          this message not arrive?&rdquo; (T-268, TC-A-006).
        </p>
      </div>

      <section
        aria-label="Delivery health, last 24 hours"
        className="grid grid-cols-2 gap-3 md:grid-cols-7"
      >
        <HealthTile
          label="Notif · sent"
          value={summary.notification.sent}
          tone="ok"
        />
        <HealthTile
          label="Notif · sending"
          value={summary.notification.sending}
          tone="warn"
        />
        <HealthTile
          label="Notif · created"
          value={summary.notification.created}
          tone="mute"
        />
        <HealthTile
          label="Notif · failed"
          value={summary.notification.failed}
          tone="bad"
        />
        <HealthTile label="Outbound · SENT" value={summary.outbound.SENT} tone="ok" />
        <HealthTile
          label="Outbound · SKIPPED"
          value={summary.outbound.SKIPPED}
          tone="mute"
        />
        <HealthTile
          label="Outbound · FAILED"
          value={summary.outbound.FAILED}
          tone="bad"
        />
      </section>

      <DeliveryFilters />

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">
          Attempts <span className="text-sm text-muted-foreground">({rows.length})</span>
        </h2>
        <DeliveryTable rows={rows} />
      </div>
    </div>
  );
}

function HealthTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "ok" | "warn" | "bad" | "mute";
}) {
  const toneClass =
    tone === "ok"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "warn"
        ? "text-amber-700 dark:text-amber-400"
        : tone === "bad"
          ? "text-destructive"
          : "text-muted-foreground";
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}
