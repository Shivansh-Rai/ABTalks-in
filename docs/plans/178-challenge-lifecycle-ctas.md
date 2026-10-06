# 178 — Challenge lifecycle CTAs platform-wide

## 1. Goal

Drive every 60-day Continue / Completed CTA from `challengeLifecycle`
(`active` | `completed` | `ended`). Stop `/claude` hero Continue Day 60 after
the window closes, and never label an unfinished ended run as completed.

## 2. Current behavior

- `buildContinueInfo` ignores lifecycle; capped `currentDay` + `todayTask`
  keeps Continue Day 60 after grace.
- ContinueCard `caught_up` can say "You've completed all N days" falsely.
- Hub ContinueLearning / ContinueJourney already use lifecycle; other surfaces
  still key off DB `status === ACTIVE`.

## 3. Files to touch

| File | | Note |
|---|---|---|
| `docs/plans/178-challenge-lifecycle-ctas.md` | `[new]` | This plan |
| `src/features/dashboard/get-hub-data.ts` | `[edit]` | Export `challengeLifecycle` |
| `src/features/dashboard/get-dashboard-data.ts` | `[edit]` | `todayTask` only while elapsed in 1..totalDays |
| `src/components/challenge/track-page.tsx` | `[edit]` | Lifecycle-first continue info |
| `src/components/challenge/challenge-view.tsx` | `[edit]` | `ended` mode; fix false complete copy |
| `src/app/dashboard/page.tsx` | `[edit]` | firstActive / build % via lifecycle |
| `src/features/dashboard/hub-search-index.ts` | `[edit]` | Continue group = active only |
| `src/components/dashboard-hub/stages/build-skills-panel.tsx` | `[edit]` | Library CTA Continue vs View |
| `src/features/dashboard/get-stage-data.ts` | `[edit]` | Quiz loop on lifecycle active |
| `src/features/enrollment/get-user-enrollments.ts` | `[edit]` | Lifecycle on summaries |
| `src/app/explore/page.tsx` | `[edit]` | Load all challenge enrollments |
| `src/components/explore/track-list.tsx` | `[edit]` | Active / Ended / Completed badges |
| `docs/CHANGELOG.md` | `[edit]` | One Pending reconcile line |

## 4. Guardrails (DO NOT)

- DO NOT widen relaxation window or remove `assertPastDaySubmittable`.
- DO NOT map lifecycle `ended` to `EnrollmentEndedScreen`.
- DO NOT change `getCurrentDayNumber` cap.
- DO NOT edit notification-locked paths, middleware, CLAUDE.md, project-context.
- DO NOT touch program-track Continue Day CTAs.
- DO NOT run Neon mutations.

## 5. Verification

- Ended Claude: no Continue Day 60; CHALLENGE ENDED; hub Finished Ended · X of 60.
- True complete: CHALLENGE COMPLETE / Completed · 60 of 60 only.
- Mid-window active: Continue Day N still works.
- Typecheck passes.

## 6. Commit message

`fix: gate challenge Continue/Completed CTAs on enrollment lifecycle`
