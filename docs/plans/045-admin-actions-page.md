---
name: Admin actions page
overview: Fix broken “View all Activity” by adding a paginated `/admin/actions` page (20 per page, newest first) with action-type filters, and start logging remark CRUD into `AdminAction` so remarks appear in the feed.
todos:
  - id: audit-remarks
    content: Log ADD/UPDATE/DELETE_REMARK to AdminAction; backfill existing remarks
    status: in_progress
  - id: feed-loader
    content: Add getAdminActionsFeed with page size 20 and type filters
    status: pending
  - id: actions-page-ui
    content: Build /admin/actions page, filters, pagination; fix overview link + nav
    status: pending
  - id: verify
    content: Changelog, typecheck/build, manual filter/pagination smoke test
    status: pending
isProject: false
---

# 045 — Admin actions activity page

## 1. Goal
Fix `/admin` Recent Activity so “View all Activity” opens a full admin-actions feed: every logged action (including remarks, grant synergy, reset progress, etc.), 20 per page with Next, newest-first, filterable by action category.

## 2. Current behavior
- [`src/app/admin/page.tsx`](src/app/admin/page.tsx) “View all Activity →” links to `/admin/submissions` (wrong).
- Overview loads only `take: 10` via [`get-overview-stats.ts`](src/features/admin/get-overview-stats.ts).
- No `/admin/actions` route. Per-student history is only the Admin Actions tab on [`students/[id]`](src/app/admin/students/[id]/page.tsx).
- [`admin-remark-actions.ts`](src/app/actions/admin-remark-actions.ts) does **not** write `AdminAction` rows, so remarks never appear in activity.

**Defaults (locked):**
- Route: `/admin/actions`
- Page size: 20; query params `?page=1&type=all|grant_synergy|remark|reset_progress|other`
- Filter buckets:
  - `grant_synergy` → `GRANT_SYNERGY`
  - `remark` → `ADD_REMARK` | `UPDATE_REMARK` | `DELETE_REMARK`
  - `reset_progress` → `RESET_PROGRESS`
  - `other` → everything else (reject submission, remove from challenge, toggle ready, recruiter, program, …)
  - `all` → no `actionType` filter
- Feed reads **only** `AdminAction` (no dual-table pagination). Remark CRUD will write audit rows; existing remarks get a one-time backfill as `ADD_REMARK`.

## 3. Files to touch
- [`docs/plans/045-admin-actions-page.md`](docs/plans/045-admin-actions-page.md) **[new]** — this plan
- [`src/app/actions/admin-remark-actions.ts`](src/app/actions/admin-remark-actions.ts) **[edit]** — create/update/delete also insert `AdminAction`
- [`src/features/admin/get-admin-actions-feed.ts`](src/features/admin/get-admin-actions-feed.ts) **[new]** — paginated + filtered query
- [`src/components/admin/admin-actions-filters.tsx`](src/components/admin/admin-actions-filters.tsx) **[new]** — client filter control (searchParams)
- [`src/components/admin/admin-actions-pagination.tsx`](src/components/admin/admin-actions-pagination.tsx) **[new]** — Prev/Next links
- [`src/app/admin/actions/page.tsx`](src/app/admin/actions/page.tsx) **[new]** — list page
- [`src/app/admin/page.tsx`](src/app/admin/page.tsx) **[edit]** — “View all Activity →” → `/admin/actions`
- [`src/app/admin/layout.tsx`](src/app/admin/layout.tsx) **[edit]** — nav item “Activity” → `/admin/actions` (after Overview)
- [`src/components/admin/admin-sidebar.tsx`](src/components/admin/admin-sidebar.tsx) / [`admin-mobile-nav.tsx`](src/components/admin/admin-mobile-nav.tsx) **[edit only if]** icon union needs a new key — reuse closest existing icon (e.g. `submissions` or `overview`) rather than new icon assets
- One-off backfill script run during implement (Shell/`tsx`) — not left as a permanent app file unless needed; prefer inline `npx tsx` that creates `AdminAction` for each existing `AdminRemark` as `ADD_REMARK` (skip if already backfilled: match `actionType=ADD_REMARK` + `metadata.remarkId`)
- [`docs/CHANGELOG.md`](docs/CHANGELOG.md) **[edit]** — one line: remark CRUD now audited via AdminAction

No Prisma schema change required (`actionType` is already a free string). Optional index skipped to keep scope small.

## 4. Server vs Client
- `actions/page.tsx` — Server Component; reads `searchParams`, calls feed loader.
- `admin-actions-filters.tsx` — `"use client"`; updates `type` (and resets `page` to 1) via `router.push` / `URLSearchParams` (same pattern as [`students-filters.tsx`](src/components/admin/students-filters.tsx)).
- `admin-actions-pagination.tsx` — can be Server (plain `<Link>`) or client; prefer Server with `href`s built on the page.
- Props across boundary: only strings/plain DTOs (`type`, `page`, rows with ids/names/labels). No functions/icons across RSC→client.

## 5. Steps

### Step 1 — Audit remark CRUD
In [`admin-remark-actions.ts`](src/app/actions/admin-remark-actions.ts), after successful remark write (same transaction if easy; else sequential):

| Mutation | `actionType` | Fields |
|----------|--------------|--------|
| create | `ADD_REMARK` | `adminUserId`, `targetUserId: studentUserId`, `reason: body` (trim/slice 500), `metadata: { remarkId }` |
| update | `UPDATE_REMARK` | same + `metadata: { remarkId }` |
| delete | `DELETE_REMARK` | `reason` optional (previous body if still in hand), `metadata: { remarkId }` |

Do **not** remove `AdminRemark` storage — remarks tab stays the editor; `AdminAction` is the audit trail for the activity page.

### Step 2 — Backfill existing remarks
One-time: for each `AdminRemark`, if no `AdminAction` with `actionType: "ADD_REMARK"` and `metadata.remarkId === remark.id`, create one with `createdAt` copied from the remark, `adminUserId` / `targetUserId` from the remark, `reason: body` sliced to 500.

### Step 3 — Feed loader `getAdminActionsFeed`
```ts
const PAGE_SIZE = 20;
// type → Prisma where.actionType in / notIn as above
prisma.adminAction.findMany({
  where,
  orderBy: { createdAt: "desc" },
  skip: (page - 1) * PAGE_SIZE,
  take: PAGE_SIZE,
  select: { id, actionType, reason, metadata, createdAt,
    admin: { select: { email, studentProfile: { select: { fullName } } } },
    target: { select: { id, email, studentProfile: { select: { fullName } } } },
  },
});
prisma.adminAction.count({ where });
```
Map with existing `formatAdminActionType` (re-export from overview or move helper to a tiny shared spot **only if** both files need it — prefer importing from `get-overview-stats.ts` or duplicating the 8-line helper inline to avoid new abstraction files; **import from get-overview-stats** is fine since it already exports it).

Return `{ items, total, page, pageSize, totalPages }`.

### Step 4 — UI page `/admin/actions`
- Title: “Admin Actions”
- Filter chips/select: All | Grant synergy | Remark | Reset progress | Other
- Table or card list: admin name · action label · target link to `/admin/students/{id}` · reason snippet · `formatDateTimeIST(createdAt)`
- Empty: “No admin actions found”
- Pagination: “Previous” / “Next” (disable when `page <= 1` / `page >= totalPages`); preserve `type` in links. Show “Page X of Y” or total count.

### Step 5 — Wire overview + nav
- Overview link → `/admin/actions`
- Nav: `{ href: "/admin/actions", label: "Activity", icon: ... }` immediately after Overview
- Timeline on overview stays `take: 10` (unchanged)

### Step 6 — Changelog
`YYYY-MM-DD [rule] Admin remark CRUD writes AdminAction audit rows; /admin/actions paginated activity feed`

## 6. Guardrails for Cursor (DO NOT)
- Do NOT point “View all Activity” at `/admin/submissions`.
- Do NOT dual-query AdminRemark + AdminAction for pagination (use audit + backfill).
- Do NOT soft-delete remarks or change Remarks tab UX beyond audit logging.
- Do NOT import `@/lib/*` into middleware.
- Do NOT add new UI primitives under `src/components/ui/*`.
- Do NOT edit `CLAUDE.md` or `docs/project-context.md`.
- Do NOT invent filter buckets beyond all / grant_synergy / remark / reset_progress / other.
- If build fails due to pre-existing Neon drift unrelated to this work, stop and report — do not `db push --accept-data-loss`.

## 7. DB safety
- No schema migration. Backfill is data-only (insert AdminAction rows). Snapshot/commit optional; note commit hash before backfill if using shared Neon.

## 8. Verification
Manual:
1. `/admin` → “View all Activity →” opens `/admin/actions`.
2. List shows newest first; at most 20 rows; Next loads older page.
3. Filter Grant synergy / Remark / Reset progress / Other each narrow correctly; All shows everything.
4. Add a remark on a student → new row appears as Add remark on `/admin/actions` and student Admin Actions tab.
5. Grant synergy / reset progress still appear.

Automated: `npx tsc --noEmit` and `npm run build` pass.

## 9. Commit message
`feat(admin): add paginated admin actions activity page with filters`
