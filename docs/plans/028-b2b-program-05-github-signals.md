# 028 — B2B Program 05 — GitHub commit tracking: cron, points, heatmap, at-risk

> Depends on 027. Roadmap §5: commit consistency = 5 pts/day with ≥1 commit, max 150.

## 1. Goal
Track real commits in each member's registered program repo via the GitHub REST API on
a daily Vercel cron, award commit points, show a commit heatmap on the member
dashboard, and compute at-risk flags.

## 2. Current behavior
After 027: members have `githubUsername` + `githubRepoUrl` (validated owner==username at
apply); `parseRepo` + `recomputeMemberScore` exist (027). `ProgramCommitDay` empty.
No `vercel.json` exists in the repo. No cron routes.

## 3. Files to touch
- `[new] vercel.json` — `{ "crons": [{ "path": "/api/cron/program-commits", "schedule": "30 19 * * *" }] }`
  (19:30 UTC = 01:00 IST next day — captures the full IST day just ended; Hobby plan
  allows daily crons).
- `[new] src/app/api/cron/program-commits/route.ts` — `GET` route handler (Vercel cron
  invokes GET), node runtime, `export const maxDuration = 60`:
  1. Reject unless `request.headers.get("authorization") === \`Bearer ${process.env.CRON_SECRET}\``.
  2. Active cohort (status `ACTIVE`), skip if none/frozen past endsAt+1d.
  3. For each `ENROLLED|COMPLETED` member (≤100): call
     `GET https://api.github.com/repos/{owner}/{repo}/commits?author={githubUsername}&since={ISTdayStartUTC}&until={ISTdayEndUTC}&per_page=100`
     with `Authorization: Bearer GITHUB_API_TOKEN`, `User-Agent: abtalks-program`.
     Batch with `Promise.allSettled` in chunks of 10.
  4. Upsert `ProgramCommitDay` (memberId+date) with the count; when count ≥ 1 and the
     row is newly created (or was 0), add 5 to `commitPoints`+`totalScore` in a
     transaction (cap: only days between cohort startsAt and endsAt count; never
     double-award — derive from whether points were already given: recompute
     `commitPoints = 5 × count(commitDays with commitCount>0)` inside the transaction
     instead of incrementing, then call `recomputeMemberScore` from 027).
  5. Return `{ ok: true, data: { processed, failures } }`; log failures via logger.
- `[new] src/features/program/commits.ts` — cron/commit helpers (import `parseRepo` and
  `recomputeMemberScore` from 027's modules — do NOT redefine them):
  `getCommitHeatmap(memberId)`, `getAtRiskMembers(cohortId)` — at-risk = behind by
  >2 days (`highestUnlockedDay < calendarDay - 2`), OR stuck >2 days on the same
  mission (oldest failed run on current day older than 2 IST days), OR 0 commit-days
  in last 5 (data for 032 admin + recruiter views).
- `[edit] src/app/program/(app)/dashboard/page.tsx` — add commit heatmap strip
  (30 cells, IST dates, tooltip count) + commit points card; "behind by N days" badge
  from `getAtRiskMembers` logic (own status only).
- `[new] src/components/program/commit-heatmap.tsx` — Client presentational; props:
  `{ cells: { dateIso, count }[] }`.
- `[edit] docs/project-context.md` — cron + env vars (`GITHUB_API_TOKEN`, `CRON_SECRET`) documented.

## 4. Server vs Client
| File | Type | Notes |
|---|---|---|
| cron route | Server (node) | secret-gated; the ONLY new API route |
| `commits.ts` | server | pure helpers + Prisma |
| `commit-heatmap.tsx` | Client | plain JSON props |

## 5. Steps
1. `commits.ts` helpers (reusing 027's `recomputeMemberScore` as the single scoring summer).
2. Cron route (per §3 — recompute-not-increment to stay idempotent). 3. `vercel.json`.
4. Dashboard heatmap + badge. 5. Verify locally by invoking the route with the bearer
   header against a real public repo of yours. 6. Context doc, commit.

## 6. Guardrails for Cursor (DO NOT)
- Do NOT run the GitHub polling in middleware, layouts, or on page request — cron only.
- Do NOT make the cron idempotency depend on "was it run once" — re-running the same
  day must produce identical points (recompute pattern).
- Do NOT trust `githubRepoUrl` blindly — parse strictly; on 404/403 from GitHub record
  a zero day and log, never throw the whole batch.
- Do NOT exceed the day window: `since/until` are the IST day converted to UTC via
  `lib/date-utils.ts` helpers.
- Do NOT expose `GITHUB_API_TOKEN` or `CRON_SECRET` anywhere client-side; route
  rejects without the exact bearer header (403).
- No SDK dep — plain `fetch`.

## 7. DB safety
No schema change. `ProgramCommitDay` writes are upserts; points recompute is
idempotent by construction.

## 8. Verification
- `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/program-commits`
  → processes members; run twice → identical `commitPoints` (idempotent). Without
  header → 403.
- Member with a real commit yesterday (test with your own repo/username on a member row)
  gets a filled heatmap cell + 5 pts; leaderboard total updates.
- Deploy: Vercel cron shows registered after `vercel.json` lands.
- Build + tsc clean; only §3 files changed.

## 9. Commit message
`feat(program): GitHub commit tracking — daily cron, idempotent commit points, heatmap, at-risk signals`
