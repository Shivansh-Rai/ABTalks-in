import { prisma } from "@/lib/db";

export async function getOpenJobs() {
  return prisma.job.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      company: true,
      location: true,
      type: true,
      workMode: true,
      createdAt: true,
    },
  });
}
