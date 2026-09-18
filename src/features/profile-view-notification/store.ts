import "server-only";

import { prisma } from "@/lib/db";

export type ProfileViewStore = {
  /**
   * Returns true if a `profile.viewed` notification for this (candidate,
   * recruiter) pair was created at or after `since`. Backed by the
   * existing `UserNotification` index on `(recipientUserId, createdAt DESC)`.
   */
  hasRecentNotification(
    candidateUserId: string,
    recruiterUserId: string,
    since: Date,
  ): Promise<boolean>;
};

export function prismaProfileViewStore(): ProfileViewStore {
  return {
    async hasRecentNotification(candidateUserId, recruiterUserId, since) {
      const row = await prisma.userNotification.findFirst({
        where: {
          eventType: "profile.viewed",
          recipientUserId: candidateUserId,
          primaryEntityId: recruiterUserId,
          createdAt: { gte: since },
        },
        select: { id: true },
      });
      return row !== null;
    },
  };
}
