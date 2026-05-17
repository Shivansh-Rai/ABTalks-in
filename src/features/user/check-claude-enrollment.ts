import { Domain } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function shouldShowClaudeBanner(userId: string): Promise<{
  show: boolean;
  startsAt: Date | null;
}> {
  const challenge = await prisma.challenge.findUnique({
    where: { domain: Domain.CLAUDE },
    select: { startsAt: true },
  });

  if (!challenge?.startsAt) {
    return { show: false, startsAt: null };
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      userId,
      domain: Domain.CLAUDE,
    },
    select: { id: true },
  });

  if (enrollment) {
    return { show: false, startsAt: null };
  }

  return { show: true, startsAt: challenge.startsAt };
}
