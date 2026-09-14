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
  /**
   * Recruiter's display name for the notification title / body. Returns
   * null when the recruiter row is gone (edge case) or has no `name`.
   */
  loadRecruiterName(userId: string): Promise<string | null>;
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

    async loadRecruiterName(userId) {
      const row = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });
      return row?.name?.trim() || null;
    },
  };
}
