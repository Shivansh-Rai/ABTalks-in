# 151 — Recruiter analytics: GA4 traffic panel + richer charts + filters

## 1. Goal
Bring Google Analytics 4 data into `/hire/analytics` alongside the existing
DB-derived recruiter metrics, in a richer visual layout (KPI tiles + trend
lines + donut + funnel + stacked bars) with a shared date-range and source
filter row. So a recruiter can answer "how did traffic → applications →
shortlists actually move this week?" in one place, without opening the GA
console.

## 2. Current behavior
- **GA4 tag is live** (plan 115, T-252). `G-KJCDR1DZ0F` fires from
  `src/components/analytics/ga4-loader.tsx` after the cookie-consent gate
  grants `analytics_storage`. Nothing reads the data back — GA is
  write-only today, viewed only in google.com/analytics.
- **Event taxonomy is fixed** (plan 114 + 117, T-253). `src/lib/analytics/
  events.ts` exposes 9 bounded events with an allowlist PII filter; every
  recruiter-scoped event (`recruiter_reg_submitted`,
  `recruiter_candidate_viewed`, `recruiter_contact_unlocked`) currently
  carries no per-recruiter dimension — the allowlist explicitly refuses IDs.
- **`/hire/analytics` exists** — `src/app/hire/analytics/page.tsx` renders
  four recharts bar charts + a projects table, all sourced from
  `getRecruiterAnalytics()` in `src/features/hire/recruiter-analytics.ts`
  (Shashank's file), which is a purely DB query (jobs, applications,
  matches, outreach, assessment assignments, pipeline). No filters, no
  date range, no traffic data.
- **No GA Data API client** in the tree. No `@google-analytics/data`
  package. No service account referenced in `.env.example`.

## 3. Ownership map (READ FIRST)
Per CLAUDE.md ownership:

| Slice | Owner | Approval status |
|---|---|---|
| GA4 tag, event schema, GA Data API client, UTM capture | **Manuvrtti (me)** | in-lane ✓ |
| `src/features/hire/recruiter-analytics.ts`, `/hire/analytics` page, `recruiter-analytics-charts.tsx`, `-loader.tsx` | **Shashank (recruiter analytics)** | needs approval |
| Dashboard layout, chart palette, filter chrome | **Shallika (UI/UX)** | needs approval |
| Per-recruiter isolation of GA custom dimensions, extending the plan-114 PII allowlist | **Sohail (security / recruiter isolation)** | needs approval |

Do NOT start Steps 4–7 below without Shashank/Shallika/Sohail sign-off.
Step 3 (GA Data API client + read repository) is entirely in the
Manuvrtti lane and can proceed on its own.

## 4. Design decision that gates the whole thing
GA4 measures the *whole site*. To scope GA data to one recruiter we need a
custom dimension that identifies the recruiter's org on every relevant
event. Two viable paths:

### Path A — Site-wide GA panel only (recommended first pass)
Add GA-derived cards that are meaningful without recruiter scoping:
- Total sessions / new users / avg. engagement time (7d / 30d).
- Top acquisition sources.
- Top job / hire pages by pageviews.
- `site_job_applied` / `site_test_completed` counts trend.
The recruiter sees platform-wide traffic health next to their own DB
funnel. No PII escalation, no plan-114 changes, no Sohail review needed.
**This plan implements Path A.**

### Path B — Per-recruiter GA scoping (deferred)
Add a bounded `recruiter_org_bucket` custom dimension (hashed org ID
into 32 buckets, or an anonymised org token issued at recruiter signup),
register it in GA4 admin, tag every recruiter-side event. Requires:
- Amending `src/lib/analytics/events.ts` allowlist — plan 114 change.
- Sohail review (PII / recruiter isolation).
- GA4 admin change (custom dimension registration, 30-day propagation).
- Backfill window during which historical data has no dimension.
Not in this plan. Filed as a follow-up (T-XXX) once Path A ships.

## 5. Files to touch

**GA Data API side (my lane):**
- `package.json` `[edit]` — add `@google-analytics/data` (v4).
- `.env.example` `[edit]` — add `GA_PROPERTY_ID`,
  `GA_SERVICE_ACCOUNT_EMAIL`, `GA_SERVICE_ACCOUNT_PRIVATE_KEY` (server
  only, no `NEXT_PUBLIC_`).
- `src/lib/analytics/ga-data-client.ts` `[new]` — thin server-only
  wrapper around `BetaAnalyticsDataClient`, memoized, reads env, throws
  a typed error if unset. `import "server-only"` on line 1.
- `src/repositories/ga-analytics.ts` `[new]` — the read repository. One
  function per card: `getSessionsTrend`, `getTopSources`,
  `getTopHirePages`, `getEventCounts`. Every function takes
  `{ start: string; end: string; filters?: { source?: string } }` and
  returns the `{ ok, data } | { ok, message }` envelope. Zod-validates
  input. Never called from the client.

**Recruiter analytics surface (Shashank's — needs approval):**
- `src/features/hire/recruiter-analytics.ts` `[edit]` — accept a
  `range: { start; end }` argument, thread it into the existing DB
  counts (`gte`/`lte` on `createdAt` for jobs, applications, matches,
  outreach, assignments). Additive; no metric definition changed.
- `src/features/hire/recruiter-analytics-ga.ts` `[new]` — composes
  `ga-analytics` reads into the shape the traffic panel takes.
  Returns `{ ok, data } | { ok, message }`. Falls back gracefully to
  `{ ok: true, data: { unavailable: true } }` when GA env is unset in
  preview environments.
- `src/app/hire/analytics/page.tsx` `[edit]` — read `?range=` and
  `?source=` search params (Zod'd), pass to the feature functions,
  fan out to the new client shell.
- `src/components/hire/recruiter-analytics-loader.tsx` `[edit]` — take
  the composed data + filters, pass through to the new shell.
- `src/components/hire/recruiter-analytics-charts.tsx` `[edit]` —
  replace the flat 2-column bar grid with a tabbed layout:
  Overview / Traffic (GA) / Funnel / Projects. Keeps the existing
  charts under Funnel + Projects; adds new visualisations under
  Overview + Traffic.

**UI chrome / filters (Shallika's — needs approval):**
- `src/components/hire/analytics-filter-bar.tsx` `[new]` — client
  component. Presets 7d / 30d / 90d / custom; source dropdown; job
  dropdown. Writes to the URL via `useRouter().replace`, so the whole
  page is a server-rendered snapshot for a `?range=` — sharable.
- `src/components/hire/analytics-kpi-tile.tsx` `[new]` — one small
  KPI card component (label, value, delta vs prev period, sparkline).
- `src/app/hire/analytics/hire-analytics.css` `[edit]` — layout
  tweaks. Palette stays inside the existing brand teal (`#03535F`)
  system per the current chart file's comment.

## 6. Server vs Client
| File | Kind | Notes |
|---|---|---|
| `src/lib/analytics/ga-data-client.ts` | server-only | `import "server-only"` |
| `src/repositories/ga-analytics.ts` | server-only | Prisma-style repo pattern; never in a client boundary |
| `src/features/hire/recruiter-analytics*.ts` | server | server-only imports |
| `src/app/hire/analytics/page.tsx` | Server Component | reads searchParams, calls features, passes plain data down |
| `recruiter-analytics-loader.tsx` | Client Component | already `"use client"` — dynamic imports recharts |
| `recruiter-analytics-charts.tsx` | Client Component | plain-object props only — no functions, no icons across boundary |
| `analytics-filter-bar.tsx` | Client Component | uses `useRouter`, `useSearchParams` |
| `analytics-kpi-tile.tsx` | Client Component | tiny sparkline uses recharts |

Server → Client prop passing check: only plain arrays of
`{ label: string; value: number; delta?: number }` and
`{ date: string; count: number }` cross the boundary. No functions, no
Date objects (use ISO strings), no class instances.

## 7. Steps
1. **Package + env (my lane).** Add `@google-analytics/data`. Extend
   `.env.example` with three server-side GA vars. Locally, put the
   service-account JSON into `.env.local` and verify
   `ga-data-client.ts` returns a client instance without error.
2. **Client wrapper (my lane).** Write `src/lib/analytics/ga-data-client.ts`.
   `getGaClient()` returns a memoised `BetaAnalyticsDataClient`; if
   any env var is missing, return `{ ok: false, message: "GA env not
   configured" }` — never throw at module load (Vercel preview builds
   must not break).
3. **Read repository (my lane).** Write `src/repositories/ga-analytics.ts`.
   Four functions, each backed by one `runReport` call:
   - `getSessionsTrend({ start, end })` → `[{ date, sessions, newUsers }]`
   - `getTopSources({ start, end, limit })` → `[{ source, sessions }]`
   - `getTopHirePages({ start, end, limit })` → `[{ pagePath, pageviews }]`
     Filter to `pagePath` starting with `/hire` or `/jobs`.
   - `getEventCounts({ start, end, events: string[] })` →
     `Record<eventName, number>` — feeds `site_job_applied`,
     `site_test_completed`, `recruiter_candidate_viewed`.
   Every function Zod-parses its input. Every function returns the
   `{ ok, data } | { ok, message }` envelope. Cache the
   `runReport` result with `unstable_cache` at 5 min so a page refresh
   is cheap.
4. **[NEEDS SHASHANK]** Extend `getRecruiterAnalytics` to accept
   `range`, thread `gte/lte` into the DB predicates. No new metric
   definitions.
5. **[NEEDS SHASHANK]** Write `recruiter-analytics-ga.ts` that
   composes the four `ga-analytics` reads and returns a shape the
   traffic panel wants.
6. **[NEEDS SHALLIKA]** Write `analytics-filter-bar.tsx` and
   `analytics-kpi-tile.tsx`. Filter bar writes to URL; page is
   `force-dynamic` (already is).
7. **[NEEDS SHASHANK + SHALLIKA]** Reshape
   `recruiter-analytics-charts.tsx` into 4 tabs:
   - **Overview** — 6 KPI tiles (sessions 7d, new users 7d, applications
     30d, shortlisted 30d, contact unlocks 30d, tests completed 30d),
     each with a delta vs the previous period.
   - **Traffic (GA)** — line chart (sessions over range), donut (top
     sources), horizontal bar (top hire/jobs pages), stacked area (site
     events by day).
   - **Funnel** — existing candidate funnel + assessments bars,
     re-themed as a proper funnel visual.
   - **Projects** — existing project bars + table.
8. **[NEEDS SOHAIL]** Confirm we're OK exposing site-wide GA traffic
   metrics to any authenticated recruiter (Path A). No per-recruiter
   scoping; no PII escalation. Sohail signs off or asks for a role
   check on the GA panel.
9. **Wire it up.** Update `page.tsx` to parse `?range=&source=&job=`
   with Zod (defaults: `range=30d`, `source=all`, `job=all`), call
   both feature functions in parallel, pass to the loader.
10. **Empty / error states.** If GA env not configured, the Traffic
    tab renders "Traffic analytics unavailable in this environment" —
    the other three tabs still work. If GA quota is exceeded, log via
    `logger.warn` and render the same fallback.

## 8. Guardrails for Cursor (DO NOT)
- DO NOT import `@google-analytics/data` from any Client Component or
  any file middleware transitively imports. Server-only.
- DO NOT put the service-account JSON blob into `NEXT_PUBLIC_*` — the
  three vars are server-only.
- DO NOT amend `src/lib/analytics/events.ts` — that is a plan-114
  contract change and out of scope. If a card needs a per-recruiter
  breakdown, note it as "requires Path B" and skip.
- DO NOT call `getRecruiterAnalytics()` from a client component. It is
  `import "server-only"`.
- DO NOT introduce a new API route for GA — the page is a Server
  Component, so it calls the repo directly.
- DO NOT ship the Traffic tab without the `unstable_cache` wrap; GA
  Data API has strict quotas and a bare refresh loop will trip them.
- DO NOT hard-code the brand teal in more places — reuse the `TEAL`
  constant already at the top of `recruiter-analytics-charts.tsx`.
- DO NOT add `requireRole`/`requireAdmin` at page top — this page
  already gates via `auth() → redirect("/talent/login")`, matching the
  rest of `/hire/*`.
- DO NOT rename or remove any existing chart card in this pass —
  Shashank's existing funnel/workspace/assessments/projects cards must
  land inside the new tabs unchanged.

## 9. DB safety
No schema changes. No migrations. Read-only additions.

## 10. Verification
- `npx tsc --noEmit` passes.
- `npm run test` passes (existing `events.test.ts`, `ga4-loader-logic.test.ts`
  untouched).
- Manual, with GA env set in `.env.local`:
  1. Log in as a recruiter, visit `/hire/analytics`.
  2. Overview tab shows 6 KPI tiles with non-zero deltas over 30d.
  3. Traffic tab: sessions line chart, top sources donut, top hire
     pages horizontal bar. Data matches what google.com/analytics shows
     for `G-KJCDR1DZ0F` on the same date range.
  4. Funnel tab: existing candidate funnel + assessments render, same
     numbers as before (regression check).
  5. Projects tab: existing project bars + table render, same numbers
     as before.
  6. Change date range in the filter bar → URL updates → all tabs
     refetch → numbers move.
  7. Change to a bogus range → Zod rejects → page falls back to
     `30d`.
- Manual, without GA env (Vercel preview):
  - Overview + Funnel + Projects tabs work.
  - Traffic tab shows the fallback string.
- Files changed match §5 exactly.

## 11. Commit message
```
feat(hire): T-XXX GA4 traffic panel + filters on /hire/analytics

- add server-only GA Data API client + read repository
- add filter bar (date range, source, job) synced to URL
- reshape recruiter analytics into 4 tabs: Overview / Traffic / Funnel / Projects
- add 6 KPI tiles with period-over-period deltas
- graceful fallback when GA env is unset (preview builds)

Path A only: site-wide GA metrics, no per-recruiter scoping. Path B
(recruiter_org_bucket custom dimension + plan 114 amendment) filed
as a follow-up ticket.
```

## 12. Open questions before execution
1. **T-number?** Should this be filed as a new ticket in the
   Manuvrtti/Shashank shared bucket, or slot into an existing
   analytics ticket?
2. **Sohail check.** Is exposing platform-wide GA traffic to every
   authenticated recruiter acceptable, or should the Traffic tab be
   gated behind a role (`ROLE_PLATFORM_ADMIN`) and only the DB tabs
   stay recruiter-visible?
3. **Shashank check.** Any objection to reshaping
   `recruiter-analytics-charts.tsx` into a tabbed shell? All existing
   cards land inside a tab unchanged.
4. **Shallika check.** Is the tabbed layout aligned with the
   product's dashboard IA, or should this be one long scroll with
   section anchors?
5. **GA property.** `G-KJCDR1DZ0F` is the production property. For
   preview builds, do we point at the same property (with a filter
   for `environment=preview` events, which today we don't tag), or
   leave preview with the "unavailable" fallback?
