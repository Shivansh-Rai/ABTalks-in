import { Domain, EnrollmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

type Input = {
  search?: string;
  domain?: "AI" | "DS" | "SE" | "CLAUDE" | "ALL";
  status?: "ALL" | "ACTIVE" | "COMPLETED";
  sortBy?: "recent" | "days" | "streak" | "referrals";
};

export type StudentDomainCounts = Record<
  "ALL" | "SE" | "DS" | "AI" | "CLAUDE",
  number
>;

export async function getStudents(
  input: Input,
): Promise<
  Array<{
    enrollmentId: string;
    userId: string;
    fullName: string;
    email: string;
    domain: string;
    daysCompleted: number;
    currentStreak: number;
    status: string;
    joinedAt: Date;
    isReadyForInterview: boolean;
    userType: string;
    affiliation: string;
    referralCount: number;
  }>
> {
  const q = input.search?.trim();
  const domainFilter =
    input.domain && input.domain !== "ALL" ? (input.domain as Domain) : undefined;
  const statusFilter =
    input.status && input.status !== "ALL"
      ? (input.status as EnrollmentStatus)
      : undefined;
  const sortBy = input.sortBy ?? "recent";

  const orderBy =
    sortBy === "days"
      ? [{ lastSubmittedDay: "desc" as const }, { createdAt: "desc" as const }]
      : sortBy === "streak"
        ? [{ currentStreak: "desc" as const }, { createdAt: "desc" as const }]
        : sortBy === "referrals"
          ? [{ createdAt: "desc" as const }]
          : [{ createdAt: "desc" as const }];

  const rows = await prisma.enrollment.findMany({
    where: {
      ...(domainFilter ? { domain: domainFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(q
        ? {
            user: {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                {
                  studentProfile: {
                    fullName: { contains: q, mode: "insensitive" },
                  },
                },
              ],
            },
          }
        : {}),
    },
    orderBy,
    take: 100,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          createdAt: true,
          studentProfile: {
            select: {
              fullName: true,
              domain: true,
              isReadyForInterview: true,
              userType: true,
              college: true,
              organization: true,
            },
          },
        },
      },
    },
  });

  const referralCounts = await prisma.referral.groupBy({
    by: ["referrerId"],
    _count: { _all: true },
  });

  const countMap = new Map(
    referralCounts.map((r) => [r.referrerId, r._count._all]),
  );

  const students = rows.map((row) => ({
    enrollmentId: row.id,
    userId: row.user.id,
    fullName:
      row.user.studentProfile?.fullName?.trim() ||
      row.user.email ||
      "Unknown",
    email: row.user.email,
    domain: row.domain,
    daysCompleted: row.daysCompleted,
    currentStreak: row.currentStreak,
    status: row.status,
    joinedAt: row.user.createdAt,
    isReadyForInterview: row.user.studentProfile?.isReadyForInterview ?? false,
    userType: row.user.studentProfile?.userType ?? "STUDENT",
    affiliation:
      row.user.studentProfile?.userType === "PROFESSIONAL"
        ? (row.user.studentProfile?.organization ?? "—")
        : (row.user.studentProfile?.college ?? "—"),
    referralCount: countMap.get(row.user.id) ?? 0,
  }));

  if (sortBy === "referrals") {
    students.sort((a, b) => b.referralCount - a.referralCount);
  }

  return students;
}

export async function getStudentDomainCounts(
  status?: "ALL" | "ACTIVE" | "COMPLETED",
): Promise<StudentDomainCounts> {
  const statusFilter =
    status && status !== "ALL" ? (status as EnrollmentStatus) : undefined;

  const grouped = await prisma.enrollment.groupBy({
    by: ["domain"],
    where: statusFilter ? { status: statusFilter } : undefined,
    _count: { _all: true },
  });

  const counts: StudentDomainCounts = {
    ALL: 0,
    SE: 0,
    DS: 0,
    AI: 0,
    CLAUDE: 0,
  };

  for (const row of grouped) {
    const n = row._count._all;
    counts[row.domain] = n;
    counts.ALL += n;
  }

  return counts;
}
