import { prisma } from "@/lib/db";
import { istDateRangeToUtc } from "@/lib/date-utils";
import { listCandidateProfiles } from "@/repositories/candidate";

type Range = { startKey?: string; endKey?: string };

export type ReferrerRow = {
  userId: string;
  fullName: string;
  email: string;
  referralCount: number;
};

export async function getReferrersInRange(range: Range): Promise<ReferrerRow[]> {
  const { startUtc, endExclusiveUtc } = istDateRangeToUtc(range.startKey, range.endKey);
  const createdAt =
    startUtc || endExclusiveUtc
      ? {
          ...(startUtc ? { gte: startUtc } : {}),
          ...(endExclusiveUtc ? { lt: endExclusiveUtc } : {}),
        }
      : undefined;

  const grouped = await prisma.referral.groupBy({
    by: ["referrerId"],
    where: createdAt ? { createdAt } : {},
    _count: { _all: true },
    orderBy: { _count: { referrerId: "desc" } },
    take: 500,
  });
  if (grouped.length === 0) return [];

  const ids = grouped.map((g) => g.referrerId);
  const [users, names] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, email: true },
    }),
    listCandidateProfiles(ids),
  ]);
  const byId = new Map(users.map((u) => [u.id, u]));

  return grouped.map((g) => {
    const u = byId.get(g.referrerId);
    return {
      userId: g.referrerId,
      fullName: names.get(g.referrerId)?.fullName?.trim() || u?.email || "Unknown",
      email: u?.email ?? "",
      referralCount: g._count._all,
    };
  });
}

export type ReferredRow = {
  userId: string;
  fullName: string;
  email: string;
  domain: string | null;
  signedUpAt: Date;
  rewardGiven: boolean;
  daysCompleted: number;
};

export async function getReferredByUser(
  referrerId: string,
  range: Range,
): Promise<{ referrer: { fullName: string; email: string } | null; rows: ReferredRow[] }> {
  const { startUtc, endExclusiveUtc } = istDateRangeToUtc(range.startKey, range.endKey);
  const createdAt =
    startUtc || endExclusiveUtc
      ? {
          ...(startUtc ? { gte: startUtc } : {}),
          ...(endExclusiveUtc ? { lt: endExclusiveUtc } : {}),
        }
      : undefined;

  const [referrerUser, referrals] = await Promise.all([
    prisma.user.findUnique({
      where: { id: referrerId },
      select: { email: true },
    }),
    prisma.referral.findMany({
      where: { referrerId, ...(createdAt ? { createdAt } : {}) },
      orderBy: { createdAt: "desc" },
      select: {
        rewardGiven: true,
        createdAt: true,
        referred: {
          select: {
            id: true,
            email: true,
            studentProfile: { select: { domain: true } },
            enrollments: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { daysCompleted: true },
            },
          },
        },
      },
    }),
  ]);

  const identityIds = [
    referrerId,
    ...referrals.map((r) => r.referred.id),
  ];
  const names = await listCandidateProfiles(identityIds);

  const rows: ReferredRow[] = referrals.map((r) => ({
    userId: r.referred.id,
    fullName:
      names.get(r.referred.id)?.fullName?.trim() || r.referred.email || "Unknown",
    email: r.referred.email,
    domain: r.referred.studentProfile?.domain ?? null,
    signedUpAt: r.createdAt,
    rewardGiven: r.rewardGiven,
    daysCompleted: r.referred.enrollments[0]?.daysCompleted ?? 0,
  }));

  return {
    referrer: referrerUser
      ? {
          fullName:
            names.get(referrerId)?.fullName?.trim() ||
            referrerUser.email ||
            "Unknown",
          email: referrerUser.email,
        }
      : null,
    rows,
  };
}
