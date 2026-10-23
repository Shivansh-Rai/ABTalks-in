import { addCalendarDaysToKey } from "@/lib/date-utils";

/** Consecutive-day milestones that earn a Consistency badge. */
export const CONSISTENCY_MILESTONES = [30, 60, 100] as const;
export type ConsistencyMilestone = (typeof CONSISTENCY_MILESTONES)[number];

/**
 * For each milestone, the first IST day on which a run of consecutive active
 * days reached it. Uses the same day rule as the dashboard streak card
 * (`computeActivityStreak`): a day counts when it has any submission, and
 * future days never count. Once reached, a milestone stays reached even if the
 * run later breaks.
 *
 * Pure: `dayKeys` are "yyyy-MM-dd" IST keys, duplicates allowed.
 */
export function consistencyMilestonesReached(
  dayKeys: Iterable<string>,
  todayKey: string,
): { milestone: ConsistencyMilestone; reachedOn: string }[] {
  const sorted = [...new Set(dayKeys)].filter((k) => k <= todayKey).sort();
  const out: { milestone: ConsistencyMilestone; reachedOn: string }[] = [];
  const pending: ConsistencyMilestone[] = [...CONSISTENCY_MILESTONES];

  let run = 0;
  let prev: string | null = null;
  for (const key of sorted) {
    run = prev !== null && key === addCalendarDaysToKey(prev, 1) ? run + 1 : 1;
    prev = key;
    while (pending.length > 0 && run >= pending[0]!) {
      out.push({ milestone: pending.shift()!, reachedOn: key });
    }
    if (pending.length === 0) break;
  }
  return out;
}
