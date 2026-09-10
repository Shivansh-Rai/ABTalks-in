import "server-only";

import { prisma } from "@/lib/db";

const WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

export type ProfilePerformance = {
  searchAppearances: number;
  recruiterActions: number;
};

/**
 * Candidate-facing Profile Performance counters over a rolling 90 days.
 *
 * searchAppearances = DETAIL_VIEW events (inspector opened).
 * recruiterActions = RESUME_UNLOCK events (genuine unlock; today CONTACT_SHARED).
 */
export async function getProfilePerformance(
  candidateUserId: string,
  now: Date = new Date(),
): Promise<ProfilePerformance> {
  const since = new Date(now.getTime() - WINDOW_MS);

  const [searchAppearances, recruiterActions] = await Promise.all([
    prisma.candidateProfileEvent.count({
      where: {
        candidateUserId,
        type: "DETAIL_VIEW",
        occurredAt: { gte: since },
      },
    }),
    prisma.candidateProfileEvent.count({
      where: {
        candidateUserId,
        type: "RESUME_UNLOCK",
        occurredAt: { gte: since },
      },
    }),
  ]);

  return { searchAppearances, recruiterActions };
}
