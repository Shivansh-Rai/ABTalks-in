# 059 — Hackathon submissions on admin Submissions tab

## 1. Goal

Let admins review hackathon project entries from the existing **Submissions** nav item by adding a `Hackathon` sub-tab on [`/admin/submissions`](src/app/admin/submissions/page.tsx). Today that page only feeds the 60-day challenge `Submission` model; organizers have no way to see `HackathonSubmission` rows in admin (deferred in plan 055).

## 2. Current behavior

- [`src/app/admin/submissions/page.tsx`](src/app/admin/submissions/page.tsx) — sub-tabs `Feed` | `Missing by Day`; loads challenge rows via `getSubmissionsFeed`.
- [`src/features/admin/get-submissions-feed.ts`](src/features/admin/get-submissions-feed.ts) — `prisma.submission.findMany` (domain / ON_TIME|LATE / day range), take 100.
- Filters + CSV: [`submissions-filters.tsx`](src/components/admin/submissions-filters.tsx) + `getSubmissionsForExport` in [`admin-export-actions.ts`](src/app/actions/admin-export-actions.ts).
- Hackathon entries live in `HackathonSubmission` (one per team: `problemId`, `repoUrl`, `liveUrl`, `aiLogUrl`). Saved via `saveHackathonSubmissionAction`. **No admin read UI exists.**

## 3. Locked decisions

- **UI placement:** third pill on the same page: `Feed` | `Missing by Day` | `Hackathon` via `?tab=hackathon`.
- **Do not** mix hackathon rows into the challenge Feed table (columns and filters are incompatible).
- **Scope:** submitted teams only (rows in `HackathonSubmission`). No “teams missing a submission” view, no scoring/judging, no changes to `/admin/hackathon`.
- **Filters on Hackathon tab:** brief filter only (`problem=ALL|<problemId>`). Hide challenge domain/status/day filters and their export buttons when `tab=hackathon`.
- **List:** all matching submissions ordered by `updatedAt desc` (no artificial 100 cap — volume is one row per team; if you want a safety cap use `take: 500`).
- **Display mapping:**
  - Team label: `team.teamName` if set, else leader `fullName`, else `teamCode`
  - Type: `SOLO` | `TEAM` from `entryType`
  - Leader: participant with `isLeader` (fallback first by `slotIndex`)
  - Brief: `problem.title` (or `—` if `problemId` null)
  - Links: `repoUrl` always; `liveUrl` / `aiLogUrl` show `—` when `""`
  - Leader name links to `/admin/students/[userId]`
- **Export:** CSV with Team, Team Code, Entry Type, Leader, Leader Email, Brief, Repo URL, Live URL, AI Log URL, Members, Updated At (UTC).
- No schema / migration / seed changes.

## 4. Files to touch

- [`docs/plans/059-admin-hackathon-submissions.md`](docs/plans/059-admin-hackathon-submissions.md) **[new]** — this plan
- [`src/features/admin/get-hackathon-submissions-feed.ts`](src/features/admin/get-hackathon-submissions-feed.ts) **[new]** — `getHackathonSubmissionsFeed` + `getHackathonProblemFilterOptions`
- [`src/components/admin/hackathon-submissions-table.tsx`](src/components/admin/hackathon-submissions-table.tsx) **[new]** — mobile cards + desktop table
- [`src/components/admin/hackathon-submissions-filters.tsx`](src/components/admin/hackathon-submissions-filters.tsx) **[new]** — brief pills + Export
- [`src/app/admin/submissions/page.tsx`](src/app/admin/submissions/page.tsx) **[edit]** — third tab; branch content; hide challenge filters on hackathon
- [`src/app/actions/admin-export-actions.ts`](src/app/actions/admin-export-actions.ts) **[edit]** — `getHackathonSubmissionsForExport`
- [`docs/CHANGELOG.md`](docs/CHANGELOG.md) **[edit]** — one Pending reconcile line

## 5. Server vs Client

- Page + `get-hackathon-submissions-feed`: Server.
- `HackathonSubmissionsTable` / `HackathonSubmissionsFilters`: Client; props are plain serializable rows / problem options only (no functions across the boundary).

## 6. Steps

### Step 1 — Query

Add `getHackathonSubmissionsFeed({ problemId?: string })` querying `HackathonSubmission` with team + problem + participants. Map to a flat row type. Also `getHackathonProblemFilterOptions` for filter pills.

### Step 2 — Table UI

Mirror challenge submissions table patterns. Columns: Updated · Team · Type · Leader · Brief · Repo · Live · AI Log.

### Step 3 — Filters + export

Brief filter pills + CSV export via `getHackathonSubmissionsForExport`.

### Step 4 — Wire the page

Third tab `?tab=hackathon`; hide challenge filters on that tab.

### Step 5 — Changelog

Append Pending reconcile line.

## 7. Guardrails for Cursor (DO NOT)

- Do not mix hackathon rows into the challenge Feed or Missing-by-Day logic.
- Do not add scoring, status enums, reject buttons, or edit history.
- Do not change `/admin/hackathon`, submission participant UX, or Prisma schema.
- Do not add new abstraction files beyond the three listed new files.
- Do not import `@/lib/*` into `middleware.ts`.
- Do not use `<Button asChild>` / `<Button render={<Link}>`.
- Do not edit `CLAUDE.md` or `docs/project-context.md`.
- If build/type errors contradict this plan, stop and report — no improvised workarounds.

## 8. DB safety

None (read-path + UI only).

## 9. Verification

- Manual: `/admin/submissions?tab=hackathon` lists teams that saved an entry; brief filter narrows rows; links open in a new tab; leader links to student detail.
- Challenge Feed / Missing tabs unchanged.
- CSV export downloads expected columns.
- `npx tsc --noEmit` and production build pass.
- Files changed: exactly §4.

## 10. Commit message

```
feat(admin): show hackathon submissions on Submissions tab
```
