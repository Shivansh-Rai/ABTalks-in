import "server-only";
import type { ProgramLanguage, ProgramMissionType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { deriveDayState, type DayState } from "@/features/program/progression";
import { isDayLockBypassEnabled } from "@/lib/feature-flags";

export type { DayState } from "@/features/program/progression";

export type DayVideo = {
  id: string;
  order: number;
  title: string;
  youtubeId: string;
  durationMin: number | null;
};

// NOTE: missionSpec is deliberately excluded from every select in this file
// (roadmap §9.8 — it is server-only and must never reach the client).
export type DayShell = {
  id: string;
  dayNumber: number;
  title: string;
  missionType: ProgramMissionType;
  briefMd: string;
  assetsJson: Prisma.JsonValue | null;
  starterCode: string | null;
  language: ProgramLanguage | null;
  objectives: string[];
  tools: string[];
  estimatedMin: number;
  missionPoints: number;
  isProjectDay: boolean;
  module: { number: number; title: string; color: string };
  videos: DayVideo[];
};

export type DayShellResult = { day: DayShell; state: DayState };

function isSkippedPayload(payload: unknown): boolean {
  return (
    !!payload &&
    typeof payload === "object" &&
    (payload as { skipped?: unknown }).skipped === true
  );
}

export async function getDayShell(
  memberId: string,
  dayNumber: number,
): Promise<DayShellResult | null> {
  const day = await prisma.programDay.findUnique({
    where: { dayNumber },
    select: {
      id: true,
      dayNumber: true,
      title: true,
      missionType: true,
      briefMd: true,
      assetsJson: true,
      starterCode: true,
      language: true,
      objectives: true,
      tools: true,
      estimatedMin: true,
      missionPoints: true,
      isProjectDay: true,
      module: { select: { number: true, title: true, color: true } },
      videos: {
        select: {
          id: true,
          order: true,
          title: true,
          youtubeId: true,
          durationMin: true,
        },
        orderBy: { order: "asc" },
      },
    },
  });
  if (!day) return null;

  const member = await prisma.programMember.findUnique({
    where: { id: memberId },
    select: { highestUnlockedDay: true },
  });
  if (!member) return null;

  const submissions = await prisma.programMissionSubmission.findMany({
    where: { memberId, dayNumber },
    select: { passed: true, payload: true },
  });

  const passedDays = new Set<number>();
  const skippedDays = new Set<number>();
  for (const row of submissions) {
    if (row.passed) passedDays.add(dayNumber);
    else if (isSkippedPayload(row.payload)) skippedDays.add(dayNumber);
  }

  const state = deriveDayState(
    dayNumber,
    member.highestUnlockedDay,
    passedDays,
    skippedDays,
    isDayLockBypassEnabled(),
  );

  return { day, state };
}
