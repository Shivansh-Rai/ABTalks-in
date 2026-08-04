import "server-only";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export interface MyRegistration {
  id: string;
  name: string;
  createdAt: Date;
}

/**
 * The signed-in user's registration for one event, so the form can be replaced
 * with a "you're registered" panel. Fails soft to null — worst case the user
 * sees the form and the unique constraint catches the duplicate.
 *
 * Legacy rows migrated from Supabase have userId = null, so a pre-auth attendee
 * who signs in later will NOT match here. That is expected: they see the form,
 * and submitting hits @@unique([eventId, email]) with the duplicate message.
 */
export async function getMyRegistration(
  userId: string,
  eventId: string,
): Promise<MyRegistration | null> {
  try {
    return await prisma.workshopRegistration.findUnique({
      where: { eventId_userId: { eventId, userId } },
      select: { id: true, name: true, createdAt: true },
    });
  } catch (err) {
    logger.error("Failed to load workshop registration status", {
      eventId,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
