/**
 * W8-B accidental ProgramMember mutable-state write sentinel (read-only).
 *
 * After ENABLE_LEGACY_PROGRAM_MEMBER_MIRROR=false and W8B_CUTOVER_TIME:
 * existing ProgramMember rows must not receive later status/score/unlock/
 * recommendation/identity remirrors.
 *
 * Allowed after cutover:
 *   - new minimal structural anchors (createdAt >= cutover)
 *   - compliance anonymize (fullName = 'Deleted User')
 *   - rollback/migration tooling
 *
 * Child by default. Production: PHASE2_ALLOW_PRODUCTION=1 + direct host.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

if (process.env.DATABASE_URL?.includes("-pooler.")) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace("-pooler.", ".");
}

import { PrismaClient } from "@prisma/client";
import { isLegacyProgramMemberMirrorEnabled } from "../../src/lib/feature-flags";
import { assertChildBranch } from "./migrate-078-shared";

const prisma = new PrismaClient();

function n(rows: Array<{ n: bigint | number }>): number {
  return Number(rows[0]?.n ?? 0);
}

async function main() {
  assertChildBranch();
  const raw = process.env.W8B_CUTOVER_TIME?.trim();
  const cutover = raw ? new Date(raw) : null;
  if (raw && Number.isNaN(cutover?.getTime())) {
    throw new Error(`W8B_CUTOVER_TIME is not a valid date: ${raw}`);
  }

  if (cutover && isLegacyProgramMemberMirrorEnabled()) {
    throw new Error(
      "W8B_CUTOVER_TIME is set but ENABLE_LEGACY_PROGRAM_MEMBER_MIRROR is not false",
    );
  }

  const accidental = cutover
    ? n(
        await prisma.$queryRaw<{ n: bigint }[]>`
          SELECT count(*)::bigint AS n
          FROM "ProgramMember"
          WHERE "createdAt" < ${cutover}
            AND "updatedAt" >= ${cutover}
            AND "fullName" <> 'Deleted User'
            AND "githubUsername" <> 'deleted'
        `,
      )
    : 0;

  const newAnchors = cutover
    ? n(
        await prisma.$queryRaw<{ n: bigint }[]>`
          SELECT count(*)::bigint AS n
          FROM "ProgramMember"
          WHERE "createdAt" >= ${cutover}
        `,
      )
    : 0;

  const report = {
    w8bCutoverTime: raw ?? null,
    legacyProgramMemberMirror: isLegacyProgramMemberMirrorEnabled()
      ? "on"
      : "off",
    accidentalMutableStateWrites: accidental,
    newMinimalAnchorsSinceCutover: newAnchors,
    note: "Flags existing-row remirrors of status/score/unlock/recommendation/identity. New anchors and Deleted User compliance wipes are excluded.",
  };
  console.log(JSON.stringify(report, null, 2));

  if (cutover && accidental !== 0) {
    throw new Error(
      `W8-B sentinel: unintended ProgramMember mutable-state writes=${accidental}`,
    );
  }
  console.log("W8-B legacy-write sentinel finished.");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
