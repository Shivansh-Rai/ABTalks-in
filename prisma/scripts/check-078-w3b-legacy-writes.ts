/**
 * W3-B accidental Certificate-write sentinel (read-only).
 *
 * Counts Certificate.createdAt > W3B_CUTOVER_TIME after the mirror is frozen.
 * Source scans for leftover writers live in credentials-write.test.ts.
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
import { isLegacyCertificateMirrorEnabled } from "../../src/lib/feature-flags";
import { assertChildBranch } from "./migrate-078-shared";

const prisma = new PrismaClient();

async function main() {
  assertChildBranch();
  const raw = process.env.W3B_CUTOVER_TIME?.trim();
  const cutover = raw ? new Date(raw) : null;
  if (raw && Number.isNaN(cutover?.getTime())) {
    throw new Error(`W3B_CUTOVER_TIME is not a valid date: ${raw}`);
  }

  if (!cutover) {
    console.log(
      JSON.stringify({ w3bCutoverTime: null, skipped: "W3B_CUTOVER_TIME unset" }, null, 2),
    );
    return;
  }

  const newCertificates = await prisma.certificate.count({
    where: { createdAt: { gt: cutover } },
  });
  const sample = await prisma.certificate.findMany({
    where: { createdAt: { gt: cutover } },
    orderBy: { createdAt: "asc" },
    take: 20,
    select: { id: true, certificateId: true, userId: true, type: true, createdAt: true },
  });
  const report = {
    w3bCutoverTime: cutover.toISOString(),
    legacyCertificateMirror: isLegacyCertificateMirrorEnabled() ? "on" : "off",
    newCertificateRowsSinceCutover: newCertificates,
    sample,
  };
  console.log(JSON.stringify(report, null, 2));

  if (!isLegacyCertificateMirrorEnabled() && newCertificates !== 0) {
    throw new Error(
      `W3-B sentinel failed: ${newCertificates} Certificate rows created after cutover`,
    );
  }
  console.log("W3-B Certificate write sentinel passed.");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
