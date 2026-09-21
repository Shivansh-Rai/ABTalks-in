import { prisma } from "@/lib/db";
import { listCandidateProfiles } from "@/repositories/candidate";

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
          {
            candidateProfile: {
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

  const names = await listCandidateProfiles(candidates.map((c) => c.id));
  const namedCandidates = candidates.map((c) => ({
    ...c,
    studentProfile: {
      fullName:
        names.get(c.id)?.fullName ?? c.studentProfile?.fullName ?? c.name ?? c.email,
    },
  }));

  return { candidates: namedCandidates, recruiters, jobs, assessments };
}
