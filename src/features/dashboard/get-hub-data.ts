import type { Domain } from "@prisma/client";
import { isProgramEnabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/db";
import { getUserActiveEnrollments } from "@/features/enrollment/get-user-enrollments";
import type { UserEnrollmentSummary } from "@/features/enrollment/get-user-enrollments";
import { isUserRegistered } from "@/features/hackathon/registration-status";
import { resolveProgramMemberForUser } from "@/lib/program-auth";
import {
  getActivityHeatmap,
  type ActivityHeatmap,
} from "@/features/dashboard/get-activity-heatmap";

export type HubDataNoUser = {
  hasUser: false;
};

export type HubData = {
  hasUser: true;
  profile: { fullName: string; referralCode: string } | null;
  enrollments: UserEnrollmentSummary[];
  allEnrollmentDomains: Domain[];
  hasProgramMembership: boolean;
  isHackathonRegistered: boolean;
  heatmap: ActivityHeatmap;
  streak: { current: number; longest: number };
};

export async function getHubData(
  userId: string,
): Promise<HubData | HubDataNoUser> {
  const programEnabled = isProgramEnabled();

  const [
    user,
    enrollments,
    allEnrollments,
    streakRows,
    hasProgramMembership,
    isHackathonRegistered,
    heatmap,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        studentProfile: {
          select: { fullName: true, referralCode: true },
        },
      },
    }),
    getUserActiveEnrollments(userId),
    prisma.enrollment.findMany({
      where: { userId },
      select: { domain: true },
    }),
    prisma.enrollment.findMany({
      where: { userId },
      select: { currentStreak: true, longestStreak: true },
    }),
    programEnabled
      ? resolveProgramMemberForUser(userId).then((m) => m !== null)
      : Promise.resolve(false),
    isUserRegistered(userId),
    getActivityHeatmap(userId),
  ]);

  if (!user) {
    return { hasUser: false };
  }

  const profile = user.studentProfile
    ? {
        fullName: user.studentProfile.fullName,
        referralCode: user.studentProfile.referralCode,
      }
    : null;

  const allEnrollmentDomains = [
    ...new Set(allEnrollments.map((e) => e.domain)),
  ];

  let current = 0;
  let longest = 0;
  for (const row of streakRows) {
    current = Math.max(current, row.currentStreak);
    longest = Math.max(longest, row.longestStreak);
  }

  return {
    hasUser: true,
    profile,
    enrollments,
    allEnrollmentDomains,
    hasProgramMembership,
    isHackathonRegistered,
    heatmap,
    streak: { current, longest },
  };
}
