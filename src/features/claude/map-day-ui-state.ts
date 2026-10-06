import type { HeatmapCell } from "@/features/dashboard/get-heatmap-data";

export type ClaudeDayUiState =
  | "completed"
  | "available"
  | "locked"
  | "window_closed";

export function mapHeatmapCellToUiState(
  cell: HeatmapCell,
  currentDay: number,
): ClaudeDayUiState {
  if (cell.status === "on_time" || cell.status === "late") {
    return "completed";
  }
  if (cell.dayNumber > currentDay) {
    return "locked";
  }
  // Today with no submission is heatmap "future". After the 60-day window,
  // capped currentDay stays 60 but that day is "missed" (not future) — do not
  // treat bare dayNumber === currentDay as submittable or Day 60 stays open forever.
  if (cell.status === "future" && cell.dayNumber === currentDay) {
    return "available";
  }
  if (cell.isRelaxable || cell.status === "rejected") {
    return "available";
  }
  return "window_closed";
}
