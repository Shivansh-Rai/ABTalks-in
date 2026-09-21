import { formatDistanceToNow } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { prisma } from "@/lib/db";
import {
  countRegisteredUsers,
  getRegistrationDatesSince,
} from "@/features/admin/get-registration-dates";
import { canonicalFullNameByUserId } from "@/repositories/candidate";

const IST = "Asia/Kolkata";

function getIstDayBounds(now: Date = new Date()) {
  const istDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const start = new Date(`${istDay}T00:00:00+05:30`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function getIstRollingWeekBounds(now: Date = new Date()) {
  const { start: todayStart } = getIstDayBounds(now);
  const thisWeekStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
  const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  return {
    thisWeekStart,
    thisWeekEnd: new Date(todayStart.getTime() + 24 * 60 * 60 * 1000),
    lastWeekStart,
    lastWeekEnd: thisWeekStart,
  };
}

function getLast14IstDayKeys(now: Date = new Date()): string[] {
  const { start: todayStart } = getIstDayBounds(now);
  const keys: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const dayStart = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000);
    keys.push(formatInTimeZone(dayStart, IST, "yyyy-MM-dd"));
  }
  return keys;
}

export function formatAdminActionType(actionType: string): string {
  return actionType
    .toLowerCase()
    .split("_")
    .map((part, index) => {
      if (index === 0) return `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`;
      return part;
    })
    .join(" ");
}

export async function getOverviewStats() {
  const { start, end } = getIstDayBounds();
  const { thisWeekStart, thisWeekEnd, lastWeekStart, lastWeekEnd } =
    getIstRollingWeekBounds();
  const last14Keys = getLast14IstDayKeys();
  const seriesStart = new Date(`${last14Keys[0]}T00:00:00+05:30`);
  const windowStart = new Date(
    Math.min(seriesStart.getTime(), lastWeekStart.getTime()),
  );

  const [
    totalStudents,
    activeToday,
    day30Reached,
    day60Reached,
    activeThisWeek,
    activeLastWeek,
    registrationDates,
    liveSubmissionsRaw,
    recentAdminActionsRaw,
    recentRecruitersRaw,
    totalRecruiters,
    recruiterCreatedAt,
    creditsThisWeek,
    creditsLastWeek,
    emailsSent,
    emailsSentThisWeek,
    emailsFailedThisWeek,
    emailsFailedRecent,
    disabledRecent,
    // Plan 154: KPIs shown inside the "Platform Activity" section.
    jobsPublished,
    applicationsTotal,
    applicationsThisWeek,
    applicationsLastWeek,
    applicationDatesRecent,
    assessmentsCompletedTotal,
    assessmentsCompletedThisWeek,
    assessmentsCompletedLastWeek,
    contactUnlocksThisWeek,
    contactUnlocksLastWeek,
    talentProjectsActive,
    talentProjectsThisWeek,
  ] = await Promise.all([
    countRegisteredUsers(),
    prisma.submission.findMany({
      where: { submittedAt: { gte: start, lt: end } },
      distinct: ["userId"],
      select: { userId: true },
    }),
    prisma.enrollment.count({ where: { daysCompleted: { gte: 30 } } }),
    prisma.enrollment.count({ where: { daysCompleted: { gte: 60 } } }),
    prisma.submission.findMany({
      where: { submittedAt: { gte: thisWeekStart, lt: thisWeekEnd } },
      distinct: ["userId"],
      select: { userId: true },
    }),
    prisma.submission.findMany({
      where: { submittedAt: { gte: lastWeekStart, lt: lastWeekEnd } },
      distinct: ["userId"],
      select: { userId: true },
    }),
    getRegistrationDatesSince(windowStart),
    prisma.submission.findMany({
      orderBy: { submittedAt: "desc" },
      take: 10,
      include: {
        enrollment: { select: { domain: true } },
        user: {
          select: {
            id: true,
            email: true,
            studentProfile: { select: { fullName: true } },
          },
        },
      },
    }),
    prisma.adminAction.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        actionType: true,
        createdAt: true,
        actorUserId: true,
        entityType: true,
        entityId: true,
        admin: {
          select: {
            id: true,
            email: true,
            studentProfile: { select: { fullName: true } },
          },
        },
        target: {
          select: {
            id: true,
            email: true,
            studentProfile: { select: { fullName: true } },
          },
        },
      },
    }),
    // Newest registrations, not a review queue: recruiter approval is gone,
    // so "waiting" is not a state a profile can be in any more.
    prisma.recruiterProfile.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        fullName: true,
        company: true,
        createdAt: true,
        user: { select: { email: true } },
      },
    }),
    prisma.recruiterProfile.count(),
    prisma.recruiterProfile.findMany({
      where: { createdAt: { gte: windowStart } },
      select: { createdAt: true },
    }),
    prisma.creditTransaction.aggregate({
      where: {
        amount: { lt: 0 },
        createdAt: { gte: thisWeekStart, lt: thisWeekEnd },
      },
      _sum: { amount: true },
    }),
    prisma.creditTransaction.aggregate({
      where: {
        amount: { lt: 0 },
        createdAt: { gte: lastWeekStart, lt: lastWeekEnd },
      },
      _sum: { amount: true },
    }),
    prisma.outboundDelivery.count({ where: { status: "SENT" } }),
    prisma.outboundDelivery.count({
      where: { status: "SENT", createdAt: { gte: thisWeekStart, lt: thisWeekEnd } },
    }),
    prisma.outboundDelivery.count({
      where: {
        status: "FAILED",
        createdAt: { gte: thisWeekStart, lt: thisWeekEnd },
      },
    }),
    prisma.outboundDelivery.findMany({
      where: { status: "FAILED" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        kind: true,
        failureReason: true,
        createdAt: true,
      },
    }),
    prisma.user.findMany({
      where: { disabledAt: { not: null }, deletedAt: null },
      orderBy: { disabledAt: "desc" },
      take: 5,
      select: {
        id: true,
        email: true,
        disabledAt: true,
        disabledReason: true,
        name: true,
        studentProfile: { select: { fullName: true } },
        recruiterProfile: { select: { fullName: true } },
      },
    }),
    // Plan 154: Platform Activity KPIs.
    prisma.job.count({ where: { status: "PUBLISHED" } }),
    prisma.jobApplication.count(),
    prisma.jobApplication.count({
      where: { createdAt: { gte: thisWeekStart, lt: thisWeekEnd } },
    }),
    prisma.jobApplication.count({
      where: { createdAt: { gte: lastWeekStart, lt: lastWeekEnd } },
    }),
    prisma.jobApplication.findMany({
      where: { createdAt: { gte: windowStart } },
      select: { createdAt: true },
    }),
    prisma.recruiterAssessmentAssignment.count({
      where: { status: "SUBMITTED" },
    }),
    prisma.recruiterAssessmentAssignment.count({
      where: {
        status: "SUBMITTED",
        updatedAt: { gte: thisWeekStart, lt: thisWeekEnd },
      },
    }),
    prisma.recruiterAssessmentAssignment.count({
      where: {
        status: "SUBMITTED",
        updatedAt: { gte: lastWeekStart, lt: lastWeekEnd },
      },
    }),
    prisma.creditTransaction.count({
      where: {
        amount: { lt: 0 },
        createdAt: { gte: thisWeekStart, lt: thisWeekEnd },
      },
    }),
    prisma.creditTransaction.count({
      where: {
        amount: { lt: 0 },
        createdAt: { gte: lastWeekStart, lt: lastWeekEnd },
      },
    }),
    prisma.talentRequest.count({ where: { archivedAt: null } }),
    prisma.talentRequest.count({
      where: {
        archivedAt: null,
        createdAt: { gte: thisWeekStart, lt: thisWeekEnd },
      },
    }),
  ]);

  const newStudentsThisWeek = registrationDates.filter(
    (date) => date >= thisWeekStart && date < thisWeekEnd,
  ).length;
  const newStudentsLastWeek = registrationDates.filter(
    (date) => date >= lastWeekStart && date < lastWeekEnd,
  ).length;

  const seriesBuckets = new Map<string, number>();
  for (const key of last14Keys) {
    seriesBuckets.set(key, 0);
  }
  for (const date of registrationDates) {
    const key = formatInTimeZone(date, IST, "yyyy-MM-dd");
    if (seriesBuckets.has(key)) {
      seriesBuckets.set(key, (seriesBuckets.get(key) ?? 0) + 1);
    }
  }
  const totalStudentsSeries = last14Keys.map((key) => seriesBuckets.get(key) ?? 0);

  const recruiterBuckets = new Map<string, number>();
  for (const key of last14Keys) recruiterBuckets.set(key, 0);
  for (const row of recruiterCreatedAt) {
    const key = formatInTimeZone(row.createdAt, IST, "yyyy-MM-dd");
    if (recruiterBuckets.has(key)) {
      recruiterBuckets.set(key, (recruiterBuckets.get(key) ?? 0) + 1);
    }
  }
  const totalRecruitersSeries = last14Keys.map(
    (key) => recruiterBuckets.get(key) ?? 0,
  );
  const newRecruitersThisWeek = recruiterCreatedAt.filter(
    (row) => row.createdAt >= thisWeekStart && row.createdAt < thisWeekEnd,
  ).length;
  const newRecruitersLastWeek = recruiterCreatedAt.filter(
    (row) => row.createdAt >= lastWeekStart && row.createdAt < lastWeekEnd,
  ).length;

  const creditsUsedMinor = Math.abs(creditsThisWeek._sum.amount ?? 0);
  const creditsUsedLastMinor = Math.abs(creditsLastWeek._sum.amount ?? 0);

  // Plan 154: applications-per-day series for the trend chart under
  // "Platform Activity". Bucketed against the same 14-day IST calendar the
  // registration series uses, so the two chart series align pixel-for-pixel.
  const applicationsBuckets = new Map<string, number>();
  for (const key of last14Keys) applicationsBuckets.set(key, 0);
  for (const row of applicationDatesRecent) {
    const key = formatInTimeZone(row.createdAt, IST, "yyyy-MM-dd");
    if (applicationsBuckets.has(key)) {
      applicationsBuckets.set(key, (applicationsBuckets.get(key) ?? 0) + 1);
    }
  }
  const applicationsSeries = last14Keys.map(
    (key) => applicationsBuckets.get(key) ?? 0,
  );

  const identityIds = [
    ...disabledRecent.map((row) => row.id),
    ...liveSubmissionsRaw.map((row) => row.user.id),
    ...recentAdminActionsRaw.map((row) => row.admin?.id),
    ...recentAdminActionsRaw.map((row) => row.target?.id),
  ].filter((id): id is string => Boolean(id));
  const names = await canonicalFullNameByUserId(identityIds);

  return {
    stats: {
      totalStudents,
      activeToday: activeToday.length,
      day30Reached,
      day60Reached,
      totalStudentsDelta: newStudentsThisWeek - newStudentsLastWeek,
      activeTodayDelta: activeThisWeek.length - activeLastWeek.length,
      day30ReachedDelta: null as number | null,
      day60ReachedDelta: null as number | null,
      totalStudentsSeries,
      totalRecruiters,
      totalRecruitersDelta: newRecruitersThisWeek - newRecruitersLastWeek,
      totalRecruitersSeries,
      creditsUsedMinor,
      creditsUsedDeltaMinor: creditsUsedMinor - creditsUsedLastMinor,
      emailsSent,
      emailsSentThisWeek,
      emailsFailedThisWeek,
      // Plan 154 additions.
      jobsPublished,
      applicationsTotal,
      applicationsThisWeek,
      applicationsDelta: applicationsThisWeek - applicationsLastWeek,
      applicationsSeries,
      assessmentsCompletedTotal,
      assessmentsCompletedThisWeek,
      assessmentsCompletedDelta:
        assessmentsCompletedThisWeek - assessmentsCompletedLastWeek,
      contactUnlocksThisWeek,
      contactUnlocksDelta: contactUnlocksThisWeek - contactUnlocksLastWeek,
      talentProjectsActive,
      talentProjectsThisWeek,
      last14DayKeys: last14Keys,
    },
    flagged: [
      ...disabledRecent.map((row) => ({
        id: row.id,
        href: `/admin/students/${row.id}`,
        title:
          row.recruiterProfile?.fullName?.trim() ||
          names.get(row.id)?.trim() ||
          row.studentProfile?.fullName?.trim() ||
          row.name?.trim() ||
          row.email,
        detail: row.disabledReason?.trim() || "Account disabled",
        when: row.disabledAt
          ? formatDistanceToNow(row.disabledAt, { addSuffix: true })
          : "",
      })),
      ...emailsFailedRecent.map((row) => ({
        id: row.id,
        href: "/admin/deliveries",
        title: row.kind,
        detail: row.failureReason?.trim() || "Email failed",
        when: formatDistanceToNow(row.createdAt, { addSuffix: true }),
      })),
    ].slice(0, 8),
    liveSubmissions: liveSubmissionsRaw.map((row) => ({
      id: row.id,
      userId: row.user.id,
      studentName:
        names.get(row.user.id)?.trim() ||
        row.user.studentProfile?.fullName?.trim() ||
        row.user.email ||
        "Unknown",
      dayNumber: row.dayNumber,
      domain: row.enrollment.domain,
      linkedinUrl: row.linkedinUrl,
      submittedAt: row.submittedAt,
      submittedAtRelative: formatDistanceToNow(row.submittedAt, { addSuffix: true }),
    })),
    recentAdminActions: recentAdminActionsRaw.map((row) => ({
      id: row.id,
      adminName:
        (row.admin?.id ? names.get(row.admin.id)?.trim() : undefined) ||
        row.admin?.studentProfile?.fullName?.trim() ||
        row.admin?.email ||
        row.actorUserId ||
        "Admin",
      actionType: row.actionType,
      actionLabel: formatAdminActionType(row.actionType),
      targetUserId: row.target?.id ?? null,
      targetName: row.target
        ? names.get(row.target.id)?.trim() ||
          row.target.studentProfile?.fullName?.trim() ||
          row.target.email ||
          "Unknown"
        : [row.entityType, row.entityId].filter(Boolean).join(" ") || "—",
      createdAt: row.createdAt,
      createdAtRelative: formatDistanceToNow(row.createdAt, { addSuffix: true }),
    })),
    recentRecruiters: recentRecruitersRaw.map((row) => ({
      id: row.id,
      fullName: row.fullName,
      company: row.company,
      email: row.user.email ?? "",
      createdAtRelative: formatDistanceToNow(row.createdAt, { addSuffix: true }),
    })),
  };
}
