"use client";

import { formatInTimeZone } from "date-fns-tz";
import { cn } from "@/lib/utils";

type Cell = { dateIso: string; count: number };

const IST = "Asia/Kolkata";

function formatTooltip(dateIso: string, count: number): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const label = formatInTimeZone(
    new Date(Date.UTC(y!, m! - 1, d!)),
    IST,
    "d MMM yyyy",
  );
  if (count === 0) return `${label}: no commits`;
  return `${label}: ${count} commit${count === 1 ? "" : "s"}`;
}

function cellColor(count: number): string {
  if (count === 0) return "bg-muted";
  if (count === 1) return "bg-emerald-400/70";
  if (count <= 3) return "bg-emerald-500";
  return "bg-emerald-600";
}

export function CommitHeatmap({ cells }: { cells: Cell[] }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1" aria-label="31-day commit heatmap">
        {cells.map((cell) => (
          <div
            key={cell.dateIso}
            title={formatTooltip(cell.dateIso, cell.count)}
            className={cn(
              "size-3 rounded-sm sm:size-3.5",
              cellColor(cell.count),
            )}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Less</span>
        <div className="size-3 rounded-sm bg-muted" />
        <div className="size-3 rounded-sm bg-emerald-400/70" />
        <div className="size-3 rounded-sm bg-emerald-500" />
        <div className="size-3 rounded-sm bg-emerald-600" />
        <span>More</span>
      </div>
    </div>
  );
}
