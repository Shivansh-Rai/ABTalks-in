import "server-only";
import { DATABRICKS_AI_PROGRAM_SLUG } from "@/features/databricks-ai/constants";
import {
  deriveDayState,
  maxUnlockedDay,
  type DatabricksAiDayState,
} from "@/features/databricks-ai/progression";
import { isDayLockBypassEnabled } from "@/lib/feature-flags";
import type { DatabricksAiEnrollment } from "@/repositories/databricks-ai";
import { listDatabricksAiProgress } from "@/repositories/databricks-ai";
import {
  getDayShellForProgramSlug,
  type ProgramSlugDayShell,
} from "@/repositories/learning";

export async function getDatabricksAiDayShell(
  enrollment: DatabricksAiEnrollment,
  dayNumber: number,
): Promise<{ day: ProgramSlugDayShell; state: DatabricksAiDayState } | null> {
  const day = await getDayShellForProgramSlug(DATABRICKS_AI_PROGRAM_SLUG, dayNumber);
  if (!day) return null;
  const progress = await listDatabricksAiProgress(enrollment.id);
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
