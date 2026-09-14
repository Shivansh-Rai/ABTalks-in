import "server-only";
import {
  AttemptLateness,
  EnrollmentStatusV2,
  type ProgramMissionType,
} from "@prisma/client";
import {
  SNOWFLAKE_MAX_MISSION_POINTS,
  SNOWFLAKE_PROGRAM_SLUG,
  SNOWFLAKE_TOTAL_DAYS,
} from "@/features/snowflake/constants";
import {
  behindByDays,
  deriveDayState,
  elapsedDay,
  formatUnlockLabel,
  maxUnlockedDay,
  unlockKeyForDay,
  type SnowflakeDayState,
} from "@/features/snowflake/progression";
import { isDayLockBypassEnabled } from "@/lib/feature-flags";
import type { VerdictLine } from "@/features/program/verify-mission";
import type { CurriculumModule } from "@/features/program/progression";
import {
  getSnowflakeEnrollmentProgress,
  listSnowflakeProgress,
  listRecentSnowflakeAttempts,
  type SnowflakeEnrollment,
} from "@/repositories/snowflake";
import { listCurriculumForProgramSlug } from "@/repositories/learning";

export type SnowflakeDashboard = {
  modules: CurriculumModule[];
  days: {
    dayNumber: number;
    title: string;
    missionType: ProgramMissionType;
    isProjectDay: boolean;
    moduleNumber: number;
    state: SnowflakeDayState;
    late: boolean;
  }[];
  currentDay: {
    dayNumber: number;
    title: string;
    missionType: ProgramMissionType;
  } | null;
  nextLockedDay: number | null;
  nextUnlockDateLabel: string | null;
  clearedCount: number;
  totalDays: 15;
  missionPoints: number;
  maxMissionPoints: 245;
  currentStreak: number;
  memberDay: number;
  elapsedDay: number;
  behindBy: number;
  lateDayCount: number;
  isComplete: boolean;
  completedLate: boolean;
  recentVerdicts: {
    dayNumber: number;
    passed: boolean;
    checks: VerdictLine[];
    createdAt: string;
  }[];
};

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

export async function getSnowflakeDashboard(
  enrollment: SnowflakeEnrollment,
): Promise<SnowflakeDashboard> {
  const [catalog, progress, cached, recent] = await Promise.all([
    listCurriculumForProgramSlug(SNOWFLAKE_PROGRAM_SLUG),
    listSnowflakeProgress(enrollment.id),
    getSnowflakeEnrollmentProgress(enrollment.id),
    listRecentSnowflakeAttempts(enrollment.id, 8),
  ]);

  const passedDays = new Set(
    progress.filter((p) => p.passed).map((p) => p.dayNumber),
  );
  const lateDays = new Set(
    progress
      .filter((p) => p.passed && p.lateness === AttemptLateness.LATE)
      .map((p) => p.dayNumber),
  );
  const maxUnlocked = maxUnlockedDay(enrollment.startedAt);
  const bypass = isDayLockBypassEnabled();
  const memberDay = passedDays.size === 0 ? 0 : Math.max(...passedDays);

  const days = catalog.days.map((d) => ({
    dayNumber: d.dayNumber,
    title: d.title,
    missionType: d.missionType,
    isProjectDay: d.isProjectDay,
    moduleNumber: d.moduleNumber,
    state: deriveDayState(d.dayNumber, maxUnlocked, passedDays, bypass),
    late: lateDays.has(d.dayNumber),
  }));

  const current = days.find((d) => d.state === "AVAILABLE") ?? null;
  const nextLocked = days.find((d) => d.state === "LOCKED") ?? null;
  const isComplete = enrollment.status === EnrollmentStatusV2.COMPLETED;
  const lastDay = progress.find((p) => p.dayNumber === SNOWFLAKE_TOTAL_DAYS);

  return {
    modules: catalog.modules,
    days,
    currentDay: current
      ? {
          dayNumber: current.dayNumber,
          title: current.title,
          missionType: current.missionType,
        }
      : null,
    nextLockedDay: nextLocked?.dayNumber ?? null,
    nextUnlockDateLabel: nextLocked
      ? formatUnlockLabel(
          unlockKeyForDay(enrollment.startedAt, nextLocked.dayNumber),
        )
      : null,
    clearedCount: passedDays.size,
    totalDays: SNOWFLAKE_TOTAL_DAYS,
    missionPoints: cached?.pointsEarned ?? 0,
    maxMissionPoints: SNOWFLAKE_MAX_MISSION_POINTS,
    currentStreak: cached?.currentStreak ?? 0,
    memberDay,
    elapsedDay: elapsedDay(enrollment.startedAt),
    behindBy: behindByDays(enrollment.startedAt, memberDay),
    lateDayCount: lateDays.size,
    isComplete,
    completedLate: isComplete && lastDay?.lateness === AttemptLateness.LATE,
    recentVerdicts: recent.map((r) => ({
      dayNumber: r.dayNumber,
      passed: r.passed,
      checks: parseVerdict(r.verdict),
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
