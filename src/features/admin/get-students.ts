import { Domain, EnrollmentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type StudentTrack = "ALL" | "CHALLENGE" | "HACKATHON";

type Input = {
  search?: string;
  domain?: "AI" | "DS" | "SE" | "CLAUDE" | "ALL";
  status?: "ALL" | "ACTIVE" | "COMPLETED";
  sortBy?: "recent" | "days" | "streak" | "referrals";
  track?: StudentTrack;
};

export type StudentDomainCounts = Record<
  "ALL" | "SE" | "DS" | "AI" | "CLAUDE",
  number
>;

export type StudentTrackCounts = Record<StudentTrack, number>;

export type AdminStudentRow = {
  track: "CHALLENGE" | "HACKATHON";
  rowId: string;
  enrollmentId: string | null;
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
};

function includeHackathonRows(input: {
  track: StudentTrack;
  domain?: Input["domain"];
  status?: Input["status"];
}): boolean {
  if (input.track === "CHALLENGE") return false;
  // When track is HACKATHON, ignore domain/status (UI clears them).
  if (input.track === "HACKATHON") return true;
  // track=ALL: only include hackathon when domain and status are unfiltered.
  if (input.domain && input.domain !== "ALL") return false;
  if (input.status && input.status !== "ALL") return false;
  return true;
}

export async function getStudents(input: Input): Promise<AdminStudentRow[]> {
  const q = input.search?.trim();
  const track = input.track ?? "ALL";
  const domainFilter =
    input.domain && input.domain !== "ALL" ? (input.domain as Domain) : undefined;
  const statusFilter =
    input.status && input.status !== "ALL"
      ? (input.status as EnrollmentStatus)
      : undefined;
  const sortBy = input.sortBy ?? "recent";
  const wantChallenge = track !== "HACKATHON";
  const wantHackathon = includeHackathonRows({
    track,
    domain: input.domain,
    status: input.status,
  });

  const challengeOrderBy =
    sortBy === "days"
      ? [{ lastSubmittedDay: "desc" as const }, { createdAt: "desc" as const }]
      : sortBy === "streak"
        ? [{ currentStreak: "desc" as const }, { createdAt: "desc" as const }]
        : [{ createdAt: "desc" as const }];

  const [enrollmentRows, hackathonRows] = await Promise.all([
    wantChallenge
      ? prisma.enrollment.findMany({
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
          orderBy: challengeOrderBy,
          // Fetch enough to merge; final cap applied after merge+sort.
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
        })
      : Promise.resolve([]),
    wantHackathon
      ? prisma.hackathonParticipant.findMany({
          where: q
            ? {
                OR: [
                  { fullName: { contains: q, mode: "insensitive" } },
                  { email: { contains: q, mode: "insensitive" } },
                  {
                    user: {
                      OR: [
                        { name: { contains: q, mode: "insensitive" } },
                        { email: { contains: q, mode: "insensitive" } },
                      ],
                    },
                  },
                ],
              }
            : undefined,
          orderBy: { createdAt: "desc" },
          take: 100,
          select: {
            id: true,
            userId: true,
            fullName: true,
            email: true,
            college: true,
            createdAt: true,
            team: {
              select: {
                entryType: true,
                teamName: true,
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const userIds = [
    ...new Set([
      ...enrollmentRows.map((row) => row.user.id),
      ...hackathonRows.map((row) => row.userId),
    ]),
  ];

  const referralCounts =
    userIds.length > 0
      ? await prisma.referral.groupBy({
          by: ["referrerId"],
          where: { referrerId: { in: userIds } },
          _count: { _all: true },
        })
      : [];

  const countMap = new Map(
    referralCounts.map((r) => [r.referrerId, r._count._all]),
  );

  const students: AdminStudentRow[] = [
    ...enrollmentRows.map((row) => ({
      track: "CHALLENGE" as const,
      rowId: row.id,
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
          ? (row.user.studentProfile?.organization ?? "-")
          : (row.user.studentProfile?.college ?? "-"),
      referralCount: countMap.get(row.user.id) ?? 0,
    })),
    ...hackathonRows.map((row) => {
      const entryType = row.team.entryType === "SOLO" ? "SOLO" : "TEAM";
      return {
        track: "HACKATHON" as const,
        rowId: row.id,
        enrollmentId: null,
        userId: row.userId,
        fullName: row.fullName.trim() || row.email || "Unknown",
        email: row.email,
        domain: "HACKATHON",
        daysCompleted: 0,
        currentStreak: 0,
        status: entryType,
        joinedAt: row.createdAt,
        isReadyForInterview: false,
        userType: "STUDENT",
        affiliation: row.college || "-",
        referralCount: countMap.get(row.userId) ?? 0,
      };
    }),
  ];

  if (sortBy === "referrals") {
    students.sort((a, b) => {
      if (b.referralCount !== a.referralCount) {
        return b.referralCount - a.referralCount;
      }
      return b.joinedAt.getTime() - a.joinedAt.getTime();
    });
  } else if (sortBy === "days") {
    students.sort((a, b) => {
      if (b.daysCompleted !== a.daysCompleted) {
        return b.daysCompleted - a.daysCompleted;
      }
      return b.joinedAt.getTime() - a.joinedAt.getTime();
    });
  } else if (sortBy === "streak") {
    students.sort((a, b) => {
      if (b.currentStreak !== a.currentStreak) {
        return b.currentStreak - a.currentStreak;
      }
      return b.joinedAt.getTime() - a.joinedAt.getTime();
    });
  } else {
    students.sort((a, b) => b.joinedAt.getTime() - a.joinedAt.getTime());
  }

  return students.slice(0, 100);
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

export async function getStudentTrackCounts(input?: {
  search?: string;
  domain?: Input["domain"];
  status?: Input["status"];
}): Promise<StudentTrackCounts> {
  const q = input?.search?.trim();
  const domainFilter =
    input?.domain && input.domain !== "ALL"
      ? (input.domain as Domain)
      : undefined;
  const statusFilter =
    input?.status && input.status !== "ALL"
      ? (input.status as EnrollmentStatus)
      : undefined;

  const challengeWhere: Prisma.EnrollmentWhereInput = {
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
  };

  const hackathonAllowed =
    !domainFilter && !statusFilter;

  const [challengeCount, hackathonCount] = await Promise.all([
    prisma.enrollment.count({ where: challengeWhere }),
    hackathonAllowed
      ? prisma.hackathonParticipant.count({
          where: q
            ? {
                OR: [
                  { fullName: { contains: q, mode: "insensitive" } },
                  { email: { contains: q, mode: "insensitive" } },
                  {
                    user: {
                      OR: [
                        { name: { contains: q, mode: "insensitive" } },
                        { email: { contains: q, mode: "insensitive" } },
                      ],
                    },
                  },
                ],
              }
            : undefined,
        })
      : Promise.resolve(0),
  ]);

  return {
    ALL: challengeCount + hackathonCount,
    CHALLENGE: challengeCount,
    HACKATHON: hackathonCount,
  };
}
