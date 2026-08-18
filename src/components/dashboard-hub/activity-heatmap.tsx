"use client";

import { useEffect, useRef, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { IST, parseCalendarKeyToUtcDate } from "@/lib/date-utils";
import {
  HEATMAP_MONTHS,
  type ActivityCell,
} from "@/features/dashboard/get-activity-heatmap";
import { cn } from "@/lib/utils";

const LEVEL_CLASS: Record<ActivityCell["level"], string> = {
  0: "bg-neutral-100",
  1: "bg-emerald-200",
  2: "bg-emerald-400",
  3: "bg-emerald-600",
  4: "bg-emerald-800",
};

const ROW_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""];

type ActivityHeatmapProps = {
  cells: ActivityCell[];
  embedded?: boolean;
};

function formatTooltipDate(dateKey: string): string {
  const d = parseCalendarKeyToUtcDate(dateKey);
  return formatInTimeZone(d, IST, "d MMM yyyy");
}

function monthLabelForColumn(
  cells: ActivityCell[],
  colIndex: number,
): string | null {
  const firstRowCell = cells[colIndex * 7];
  if (!firstRowCell) return null;
  const month = formatInTimeZone(
    parseCalendarKeyToUtcDate(firstRowCell.date),
    IST,
    "MMM",
  );
  if (colIndex === 0) return month;
  const prevColCell = cells[(colIndex - 1) * 7];
  if (!prevColCell) return month;
  const prevMonth = formatInTimeZone(
    parseCalendarKeyToUtcDate(prevColCell.date),
    IST,
    "MMM",
  );
  return month !== prevMonth ? month : null;
}

const CELL_CLASS =
  "rounded-[2px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-400";

function HeatmapCell({
  cell,
  className,
  onHover,
  onLeave,
}: {
  cell: ActivityCell | null;
  className?: string;
  onHover: (count: number, date: string) => void;
  onLeave: () => void;
}) {
  if (!cell) {
    return <span className={className} aria-hidden />;
  }
  const label =
    cell.count === 0
      ? `No submissions on ${formatTooltipDate(cell.date)}`
      : `${cell.count} submission${cell.count === 1 ? "" : "s"} on ${formatTooltipDate(cell.date)}`;
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(CELL_CLASS, LEVEL_CLASS[cell.level], className)}
      onMouseEnter={() => onHover(cell.count, cell.date)}
      onMouseLeave={onLeave}
      onFocus={() => onHover(cell.count, cell.date)}
      onBlur={onLeave}
    />
  );
}

export function ActivityHeatmap({ cells, embedded = false }: ActivityHeatmapProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{
    count: number;
    date: string;
  } | null>(null);

  const weekCount = Math.ceil(cells.length / 7);
  const gridCols = `1.75rem repeat(${weekCount}, minmax(0, 1fr))`;

  const setTooltipFromCell = (count: number, date: string) =>
    setTooltip({ count, date });
  const clearTooltip = () => setTooltip(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (window.matchMedia("(min-width: 1024px)").matches) return;
    el.scrollLeft = el.scrollWidth;
  }, [cells]);

  const Wrapper = embedded ? "div" : "section";
  const wrapperClass = embedded
    ? "w-full min-h-[350px] flex flex-col"
    : "scroll-mt-20 px-4 py-8 sm:px-6";

  return (
    <Wrapper className={wrapperClass}>
      <h2
        className={cn(
          "font-display font-semibold text-[#e05226]",
          embedded ? "text-base" : "text-xl",
        )}
      >
        Last {HEATMAP_MONTHS} months activity
      </h2>

      {/* Mobile: fixed-size cells + horizontal scroll */}
      <div
        className={cn(
          "mt-3 overflow-x-auto lg:hidden",
          embedded && "flex-1 min-h-0",
        )}
        ref={scrollRef}
      >
        <div className="flex w-max gap-[3px]">
          <div className="flex w-7 shrink-0 flex-col gap-[3px] pt-4">
            <span className="h-4 shrink-0" aria-hidden />
            {ROW_LABELS.map((label, i) => (
              <span
                key={i}
                className="flex h-[11px] items-center text-[10px] text-neutral-400"
              >
                {label}
              </span>
            ))}
          </div>
          <div className="flex gap-[3px]">
            {Array.from({ length: weekCount }, (_, col) => {
              const monthLabel = monthLabelForColumn(cells, col);
              const weekCells = cells.slice(col * 7, col * 7 + 7);
              return (
                <div key={col} className="flex shrink-0 flex-col gap-[3px]">
                  <span className="h-4 shrink-0 text-[10px] text-neutral-400">
                    {monthLabel ?? ""}
                  </span>
                  {weekCells.map((cell) => (
                    <HeatmapCell
                      key={cell.date}
                      cell={cell}
                      className="size-[11px] shrink-0"
                      onHover={setTooltipFromCell}
                      onLeave={clearTooltip}
                    />
                  ))}
                  {weekCells.length < 7
                    ? Array.from({ length: 7 - weekCells.length }, (_, i) => (
                        <span
                          key={`pad-${col}-${i}`}
                          className="size-[11px] shrink-0"
                          aria-hidden
                        />
                      ))
                    : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Desktop: fluid square cells, full width, no scroll */}
      <div
        className={cn(
          "mt-3 hidden w-full gap-[3px] lg:grid",
          embedded && "flex-1 min-h-0",
        )}
        style={{ gridTemplateColumns: gridCols }}
      >
        <span className="h-4" aria-hidden />
        {Array.from({ length: weekCount }, (_, col) => (
          <span
            key={`month-${col}`}
            className="h-4 text-[10px] leading-4 text-neutral-400"
          >
            {monthLabelForColumn(cells, col) ?? ""}
          </span>
        ))}

        {ROW_LABELS.map((label, rowIdx) => (
          <div key={`row-${rowIdx}`} className="contents">
            <span className="flex items-center text-[10px] text-neutral-400">
              {label}
            </span>
            {Array.from({ length: weekCount }, (_, col) => {
              const cell = cells[col * 7 + rowIdx] ?? null;
              return (
                <HeatmapCell
                  key={cell?.date ?? `empty-${col}-${rowIdx}`}
                  cell={cell}
                  className="aspect-square w-full min-w-0"
                  onHover={setTooltipFromCell}
                  onLeave={clearTooltip}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-4">
        {tooltip ? (
          <p className="text-xs text-[#555555]">
            {tooltip.count === 0
              ? `No submissions on ${formatTooltipDate(tooltip.date)}`
              : `${tooltip.count} submission${tooltip.count === 1 ? "" : "s"} on ${formatTooltipDate(tooltip.date)}`}
          </p>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1 text-[10px] text-neutral-400">
          <span>Less</span>
          {([0, 1, 2, 3, 4] as const).map((level) => (
            <span
              key={level}
              className={cn("size-[11px] rounded-[2px]", LEVEL_CLASS[level])}
              aria-hidden
            />
          ))}
          <span>More</span>
        </div>
      </div>
    </Wrapper>
  );
}
