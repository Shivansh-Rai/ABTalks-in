import { Domain, EnrollmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentDayNumber } from "@/lib/date-utils";
import { listCandidateProfiles } from "@/repositories/candidate";
import { enrollmentIdFromPe, peIdForEnrollment } from "@/repositories/ids";
import { overlayChallengeProgressFields } from "@/repositories/progress";

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
      daysCompleted: true,
      currentStreak: true,
      longestStreak: true,
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
    },
  });

  const overlaid = await overlayChallengeProgressFields(enrollments);
  const candidates = overlaid.filter((e) => {
    const currentDay = getCurrentDayNumber(
      { startedAt: e.startedAt },
      e.challenge,
    );
    const effectiveLast = e.lastSubmittedDay ?? 0;
    const gap = currentDay - effectiveLast;
    return (
      e.status === EnrollmentStatus.ABANDONED ||
      (e.status === EnrollmentStatus.ACTIVE && gap >= DROPOFF_GAP_DAYS)
    );
  });

  const latestByEnrollment = new Map<string, Date>();
  if (candidates.length > 0) {
    const attempts = await prisma.activityAttempt.findMany({
      where: {
        enrollmentId: { in: candidates.map((e) => peIdForEnrollment(e.id)) },
        id: { startsWith: "aa_sub_" },
        submittedAt: { not: null },
      },
      select: { enrollmentId: true, submittedAt: true },
      orderBy: { submittedAt: "desc" },
    });
    for (const row of attempts) {
      const enrollmentId = enrollmentIdFromPe(row.enrollmentId);
      if (!enrollmentId || !row.submittedAt) continue;
      if (!latestByEnrollment.has(enrollmentId)) {
        latestByEnrollment.set(enrollmentId, row.submittedAt);
      }
    }
  }

  const rows: DropoffStudentRow[] = [];

  for (const e of candidates) {
    const currentDay = getCurrentDayNumber(
      { startedAt: e.startedAt },
      e.challenge,
    );
    const effectiveLast = e.lastSubmittedDay ?? 0;
    const gap = currentDay - effectiveLast;
    const lastSubmittedAt = latestByEnrollment.get(e.id);
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
      lastSubmissionDateIso: lastSubmittedAt?.toISOString() ?? null,
      currentDay,
      daysInactive: gap,
    });
  }

  const identities = await listCandidateProfiles(rows.map((r) => r.userId));
  for (const row of rows) {
    const identity = identities.get(row.userId);
    if (!identity) continue;
    row.fullName = identity.fullName.trim() || row.fullName;
    row.phone = identity.phone ?? row.phone;
    row.userType = identity.userType;
    row.college = identity.college ?? row.college;
    row.organization = identity.organization ?? row.organization;
  }

  rows.sort((a, b) => {
    const av = a.lastSubmittedDay ?? -1;
    const bv = b.lastSubmittedDay ?? -1;
    if (av !== bv) return av - bv;
    return b.daysInactive - a.daysInactive;
  });

  return rows;
}
