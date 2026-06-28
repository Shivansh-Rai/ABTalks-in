import { SubmissionStatus, type Prisma } from "@prisma/client";

export async function computeStreakStats(
  tx: Prisma.TransactionClient,
  input: {
    enrollmentId: string;
    endDay: number;
  },
): Promise<{ currentStreak: number; longestStreak: number }> {
  const endDay = Math.max(1, Math.min(input.endDay, 60));
  const submissions = await tx.submission.findMany({
    where: {
      enrollmentId: input.enrollmentId,
      dayNumber: { gte: 1, lte: endDay },
      status: SubmissionStatus.ON_TIME,
    },
    select: { dayNumber: true },
  });
  const onTimeDays = new Set<number>(submissions.map((s) => s.dayNumber));

  // Streak ends on today when submitted, otherwise yesterday (grace until today's task is due).
  let streakAnchor = endDay;
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
  for (let day = 1; day <= endDay; day++) {
    if (onTimeDays.has(day)) {
      running += 1;
      if (running > longestStreak) longestStreak = running;
      continue;
    }
    running = 0;
  }

  return { currentStreak, longestStreak };
}
