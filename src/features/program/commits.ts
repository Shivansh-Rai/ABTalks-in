import "server-only";
import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { prisma } from "@/lib/db";
import {
  IST,
  istDateRangeToUtc,
  parseCalendarKeyToUtcDate,
} from "@/lib/date-utils";
import { getCohortCalendarDay } from "@/features/program/progression";
import { recomputeMemberScore } from "@/features/program/missions";
import { parseRepo } from "@/features/program/verify-mission";
import {
  COMMIT_POINTS_PER_DAY,
  PROGRAM_MAX_COMMIT_POINTS,
  PROGRAM_TOTAL_DAYS,
} from "@/features/program/constants";
import { logger } from "@/lib/logger";

const MAX_COMMIT_POINTS = PROGRAM_MAX_COMMIT_POINTS;
const CHUNK_SIZE = 10;

export type HeatmapCell = { dateIso: string; count: number };

export type AtRiskMember = {
  memberId: string;
  fullName: string;
  reasons: ("behind_pace" | "stuck_mission" | "no_commits")[];
};

export type MemberAtRiskStatus = {
  atRisk: boolean;
  reasons: AtRiskMember["reasons"];
  behindBy: number;
};

/** IST calendar date key for N days before today in IST. */
export function getIstDateKeyDaysAgo(daysAgo: number): string {
  const todayKey = formatInTimeZone(new Date(), IST, "yyyy-MM-dd");
  const base = parseCalendarKeyToUtcDate(todayKey);
  return formatInTimeZone(addDays(base, -daysAgo), IST, "yyyy-MM-dd");
}

function istDateKeyToDbDate(key: string): Date {
  return parseCalendarKeyToUtcDate(key);
}

function isDateKeyInCohortWindow(
  dateKey: string,
  cohort: { startsAt: Date; endsAt: Date },
): boolean {
  const startKey = formatInTimeZone(cohort.startsAt, IST, "yyyy-MM-dd");
  const endKey = formatInTimeZone(cohort.endsAt, IST, "yyyy-MM-dd");
  return dateKey >= startKey && dateKey <= endKey;
}

export async function fetchGithubCommitCount(
  owner: string,
  repo: string,
  author: string,
  since: Date,
  until: Date,
): Promise<number> {
  const token = process.env.GITHUB_API_TOKEN;
  if (!token) {
    logger.error("[commits] GITHUB_API_TOKEN missing");
    return 0;
  }

  const params = new URLSearchParams({
    author,
    since: since.toISOString(),
    until: until.toISOString(),
    per_page: "100",
  });

  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?${params}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "abtalks-program",
        },
        signal: AbortSignal.timeout(20000),
      },
    );

    if (res.status === 404 || res.status === 403) {
      logger.error("[commits] github commits denied", {
        owner,
        repo,
        status: res.status,
      });
      return 0;
    }
    if (!res.ok) {
      logger.error("[commits] github commits failed", {
        owner,
        repo,
        status: res.status,
      });
      return 0;
    }

    const data = (await res.json()) as unknown[];
    return Array.isArray(data) ? data.length : 0;
  } catch (e) {
    logger.error("[commits] github fetch errored", {
      owner,
      repo,
      error: String(e),
    });
    return 0;
  }
}

async function recomputeCommitPointsForMember(
  memberId: string,
  cohort: { startsAt: Date; endsAt: Date },
): Promise<void> {
  const startKey = formatInTimeZone(cohort.startsAt, IST, "yyyy-MM-dd");
  const endKey = formatInTimeZone(cohort.endsAt, IST, "yyyy-MM-dd");
  const startDate = istDateKeyToDbDate(startKey);
  const endDate = istDateKeyToDbDate(endKey);

  await prisma.$transaction(async (tx) => {
    const qualifyingDays = await tx.programCommitDay.count({
      where: {
        memberId,
        commitCount: { gt: 0 },
        date: { gte: startDate, lte: endDate },
      },
    });

    const commitPoints = Math.min(
      MAX_COMMIT_POINTS,
      qualifyingDays * COMMIT_POINTS_PER_DAY,
    );

    await tx.programMember.update({
      where: { id: memberId },
      data: { commitPoints },
    });
    await recomputeMemberScore(tx, memberId);
  });
}

type MemberRow = {
  id: string;
  githubUsername: string;
  githubRepoUrl: string;
  highestUnlockedDay: number;
};

export async function processMemberCommitDay(
  member: MemberRow,
  cohort: { startsAt: Date; endsAt: Date },
  istDateKey: string,
): Promise<{ ok: true } | { ok: false; memberId: string; reason: string }> {
  if (!isDateKeyInCohortWindow(istDateKey, cohort)) {
    return { ok: true };
  }

  const parsed = parseRepo(member.githubRepoUrl);
  if (!parsed) {
    return { ok: false, memberId: member.id, reason: "invalid_repo_url" };
  }

  const { startUtc, endExclusiveUtc } = istDateRangeToUtc(
    istDateKey,
    istDateKey,
  );
  if (!startUtc || !endExclusiveUtc) {
    return { ok: false, memberId: member.id, reason: "invalid_date_range" };
  }

  const count = await fetchGithubCommitCount(
    parsed.owner,
    parsed.repo,
    member.githubUsername,
    startUtc,
    endExclusiveUtc,
  );

  const commitDate = istDateKeyToDbDate(istDateKey);

  await prisma.programCommitDay.upsert({
    where: {
      memberId_date: { memberId: member.id, date: commitDate },
    },
    create: {
      memberId: member.id,
      date: commitDate,
      commitCount: count,
    },
    update: { commitCount: count },
  });

  await recomputeCommitPointsForMember(member.id, cohort);
  return { ok: true };
}

export async function runProgramCommitsCron(): Promise<{
  processed: number;
  failures: { memberId: string; reason: string }[];
}> {
  const cohort = await prisma.programCohort.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    select: { id: true, startsAt: true, endsAt: true },
  });

  if (!cohort) {
    return { processed: 0, failures: [] };
  }

  const endKey = formatInTimeZone(cohort.endsAt, IST, "yyyy-MM-dd");
  const graceKey = formatInTimeZone(
    addDays(parseCalendarKeyToUtcDate(endKey), 1),
    IST,
    "yyyy-MM-dd",
  );
  const todayKey = formatInTimeZone(new Date(), IST, "yyyy-MM-dd");
  if (todayKey > graceKey) {
    return { processed: 0, failures: [] };
  }

  const istDateKey = getIstDateKeyDaysAgo(1);

  const members = await prisma.programMember.findMany({
    where: {
      cohortId: cohort.id,
      status: { in: ["ENROLLED", "COMPLETED"] },
    },
    take: 100,
    select: {
      id: true,
      githubUsername: true,
      githubRepoUrl: true,
      highestUnlockedDay: true,
    },
  });

  const failures: { memberId: string; reason: string }[] = [];
  let processed = 0;

  for (let i = 0; i < members.length; i += CHUNK_SIZE) {
    const chunk = members.slice(i, i + CHUNK_SIZE);
    const results = await Promise.allSettled(
      chunk.map((m) => processMemberCommitDay(m, cohort, istDateKey)),
    );

    for (let j = 0; j < results.length; j++) {
      const member = chunk[j]!;
      const result = results[j]!;
      if (result.status === "rejected") {
        failures.push({
          memberId: member.id,
          reason: String(result.reason),
        });
        logger.error("[commits] member processing failed", {
          memberId: member.id,
          error: String(result.reason),
        });
        continue;
      }
      if (!result.value.ok) {
        failures.push({
          memberId: result.value.memberId,
          reason: result.value.reason,
        });
        continue;
      }
      processed += 1;
    }
  }

  return { processed, failures };
}

export async function getCommitHeatmap(
  memberId: string,
  cohort: { startsAt: Date; endsAt: Date },
): Promise<HeatmapCell[]> {
  const startKey = formatInTimeZone(cohort.startsAt, IST, "yyyy-MM-dd");
  const base = parseCalendarKeyToUtcDate(startKey);

  const rows = await prisma.programCommitDay.findMany({
    where: { memberId },
    select: { date: true, commitCount: true },
  });

  const byDate = new Map(
    rows.map((r) => [
      formatInTimeZone(r.date, IST, "yyyy-MM-dd"),
      r.commitCount,
    ]),
  );

  const cells: HeatmapCell[] = [];
  for (let i = 0; i < PROGRAM_TOTAL_DAYS; i++) {
    const dateKey = formatInTimeZone(addDays(base, i), IST, "yyyy-MM-dd");
    cells.push({
      dateIso: dateKey,
      count: byDate.get(dateKey) ?? 0,
    });
  }
  return cells;
}

function isSkippedPayload(payload: unknown): boolean {
  return (
    !!payload &&
    typeof payload === "object" &&
    (payload as { skipped?: unknown }).skipped === true
  );
}

async function evaluateMemberAtRisk(
  member: {
    id: string;
    highestUnlockedDay: number;
  },
  cohort: { startsAt: Date; endsAt: Date },
): Promise<AtRiskMember["reasons"]> {
  const reasons: AtRiskMember["reasons"] = [];
  const calendarDay = getCohortCalendarDay(cohort);

  if (member.highestUnlockedDay < calendarDay - 2) {
    reasons.push("behind_pace");
  }

  const dayNumber = member.highestUnlockedDay;
  const passed = await prisma.programMissionSubmission.findFirst({
    where: { memberId: member.id, dayNumber, passed: true },
    select: { id: true },
  });
  if (!passed) {
    const oldestFailed = await prisma.programMissionSubmission.findFirst({
      where: {
        memberId: member.id,
        dayNumber,
        passed: false,
      },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, payload: true },
    });
    if (
      oldestFailed &&
      !isSkippedPayload(oldestFailed.payload)
    ) {
      const twoDaysAgoKey = getIstDateKeyDaysAgo(2);
      const { startUtc } = istDateRangeToUtc(twoDaysAgoKey, twoDaysAgoKey);
      if (startUtc && oldestFailed.createdAt < startUtc) {
        reasons.push("stuck_mission");
      }
    }
  }

  const recentKeys = [1, 2, 3, 4, 5].map((d) => getIstDateKeyDaysAgo(d));
  const recentDates = recentKeys.map(istDateKeyToDbDate);
  const commitDays = await prisma.programCommitDay.count({
    where: {
      memberId: member.id,
      commitCount: { gt: 0 },
      date: { in: recentDates },
    },
  });
  if (commitDays === 0) {
    reasons.push("no_commits");
  }

  return reasons;
}

export async function getAtRiskMembers(
  cohortId: string,
): Promise<AtRiskMember[]> {
  const cohort = await prisma.programCohort.findUnique({
    where: { id: cohortId },
    select: { startsAt: true, endsAt: true },
  });
  if (!cohort) return [];

  const members = await prisma.programMember.findMany({
    where: {
      cohortId,
      status: { in: ["ENROLLED", "COMPLETED"] },
    },
    select: {
      id: true,
      fullName: true,
      highestUnlockedDay: true,
    },
  });

  const atRisk: AtRiskMember[] = [];
  for (const member of members) {
    const reasons = await evaluateMemberAtRisk(member, cohort);
    if (reasons.length > 0) {
      atRisk.push({ memberId: member.id, fullName: member.fullName, reasons });
    }
  }
  return atRisk;
}

export async function getMemberAtRiskStatus(
  memberId: string,
  cohortId: string,
): Promise<MemberAtRiskStatus> {
  const [member, cohort] = await Promise.all([
    prisma.programMember.findUnique({
      where: { id: memberId },
      select: { id: true, highestUnlockedDay: true },
    }),
    prisma.programCohort.findUnique({
      where: { id: cohortId },
      select: { startsAt: true, endsAt: true },
    }),
  ]);

  if (!member || !cohort) {
    return { atRisk: false, reasons: [], behindBy: 0 };
  }

  const calendarDay = getCohortCalendarDay(cohort);
  const behindBy = Math.max(0, calendarDay - member.highestUnlockedDay);
  const reasons = await evaluateMemberAtRisk(member, cohort);

  return {
    atRisk: reasons.length > 0,
    reasons,
    behindBy,
  };
}
