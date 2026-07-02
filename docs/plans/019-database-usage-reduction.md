# 019 — Database usage reduction (system design)

## 1. Goal
Cut Neon free-tier **compute-hour** consumption (and secondarily storage/egress) by
eliminating write-on-read, collapsing redundant/N+1 queries, and caching immutable
content — without changing any user-visible behavior. Target: the dashboard load
drops from **~22–28 queries + 1 write** to **~6–8 reads + 0 writes**, and Neon is
allowed to auto-suspend (scale to zero) during idle periods.

---

## 2. Why the bill is high (diagnosis)

Neon's free tier meters **compute-hours**, not query count directly — but compute
stays awake as long as queries (especially writes) keep arriving, and each query
adds round-trip time on the active endpoint. Two architectural patterns dominate:

### 2a. Write-on-read keeps the DB awake
`getDashboardData` recomputes streaks on every dashboard view and writes them back:

```
src/features/dashboard/get-dashboard-data.ts:189–201
  computeStreakStats(...)            // findMany on submissions
  if (changed) enrollment.update(...) // WRITE on a read path
```

Streaks only change when a submission is created. `submitDay` already computes and
persists `currentStreak` / `longestStreak` / `daysCompleted` inside its transaction
(`src/features/submission/submit-day.ts:244–265`). The dashboard recompute is
redundant, and the write it triggers generates WAL on nearly every page view —
which **prevents Neon from auto-suspending**. This is the single biggest compute driver.

### 2b. Query fan-out + redundant refetches per dashboard load

Counted from `src/app/dashboard/page.tsx` + the feature modules it calls:

| # | Source | Query | Note |
|---|--------|-------|------|
| 1 | page.tsx:122 | `user.findUnique` (existence) | duplicate of #3 |
| 2 | get-user-enrollments.ts | `enrollment.findMany` | |
| 3 | get-dashboard-data.ts:128 | `user.findUnique` (+profile) | duplicate of #1 |
| 4 | resolve-dashboard-enrollment.ts | `enrollment.findFirst` | **enrollment fetch #1** |
| 5 | streak-utils.ts | `submission.findMany` | for streak recompute |
| 6 | get-dashboard-data.ts:197 | `enrollment.update` | **WRITE (see 2a)** |
| 7 | get-dashboard-data.ts:205 | `submission.findUnique` (today) | derivable from #5/#15 |
| 8 | get-dashboard-data.ts:224 | `dailyTask.findUnique` (today) | cacheable content |
| 9 | get-dashboard-data.ts:244 | `submission.findMany` (recent 7) | derivable from #5/#15 |
| 10 | get-dashboard-data.ts:256 | `referral.count` | |
| 11–16 | get-dashboard-data.ts:96–119 | quiz-banner **week loop** | **N+1**, 3–6 queries |
| 17 | check-claude-enrollment.ts | `challenge.findUnique` | cacheable |
| 18 | check-claude-enrollment.ts | `enrollment.findFirst` | derivable from #2 |
| 19 | get-heatmap-data.ts:48 | `enrollment.findFirst` | **enrollment fetch #2** |
| 20 | get-heatmap-data.ts:73 | `submission.findMany` | overlaps #5/#7/#9 |
| 21 | get-heatmap-data.ts:83 | `dailyTask.findMany` (60 rows, full text) | **heavy / cacheable** |
| 22 | get-heatmap-data.ts:99 | `adminAction.findMany` (rejects) | |
| 23 | get-available-quiz.ts:26 | `enrollment.findFirst` | **enrollment fetch #3** |
| 24 | get-available-quiz.ts:59 | `quiz.findFirst` | |
| 25 | get-available-quiz.ts:75 | `quizAttempt.findUnique` | |
| 26 | get-quiz-attempt-history.ts:16 | `enrollment.findFirst` | **enrollment fetch #4** |
| 27 | get-quiz-attempt-history.ts:29 | `quizAttempt.findMany` | |

Observations:
- The **same enrollment row is read 4×** (#4, #19, #23, #26) and the **same user row 2×** (#1, #3).
- **Submissions for the enrollment are read 3×** (#5 streak, #7 today, #9 recent-7) plus a 4th in the heatmap (#20) — all derivable from one `findMany`.
- The quiz banner (`resolveAvailableQuizForBanner`) and `getAvailableQuiz` overlap and both walk weeks.
- `dailyTask.findMany` (#21) pulls **all 60 days' `problemStatement` + objectives + resources** every load though the data is seeded and changes only on reseed.

### 2c. No caching layer
No `unstable_cache` / React `cache()` anywhere on hot read paths (confirmed by repo
grep — only `revalidatePath` exists in write actions). Immutable content (daily tasks,
quizzes, `Challenge.startsAt`) is fetched live every time, and identical lookups
within a single render are not deduplicated.

### 2d. Connection model (not the main problem, noted for completeness)
`src/lib/db.ts` uses a plain `PrismaClient` over TCP. `DATABASE_URL` already points at
the Neon **`-pooler`** host (good — PgBouncer in front), and `DIRECT_URL` at the direct
host for migrations (correct). The connection model is fine; **query volume**, not
connection setup, is the cost. Driver-level changes (Accelerate / Neon serverless HTTP)
are a Tier-3 option, not required.

---

## 3. Design — tiered by impact ÷ effort

> Tiers 0 and 1 deliver ~90% of the savings with **no schema change and no risk to
> correctness** (values are already authoritative from the write path). Tier 2 is
> structural cleanup. Tier 3 is optional infra.

### Tier 0 — Stop wasting compute (highest ROI, do first)

**0.1 Remove write-on-read.** Delete the streak recompute + `enrollment.update` from
`getDashboardData`. Read `currentStreak` / `longestStreak` / `daysCompleted` directly
off the already-fetched `enrollment` row (they are maintained by `submitDay`). This
removes the only write on the read path and lets Neon auto-suspend.

- Safety net: keep streak correctness solely in `submitDay`. (If you ever worry about
  drift, add a one-shot admin/cron recompute — Tier 3 — instead of recomputing per view.)

**0.2 Fetch each row once.** Resolve the enrollment **one time** in the page and pass
the resolved object down to heatmap / available-quiz / quiz-history instead of each
re-querying by `enrollmentId`. Same for the `user`/profile row (fetch once, reuse).

**0.3 Derive submissions once.** Do a single `submission.findMany` for the enrollment
selecting `{ dayNumber, status, submittedAt, githubUrl, linkedinUrl }`, and derive from
it in memory: today-completed (#7), recent-7 (#9), streak display source, and the
heatmap day map (#20). One query replaces four.

**0.4 Kill the quiz-banner N+1.** Replace the `for (week--)` loop
(`resolveAvailableQuizForBanner`) with a single `quiz.findMany` for the challenge/domain
(≤8 small rows) + a single `quizAttempt.findMany` for the user, then compute the
"highest unlocked week with no attempt" in memory. Merge this with `getAvailableQuiz`
so the banner and the quiz card share one resolution instead of two.

**0.5 Drop the duplicate existence check.** Remove the standalone
`user.findUnique` in `page.tsx:122`. Have `getDashboardData` distinguish *no user*
(deleted → signout redirect) from *no profile* (→ `/register`) in its return type, so the
single profile fetch also serves the existence guard.

### Tier 1 — Cache immutable content (cache hits never touch Neon)

**1.1 Cache daily-task content.** Wrap the per-challenge `dailyTask.findMany` (all 60
days) in `unstable_cache` keyed by `challengeId`, tagged `daily-tasks:<challengeId>`,
with a long/Infinity TTL. Content is seeded; invalidate by calling `revalidateTag` from
the seed script path or an admin action when content changes. This removes the heavy
60-row text fetch (#21, the biggest egress item) from every dashboard + challenge load.

**1.2 Cache `Challenge.startsAt` / claude-banner challenge lookup.** Wrap
`challenge.findUnique({ where: { domain: CLAUDE } })` in `unstable_cache`
(tag `challenge:CLAUDE`), and derive the "is enrolled in CLAUDE" check from the
already-fetched `getUserActiveEnrollments` list instead of a fresh `enrollment.findFirst`.

**1.3 Request-level dedup.** Wrap the canonical `getUserWithProfile(userId)` and
`resolveDashboardEnrollment(...)` helpers in React `cache()` so any accidental repeat
call within one render collapses to a single DB hit (defense-in-depth for 0.2).

**1.4 Leaderboard (when re-enabled).** It is currently commented out, so it costs
nothing today. When re-enabled, keep the planned `unstable_cache` 5-min TTL **and**
paginate (`take`/`skip`) — do not let it scan all enrollments per view.

### Tier 2 — Structural

**2.1 Single authoritative streak source.** Document that streak/daysCompleted are
write-time-only (owned by `submitDay`); no read path may write them. Add a brief
comment in `streak-utils.ts` to prevent regression.

**2.2 Lazy heatmap detail (optional).** The heatmap eagerly ships all 60 days' full
problem text to the client for popovers the user may never open. With 1.1 this is cached
server-side, so it's low priority; if egress is still high, move per-day detail to an
on-click server action that returns one cached day.

### Tier 3 — Infra (only if Tiers 0–1 don't get you under quota)

- **Confirm Neon auto-suspend** is enabled (default 5 min) — Tier 0.1 is what makes it
  actually trigger.
- **Prisma Accelerate** (free tier) for connection pooling + cacheable queries at the
  driver level, or the **Neon serverless driver** (HTTP, no idle connection) — only if
  Vercel serverless connection churn shows up after Tier 0–1.
- **Monitoring:** watch Neon's "Compute hours" and "Data transfer" graphs before/after
  each tier; add a lightweight log of query counts per request in dev if needed.

---

## 4. Files to touch (exact paths)

> Tiers 0–1 only. No schema changes.

- `src/features/dashboard/get-dashboard-data.ts` `[edit]` — remove streak recompute +
  `enrollment.update` (0.1); accept a pre-resolved enrollment + user/profile and a
  single submissions array; return a `no_user` discriminant (0.2, 0.3, 0.5); replace
  `resolveAvailableQuizForBanner` loop with set-based resolution (0.4).
- `src/app/dashboard/page.tsx` `[edit]` — resolve user/profile + enrollment + submissions
  once and thread them down; remove duplicate `user.findUnique` (0.2, 0.5); handle
  `no_user` → signout redirect; derive CLAUDE-enrollment from `allEnrollments` (1.2).
- `src/features/dashboard/get-heatmap-data.ts` `[edit]` — accept the already-resolved
  enrollment + submissions; read tasks via the cached helper (1.1); keep rejects query.
- `src/features/quiz/get-available-quiz.ts` `[edit]` — accept resolved enrollment;
  set-based week resolution; expose a shape the banner can reuse (0.4).
- `src/features/quiz/get-quiz-attempt-history.ts` `[edit]` — accept resolved enrollment
  (drop its own `enrollment.findFirst`).
- `src/features/challenge/get-daily-tasks-cached.ts` `[new]` — `unstable_cache` wrapper
  returning the 60-day task content for a `challengeId`, tagged `daily-tasks:<id>` (1.1).
- `src/features/user/check-claude-enrollment.ts` `[edit]` — cache the challenge lookup
  (tag `challenge:CLAUDE`); take enrollments as input rather than re-querying (1.2).
- `src/features/enrollment/resolve-dashboard-enrollment.ts` `[edit]` — wrap resolver in
  React `cache()` (1.3); export a `getUserWithProfile` `cache()` helper or add to
  `src/features/user/`.
- `prisma/seed.ts` (or wherever content is seeded) `[edit]` — call
  `revalidateTag('daily-tasks:<id>')` / `challenge:CLAUDE` after reseed, OR document a
  manual cache-bust step (1.1/1.2 invalidation).

---

## 5. Server vs Client
Every file above is **server-only** (Server Components, feature modules, server
actions). No `"use client"` involved; no Server→Client prop changes. The dashboard
page stays a Server Component; the data objects it already passes to client components
(`SubmissionHeatmap`, banners) keep the same serializable shape (plain objects/arrays —
no functions, icons, or class instances cross the boundary).

---

## 6. Steps (ordered, file-by-file)

1. **0.1 first (biggest win, smallest diff).** In `get-dashboard-data.ts`, delete lines
   189–201 (the `computeStreakStats` call + the `if (...) enrollment.update`). Use
   `enrollment.currentStreak` / `enrollment.longestStreak` from the resolved row in the
   returned object. Verify dashboard still shows correct streaks for a mid-challenge
   test user. Commit. (This alone should drop compute markedly.)
2. **0.5 / 0.2 user fetch.** Add a `no_user` branch to `getDashboardData`'s return union;
   in `page.tsx` remove the standalone existence query and redirect to signout on
   `no_user`. Resolve enrollment once in `getDashboardData` and return it; stop the
   downstream modules from re-resolving (next steps).
3. **0.3 submissions once.** In `getDashboardData`, do one `submission.findMany` for the
   enrollment; compute `isTodayCompleted` and `recentSubmissions` from it. Pass the array
   (or the day-map) into `getHeatmapData` so it no longer queries submissions itself.
4. **1.1 cached tasks.** Add `get-daily-tasks-cached.ts`; switch `getHeatmapData` (and
   today's-task lookup in `getDashboardData`) to read tasks from it.
5. **0.4 quiz.** Refactor `getAvailableQuiz` to set-based resolution; have
   `getDashboardData`'s banner reuse it; delete `resolveAvailableQuizForBanner`. Update
   `getQuizAttemptHistory` to take the resolved enrollment.
6. **1.2 claude banner.** Cache the CLAUDE challenge lookup; derive enrollment state from
   `allEnrollments` in `page.tsx`.
7. **1.3 dedup.** Wrap the resolver + user helper in `cache()`.
8. **Invalidation.** Wire `revalidateTag` into the seed/content path (or document the
   manual bust).

Each step is independently shippable and independently verifiable — do them in order and
commit after each.

---

## 7. Guardrails for Cursor (DO NOT)
- **DO NOT** add any write to a read/render path. No `update`/`upsert`/`create` inside
  `getDashboardData`, `getHeatmapData`, quiz getters, or the dashboard page.
- **DO NOT** change streak / `daysCompleted` math or move it out of `submitDay`. This
  plan *removes* a duplicate computation; it must not alter the authoritative one.
- **DO NOT** touch `prisma/schema.prisma`, migrations, or the result-envelope contract.
- **DO NOT** change the serializable shape of props passed to client components
  (`SubmissionHeatmap`, banners) — same fields, same plain-object types.
- **DO NOT** import `@/lib/*` into `middleware.ts` / `auth.config.ts` (edge-safe rule);
  none of these files are in that path, keep it that way.
- **DO NOT** cache anything user-specific or PII with `unstable_cache` — cache only
  immutable, shared content (daily tasks, challenge `startsAt`). User submissions,
  enrollments, and profiles stay live (or `cache()`-deduped within a single request only).
- **DO NOT** introduce new abstraction files beyond the two listed (`get-daily-tasks-cached.ts`
  and an optional `getUserWithProfile` helper). Inline the rest.
- Keep every Prisma query on a `select` (no full-record returns), per repo convention.

---

## 8. DB safety
No schema or data migration in this plan — read-path and caching changes only. Standard
checkpoint before starting: `git add -A && git commit -m "checkpoint before 019"`, note
the commit hash. A Neon branch snapshot is optional (no writes are being changed beyond
*removing* one), but cheap insurance.

---

## 9. Verification
- **Functional (manual):** log in as a mid-challenge test user (e.g. Vikram Day 15,
  Anika Day 30, Karan Day 45 broken streak, Meera Day 60 COMPLETED). Confirm dashboard
  shows identical streak / days-completed / today's-task / heatmap / quiz banner / recent
  activity as before. Submit a day and confirm streak still updates (write path intact).
- **Query-count proof:** enable Prisma query logging in dev
  (`new PrismaClient({ log: ['query'] })`, dev only) and count queries on one dashboard
  load before vs after. Expect **~22–28 reads + 1 write → ~6–8 reads + 0 writes**.
- **Cache proof:** load the dashboard twice; the second load should issue **zero**
  `dailyTask`/`challenge` queries (cache hit).
- **Build/type:** `npm run build` and `tsc` (strict) must pass with no `any`.
- **Files changed:** exactly those in §4 — diff should contain no schema/migration files.
- **Neon dashboard:** after deploy, watch Compute-hours trend down over 24h and confirm
  the endpoint reaches the idle/suspended state during low-traffic windows (this confirms
  0.1 worked).

---

## 10. Commit message
```
perf(db): eliminate write-on-read and collapse dashboard query fan-out

Dashboard previously issued ~22-28 queries plus a streak write on every
load, keeping Neon compute awake and burning free-tier compute hours.

- Remove streak recompute + enrollment.update from getDashboardData;
  streaks remain authoritative from submitDay (write path).
- Resolve user/profile, enrollment, and submissions once per render and
  thread them into heatmap/quiz getters (was fetched 2-4x each).
- Replace the quiz-banner week-by-week N+1 with set-based resolution.
- Cache immutable daily-task content and Challenge.startsAt via
  unstable_cache with tag invalidation on reseed.

No schema change; no behavior change. ~6-8 reads + 0 writes per load.
```
