# 032 — B2B Program 09 — Admin: cohort management, member ops, analytics, exports

> Final plan. Depends on 027+ (029/030/031 pages already added
> `/admin/program/projects|interviews|recruiters` — this plan gives them a home).

## 1. Goal
A complete `/admin/program` section: cohort lifecycle management (create/edit, status,
publish results), member operations (view, promote waitlist, drop, unlock day),
cohort analytics (score distribution, module progress, engagement, at-risk), and CSV
exports.

## 2. Current behavior
After 024–031: all program features run, but cohort rows are created via DB console,
`resultsPublishedAt` is set manually, waitlist promotion doesn't exist, and admin has
only the three standalone pages (projects / interviews / recruiters).

## 3. Files to touch
- `[new] src/app/admin/program/layout.tsx` — Server; `requireAdmin()`; sub-nav tabs:
  Overview, Members, Projects, Interviews, Recruiters, Content (plain links, mirror
  existing admin section patterns in `src/app/admin/`).
- `[new] src/app/admin/program/page.tsx` — Overview: cohort card (name, dates IST,
  capacity, enrolled/waitlisted/dropped counts, status selector, **Publish results**
  button with confirm dialog) + create/edit cohort form when none active; analytics
  below (Recharts, already a dep): score distribution histogram (50-pt buckets),
  module progress (avg % per module), daily engagement line (mission verification runs
  + commit days per IST day), mission funnel (pass rate + avg runs per day 1–30 —
  shows where the cohort gets stuck), experience mix pie, at-risk list (from
  `getAtRiskMembers`, 028) with behind-by / stuck-mission / no-commits reasons.
- `[new] src/features/program/admin.ts` —
  - `createOrUpdateCohort(adminId, data)` — Zod: name, startsAt < endsAt, capacity
    1–100; only ONE cohort may be non-ARCHIVED at a time (enforce in transaction).
  - `setCohortStatus`, `publishResults(adminId, cohortId)` (sets `resultsPublishedAt`,
    AdminAction `PROGRAM_PUBLISH_RESULTS`).
  - `getCohortOverview(cohortId)` — the aggregate stats above (groupBy queries with
    `select`; no full-table loads).
  - `promoteWaitlisted(adminId, memberId)` — capacity re-check in transaction →
    ENROLLED + `enrolledAt` + AdminAction.
  - `dropMember(adminId, memberId, reason)` — status DROPPED + AdminAction (soft — no
    deletes).
  - `adminUnlockDay(adminId, memberId, day, reason)` — support escape hatch: raise
    `highestUnlockedDay` (≤30) + AdminAction (`PROGRAM_UNLOCK_DAY`).
  - `grantSkipToken(adminId, memberId, reason)` — decrement `skipTokensUsed` (floor 0)
    + AdminAction (`PROGRAM_GRANT_SKIP_TOKEN`).
- `[new] src/app/admin/program/members/page.tsx` — searchable/filterable member table
  (status, behind-by, scores, entry scores, interview status) → detail page.
- `[new] src/app/admin/program/members/[id]/page.tsx` — full member detail: profile,
  entry attempts, per-day mission runs with verdicts, concept checks, commits, arena
  completions, projects, interview; action panel (promote / drop / unlock day / grant
  skip token back / regenerate recommendation) with reason fields — mirror
  `StudentActionPanel` UX.
- `[new] src/app/admin/program/content/page.tsx` — read-only viewer: modules → days →
  mission type + concept-question counts + video list + arena exercise list (verifies
  seeds; NO editing UI; missionSpec shown here is fine — admin-only page).
- `[new] src/app/actions/admin-program-actions.ts` — Zod + envelope + `requireAdmin`
  wrappers for every §3 feature function.
- `[edit] src/app/admin/` main admin nav (wherever the existing section nav lives —
  locate it) — add "Program" link to `/admin/program`.
- `[edit] src/app/actions/admin-export-actions.ts` (or `[new]`
  `admin-program-export-actions.ts` if that file is student-coupled — prefer new) —
  CSV exports via existing `lib/csv.ts`: members+scores, at-risk, recruiter list,
  interview results.
- `[edit] docs/project-context.md` — final section update: full B2B program shipped;
  move it from "planned" to the architecture sections (models, routes, actions, env
  vars, cron).

## 4. Server vs Client
| File | Type | Notes |
|---|---|---|
| all admin pages/layout | Server | `requireAdmin()` at layout level |
| charts, action panel, confirm dialogs | Client | data as plain JSON arrays; Recharts client-side like `/admin/analytics` |
| `admin.ts` | server | transactions + AdminAction on every mutation |

## 5. Steps
1. `admin.ts` + actions. 2. Layout + overview (cohort mgmt + publish). 3. Members
   list/detail + action panel. 4. Analytics charts. 5. Content viewer. 6. CSV exports.
7. Full-series regression pass (§8), context doc final update, commit.

## 6. Guardrails for Cursor (DO NOT)
- Do NOT allow two non-ARCHIVED cohorts (transactional guard, not UI-only).
- Every admin mutation writes an `AdminAction` row — no silent state changes.
- Do NOT add content editing — viewer only (content changes go through seed JSONs).
- Do NOT unpublish/republish results without confirm dialogs; publish is one-way in UI
  (DB can revert if ever needed).
- Charts get pre-aggregated plain arrays from the server — never raw member lists into
  client props beyond what's rendered.
- Follow existing `/admin` visual patterns; no new chart or table libraries.

## 7. DB safety
No schema change. All mutations transactional + audited.

## 8. Verification (series-final regression)
- Create cohort in UI → apply/assess/enroll a test user → pass days, run cron, submit
  project, grade, interview (if 030 live) → publish results → recruiter sees pool.
- Waitlist promote respects capacity; drop hides member from leaderboard/pool; unlock
  day works and is audited.
- Analytics render with 2–3 test members without errors; CSVs download with correct
  columns; every admin action appears in the audit log.
- Student platform untouched: dashboard/challenge/quiz/leaderboard/mission all behave
  identically with the flag on AND off.
- `npx tsc --noEmit` + `npm run build` clean; §3 files only.

## 9. Commit message
`feat(program): admin cohort management, member ops, cohort analytics, CSV exports — B2B program complete`
