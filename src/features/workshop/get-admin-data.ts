import "server-only";
import { prisma } from "@/lib/db";

export interface WorkshopRegistrationRow {
  id: string;
  eventId: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  organization: string | null;
  graduationYear: number | null;
  /** True when this account also has a full ABTalks profile (challenge member). */
  isMember: boolean;
  createdAt: Date;
}

export interface WorkshopEventCount {
  eventId: string;
  count: number;
  /** Most recent signup — used to order the picker newest-first. */
  lastSignupAt: Date | null;
}

/**
 * Roster for one or more events. Contact details are selected here deliberately —
 * this is admin-only (`requireAdmin` gates the page) and feeds the CSV export.
 *
 * Takes an array because the admin picker supports selecting several workshops
 * at once; an empty array returns [] rather than every row.
 */
export async function getWorkshopRegistrations(
  eventIds: string[],
): Promise<WorkshopRegistrationRow[]> {
  if (eventIds.length === 0) return [];

  const rows = await prisma.workshopRegistration.findMany({
    where: { eventId: { in: eventIds } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      eventId: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      organization: true,
      graduationYear: true,
      createdAt: true,
      // Every row has a userId now (auth is mandatory), so the useful signal is
      // whether they are a full ABTalks member rather than workshop-only.
      user: { select: { studentProfile: { select: { id: true } } } },
    },
  });

  return rows.map(({ user, ...r }) => ({
    ...r,
    isMember: user.studentProfile !== null,
  }));
}

/**
 * Registration counts per event, most recent activity first. Drives the picker.
 * Reads from the data rather than EVENTS so an event whose code entry was later
 * removed still has its roster reachable.
 */
export async function getWorkshopEventCounts(): Promise<WorkshopEventCount[]> {
  const groups = await prisma.workshopRegistration.groupBy({
    by: ["eventId"],
    _count: { _all: true },
    _max: { createdAt: true },
  });

  return groups
    .map((g) => ({
      eventId: g.eventId,
      count: g._count._all,
      lastSignupAt: g._max.createdAt,
    }))
    .sort((a, b) => (b.lastSignupAt?.getTime() ?? 0) - (a.lastSignupAt?.getTime() ?? 0));
}
