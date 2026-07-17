import "server-only";
import type { ProgramMissionType } from "@prisma/client";
import { differenceInCalendarDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { prisma } from "@/lib/db";
import { IST, parseCalendarKeyToUtcDate } from "@/lib/date-utils";
import { isDayLockBypassEnabled } from "@/lib/feature-flags";
import { PROGRAM_TOTAL_DAYS } from "@/features/program/constants";

export type DayState = "LOCKED" | "AVAILABLE" | "PASSED" | "SKIPPED";

export type CurriculumModule = {
  number: number;
  title: string;
  subtitle: string;
  color: string;
  startDay: number;
  endDay: number;
};

export type CurriculumDay = {
  dayNumber: number;
  title: string;
  missionType: ProgramMissionType;
  isProjectDay: boolean;
  moduleNumber: number;
  state: DayState;
};

function isSkippedPayload(payload: unknown): boolean {
  return (
    !!payload &&
    typeof payload === "object" &&
    (payload as { skipped?: unknown }).skipped === true
  );
}

export function deriveDayState(
  dayNumber: number,
  highestUnlockedDay: number,
  passedDays: Set<number>,
  skippedDays: Set<number>,
  bypassLocks = false,
): DayState {
  if (passedDays.has(dayNumber)) return "PASSED";
  if (skippedDays.has(dayNumber)) return "SKIPPED";
  if (bypassLocks || dayNumber <= highestUnlockedDay) return "AVAILABLE";
  return "LOCKED";
}

/** IST calendar days since cohort `startsAt`, clamped 1..PROGRAM_TOTAL_DAYS. */
export function getCohortCalendarDay(cohort: { startsAt: Date }): number {
  const startKey = formatInTimeZone(cohort.startsAt, IST, "yyyy-MM-dd");
  const nowKey = formatInTimeZone(new Date(), IST, "yyyy-MM-dd");
  const startUtc = parseCalendarKeyToUtcDate(startKey);
  const nowUtc = parseCalendarKeyToUtcDate(nowKey);
  const diff = differenceInCalendarDays(nowUtc, startUtc);
  return Math.min(PROGRAM_TOTAL_DAYS, Math.max(1, diff + 1));
}

export function isCohortFrozen(cohort: { endsAt: Date }): boolean {
  return new Date() > cohort.endsAt;
}

export async function getMemberDayStates(
  memberId: string,
): Promise<{ modules: CurriculumModule[]; days: CurriculumDay[] }> {
  const member = await prisma.programMember.findUnique({
    where: { id: memberId },
    select: { highestUnlockedDay: true },
  });
  const highestUnlockedDay = member?.highestUnlockedDay ?? 1;

  const [modules, days, submissions] = await Promise.all([
    prisma.programModule.findMany({
      orderBy: { number: "asc" },
      select: {
        number: true,
        title: true,
        subtitle: true,
        color: true,
        startDay: true,
        endDay: true,
      },
    }),
    prisma.programDay.findMany({
      orderBy: { dayNumber: "asc" },
      select: {
        dayNumber: true,
        title: true,
        missionType: true,
        isProjectDay: true,
        module: { select: { number: true } },
      },
    }),
    prisma.programMissionSubmission.findMany({
      where: { memberId },
      select: { dayNumber: true, passed: true, payload: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const passedDays = new Set<number>();
  const skippedDays = new Set<number>();
  for (const row of submissions) {
    if (row.passed) passedDays.add(row.dayNumber);
    else if (isSkippedPayload(row.payload)) skippedDays.add(row.dayNumber);
  }

  const dayStates: CurriculumDay[] = days.map((d) => ({
    dayNumber: d.dayNumber,
    title: d.title,
    missionType: d.missionType,
    isProjectDay: d.isProjectDay,
    moduleNumber: d.module.number,
    state: deriveDayState(
      d.dayNumber,
      highestUnlockedDay,
      passedDays,
      skippedDays,
      isDayLockBypassEnabled(),
    ),
  }));

  return { modules, days: dayStates };
}

/** Current module number from the member's highest unlocked day. */
export async function getMemberCurrentModuleNumber(
  memberId: string,
): Promise<number> {
  const member = await prisma.programMember.findUnique({
    where: { id: memberId },
    select: { highestUnlockedDay: true },
  });
  const dayNumber = member?.highestUnlockedDay ?? 1;
  const day = await prisma.programDay.findUnique({
    where: { dayNumber },
    select: { module: { select: { number: true } } },
  });
  return day?.module.number ?? 1;
}
