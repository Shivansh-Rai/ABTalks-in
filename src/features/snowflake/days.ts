import "server-only";
import { SNOWFLAKE_PROGRAM_SLUG } from "@/features/snowflake/constants";
import {
  deriveDayState,
  maxUnlockedDay,
  type SnowflakeDayState,
} from "@/features/snowflake/progression";
import { isDayLockBypassEnabled } from "@/lib/feature-flags";
import type { SnowflakeEnrollment } from "@/repositories/snowflake";
import { listSnowflakeProgress } from "@/repositories/snowflake";
import {
  getDayShellForProgramSlug,
  type ProgramSlugDayShell,
} from "@/repositories/learning";

export async function getSnowflakeDayShell(
  enrollment: SnowflakeEnrollment,
  dayNumber: number,
): Promise<{ day: ProgramSlugDayShell; state: SnowflakeDayState } | null> {
  const day = await getDayShellForProgramSlug(SNOWFLAKE_PROGRAM_SLUG, dayNumber);
  if (!day) return null;
  const progress = await listSnowflakeProgress(enrollment.id);
  const passedDays = new Set(
    progress.filter((p) => p.passed).map((p) => p.dayNumber),
  );
  const state = deriveDayState(
    dayNumber,
    maxUnlockedDay(enrollment.startedAt),
    passedDays,
    isDayLockBypassEnabled(),
  );
  return { day, state };
}
