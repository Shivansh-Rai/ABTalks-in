import { EnrollmentStatus, type UserType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCandidateProfile } from "@/repositories/candidate";
import { displayedChallengeDomain, listChallengePeRows } from "@/repositories/enrollment-state";

export type PublicProfile = {
  fullName: string;
  userType: UserType;
  domain: string | null;
  college: string | null;
  graduationYear: number | null;
  organization: string | null;
  role: string | null;
  yearsExperience: number | null;
  skills: string[];
  linkedinUrl: string | null;
  githubUsername: string | null;
  joinedAt: Date;
  daysCompleted: number;
  currentStreak: number;
  longestStreak: number;
  isReadyForInterview: boolean;
};

type ProfileDomainEnrollment = {
  id: string;
  status: EnrollmentStatus;
  daysCompleted: number;
  currentStreak: number;
  longestStreak: number;
};

/** Enrollment for public profile heatmap + stats — first-joined track. */
async function resolvePublicProfileEnrollment(
  userId: string,
): Promise<ProfileDomainEnrollment | null> {
  const domain = await displayedChallengeDomain(userId, null);

  if (!domain) {
    return null;
  }

  const overlaid = await listChallengePeRows({
    userId,
    domains: [domain],
    excludeAbandoned: true,
  });
  overlaid.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  if (overlaid.length === 0) {
    return null;
  }

  const active = overlaid.find((e) => e.status === EnrollmentStatus.ACTIVE);
  return active ?? overlaid[0]!;
}

export async function getPublicProfile(
  userId: string,
): Promise<PublicProfile | null> {
  const [user, candidate, domainEnrollment] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true },
    }),
    getCandidateProfile(userId),
    resolvePublicProfileEnrollment(userId),
  ]);

  if (!user || !candidate) {
    return null;
  }

  return {
    fullName: candidate.fullName,
    userType: candidate.userType as UserType,
    domain: await displayedChallengeDomain(userId, null),
    college: candidate.college,
    graduationYear: candidate.graduationYear,
    organization: candidate.organization,
    role: candidate.role,
    yearsExperience: candidate.yearsExperience,
    skills: candidate.skills,
    linkedinUrl: candidate.linkedinUrl,
    githubUsername: candidate.githubUsername,
    joinedAt: user.createdAt,
    daysCompleted: domainEnrollment?.daysCompleted ?? 0,
    currentStreak: domainEnrollment?.currentStreak ?? 0,
    longestStreak: domainEnrollment?.longestStreak ?? 0,
    isReadyForInterview: candidate.isReadyForInterview,
  };
}

export async function getPublicEnrollmentId(
  userId: string,
): Promise<string | null> {
  const enrollment = await resolvePublicProfileEnrollment(userId);
  return enrollment?.id ?? null;
}
