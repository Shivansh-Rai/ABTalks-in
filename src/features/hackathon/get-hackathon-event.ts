import "server-only";
import { prisma } from "@/lib/db";

export async function getHackathonEvent(): Promise<{
  problemStatement: string | null;
}> {
  const event = await prisma.hackathonEvent.findUnique({
    where: { id: 1 },
    select: { problemStatement: true },
  });
  return { problemStatement: event?.problemStatement ?? null };
}
