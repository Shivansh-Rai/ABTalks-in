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
          studentProfile: {
            select: {
              fullName: true,
              phone: true,
              domain: true,
              linkedinUrl: true,
              githubUsername: true,
              college: true,
              graduationYear: true,
              isReadyForInterview: true,
            },
          },
        },
      },
    },
  });

  const identities = await listCandidateProfiles(rows.map((r) => r.user.id));
  const domains = await displayedChallengeDomains(
    rows.map((row) => ({
      userId: row.user.id,
      legacy: row.user.studentProfile?.domain ?? null,
    })),
  );

  return rows.map((row) => {
    const identity = identities.get(row.user.id);
    const sp = row.user.studentProfile;
    const merged = {
      fullName: identity?.fullName ?? sp?.fullName ?? null,
      phone: identity?.phone ?? sp?.phone ?? null,
      domain: domains.get(row.user.id) ?? null,
      linkedinUrl: identity?.linkedinUrl ?? sp?.linkedinUrl ?? null,
      githubUsername: identity?.githubUsername ?? sp?.githubUsername ?? null,
      college: identity?.college ?? sp?.college ?? null,
      graduationYear: identity?.graduationYear ?? sp?.graduationYear ?? null,
      isReadyForInterview:
        identity?.isReadyForInterview ?? sp?.isReadyForInterview ?? false,
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
