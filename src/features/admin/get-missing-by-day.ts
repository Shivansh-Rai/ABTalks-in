import { Domain, EnrollmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canonicalFullNameByUserId } from "@/repositories/candidate";
import { listChallengePeRows } from "@/repositories/enrollment-state";
import { enrollmentIdFromPe, peIdForEnrollment } from "@/repositories/ids";

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

  const enrollments = (await listChallengePeRows({
    domains: domain ? [domain] : undefined,
  })).filter(
    (e) =>
      e.status === EnrollmentStatus.ACTIVE ||
      e.status === EnrollmentStatus.COMPLETED,
  );
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

  const submittedSet = new Set(submittedEnrollmentIds);
  const rows = (await listChallengePeRows({
    domains: domain ? [domain] : undefined,
  })).filter(
    (e) =>
      (e.status === EnrollmentStatus.ACTIVE ||
        e.status === EnrollmentStatus.COMPLETED) &&
      !submittedSet.has(e.id),
  );

  const names = await canonicalFullNameByUserId(rows.map((r) => r.userId));
  const users = await prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.userId) } },
    select: { id: true, email: true },
  });
  const emailByUser = new Map(users.map((u) => [u.id, u.email]));
  rows.sort((a, b) => b.daysCompleted - a.daysCompleted);
  return rows.map((r) => ({
    enrollmentId: r.id,
    userId: r.userId,
    studentName: names.get(r.userId)?.trim() || emailByUser.get(r.userId) || "Unknown",
    email: emailByUser.get(r.userId) ?? "",
    domain: r.domain,
    status: r.status,
    daysCompleted: r.daysCompleted,
    lastSubmittedDay: r.lastSubmittedDay,
  }));
}
