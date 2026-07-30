import "server-only";

import { prisma } from "@/lib/db";

/**
 * Earliest registration date per user (StudentProfile.createdAt vs
 * HackathonParticipant.createdAt), for anyone whose profile OR hackathon
 * row was created at/after `since`. One entry per person - a challenge
 * student who also joined the hackathon appears once, at the earlier date.
 *
 * Each row carries its counterpart's date so a user whose earliest
 * registration predates `since` is correctly excluded by the caller's
 * window filter, even when their other row falls inside the window.
 */
export async function getRegistrationDatesSince(since: Date): Promise<Date[]> {
  const [profileRows, participantRows] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { createdAt: { gte: since } },
      select: {
        userId: true,
        createdAt: true,
        user: { select: { hackathonParticipant: { select: { createdAt: true } } } },
      },
    }),
    prisma.hackathonParticipant.findMany({
      where: { createdAt: { gte: since } },
      select: {
        userId: true,
        createdAt: true,
        user: { select: { studentProfile: { select: { createdAt: true } } } },
      },
    }),
  ]);

  const earliestByUser = new Map<string, Date>();

  const note = (userId: string, date: Date | null | undefined) => {
    if (!date) return;

    const prev = earliestByUser.get(userId);
    if (!prev || date < prev) {
      earliestByUser.set(userId, date);
    }
  };

  for (const row of profileRows) {
    note(row.userId, row.createdAt);
    note(row.userId, row.user.hackathonParticipant?.createdAt);
  }

  for (const row of participantRows) {
    note(row.userId, row.createdAt);
    note(row.userId, row.user.studentProfile?.createdAt);
  }

  return [...earliestByUser.values()];
}

/** Count of distinct people who have registered for anything (all time). */
export async function countRegisteredUsers(): Promise<number> {
  return prisma.user.count({
    where: {
      OR: [{ studentProfile: { isNot: null } }, { hackathonParticipant: { isNot: null } }],
    },
  });
}
