import { Domain, EnrollmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentDayNumber } from "@/lib/date-utils";

const DROPOFF_GAP_DAYS = 3;

type Filters = {
  domain?: Domain | "ALL";
};

export type DropoffStudentRow = {
  enrollmentId: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  userType: "STUDENT" | "PROFESSIONAL" | "";
  college: string;
  organization: string;
  domain: Domain;
  status: EnrollmentStatus;
  startedAtIso: string;
  lastSubmittedDay: number | null;
  lastSubmissionDateIso: string | null;
  currentDay: number;
  daysInactive: number;
};

export async function getDropoffStudents(
  filters: Filters,
): Promise<DropoffStudentRow[]> {
  const domain =
    filters.domain && filters.domain !== "ALL" ? filters.domain : undefined;

  const enrollments = await prisma.enrollment.findMany({
    where: {
      status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.ABANDONED] },
      ...(domain ? { domain } : {}),
    },
    select: {
      id: true,
      domain: true,
      status: true,
      startedAt: true,
      lastSubmittedDay: true,
      challenge: { select: { startsAt: true } },
      user: {
        select: {
          id: true,
          email: true,
          studentProfile: {
            select: {
              fullName: true,
              phone: true,
              userType: true,
              college: true,
              organization: true,
            },
          },
        },
      },
      submissions: {
        orderBy: { submittedAt: "desc" },
        take: 1,
        select: { submittedAt: true, dayNumber: true },
      },
    },
  });

  const rows: DropoffStudentRow[] = [];

  for (const e of enrollments) {
    const currentDay = getCurrentDayNumber(
      { startedAt: e.startedAt },
      e.challenge,
    );
    const effectiveLast = e.lastSubmittedDay ?? 0;
    const gap = currentDay - effectiveLast;

    const include =
      e.status === EnrollmentStatus.ABANDONED ||
      (e.status === EnrollmentStatus.ACTIVE && gap >= DROPOFF_GAP_DAYS);

    if (!include) continue;

    const lastSub = e.submissions[0];
    rows.push({
      enrollmentId: e.id,
      userId: e.user.id,
      fullName: e.user.studentProfile?.fullName?.trim() || e.user.email,
      email: e.user.email,
      phone: e.user.studentProfile?.phone ?? "",
      userType: e.user.studentProfile?.userType ?? "",
      college: e.user.studentProfile?.college ?? "",
      organization: e.user.studentProfile?.organization ?? "",
      domain: e.domain,
      status: e.status,
      startedAtIso: e.startedAt.toISOString(),
      lastSubmittedDay: e.lastSubmittedDay,
      lastSubmissionDateIso: lastSub?.submittedAt.toISOString() ?? null,
      currentDay,
      daysInactive: gap,
    });
  }

  rows.sort((a, b) => {
    const av = a.lastSubmittedDay ?? -1;
    const bv = b.lastSubmittedDay ?? -1;
    if (av !== bv) return av - bv;
    return b.daysInactive - a.daysInactive;
  });

  return rows;
}
