import "server-only";

import { HACKATHON } from "@/components/hackathon/hackathon-config";
import { prisma } from "@/lib/db";
import { isProgramEnabled } from "@/lib/feature-flags";
import { deriveEventNotifications } from "./derive-event-notifications";
import { filterFeedForView } from "./recruiter-feed-filter";
import { programMember } from "@/repositories/legacy/program-member";
import type {
  AppNotification,
  NotificationCategoryKey,
  NotificationFeed,
} from "./types";

/**
 * Hard cap on how many items the bell ever shows. Older notifications drop off
 * the bottom automatically once newer ones arrive — this is why there is no
 * manual dismiss.
 */
const FEED_LIMIT = 5;

/**
 * Announcements also expire by age, not just by being pushed off the list.
 *
 * Without this, deleting or deactivating the two newest announcements would pull
 * whatever was sitting at positions 6 and 7 back into view — and because those
 * were never displayed, they would arrive UNREAD and re-light the badge with
 * stale news. The age cutoff means anything genuinely old stays gone no matter
 * what happens above it.
 *
 * Applies to admin announcements only. Derived event notifications carry their
 * own explicit windows (a hackathon registration notice may legitimately run
 * longer than this) and are filtered by those instead.
 */
const ANNOUNCEMENT_MAX_AGE_DAYS = 14;

/**
 * Builds one merged feed from two sources:
 *   - admin-authored `Notification` rows (audience-filtered), and
 *   - automated event notifications derived at read time.
 *
 * This is a pure read path: it never writes. Read state is joined in from
 * `NotificationRead` by string key, which is why derived items — with no row of
 * their own — can still be marked read.
 */
export async function getNotificationsForUser(
  userId: string,
): Promise<NotificationFeed> {
  const now = new Date();
  const programEnabled = isProgramEnabled();
  const announcementCutoff = new Date(
    now.getTime() - ANNOUNCEMENT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
  );

  const [
    adminRows,
    enrollingCohorts,
    readRows,
    challengeMembership,
    programMemberships,
    hackathonMembership,
    workshopRegistrations,
    userNotifRows,
  ] = await Promise.all([
    prisma.notification.findMany({
      where: {
        isActive: true,
        publishedAt: { lte: now, gte: announcementCutoff },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: {
        id: true,
        title: true,
        body: true,
        href: true,
        category: true,
        audience: true,
        publishedAt: true,
      },
      orderBy: { publishedAt: "desc" },
      take: FEED_LIMIT,
    }),
    programEnabled
      ? prisma.programCohort.findMany({
          where: { status: "ENROLLING" },
          select: { id: true, name: true, startsAt: true },
        })
      : Promise.resolve([]),
    prisma.notificationRead.findMany({
      where: { userId },
      select: { notificationKey: true },
    }),
    prisma.enrollment.findFirst({ where: { userId }, select: { id: true } }),
    // Doubles as the PROGRAM audience check and the "already joined this cohort"
    // suppression list, so it stays one query.
    programMember.findMany({
      where: { userId },
      select: { cohortId: true },
    }),
    prisma.hackathonParticipant.findFirst({
      where: { eventId: HACKATHON.eventId, userId },
      select: { id: true },
    }),
    prisma.workshopRegistration.findMany({
      where: { userId },
      select: { eventId: true },
    }),
    prisma.userNotification.findMany({
      where: { recipientUserId: userId },
      select: {
        id: true,
        title: true,
        body: true,
        href: true,
        eventType: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: FEED_LIMIT,
    }),
  ]);

  // T-249 audience gating for CANDIDATE / RECRUITER admin broadcasts.
  // A recruiter is anyone with a RecruiterProfile row; a candidate is
  // anyone signed in who isn't a recruiter. Kept off the Promise.all
  // fan-out above because it only matters after audience-facing rows
  // land — one small select is cheap and lets the check stay linear.
  const recruiterProfile = await prisma.recruiterProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  const audiences = new Set<string>(["ALL"]);
  if (challengeMembership) audiences.add("CHALLENGE");
  if (programMemberships.length > 0) audiences.add("PROGRAM");
  if (hackathonMembership) audiences.add("HACKATHON");
  if (recruiterProfile) {
    audiences.add("RECRUITER");
  } else {
    // Every signed-in non-recruiter counts as a candidate for
    // broadcast targeting. T-249 admin composer uses CANDIDATE for
    // messages that go to all applicants and platform users.
    audiences.add("CANDIDATE");
  }

  const readKeys = new Set(readRows.map((r) => r.notificationKey));

  const adminItems = adminRows
    .filter((row) => audiences.has(row.audience))
    .map((row) => ({
      key: `admin:${row.id}`,
      title: row.title,
      body: row.body,
      href: row.href,
      category: row.category as NotificationCategoryKey,
      publishedAt: row.publishedAt.toISOString(),
    }));

  const userItems: Omit<AppNotification, "isRead">[] = userNotifRows.map(
    (row) => ({
      key: `user:${row.id}`,
      title: row.title,
      body: row.body,
      href: row.href,
      category: "GENERAL" as NotificationCategoryKey,
      publishedAt: row.createdAt.toISOString(),
      eventType: row.eventType,
    }),
  );

  // Derived event notifications (hackathon registration, workshop invites,
  // cohort enrolment reminders) are candidate-side platform prompts. They
  // are computed unconditionally and then dropped for a recruiter viewer
  // by filterFeedForView below.
  const rawDerivedItems = deriveEventNotifications({
    now,
    enrollingCohorts,
    programEnabled,
    registeredWorkshopEventIds: new Set(
      workshopRegistrations.map((r) => r.eventId),
    ),
    isHackathonRegistered: Boolean(hackathonMembership),
    joinedCohortIds: new Set(programMemberships.map((m) => m.cohortId)),
  });

  // T-249 recruiter-side gate. Pure function, unit-tested in
  // recruiter-feed-filter.test.ts. Candidate viewers see the raw arrays.
  const filtered = filterFeedForView(
    {
      adminItems,
      derivedItems: rawDerivedItems,
      userItems,
    },
    Boolean(recruiterProfile),
  );

  const items: AppNotification[] = [
    ...filtered.adminItems,
    ...filtered.derivedItems,
    ...filtered.userItems,
  ]
    .map((item) => ({ ...item, isRead: readKeys.has(item.key) }))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, FEED_LIMIT);

  return {
    signedIn: true,
    items,
    unreadCount: items.filter((i) => !i.isRead).length,
  };
}
