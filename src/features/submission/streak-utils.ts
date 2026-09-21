import { AttemptLateness, SubmissionStatus, type Prisma } from "@prisma/client";
import { peIdForEnrollment } from "@/repositories/ids";

type Tx = Prisma.TransactionClient;

export function computeTrackStreakFromOnTimeDays(
  onTimeDays: Set<number>,
  endDay: number,
): { currentStreak: number; longestStreak: number } {
  const cappedEnd = Math.max(1, Math.min(endDay, 60));

  let streakAnchor = cappedEnd;
  if (!onTimeDays.has(streakAnchor) && streakAnchor > 1) {
    streakAnchor -= 1;
  }

  let currentStreak = 0;
  for (let day = streakAnchor; day >= 1; day--) {
    if (onTimeDays.has(day)) {
      currentStreak += 1;
      continue;
    }
    break;
  }

  let longestStreak = 0;
  let running = 0;
  for (let day = 1; day <= cappedEnd; day++) {
    if (onTimeDays.has(day)) {
      running += 1;
      if (running > longestStreak) longestStreak = running;
      continue;
    }
    running = 0;
  }

  return { currentStreak, longestStreak };
}

export type CanonicalChallengeDayRow = {
  dayNumber: number;
  lateness: AttemptLateness | null;
};

export async function listCanonicalChallengeDays(
  tx: Tx,
  enrollmentId: string,
): Promise<CanonicalChallengeDayRow[]> {
  const rows = await tx.activityAttempt.findMany({
    where: {
      enrollmentId: peIdForEnrollment(enrollmentId),
      id: { startsWith: "aa_sub_" },
      activityId: { startsWith: "act_dt_" },
    },
    select: {
      lateness: true,
      activity: { select: { dayNumber: true } },
    },
  });
  return rows.flatMap((row) => {
    const dayNumber = row.activity.dayNumber;
    if (dayNumber == null) return [];
    return [{ dayNumber, lateness: row.lateness }];
  });
}

export function daysCompletedFromCanonical(
  rows: CanonicalChallengeDayRow[],
): { daysCompleted: number; lastSubmittedDay: number | null } {
  let lastSubmittedDay: number | null = null;
  const days = new Set<number>();
  for (const row of rows) {
    days.add(row.dayNumber);
    if (lastSubmittedDay == null || row.dayNumber > lastSubmittedDay) {
      lastSubmittedDay = row.dayNumber;
    }
  }
  return { daysCompleted: days.size, lastSubmittedDay };
}

export async function computeStreakStats(
  tx: Tx,
  input: {
    enrollmentId: string;
    endDay: number;
  },
): Promise<{ currentStreak: number; longestStreak: number }> {
  const rows = await listCanonicalChallengeDays(tx, input.enrollmentId);
  const cappedEnd = Math.max(1, Math.min(input.endDay, 60));
  const onTimeDays = new Set<number>();
  for (const row of rows) {
    if (row.dayNumber < 1 || row.dayNumber > cappedEnd) continue;
    if (row.lateness === AttemptLateness.ON_TIME) onTimeDays.add(row.dayNumber);
  }
  return computeTrackStreakFromOnTimeDays(onTimeDays, input.endDay);
}

/** Legacy Submission ON_TIME day set — tests/recon only. */
export async function computeStreakStatsFromSubmissions(
  tx: Tx,
  input: {
    enrollmentId: string;
    endDay: number;
  },
): Promise<{ currentStreak: number; longestStreak: number }> {
  const submissions = await tx.submission.findMany({
    where: {
      enrollmentId: input.enrollmentId,
      dayNumber: { gte: 1, lte: Math.max(1, Math.min(input.endDay, 60)) },
      status: SubmissionStatus.ON_TIME,
    },
    select: { dayNumber: true },
  });
  return computeTrackStreakFromOnTimeDays(
    new Set<number>(submissions.map((s) => s.dayNumber)),
    input.endDay,
  );
}
