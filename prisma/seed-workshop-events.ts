import { PrismaClient, type Prisma } from "@prisma/client";
import rows from "./content/workshop-events.json";

const prisma = new PrismaClient();

/**
 * Seeds the seven workshop-track events that used to live in the `EVENTS`
 * array in src/components/workshop/events-data.ts.
 *
 * IDEMPOTENT, and id-preserving by construction: every row is upserted under
 * the id it already had. That is the whole point of this script —
 * `WorkshopRegistration.eventId` holds those exact strings, so recreating or
 * renaming an id would silently detach a roster from its workshop.
 *
 * `update` deliberately touches only the columns the app derives content from
 * and leaves the row alone otherwise, so re-running this after an admin has
 * edited a workshop does not quietly revert their edit to the file's values.
 * Re-running it is therefore safe but not a reset — to reset a row, delete it
 * first.
 */
async function main() {
  let created = 0;
  let skipped = 0;

  for (const r of rows) {
    const existing = await prisma.workshopEvent.findUnique({
      where: { id: r.id },
      select: { id: true },
    });

    if (existing) {
      skipped += 1;
      console.log(`  = ${r.id} (already present, left untouched)`);
      continue;
    }

    await prisma.workshopEvent.create({
      data: {
        id: r.id,
        date: r.date,
        time: r.time,
        tag: r.tag,
        accent: r.accent,
        icon: r.icon,
        title: r.title,
        desc: r.desc,
        host: r.host,
        location: r.location,
        registrationOpen: r.registrationOpen,
        durationMinutes: r.durationMinutes,
        posterSrc: r.posterSrc,
        youtubeId: r.youtubeId,
        duration: r.duration,
        titleAccents: r.titleAccents,
        topics: r.topics,
        takeaways: r.takeaways,
        resources: r.resources as Prisma.InputJsonValue,
      },
    });
    created += 1;
    console.log(`  + ${r.id}`);
  }

  console.log(`\nworkshop events: ${created} created, ${skipped} already present`);

  // The reason this script exists: prove no roster was orphaned. Every
  // distinct eventId on WorkshopRegistration should now resolve to a row.
  const regs = await prisma.workshopRegistration.groupBy({
    by: ["eventId"],
    _count: { _all: true },
  });
  const known = new Set(
    (await prisma.workshopEvent.findMany({ select: { id: true } })).map((e) => e.id),
  );
  const orphaned = regs.filter((r) => !known.has(r.eventId));

  console.log("\nregistration id check:");
  for (const r of regs) {
    console.log(
      `  ${known.has(r.eventId) ? "OK  " : "MISS"} ${r.eventId} (${r._count._all} registrations)`,
    );
  }
  if (orphaned.length > 0) {
    console.log(
      `\nWARNING: ${orphaned.length} eventId(s) have registrations but no WorkshopEvent row.\n` +
        "Those rosters still exist and are still queryable by eventId — nothing was lost —\n" +
        "but the workshop will not render. Add a row with that exact id to restore it.",
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
