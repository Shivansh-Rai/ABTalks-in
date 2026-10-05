# 180 — Profile ready at 70% (tile disappears, road unlocks)

## 1. Goal
Let a candidate move along the dashboard road once their profile is **70%**
complete *and* the handful of high-importance details are actually in — instead
of demanding 100%. At that point the "Complete profile" tile disappears from the
stage rail and the map pin is free to walk the road.

## 2. Current behavior
- `src/features/profile/completeness.ts` scores a profile 0–100 over nine
  weighted sections (basic 25, experience 20, education 15, projects 15,
  skills 10, links 4, accomplishments 5, resume 3, preferences 3).
- `getStageData` → `profile.score` / `profile.sections` feeds the dashboard.
- `StageSwitcher` (`stages/stage-switcher.tsx:86`) gates on
  `profileScore >= 100`:
  - below 100 the red **Complete profile** tile is the first of four tiles,
  - the map pin is pinned to the start of the road, and every stage click
    replays a "I can't move forward till you complete your profile" bubble.
- 100% is a long tail (gender, state, country, awards, live demo link, …), so
  in practice nobody clears the gate and the tile never goes away.
- Raw `score >= 70` on its own is not safe: 8% is free (empty certifications +
  empty preferences), so a profile with **no name, no phone and no headline**
  can still cross 70 on projects/education/skills alone.

## 3. Files to touch
- `src/features/dashboard/profile-readiness.ts` **[new]** — the pure rule:
  `PROFILE_READY_SCORE = 70` plus the essential-field list, and
  `evaluateProfileReadiness(detail, completeness)` → `{ ready, blocking }`.
- `src/features/dashboard/profile-readiness.test.ts` **[new]** — fixtures for
  the three cases: under 70, over 70 with a missing essential, ready.
- `src/features/dashboard/get-stage-data.ts` **[edit]** — `profile` gains
  `ready: boolean` and `blocking: string[]`.
- `src/app/dashboard/page.tsx` **[edit]** — pass `profileReady`; the dev
  preview flag also forces `ready`; the tile's hint prefers a blocking
  essential over the weight-ranked next field.
- `src/components/dashboard-hub/stages/stage-switcher.tsx` **[edit]** —
  `profileReady` prop replaces the `>= 100` test; tile hidden when ready;
  bubble copy names the 70% bar; the now-unreachable "DONE" tile branch goes.
- `package.json` **[edit]** — `test:profile-readiness` script.

Not touched: `src/features/profile/completeness.ts` and anything else in the
candidate-profile module (Shivansh's). The rule consumes what that module
already exports (`SectionStatus`) plus the canonical `CandidateDetail` from the
repository boundary, so the score itself keeps its current meaning — it stays a
UX number with no authority, exactly as its header says.

## 4. Server vs Client
- `profile-readiness.ts` — pure module, no `server-only`, no React. Imported by
  a server module and by the test runner.
- `get-stage-data.ts` — Server (already `server-only`).
- `app/dashboard/page.tsx` — Server Component.
- `stages/stage-switcher.tsx` — **Client** (`"use client"`). Server → Client
  props stay primitives: `profileReady: boolean`, `profileScore: number`,
  `profileNext: string | null`. No functions, icons or class instances cross.

## 5. Steps
1. **`profile-readiness.ts`** (new)
   - `export const PROFILE_READY_SCORE = 70;`
   - Essentials, each a `{ label, met }` derived from `CandidateDetail` /
     `SectionStatus`, in the order a candidate should fix them:
     1. `Headline` — `detail.headline` filled
     2. `Full name` — `detail.fullName` filled
     3. `Phone number` — passes `phoneSchema`
     4. `Current city` — `detail.locationCity` filled
     5. `At least three skills` — ≥3 distinct candidate-claimed skills
     6. `Your education or work history` — the `education` **or** `experience`
        section reports `complete` (so "I have no work experience yet" counts).
   - `evaluateProfileReadiness(detail, { score, sections })` →
     `{ ready: score >= PROFILE_READY_SCORE && blocking.length === 0,
        blocking: labels of unmet essentials }`.
2. **`get-stage-data.ts`** — in `loadProfile`, call it with the `detail` and the
   `computeCompleteness` result; add `ready` + `blocking` to the returned
   profile and to `StageData["profile"]`; the `degrade` fallbacks get
   `ready: false, blocking: []`.
3. **`app/dashboard/page.tsx`**
   - `DASHBOARD_PREVIEW_PROFILE_COMPLETE=1` override also sets
     `ready: true, blocking: []`.
   - `profileNext` = `stageData.profile.blocking[0] ?? <existing weight-ranked
     pick>` — a blocked essential is what actually unlocks the road, so it is
     named first.
   - Pass `profileReady={stageData.profile.ready}` to `StageSwitcher`.
4. **`stage-switcher.tsx`**
   - Prop `profileReady: boolean`; `const profileDone = profileReady;` replaced
     by using the prop directly (rename the local to `profileReady`).
   - Tile render + grid columns + `StageRoad` + bubble all keyed off it (same
     places as today).
   - Bubble copy: "I can't move forward till your profile is 70% done."
   - `ProfileTile` only ever renders in the unfinished state now, so drop the
     `done` branch and the `Check` import if it becomes unused.
5. **test + script** — `npm run test:profile-readiness`.

## 6. Guardrails for Cursor (DO NOT)
- DO NOT edit `src/features/profile/completeness.ts` or change any weight. The
  0–100 number keeps its current meaning; only the dashboard's reading of it
  changes.
- DO NOT let the gate fall back to a bare `score >= 70` — the essentials check
  is the whole point of "high-importance details first".
- DO NOT touch `middleware.ts` or anything on the edge import path.
- DO NOT add new abstraction files beyond the two listed.
- DO NOT change the "Get hired" stage percentage (it stays profile strength) or
  `currentStage`.
- DO NOT pass functions/icons across the Server → Client boundary.
- `console.error` is banned; use `lib/logger.ts`.

## 7. DB safety
None — no schema or data change.

## 8. Verification
- `npm run test:profile-readiness` (new) and `npm run test:profile` both pass.
- `npm run lint` and `npm run build` (typecheck) pass.
- Manual, `/dashboard`:
  - profile under 70 → red tile present, pin stuck, bubble names 70%;
  - profile over 70 but, say, phone blank → tile still present and its hint
    reads "Phone number";
  - profile ≥70 with the essentials in → tile gone, three tiles across, pin
    walks the road.
  - `DASHBOARD_PREVIEW_PROFILE_COMPLETE=1 npm run dev` still shows the
    completed layout.
- Changed files: exactly the six listed in §3 plus this plan.

## 9. Commit message
`feat(dashboard): unlock the road at 70% profile strength`
