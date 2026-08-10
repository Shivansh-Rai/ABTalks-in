"use server";

import { Domain } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import {
  getAnalyticsData,
  type TimeRange,
} from "@/features/admin/get-analytics-data";
import { getMissingStudentsForDay } from "@/features/admin/get-missing-by-day";
import { getReferrersInRange } from "@/features/admin/get-referrals-report";
import { getSubmissionsFeed } from "@/features/admin/get-submissions-feed";
import { getHackathonSubmissionsFeed } from "@/features/admin/get-hackathon-submissions-feed";

const SUBMISSIONS_EXPORT_CAP = 10_000;

export async function getStudentsForExport(filters: {
  domain?: Domain | "ALL";
  search?: string;
  track?: "ALL" | "CHALLENGE" | "HACKATHON";
}) {
  await requireAdmin();

  const q = filters.search?.trim();
  const track = filters.track ?? "ALL";
  const wantChallenge = track !== "HACKATHON";
  const wantHackathon =
    track === "HACKATHON" ||
    (track === "ALL" &&
      (!filters.domain || filters.domain === "ALL"));

  const [enrollments, hackathonRows] = await Promise.all([
    wantChallenge
      ? prisma.enrollment.findMany({
          where: {
            ...(filters.domain && filters.domain !== "ALL"
              ? { domain: filters.domain }
              : {}),
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
          select: {
            id: true,
            domain: true,
            status: true,
            startedAt: true,
            daysCompleted: true,
            currentStreak: true,
            longestStreak: true,
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                studentProfile: {
                  select: {
                    fullName: true,
                    phone: true,
                    userType: true,
                    college: true,
                    graduationYear: true,
                    organization: true,
                    role: true,
                    yearsExperience: true,
                    linkedinUrl: true,
                    githubUsername: true,
                    isReadyForInterview: true,
                    referralCode: true,
                  },
                },
              },
            },
          },
          orderBy: [{ lastSubmittedDay: "desc" }, { createdAt: "desc" }],
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
          select: {
            fullName: true,
            email: true,
            phone: true,
            college: true,
            graduationYear: true,
            createdAt: true,
            userId: true,
            team: {
              select: {
                entryType: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const userIds = [
    ...new Set([
      ...enrollments.map((e) => e.user.id),
      ...hackathonRows.map((row) => row.userId),
    ]),
  ];

  const referralCountRows =
    userIds.length > 0
      ? await prisma.referral.groupBy({
          by: ["referrerId"],
          where: { referrerId: { in: userIds } },
          _count: { id: true },
        })
      : [];
  const referralCountMap = new Map(
    referralCountRows.map((r) => [r.referrerId, r._count.id]),
  );

  const challengeExport = enrollments.map((e) => ({
    Track: "CHALLENGE",
    "Full Name": e.user.studentProfile?.fullName ?? e.user.name ?? "",
    Email: e.user.email,
    Phone: e.user.studentProfile?.phone ?? "",
    "User Type": e.user.studentProfile?.userType ?? "",
    Domain: e.domain,
    Status: e.status,
    "Started At": e.startedAt.toISOString().split("T")[0],
    "Days Completed": e.daysCompleted,
    "Current Streak": e.currentStreak,
    "Longest Streak": e.longestStreak,
    College: e.user.studentProfile?.college ?? "",
    "Graduation Year": e.user.studentProfile?.graduationYear ?? "",
    Organization: e.user.studentProfile?.organization ?? "",
    Role: e.user.studentProfile?.role ?? "",
    "Years Experience": e.user.studentProfile?.yearsExperience ?? "",
    LinkedIn: e.user.studentProfile?.linkedinUrl ?? "",
    GitHub: e.user.studentProfile?.githubUsername ?? "",
    "Ready For Interview": e.user.studentProfile?.isReadyForInterview ?? false,
    "Referral Code": e.user.studentProfile?.referralCode ?? "",
    "Referral Count": referralCountMap.get(e.user.id) ?? 0,
  }));

  const hackathonExport = hackathonRows.map((row) => {
    const entryType = row.team.entryType === "SOLO" ? "SOLO" : "TEAM";
    return {
      Track: "HACKATHON",
      "Full Name": row.fullName,
      Email: row.email,
      Phone: row.phone,
      "User Type": "STUDENT",
      Domain: "HACKATHON",
      Status: entryType,
      "Started At": row.createdAt.toISOString().split("T")[0],
      "Days Completed": 0,
      "Current Streak": 0,
      "Longest Streak": 0,
      College: row.college,
      "Graduation Year": row.graduationYear,
      Organization: "",
      Role: "",
      "Years Experience": "",
      LinkedIn: "",
      GitHub: "",
      "Ready For Interview": false,
      "Referral Code": "",
      "Referral Count": referralCountMap.get(row.userId) ?? 0,
    };
  });

  return [...challengeExport, ...hackathonExport];
}

export async function getAnalyticsForExport(range: TimeRange = "daily") {
  await requireAdmin();

  const data = await getAnalyticsData(range);
  const rows: Record<string, string | number>[] = [];

  for (const row of data.domainDistribution) {
    rows.push({
      Section: "Domain Distribution",
      Label: row.name,
      Count: row.value,
    });
  }

  for (const row of data.registrationsSeries) {
    rows.push({
      Section: "Registrations",
      Label: row.label,
      Count: row.count,
    });
  }

  for (const row of data.submissionsSeries) {
    rows.push({
      Section: "Submissions",
      Label: row.label,
      Count: row.count,
    });
  }

  for (const row of data.dropOff) {
    rows.push({
      Section: "Drop-off",
      Label: row.milestone,
      Count: row.count,
    });
  }

  for (const row of data.submissionsByHour) {
    rows.push({
      Section: "Submissions by Hour (IST)",
      Label: row.hour,
      Count: row.count,
    });
  }

  for (const row of data.topPerformers) {
    rows.push({
      Section: "Top Performers",
      Label: row.name,
      Domain: row.domain,
      "Days Completed": row.daysCompleted,
      "Current Streak": row.currentStreak,
    });
  }

  const byDomainStatus = await prisma.enrollment.groupBy({
    by: ["domain", "status"],
    _count: true,
  });

  for (const row of byDomainStatus) {
    rows.push({
      Section: "Enrollments by Domain and Status",
      Domain: row.domain,
      Status: row.status,
      Count: row._count,
    });
  }

  return rows;
}

export async function getSubmissionsForExport(filters: {
  domain?: Domain | "ALL";
  status?: "ALL" | "ON_TIME" | "LATE";
  minDay?: number;
  maxDay?: number;
}) {
  await requireAdmin();

  const rows = await getSubmissionsFeed({
    domain: filters.domain ?? "ALL",
    status: filters.status ?? "ALL",
    minDay: filters.minDay,
    maxDay: filters.maxDay,
    take: SUBMISSIONS_EXPORT_CAP,
  });

  return rows.map((r) => ({
    "Submitted At (UTC)": r.submittedAt.toISOString(),
    Student: r.studentName,
    Day: r.dayNumber,
    Domain: r.domain,
    Status: r.status,
    "GitHub URL": r.githubUrl,
    "LinkedIn URL": r.linkedinUrl,
  }));
}

export async function getMissingStudentsForExport(
  day: number,
  filters: { domain?: Domain | "ALL" },
) {
  await requireAdmin();

  const rows = await getMissingStudentsForDay(day, {
    domain: filters.domain,
  });

  return rows.map((r) => ({
    "Day Missing": day,
    Student: r.studentName,
    Email: r.email,
    Domain: r.domain,
    "Enrollment Status": r.status,
    "Days Completed": r.daysCompleted,
    "Last Submitted Day": r.lastSubmittedDay ?? "",
  }));
}

export async function getHackathonSubmissionsForExport(filters?: {
  problemId?: string;
}) {
  await requireAdmin();

  const rows = await getHackathonSubmissionsFeed({
    problemId: filters?.problemId,
    take: SUBMISSIONS_EXPORT_CAP,
  });

  return rows.map((r) => ({
    Team: r.teamLabel,
    "Team Code": r.teamCode,
    "Entry Type": r.entryType,
    Leader: r.leaderName,
    "Leader Email": r.leaderEmail,
    Brief: r.problemTitle ?? "",
    "Repo URL": r.repoUrl,
    "Live URL": r.liveUrl,
    "AI Log URL": r.aiLogUrl,
    Members: r.memberCount,
    "Updated At (UTC)": r.updatedAt.toISOString(),
  }));
}

export async function getReferrersForExport(range: {
  startKey?: string;
  endKey?: string;
}) {
  await requireAdmin();
  const rows = await getReferrersInRange(range);
  return rows.map((r) => ({
    Name: r.fullName,
    Email: r.email,
    "Referral Count": r.referralCount,
  }));
}
