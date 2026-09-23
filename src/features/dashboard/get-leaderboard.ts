import { Domain } from "@prisma/client";
import { listCandidateProfiles } from "@/repositories/candidate";
import { listChallengePeRows } from "@/repositories/enrollment-state";

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

  const domains =
    domain === "ALL"
      ? hideClaudeFromAll
        ? [Domain.AI, Domain.DS, Domain.SE]
        : [Domain.AI, Domain.DS, Domain.SE, Domain.CLAUDE]
      : [domain as Domain];

  const overlaid = await listChallengePeRows({
    domains,
    excludeAbandoned: true,
    searchName: search || undefined,
  });
  const totalCount = overlaid.length;
  overlaid.sort((a, b) => {
    if (b.daysCompleted !== a.daysCompleted) return b.daysCompleted - a.daysCompleted;
    if (b.currentStreak !== a.currentStreak) return b.currentStreak - a.currentStreak;
    if (b.longestStreak !== a.longestStreak) return b.longestStreak - a.longestStreak;
    return a.startedAt.getTime() - b.startedAt.getTime();
  });
  const ranked = overlaid.slice(0, limit);
  const identities = await listCandidateProfiles(ranked.map((e) => e.userId));
  const rows: LeaderboardRow[] = ranked.map((e, index) => {
    const identity = identities.get(e.userId);
    return {
      rank: index + 1,
      enrollmentId: e.id,
      userId: e.userId,
      fullName: identity?.fullName?.trim() || "Unknown",
      college: identity?.college || "Unknown",
      domain: e.domain,
      daysCompleted: e.daysCompleted,
      currentStreak: e.currentStreak,
      longestStreak: e.longestStreak,
      isReadyForInterview: identity?.isReadyForInterview ?? false,
      isViewer: e.userId === input.viewerUserId,
    };
  });

  return { rows, totalCount };
}
