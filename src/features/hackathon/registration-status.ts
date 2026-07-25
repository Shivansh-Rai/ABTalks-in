import "server-only";
import { prisma } from "@/lib/db";

export async function isUserRegistered(userId: string): Promise<boolean> {
  const row = await prisma.hackathonParticipant.findUnique({
    where: { userId },
    select: { id: true },
  });
  return row !== null;
}

/**
 * For a logged-in user WITHOUT a 60-day profile: return "/hackathon/dashboard" if they
 * registered for the hackathon, else null (caller proceeds to the normal /register
 * funnel). Fails open to null on any error so legitimate new 60-day users are never
 * blocked from registering.
 */
export async function hackathonRedirectForProfilelessUser(
  userId: string | null | undefined,
): Promise<"/hackathon/dashboard" | null> {
  if (!userId) return null;
  try {
    const registered = await isUserRegistered(userId);
    return registered ? "/hackathon/dashboard" : null;
  } catch {
    return null;
  }
}
