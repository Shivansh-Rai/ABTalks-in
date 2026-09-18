import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Plan 154. Compact KPI tiles rendered inside the Platform Activity section
 * of `/admin`. Different visual style from the top-row StatCard by design —
 * these are "the second thing an admin looks at", so they read as a supporting
 * grid rather than another row of heroes.
 *
 * Every tile shows: label, integer value, and optionally a period-over-period
 * delta chip. Green for a positive change on a higher-is-better metric,
 * red for negative; both muted so the row does not look like a Christmas tree.
 */

type Tile = {
  label: string;
  value: number | string;
  delta?: number | null;
  hint?: string;
  icon?: ReactNode;
};

export function PlatformActivityKpis({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="rounded-lg border border-[#E9E9E9] bg-[#FAFAFA] p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#787878]">
              {tile.label}
            </p>
            {tile.icon ? (
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-white text-[#03535F]">
                {tile.icon}
              </span>
            ) : null}
          </div>
          <p className="mt-1.5 text-xl font-bold text-[#0F1720]">
            {typeof tile.value === "number"
              ? tile.value.toLocaleString()
              : tile.value}
          </p>
          <div className="mt-1 flex items-center gap-2">
            {typeof tile.delta === "number" && Number.isFinite(tile.delta) ? (
              <span
                className={cn(
                  "inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  tile.delta > 0 &&
                    "bg-[#18D39B]/10 text-[#197E23]",
                  tile.delta < 0 &&
                    "bg-[#D92D20]/10 text-[#D92D20]",
                  tile.delta === 0 && "bg-muted text-muted-foreground",
                )}
              >
                {tile.delta > 0 ? "+" : ""}
                {tile.delta}
              </span>
            ) : null}
            {tile.hint ? (
              <span className="text-[11px] text-[#787878]">{tile.hint}</span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
