import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type HackathonMasterCohort = "all" | "old" | "new";

export type HackathonMasterStudent = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  college: string;
  entryType: "SOLO" | "TEAM";
  teamName: string | null;
  createdAt: string;
};

export function parseHackathonMasterCohort(
  raw: string | undefined,
): HackathonMasterCohort {
  if (raw === "old" || raw === "new") return raw;
  return "all";
}

function cohortWhere(
  cohort: HackathonMasterCohort,
): Prisma.HackathonParticipantWhereInput {
  if (cohort === "old") {
    return { user: { enrollments: { some: {} } } };
  }
  if (cohort === "new") {
    return { user: { enrollments: { none: {} } } };
  }
  return {};
}

export async function getHackathonMasterStudents(input?: {
  cohort?: HackathonMasterCohort;
}) {
  const cohort = input?.cohort ?? "all";
  const where = cohortWhere(cohort);

  const rows = await prisma.hackathonParticipant.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
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
  });

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
      createdAt: row.createdAt.toISOString(),
    };
  });

  return {
    students,
    total: students.length,
    cohort,
  };
}
