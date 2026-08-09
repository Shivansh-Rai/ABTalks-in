# 058 — Show hackathon students on /admin/students

## 1. Goal
Make `/admin/students` list **challenge enrollments and hackathon participants** in one roster, filterable by track (`ALL` / `CHALLENGE` / `HACKATHON`). Today the page only queries `Enrollment`, so hackathon-only registrants are invisible there (they only appear under `/admin/hackathon/students`).

## 2. Current behavior
- [`src/features/admin/get-students.ts`](src/features/admin/get-students.ts) — `prisma.enrollment.findMany` only; domain/status/search/sort; `take: 100`.
- [`src/app/admin/students/page.tsx`](src/app/admin/students/page.tsx) — renders challenge columns (domain, day, streak, status, referrals).
- [`src/components/admin/students-filters.tsx`](src/components/admin/students-filters.tsx) — domain / status / sort + CSV via `getStudentsForExport`.
- [`src/features/admin/get-student-detail.ts`](src/features/admin/get-student-detail.ts) — returns `null` without `studentProfile` → hackathon-only detail links 404.
- [`/admin/hackathon/students`](src/app/admin/hackathon/students/page.tsx) stays as the detailed hackathon master roster (phone, team, OLD/NEW). **Do not remove it.**

## 3. Locked decisions
- **Track filter** query param: `track=ALL|CHALLENGE|HACKATHON` (default `ALL`).
- **ALL = union of rows**, not person-dedupe: a dual user (challenge + hackathon) appears **twice** when `track=ALL` (one challenge row, one hackathon row). Matches how filters work.
- **Domain / status filters apply only to challenge rows.** If `domain !== ALL` or `status !== ALL`, omit hackathon rows even when `track=ALL`. When `track=HACKATHON`, ignore domain/status in the query (UI clears them when switching to Hackathon).
- **Hackathon row display mapping:**
  - Domain badge: `HACKATHON`
  - Day / Streak: `—` (UI) / `0` (sort)
  - Status badge: team `SOLO` or `TEAM`
  - Type: `STUDENT`
  - Affiliation: participant `college`
  - Joined: `HackathonParticipant.createdAt`
  - Name: participant `fullName` (fallback email)
- **Detail click:** challenge rows and dual users → `/admin/students/[userId]` as today. Hackathon-only (no `StudentProfile`) → same URL, but detail loader must support them (reduced view). Do **not** invent challenge actions for profileless users.
- **List cap:** still 100 rows after merge + sort.
- **Export:** respect `track` + existing search/domain; include a `Track` column; hackathon export fields use participant data.
- No schema / migration / seed changes.

## 4. Files to touch
- [`docs/plans/058-admin-students-include-hackathon.md`](docs/plans/058-admin-students-include-hackathon.md) **[new]** — this plan
- [`src/features/admin/get-students.ts`](src/features/admin/get-students.ts) **[edit]** — accept `track`; fetch/merge hackathon participants; extend row type + counts
- [`src/components/admin/students-filters.tsx`](src/components/admin/students-filters.tsx) **[edit]** — Track chips; wire `track` into URL + export; clear domain/status when selecting Hackathon
- [`src/app/admin/students/page.tsx`](src/app/admin/students/page.tsx) **[edit]** — pass `track`; render unified rows (HACKATHON badge, em dash for day/streak, SOLO/TEAM status); stable `key` = `track:id`
- [`src/app/actions/admin-export-actions.ts`](src/app/actions/admin-export-actions.ts) **[edit]** — `getStudentsForExport` includes hackathon when track allows
- [`src/features/admin/get-student-detail.ts`](src/features/admin/get-student-detail.ts) **[edit]** — if no `studentProfile` but `hackathonParticipant` exists, return a hackathon-only detail shape (not `null`)
- [`src/app/admin/students/[id]/page.tsx`](src/app/admin/students/[id]/page.tsx) **[edit]** — branch: challenge/profile view (existing) vs hackathon-only summary (name, email, phone, college, graduation year, team SOLO/TEAM + name, joined); omit `StudentActionPanel` / recruiter / submission tabs that require a profile

## 5. Server vs Client
- `get-students` / `get-student-detail` / page: Server Components / server features.
- `StudentsFilters`: Client — only plain serializable props (`domainCounts`, optional `trackCounts`). No functions across the boundary.

## 6. Steps

### Step 1 — Extend `getStudents` / counts
- Add `track?: "ALL" | "CHALLENGE" | "HACKATHON"` to input.
- Extend each row with:
  - `track: "CHALLENGE" | "HACKATHON"`
  - `rowId: string` (enrollment id or participant id)
  - keep existing challenge fields; for hackathon set domain `"HACKATHON"`, days/streak `0`, status `"SOLO"|"TEAM"`, `enrollmentId` unused → use `rowId` in UI keys.
- Challenge query: run when `track !== "HACKATHON"` (same filters as today).
- Hackathon query: run when `track !== "CHALLENGE"` **and** `domain` is ALL **and** `status` is ALL. Query `hackathonParticipant.findMany` with search on `fullName` / `email` / related `user.email` / `user.name`; `orderBy: { createdAt: "desc" }`; select team `entryType`/`teamName`, `userId`, college, etc.
- Merge arrays; apply sort (`recent` by `joinedAt`; `days`/`streak` by those fields; `referrals` after referral map); `slice(0, 100)`.
- Update counts helper: keep domain counts as enrollment-only. Add `getStudentTrackCounts()` (or extend return) with `{ ALL, CHALLENGE, HACKATHON }` where `ALL = CHALLENGE + HACKATHON` row totals (dual counted twice). Status filter still scopes challenge count only; when status ≠ ALL, `HACKATHON` count = 0 and `ALL` = challenge matching status.

### Step 2 — Filters UI
- Add Track chip group: `ALL` / `CHALLENGE` / `HACKATHON` with counts.
- On Hackathon select: `pushWith({ track: "HACKATHON", domain: "ALL", status: "ALL" })`.
- Domain/status chips: when `track === "HACKATHON"`, disable or hide (only Track + search + sort remain useful; sort days/streak still allowed but hackathon rows stay at 0).
- Export passes `track`.

### Step 3 — List page UI
- Read `track` from `searchParams`; default `ALL`.
- Subtitle: “Showing N of M matching students” (rows, not enrollments-only wording).
- `domainBadgeClass`: add `HACKATHON` style (reuse a neutral/outline style — not a new design system).
- Day/Streak cells: if `track === "HACKATHON"` show `—`, else numbers.
- Link: `/admin/students/${userId}` for all rows (detail handles both).

### Step 4 — Export
- Mirror list inclusion rules for track/domain/search.
- Challenge rows: existing CSV columns + `Track: "CHALLENGE"`.
- Hackathon rows: Full Name / Email / Phone / College from participant; Domain `HACKATHON`; Status = SOLO/TEAM; days/streak empty or 0; `Track: "HACKATHON"`.

### Step 5 — Detail for hackathon-only
- In `getStudentDetail`: if user exists, no `studentProfile`, but `hackathonParticipant` present → return `{ kind: "hackathon", user, hackathon: { fullName, email, phone, college, graduationYear, team… } }` (or equivalent discriminated shape).
- If profile exists → keep current return; optionally attach `hackathon` when present for a small badge (nice-to-have; **skip** unless trivial — do not expand scope).
- Detail page: if hackathon-only kind → header + one “Hackathon registration” card; no reject/recruiter/action panels. If profile kind → unchanged.

## 7. Guardrails for Cursor (DO NOT)
- Do not remove or rewrite `/admin/hackathon` or `/admin/hackathon/students`.
- Do not create `StudentProfile` / `Enrollment` for hackathon users.
- Do not add schema, migrations, or new abstraction files beyond what’s listed.
- Do not import `@/lib/*` into `middleware.ts`.
- Do not put `requireAdmin` on public auth routes (N/A here; list stays under existing admin layout).
- Do not use `<Button asChild>` / `<Button render={<Link>}>`.
- If build/type errors contradict this plan, stop and report — no improvised workarounds.
- Do not edit `CLAUDE.md` or `docs/project-context.md`.

## 8. DB safety
None (read-path + UI only).

## 9. Verification
- Manual: `/admin/students` with `track=ALL` shows challenge + hackathon-only people; `track=HACKATHON` shows only participants; domain `SE` hides hackathon rows; search finds hackathon by participant name.
- Click hackathon-only name → detail page loads (no 404), shows college/team; no broken action panel.
- Dual user appears twice on ALL; once under each track filter.
- CSV export with `track=HACKATHON` includes participants.
- `npx tsc --noEmit` (or project typecheck) and production build pass.
- Files changed: exactly the list in §4 (plus this plan file under `docs/plans/`).

## 10. Commit message
`feat(admin): include hackathon participants on students roster with track filter`

## 11. Changelog
After implement: append one line under `## Pending reconcile` in [`docs/CHANGELOG.md`](docs/CHANGELOG.md):
`YYYY-MM-DD [convention] /admin/students lists challenge + hackathon via track filter (ALL|CHALLENGE|HACKATHON)`
