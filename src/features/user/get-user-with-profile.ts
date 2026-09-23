import { cache } from "react";
import { prisma } from "@/lib/db";
import { getCandidateProfile } from "@/repositories/candidate";
import { getAmbassadorState } from "@/repositories/ambassador";
import { displayedChallengeDomain } from "@/repositories/enrollment-state";

/**
 * User plus current identity. Candidate identity/referral come from
 * CandidateProfile. Challenge domain comes from ProgramEnrollment.
 * Ambassador candidacy comes from CampusAmbassadorApplication.
 * Wrapped in React `cache()` so repeat calls within a single render collapse.
 */
export const getUserWithProfile = cache(async (userId: string) => {
  const [user, identity, ambassador] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    }),
    getCandidateProfile(userId),
    getAmbassadorState(userId),
  ]);
  if (!user) return null;
  const domain = identity ? await displayedChallengeDomain(userId, null) : null;
  return {
    ...user,
    studentProfile: identity
      ? {
          fullName: identity.fullName,
          domain,
          userType: identity.userType,
          college: identity.college,
          organization: identity.organization,
          role: identity.role,
          referralCode: identity.referralCode,
          isReadyForInterview: identity.isReadyForInterview,
          isCampusAmbassadorCandidate: ambassador.isCandidate,
          ambassadorDismissedAt: ambassador.dismissedAt,
          phone: identity.phone,
          phoneVerified: identity.phoneVerified,
        }
      : null,
  };
});
