"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { resolveDataRightsRequestAction } from "@/app/actions/legal-actions";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DataRightsRow } from "@/features/legal/get-data-rights-requests";

const TYPE_LABELS: Record<string, string> = {
  ACCESS: "Access",
  CORRECTION: "Correction",
  ERASURE: "Erasure",
  OTHER: "Other",
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  DONE: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  REJECTED: "bg-muted text-muted-foreground",
};

export function DataRequestsTable({ rows }: { rows: DataRightsRow[] }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function update(id: string, status: "DONE" | "REJECTED") {
    setPendingId(id);
    startTransition(async () => {
      const result = await resolveDataRightsRequestAction({ id, status });
      setPendingId(null);
      if (result.ok) {
        toast.success(status === "DONE" ? "Marked done" : "Marked rejected");
      } else {
        toast.error(result.message ?? "Could not update");
      }
    });
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        No data-rights requests.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[52rem] text-sm">
        <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">Email</th>
            <th className="px-4 py-2.5 font-medium">Type</th>
            <th className="px-4 py-2.5 font-medium">Message</th>
            <th className="px-4 py-2.5 font-medium">Age</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.id} className={cn(row.overdue && "bg-destructive/5")}>
              <td className="px-4 py-3 font-medium break-all">{row.email}</td>
              <td className="px-4 py-3 whitespace-nowrap">
                {TYPE_LABELS[row.type] ?? row.type}
              </td>
              <td className="max-w-md px-4 py-3 text-muted-foreground">
                {row.message ? (
                  <span className="line-clamp-3 whitespace-pre-wrap">
                    {row.message}
                  </span>
                ) : (
                  <span className="opacity-60">—</span>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className={cn(row.overdue && "font-semibold text-destructive")}>
                  {row.ageDays}d
                </span>
                {row.overdue && (
                  <span className="ml-1.5 text-xs text-destructive">overdue</span>
                )}
              </td>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                    STATUS_STYLES[row.status] ?? "bg-muted",
                  )}
                >
                  {row.status}
                </span>
              </td>
              <td className="px-4 py-3">
                {row.status === "PENDING" ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={pendingId === row.id}
                      onClick={() => update(row.id, "DONE")}
                      className={cn(
                        buttonVariants({ size: "sm" }),
                        "disabled:opacity-60",
                      )}
                    >
                      Done
                    </button>
                    <button
                      type="button"
                      disabled={pendingId === row.id}
                      onClick={() => update(row.id, "REJECTED")}
                      className={cn(
                        buttonVariants({ size: "sm", variant: "outline" }),
                        "disabled:opacity-60",
                      )}
                    >
                      Reject
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
