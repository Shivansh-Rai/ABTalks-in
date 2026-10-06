# 177 — Claude “all missed” + past-day submit error

## 1. Goal

Fix the stuck challenge day clock after admin reset (PE upsert update dropped
`startedAt`) and stop the hub Continue card from labeling progress as
`daysCompleted + 1` instead of the IST calendar day. Do not reopen past missed
days outside the 5-day relaxation window.

## 2. Current behavior

- `assertPastDaySubmittable` correctly blocks past days outside today + prior 4.
- Hub `ContinueJourney` shows `Day ${daysCompleted + 1}`, so zero submissions
  always reads “Day 1 of 60” even when the calendar is day 20–60.
- `resetProgressAction` passes `startedAt: new Date()`, but
  `applyChallengeProgramEnrollment` upsert `update` only writes `status` and
  `completedAt`, so the clock stays on the old join date after reset.

## 3. Files to touch

| File | | Note |
|---|---|---|
| `docs/plans/177-claude-missed-days-reset-clock.md` | `[new]` | This plan |
| `src/repositories/enrollment-state.ts` | `[edit]` | Persist `startedAt` on PE upsert update |
| `src/repositories/enrollment-state.test.ts` | `[edit]` | Assert update path applies new `startedAt` |
| `src/features/dashboard/get-hub-data.ts` | `[edit]` | Expose `currentDay` on `HubEnrollment` |
| `src/components/dashboard-hub/continue-journey.tsx` | `[edit]` | Subtitle uses calendar `currentDay` |
| `docs/CHANGELOG.md` | `[edit]` | One Pending reconcile rule line |

## 4. Server vs Client

- `enrollment-state` / `get-hub-data`: server-only.
- `continue-journey.tsx`: presentational; only the subtitle source changes
  (`currentDay` number field). No new function props across the boundary.

## 5. Steps

1. In `applyChallengeProgramEnrollment`, add `startedAt: enrollment.startedAt`
   to the upsert `update` object. Do not change create fields.
2. Extend `enrollment-state.test.ts` mock to record `startedAt` from `update`,
   and add a suite: create with date A, update with date B → PE `startedAt` is B.
3. In `toHubEnrollment` / `HubEnrollment`, add
   `currentDay: getCurrentDayNumber(...)` using `startedAt` + `challengeStartsAt`.
4. In `ContinueJourney`, subtitle:
   `Day ${e.currentDay} of ${e.totalDays} · …` (keep streak). Do not change
   lifecycle filtering.
5. Append CHANGELOG one-liner under `## Pending reconcile`.
6. Run `npm run test:enrollment-state` and typecheck/build.
7. Account recovery after code fix: Admin → Reset progress so `startedAt`
   becomes today. Neon child branch only for any ad-hoc SQL.

## 6. Guardrails for Cursor (DO NOT)

- DO NOT widen `isWithinRelaxationWindow` or remove `assertPastDaySubmittable`.
- DO NOT change the `getCurrentDayNumber` cap (60) or use elapsed for unlock/display.
- DO NOT edit notification-locked paths, `middleware.ts`, or `CLAUDE.md` /
  `docs/project-context.md`.
- DO NOT add new abstraction files; only the listed edits.
- DO NOT run production Neon writes; child branch only if any SQL is used.
- DO NOT improvise if build/typecheck contradicts this plan — stop and report.

## 7. DB safety

Code-only fix: no migration. Optional account reset uses existing admin action.

## 8. Verification

- Unit: enrollment-state suite proves update writes new `startedAt`.
- Manual: old `startedAt` + `daysCompleted === 0` → hub shows calendar day, not
  Day 1; today / relaxable days remain submittable.
- Manual: admin Reset progress → `startedAt` is today → Day 1 available.
- Build/typecheck pass; only listed files changed.

## 9. Commit message

`fix: persist challenge startedAt on PE update so resets restart the day clock`
