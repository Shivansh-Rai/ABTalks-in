---
name: Hackathon master students
overview: Add a `/admin/hackathon/students` master roster page linked from `/admin/hackathon`, listing each hackathon registrant (Name, Email, Type, Team Name) sorted by newest join, with an All/OLD/NEW filter based on challenge enrollment.
todos:
  - id: loader
    content: Add getHackathonMasterStudents with cohort filter and createdAt desc sort
    status: in_progress
  - id: page-ui
    content: Build /admin/hackathon/students page + All/OLD/NEW filter chips
    status: pending
  - id: link-button
    content: Add Master students link on /admin/hackathon Teams header
    status: pending
  - id: verify
    content: Manual filter/sort smoke + typecheck
    status: pending
isProject: false
---

# 048 — Hackathon master students roster

## 1. Goal
From `/admin/hackathon`, open a master student list of **all hackathon registrants** (one row per person), sorted by recently joined, with an **OLD / NEW** filter based on whether they have any challenge enrollment (AI / DS / SE / CLAUDE).

## 2. Current behavior
- [`src/app/admin/hackathon/page.tsx`](src/app/admin/hackathon/page.tsx) renders [`HackathonView`](src/components/admin/hackathon-view.tsx) — team-centric table + CSV export + problem statement.
- Data from [`getAdminData`](src/features/hackathon/get-admin-data.ts) groups by team; no flat master roster route exists.
- `HackathonParticipant` has `userId`, `fullName`, `email`, `createdAt`, and `team.entryType` / `team.teamName`.
- Challenge membership is `Enrollment` on `userId` with `domain` in `{ AI, DS, SE, CLAUDE }`.

**Defaults (locked):**
- Route: `/admin/hackathon/students`
- Query: `?cohort=all|old|new` (default `all`)
- **OLD** = participant `userId` has **any** `Enrollment` row (any status)
- **NEW** = participant has **zero** enrollments
- Sort: `HackathonParticipant.createdAt` desc
- Columns: Name (`fullName`), Email, Type (`SOLO` / `TEAM`), Team Name (`teamName` or `—` for solo)
- Button label on hackathon page: **Master students** (next to Export CSV)

## 3. Files to touch
- [`docs/plans/048-hackathon-master-students.md`](docs/plans/048-hackathon-master-students.md) **[new]** — this plan (written on implement)
- [`src/features/hackathon/get-master-students.ts`](src/features/hackathon/get-master-students.ts) **[new]** — flat query + OLD/NEW filter
- [`src/components/admin/hackathon-master-filters.tsx`](src/components/admin/hackathon-master-filters.tsx) **[new]** — client All/OLD/NEW chips (`?cohort=`)
- [`src/app/admin/hackathon/students/page.tsx`](src/app/admin/hackathon/students/page.tsx) **[new]** — master table page
- [`src/components/admin/hackathon-view.tsx`](src/components/admin/hackathon-view.tsx) **[edit]** — add Link button to master page

No schema / migration / changelog (no new business rule beyond UI filter; enrollment definition already exists).

## 4. Server vs Client
- `students/page.tsx` — Server Component; reads `searchParams`, loads feed.
- `hackathon-master-filters.tsx` — `"use client"`; updates `cohort` via `URLSearchParams` (same pattern as admin-actions filters).
- Props: only serializable rows `{ id, fullName, email, entryType, teamName, createdAt }[]`.

## 5. Steps

### Step 1 — Loader `getHackathonMasterStudents`
```ts
// cohort: all | old | new
prisma.hackathonParticipant.findMany({
  orderBy: { createdAt: "desc" },
  select: {
    id: true,
    fullName: true,
    email: true,
    createdAt: true,
    userId: true,
    team: { select: { entryType: true, teamName: true } },
    user: { select: { enrollments: { select: { id: true }, take: 1 } } },
  },
});
```
Map each row:
- `entryType`: `team.entryType === "SOLO" ? "SOLO" : "TEAM"`
- `teamName`: solo → `null` (UI shows `—`); team → `team.teamName`
- `isOld`: `user.enrollments.length > 0`

Then filter in memory (or with Prisma `where` if cleaner):
- `old` → keep `isOld`
- `new` → keep `!isOld`
- `all` → keep all

Return `{ students, total, cohort }` (total = filtered length). Prefer Prisma `where` for filter when possible:
- OLD: `user: { enrollments: { some: {} } }`
- NEW: `user: { enrollments: { none: {} } }`

### Step 2 — Page `/admin/hackathon/students`
- Title: **Hackathon master students**
- Subtitle: count of shown rows
- Back link to `/admin/hackathon`
- Filter chips: All | OLD | NEW
- Table: Name | Email | Type | Team Name
- Empty: “No students found”
- Type as outline badge (reuse existing Badge pattern from hackathon-view)

### Step 3 — Filters component
Client chips updating `?cohort=`; remove param when `all`; no pagination for v1 (full list — hackathon size is manageable; match current admin hackathon export scale).

### Step 4 — Button on `/admin/hackathon`
In [`hackathon-view.tsx`](src/components/admin/hackathon-view.tsx) Teams header row, next to Export CSV:
```tsx
<Link href="/admin/hackathon/students" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
  Master students
</Link>
```
Use `buttonVariants` on `<Link>` — never `<Button asChild>`.

## 6. Guardrails for Cursor (DO NOT)
- Do NOT change team-centric `/admin/hackathon` table beyond adding the link button.
- Do NOT sort master list by team name.
- Do NOT include non-hackathon users.
- Do NOT treat Program/B2B membership as OLD — only `Enrollment` (AI/DS/SE/CLAUDE challenges).
- Do NOT import `@/lib/*` into middleware.
- Do NOT edit `CLAUDE.md` or `docs/project-context.md`.
- Do NOT add soft-delete or schema changes.

## 7. Verification
Manual:
1. `/admin/hackathon` → **Master students** → `/admin/hackathon/students`
2. Rows newest-first; Name = person; Type SOLO/TEAM; Team Name `—` for solo
3. Filter OLD shows only challenge-enrolled users; NEW only hackathon-only; All shows everyone
4. Count updates with filter

Automated: `npx tsc --noEmit` (ignore pre-existing `.next/dev/types` corruption if present — typecheck app sources)

## 8. Commit message
`feat(admin): add hackathon master students roster with OLD/NEW filter`
