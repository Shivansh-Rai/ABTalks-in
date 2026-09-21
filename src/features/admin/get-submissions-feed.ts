import { SubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canonicalFullNameByUserId } from "@/repositories/candidate";
import { listCanonicalChallengeFeed } from "@/repositories/progress";

export async function getSubmissionsFeed(input: {
  domain?: string;
  status?: "ALL" | "ON_TIME" | "LATE";
  minDay?: number;
  maxDay?: number;
  take?: number;
}): Promise<
  Array<{
    id: string;
    userId: string;
    studentName: string;
    domain: string;
    dayNumber: number;
    status: string;
    githubUrl: string | null;
    linkedinUrl: string | null;
    submittedAt: Date;
  }>
> {
  const domainFilter =
    input.domain && input.domain !== "ALL" ? input.domain : undefined;
  const statusFilter =
    input.status && input.status !== "ALL"
      ? (input.status as SubmissionStatus)
      : undefined;

  const rows = await listCanonicalChallengeFeed({
    domain: domainFilter,
    status: statusFilter,
    minDay: input.minDay,
    maxDay: input.maxDay,
    take: input.take ?? 100,
  });

  const names = await canonicalFullNameByUserId(rows.map((row) => row.userId));
  const users = await prisma.user.findMany({
    where: { id: { in: rows.map((row) => row.userId) } },
    select: {
      id: true,
      email: true,
      studentProfile: { select: { fullName: true } },
    },
  });
  const userById = new Map(users.map((u) => [u.id, u]));
  return rows.map((row) => {
    const user = userById.get(row.userId);
    return {
      id: row.id,
      userId: row.userId,
      studentName:
        names.get(row.userId)?.trim() ||
        user?.studentProfile?.fullName?.trim() ||
        user?.email ||
        "Unknown",
      domain: row.domain,
      dayNumber: row.dayNumber,
      status: row.status,
      githubUrl: row.githubUrl,
      linkedinUrl: row.linkedinUrl,
      submittedAt: row.submittedAt,
    };
  });
}
