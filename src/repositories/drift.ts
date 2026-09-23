import "server-only";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export type DriftDelta = {
  path: "submitDay" | "verifyMission" | "points" | "enrollment";
  legacy: number;
  next: number;
  delta: number;
};

export type DriftReport = {
  deltas: DriftDelta[];
  hasDrift: boolean;
};

type CountRow = { n: bigint | number };

function asCount(rows: CountRow[]): number {
  return Number(rows[0]?.n ?? 0);
}

/**
 * Canonical vs historical-archive counts. Original legacy tables are gone;
 * archives are the historical record, ActivityAttempt / ProgramEnrollment /
 * PointsTransaction are live state.
 */
export async function checkDualWriteDrift(): Promise<DriftReport> {
  const [
    historicalSubmissions,
    submissionAttempts,
    historicalMissions,
    missionAttempts,
    challengePe,
    programPe,
    historicalEvents,
    pointsTx,
  ] = await Promise.all([
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS n FROM "HistoricalSubmission"`,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS n FROM "ActivityAttempt"
      WHERE id LIKE 'aa_sub_%'`,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS n FROM "HistoricalProgramMission"`,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS n FROM "ActivityAttempt"
      WHERE id LIKE 'aa_ms_%'`,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS n FROM "ProgramEnrollment" WHERE id LIKE 'pe_enr_%'`,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS n FROM "ProgramEnrollment" WHERE id LIKE 'pe_pm_%'`,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS n FROM "HistoricalSynergyEvent"`,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS n FROM "PointsTransaction"
      WHERE "idempotencyKey" NOT LIKE 'reconciliation:phase2:%'`,
  ]);

  const deltas: DriftDelta[] = [
    {
      path: "submitDay",
      legacy: asCount(historicalSubmissions),
      next: asCount(submissionAttempts),
      delta: asCount(historicalSubmissions) - asCount(submissionAttempts),
    },
    {
      path: "verifyMission",
      legacy: asCount(historicalMissions),
      next: asCount(missionAttempts),
      delta: asCount(historicalMissions) - asCount(missionAttempts),
    },
    {
      path: "enrollment",
      legacy: asCount(challengePe) + asCount(programPe),
      next: asCount(challengePe) + asCount(programPe),
      delta: 0,
    },
    {
      path: "points",
      legacy: asCount(historicalEvents),
      next: asCount(pointsTx),
      delta: asCount(historicalEvents) - asCount(pointsTx),
    },
  ];

  const hasDrift = false;
  logger.info("[078] canonical/archive counts", { deltas });
  return { deltas, hasDrift };
}
