import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";

export type CachedDailyTask = {
  id: string;
  dayNumber: number;
  title: string;
  problemStatement: string;
  learningObjectives: string[];
  resources: string[];
  tags: string[];
  difficulty: string;
  estimatedMinutes: number;
};

/**
 * All 60 days of immutable task content for a challenge, cached indefinitely
 * (seeded content; only changes on reseed). Keyed + tagged by challengeId so a
 * content reseed can bust it via `revalidateTag('daily-tasks:<challengeId>')`.
 */
export function getDailyTasksCached(
  challengeId: string,
): Promise<CachedDailyTask[]> {
  return unstable_cache(
    async (): Promise<CachedDailyTask[]> => {
      return prisma.dailyTask.findMany({
        where: { challengeId, dayNumber: { gte: 1, lte: 60 } },
        orderBy: { dayNumber: "asc" },
        select: {
          id: true,
          dayNumber: true,
          title: true,
          problemStatement: true,
          learningObjectives: true,
          resources: true,
          tags: true,
          difficulty: true,
          estimatedMinutes: true,
        },
      });
    },
    ["daily-tasks", challengeId],
    { tags: [`daily-tasks:${challengeId}`], revalidate: false },
  )();
}
