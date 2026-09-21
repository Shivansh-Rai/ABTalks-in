/**
 * W1-B accidental-legacy-write sentinel (read-only).
 *
 * Counts SynergyEvent.createdAt > W1B_CUTOVER_TIME after the mirror is frozen.
 * Source scans for leftover writers live in src/repositories/points-writes.test.ts.
 *
 * Production: PHASE2_ALLOW_PRODUCTION=1 + direct host.
 * Does not mutate.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

if (process.env.DATABASE_URL?.includes("-pooler.")) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace("-pooler.", ".");
}

import { PrismaClient } from "@prisma/client";
import { assertChildBranch } from "./migrate-078-shared";

const prisma = new PrismaClient();

async function main() {
  assertChildBranch();
  const raw = process.env.W1B_CUTOVER_TIME?.trim();
  const cutover = raw ? new Date(raw) : null;
  if (raw && Number.isNaN(cutover?.getTime())) {
    throw new Error(`W1B_CUTOVER_TIME is not a valid date: ${raw}`);
  }

  if (!cutover) {
    console.log(
      JSON.stringify({ w1bCutoverTime: null, skipped: "W1B_CUTOVER_TIME unset" }, null, 2),
    );
    return;
  }

  const newSynergyEvents = await prisma.synergyEvent.count({
    where: { createdAt: { gt: cutover } },
  });
  const sample = await prisma.synergyEvent.findMany({
    where: { createdAt: { gt: cutover } },
    orderBy: { createdAt: "asc" },
    take: 20,
    select: { id: true, userId: true, type: true, createdAt: true },
  });
  const report = {
    w1bCutoverTime: cutover.toISOString(),
    newSynergyEventsSinceCutover: newSynergyEvents,
    sample,
  };
  console.log(JSON.stringify(report, null, 2));
  if (newSynergyEvents !== 0) {
    throw new Error(
      `W1-B sentinel: ${newSynergyEvents} SynergyEvent rows after ${raw}`,
    );
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
