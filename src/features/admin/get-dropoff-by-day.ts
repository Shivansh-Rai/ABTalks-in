import { Domain, EnrollmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentDayNumber } from "@/lib/date-utils";
import { listCandidateProfiles } from "@/repositories/candidate";
import { listChallengePeRows } from "@/repositories/enrollment-state";
import { enrollmentIdFromPe, peIdForEnrollment } from "@/repositories/ids";

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

  const overlaid = (await listChallengePeRows({
    domains: domain ? [domain] : undefined,
  })).filter(
    (e) =>
      e.status === EnrollmentStatus.ACTIVE ||
      e.status === EnrollmentStatus.ABANDONED,
  );
  const challenges = await prisma.challenge.findMany({
    where: { domain: { in: [...new Set(overlaid.map((e) => e.domain))] } },
    select: { domain: true, startsAt: true },
  });
  const challengeByDomain = new Map(challenges.map((c) => [c.domain, c]));
  const candidates = overlaid.filter((e) => {
    const challenge = challengeByDomain.get(e.domain);
    if (!challenge) return false;
    const currentDay = getCurrentDayNumber(
      { startedAt: e.startedAt },
      challenge,
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
    const challenge = challengeByDomain.get(e.domain);
    if (!challenge) continue;
    const currentDay = getCurrentDayNumber(
      { startedAt: e.startedAt },
      challenge,
    );
    const effectiveLast = e.lastSubmittedDay ?? 0;
    const gap = currentDay - effectiveLast;
    const lastSubmittedAt = latestByEnrollment.get(e.id);
    rows.push({
      enrollmentId: e.id,
      userId: e.userId,
      fullName: "",
      email: "",
      phone: "",
      userType: "",
      college: "",
      organization: "",
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
  const users = await prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.userId) } },
    select: { id: true, email: true },
  });
  const emailByUser = new Map(users.map((u) => [u.id, u.email]));
  for (const row of rows) {
    const identity = identities.get(row.userId);
    row.email = emailByUser.get(row.userId) ?? "";
    if (!identity) {
      row.fullName = row.email;
      continue;
    }
    row.fullName = identity.fullName.trim() || row.email;
    row.phone = identity.phone ?? "";
    row.userType = identity.userType;
    row.college = identity.college ?? "";
    row.organization = identity.organization ?? "";
  }

  rows.sort((a, b) => {
    const av = a.lastSubmittedDay ?? -1;
    const bv = b.lastSubmittedDay ?? -1;
    if (av !== bv) return av - bv;
    return b.daysInactive - a.daysInactive;
  });

  return rows;
}
