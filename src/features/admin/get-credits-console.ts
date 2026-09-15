import { prisma } from "@/lib/db";

export async function getCreditsConsole() {
  const [recruiterCount, latest, spent] = await Promise.all([
    prisma.recruiterProfile.count(),
    prisma.creditTransaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true,
        amount: true,
        balanceAfter: true,
        type: true,
        reason: true,
        createdAt: true,
        recruiter: {
          select: {
            email: true,
            name: true,
            recruiterProfile: { select: { fullName: true, company: true } },
          },
        },
      },
    }),
    prisma.creditTransaction.aggregate({
      where: { amount: { lt: 0 } },
      _sum: { amount: true },
    }),
  ]);

  return {
    recruiterCount,
    spentMinor: Math.abs(spent._sum.amount ?? 0),
    latest,
  };
}
