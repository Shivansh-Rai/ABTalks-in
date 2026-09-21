import type { Domain, UserType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCandidateProfile } from "@/repositories/candidate";
import { displayedChallengeDomain } from "@/repositories/enrollment-state";

export type ProfileUser = {
  email: string;
  image: string | null;
  createdAt: Date;
};

export type ProfileData = {
  fullName: string;
  userType: UserType;
  college: string | null;
  collegeId: string | null;
  graduationYear: number | null;
  organization: string | null;
  role: string | null;
  yearsExperience: number | null;
  domain: Domain | null;
  skills: string[];
  resumeUrl: string | null;
  phone: string | null;
  phoneVerified: boolean;
  linkedinUrl: string | null;
  githubUsername: string | null;
  referralCode: string;
  referralCount: number;
  isReadyForInterview: boolean;
};

export async function getProfile(userId: string): Promise<{
  user: ProfileUser;
  profile: ProfileData | null;
}> {
  const [user, candidate] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        image: true,
        createdAt: true,
        studentProfile: { select: { domain: true } },
      },
    }),
    getCandidateProfile(userId),
  ]);

  if (!user) {
    throw new Error("User not found");
  }

  const { studentProfile, ...userFields } = user;

  // Challenge domain stays on StudentProfile (later family). Identity requires
  // CandidateProfile. A W4-B registration may have no StudentProfile row.
  if (!candidate) {
    return {
      user: userFields,
      profile: null,
    };
  }

  const referralCount = await prisma.referral.count({
    where: { referrerId: userId },
  });

  return {
    user: userFields,
    profile: {
      fullName: candidate.fullName,
      userType: candidate.userType as UserType,
      college: candidate.college,
      collegeId: candidate.collegeId,
      graduationYear: candidate.graduationYear,
      organization: candidate.organization,
      role: candidate.role,
      yearsExperience: candidate.yearsExperience,
      domain: await displayedChallengeDomain(
        userId,
        studentProfile?.domain ?? null,
      ),
      skills: candidate.skills,
      resumeUrl: candidate.resumeUrl,
      phone: candidate.phone,
      phoneVerified: candidate.phoneVerified,
      linkedinUrl: candidate.linkedinUrl,
      githubUsername: candidate.githubUsername,
      referralCode: candidate.referralCode,
      referralCount,
      isReadyForInterview: candidate.isReadyForInterview,
    },
  };
}
