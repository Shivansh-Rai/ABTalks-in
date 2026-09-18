import Link from "next/link";
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
 *
 * `href` makes the tile a link. When set, the whole card is clickable and
 * gets a hover treatment — used for jumping from the overview grid into the
 * deep analytics view (`/admin/analytics`, `/admin/jobs`, etc.).
 */

type Tile = {
  label: string;
  value: number | string;
  delta?: number | null;
  hint?: string;
  icon?: ReactNode;
  href?: string;
  /** When true, negative delta reads as good (e.g. bounce rate). */
  invertDelta?: boolean;
};

export function PlatformActivityKpis({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tiles.map((tile) => (
        <TileCard key={tile.label} tile={tile} />
      ))}
    </div>
  );
}

function TileCard({ tile }: { tile: Tile }) {
  const cardClass = cn(
    "block rounded-lg border border-[#E9E9E9] bg-[#FAFAFA] p-3 transition-colors",
    tile.href && "hover:border-[#03535F]/40 hover:bg-[#EEF6F6]",
  );

  const inner = (
    <>
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
        <DeltaChip delta={tile.delta} invert={tile.invertDelta} />
        {tile.hint ? (
          <span className="text-[11px] text-[#787878]">{tile.hint}</span>
        ) : null}
      </div>
    </>
  );

  if (tile.href) {
    return (
      <Link href={tile.href} className={cardClass}>
        {inner}
      </Link>
    );
  }
  return <div className={cardClass}>{inner}</div>;
}

function DeltaChip({
  delta,
  invert = false,
}: {
  delta: number | null | undefined;
  invert?: boolean;
}) {
  if (typeof delta !== "number" || !Number.isFinite(delta)) return null;
  const positive = invert ? delta < 0 : delta > 0;
  const negative = invert ? delta > 0 : delta < 0;
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
        positive && "bg-[#18D39B]/10 text-[#197E23]",
        negative && "bg-[#D92D20]/10 text-[#D92D20]",
        !positive && !negative && "bg-muted text-muted-foreground",
      )}
    >
      {delta > 0 ? "+" : ""}
      {delta}
    </span>
  );
}
