/**
 * Day unlock rules for coding practice. Pure: no database, no clock of its own.
 *
 *  - Day 1 opens at enrolment.
 *  - A day is complete when every question in it has an accepted submission.
 *  - Day N's date is the enrolment date + (N - 1) days, in PRACTICE_TZ. It
 *    becomes eligible at 00:00 on that date (05:30 IST).
 *  - Day N can only be opened once Day N-1 is complete.
 *
 * A learner who falls behind can catch up: once a day's date has passed it
 * opens as soon as the day before it is complete. Nobody gets ahead of the
 * calendar.
 */
import { formatInTimeZone } from "date-fns-tz";
import { addCalendarDaysToKey } from "@/lib/date-utils";
import { PRACTICE_TZ } from "@/features/coding-practice/constants";

export type PracticeDayState =
  | "COMPLETE"
  | "OPEN"
  /** The day's date has arrived but the previous day is not complete. */
  | "LOCKED_PREVIOUS"
  /** The day's date has not arrived yet. */
  | "LOCKED_DATE";

/** The questions of one day, as Activity ids. */
export type PracticeDayActivities = { day: number; activityIds: string[] };

/** Calendar key (`yyyy-MM-dd`, PRACTICE_TZ) of the learner's Day 1. */
export function anchorKey(startedAt: Date): string {
  return formatInTimeZone(startedAt, PRACTICE_TZ, "yyyy-MM-dd");
}

/** Calendar key on which `day` becomes eligible: anchor + (day - 1). */
export function unlockKeyForDay(startedAt: Date, day: number): string {
  return addCalendarDaysToKey(anchorKey(startedAt), day - 1);
}

export function todayKey(now: Date = new Date()): string {
  return formatInTimeZone(now, PRACTICE_TZ, "yyyy-MM-dd");
}

/** True when every question of `day` is solved. A day with no content is never complete. */
export function isDayComplete(
  day: number,
  solved: ReadonlySet<string>,
  days: readonly PracticeDayActivities[],
): boolean {
  const entry = days.find((d) => d.day === day);
  if (!entry || entry.activityIds.length === 0) return false;
  return entry.activityIds.every((id) => solved.has(id));
}

export function practiceDayState(input: {
  day: number;
  startedAt: Date;
  solved: ReadonlySet<string>;
  days: readonly PracticeDayActivities[];
  now: Date;
  bypassLocks: boolean;
}): PracticeDayState {
  const { day, startedAt, solved, days, now, bypassLocks } = input;
  if (isDayComplete(day, solved, days)) return "COMPLETE";
  if (bypassLocks) return "OPEN";
  if (todayKey(now) < unlockKeyForDay(startedAt, day)) return "LOCKED_DATE";
  if (day > 1 && !isDayComplete(day - 1, solved, days)) {
    return "LOCKED_PREVIOUS";
  }
  return "OPEN";
}
