import type { Prisma } from "@prisma/client";
import { PROGRAM_MEMBER_START_DAY } from "./constants";

const WAIVED_DAYS = Array.from(
  { length: PROGRAM_MEMBER_START_DAY - 1 },
  (_, i) => i + 1,
);

async function recomputeTotalScore(
  tx: Prisma.TransactionClient,
  memberId: string,
): Promise<void> {
  const member = await tx.programMember.findUnique({
    where: { id: memberId },
    select: {
      missionPoints: true,
      conceptPoints: true,
      commitPoints: true,
      projectPoints: true,
    },
  });
  if (!member) return;
  await tx.programMember.update({
    where: { id: memberId },
    data: {
      totalScore:
        member.missionPoints +
        member.conceptPoints +
        member.commitPoints +
        member.projectPoints,
    },
  });
}

/**
 * Idempotent: waive days 1..(START-1) as PASSED, unlock START day,
 * award mission points only for newly created waived rows.
 *
 * Uses batched queries (no per-day round-trips) so Neon pooler
 * interactive transactions do not hit P2028 timeouts.
 */
export async function bootstrapMemberStartDay(
  tx: Prisma.TransactionClient,
  memberId: string,
): Promise<void> {
  const member = await tx.programMember.findUnique({
    where: { id: memberId },
    select: { id: true, highestUnlockedDay: true },
  });
  if (!member) return;

  const existingPassed = await tx.programMissionSubmission.findMany({
    where: {
      memberId,
      dayNumber: { in: WAIVED_DAYS },
      passed: true,
    },
    select: { dayNumber: true },
  });
  const passedSet = new Set(existingPassed.map((s) => s.dayNumber));
  const missingDays = WAIVED_DAYS.filter((d) => !passedSet.has(d));

  if (
    missingDays.length === 0 &&
    member.highestUnlockedDay >= PROGRAM_MEMBER_START_DAY
  ) {
    return;
  }

  let pointsAdded = 0;
  let cleanPassesAdded = 0;

  if (missingDays.length > 0) {
    const [days, existingAttempts] = await Promise.all([
      tx.programDay.findMany({
        where: { dayNumber: { in: missingDays } },
        select: { dayNumber: true, missionPoints: true },
      }),
      tx.programMissionSubmission.findMany({
        where: { memberId, dayNumber: { in: missingDays } },
        select: { dayNumber: true, attemptNumber: true },
      }),
    ]);

    const pointsByDay = new Map(
      days.map((d) => [d.dayNumber, d.missionPoints]),
    );
    const maxAttemptByDay = new Map<number, number>();
    for (const row of existingAttempts) {
      const prev = maxAttemptByDay.get(row.dayNumber) ?? 0;
      if (row.attemptNumber > prev) {
        maxAttemptByDay.set(row.dayNumber, row.attemptNumber);
      }
    }

    const rows = missingDays.map((dayNumber) => {
      const missionPoints = pointsByDay.get(dayNumber) ?? 0;
      const priorAttempts = maxAttemptByDay.get(dayNumber) ?? 0;
      pointsAdded += missionPoints;
      if (priorAttempts === 0) cleanPassesAdded += 1;
      return {
        memberId,
        dayNumber,
        attemptNumber: priorAttempts + 1,
        passed: true,
        pointsAwarded: missionPoints,
        payload: {
          waived: true,
          reason: "cohort_start_day",
        },
        verdict: [
          {
            check: "waived",
            passed: true,
            detail: "Marked complete at enrollment",
          },
        ],
      };
    });

    await tx.programMissionSubmission.createMany({ data: rows });
  }

  const nextUnlocked = Math.max(
    member.highestUnlockedDay,
    PROGRAM_MEMBER_START_DAY,
  );

  await tx.programMember.update({
    where: { id: memberId },
    data: {
      highestUnlockedDay: nextUnlocked,
      ...(pointsAdded > 0
        ? { missionPoints: { increment: pointsAdded } }
        : {}),
      ...(cleanPassesAdded > 0
        ? { cleanPassCount: { increment: cleanPassesAdded } }
        : {}),
    },
  });

  if (pointsAdded > 0 || nextUnlocked !== member.highestUnlockedDay) {
    await recomputeTotalScore(tx, memberId);
  }
}
