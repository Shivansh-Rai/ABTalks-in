"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AdminMockInterviewRow } from "@/features/admin/mock-interview-admin";
import {
  deleteMockInterviewAction,
  grantMockInterviewAllowanceAction,
  invalidateMockInterviewAction,
} from "@/app/actions/admin-mock-interview-actions";

/**
 * T-276 mock-interview list table with row-level actions.
 *
 * Each button fires a Server Action, waits for the response, refreshes
 * the page on success, and surfaces the message on failure. useTransition
 * gives the row a pending state so an admin can't double-fire.
 */
export function MockInterviewTable({
  rows,
}: {
  rows: AdminMockInterviewRow[];
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
        No mock interviews match those filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th className="p-2">Candidate</th>
            <th className="p-2">Domain</th>
            <th className="p-2">Status</th>
            <th className="p-2">Score</th>
            <th className="p-2">Created</th>
            <th className="p-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <MockInterviewRow key={row.id} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MockInterviewRow({ row }: { row: AdminMockInterviewRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function runInvalidate() {
    const reason =
      typeof window !== "undefined"
        ? window.prompt("Why are you invalidating this interview?", "")
        : null;
    if (!reason) return;
    startTransition(async () => {
      const result = await invalidateMockInterviewAction({
        interviewId: row.id,
        reason,
      });
      setMessage(result.ok ? null : result.message);
      if (result.ok) router.refresh();
    });
  }

  function runDelete() {
    const reason =
      typeof window !== "undefined"
        ? window.prompt(
            `Delete this interview? This cannot be undone.\nReason:`,
            "",
          )
        : null;
    if (!reason) return;
    startTransition(async () => {
      const result = await deleteMockInterviewAction({
        interviewId: row.id,
        reason,
      });
      setMessage(result.ok ? null : result.message);
      if (result.ok) router.refresh();
    });
  }

  function runGrantAllowance() {
    if (typeof window === "undefined") return;
    const raw = window.prompt("Extra attempts to grant (1–50)?", "1");
    const extra = Number(raw);
    if (!Number.isFinite(extra) || extra < 1 || extra > 50) {
      setMessage("Enter a number between 1 and 50.");
      return;
    }
    const reason = window.prompt("Why?", "");
    if (!reason) return;
    startTransition(async () => {
      const result = await grantMockInterviewAllowanceAction({
        userId: row.userId,
        extraAttempts: Math.round(extra),
        reason,
      });
      setMessage(result.ok ? "Granted." : result.message);
      if (result.ok) router.refresh();
    });
  }

  return (
    <tr
      className="border-t border-border/40"
      data-pending={pending || undefined}
    >
      <td className="p-2">
        <Link
          href={`/admin/mock-interview/${row.id}`}
          className="font-medium text-foreground hover:underline"
        >
          {row.userName ?? row.userEmail ?? row.userId}
        </Link>
        {message ? (
          <p className="text-xs text-destructive">{message}</p>
        ) : null}
      </td>
      <td className="p-2 font-mono text-xs">{row.domainSlug}</td>
      <td className="p-2">{row.status}</td>
      <td className="p-2">{row.overallScore ?? "—"}</td>
      <td className="p-2 text-xs text-muted-foreground">
        {new Date(row.createdAt).toLocaleDateString()}
      </td>
      <td className="p-2 text-right">
        <div className="inline-flex gap-1">
          <button
            type="button"
            onClick={runInvalidate}
            disabled={pending || row.status === "INVALID"}
            className="rounded-md border border-border/60 px-2 py-0.5 text-xs disabled:opacity-40"
          >
            Invalidate
          </button>
          <button
            type="button"
            onClick={runDelete}
            disabled={pending}
            className="rounded-md border border-destructive/40 px-2 py-0.5 text-xs text-destructive disabled:opacity-40"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={runGrantAllowance}
            disabled={pending}
            className="rounded-md border border-border/60 px-2 py-0.5 text-xs disabled:opacity-40"
          >
            Grant +
          </button>
        </div>
      </td>
    </tr>
  );
}
