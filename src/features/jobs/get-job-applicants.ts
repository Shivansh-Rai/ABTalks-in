import { prisma } from "@/lib/db";
import { listCandidateProfiles } from "@/repositories/candidate";
import { displayedChallengeDomains } from "@/repositories/enrollment-state";

export async function getJobApplicants(jobId: string) {
  const rows = await prisma.jobApplication.findMany({
    where: { jobId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      note: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  const identities = await listCandidateProfiles(rows.map((r) => r.user.id));
  const domains = await displayedChallengeDomains(
    rows.map((row) => ({
      userId: row.user.id,
      legacy: null,
    })),
  );

  return rows.map((row) => {
    const identity = identities.get(row.user.id);
    const merged = {
      fullName: identity?.fullName ?? null,
      phone: identity?.phone ?? null,
      domain: domains.get(row.user.id) ?? null,
      linkedinUrl: identity?.linkedinUrl ?? null,
      githubUsername: identity?.githubUsername ?? null,
      college: identity?.college ?? null,
      graduationYear: identity?.graduationYear ?? null,
      isReadyForInterview: identity?.isReadyForInterview ?? false,
    };
    return {
      ...row,
      user: {
        ...row.user,
        studentProfile: merged,
      },
    };
  });
}
