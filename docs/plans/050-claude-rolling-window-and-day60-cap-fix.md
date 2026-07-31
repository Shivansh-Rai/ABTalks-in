# 050 — Claude rolling 60-day window + day-60 cap fix

## 1. Goal

Two fixes. (a) Make day 60 submittable after its scheduled IST date — today it is
permanently blocked for everyone in every track, which makes `COMPLETED` /
`isReadyForInterview` unreachable. (b) Give every CLAUDE student their own rolling
60 days from their real join date, instead of force-anchoring dashboard-modal
enrollments to the June 1 cohort start.

**Time-critical:** fix (a) must ship before **2026-08-03 IST**. See §5.1.

## 2. Current behavior

### 2.1 The day-60 cap freeze (all domains)

`getCurrentDayNumber` (`src/lib/date-utils.ts:113`) caps at 60:

```ts
return Math.min(60, Math.max(1, day));
```

Once a student passes their own day 60, `currentDay` freezes at 60 permanently.
`submitDay` (`src/features/submission/submit-day.ts:180`) then computes:

```ts
const isBackfill = dayNumber < currentDay;   // 60 < 60 → false
if (!isBackfill && submittedAtIst !== expectedDate) { ...wrong_day }
```

Traced for a June-1-anchored enrollment on 2026-07-31:

| step | value |
| --- | --- |
| `getCurrentDayNumber` | `min(60, 61)` = **60** |
| `assertPastDaySubmittable` | `60 >= 60` → early `ok: true` |
| `expectedDate` | `2026-07-30` |
| `submittedAtIst` | `2026-07-31` |
| `isBackfill` | `60 < 60` → **false** |
| result | `wrong_day` — "Day 60 can only be submitted on its scheduled IST date (2026-07-30)." |

This never clears. Consequences:

- Day 60 is un-submittable forever after its own date.
- `daysCompleted >= 60` is unreachable → no enrollment ever flips to
  `EnrollmentStatus.COMPLETED`, and `studentProfile.isReadyForInterview` is never
  set (`submit-day.ts:263`).
- Inverted window: days 56–59 stay backfillable **forever** (they are genuine
  backfills, and the relaxation window is frozen at `{56,57,58,59}`), while day 60
  is shut.
- Not Claude-specific. SE/DS/AI hit it individually as each student passes their
  own day 60; CLAUDE hit it en masse because the cohort shares one date.

### 2.2 Two enrollment doors, two different windows (CLAUDE)

| path | `startedAt` | effect for a July 10 joiner |
| --- | --- | --- |
| `src/features/registration/complete-registration.ts:177` | omitted → schema default `now()` | ref = Jul 10, on day 22 today, day 60 = Sep 7 |
| `src/features/enrollment/create-claude-enrollment.ts:66` | `challenge.startsAt` → **Jun 1 always** | ref = Jun 1, on day 60 today, days 1–55 dead on arrival |

The hardcode was never needed: `referenceStartDate` (`src/lib/date-utils.ts:38`)
already floors pre-start joiners to `challenge.startsAt` via `max()`. The hardcode
only damages people who joined **after** June 1. Their true join time survives in
`Enrollment.createdAt` (schema line 92), so a backfill is possible.

**Decision taken:** rolling 60 days per student (option A).

## 3. Files to touch

| file | | note |
| --- | --- | --- |
| `src/lib/date-utils.ts` | `[edit]` | add `getElapsedDayNumber` (uncapped); leave `getCurrentDayNumber` unchanged |
| `src/features/submission/submit-day.ts` | `[edit]` | use elapsed day for `isBackfill` + relaxation window |
| `src/features/challenge/get-day-data.ts` | `[edit]` | use elapsed day for `isRelaxable` so UI matches server |
| `src/features/dashboard/get-heatmap-data.ts` | `[edit]` | same, for heatmap `isRelaxable` |
| `src/features/enrollment/create-claude-enrollment.ts` | `[edit]` | drop the `anchorStart` hardcode |
| `docs/project-context.md` | `[edit]` | document elapsed-vs-current day, and the rolling CLAUDE window |

No new files. No schema change, no migration. One **data** backfill (§7).

## 4. Server vs Client

All six files are server-only (`lib/`, `features/`, docs). No component boundary is
crossed, no `"use client"` file is touched, no props change shape. `DayData` and the
heatmap row type keep their existing fields — only the value fed into `isRelaxable`
changes.

## 5. Steps

### 5.1 `src/lib/date-utils.ts` — add an uncapped elapsed day

Add below `getCurrentDayNumber`, reusing the same reference-start logic:

```ts
/**
 * Elapsed challenge day, UNCAPPED — day 61+ once a student passes day 60.
 * Use this ONLY to decide whether a day is in the past (backfill / relaxation
 * window). Everything user-facing (unlock checks, display, streaks) must keep
 * using `getCurrentDayNumber`, which caps at 60.
 *
 * Returns 0 before a synchronized challenge's effective start, matching
 * `getCurrentDayNumber`.
 */
export function getElapsedDayNumber(
  enrollment: EnrollmentDayAnchor | Date,
  challenge?: ChallengeSyncStart,
): number {
  const startedAt =
    enrollment instanceof Date ? enrollment : enrollment.startedAt;
  const ref = referenceStartDate(startedAt, challenge);
  const startKey = formatInTimeZone(ref, IST, "yyyy-MM-dd");
  const nowKey = formatInTimeZone(new Date(), IST, "yyyy-MM-dd");
  const startUtc = parseCalendarKeyToUtcDate(startKey);
  const nowUtc = parseCalendarKeyToUtcDate(nowKey);

  if (challenge?.startsAt != null && nowUtc < startUtc) {
    return 0;
  }

  return Math.max(1, differenceInCalendarDays(nowUtc, startUtc) + 1);
}
```

Do **not** change `getCurrentDayNumber`. Removing its cap would leak "Day 61 of 60"
into the dashboard, the day header, and dropoff analytics.

**Why this closes the bug, and the 2026-08-03 deadline:** with elapsed day, day 60
becomes a genuine backfill (`60 < 61`), so the wrong-day guard is skipped and the
existing 5-day relaxation window governs it instead. For the June-1 cohort:

| IST date | elapsed | window | day 60 |
| --- | --- | --- | --- |
| Jul 31 | 61 | 57–60 | open |
| Aug 1 | 62 | 58–61 | open |
| Aug 2 | 63 | 59–62 | open |
| Aug 3 | 64 | 60–63 | open |
| Aug 4 | 65 | 61–64 | **closed** |

So the fix must be live by end of **2026-08-03 IST** or the June-1 cohort loses day
60 for good. No new deadline concept is introduced — the existing relaxation policy
does the work.

### 5.2 `src/features/submission/submit-day.ts`

1. Import `getElapsedDayNumber` alongside the existing `getCurrentDayNumber`,
   `getIstDateKeyForChallengeDay`, `IST`.
2. In `assertPastDaySubmittable`, replace the single `currentDay` with two values:

```ts
const currentDay = getCurrentDayNumber(enrollment, challenge);
const elapsedDay = getElapsedDayNumber(enrollment, challenge);
if (currentDay > 0 && dayNumber >= elapsedDay) return { ok: true };
```

   Keep the rest of the function as-is, but pass elapsed to the window check:

```ts
if (isWithinRelaxationWindow(elapsedDay, dayNumber)) return { ok: true };
```

3. In `submitDay`, leave the lock check on the capped value
   (`if (dayNumber > currentDay)` at line 136) and add elapsed only for backfill:

```ts
const elapsedDay = getElapsedDayNumber(enrollment, challengeAnchor);
const isBackfill = dayNumber < elapsedDay;
```

4. Leave `computeStreakStats({ endDay: currentDay })` on the **capped** value. It
   clamps internally (`streak-utils.ts:11`), but keep the capped input explicit.
5. Leave `isWithinRelaxationWindow` itself untouched — its `currentDay < 2` /
   `dayNumber >= currentDay` guards are already correct for an uncapped input.

### 5.3 `src/features/challenge/get-day-data.ts`

Keep `currentDayNumber` (capped) for `isUnlocked` and for the returned
`currentDayNumber` field. Add elapsed for relaxation only:

```ts
const currentDayNumber = getCurrentDayNumber(enrollment, enrollment.challenge);
const elapsedDayNumber = getElapsedDayNumber(enrollment, enrollment.challenge);
const isUnlocked = dayNumber <= currentDayNumber;
const isRelaxable =
  !submission && isWithinRelaxationWindow(elapsedDayNumber, dayNumber);
```

Do not add `elapsedDayNumber` to the returned `DayData` — nothing renders it.

### 5.4 `src/features/dashboard/get-heatmap-data.ts`

Same shape. `currentDay` (line 203) stays capped for status/date derivation; add an
elapsed value and use it only at line 236:

```ts
const relaxable =
  status === "missed" && isWithinRelaxationWindow(elapsedDay, dayNumber);
```

### 5.5 `src/features/enrollment/create-claude-enrollment.ts`

Delete the `anchorStart` line (66) and the `startedAt` key from the `create` data so
the schema default `now()` applies:

```ts
await prisma.enrollment.create({
  data: {
    userId,
    challengeId: challenge.id,
    domain: Domain.CLAUDE,
    status: EnrollmentStatus.ACTIVE,
    daysCompleted: 0,
    currentStreak: 0,
    longestStreak: 0,
  },
});
```

`challenge.startsAt` is still needed in the `select` — no, it is not: after this
change nothing reads it here. Narrow the select to `{ id: true }`.

Pre-June-1 joiners are unaffected: `referenceStartDate` floors them to
`challenge.startsAt`.

### 5.6 `docs/project-context.md`

Under the domain-model / date-handling section, record: `getCurrentDayNumber` caps
at 60 for display and unlocking; `getElapsedDayNumber` is uncapped and is the only
correct input for backfill / relaxation decisions; CLAUDE enrollments now start
rolling from the real join date, floored at the cohort `startsAt`.

## 6. Guardrails for Cursor (DO NOT)

- **DO NOT** remove or raise the `Math.min(60, ...)` cap in `getCurrentDayNumber`.
  The fix is a second function, not a change to the existing one.
- **DO NOT** swap `getCurrentDayNumber` → `getElapsedDayNumber` at the other call
  sites: `admin-actions.ts:294`, `challenge/today/page.tsx:39`,
  `get-dropoff-by-day.ts:73`, `get-dashboard-data.ts:140`,
  `submission-actions.ts:69`, and the unlock/display uses in `get-day-data.ts` and
  `get-heatmap-data.ts` all need the capped value. Only the four relaxation /
  backfill sites in §5.2–§5.4 change.
- **DO NOT** touch `middleware.ts`, `auth.config.ts`, or anything on the edge import
  path. None of these files are in it — keep it that way.
- **DO NOT** create a new `lib/challenge-window.ts` or similar. `getElapsedDayNumber`
  goes in the existing `date-utils.ts` next to `getCurrentDayNumber`.
- **DO NOT** change `isWithinRelaxationWindow`'s 5-day span. The window size is not
  part of this fix.
- **DO NOT** add a `submissionsCloseAt` / `endsAt` field to `Challenge`. No schema
  change in this plan.
- **DO NOT** run the backfill SQL as part of the code change, and do not add it to a
  migration. It is a separate, gated operational step (§7).
- **DO NOT** relax `assertPastDaySubmittable`'s admin-reject or existing-submission
  branches while editing around them.
- Confirm the build and typecheck pass and that exactly the six files in §3 changed
  before reporting done.

## 7. DB safety — data backfill (separate step, after §5 ships)

No schema change. One `UPDATE` on `Enrollment.startedAt`.

### 7.0 Checkpoint

1. Commit and deploy the §5 code changes first; note the commit hash here.
2. Take a Neon branch snapshot before the `UPDATE`; note the branch name.

### 7.1 Pre-flight, read-only — run and read the numbers before deciding

`startsAt` is stored as `2026-05-31T18:30:00Z` (= `2026-06-01T00:00:00+05:30`).

```sql
-- (1) How many enrollments carry the hardcoded anchor?
SELECT count(*)
FROM "Enrollment" e
JOIN "Challenge" c ON c.id = e."challengeId"
WHERE e.domain = 'CLAUDE'
  AND e."startedAt" = c."startsAt"
  AND e."createdAt" > c."startsAt";
```

```sql
-- (2) Of those, who would have existing submissions pushed into the future
--     by a naive startedAt = createdAt?
SELECT e.id, e."createdAt", max(s."dayNumber") AS max_day
FROM "Enrollment" e
JOIN "Challenge" c ON c.id = e."challengeId"
JOIN "Submission" s ON s."enrollmentId" = e.id
WHERE e.domain = 'CLAUDE'
  AND e."startedAt" = c."startsAt"
  AND e."createdAt" > c."startsAt"
GROUP BY e.id, e."createdAt"
HAVING max(s."dayNumber") >
  ((now() AT TIME ZONE 'Asia/Kolkata')::date
   - (e."createdAt" AT TIME ZONE 'Asia/Kolkata')::date) + 1;
```

Date-minus-date is calendar-based in Postgres, matching `differenceInCalendarDays`.
Do not use `date_part('day', interval)` here — it truncates in 24h chunks and drifts
off the IST calendar boundary by a day.

Query (2) is the one that matters: those students joined late via the modal, were
dropped onto a high cohort day, and **did the work anyway**. A naive backfill would
lock the days they already submitted. The `LEAST(...)` clause in §7.2 is what
protects them — do not simplify it away.

### 7.2 The backfill

```sql
UPDATE "Enrollment" e
SET "startedAt" = LEAST(
      e."createdAt",
      (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata')
        - ((COALESCE(
              (SELECT max(s."dayNumber")
               FROM "Submission" s
               WHERE s."enrollmentId" = e.id),
              1) - 1) || ' days')::interval)
      AT TIME ZONE 'Asia/Kolkata'
    )
FROM "Challenge" c
WHERE c.id = e."challengeId"
  AND e.domain = 'CLAUDE'
  AND e."startedAt" = c."startsAt"
  AND e."createdAt" > c."startsAt";
```

The max-day lookup is a correlated scalar subquery, not a join. Postgres rejects a
`LEFT JOIN` inside `UPDATE ... FROM` whose `ON` clause references the update target
(`invalid reference to FROM-clause entry for table "e"`).

- `e."startedAt" = c."startsAt"` is the exact signature of the modal path. A
  registration-path row has `startedAt = createdAt` (both transaction `now()`),
  never exactly IST midnight, so it cannot be hit. Idempotent — re-running matches
  nothing.
- `LEAST(...)` guarantees no already-submitted day becomes locked. If it resolves
  earlier than June 1, `referenceStartDate` floors it back to the cohort start, which
  is the maximum runway available — correct, and still non-destructive.
- Run inside an explicit transaction; `SELECT` the affected rows before `COMMIT` and
  compare the count to pre-flight query (1).

### 7.3 Known side effects — expected, not bugs

- **Streaks recompute.** `computeStreakStats` runs over `endDay: currentDay`, which
  drops for backfilled students. `daysCompleted` is a raw count and does not move.
  Streak values will change on their next submission; that is correct.
- **Default dashboard tab may flip.** `resolveDashboardEnrollment` picks the oldest
  ACTIVE enrollment by `startedAt`. A student whose CLAUDE row moves from June 1 to
  their real (later) join date may now land on a different track by default. The
  challenge switcher still reaches both. Benign — but expect a support question.

## 8. Verification

Manual, on a dev DB seeded via `npm run db:seed`:

1. **Day 60 after its date.** Set an enrollment's `startedAt` to 61 days ago.
   Submit day 60 → succeeds. Confirm `daysCompleted` reaches 60, enrollment flips to
   `COMPLETED`, and `studentProfile.isReadyForInterview` becomes `true`. This is the
   path that has never once fired in production.
2. **Day 60 past the tail.** `startedAt` = 65 days ago → day 60 rejected with the
   "Past missed days cannot be submitted" message, not the `wrong_day` message.
3. **No regression on the normal path.** `startedAt` = 10 days ago: day 10 submits;
   day 11 is locked; days 6–9 backfill; day 5 is refused.
4. **Pre-start unchanged.** A CLAUDE enrollment with `startedAt` before a future
   `startsAt` still reports day 0 and locks every day.
5. **New Claude enrollment.** Enroll via the dashboard modal → the new row's
   `startedAt` is now, not June 1, and the dashboard shows Day 1.
6. **UI matches server.** For a day that is relaxable, the heatmap cell and the
   `/challenge/[day]` page both offer submission, and the submit actually goes
   through — no case where the UI offers it and the action refuses.
7. `npx tsc --noEmit` and `npm run build` pass with no new errors.
8. `git status` shows exactly the six files from §3 and nothing else.

## 9. Commit message

```
fix: allow day-60 submission after its scheduled date; roll Claude window from join date

getCurrentDayNumber caps at 60, freezing currentDay once a student passes
their final day. submitDay derived isBackfill from that capped value, so
day 60 could never satisfy `dayNumber < currentDay` and was permanently
rejected by the wrong-day guard — making daysCompleted >= 60, COMPLETED,
and isReadyForInterview unreachable for every student in every track.

Add getElapsedDayNumber (uncapped) and use it for backfill and relaxation
decisions only; display, unlocking, and streaks keep the capped value.

Also stop createClaudeEnrollment hardcoding startedAt to challenge.startsAt.
referenceStartDate already floors pre-start joiners to the cohort start, so
the hardcode only pinned post-start joiners to a June 1 window they never
had. Enrollments now roll from the real join date.
```
