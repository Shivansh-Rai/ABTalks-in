import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AdminSparkline } from "@/components/admin/admin-sparkline";

type Accent = "green" | "orange" | "blue";

const accentBorder: Record<Accent, string> = {
  green: "border-t-[#18D39B]",
  orange: "border-t-[#03535F]",
  blue: "border-t-[#03535F]",
};

const accentIconBg: Record<Accent, string> = {
  green: "bg-[#18D39B]/10 text-[#197E23]",
  orange: "bg-[#E7F2F3] text-[#03535F]",
  blue: "bg-[#03535F]/10 text-[#03535F]",
};

type StatCardProps = {
  label: string;
  value: number | string;
  delta?: number | null;
  deltaSuffix?: string;
  accent: Accent;
  icon: ReactNode;
  series?: number[];
};

export function StatCard({
  label,
  value,
  delta,
  deltaSuffix = "this week",
  accent,
  icon,
  series,
}: StatCardProps) {
  const deltaPositive = delta != null && delta >= 0;
  const showDelta = delta != null;

  return (
    <div
      className={cn(
        "relative rounded-xl border border-t-2 bg-card p-5 shadow-[var(--shadow-card)]",
        accentBorder[accent],
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="flex items-center gap-2">
          {series && series.length >= 2 ? (
            <AdminSparkline data={series} positive={deltaPositive} />
          ) : null}
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              accentIconBg[accent],
            )}
          >
            {icon}
          </div>
        </div>
      </div>
      <p className="mt-2 text-3xl font-bold">{value}</p>
      {showDelta ? (
        <p
          className={cn(
            "mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
            deltaPositive
              ? "bg-[#18D39B]/10 text-[#197E23]"
              : "bg-[#D92D20]/10 text-[#D92D20]",
          )}
        >
          {deltaPositive ? "+" : ""}
          {delta} {deltaSuffix}
        </p>
      ) : null}
    </div>
  );
}
