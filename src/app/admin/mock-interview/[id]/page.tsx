import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { getMockInterviewDetail } from "@/features/admin/mock-interview-admin";

export const metadata: Metadata = {
  title: "Mock interview | Admin",
};

export default async function AdminMockInterviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const detail = await getMockInterviewDetail(id);
  if (!detail) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/mock-interview"
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Mock interviews
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold md:text-3xl">
          {detail.userName ?? detail.userEmail ?? detail.userId}
        </h1>
        <p className="text-sm text-muted-foreground">
          Domain <span className="font-mono">{detail.domainSlug}</span> · Pack{" "}
          <span className="font-mono">
            {detail.packId} v{detail.packVersion}
          </span>{" "}
          · Attempt #{detail.attemptNumber}
        </p>
      </div>

      <section
        aria-label="Interview facts"
        className="grid grid-cols-2 gap-3 md:grid-cols-4"
      >
        <FactTile label="Status" value={detail.status} />
        <FactTile
          label="Overall"
          value={detail.overallScore != null ? String(detail.overallScore) : "—"}
        />
        <FactTile
          label="Started"
          value={detail.startedAt ? formatDateTime(detail.startedAt) : "—"}
        />
        <FactTile
          label="Ended"
          value={detail.endedAt ? formatDateTime(detail.endedAt) : "—"}
        />
      </section>

      {detail.invalidReason ? (
        <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p className="font-semibold text-destructive">Invalidated</p>
          <p className="text-destructive/80">{detail.invalidReason}</p>
        </section>
      ) : null}

      {detail.reportOverallScore != null ? (
        <section
          aria-label="Report summary"
          className="rounded-lg border border-border/50 bg-card p-4"
        >
          <h2 className="text-sm font-semibold">
            Report ({detail.reportOverallScore}/100
            {detail.narrativeDegraded ? " · narrative degraded" : ""})
          </h2>
          <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
            {detail.summary ?? "No prose summary."}
          </p>
        </section>
      ) : null}

      <section aria-label="Transcript" className="space-y-2">
        <h2 className="text-sm font-semibold">
          Transcript ({detail.turns.length} turns)
        </h2>
        <ol className="space-y-2">
          {detail.turns.map((turn) => (
            <li
              key={turn.id}
              className="rounded-md border border-border/50 bg-card p-3 text-sm"
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-mono">
                  #{turn.turnIndex} · {turn.action}
                </span>
                <span>{formatDateTime(turn.createdAt)}</span>
              </div>
              <p className="mt-2 whitespace-pre-line text-muted-foreground">
                Q: {turn.promptText}
              </p>
              <p className="mt-1 whitespace-pre-line">A: {turn.answerText}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function FactTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/50 bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}
