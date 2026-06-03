import { Domain, EnrollmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

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

  const totalEnrollments = await prisma.enrollment.count({
    where: enrollmentWhere,
  });

  const grouped = await prisma.submission.groupBy({
    by: ["dayNumber"],
    where: {
      enrollment: enrollmentWhere,
      dayNumber: { gte: 1, lte: 60 },
    },
    _count: { _all: true },
  });

  const byDay = new Map(grouped.map((g) => [g.dayNumber, g._count._all]));

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

  const rows = await prisma.enrollment.findMany({
    where: {
      status: { in: ["ACTIVE", "COMPLETED"] },
      ...(domain ? { domain } : {}),
      submissions: { none: { dayNumber: day } },
    },
    select: {
      id: true,
      domain: true,
      status: true,
      daysCompleted: true,
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

  return rows.map((r) => ({
    enrollmentId: r.id,
    userId: r.user.id,
    studentName:
      r.user.studentProfile?.fullName?.trim() || r.user.email || "Unknown",
    email: r.user.email,
    domain: r.domain,
    status: r.status,
    daysCompleted: r.daysCompleted,
    lastSubmittedDay: r.lastSubmittedDay,
  }));
}
