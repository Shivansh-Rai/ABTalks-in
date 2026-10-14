# Plan 190 — Admin member lists cover every hackathon event

## 1. Goal

`/admin/students` (Candidates) and `/admin/hackathon/students` (Hackathon Master
Student Data) show only 363 of 8,654 hackathon participants, because every read
is hard-pinned to `HACKATHON.eventId = "vicodathon-2-2026"`. Widen the **admin
read surfaces** to all hackathon events, dedupe people who joined more than one,
and label which event each row came from — so "all members" in admin really is
all members.

## 2. Current behavior

Verified read-only against the live DB (`ep-young-shadow`, 2026-10-14):

| `HackathonParticipant.eventId` | rows | live users | window |
|---|---|---|---|
| `legacy` | 8,292 | 8,291 | 24 Jul – 8 Sep 2026 |
| `vicodathon-2-2026` | 363 | 363 | 9 Sep – 24 Sep 2026 |
| **union (live users)** | | **8,515** | 139 people are in both |

`legacy` is the backfill default from
`prisma/migrations/20260908190000_event_scoped_hackathon/migration.sql` — it is
the first hackathon. `HackathonEvent` is an empty table, so nothing resolves an
id to a display name today.

Three admin readers pin the event id:

- `src/features/admin/get-students.ts:81` (`getStudents`) and `:289`
  (`getStudentTrackCounts`) — the Candidates list and its track counts.
- `src/app/actions/admin-export-actions.ts:74` (`getStudentsForExport`) — the
  Candidates CSV.
- `src/features/hackathon/get-master-students.ts:43`
  (`getHackathonMasterStudents`) — the hackathon-only roster.

Net effect: **7,847 of those `legacy` users have no challenge
`ProgramEnrollment` either**, so they appear nowhere in admin under any filter.

Participant-facing hackathon code (`registration-status.ts`, `team-lookup.ts`,
`remove-participant.ts`, `get-my-registration.ts`, `get-admin-data.ts`,
`get-link-stats.ts`) is correctly pinned to the current event and must stay that
way.

## 3. Files to touch

| Path | | Note |
|---|---|---|
| `src/components/hackathon/hackathon-config.ts` | `[edit]` | Add `HACKATHON_EVENT_LABELS` + `hackathonEventLabel()`; leave `HACKATHON.eventId` alone. |
| `src/features/admin/get-students.ts` | `[edit]` | Drop the event pin, dedupe hackathon rows by `userId`, carry `eventLabel`, count distinct users. |
| `src/app/admin/students/page.tsx` | `[edit]` | Render the event label on hackathon rows (mobile card + desktop table). |
| `src/app/actions/admin-export-actions.ts` | `[edit]` | Drop the event pin, dedupe, add an `Event` column to **both** row shapes. |
| `src/features/hackathon/get-master-students.ts` | `[edit]` | Drop the event pin, add an `event` filter, return `total` + per-event counts, cap rows at 500. |
| `src/components/admin/students-filters.tsx` | `[edit]` | Add a **Hackathon event** pill row, shown only on the Hackathon track; thread `?event=` into the CSV export. |
| `src/components/admin/hackathon-master-filters.tsx` | `[edit]` | Add an event selector beside the existing OLD/NEW cohort selector, as an optional prop (this component is shared with `/admin/hackathon/videothon`). |
| `src/app/admin/hackathon/students/page.tsx` | `[edit]` | Parse `?event=`, add an Event column, show "showing X of Y". |

No new files. No schema change, no migration, no data write.

## 4. Server vs Client

- `hackathon-config.ts` — shared constant module, no directive (imported by
  both). `hackathonEventLabel` is a pure function over a string; safe either side.
- `get-students.ts`, `get-master-students.ts` — server modules
  (`get-master-students.ts` keeps `import "server-only"`).
- `admin-export-actions.ts` — Server Action file, keeps `requireAdminExport()`.
- `src/app/admin/students/page.tsx`, `src/app/admin/hackathon/students/page.tsx`
  — **Server** Components.
- `src/components/admin/students-filters.tsx`,
  `src/components/admin/hackathon-master-filters.tsx` — **Client**
  (`"use client"`). `hackathon-master-filters.tsx` is rendered by both
  `/admin/hackathon/students` and `/admin/hackathon/videothon`.
- **Server → Client props:** `hackathon-master-filters.tsx` gains
  `eventOptions: { value: string; label: string; count: number }[]` — plain
  serializable data only. No functions, icons or class instances cross the
  boundary. `eventLabel` on `AdminStudentRow` is a `string | null`.

## 5. Steps

### 5.1 `src/components/hackathon/hackathon-config.ts` `[edit]`

Append below the `HACKATHON` object:

```ts
/**
 * Admin member lists span every hackathon event, not just the live one
 * (`HACKATHON.eventId`). `legacy` is the backfill default from
 * `20260908190000_event_scoped_hackathon` — the first hackathon (24 Jul –
 * 8 Sep 2026). `HackathonEvent` is empty, so labels live here; an unknown id
 * falls back to the raw id so a future event shows up unlabelled rather than
 * disappearing.
 */
export const HACKATHON_EVENT_LABELS: Record<string, string> = {
  legacy: "Vicodathon 1",
  "vicodathon-2-2026": "Vicodathon 2",
};

export function hackathonEventLabel(eventId: string): string {
  return HACKATHON_EVENT_LABELS[eventId] ?? eventId;
}
```

### 5.2 `src/features/admin/get-students.ts` `[edit]`

1. Import `hackathonEventLabel` alongside `HACKATHON`. `HACKATHON` stays
   imported only if still referenced; if not, drop the import.
2. `AdminStudentRow`: add `eventLabel: string | null`.
3. In `getStudents`, in the `prisma.hackathonParticipant.findMany` call:
   - delete `eventId: HACKATHON.eventId` from `where` (keep
     `user: { deletedAt: null }` and the search `OR`);
   - add `eventId: true` to `select`;
   - keep `orderBy: { createdAt: "desc" }` and raise `take` to `200` so the
     post-dedupe slice can still fill 100 rows.
4. Dedupe before mapping — the `@@unique([eventId, userId])` constraint allows
   one row per event per person, so a 2-event participant currently yields two
   rows. Walk the already-`createdAt desc` list and keep the first row per
   `userId`:

   ```ts
   const seenHackathonUsers = new Set<string>();
   const dedupedHackathonRows = hackathonRows.filter((row) => {
     if (seenHackathonUsers.has(row.userId)) return false;
     seenHackathonUsers.add(row.userId);
     return true;
   });
   ```

   Use `dedupedHackathonRows` everywhere `hackathonRows` is used below
   (the `userIds` union and the row mapping).
5. Hackathon row mapping: `eventLabel: hackathonEventLabel(row.eventId)`.
   Challenge row mapping: `eventLabel: null`.
6. `getStudentTrackCounts`: drop `eventId: HACKATHON.eventId` from the hackathon
   `where`, and replace `prisma.hackathonParticipant.count({...})` with a
   distinct-user count so the header total matches the deduped list:

   ```ts
   prisma.hackathonParticipant
     .groupBy({ by: ["userId"], where: { user: { deletedAt: null }, ...searchWhere } })
     .then((rows) => rows.length)
   ```

   Keep the existing `hackathonAllowed` gate (domain/status filters still
   suppress hackathon rows — hackathon has no domain and its status values are
   `SOLO`/`TEAM`, so that behavior is intentional and unchanged).
7. Leave `getStudentDomainCounts` untouched (challenge-only by definition).

### 5.3 `src/app/admin/students/page.tsx` `[edit]`

- Mobile card: under the email line, when `student.eventLabel` is set, render it
  as muted text next to the existing day/streak line.
- Desktop table: in the Domain cell, render the event label as a second muted
  line below the `HACKATHON` badge when `student.eventLabel` is set.
- No new column header — the label rides in the existing Domain cell so the
  table width does not change.

### 5.4 `src/app/actions/admin-export-actions.ts` `[edit]`

1. Import `hackathonEventLabel`.
2. `getStudentsForExport`: drop `eventId: HACKATHON.eventId` from the hackathon
   `where`, add `eventId: true` and `userId: true` to the `select`, and apply the
   same first-row-per-`userId` dedupe (the export is uncapped, so without it the
   CSV ships 139 duplicate people).
   Also add the `user: { deletedAt: null }` guard this query never had — the
   Candidates list already filters soft-deleted users, so without it the CSV
   total would not match the page total.
3. `toCSV` derives its header from `Object.keys(rows[0])` only, so the `Event`
   key **must exist on both row shapes**: add `Event: ""` to `challengeExport`
   rows and `Event: hackathonEventLabel(row.eventId)` to `hackathonExport` rows,
   at the same position in both object literals (directly after `Track`).

### 5.5 `src/features/hackathon/get-master-students.ts` `[edit]`

1. Add `export type HackathonMasterEvent = "all" | (string & {})` — or simply
   type the input as `event?: string` and treat `"all" | undefined` as no
   filter. Add `parseHackathonMasterEvent(raw: string | undefined): string`
   returning `"all"` when the id is not in `HACKATHON_EVENT_LABELS`, so a junk
   query string cannot narrow the list to zero.
2. `HackathonMasterStudent`: add `eventId: string` and `eventLabel: string`.
3. `where`: replace `eventId: HACKATHON.eventId` with
   `...(event === "all" ? {} : { eventId: event })`, and add
   `user: { deletedAt: null }` (the page currently counts soft-deleted users).
   `cohortWhere` already narrows on `user`, so the two must be combined as
   `AND: [cohortFilter, { user: { deletedAt: null } }]` — spreading both would
   have the later `user` key overwrite the cohort filter.
4. Add `select: { eventId: true, ... }`, `take: MASTER_ROW_CAP` (500) and keep
   `orderBy: { createdAt: "desc" }`.
5. Return `{ students, shown: students.length, total, cohort, event, eventOptions }`
   where `total` is a `count()` over the same `where` and `eventOptions` is a
   `groupBy({ by: ["eventId"], where: scopeWhere })` mapped to
   `{ value, label, count }[]` with an `All events` entry first.
6. No dedupe here — this page is a per-registration roster, and the Event column
   makes a two-event person legible rather than duplicated.

### 5.6 `src/components/admin/hackathon-master-filters.tsx` `[edit]`

- Take a new **optional** prop
  `eventOptions?: { value: string; label: string; count: number }[]`, default
  `[]`. This component is also used by `/admin/hackathon/videothon`, which has
  a single event — when the list is empty the event row is not rendered, so
  that page is untouched.
- Render a second pill row (same visual pattern as the cohort row) that sets or
  deletes `?event=`, preserving `?cohort=`.
- Keep the component `"use client"` and keep using `useSearchParams` +
  `router.push`.

### 5.7 `src/app/admin/hackathon/students/page.tsx` `[edit]`

- Widen `searchParams` to `{ cohort?: string; event?: string }`, parse with
  `parseHackathonMasterEvent`.
- Pass `eventOptions` to `<HackathonMasterFilters />` (it is already inside
  `<Suspense>` because it reads `useSearchParams`).
- Header line: `{shown} of {total} student(s)` plus `· capped at 500` when
  `total > shown`.
- Add an **Event** column (first after Name? no — last, after Team Name) so the
  existing column order is untouched.

### 5.8 Candidates event filter — `src/components/admin/students-filters.tsx` `[edit]`

Dropping the event pin alone is not enough for the Candidates table. Rows sort
`createdAt desc` and the table caps at 100, and the newest event
(`vicodathon-2-2026`, 363 people) is newer than every `legacy` row — so the
first page is always Vicodathon 2 and a Vicodathon 1 member can never be
browsed to, only found by name search. Add an event filter so they can:

1. `get-students.ts`: `Input.event?: string`, an exported
   `parseStudentEvent(raw)` that only accepts ids present in
   `HACKATHON_EVENT_LABELS` (anything else → `"ALL"`), and a local
   `hackathonEventWhere(event)` applied in both `getStudents` and
   `getStudentTrackCounts` so the header count tracks the filter.
2. `getStudentsForExport`: same optional `event` filter.
3. `src/app/admin/students/page.tsx`: parse `?event=`, pass it to both readers.
4. `students-filters.tsx`: a **Hackathon event** pill row rendered only when
   `hackathonOnly`, built from `Object.keys(HACKATHON_EVENT_LABELS)` plus an
   `All events` entry (static — the per-event counts live on the master roster
   page, and the header already shows the filtered total). Selecting a
   non-hackathon track clears `?event=`; Clear resets it; it counts toward
   `activeFilterCount`; the CSV export passes the current event through.

## 6. Guardrails for Cursor (DO NOT)

- DO NOT change `HACKATHON.eventId` or `HACKATHON.registrationOpen`, and DO NOT
  touch any participant-facing read: `registration-status.ts`,
  `team-lookup.ts`, `remove-participant.ts`, `get-my-registration.ts`,
  `get-team-submission.ts`, `get-admin-data.ts`, `get-link-stats.ts`. Those are
  correctly scoped to the live event. This plan widens **member-list reads
  only**.
- DO NOT create a new abstraction file for the event label — it is two exports
  appended to `hackathon-config.ts`.
- DO NOT touch `middleware.ts`, `auth.config.ts` or `auth.ts`. Nothing here is
  in the edge import path.
- DO NOT add `requireAdmin`/`requireRole` anywhere new; `/admin/**` is already
  gated by the admin layout and `getStudentsForExport` already calls
  `requireAdminExport()`. Do not remove that call.
- DO NOT drop `select` from any Prisma query or return whole records.
- DO NOT remove the `user: { deletedAt: null }` guard anywhere it exists, and DO
  add it to the master-students query.
- DO NOT write to the database. No migration, no seed, no `HackathonEvent` row.
- DO NOT use `<Button asChild>` / `<Button render={<Link>}>`; use
  `buttonVariants` on `<Link>` (the master page already does).
- DO NOT use `console.*`; use `lib/logger.ts` if logging is needed (it is not).
- DO NOT fold `HackathonVideoRegistration` (`videothon-1`, 60 live rows) into
  these lists — out of scope, see §9.
- DO NOT remove the 100-row cap on `/admin/students` or the `hackathonAllowed`
  domain/status gate.
- DO NOT reformat untouched lines; the repo mixes 2-space JSX indent in these
  files and a wholesale reformat would bury the diff.

## 7. DB safety

Not applicable — read-only change. No schema, migration or data write.

## 8. Verification

1. `npx tsc --noEmit` — clean for the touched files (pre-existing errors in the
   in-flight mock-interview work are out of scope; compare against the baseline
   captured before the change).
2. `npm run lint` on the touched paths.
3. `npm run build` passes.
4. `npm run test:t276-hackathon-ops` still passes (source-scan over hackathon
   ops actions; unaffected, but it is the nearest guard).
5. Manual, against the live read-only data:
   - `/admin/students` → **Hackathon** tab shows a count of **8,515**, not 363,
     with 100 rows rendered and event labels on them.
   - **Hackathon event** pills appear only on the Hackathon track:
     `All events` → 8,515, `Vicodathon 1` → 8,291, `Vicodathon 2` → 363, and
     the rendered rows carry the matching label. Switching to Challenge or All
     clears `?event=`.
   - `/admin/students` → **All** tab total = challenge + 8,515.
   - Each hackathon row shows `Vicodathon 1` or `Vicodathon 2`.
   - No person appears twice within the Hackathon tab.
   - **Export CSV** on the Hackathon tab → 8,515 data rows, header includes
     `Event`, and `Event` is populated for hackathon rows and empty for
     challenge rows.
   - `/admin/hackathon/students` → "500 of 8,654", event pills
     `All / Vicodathon 1 / Vicodathon 2` with counts; picking `Vicodathon 2`
     shows 363; `?cohort=old` and `?event=` compose.
   - `/admin/students/<userId>` still opens for a `legacy`-only participant.
   - `/hackathon` (public) is unchanged: registration still closed, a
     `vicodathon-2-2026` participant still sees their own team.
6. Changed files, and only these: `docs/plans/190-admin-all-hackathon-events.md`,
   `src/components/hackathon/hackathon-config.ts`,
   `src/features/admin/get-students.ts`,
   `src/app/admin/students/page.tsx`,
   `src/app/actions/admin-export-actions.ts`,
   `src/features/hackathon/get-master-students.ts`,
   `src/components/admin/students-filters.tsx`,
   `src/components/admin/hackathon-master-filters.tsx`,
   `src/app/admin/hackathon/students/page.tsx`.

## 9. Deliberately out of scope

- **Videothon** (`HackathonVideoRegistration`, `videothon-1`, 60 live rows) —
  a separate funnel with its own admin surface at `/admin/hackathon/videothon`.
  Folding it in needs a fourth track and its own columns; worth a follow-up.
- **Seeding `HackathonEvent`** — labels live in `hackathon-config.ts` for now.
  Moving them into the table is the right long-term fix and is a separate plan.
- **The `track=ALL` domain/status suppression** — intentional, kept.
- **The 100-row cap on `/admin/students`** — kept; CSV export is the complete
  view.

## 10. Commit message

```
admin: list every hackathon event in member lists

/admin/students, its CSV export and /admin/hackathon/students were pinned
to HACKATHON.eventId, so they showed 363 of 8,654 hackathon participants
and hid 7,847 people who have no challenge enrollment either. Admin reads
now span all events, dedupe the 139 people registered in two, and label
which event each row came from. Participant-facing reads stay scoped to
the live event.
```
