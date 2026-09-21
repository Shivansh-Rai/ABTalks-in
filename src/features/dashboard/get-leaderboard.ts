import { Domain } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isNewEnrollmentStateEnabled } from "@/lib/feature-flags";
import { listCandidateProfiles } from "@/repositories/candidate";
import { overlayChallengeProgressFields } from "@/repositories/progress";

export type LeaderboardRow = {
  rank: number;
  enrollmentId: string;
  userId: string;
  fullName: string;
  college: string;
  domain: Domain;
  daysCompleted: number;
  currentStreak: number;
  longestStreak: number;
  isReadyForInterview: boolean;
  isViewer: boolean;
};

export type LeaderboardResult = {
  rows: LeaderboardRow[];
  totalCount: number;
};

export async function getLeaderboard(
  input: {
    domain?: "AI" | "DS" | "SE" | "CLAUDE" | "ALL";
    search?: string;
    limit?: number;
    viewerUserId?: string;
    /** When false and domain is ALL, CLAUDE rows are hidden (feature flag off). */
    claudeLeaderboardEnabled?: boolean;
  },
): Promise<LeaderboardResult> {
  const domain = input.domain ?? "ALL";
  const search = input.search?.trim() ?? "";
  const limit = Math.max(1, Math.min(input.limit ?? 100, 200));

  const claudeLeaderboardEnabled = input.claudeLeaderboardEnabled ?? true;
  const hideClaudeFromAll = !claudeLeaderboardEnabled && domain === "ALL";

  const where = {
    status: { not: "ABANDONED" as const },
    ...(hideClaudeFromAll ? { domain: { not: Domain.CLAUDE } } : {}),
    ...(domain !== "ALL" ? { domain } : {}),
    ...(search
      ? {
          user: {
            OR: [
              {
                studentProfile: {
                  fullName: { contains: search, mode: "insensitive" as const },
                },
              },
              {
                candidateProfile: {
                  fullName: { contains: search, mode: "insensitive" as const },
                },
              },
            ],
          },
        }
      : {}),
  };

  const [enrollments, totalCount] = await Promise.all([
    prisma.enrollment.findMany({
      where,
      orderBy: [
        { daysCompleted: "desc" },
        { currentStreak: "desc" },
        { longestStreak: "desc" },
        { startedAt: "asc" },
      ],
      ...(isNewEnrollmentStateEnabled() ? {} : { take: limit }),
      select: {
        id: true,
        userId: true,
        domain: true,
        daysCompleted: true,
        currentStreak: true,
        longestStreak: true,
        lastSubmittedDay: true,
        user: {
          select: {
            studentProfile: {
              select: {
                fullName: true,
                college: true,
                isReadyForInterview: true,
              },
            },
          },
        },
      },
    }),
    prisma.enrollment.count({ where }),
  ]);

  const identities = await listCandidateProfiles(enrollments.map((e) => e.userId));
  const overlaid = await overlayChallengeProgressFields(enrollments);
  overlaid.sort((a, b) => {
    if (b.daysCompleted !== a.daysCompleted) return b.daysCompleted - a.daysCompleted;
    if (b.currentStreak !== a.currentStreak) return b.currentStreak - a.currentStreak;
    if (b.longestStreak !== a.longestStreak) return b.longestStreak - a.longestStreak;
    return 0;
  });
  const ranked = isNewEnrollmentStateEnabled() ? overlaid.slice(0, limit) : overlaid;
  const rows: LeaderboardRow[] = ranked.map((e, index) => {
    const identity = identities.get(e.userId);
    const sp = e.user.studentProfile;
    return {
      rank: index + 1,
      enrollmentId: e.id,
      userId: e.userId,
      fullName: identity?.fullName?.trim() || sp?.fullName || "Unknown",
      college: identity?.college || sp?.college || "Unknown",
      domain: e.domain,
      daysCompleted: e.daysCompleted,
      currentStreak: e.currentStreak,
      longestStreak: e.longestStreak,
      isReadyForInterview:
        identity?.isReadyForInterview ?? sp?.isReadyForInterview ?? false,
      isViewer: e.userId === input.viewerUserId,
    };
  });

  return { rows, totalCount };
}
