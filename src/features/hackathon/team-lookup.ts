import "server-only";
import { HACKATHON } from "@/components/hackathon/hackathon-config";
import { prisma } from "@/lib/db";

export type HackathonTeamLookup = {
  id: string;
  teamName: string | null;
  entryType: "SOLO" | "TEAM";
  spotsLeft: number;
};

export async function getTeamByCode(
  code: string,
): Promise<HackathonTeamLookup | null> {
  const team = await prisma.hackathonTeam.findUnique({
    where: { teamCode: code.toUpperCase() },
    select: {
      id: true,
      teamName: true,
      entryType: true,
      _count: { select: { participants: true } },
    },
  });

  if (!team) return null;

  const entryType = team.entryType === "SOLO" ? "SOLO" : "TEAM";

  return {
    id: team.id,
    teamName: team.teamName,
    entryType,
    spotsLeft: HACKATHON.maxTeamSize - team._count.participants,
  };
}

export async function isTeamNameTaken(teamName: string): Promise<boolean> {
  const existing = await prisma.hackathonTeam.findFirst({
    where: { teamName: { equals: teamName, mode: "insensitive" } },
    select: { id: true },
  });
  return existing !== null;
}

export async function getTeamLeader(
  teamId: string,
): Promise<{ fullName: string; email: string } | null> {
  const leader = await prisma.hackathonParticipant.findFirst({
    where: { teamId, isLeader: true },
    select: { fullName: true, email: true },
  });
  if (!leader) return null;
  return { fullName: leader.fullName, email: leader.email };
}
