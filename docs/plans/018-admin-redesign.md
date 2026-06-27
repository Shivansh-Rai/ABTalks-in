# 018 — Admin redesign (Figma: "Abtalks Admin Redesign")

> Source: Figma file `WsqYYevAiHtqH50SOaoPlh` ("Abtalks-Admin-Redesign").
> Real layered frames seen in full: **Admin Overview** (`4:2`), **Students** (`26:80`).
> Other frames exist in the file (**Submissions Feed** `38:178`, **Jobs** `41:2`,
> **Content** `57:39` / `content 2` `57:157`, **Marketplace** `65:32`/`79:23`) plus a
> light-theme **Content** ChatGPT reference mock (`65:23`). Pixel-level capture of
> those four was blocked mid-session by the Figma Starter-plan MCP tool-call limit —
> see **Phase 3** (design capture pending).

---

## 1. Goal
Re-skin the admin area from the current plain shadcn-on-themed-background look into the
polished dark "console" in Figma: a full-bleed left nav rail, gradient/accent stat cards
with sparklines + week-over-week deltas, a Pending-Reviews + Recent-Activity overview, and
restyled data tables with a filter-dropdown pattern. This is **primarily a presentational
redesign** — the data layer and routes already exist; only `get-overview-stats.ts` needs a
read-only extension.

## 2. Current behavior
- `src/app/admin/layout.tsx` renders `AppHeader` + a `container`-width
  `grid-cols-[220px_1fr]` with `AdminSidebar` (light/dark via existing CSS tokens).
- Routes already exist for every nav item: `/admin` (Overview), `/admin/students` (+`[id]`),
  `/admin/submissions`, `/admin/jobs` (+`[id]`), `/admin/content`, `/admin/analytics`,
  `/admin/campus-ambassadors`, `/admin/referrals`. Sidebar order/labels already match Figma.
- Overview (`/admin`) shows 4 plain stat cards (Total Students, Active Today, **Day 7
  Reached**, **Day 30 Reached**), a "Live Submissions" list, and a "Recent Admin Actions"
  list — all flat shadcn `Card`s, no deltas, no sparklines.
- `getOverviewStats()` returns `{ totalStudents, activeToday, day7Reached, day30Reached }`,
  `liveSubmissions[]` (last 10 submissions), `recentAdminActions[]` (last 10).
- Students page: heading + count, `StudentsFilters` (search input + Export CSV + pill row
  for domain/status), `StudentsSortSelect`, a mobile card list, and a desktop `Table`.

## 3. Decisions to lock before building
1. **Theme scope.** Figma shows the admin in **dark**. The app supports light/dark/system
   and the admin already shares those tokens. **Recommendation: build the new visuals
   against the existing CSS token system so they render correctly in both themes (matching
   Figma in dark), and do NOT force dark-only.** This keeps the header theme toggle working
   and avoids a token fork. The accent treatments (gradient active pill, colored card
   top-borders, sparklines) read well in light mode too. *If the owner instead wants
   admin-forced-dark, that's a one-line wrapper (`<div className="dark">`) but breaks the
   toggle inside admin — not recommended.*
2. **"Pending Reviews" card.** Submissions are auto-validated; there is **no
   pending/approved state** in the schema. Map "Pending Reviews" to the existing
   `liveSubmissions` feed, where each row's **Review** button links to
   `/admin/students/[userId]`. A true moderation queue (a `Submission.reviewStatus` column)
   is out of scope here — note as a possible Phase-2 schema change, do NOT add it now.
3. **"Recent Activity" timeline** = the existing `recentAdminActions` reshaped as a
   vertical timeline. No new data.

## 4. Scope / phasing
- **Phase 1 — Shell** (layout, sidebar, mobile nav). Fully specced below.
- **Phase 2 — Overview + Students**. Fully specced below.
- **Phase 3 — Submissions, Jobs, Content, Analytics, Campus Ambassadors, Referrals.**
  Apply the shared primitives from Phases 1–2 (page header, panel/table surface, filter
  dropdown). The bespoke Figma frames (Submissions/Jobs/Content) need a fresh design capture
  before they can be specced pixel-exact — captured separately.
  **Marketplace is explicitly OUT of scope (do not design or build it now)** — it is likely
  the student-facing jobs board, not an admin screen.

Build Phase 1 → 2 → 3 in order. Each phase is independently shippable and committable.

---

## 5. Files to touch

### Phase 1 — Shell
- `src/app/admin/layout.tsx` **[edit]** — full-bleed shell: fixed dark left rail (desktop) +
  scrollable main; keep `AppHeader` on top; move "Back to student portal" into the rail.
- `src/components/admin/admin-sidebar.tsx` **[edit]** — restyle: brand mark at top, nav items
  with icon, gradient active pill, "Back to student portal" pinned at bottom.
- `src/components/admin/admin-mobile-nav.tsx` **[edit]** — restyle the drawer to match the
  dark rail (visual only; open/close logic unchanged).

### Phase 2 — Overview + Students
- `src/features/admin/get-overview-stats.ts` **[edit]** — add `day60Reached`, week-over-week
  deltas for the 4 headline stats, and a 14-day daily-new-students series for the sparkline.
  Read-only (counts only). No schema change.
- `src/components/admin/stat-card.tsx` **[new]** — presentational accent stat card (Server
  Component): colored top-border, label, big value, delta pill, icon tile, sparkline slot.
- `src/components/admin/admin-sparkline.tsx` **[new]** — `"use client"` Recharts mini
  line/area (Recharts already a dependency).
- `src/components/admin/activity-timeline.tsx` **[new]** — Server Component rendering the
  recent-admin-actions timeline (dots + connector + text).
- `src/app/admin/page.tsx` **[edit]** — new heading block, 4× `StatCard` grid, two-column
  **Pending Reviews** (Review buttons) + **Recent Activity** (`ActivityTimeline`).
- `src/app/admin/students/page.tsx` **[edit]** — restyle heading, wrap table in the new
  panel surface, restyle status/type/domain badges and pagination affordance to match.
- `src/components/admin/students-filters.tsx` **[edit]** — convert the inline pill row into a
  **Filters dropdown panel** (Domain / Status / Sort) + keep Export CSV; preserve all
  existing URL-param behavior and the export action.

### Phase 3 — remaining screens (after capture)
- `src/app/admin/submissions/page.tsx`, `src/components/admin/submissions-table.tsx`,
  `submissions-filters.tsx` **[edit]**
- `src/app/admin/jobs/page.tsx`, `src/app/admin/jobs/[id]/page.tsx`, `job-form.tsx`,
  `job-admin-controls.tsx` **[edit]**
- `src/app/admin/content/page.tsx`, `content-viewer.tsx` **[edit]**
- `src/app/admin/analytics/page.tsx` **[edit]** (Recharts theming to match)
- `src/app/admin/campus-ambassadors/page.tsx`, `src/app/admin/referrals/page.tsx` **[edit]**
- **Marketplace — NOT in scope.** Do not create or modify any marketplace screen.

---

## 6. Server vs Client (boundary map)
- `admin/layout.tsx` — **Server** (already async; calls `requireAdmin()`).
- `AdminSidebar`, `AdminMobileNav` — **Client** (`usePathname`, drawer state). Pass nav items
  as plain serializable data (string `href`, `label`, and an `icon` **string key**) — icons
  are resolved inside the client component via the existing `iconMap`. **Do NOT pass Lucide
  icon components or functions across the Server→Client boundary** (existing pattern; keep it).
- `admin/page.tsx`, `admin/students/page.tsx` — **Server**.
- `StatCard`, `ActivityTimeline` — **Server** (presentational, no interactivity).
- `AdminSparkline` — **Client** (Recharts). `StatCard` (Server) renders `<AdminSparkline
  data={number[]} />` — pass only a serializable `number[]`, no functions/instances.
- `StudentsFilters` — **Client** (already; keeps router/searchParams + export transition).

---

## 7. Steps

### Phase 1 — Shell

1. **`admin-sidebar.tsx`** — keep the `"use client"` + `usePathname` + `iconMap` machinery and
   the `NavItem`/`IconName` types as-is. Restyle only:
   - Wrap in a column flex that fills available height (`flex h-full flex-col`).
   - Top: a brand block (e.g. `AB TALKS` wordmark, `font-display`, `A`/accent like the header
     logo) — static, not a link, or link to `/admin`.
   - Nav list (`flex-1`): each item `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm`.
     - **Active** (`pathname === href || pathname.startsWith(href + "/")`):
       `bg-gradient-to-r from-primary to-violet-500 text-primary-foreground shadow-[var(--shadow-card)]`
       with a subtle left accent; **inactive**: `text-muted-foreground hover:bg-accent/60
       hover:text-foreground`. Icon `h-4 w-4`.
   - Bottom (pinned): `← Back to student portal` → `Link href="/dashboard"`,
     `text-xs text-primary hover:underline`. Remove the separate "Admin area is read-only"
     caption from the layout's sidebar column (it can move here as muted text or be dropped).
2. **`admin-mobile-nav.tsx`** — keep all open/close + `Escape` logic. Restyle the drawer panel
   and items to mirror the sidebar (gradient active pill, dark `bg-card`, brand row at top,
   "Back to student portal" at bottom). No logic changes.
3. **`admin/layout.tsx`** — restructure the shell:
   - Keep `requireAdmin()` and the `navItems` array (already correct order/labels/icons).
   - Keep `<AppHeader user={{…}} />` at the top (it already renders the Admin pill, theme
     toggle, streak chip equivalent, and avatar shown in Figma).
   - Replace the `container … grid-cols-[220px_1fr]` with a full-width two-pane layout:
     a fixed/sticky left rail (`hidden md:flex md:w-64 md:flex-col`, `border-r`,
     `min-h-[calc(100vh-3.5rem)]`, `sticky top-14`) containing `<AdminSidebar navItems=…/>`,
     and a `main flex-1 min-w-0 px-4 py-6 md:px-8` for `children`.
   - Mobile: render `<AdminMobileNav navItems=…/>` above `children` (as today).
   - Keep the page background on the existing `bg-background` token (dark token already
     matches Figma). Do NOT hardcode hex backgrounds.
4. **Verify Phase 1**: every admin route still renders, active nav highlight is correct on
   nested routes (e.g. `/admin/students/[id]` highlights Students), mobile drawer opens/closes,
   theme toggle still flips the admin chrome. `npx tsc --noEmit` + `npm run build` clean.

### Phase 2 — Overview

5. **`get-overview-stats.ts`** — extend the existing `Promise.all` (keep IST bounds helper and
   `formatAdminActionType`). Add, all as Prisma `count`/grouped reads with `select`/counts only:
   - `day30Reached` (already) and **`day60Reached`**: `enrollment.count({ where: {
     daysCompleted: { gte: 60 } } })`. (Figma's headline cards are **Total Students, Active
     Today, Day 30 Reached, Day 60 Reached** — replace the current Day 7 card with Day 60;
     keep `day7Reached` in the return if cheap, or drop it.)
   - **Week-over-week deltas** for the 4 headline numbers: compute "this week" vs "last week"
     using IST 7-day windows on `createdAt`/`submittedAt`/relevant timestamps, returning a
     signed integer per stat (e.g. `totalStudentsDelta: +12`). Where a true historical delta
     isn't cheaply available, return `null` and have `StatCard` hide the pill (do NOT fabricate
     numbers).
   - **Sparkline series**: a `number[]` of new-student counts per day for the last 14 IST days
     (one grouped query bucketed by IST date). Return as `totalStudentsSeries: number[]`.
     Optional per-card series; if a series isn't available, omit and `StatCard` renders without
     a sparkline.
   - Extend the return type accordingly. Keep `liveSubmissions` and `recentAdminActions`
     exactly as today (Pending Reviews + Recent Activity consume them).
6. **`admin-sparkline.tsx`** `[new, "use client"]` — props `{ data: number[]; positive?:
   boolean }`. Render a small Recharts `<LineChart>`/`<AreaChart>` (~`h-10 w-24`), no axes/grid/
   tooltip, stroke = `hsl(var(--primary))` (or emerald/red by `positive`). Wrap in
   `ResponsiveContainer`. Guard empty/short arrays.
7. **`stat-card.tsx`** `[new, Server]` — props `{ label: string; value: number | string;
   delta?: number | null; deltaSuffix?: string; accent: "green" | "purple" | "orange" |
   "blue"; icon: ReactNode; series?: number[] }`.
   - Card: existing `Card` primitive (or a `div` with `rounded-xl border bg-card
     shadow-[var(--shadow-card)]`) with a **colored top border/accent bar** per `accent`
     (emerald / violet / orange / sky — use Tailwind color utilities, not raw hex).
   - Layout: label (muted, `text-sm`) + small icon tile top-right; big value
     (`text-3xl font-bold`); delta pill below (`+N this week` green / `-N this week` red,
     hidden when `delta == null`); `series` → `<AdminSparkline data={series} positive=…/>`
     in the top-right.
   - **Icon is rendered by the page (Server) and passed as `ReactNode`** — acceptable because
     both sides are Server here. (The Server→Client icon ban applies only to the sidebar.)
8. **`activity-timeline.tsx`** `[new, Server]` — props `{ items: RecentAdminAction[] }` (the
   existing `recentAdminActions` shape). Render a vertical timeline: left dot + connector line,
   then `{adminName} {actionLabel}` bold, `Target: <Link>{targetName}</Link>`, and
   `createdAtRelative` as a timestamp. Use muted/border tokens; color the dot by action type if
   trivial, else a single accent.
9. **`admin/page.tsx`** — rebuild using the new pieces:
   - Heading: `Admin Overview` (`font-display text-2xl md:text-3xl font-bold`) + subtitle
     `Quick snapshot of what's happening on ABTalks`.
   - Stat grid `grid gap-4 sm:grid-cols-2 xl:grid-cols-4`: four `StatCard`s — Total Students
     (green, Users icon), Active Today (purple, Activity icon), Day 30 Reached (orange, Calendar
     icon), Day 60 Reached (blue, Trophy icon) — each fed value/delta/series from the extended
     stats.
   - Two-column `grid gap-4 lg:grid-cols-2`:
     - **Pending Reviews** card: header `Pending Reviews` + `View all →` link to
       `/admin/submissions`. Rows from `liveSubmissions`: avatar initials, name (link to
       `/admin/students/[userId]`), `Day {n} · {domain}` + optional LinkedIn link,
       `{submittedAtRelative}`, and a **Review** button (`buttonVariants` on a `<Link href=
       "/admin/students/[userId]">` — per project rule, never `<Button asChild>`/`render`).
     - **Recent Activity** card: header `Recent Activity` + `View all Activity →`;
       body `<ActivityTimeline items={recentAdminActions} />`. Empty state preserved.
10. **Verify Overview**: numbers render, deltas show/hide correctly, sparklines draw, Review
    links navigate, timeline matches `recentAdminActions`. Typecheck/build clean.

### Phase 2 — Students

11. **`students-filters.tsx`** — keep `"use client"`, all `pushWith`/URL-param logic, and the
    `handleExport` transition unchanged. Restructure the UI into the Figma pattern:
    - A row: full-width search `Input` (left) + **Filters** dropdown trigger + **Export CSV**
      button (right). Use the existing `DropdownMenu` primitive (or a `Popover` if already
      available — check `components/ui`; do not add a new dep) for the Filters panel.
    - Filters panel contents: a **Clear** action (resets domain/status/sort params), a
      **Domain** group (ALL/SE/DS/AI/CLAUDE with counts via `domainCountLabel`), a **Status**
      group (ALL/ACTIVE/COMPLETED), and a **Sort/Time** group (Recently joined / Days completed
      / Current streak / Referrals) — wire Sort to the same param `StudentsSortSelect` uses so
      the two stay consistent (or fold `StudentsSortSelect` into this panel and remove it from
      the page; if folded, delete its usage in `students/page.tsx`). An **Apply** button closes
      the panel (navigation already happens on each `pushWith`).
    - Selected option styling: active = `border-primary bg-primary/10 text-primary` (as today).
12. **`students/page.tsx`** — visual only; keep all data fetching, `searchParams` parsing,
    sort handling, mobile card list, and badge helpers:
    - Heading `Students` + the existing "Showing N of M" caption.
    - Render the updated `StudentsFilters` (remove the separate `StudentsSortSelect` block only
      if it was folded into the panel in step 11).
    - Wrap the desktop `Table` in the shared panel surface (`rounded-xl border bg-card
      overflow-hidden`); restyle header row (muted, `text-xs uppercase tracking-wide`), row
      hover (`hover:bg-accent/40`), and the Status/Type/Domain badges to match Figma
      (`statusBadgeClass` already handles ACTIVE/COMPLETED — extend for dark if needed).
    - Pagination: the list is capped at 100 (single page) today. If Figma's numbered pager is
      desired, that requires real offset pagination in `getStudents` — **out of scope for this
      redesign; keep the current "max 100" caption.** Note as a follow-up.
13. **Verify Students**: search, every filter, sort, and Export CSV behave exactly as before;
    table/badges restyled; mobile cards intact. Typecheck/build clean.

### Phase 3 — remaining screens
14. Re-capture `38:178` (Submissions), `41:2` (Jobs), `57:39`/`57:157` (Content),
    `65:32`/`79:23` (Marketplace) from Figma, then extend this plan (or a follow-up
    `019-…`) with per-screen specs. Apply the Phase 1/2 primitives (page header, panel
    surface, filter dropdown, badge styles) to each existing route — presentational only,
    reusing each page's existing data layer. Confirm "Marketplace" vs the existing
    `/admin/jobs` intent before building (it may be the student-facing jobs board, not admin).

---

## 8. Guardrails for Cursor (DO NOT)
- **Do NOT** add `requireRole`/`requireAdmin` to anything new — admin gating already lives in
  `layout.tsx` via `requireAdmin()`. Don't touch `middleware.ts`, `auth.config.ts`, or any
  edge path; nothing here imports `@/lib/*` into the edge bundle.
- **Do NOT** pass Lucide icon components/functions from the Server layout into the Client
  sidebar/mobile-nav — keep the string `icon` key + `iconMap` indirection.
- **Do NOT** use `<Button asChild>` or `<Button render={<Link>}>` for the Review / View-all
  links — apply `buttonVariants(...)` className directly on `<Link>`.
- **Do NOT** add a schema field, migration, or seed change. No `Submission.reviewStatus`, no
  pagination columns. `get-overview-stats.ts` changes are **read-only counts** only and keep
  `select`/count usage (no full-record returns).
- **Do NOT** introduce new dependencies — Recharts is already installed; reuse existing
  `components/ui` primitives (Card, Table, Badge, Button, DropdownMenu/Popover, Avatar, Input).
- **Do NOT** hardcode hex colors for surfaces/text — use the existing CSS tokens
  (`bg-background`, `bg-card`, `text-muted-foreground`, `hsl(var(--primary))`) and Tailwind
  color utilities for the per-card accents. Do NOT force the admin into dark-only.
- **Do NOT** create extra abstraction files beyond the four new ones listed; inline trivial
  markup. **Do NOT** modify `components/ui/*` primitives.
- **Do NOT** change any Server Action, validation, or data-fetch behavior on Students — the
  redesign is presentational; export and filtering must work identically.
- Confirm each file was actually written and `npm run build` passes before reporting done.

## 9. Verification
- **Typecheck/build:** `npx tsc --noEmit` and `npm run build` pass with no new errors
  (strict TS, no `any`).
- **Manual (run `npm run dev`, log in as `admin@abtalks.dev`):**
  - Shell: left rail renders on desktop, active highlight correct including nested routes,
    mobile drawer works, theme toggle still flips admin chrome, "Back to student portal" works.
  - Overview: four stat cards with correct values + deltas (or hidden when null) + sparklines;
    Pending Reviews rows link to student detail and the Review button navigates; Recent Activity
    timeline matches prior "Recent Admin Actions" data.
  - Students: search, each domain/status filter, each sort, and Export CSV all behave exactly
    as before; table + badges restyled; mobile cards intact.
- **Changed files (Phases 1–2 only):** `admin/layout.tsx`, `admin-sidebar.tsx`,
  `admin-mobile-nav.tsx`, `get-overview-stats.ts`, `admin/page.tsx`, `students/page.tsx`,
  `students-filters.tsx` (edits) + `stat-card.tsx`, `admin-sparkline.tsx`,
  `activity-timeline.tsx` (new). Nothing under `prisma/`, `middleware.ts`, or `auth*`.

## 10. Commit message
- Phase 1: `admin: redesign shell — dark nav rail, gradient active state, mobile drawer`
- Phase 2: `admin: redesign overview (stat cards + sparklines + activity) and students table`
- Phase 3: `admin: redesign submissions/jobs/content screens to match new system`

---

## 11. Design tokens (from Figma)

> **How these were obtained:** the Figma account is on a **Starter plan (6 MCP reads/month,
> now exhausted)**, so the authoritative `get_variable_defs` named variables and auto-layout
> spacing could NOT be pulled. The values below were **sampled from the rendered Overview &
> Students frames** (pixel-accurate for flat surfaces) and mapped to the **nearest Tailwind
> token**. The page background sampled `#030712` = Tailwind `gray-950` **exactly (ΔE 0)**, and
> the positive/negative accents hit `emerald-400`/`red-400` exactly — strong evidence the
> design uses **Tailwind's default dark palette**, so prefer these Tailwind utilities directly.
> *Spacing is best-effort from a downscaled render; exact auto-layout values need a Figma
> Professional upgrade (Full/Dev seat → 200 reads/day) or next month's quota reset.*

### Colors (sampled → nearest Tailwind)
| Element | Sampled hex | Tailwind | Token hex | Confidence |
|---|---|---|---|---|
| Page background | `#030712` | `gray-950` | `#030712` | exact (ΔE 0) |
| Nav rail background | `#0C1321` | `gray-900` | `#111827` | high |
| Stat-card / panel surface | `#0B1326` | `slate-900` | `#0F172A` | high |
| Table row hover | `#050E22` | `slate-950` | `#020617` | med |
| Card 1 accent — Total Students | `#9961F0` | `violet-500` | `#8B5CF6` | med |
| Card 2 accent — Active Today | `#DA43BE` | `fuchsia-500`/`pink-500` | `#D946EF` | med |
| Card 3 accent — Day 30 | `#EB8F26` | `amber-500` | `#F59E0B` | high |
| Card 4 accent — Day 60 | `#3592E8` | `blue-500` | `#3B82F6` | high |
| Positive delta / ACTIVE badge | `#34D399` | `emerald-400` | `#34D399` | exact |
| Negative delta / down trend | `#F87171` | `red-400` | `#F87171` | exact |

- **Active nav pill gradient:** indigo→violet, matching the existing app primary
  (`--primary: 239 84% 67%` ≈ `indigo-500 #6366F1`). Use
  `bg-gradient-to-r from-primary to-violet-500` (or `from-indigo-600 to-violet-500`) with
  `text-primary-foreground`. This reuses the existing token — do not hardcode.
- **Mapping to the project's existing dark tokens** (these are close enough to reuse as-is —
  prefer them over raw hex): `bg-background` (dark `224 71% 4%` ≈ `#03070E`) ≈ page bg;
  `bg-card` (dark `224 71% 6%`) ≈ card surface; `border`/`accent` tokens for dividers/hover.
  The redesign does **not** require new CSS variables — the existing dark theme already lands
  on this palette. Card **accent bars** are the only genuinely new colors → use the Tailwind
  utilities above (`border-t-2 border-amber-500` etc.), not new CSS vars.

### Spacing & sizing (best-effort; 8px grid)
Artboard = **1897 × 1257**. The layout sits on Tailwind's default 4/8px grid:
| Element | Value | Tailwind |
|---|---|---|
| Nav rail width (desktop) | ~256 px | `w-64` |
| Header height | ~56–64 px | `h-14`/`h-16` |
| Main content padding (x) | ~32 px | `px-8` |
| Section vertical rhythm | ~24 px | `space-y-6` |
| Stat-card grid gap | ~16 px | `gap-4` |
| Card inner padding | ~20–24 px | `p-5`/`p-6` |
| Card radius | ~12–16 px | `rounded-xl`/`rounded-2xl` |
| Card top accent bar | ~2–3 px | `border-t-2` |
| Nav item padding | ~10–12 px y | `px-3 py-2.5` |
| Nav item radius | ~10 px | `rounded-lg` |

> If you upgrade Figma / next month's quota resets, re-run `get_variable_defs` on `4:2` and
> `get_design_context` on `4:2` + `26:80` to replace the sampled values above with the exact
> named variables and auto-layout paddings, then update this section.
