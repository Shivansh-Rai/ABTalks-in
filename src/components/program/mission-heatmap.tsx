"use client";

import { cn } from "@/lib/utils";

export type MissionHeatmapCell = { dayNumber: number; completed: boolean };

type Props = {
  cells: MissionHeatmapCell[];
  /** Dashboard uses larger circles; talent profile uses compact grid. */
  variant?: "dashboard" | "compact";
};

function cellClass(completed: boolean, variant: "dashboard" | "compact"): string {
  if (completed) {
    return variant === "dashboard" ? "bg-[#27CA37]" : "bg-[#18D39B]";
  }
  return variant === "dashboard"
    ? "bg-[#353535] border border-[#03535F]"
    : "bg-muted";
}

export function MissionHeatmap({ cells, variant = "dashboard" }: Props) {
  const isDashboard = variant === "dashboard";

  return (
    <div className="space-y-3">
      <div
        className={cn(
          isDashboard
            ? "grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10 md:gap-2.5"
            : "flex flex-wrap gap-1",
        )}
        aria-label="31-day mission progress heatmap"
      >
        {cells.map((cell) => (
          <div
            key={cell.dayNumber}
            title={`Day ${cell.dayNumber}: ${cell.completed ? "Complete" : "Incomplete"}`}
            className={cn(
              cellClass(cell.completed, variant),
              isDashboard
                ? "aspect-square w-full max-w-[36px] justify-self-center rounded-full transition-transform duration-200 ease-out hover:z-10 hover:scale-105"
                : "size-3 rounded-sm sm:size-3.5",
            )}
          />
        ))}
      </div>
      <div
        className={cn(
          "inline-flex items-center gap-2 text-xs",
          isDashboard
            ? "rounded-[8px] border border-[#03535F] bg-[#000000] px-3 py-1.5 text-[#E9E9E9] transition-colors duration-300 ease-out hover:border-[#E7F2F3]/70"
            : "text-muted-foreground",
        )}
      >
        <span>Incomplete</span>
        <span
          className={cn(
            isDashboard ? "size-3.5 rounded-full sm:size-4" : "size-3 rounded-sm sm:size-3.5",
            isDashboard ? "bg-[#353535] border border-[#03535F]" : "bg-muted",
          )}
        />
        <span>Complete</span>
        <span
          className={cn(
            isDashboard ? "size-3.5 rounded-full sm:size-4" : "size-3 rounded-sm sm:size-3.5",
            isDashboard ? "bg-[#27CA37]" : "bg-[#18D39B]",
          )}
        />
      </div>
    </div>
  );
}
