import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { PROGRAM_TOTAL_DAYS } from "@/features/program/constants";
import { deriveDayState } from "@/features/program/progression";
import { isCohortFrozen } from "@/features/program/progression";
import { isDayLockBypassEnabled } from "@/lib/feature-flags";
import {
  getHiddenTestInputs,
  getShipItHints,
  verifyMission,
  type VerdictLine,
} from "@/features/program/verify-mission";

const MAX_RUNS_PER_DAY = 30;

function checkpointModuleNumber(
  missionSpec: unknown,
  fallbackModuleNumber: number,
): number {
  if (missionSpec && typeof missionSpec === "object") {
    const n = (missionSpec as { checkpointNumber?: unknown }).checkpointNumber;
    if (typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 4) {
      return n;
    }
  }
  return fallbackModuleNumber;
}
const MIN_RUN_INTERVAL_MS = 15_000;

export type MissionState = {
  dayState: "LOCKED" | "AVAILABLE" | "PASSED" | "SKIPPED";
  skipTokensLeft: number;
  failedRunCount: number;
  canSkip: boolean;
  passed: boolean;
  runs: {
    attemptNumber: number;
    passed: boolean;
    verdict: VerdictLine[];
    createdAt: string;
  }[];
  shipItHints?: { check: string; path: string }[];
  dataRoomQuestionCount?: number;
};

export type SubmitMissionOk = {
  passed: boolean;
  verdict: VerdictLine[];
  pointsAwarded: number;
  attemptNumber: number;
  unlockedDay?: number;
  cleanPass: boolean;
};

function isSkippedPayload(payload: unknown): boolean {
  return (
    !!payload &&
    typeof payload === "object" &&
    (payload as { skipped?: unknown }).skipped === true
  );
}

function parseVerdict(json: unknown): VerdictLine[] {
  if (!Array.isArray(json)) return [];
  return json.filter(
    (v): v is VerdictLine =>
      !!v &&
      typeof v === "object" &&
      typeof (v as VerdictLine).check === "string" &&
      typeof (v as VerdictLine).passed === "boolean",
  );
}

export async function recomputeMemberScore(
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

async function getDayAvailability(
  memberId: string,
  dayNumber: number,
): Promise<
  | { ok: true; state: "AVAILABLE"; member: { id: string; cohortId: string; highestUnlockedDay: number; skipTokensUsed: number; githubRepoUrl: string; missionPoints: number; cleanPassCount: number } }
  | { ok: false; message: string }
> {
  const member = await prisma.programMember.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      cohortId: true,
      highestUnlockedDay: true,
      skipTokensUsed: true,
      githubRepoUrl: true,
      missionPoints: true,
      cleanPassCount: true,
      cohort: { select: { endsAt: true } },
    },
  });
  if (!member) return { ok: false, message: "Member not found." };

  if (isCohortFrozen(member.cohort)) {
    return { ok: false, message: "This cohort has ended — submissions are closed." };
  }

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

  if (state === "LOCKED") {
    return { ok: false, message: "This day is locked." };
  }
  if (state === "PASSED") {
    return { ok: false, message: "You already passed this mission." };
  }
  if (state === "SKIPPED") {
    return { ok: false, message: "This day was skipped." };
  }

  return { ok: true, state: "AVAILABLE", member };
}

async function checkRateLimit(
  memberId: string,
  dayNumber: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const runs = await prisma.programMissionSubmission.findMany({
    where: { memberId, dayNumber },
    select: { createdAt: true, payload: true },
    orderBy: { createdAt: "desc" },
  });

  const realRuns = runs.filter((r) => !isSkippedPayload(r.payload));
  if (realRuns.length >= MAX_RUNS_PER_DAY) {
    return { ok: false, message: "Daily run limit reached for this mission." };
  }

  const last = realRuns[0];
  if (last && Date.now() - last.createdAt.getTime() < MIN_RUN_INTERVAL_MS) {
    return { ok: false, message: "Please wait 15 seconds between runs." };
  }

  return { ok: true };
}

export async function getMissionState(
  memberId: string,
  dayNumber: number,
): Promise<MissionState | null> {
  const member = await prisma.programMember.findUnique({
    where: { id: memberId },
    select: { highestUnlockedDay: true, skipTokensUsed: true },
  });
  if (!member) return null;

  const [submissions, day] = await Promise.all([
    prisma.programMissionSubmission.findMany({
      where: { memberId, dayNumber },
      select: {
        attemptNumber: true,
        passed: true,
        verdict: true,
        payload: true,
        createdAt: true,
      },
      orderBy: { attemptNumber: "asc" },
    }),
    prisma.programDay.findUnique({
      where: { dayNumber },
      select: { missionType: true, missionSpec: true },
    }),
  ]);
  if (!day) return null;

  const passedDays = new Set<number>();
  const skippedDays = new Set<number>();
  for (const row of submissions) {
    if (row.passed) passedDays.add(dayNumber);
    else if (isSkippedPayload(row.payload)) skippedDays.add(dayNumber);
  }

  const dayState = deriveDayState(
    dayNumber,
    member.highestUnlockedDay,
    passedDays,
    skippedDays,
    isDayLockBypassEnabled(),
  );

  const failedRunCount = submissions.filter(
    (s) => !s.passed && !isSkippedPayload(s.payload),
  ).length;

  const spec = day.missionSpec as Record<string, unknown>;
  const dataRoomQuestionCount = Array.isArray(spec?.answers)
    ? spec.answers.length
    : undefined;

  return {
    dayState,
    skipTokensLeft: Math.max(0, 2 - member.skipTokensUsed),
    failedRunCount,
    canSkip:
      dayState === "AVAILABLE" &&
      member.skipTokensUsed < 2 &&
      failedRunCount >= 3,
    passed: passedDays.has(dayNumber),
    runs: submissions
      .filter((s) => !isSkippedPayload(s.payload))
      .map((s) => ({
        attemptNumber: s.attemptNumber,
        passed: s.passed,
        verdict: parseVerdict(s.verdict),
        createdAt: s.createdAt.toISOString(),
      })),
    shipItHints:
      day.missionType === "SHIP_IT" ? getShipItHints(day).checks : undefined,
    dataRoomQuestionCount,
  };
}

export async function getHiddenTestInputsForDay(
  memberId: string,
  dayNumber: number,
): Promise<
  | { ok: true; inputs: { check: string; input: string }[] }
  | { ok: false; message: string }
> {
  const avail = await getDayAvailability(memberId, dayNumber);
  if (!avail.ok) return avail;

  const day = await prisma.programDay.findUnique({
    where: { dayNumber },
    select: { missionType: true, missionSpec: true },
  });
  if (!day || day.missionType !== "CODE_SPRINT") {
    return { ok: false, message: "Hidden tests are only for Code Sprint missions." };
  }

  return { ok: true, ...getHiddenTestInputs(day) };
}

export async function submitMissionRun(
  memberId: string,
  dayNumber: number,
  payload: unknown,
): Promise<SubmitMissionOk | { ok: false; message: string }> {
  const avail = await getDayAvailability(memberId, dayNumber);
  if (!avail.ok) return avail;

  const rate = await checkRateLimit(memberId, dayNumber);
  if (!rate.ok) return rate;

  const day = await prisma.programDay.findUnique({
    where: { dayNumber },
    select: {
      dayNumber: true,
      missionType: true,
      missionSpec: true,
      missionPoints: true,
      module: { select: { number: true } },
    },
  });
  if (!day) return { ok: false, message: "Day not found." };

  const verifyResult = await verifyMission(day, payload, {
    githubRepoUrl: avail.member.githubRepoUrl,
  });

  const attemptCount = await prisma.programMissionSubmission.count({
    where: { memberId, dayNumber },
  });
  const attemptNumber = attemptCount + 1;
  const isFirstPass =
    verifyResult.passed &&
    !(await prisma.programMissionSubmission.findFirst({
      where: { memberId, dayNumber, passed: true },
      select: { id: true },
    }));

  let pointsAwarded = 0;
  let unlockedDay: number | undefined;
  const cleanPass = verifyResult.passed && attemptNumber === 1;

  await prisma.$transaction(async (tx) => {
    if (verifyResult.passed && isFirstPass) {
      pointsAwarded = day.missionPoints;
    }

    await tx.programMissionSubmission.create({
      data: {
        memberId,
        dayNumber,
        attemptNumber,
        payload: payload as Prisma.InputJsonValue,
        verdict: verifyResult.verdict as Prisma.InputJsonValue,
        passed: verifyResult.passed,
        pointsAwarded,
      },
    });

    if (verifyResult.passed && isFirstPass) {
      const nextDay = Math.min(PROGRAM_TOTAL_DAYS, dayNumber + 1);
      await tx.programMember.update({
        where: { id: memberId },
        data: {
          missionPoints: { increment: pointsAwarded },
          highestUnlockedDay: nextDay,
          ...(cleanPass ? { cleanPassCount: { increment: 1 } } : {}),
        },
      });
      unlockedDay = nextDay;
      await recomputeMemberScore(tx, memberId);
    }

    if (verifyResult.passed && day.missionType === "BOSS_BUILD") {
      const bossPayload = payload as { repoUrl: string; writeup: string };
      const moduleNumber = checkpointModuleNumber(
        day.missionSpec,
        day.module.number,
      );
      await tx.programProject.upsert({
        where: {
          memberId_moduleNumber: {
            memberId,
            moduleNumber,
          },
        },
        create: {
          memberId,
          moduleNumber,
          repoUrl: bossPayload.repoUrl,
          writeup: bossPayload.writeup,
          status: "SUBMITTED",
        },
        update: {
          repoUrl: bossPayload.repoUrl,
          writeup: bossPayload.writeup,
          status: "SUBMITTED",
          submittedAt: new Date(),
        },
      });
    }
  });

  return {
    passed: verifyResult.passed,
    verdict: verifyResult.verdict,
    pointsAwarded,
    attemptNumber,
    unlockedDay,
    cleanPass,
  };
}

export async function useSkipToken(
  memberId: string,
  dayNumber: number,
): Promise<{ ok: true; unlockedDay: number } | { ok: false; message: string }> {
  const avail = await getDayAvailability(memberId, dayNumber);
  if (!avail.ok) return avail;

  if (avail.member.skipTokensUsed >= 2) {
    return { ok: false, message: "No skip tokens remaining." };
  }

  const dayRuns = await prisma.programMissionSubmission.findMany({
    where: { memberId, dayNumber },
    select: { passed: true, payload: true },
  });
  const failedRunCount = dayRuns.filter(
    (r) => !r.passed && !isSkippedPayload(r.payload),
  ).length;

  if (failedRunCount < 3) {
    return {
      ok: false,
      message: "Complete at least 3 failed verification runs before skipping.",
    };
  }

  const attemptCount = await prisma.programMissionSubmission.count({
    where: { memberId, dayNumber },
  });
  const nextDay = Math.min(PROGRAM_TOTAL_DAYS, dayNumber + 1);

  await prisma.$transaction(async (tx) => {
    await tx.programMissionSubmission.create({
      data: {
        memberId,
        dayNumber,
        attemptNumber: attemptCount + 1,
        payload: { skipped: true },
        verdict: [{ check: "Skipped", passed: false, detail: "Skip token used" }],
        passed: false,
        pointsAwarded: 0,
      },
    });
    await tx.programMember.update({
      where: { id: memberId },
      data: {
        skipTokensUsed: { increment: 1 },
        highestUnlockedDay: nextDay,
      },
    });
  });

  return { ok: true, unlockedDay: nextDay };
}
