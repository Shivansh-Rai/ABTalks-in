import "server-only";
import { prisma } from "@/lib/db";

export type TeamSubmission = {
  problemId: string | null;
  repoUrl: string;
  liveUrl: string;
  aiLogUrl: string;
  updatedAtIso: string;
};

export async function getTeamSubmission(
  teamId: string,
): Promise<TeamSubmission | null> {
  const row = await prisma.hackathonSubmission.findUnique({
    where: { teamId },
    select: {
      problemId: true,
      repoUrl: true,
      liveUrl: true,
      aiLogUrl: true,
      updatedAt: true,
    },
  });

  if (!row) return null;

  return {
    problemId: row.problemId,
    repoUrl: row.repoUrl,
    liveUrl: row.liveUrl,
    aiLogUrl: row.aiLogUrl,
    updatedAtIso: row.updatedAt.toISOString(),
  };
}
