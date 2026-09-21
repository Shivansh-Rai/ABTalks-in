import { cache } from "react";
import { prisma } from "@/lib/db";
import { getCandidateProfile } from "@/repositories/candidate";

/**
 * User plus current identity. Candidate identity/referral come from
 * CandidateProfile; StudentProfile remains for later-family columns (domain,
 * ambassador). Wrapped in React `cache()` so repeat calls within a single
 * render collapse.
 */
export const getUserWithProfile = cache(async (userId: string) => {
  const [user, identity] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        studentProfile: {
          select: {
            domain: true,
            isCampusAmbassadorCandidate: true,
            ambassadorDismissedAt: true,
          },
        },
      },
    }),
    getCandidateProfile(userId),
  ]);
  if (!user) return null;
  const sp = user.studentProfile;
  return {
    ...user,
    studentProfile: identity
      ? {
          fullName: identity.fullName,
          domain: sp?.domain ?? null,
          userType: identity.userType,
          college: identity.college,
          organization: identity.organization,
          role: identity.role,
          referralCode: identity.referralCode,
          isReadyForInterview: identity.isReadyForInterview,
          isCampusAmbassadorCandidate:
            identity.isCampusAmbassadorCandidate ||
            (sp?.isCampusAmbassadorCandidate ?? false),
          ambassadorDismissedAt:
            identity.ambassadorDismissedAt ?? sp?.ambassadorDismissedAt ?? null,
          phone: identity.phone,
          phoneVerified: identity.phoneVerified,
        }
      : null,
  };
});
