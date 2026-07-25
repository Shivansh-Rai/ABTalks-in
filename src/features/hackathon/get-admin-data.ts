import "server-only";
import { HACKATHON } from "@/components/hackathon/hackathon-config";
import { prisma } from "@/lib/db";

export type AdminHackathonMember = {
  fullName: string;
  email: string;
  phone: string;
  college: string;
  graduationYear: number;
  isLeader: boolean;
  slotIndex: number;
};

export type AdminHackathonTeam = {
  id: string;
  teamCode: string;
  teamName: string | null;
  entryType: "SOLO" | "TEAM";
  createdAt: string;
  memberCount: number;
  members: AdminHackathonMember[];
};

export type AdminHackathonData = {
  totalTeams: number;
  totalParticipants: number;
  soloCount: number;
  teamCount: number;
  teamsWithOpenSpots: number;
  problemStatement: string | null;
  teams: AdminHackathonTeam[];
};

export async function getAdminData(): Promise<AdminHackathonData> {
  const [teams, event] = await Promise.all([
    prisma.hackathonTeam.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        teamCode: true,
        teamName: true,
        entryType: true,
        createdAt: true,
        participants: {
          orderBy: { slotIndex: "asc" },
          select: {
            fullName: true,
            email: true,
            phone: true,
            college: true,
            graduationYear: true,
            isLeader: true,
            slotIndex: true,
          },
        },
      },
    }),
    prisma.hackathonEvent.findUnique({
      where: { id: 1 },
      select: { problemStatement: true },
    }),
  ]);

  let soloCount = 0;
  let teamCount = 0;
  let totalParticipants = 0;
  let teamsWithOpenSpots = 0;

  const mapped: AdminHackathonTeam[] = teams.map((t) => {
    const entryType = t.entryType === "SOLO" ? "SOLO" : "TEAM";
    if (entryType === "SOLO") soloCount += 1;
    else teamCount += 1;
    totalParticipants += t.participants.length;
    if (
      entryType === "TEAM" &&
      t.participants.length < HACKATHON.maxTeamSize
    ) {
      teamsWithOpenSpots += 1;
    }
    return {
      id: t.id,
      teamCode: t.teamCode,
      teamName: t.teamName,
      entryType,
      createdAt: t.createdAt.toISOString(),
      memberCount: t.participants.length,
      members: t.participants.map((m) => ({
        fullName: m.fullName,
        email: m.email,
        phone: m.phone,
        college: m.college,
        graduationYear: m.graduationYear,
        isLeader: m.isLeader,
        slotIndex: m.slotIndex,
      })),
    };
  });

  return {
    totalTeams: teams.length,
    totalParticipants,
    soloCount,
    teamCount,
    teamsWithOpenSpots,
    problemStatement: event?.problemStatement ?? null,
    teams: mapped,
  };
}
