import { prisma } from "@/lib/db";

export async function searchAdminConsole(q: string) {
  const term = q.trim();
  if (term.length < 2) {
    return { candidates: [], recruiters: [], jobs: [], assessments: [] };
  }

  const [candidates, recruiters, jobs, assessments] = await Promise.all([
    prisma.user.findMany({
      where: {
        deletedAt: null,
        recruiterProfile: { is: null },
        OR: [
          { email: { contains: term, mode: "insensitive" } },
          { name: { contains: term, mode: "insensitive" } },
          {
            studentProfile: {
              fullName: { contains: term, mode: "insensitive" },
            },
          },
        ],
      },
      take: 8,
      select: {
        id: true,
        email: true,
        name: true,
        disabledAt: true,
        studentProfile: { select: { fullName: true } },
      },
    }),
    prisma.recruiterProfile.findMany({
      where: {
        OR: [
          { fullName: { contains: term, mode: "insensitive" } },
          { company: { contains: term, mode: "insensitive" } },
          { user: { email: { contains: term, mode: "insensitive" } } },
        ],
      },
      take: 8,
      select: {
        id: true,
        userId: true,
        fullName: true,
        company: true,
        user: { select: { email: true, disabledAt: true } },
      },
    }),
    prisma.job.findMany({
      where: {
        OR: [
          { title: { contains: term, mode: "insensitive" } },
          { company: { contains: term, mode: "insensitive" } },
        ],
      },
      take: 8,
      select: {
        id: true,
        title: true,
        company: true,
        isOpen: true,
      },
    }),
    prisma.recruiterAssessment.findMany({
      where: { title: { contains: term, mode: "insensitive" } },
      take: 8,
      select: {
        id: true,
        title: true,
        status: true,
        createdBy: { select: { email: true, name: true } },
      },
    }),
  ]);

  return { candidates, recruiters, jobs, assessments };
}
