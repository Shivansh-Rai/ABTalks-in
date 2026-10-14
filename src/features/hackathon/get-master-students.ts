import "server-only";
import { Prisma } from "@prisma/client";
import {
  HACKATHON_EVENT_LABELS,
  hackathonEventLabel,
} from "@/components/hackathon/hackathon-config";
import { prisma } from "@/lib/db";

export type HackathonMasterCohort = "all" | "old" | "new";

/** Max rows rendered in one go; `total` reports the real match count. */
export const HACKATHON_MASTER_ROW_CAP = 500;

export type HackathonMasterStudent = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  college: string;
  entryType: "SOLO" | "TEAM";
  teamName: string | null;
  eventId: string;
  eventLabel: string;
  createdAt: string;
};

export type HackathonMasterEventOption = {
  value: string;
  label: string;
  count: number;
};

export function parseHackathonMasterCohort(
  raw: string | undefined,
): HackathonMasterCohort {
  if (raw === "old" || raw === "new") return raw;
  return "all";
}

/**
 * Only known event ids narrow the list — a junk query string falls back to
 * "all" rather than silently rendering an empty roster.
 */
export function parseHackathonMasterEvent(raw: string | undefined): string {
  if (raw && raw in HACKATHON_EVENT_LABELS) return raw;
  return "all";
}

function cohortWhere(
  cohort: HackathonMasterCohort,
): Prisma.HackathonParticipantWhereInput {
  if (cohort === "old") {
    return { user: { programEnrollments: { some: { id: { startsWith: "pe_enr_" } } } } };
  }
  if (cohort === "new") {
    return { user: { programEnrollments: { none: { id: { startsWith: "pe_enr_" } } } } };
  }
  return {};
}

export async function getHackathonMasterStudents(input?: {
  cohort?: HackathonMasterCohort;
  event?: string;
}) {
  const cohort = input?.cohort ?? "all";
  const event = input?.event ?? "all";
  // The cohort filter already narrows on `user`, so the soft-delete guard has
  // to merge into the same relation filter rather than overwrite it.
  const cohortFilter = cohortWhere(cohort);
  const scopeWhere: Prisma.HackathonParticipantWhereInput = {
    AND: [cohortFilter, { user: { deletedAt: null } }],
  };
  const where: Prisma.HackathonParticipantWhereInput = {
    ...scopeWhere,
    ...(event === "all" ? {} : { eventId: event }),
  };

  const [rows, total, eventGroups] = await Promise.all([
    prisma.hackathonParticipant.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: HACKATHON_MASTER_ROW_CAP,
      select: {
        id: true,
        eventId: true,
        fullName: true,
        email: true,
        phone: true,
        college: true,
        createdAt: true,
        team: {
          select: {
            entryType: true,
            teamName: true,
          },
        },
      },
    }),
    prisma.hackathonParticipant.count({ where }),
    prisma.hackathonParticipant.groupBy({
      by: ["eventId"],
      where: scopeWhere,
      _count: { _all: true },
    }),
  ]);

  const students: HackathonMasterStudent[] = rows.map((row) => {
    const entryType = row.team.entryType === "SOLO" ? "SOLO" : "TEAM";
    return {
      id: row.id,
      fullName: row.fullName,
      email: row.email,
      phone: row.phone,
      college: row.college,
      entryType,
      teamName: entryType === "SOLO" ? null : row.team.teamName,
      eventId: row.eventId,
      eventLabel: hackathonEventLabel(row.eventId),
      createdAt: row.createdAt.toISOString(),
    };
  });

  const eventOptions: HackathonMasterEventOption[] = [
    {
      value: "all",
      label: "All events",
      count: eventGroups.reduce((sum, g) => sum + g._count._all, 0),
    },
    ...eventGroups
      .map((g) => ({
        value: g.eventId,
        label: hackathonEventLabel(g.eventId),
        count: g._count._all,
      }))
      .sort((a, b) => b.count - a.count),
  ];

  return {
    students,
    shown: students.length,
    total,
    cohort,
    event,
    eventOptions,
  };
}
