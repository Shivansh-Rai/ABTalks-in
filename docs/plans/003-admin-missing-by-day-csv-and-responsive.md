# 003 — Admin submissions: Missing-by-day tab, CSV export, responsive polish

## 1. Goal
Add a "Missing by Day" tab on `/admin/submissions` that shows, for each day
1..60, how many enrolled students have not submitted (and lets the admin
drill down to that list). Add two CSV-export buttons on the submissions
page — "Export filtered" and "Export all". Make the admin panel
phone-friendly: sidebar in a slide-out drawer, tables that render as cards
on mobile, sticky filters, and tighter typography.

## 2. Context / current behavior
- `/admin/submissions` (`src/app/admin/submissions/page.tsx`) shows the
  last 100 submission rows in a `<Table>`. Filters (domain, status, day
  range) live in `src/components/admin/submissions-filters.tsx` — the
  domain pill list **already drops `CLAUDE`** which is an extant bug we
  should fix here.
- The submissions feed has **no CSV export** today. Students export
  exists in `src/components/admin/students-filters.tsx` →
  `getStudentsForExport` in `src/app/actions/admin-export-actions.ts` →
  `toCSV` + `downloadCSV` in `src/lib/csv.ts`. Mirror that pattern.
- `src/features/admin/get-submissions-feed.ts` uses `include` rather
  than `select` — violates the standing Prisma-select rule. Tighten as
  part of this change.
- Admin shell: `src/app/admin/layout.tsx` renders the global `AppHeader`
  plus a `md:grid-cols-[220px_1fr]` two-column layout with
  `AdminSidebar`. On mobile, the sidebar becomes a horizontally
  scrolling strip of pills (see `flex gap-2 overflow-x-auto md:block`
  in `admin-sidebar.tsx`). It's functional but cramped.
- All tables across `/admin/*` are raw `<Table>` blocks without
  overflow wrappers — they overflow the viewport on phones.
- After plan 002 ships, the mobile bottom nav also renders on
  `/admin/*`. Admin pages need `pb-16 md:pb-0` to keep their last row
  clear of the bottom bar. (Plan 002 already adds that on `<main>` in
  the root layout, but `AdminLayout` wraps content in its own
  `container` div, so the root-layout padding still applies. Verify.)

## 3. Files to touch

**New files**
- `src/features/admin/get-missing-by-day.ts` `[new]` — Server module.
  Two exports:
  - `getMissingByDayCounts(filters)` → `Array<{ day, totalEnrollments, submitted, missing, pctSubmitted }>` length 60.
  - `getMissingStudentsForDay(day, filters)` → `Array<{ enrollmentId, userId, studentName, email, domain, status, daysCompleted, lastSubmittedDay }>`.
- `src/components/admin/missing-by-day-view.tsx` `[new]` — Client view.
  Summary table on `?tab=missing` (no `day`), drilldown when
  `?tab=missing&day=N`. Includes its own "Export missing" CSV button.
- `src/components/admin/submissions-table.tsx` `[new]` — Client. Pulls
  the row-rendering out of the page so it can render two layouts:
  stacked cards on `< md`, `<Table>` on `md+`. Stateless, takes
  `{ rows }`.
- `src/components/admin/admin-mobile-nav.tsx` `[new]` — Client. The
  hamburger button + slide-in drawer that wraps the existing
  `AdminSidebar` content on mobile.

**Edited files**
- `src/app/admin/submissions/page.tsx` `[edit]` — Read `tab` searchParam
  (`"feed"` default | `"missing"`). Render the existing feed inside the
  new tab shell when `tab=feed`, or `<MissingByDayView />` when
  `tab=missing`. Extract the rows JSX to use `<SubmissionsTable />`.
- `src/components/admin/submissions-filters.tsx` `[edit]` — Add
  `"CLAUDE"` to `domainOptions`. Add two export buttons
  ("Export filtered" / "Export all"). Make the filter container sticky
  on mobile (`sticky top-14 ...`). Hide the day-range filter when
  `tab=missing` (it's irrelevant there).
- `src/features/admin/get-submissions-feed.ts` `[edit]` — Switch to
  `select`. Accept `minDay` / `maxDay` server-side (currently filtered
  client-side after the take-100 query, which silently truncates). Add
  an optional `take` argument (default 100, used by CSV export with a
  larger number).
- `src/app/actions/admin-export-actions.ts` `[edit]` — Add
  `getSubmissionsForExport(filters)` and
  `getMissingStudentsForExport(day, filters)`. Both `requireAdmin()`.
- `src/components/admin/admin-sidebar.tsx` `[edit]` — Strip its
  internal mobile-scroll mode. Always render the vertical nav. The
  mobile-drawer wrapping is `AdminMobileNav`'s responsibility.
- `src/app/admin/layout.tsx` `[edit]` — Add `<AdminMobileNav navItems />`
  rendered as the mobile entry point (visible `< md`). Hide
  `AdminSidebar` `< md`. Bump page padding utilities. Wrap pages in a
  consistent `space-y-4 md:space-y-6` shell.
- `src/app/admin/students/page.tsx` `[edit]` — Wrap the students table
  in `<div className="overflow-x-auto rounded-xl border">`. Add card
  layout on `< md` (mirror the `SubmissionsTable` pattern). Tighten
  h1 to `text-2xl md:text-3xl`.
- `src/app/admin/content/page.tsx` `[edit]` — Overflow wrapper on any
  table; h1 size tweak; no card pattern needed (content is mostly
  text blocks).
- `src/app/admin/page.tsx` `[edit]` — Overview shell tweaks: h1 sizing,
  stack stat cards 1-col `< sm`, 2-col `sm`, 4-col `md`.
- `src/app/admin/analytics/page.tsx` `[edit]` — Overflow wrappers
  around any tabular sections; charts already responsive from Recharts.
- `src/app/admin/campus-ambassadors/page.tsx` `[edit]` — Overflow
  wrapper + h1 size tweak. No card layout required (small list).

**Not touched**
- `prisma/schema.prisma`, migrations.
- `middleware.ts` — `/admin/*` already protected.
- `src/components/ui/*` — no shadcn primitive edits.
- Plan 002's `BottomNav`, `BottomNavGate`, `AppHeader` (no overlap).

## 4. Server vs Client
- `get-missing-by-day.ts` — **Server-only** (Prisma). No React.
- `MissingByDayView` — **Client** (`"use client"`). Needs
  `useSearchParams`/`useRouter` for the day-pick state and the export
  button's `useTransition`.
- `SubmissionsTable` — **Client**. It only renders props; could be a
  Server Component, but `useMemo` for derived display strings and
  consistency with `SubmissionsFilters` says client. No interactivity
  beyond the existing external `<a>` links — keep as a simple client
  component.
- `AdminMobileNav` — **Client**. Owns drawer open/close state.
- `AdminSidebar` — already **Client**, stays so.
- `admin-export-actions.ts` — **Server Actions** (`"use server"`).
- All admin page files (`page.tsx`) — **Server Components**.

**Server → Client prop discipline:**
- Page passes plain JSON to `<SubmissionsTable rows={rows} />` — `rows`
  are objects of strings/numbers/Dates. Dates are OK here because
  Next.js serializes them via the RSC payload, but the cleaner rule
  is to convert to ISO strings server-side. **Do that** —
  `submittedAt: row.submittedAt.toISOString()` — and format on the
  client to keep the boundary purely string/number/boolean.
- Page passes `navItems` (`{ href, label, icon: IconName }[]`) to
  `AdminMobileNav` and `AdminSidebar`. Icons are passed as **string
  names**, not React components — both components look them up via
  `iconMap` internally (existing pattern in `admin-sidebar.tsx`).
- `MissingByDayView` receives `summary: SummaryRow[]` and, when in
  drilldown mode, `students: StudentRow[]`. Plain JSON.

## 5. Step-by-step changes

### 5.1 `src/features/admin/get-missing-by-day.ts` (new)
```ts
import { Domain, EnrollmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

type Filters = {
  domain?: Domain | "ALL";
};

export type MissingDaySummaryRow = {
  day: number;
  totalEnrollments: number;
  submitted: number;
  missing: number;
  pctSubmitted: number; // 0..100, rounded to 1 decimal
};

export async function getMissingByDayCounts(
  filters: Filters,
): Promise<MissingDaySummaryRow[]> { /* see below */ }

export type MissingStudentRow = {
  enrollmentId: string;
  userId: string;
  studentName: string;
  email: string;
  domain: Domain;
  status: EnrollmentStatus;
  daysCompleted: number;
  lastSubmittedDay: number | null;
};

export async function getMissingStudentsForDay(
  day: number,
  filters: Filters,
): Promise<MissingStudentRow[]> { /* see below */ }
```

**Counts implementation** (note: per the answered question, scope is
"All enrolled students with no submission for that day, regardless of
current day"):
1. `where` for both queries respects optional `filters.domain`. Scope
   includes **ACTIVE + COMPLETED**, excludes **ABANDONED** (admin
   actions intentionally soft-removed those — don't count them as
   "missing").
2. `totalEnrollments = prisma.enrollment.count({ where: { status: { in: ["ACTIVE","COMPLETED"] }, ...domain } })`.
3. Per-day submitted counts via groupBy:
   ```ts
   const grouped = await prisma.submission.groupBy({
     by: ["dayNumber"],
     where: {
       enrollment: {
         status: { in: ["ACTIVE", "COMPLETED"] },
         ...(domain ? { domain } : {}),
       },
       dayNumber: { gte: 1, lte: 60 },
     },
     _count: { _all: true },
   });
   const byDay = new Map(grouped.map((g) => [g.dayNumber, g._count._all]));
   ```
4. Build the 60-row array:
   ```ts
   const rows: MissingDaySummaryRow[] = [];
   for (let d = 1; d <= 60; d++) {
     const submitted = byDay.get(d) ?? 0;
     const missing = Math.max(0, totalEnrollments - submitted);
     const pct = totalEnrollments
       ? Math.round((submitted / totalEnrollments) * 1000) / 10
       : 0;
     rows.push({ day: d, totalEnrollments, submitted, missing, pctSubmitted: pct });
   }
   return rows;
   ```

**Drilldown implementation** (`getMissingStudentsForDay`):
- Validate `day` ∈ 1..60. Throw a 400-style result if not.
  - Actually, throw is fine here — caller is the page that already
    validates. Just clamp / early-return for out-of-range.
- Query:
  ```ts
  return prisma.enrollment.findMany({
    where: {
      status: { in: ["ACTIVE", "COMPLETED"] },
      ...(domain ? { domain } : {}),
      submissions: { none: { dayNumber: day } },
    },
    select: {
      id: true,
      domain: true,
      status: true,
      daysCompleted: true,
      lastSubmittedDay: true,
      user: {
        select: {
          id: true,
          email: true,
          studentProfile: { select: { fullName: true } },
        },
      },
    },
    orderBy: [{ daysCompleted: "desc" }, { startedAt: "asc" }],
  }).then((rows) =>
    rows.map((r) => ({
      enrollmentId: r.id,
      userId: r.user.id,
      studentName: r.user.studentProfile?.fullName?.trim() || r.user.email || "Unknown",
      email: r.user.email,
      domain: r.domain,
      status: r.status,
      daysCompleted: r.daysCompleted,
      lastSubmittedDay: r.lastSubmittedDay,
    })),
  );
  ```
- No `include`, only `select`. ✅

### 5.2 `src/features/admin/get-submissions-feed.ts` (edit)
- Replace `include: { enrollment: { select: ... }, user: { include: ... } }`
  with full `select` for the row + nested selects.
- Add `minDay` / `maxDay` (numbers, optional) to the input shape and
  apply them in the `where`:
  ```ts
  ...(input.minDay != null ? { dayNumber: { gte: input.minDay } } : {}),
  ...(input.maxDay != null ? { dayNumber: { lte: input.maxDay } } : {}),
  ```
  (Compose into a single `dayNumber` object if both.)
- Add `take?: number` (default 100). Used by the CSV-export action with
  a large cap.
- Return type unchanged.

### 5.3 `src/app/actions/admin-export-actions.ts` (edit)
Add two server actions. Pattern matches `getStudentsForExport`.

```ts
export async function getSubmissionsForExport(filters: {
  domain?: Domain | "ALL";
  status?: "ALL" | "ON_TIME" | "LATE";
  minDay?: number;
  maxDay?: number;
}) {
  await requireAdmin();
  const rows = await getSubmissionsFeed({
    domain: filters.domain ?? "ALL",
    status: filters.status ?? "ALL",
    minDay: filters.minDay,
    maxDay: filters.maxDay,
    take: 10_000,
  });
  return rows.map((r) => ({
    "Submitted At (UTC)": r.submittedAt.toISOString(),
    "Student": r.studentName,
    "Day": r.dayNumber,
    "Domain": r.domain,
    "Status": r.status,
    "GitHub URL": r.githubUrl,
    "LinkedIn URL": r.linkedinUrl,
  }));
}

export async function getMissingStudentsForExport(
  day: number,
  filters: { domain?: Domain | "ALL" },
) {
  await requireAdmin();
  const rows = await getMissingStudentsForDay(day, {
    domain: filters.domain,
  });
  return rows.map((r) => ({
    "Day Missing": day,
    "Student": r.studentName,
    "Email": r.email,
    "Domain": r.domain,
    "Enrollment Status": r.status,
    "Days Completed": r.daysCompleted,
    "Last Submitted Day": r.lastSubmittedDay ?? "",
  }));
}
```

`requireAdmin()` already throws / redirects — do not wrap it.

### 5.4 `src/components/admin/submissions-filters.tsx` (edit)
1. Add `"CLAUDE"` to `domainOptions`. Use the same domain options array
   as `students-filters.tsx`: `["ALL", "SE", "DS", "AI", "CLAUDE"]`.
2. Sticky behaviour on mobile:
   - Outer container: `sticky top-14 z-30 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur md:relative md:top-auto md:z-auto md:mx-0 md:rounded-xl md:border md:px-3 md:py-3 md:backdrop-blur-none`.
   - The `top-14` matches the `AppHeader` height (`h-14`). Keep this
     value in sync if the header height ever changes.
3. Read `tab` searchParam locally. If `tab === "missing"`, **do not
   render** the day-range form (it's not applicable to the missing
   view).
4. Add a button group on the right:
   ```tsx
   <div className="flex gap-2">
     <Button size="sm" variant="outline" onClick={handleExport(false)} disabled={isExporting}>
       <Download className="mr-2 h-4 w-4" /> Export filtered
     </Button>
     <Button size="sm" variant="outline" onClick={handleExport(true)} disabled={isExporting}>
       <Download className="mr-2 h-4 w-4" /> Export all
     </Button>
   </div>
   ```
   - `handleExport(includeAll)` calls `getSubmissionsForExport` with
     either the current filters or `{}` (no filters), then `toCSV` +
     `downloadCSV`. Filename:
     `abtalks-submissions-${includeAll ? "all" : currentDomain}-${date}.csv`.
   - Toast success/failure exactly like `students-filters.tsx`.
   - Use `useTransition`. Both buttons share the same `isExporting`
     flag.
5. On mobile, the two export buttons sit below the filter pills in a
   `flex-col gap-2` row; on `md+` they sit to the right inline. Use
   responsive flex utilities; do not split into two components.

### 5.5 `src/app/admin/submissions/page.tsx` (edit)
1. Parse the new `tab` searchParam:
   ```ts
   type Tab = "feed" | "missing";
   const tab: Tab = sp.tab === "missing" ? "missing" : "feed";
   const day = Number(sp.day ?? "") || undefined;
   const domainParam = sp.domain ?? "ALL";
   ```
2. Render a tab bar above the filters:
   ```tsx
   <nav className="flex gap-1 rounded-lg border bg-card p-1 text-sm">
     <Link href={hrefForTab("feed")} className={tabPillClass(tab === "feed")}>
       Feed
     </Link>
     <Link href={hrefForTab("missing")} className={tabPillClass(tab === "missing")}>
       Missing by Day
     </Link>
   </nav>
   ```
   `hrefForTab` preserves `domain`/`status` searchParams. `tabPillClass`
   is an inline helper (no extra file).
3. Below the tabs render `<SubmissionsFilters />` (already updated).
4. If `tab === "feed"`:
   - Call `getSubmissionsFeed({ domain, status, minDay, maxDay })` with
     server-side day filtering (no more post-filter on 100 rows).
   - Render `<SubmissionsTable rows={rows} />`.
5. If `tab === "missing"`:
   - Without `day`: call `getMissingByDayCounts({ domain: domainParam })`
     → render `<MissingByDayView mode="summary" summary={rows} />`.
   - With `day`: call `getMissingStudentsForDay(day, { domain: domainParam })`
     → render `<MissingByDayView mode="drilldown" day={day} students={rows} />`.
6. Page heading sizing: `text-2xl md:text-3xl font-display font-bold`.

### 5.6 `src/components/admin/missing-by-day-view.tsx` (new, client)
Props:
```ts
type Props =
  | { mode: "summary"; summary: MissingDaySummaryRow[] }
  | { mode: "drilldown"; day: number; students: MissingStudentRow[] };
```

**Summary mode:**
- A scrollable table on `md+`, stacked card grid on `< md`.
- Columns: Day, Total enrolled, Submitted, Missing, % submitted.
- Each row is a `<Link>` to `?tab=missing&day=N` (preserve domain).
- Tiny progress bar in the % column: 4 px height, `bg-primary` width.

**Drilldown mode:**
- Header row: "Day {day} — Missing students ({students.length})" +
  `<Link>` back to `?tab=missing` (preserve domain).
- "Export missing (CSV)" button: calls
  `getMissingStudentsForExport(day, { domain })` → `toCSV` →
  `downloadCSV`. Filename:
  `abtalks-day${day}-missing-${currentDomain}-${date}.csv`.
- Table (responsive):
  - `< md`: cards stacked `space-y-2`. Each card: name (link to
    `/admin/students/{userId}`), email, badges for domain + enrollment
    status, "Days completed: X · Last submitted: Y".
  - `md+`: `<Table>` with Name | Email | Domain | Status | Days
    completed | Last submitted day.

### 5.7 `src/components/admin/submissions-table.tsx` (new, client)
- Pull JSX from current `page.tsx` mapping over `rows`.
- Render TWO blocks:
  - `<div className="md:hidden space-y-2">{rows.map(card)}</div>`
  - `<div className="hidden md:block overflow-x-auto rounded-xl border">{tableJsx}</div>`
- Card shape (`< md`):
  ```tsx
  <article className="rounded-xl border bg-card p-3 text-sm">
    <header className="flex items-center justify-between">
      <Link href={`/admin/students/${row.userId}`} className="font-medium underline">
        {row.studentName}
      </Link>
      <Badge variant="outline" className={domainBadgeClass(row.domain)}>
        {row.domain}
      </Badge>
    </header>
    <p className="mt-1 text-xs text-muted-foreground">
      Day {row.dayNumber} · {row.status} · {formatDateTimeIST(row.submittedAt)}
    </p>
    <div className="mt-2 flex gap-3 text-xs">
      <a href={row.githubUrl} target="_blank" rel="noreferrer" className="text-primary underline">GitHub</a>
      <a href={row.linkedinUrl} target="_blank" rel="noreferrer" className="text-primary underline">LinkedIn</a>
    </div>
  </article>
  ```
- Receive `rows` with `submittedAt` as a string (ISO) — convert at
  the page server layer per §4.

### 5.8 `src/components/admin/admin-mobile-nav.tsx` (new, client)
- Hamburger button (`Menu` icon from Lucide), visible only `< md`.
- Toggles a fixed-position drawer:
  - Backdrop: `fixed inset-0 z-40 bg-black/40` (visible when open).
  - Panel: `fixed inset-y-0 left-0 z-50 w-64 bg-card border-r p-4 shadow-xl`.
  - Slide animation via `transition-transform` + `translate-x-0` /
    `-translate-x-full` based on `open` state.
  - Esc-key and backdrop-click close.
- Inside the panel: the same `navItems` list rendered as vertical
  `<Link>` rows (reuse the rendering code from `AdminSidebar` —
  duplicate the JSX, do not extract a helper).
- On click of any nav item, close the drawer.
- **Do not** use a portal library or add `@radix-ui/react-dialog` —
  the existing primitives are enough. (Standing rule: no new
  abstraction files / packages for trivial logic.)

### 5.9 `src/components/admin/admin-sidebar.tsx` (edit)
- Drop the `flex … overflow-x-auto md:block` dual mode.
- Always render the vertical block (`<aside className="space-y-1">`).
- Apply `hidden md:block` on the `<aside>` so this version doesn't
  render on phones (the drawer handles that).

### 5.10 `src/app/admin/layout.tsx` (edit)
- Render `<AdminMobileNav navItems={navItems} />` ABOVE the grid (so
  the hamburger sits next to the page heading region on mobile).
  Wrap in `md:hidden` so desktop is unchanged.
- Bump grid `gap` and padding:
  `container mx-auto grid grid-cols-1 gap-4 px-4 py-4 md:grid-cols-[220px_1fr] md:gap-6 md:px-6 md:py-6`.
- The "Admin area is read-only" footnote and "Back to student
  dashboard" link: keep them inside the sidebar column on desktop;
  add them inside the drawer panel for mobile parity.

### 5.11 Other admin pages — quick responsive touches
For each (`students`, `content`, `page.tsx`/overview, `analytics`,
`campus-ambassadors`):
- h1: `text-2xl md:text-3xl font-display font-bold`.
- Stat-card grids: `grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4`.
- Tables: wrap in `<div className="overflow-x-auto rounded-xl border">`.
- For **students**: introduce the mobile card layout — same dual-block
  pattern as `SubmissionsTable`. Each mobile card shows: full name
  (link), domain badge, "Days {daysCompleted}/60", "{currentStreak}d
  streak", college / organization. Reuse the existing students table
  JSX for `md+`.
- DO NOT introduce a `<ResponsiveTable>` abstraction — copy the dual
  pattern inline. (Standing rule.)

## 6. Guardrails for Cursor (DO NOT)
- DO NOT import `@/lib/*` or `@/components/*` into `middleware.ts`.
  This plan doesn't touch middleware, but if you need to gate a new
  route, keep edge-safety.
- DO NOT use `include` in new Prisma queries — `select` only. While
  editing `get-submissions-feed.ts`, also flip its existing `include`
  to `select` (project rule). Multi-step writes (none in this plan)
  would wrap in transactions; reads do not.
- DO NOT add `<Button asChild>` or `<Button render={<Link>}>` for the
  tab links / drawer links / CSV buttons. Use `<Link className={cn(buttonVariants({...}), ...)}>`
  or a plain styled `<Link>`. (Standing rule.)
- DO NOT pass Lucide icon components, Date instances, or functions as
  props across the Server → Client boundary. Convert dates to ISO
  strings server-side; pass icon names as strings and resolve via an
  in-file `iconMap` (see existing `admin-sidebar.tsx`).
- DO NOT add `requireRole` / `requireAdmin` to non-admin pages. All
  changes live under `/admin/*` which is already gated by
  `requireAdmin()` in `AdminLayout`.
- DO NOT add new packages (no `@radix-ui/react-dialog`, no
  `vaul`/drawer libs). The mobile drawer is hand-rolled with Tailwind
  + state.
- DO NOT introduce `any`. The discriminated `Props` for
  `MissingByDayView` narrows via `switch (props.mode)`.
- DO NOT log via `console.*`. The new server module and actions can
  log via `lib/logger.ts` if Prisma throws.
- DO NOT compute IST day boundaries inline. Not relevant in this plan
  (counts ignore current day per the answered scope rule).
- DO NOT use `unstable_cache` on the missing-day queries — admin data
  must be live.
- DO NOT push the CSV export rows above ~10,000. Cap the
  submission-export server-side. If the cap matters in production,
  add a banner row in the CSV ("Truncated to 10000 rows — apply
  filters") — actually, just toast a warning on the client when the
  returned length === cap.
- DO NOT add a new sidebar item for the missing tab. The tab lives
  inside `/admin/submissions`, not the sidebar.
- DO NOT remove the existing "minDay/maxDay" search params from the
  feed tab. Move filtering to the server query but keep the URL
  surface stable.
- DO NOT change `auth.config.ts`, `auth.ts`, or session shape.

## 7. DB safety
**Not applicable** — no schema changes, no migrations, no data
writes. Two new read-side Prisma queries (`groupBy` and
`findMany` with `submissions: { none: ... }`). Index check:
- `Submission.dayNumber` already has `@@index([dayNumber])` per
  `schema.prisma`. The `groupBy` is therefore index-backed.
- `Enrollment` already has `@@index([domain, daysCompleted, currentStreak])`
  and `@@index([userId, status])`. The "no submission for day N" query
  is essentially a NOT EXISTS — Prisma compiles `submissions: { none }`
  to a `NOT EXISTS` subquery; the join uses `Submission.enrollmentId`
  (PK on Enrollment.id, indexed by FK). Should be fine at the 1.5K
  enrollment scale stated in `docs/project-context.md`.

If performance regresses (it shouldn't at v1 scale), the answer is a
materialized view / cached counts — not in this plan.

## 8. Verification

### Manual test plan (local dev, `ENABLE_DEV_AUTH=true`)
1. `npm run dev`. Log in as `admin@abtalks.dev` / `admin`.
2. **Layout/responsive smoke** — DevTools, 390 px width:
   - `/admin` overview shows stat cards stacked 1-col on phone, 2-col
     `sm`, 4-col `md`.
   - Sidebar gone on phone. Hamburger button visible. Tap it →
     drawer slides in from the left. Tap a nav item → drawer closes
     and navigates. Tap the backdrop → drawer closes.
   - `/admin/students` table renders as cards on phone, table on
     `md+`. No horizontal scroll on the page itself.
   - `/admin/submissions` (default `tab=feed`): same dual layout.
     Filters row is sticky just below the app header when you scroll.
3. **Submissions feed**:
   - Open `/admin/submissions?tab=feed&domain=SE&status=ON_TIME&minDay=1&maxDay=30`.
     Confirm filtering is **server-side** (rows are reduced before
     `take 100`, not client-trimmed after).
   - `CLAUDE` pill now appears in the domain filter.
   - Click "Export filtered" → CSV downloads with rows matching the
     filter. Open the file: columns Submitted At (UTC) / Student / Day /
     Domain / Status / GitHub URL / LinkedIn URL.
   - Click "Export all" → CSV downloads with all submissions (capped
     at 10k). Toast warns if the cap was hit.
4. **Missing by Day**:
   - Click the `Missing by Day` tab → URL becomes
     `?tab=missing&domain=SE`. Summary table shows 60 rows.
   - Domain filter changes the totals. CLAUDE filter shows the
     cohort's per-day completion (likely all-or-nothing depending on
     `Challenge.startsAt` date).
   - Click Day 1 → drilldown lists students who never submitted Day 1.
     Sneha (Day 7 user) should NOT appear; Karan (Day 45, broken
     streak) presence depends on whether Day 1 was filled.
   - Click "Export missing (CSV)" → CSV downloads with Day Missing /
     Student / Email / Domain / Enrollment Status / Days Completed /
     Last Submitted Day.
   - Click Day 30 → list grows substantially (most test users haven't
     reached 30).
5. **Tab + filter combinations**:
   - URL `?tab=missing&day=5&domain=AI` should show AI students who
     never submitted Day 5.
   - URL `?tab=missing&day=99` should clamp / show nothing gracefully.
6. **Bottom nav clearance** (assumes plan 002 has shipped first):
   - On phone, the last row of any admin table sits above the
     fixed bottom nav. No overlap. The root layout's
     `pb-16 md:pb-0` on `<main>` handles this.

### Build / typecheck
- `npm run lint` — clean.
- `npm run build` — passes. Edge bundle still small (no `@/lib/*` in
  the middleware path).
- `tsc --noEmit` — clean, no `any`.

### Files that should change (and only these)
**New**
- `src/features/admin/get-missing-by-day.ts`
- `src/components/admin/missing-by-day-view.tsx`
- `src/components/admin/submissions-table.tsx`
- `src/components/admin/admin-mobile-nav.tsx`

**Edited**
- `src/app/admin/submissions/page.tsx`
- `src/components/admin/submissions-filters.tsx`
- `src/features/admin/get-submissions-feed.ts`
- `src/app/actions/admin-export-actions.ts`
- `src/components/admin/admin-sidebar.tsx`
- `src/app/admin/layout.tsx`
- `src/app/admin/students/page.tsx`
- `src/app/admin/content/page.tsx`
- `src/app/admin/page.tsx`
- `src/app/admin/analytics/page.tsx`
- `src/app/admin/campus-ambassadors/page.tsx`

Any file outside this list changing = off-plan. Investigate before
commit.

## 9. Commit message
```
feat(admin): missing-by-day tab, submissions CSV export, mobile polish

- /admin/submissions gains a Missing by Day tab. Summary table shows
  per-day completion across all 60 days (scope: ACTIVE + COMPLETED
  enrollments). Clicking a day drills into the list of students with
  no submission for that day.
- Submissions feed now has Export filtered / Export all CSV buttons
  (cap 10k rows). Adds Export missing (CSV) on the drilldown view.
- Adds CLAUDE to the domain filter (was missing).
- Submissions feed query moves day-range filtering server-side (was
  client-trimmed after take 100, which silently dropped matches).
  Switches the feed query from include to select per project rules.
- Admin shell responsive pass: hamburger drawer on phone instead of
  the horizontal-scroll sidebar; tables render as cards < md and
  table >= md; filter bar sticky on mobile; h1 sizes and padding
  scaled down; all tables wrapped in overflow-x containers.

No schema changes. No new dependencies.
```
