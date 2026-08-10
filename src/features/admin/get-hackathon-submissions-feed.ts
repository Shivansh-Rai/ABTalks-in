import { prisma } from "@/lib/db";

export type HackathonSubmissionFeedRow = {
  id: string;
  teamId: string;
  teamCode: string;
  teamLabel: string;
  entryType: "SOLO" | "TEAM";
  leaderUserId: string | null;
  leaderName: string;
  leaderEmail: string;
  memberCount: number;
  problemId: string | null;
  problemTitle: string | null;
  repoUrl: string;
  liveUrl: string;
  aiLogUrl: string;
  updatedAt: Date;
};

export type HackathonProblemFilterOption = {
  id: string;
  title: string;
};

export async function getHackathonProblemFilterOptions(): Promise<
  HackathonProblemFilterOption[]
> {
  return prisma.hackathonProblem.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      title: true,
    },
  });
}

export async function getHackathonSubmissionsFeed(input?: {
  problemId?: string;
  take?: number;
}): Promise<HackathonSubmissionFeedRow[]> {
  const problemId =
    input?.problemId && input.problemId !== "ALL"
      ? input.problemId
      : undefined;

  const rows = await prisma.hackathonSubmission.findMany({
    where: problemId ? { problemId } : {},
    orderBy: { updatedAt: "desc" },
    take: input?.take ?? 500,
    select: {
      id: true,
      repoUrl: true,
      liveUrl: true,
      aiLogUrl: true,
      updatedAt: true,
      problem: { select: { id: true, title: true } },
      team: {
        select: {
          id: true,
          teamCode: true,
          teamName: true,
          entryType: true,
          participants: {
            orderBy: { slotIndex: "asc" },
            select: {
              userId: true,
              fullName: true,
              email: true,
              isLeader: true,
              slotIndex: true,
            },
          },
        },
      },
    },
  });

  return rows.map((row) => {
    const leader =
      row.team.participants.find((p) => p.isLeader) ??
      row.team.participants[0] ??
      null;
    const leaderName = leader?.fullName?.trim() || leader?.email || "Unknown";
    const teamLabel =
      row.team.teamName?.trim() || leaderName || row.team.teamCode;
    const entryType = row.team.entryType === "SOLO" ? "SOLO" : "TEAM";

    return {
      id: row.id,
      teamId: row.team.id,
      teamCode: row.team.teamCode,
      teamLabel,
      entryType,
      leaderUserId: leader?.userId ?? null,
      leaderName,
      leaderEmail: leader?.email ?? "",
      memberCount: row.team.participants.length,
      problemId: row.problem?.id ?? null,
      problemTitle: row.problem?.title ?? null,
      repoUrl: row.repoUrl,
      liveUrl: row.liveUrl,
      aiLogUrl: row.aiLogUrl,
      updatedAt: row.updatedAt,
    };
  });
}
