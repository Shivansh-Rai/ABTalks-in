import "server-only";
import { HACKATHON } from "@/components/hackathon/hackathon-config";
import { prisma } from "@/lib/db";

export type HackathonMember = {
  fullName: string;
  college: string;
  isLeader: boolean;
  slotIndex: number;
};

export type MyRegistration = {
  team: {
    id: string;
    code: string;
    name: string | null;
    entryType: "SOLO" | "TEAM";
  };
  me: { fullName: string; isLeader: boolean };
  members: HackathonMember[];
  spotsLeft: number;
};

export async function getMyRegistration(
  userId: string,
): Promise<MyRegistration | null> {
  const participant = await prisma.hackathonParticipant.findUnique({
    where: { userId },
    select: {
      fullName: true,
      isLeader: true,
      team: {
        select: {
          id: true,
          teamCode: true,
          teamName: true,
          entryType: true,
          participants: {
            orderBy: { slotIndex: "asc" },
            select: {
              fullName: true,
              college: true,
              isLeader: true,
              slotIndex: true,
            },
          },
        },
      },
    },
  });

  if (!participant) return null;

  const { team } = participant;
  const entryType = team.entryType === "SOLO" ? "SOLO" : "TEAM";
  const members: HackathonMember[] = team.participants.map((row) => ({
    fullName: row.fullName,
    college: row.college,
    isLeader: row.isLeader,
    slotIndex: row.slotIndex,
  }));

  return {
    team: {
      id: team.id,
      code: team.teamCode,
      name: team.teamName,
      entryType,
    },
    me: {
      fullName: participant.fullName,
      isLeader: participant.isLeader,
    },
    members,
    spotsLeft:
      entryType === "SOLO" ? 0 : HACKATHON.maxTeamSize - members.length,
  };
}
