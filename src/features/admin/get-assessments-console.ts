import { prisma } from "@/lib/db";

export async function getAssessmentsConsole() {
  const [total, published, drafts, rows] = await Promise.all([
    prisma.recruiterAssessment.count(),
    prisma.recruiterAssessment.count({ where: { status: "PUBLISHED" } }),
    prisma.recruiterAssessment.count({ where: { status: "DRAFT" } }),
    prisma.recruiterAssessment.findMany({
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
        createdBy: { select: { email: true, name: true } },
        _count: { select: { assignments: true, questions: true } },
      },
    }),
  ]);

  return { total, published, drafts, rows };
}
