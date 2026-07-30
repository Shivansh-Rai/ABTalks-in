---
name: Hackathon registrations in admin counts
overview: Include hackathon-only registrants in the /admin "Total Students" stat card (value, week delta, sparkline) and in the /admin/analytics "Registrations" chart, deduplicating people who are both challenge students and hackathon participants.
todos:
  - id: helper
    content: Add getRegistrationDatesSince — per-user earliest registration date across StudentProfile + HackathonParticipant
    status: pending
  - id: overview
    content: Rewire get-overview-stats totalStudents / week deltas / 14-day sparkline onto the union
    status: pending
  - id: analytics
    content: Rewire get-analytics-data registrationsSeries onto the union
    status: pending
  - id: verify
    content: SQL cross-check + manual /admin and /admin/analytics smoke + typecheck
    status: pending
isProject: false
---

# 049 — Hackathon registrations in admin overview + analytics

## 1. Goal
Hackathon signups currently do not exist as far as the admin dashboard is concerned. Make **Total Students** on `/admin` and the **Registrations** chart on `/admin/analytics` count hackathon registrants alongside challenge students, counting each *person* once.

## 2. Current behavior

Hackathon registration creates a `HackathonTeam` + `HackathonParticipant` against the already-authenticated `User` — it never creates a `StudentProfile` ([`hackathon-actions.ts:181`](src/app/actions/hackathon-actions.ts:181), [`:283`](src/app/actions/hackathon-actions.ts:283)). Every admin registration metric reads `StudentProfile`, so hackathon-only people are invisible:

| Metric | Where | Query today |
|---|---|---|
| Total Students (value) | [`get-overview-stats.ts:73`](src/features/admin/get-overview-stats.ts:73) | `studentProfile.count()` |
| Total Students (`+N this week` delta) | [`:81`](src/features/admin/get-overview-stats.ts:81), [`:84`](src/features/admin/get-overview-stats.ts:84) | `studentProfile.count({ createdAt in week })` |
| Total Students (14-day sparkline) | [`:97`](src/features/admin/get-overview-stats.ts:97) | `studentProfile.findMany({ createdAt >= seriesStart })` |
| Registrations chart | [`get-analytics-data.ts:95`](src/features/admin/get-analytics-data.ts:95) | `studentProfile.findMany({ createdAt >= start })` |

The two are separate surfaces but one bug — all four go through the same fix.

`AnalyticsDashboard` only consumes the already-shaped `registrationsSeries` ([`analytics-dashboard.tsx:71`](src/components/admin/analytics-dashboard.tsx:71)), and `StatCard` only consumes `value` / `delta` / `series` ([`stat-card.tsx`](src/components/admin/stat-card.tsx)). **No client component changes are needed** — this is entirely a server-side data fix.

### Decisions (locked — do not re-litigate)
- **A person is counted once.** A challenge student who also joins the hackathon is one registration, not two. Overlap is real and expected — plan [048](docs/plans/048-hackathon-master-students.md) exists precisely to filter hackathon participants by whether they have an `Enrollment`.
- **Registration date = the earliest of** `StudentProfile.createdAt` and `HackathonParticipant.createdAt` for that user. A long-time student who joins the hackathon today is **not** a new registration today.
- **Registered = has a `StudentProfile` OR a `HackathonParticipant`.** A bare `User` row (signed in with Google, never completed anything) still does not count.
- Card label stays **"Total Students"**. No new stat card, no hackathon/challenge split.

## 3. Files to touch
- [`docs/plans/049-admin-hackathon-in-registration-counts.md`](docs/plans/049-admin-hackathon-in-registration-counts.md) **[new]** — this plan
- [`src/features/admin/get-registration-dates.ts`](src/features/admin/get-registration-dates.ts) **[new]** — shared union/dedupe loader (the only new file; both call sites must share it so the card and the chart can never drift apart)
- [`src/features/admin/get-overview-stats.ts`](src/features/admin/get-overview-stats.ts) **[edit]** — total count + week deltas + sparkline
- [`src/features/admin/get-analytics-data.ts`](src/features/admin/get-analytics-data.ts) **[edit]** — `registrationsSeries`

No schema change, no migration, no seed change, no component change.

## 4. Server vs Client
Every file touched is server-only (`src/features/admin/*`, imported by Server Components). Nothing crosses the Server→Client boundary that isn't already crossing it: `get-overview-stats` still returns plain numbers to `StatCard`, `get-analytics-data` still returns `{ label, count }[]` to `AnalyticsDashboard`. No new props, no new `"use client"`.

## 5. Steps

### Step 1 — New file `src/features/admin/get-registration-dates.ts`

Returns one `Date` per registered user — their earliest registration event — for users with any registration activity at or after `since`.

```ts
import "server-only";
import { prisma } from "@/lib/db";

/**
 * Earliest registration date per user (StudentProfile.createdAt vs
 * HackathonParticipant.createdAt), for anyone whose profile OR hackathon
 * row was created at/after `since`. One entry per person — a challenge
 * student who also joined the hackathon appears once, at the earlier date.
 *
 * Each row carries its counterpart's date so a user whose *earliest*
 * registration predates `since` is correctly excluded by the caller's
 * window filter, even when their other row falls inside the window.
 */
export async function getRegistrationDatesSince(since: Date): Promise<Date[]> {
  const [profileRows, participantRows] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { createdAt: { gte: since } },
      select: {
        userId: true,
        createdAt: true,
        user: { select: { hackathonParticipant: { select: { createdAt: true } } } },
      },
    }),
    prisma.hackathonParticipant.findMany({
      where: { createdAt: { gte: since } },
      select: {
        userId: true,
        createdAt: true,
        user: { select: { studentProfile: { select: { createdAt: true } } } },
      },
    }),
  ]);

  const earliestByUser = new Map<string, Date>();
  const note = (userId: string, date: Date | null | undefined) => {
    if (!date) return;
    const prev = earliestByUser.get(userId);
    if (!prev || date < prev) earliestByUser.set(userId, date);
  };

  for (const row of profileRows) {
    note(row.userId, row.createdAt);
    note(row.userId, row.user.hackathonParticipant?.createdAt);
  }
  for (const row of participantRows) {
    note(row.userId, row.createdAt);
    note(row.userId, row.user.studentProfile?.createdAt);
  }

  return [...earliestByUser.values()];
}

/** Count of distinct people who have registered for anything (all time). */
export async function countRegisteredUsers(): Promise<number> {
  return prisma.user.count({
    where: {
      OR: [
        { studentProfile: { isNot: null } },
        { hackathonParticipant: { isNot: null } },
      ],
    },
  });
}
```

Both relations already exist on `User` — `studentProfile StudentProfile?` and `hackathonParticipant HackathonParticipant?` ([`schema.prisma:241`](prisma/schema.prisma:241), [`:254`](prisma/schema.prisma:254)) — so no schema work.

`countRegisteredUsers` is a SQL `COUNT` with `EXISTS` subqueries: it transfers no rows and dedupes by construction. Do **not** replace it with `studentProfile.count() + hackathonParticipant.count()` — that double-counts the overlap.

### Step 2 — `get-overview-stats.ts`

Add the import:
```ts
import {
  countRegisteredUsers,
  getRegistrationDatesSince,
} from "@/features/admin/get-registration-dates";
```

Inside `getOverviewStats()`, just after `seriesStart` is computed (line 58), add:
```ts
const windowStart = new Date(
  Math.min(seriesStart.getTime(), lastWeekStart.getTime()),
);
```

In the `Promise.all` array:
- Replace `prisma.studentProfile.count()` (the `totalStudents` entry, line 73) with `countRegisteredUsers()`.
- **Delete** the two `newStudentsThisWeek` / `newStudentsLastWeek` entries (lines 81–86) and the `newStudentsForSeries` entry (lines 97–100), and delete those three names from the destructuring on lines 60–72.
- Add one new entry in their place: `getRegistrationDatesSince(windowStart)`, destructured as `registrationDates`.

Keep every other entry (`activeToday`, `day30Reached`, `day60Reached`, `activeThisWeek`, `activeLastWeek`, `liveSubmissionsRaw`, `recentAdminActionsRaw`) exactly as-is — order of the destructuring must stay aligned with the array.

After the `Promise.all`, derive the three numbers from `registrationDates`:
```ts
const newStudentsThisWeek = registrationDates.filter(
  (date) => date >= thisWeekStart && date < thisWeekEnd,
).length;
const newStudentsLastWeek = registrationDates.filter(
  (date) => date >= lastWeekStart && date < lastWeekEnd,
).length;
```

Then change the sparkline loop (lines 140–145) to iterate `registrationDates` instead of `newStudentsForSeries`:
```ts
for (const date of registrationDates) {
  const key = formatInTimeZone(date, IST, "yyyy-MM-dd");
  if (seriesBuckets.has(key)) {
    seriesBuckets.set(key, (seriesBuckets.get(key) ?? 0) + 1);
  }
}
```
(was `for (const row of newStudentsForSeries) { ... row.createdAt ... }`)

The `seriesBuckets` seeding, `totalStudentsSeries` mapping, and the entire returned shape stay byte-identical. `totalStudentsDelta` still equals `newStudentsThisWeek - newStudentsLastWeek`.

### Step 3 — `get-analytics-data.ts`

Add:
```ts
import { getRegistrationDatesSince } from "@/features/admin/get-registration-dates";
```

In the `Promise.all` (lines 87–127), replace the `rangedProfiles` entry (lines 95–98) with `getRegistrationDatesSince(start)` and rename the destructured binding `rangedProfiles` → `registrationDates`. Leave the other five entries untouched.

Replace the bucketing loop (lines 129–134):
```ts
const registrationsCountByKey = new Map<string, number>();
for (const date of registrationDates) {
  const key = timeKeyFor(date, range);
  if (!bucketSet.has(key)) continue;
  registrationsCountByKey.set(key, (registrationsCountByKey.get(key) ?? 0) + 1);
}
```

Nothing else changes — `registrationsSeries`, `submissionsSeries`, `domainDistribution`, `dropOff`, `submissionsByHour`, `topPerformers` and the return shape are all untouched. This one edit fixes all three ranges ("Last 30 Days", "Last 12 Weeks", "Last 12 Months") because they share `timeKeyFor`.

## 6. Guardrails for Cursor (DO NOT)
- Do **NOT** compute the total as `studentProfile.count() + hackathonParticipant.count()`. That double-counts anyone who is both.
- Do **NOT** count bare `User` rows. Registered means profile OR hackathon participant.
- Do **NOT** date a registration at `User.createdAt`. Use profile / participant `createdAt`.
- Do **NOT** duplicate the min-date logic into both feature files — both must import the single helper from Step 1. This is the **only** new file; do not create any other helper, type, or barrel file.
- Do **NOT** touch `domainDistribution`, `dropOff`, `submissionsByHour`, `topPerformers`, `activeToday`, `day30Reached`, or `day60Reached` — those are challenge-only by design and stay that way.
- Do **NOT** touch `/admin/students`, `get-students.ts`, `get-missing-by-day.ts`, or the CSV exports in `admin-export-actions.ts`. Hackathon registrants belong on `/admin/hackathon/students` (plan 048), not in the challenge roster. Out of scope.
- Do **NOT** edit `stat-card.tsx`, `admin-sparkline.tsx`, `analytics-dashboard.tsx`, `analytics-dashboard-loader.tsx`, `src/app/admin/page.tsx`, or `src/app/admin/analytics/page.tsx`. If you think a component needs changing, you have misread the plan — the data shapes are unchanged.
- Do **NOT** rename the "Total Students" card or add a new stat card.
- Do **NOT** add `select`-less Prisma queries; every query above already has an explicit `select`/`where`.
- Do **NOT** add `console.log` / `console.error` — use `lib/logger.ts` if logging is genuinely needed (it should not be here).
- Do **NOT** touch `middleware.ts`, `auth.config.ts`, or anything on the edge import path.
- Do **NOT** change `prisma/schema.prisma`, add a migration, or run `db:seed` / `db:cleanup`.
- Do **NOT** edit `CLAUDE.md` or `docs/project-context.md`.

## 7. DB safety
Not applicable — read-only query changes, no schema or data mutation. No Neon branch or migration needed.

## 8. Verification

**SQL cross-check** (run in the Neon console; the first number must equal the Total Students card):
```sql
SELECT COUNT(*) AS total_registered
FROM "User" u
WHERE EXISTS (SELECT 1 FROM "StudentProfile" p WHERE p."userId" = u.id)
   OR EXISTS (SELECT 1 FROM "HackathonParticipant" h WHERE h."userId" = u.id);

-- sanity: how many hackathon people have no StudentProfile (the previously missing ones)
SELECT COUNT(*) AS hackathon_only
FROM "HackathonParticipant" h
WHERE NOT EXISTS (SELECT 1 FROM "StudentProfile" p WHERE p."userId" = h."userId");

-- sanity: overlap that must NOT be double counted
SELECT COUNT(*) AS both
FROM "HackathonParticipant" h
WHERE EXISTS (SELECT 1 FROM "StudentProfile" p WHERE p."userId" = h."userId");
```
Expected: `total_registered` = old Total Students + `hackathon_only`, and it must **not** have grown by the full `HackathonParticipant` count.

**Manual:**
1. Note the current Total Students value before the change.
2. `/admin` — Total Students increased by exactly `hackathon_only`; the sparkline and the `+N this week` chip both still render.
3. `/admin/analytics` — "Registrations: Last 30 Days" bars/points are ≥ their previous values; a day with a hackathon signup and no challenge registration is now non-zero instead of flat.
4. Switch the range filter to Weekly and Monthly — both still render, both include hackathon signups.
5. A user who registered for the challenge months ago and joined the hackathon this week must **not** appear as a new registration this week (checks the earliest-date rule). Verify against the `both` query above.

**Automated:** `npx tsc --noEmit` must pass (ignore pre-existing `.next/dev/types` noise if present) and `npm run build` must succeed.

**Exactly these files should show as changed:**
```
docs/plans/049-admin-hackathon-in-registration-counts.md   (new)
src/features/admin/get-registration-dates.ts               (new)
src/features/admin/get-overview-stats.ts                   (edit)
src/features/admin/get-analytics-data.ts                   (edit)
```
Anything else changed = the plan was exceeded; revert it.

## 9. Commit message
`feat(admin): count hackathon registrants in overview total and registrations chart`
