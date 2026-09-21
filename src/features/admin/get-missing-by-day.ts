import { Domain, EnrollmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canonicalFullNameByUserId } from "@/repositories/candidate";
import { enrollmentIdFromPe, peIdForEnrollment } from "@/repositories/ids";
import { overlayChallengeProgressFields } from "@/repositories/progress";

type Filters = {
  domain?: Domain | "ALL";
};

export type MissingDaySummaryRow = {
  day: number;
  totalEnrollments: number;
  submitted: number;
  missing: number;
  pctSubmitted: number;
};

export type MissingStudentRow = {
  enrollmentId: string;
  userId: string;
  studentName: string;
  email: string;
  domain: Domain;
  status: EnrollmentStatus;
  daysCompleted: number;
  lastSubmittedDay: number | null;
};

export async function getMissingByDayCounts(
  filters: Filters,
): Promise<MissingDaySummaryRow[]> {
  const domain =
    filters.domain && filters.domain !== "ALL" ? filters.domain : undefined;

  const enrollmentWhere = {
    status: { in: ["ACTIVE", "COMPLETED"] as EnrollmentStatus[] },
    ...(domain ? { domain } : {}),
  };

  const enrollments = await prisma.enrollment.findMany({
    where: enrollmentWhere,
    select: { id: true },
  });
  const totalEnrollments = enrollments.length;
  const peIds = enrollments.map((row) => peIdForEnrollment(row.id));
  const attempts =
    peIds.length === 0
      ? []
      : await prisma.activityAttempt.findMany({
          where: {
            enrollmentId: { in: peIds },
            id: { startsWith: "aa_sub_" },
            activity: { dayNumber: { gte: 1, lte: 60 } },
          },
          select: { activity: { select: { dayNumber: true } } },
        });
  const byDay = new Map<number, number>();
  for (const row of attempts) {
    const dayNumber = row.activity.dayNumber;
    if (dayNumber == null) continue;
    byDay.set(dayNumber, (byDay.get(dayNumber) ?? 0) + 1);
  }

  const rows: MissingDaySummaryRow[] = [];
  for (let d = 1; d <= 60; d++) {
    const submitted = byDay.get(d) ?? 0;
    const missing = Math.max(0, totalEnrollments - submitted);
    const pct = totalEnrollments
      ? Math.round((submitted / totalEnrollments) * 1000) / 10
      : 0;
    rows.push({
      day: d,
      totalEnrollments,
      submitted,
      missing,
      pctSubmitted: pct,
    });
  }
  return rows;
}

export async function getMissingStudentsForDay(
  day: number,
  filters: Filters,
): Promise<MissingStudentRow[]> {
  if (day < 1 || day > 60) {
    return [];
  }

  const domain =
    filters.domain && filters.domain !== "ALL" ? filters.domain : undefined;

  const submitted = await prisma.activityAttempt.findMany({
    where: {
      id: { startsWith: "aa_sub_" },
      activity: { dayNumber: day },
    },
    select: { enrollmentId: true },
  });
  const submittedEnrollmentIds = submitted
    .map((row) => enrollmentIdFromPe(row.enrollmentId))
    .filter((id): id is string => Boolean(id));

  const rows = await prisma.enrollment.findMany({
    where: {
      status: { in: ["ACTIVE", "COMPLETED"] },
      ...(domain ? { domain } : {}),
      ...(submittedEnrollmentIds.length > 0
        ? { id: { notIn: submittedEnrollmentIds } }
        : {}),
    },
    select: {
      id: true,
      domain: true,
      status: true,
      daysCompleted: true,
      currentStreak: true,
      longestStreak: true,
      lastSubmittedDay: true,
      user: {
        select: {
          id: true,
          email: true,
          studentProfile: { select: { fullName: true } },
        },
      },
    },
    orderBy: [{ daysCompleted: "desc" }, { startedAt: "asc" }],
  });

  const names = await canonicalFullNameByUserId(rows.map((r) => r.user.id));
  const overlaid = await overlayChallengeProgressFields(rows);
  return overlaid.map((r) => ({
    enrollmentId: r.id,
    userId: r.user.id,
    studentName:
      names.get(r.user.id)?.trim() ||
      r.user.studentProfile?.fullName?.trim() ||
      r.user.email ||
      "Unknown",
    email: r.user.email,
    domain: r.domain,
    status: r.status,
    daysCompleted: r.daysCompleted,
    lastSubmittedDay: r.lastSubmittedDay,
  }));
}
