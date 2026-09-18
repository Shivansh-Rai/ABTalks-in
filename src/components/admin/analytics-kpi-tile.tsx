"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDeltaPct } from "@/lib/analytics/format";

/**
 * Plan 151 — KPI tile for the admin GA traffic section.
 *
 * Label + a big value + an optional period-over-period delta chip + an
 * optional single-metric sparkline. Every non-value part is optional so the
 * same component can render both "hero" tiles (with delta + spark) and plain
 * ratio tiles (engagement rate, bounce rate).
 *
 * The sparkline is deliberately narrow and axis-less — a shape, not a chart.
 */
export function AnalyticsKpiTile({
  label,
  value,
  delta,
  invertDelta = false,
  suffix,
  hint,
  sparkline,
}: {
  label: string;
  value: number | string;
  delta?: number | null;
  invertDelta?: boolean;
  suffix?: string;
  hint?: string;
  sparkline?: Array<{ v: number }>;
}) {
  const deltaLabel = formatDeltaPct(delta);
  const positive = deltaLabel && (delta as number) > 0;
  const negative = deltaLabel && (delta as number) < 0;
  const goodDirection = invertDelta ? negative : positive;
  const badDirection = invertDelta ? positive : negative;

  const rendered = typeof value === "number" ? value.toLocaleString() : value;

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-1 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          {deltaLabel && (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                goodDirection &&
                  "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
                badDirection &&
                  "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
                !goodDirection &&
                  !badDirection &&
                  "bg-muted text-muted-foreground",
              )}
            >
              {deltaLabel}
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold tracking-tight md:text-[1.75rem]">
            {rendered}
          </span>
          {suffix && (
            <span className="text-sm text-muted-foreground">{suffix}</span>
          )}
        </div>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        {sparkline && sparkline.length > 1 && (
          <div className="mt-2 h-8">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkline}>
                <defs>
                  <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#03535F" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#03535F" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="#03535F"
                  strokeWidth={1.5}
                  fill="url(#spark)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
