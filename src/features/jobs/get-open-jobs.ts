import { prisma } from "@/lib/db";

export async function getOpenJobs() {
  return prisma.job.findMany({
    where: { isOpen: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      company: true,
      location: true,
      type: true,
      createdAt: true,
    },
  });
}
