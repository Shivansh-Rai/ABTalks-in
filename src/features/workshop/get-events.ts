import "server-only";
import {
  STATIC_EVENTS,
  type WorkshopEvent,
  type WorkshopResource,
} from "@/components/workshop/events-data";
import { isIconKey } from "@/components/workshop/workshop-icons";
import { prisma } from "@/lib/db";

/**
 * Every event the workshop surfaces draw from: the admin-managed workshop rows
 * plus the three static non-workshop entries.
 *
 * THE single read path. The hero, countdown, calendar grid, sticky date
 * marker, Upcoming/Register banner, timeline, notifications and hub search all
 * resolve their events through here, so an admin edit lands on all of them at
 * once and none of them can drift from another.
 *
 * Server-only by construction — it queries the database — which is why the
 * client components that render events take an event array as a prop instead
 * of importing one.
 */

/** Rows carry `resources` as Json; narrow it rather than trusting the column. */
function parseResources(value: unknown): WorkshopResource[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((r) => {
    if (typeof r !== "object" || r === null) return [];
    const { label, href, kind } = r as Record<string, unknown>;
    if (typeof label !== "string" || typeof href !== "string") return [];
    return [{ label, href, kind: kind === "youtube" ? "youtube" : "link" }];
  });
}

export async function getWorkshopEvents(): Promise<WorkshopEvent[]> {
  const rows = await prisma.workshopEvent.findMany({
    select: {
      id: true,
      date: true,
      time: true,
      tag: true,
      accent: true,
      icon: true,
      title: true,
      desc: true,
      host: true,
      location: true,
      registrationOpen: true,
      durationMinutes: true,
      posterSrc: true,
      youtubeId: true,
      duration: true,
      titleAccents: true,
      topics: true,
      takeaways: true,
      resources: true,
    },
    orderBy: { date: "asc" },
  });

  const fromDb: WorkshopEvent[] = rows.map((r) => ({
    id: r.id,
    date: r.date,
    time: r.time,
    tag: r.tag,
    accent: r.accent,
    track: "workshop",
    // A key written before an icon was renamed would otherwise crash the
    // render; `resolveIcon` falls back too, and this keeps the type honest.
    icon: isIconKey(r.icon) ? r.icon : "calendar",
    title: r.title,
    desc: r.desc,
    host: r.host,
    location: r.location,
    registrationOpen: r.registrationOpen,
    // `register` is the legacy twin of `registrationOpen` and is still read by
    // the notification deriver. Kept in step here rather than left undefined.
    register: r.registrationOpen,
    durationMinutes: r.durationMinutes ?? undefined,
    posterSrc: r.posterSrc ?? undefined,
    youtubeId: r.youtubeId ?? undefined,
    duration: r.duration ?? undefined,
    titleAccents: r.titleAccents.length > 0 ? r.titleAccents : undefined,
    topics: r.topics.length > 0 ? r.topics : undefined,
    takeaways: r.takeaways.length > 0 ? r.takeaways : undefined,
    resources: parseResources(r.resources),
  }));

  return [...fromDb, ...STATIC_EVENTS].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}
