/**
 * Plan 133 — give every pre-session project its Session 1.
 *
 * The app already does this lazily: `ensureLegacySession` runs whenever a
 * project is opened, searched or messaged. This script runs the SAME function
 * over every project up front, so nothing depends on a recruiter happening to
 * open an old project first (the admin views, for one, read sessions too).
 *
 * Nothing is lost or rewritten: the project's brief is copied into Session 1,
 * its sessionless messages are filed under it, and its current matches become
 * Session 1's results. A project with no history gets no session.
 *
 * Idempotent. Dry run by default.
 *
 * Run: npm run db:backfill:search-sessions
 *      npm run db:backfill:search-sessions -- --apply
 */
import { PrismaClient } from "@prisma/client";
import { ensureLegacySession } from "../../src/features/hire/search-sessions";

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes("--apply");
  const targets = await prisma.talentRequest.findMany({
    where: {
      sessions: { none: {} },
      OR: [{ messages: { some: {} } }, { matches: { some: {} } }],
    },
    select: { id: true, name: true, title: true },
  });

  console.log(
    `\n${apply ? "APPLYING" : "DRY RUN"} — ${targets.length} project(s) without a search session\n`,
  );
  let created = 0;
  for (const t of targets) {
    const label = t.name?.trim() || t.title.trim() || "(untitled)";
    if (!apply) {
      console.log(`  would file ${t.id} "${label}" as Session 1`);
      continue;
    }
    const id = await ensureLegacySession(t.id);
    if (id) created++;
    console.log(`  ${id ? "✓" : "–"} ${t.id} "${label}"`);
  }
  if (apply) console.log(`\n${created} Session 1 row(s) created.\n`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
