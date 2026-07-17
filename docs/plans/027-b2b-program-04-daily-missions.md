# 027 — B2B Program 04 — Daily Mission engine: verification, gating, scoring, leaderboard

> Depends on 026 + the content seed (days with real `missionSpec`s; placeholders OK for
> build). Roadmap v2 §5 (scoring), §6 (progression), §6b (mission types) are the single
> source of truth — no design freedom on rules.

## 1. Goal
Wire the 30 Daily Missions onto the Workbench: server-authoritative verification for
all 5 mission types rendered as CI checks, "iterate until green" gating with skip
tokens, the 3-question concept check, mission/concept scoring, cohort leaderboard,
member dashboard (mission control), videos page, and the unscored Practice Arena.

## 2. Current behavior
After 026: Workbench runs code client-side; day pages show briefs with Submit disabled;
no gating beyond `highestUnlockedDay = 1`; `ProgramMissionSubmission`/
`ProgramConceptAttempt` empty; `src/lib/anthropic.ts` exists unused.

## 3. Files to touch
**Verification core (server)**
- `[new] src/features/program/verify-mission.ts` — `verifyMission(day, payload)` →
  `{ passed, verdict: [{check, passed, detail}] }`. One pure function per type:
  - `CODE_SPRINT`: payload = `{ code, hiddenOutputs: string[] }`. Flow: client first
    calls `getHiddenTestsAction(dayNumber)` → returns `missionSpec.hiddenTests[].input`
    ONLY (never `expected`); client runs each input through the runner, submits
    outputs; server normalizes (trim lines, collapse trailing ws) and compares to
    `expected`. Each hidden test = one named check line.
  - `SHIP_IT`: payload = `{}` (repo known from member). Server GitHub API fetch
    (define exported `parseRepo(githubRepoUrl) → {owner, repo}` HERE — 028 reuses it;
    token `GITHUB_API_TOKEN`): run `missionSpec.repoChecks[]` —
    kinds `fileExists | contentMatches(regex) | minLines | parsesAs(json|yaml)`
    against fetched file contents. Timeouts/404s → failed check with detail, never throw.
  - `DATA_ROOM`: payload = `{ answers: (string|number)[] }`; compare vs
    `missionSpec.answers[]` with `{ tolerance?, caseInsensitive? }`.
  - `PROMPT_FORGE`: payload = `{ prompt: string ≤4000 }`. For each
    `missionSpec.evalCases[]` (≤5): call `askClaudeJson` with member's prompt as
    system + case input as user (maxTokens ≤ 1000); assert per case:
    `contains | jsonField | refusal` (deterministic), optional single `judge`
    criterion (second Claude call scoring 0/1 with reason). API failure → check
    "detail: evaluation service unavailable, run again" (not a fail-forever).
  - `BOSS_BUILD`: payload = `{ repoUrl, writeup }` → validates + creates/updates
    `ProgramProject` (status SUBMITTED — grading is 029) → single check "Project
    submitted ✓" passes the day.
- `[new] src/features/program/missions.ts` —
  - `recomputeMemberScore(tx, memberId)` — exported: sets `totalScore = missionPoints +
    conceptPoints + commitPoints + projectPoints` (single scoring summer; 028/029 reuse it).
  - `submitMissionRun(memberId, dayNumber, payload)` — guards: day AVAILABLE (unlocked,
    not passed/skipped), cohort not frozen; runs `verifyMission`; transaction: store
    submission (attemptNumber = count+1) with verdict; on FIRST pass: +`day.missionPoints`
    to `missionPoints`, `cleanPassCount+1` if attemptNumber === 1, bump
    `highestUnlockedDay` (≤30), `recomputeMemberScore`. Rate-limit: reject if >30 runs
    for that day or last run <15 s ago (simple DB checks — PROMPT_FORGE cost control).
  - `useSkipToken(memberId, dayNumber)` — guards: AVAILABLE day, `skipTokensUsed < 2`,
    ≥3 failed runs on the day (must have genuinely tried); transaction: synthetic
    SKIPPED marker submission (`passed:false, pointsAwarded:0, payload:{skipped:true}`),
    `skipTokensUsed+1`, unlock next day.
  - `getMissionState(memberId, dayNumber)` — runs history (verdicts), state, tokens left.
- `[new] src/features/program/concept-check.ts` — `startConceptCheck` (sample 3 from
  day pool, one attempt ever, allowed on any unlocked day incl. SKIPPED),
  `submitConceptCheck` (grade, +1 pt/correct via transaction + recompute). No gate.
- `[new] src/features/program/progression.ts` — `getCohortCalendarDay(cohort)` (IST via
  `lib/date-utils.ts`), `getMemberDayStates(memberId)` (moves/absorbs 026 helper),
  `isCohortFrozen(cohort)`.
- `[new] src/features/program/leaderboard.ts` — roadmap §5 sort, `unstable_cache` 5-min
  TTL keyed by cohortId, minimal `select` (+ cleanPassCount).
- `[new] src/features/program/dashboard.ts` — mission control data: score breakdown,
  member day vs cohort day, current mission teaser, clean-pass streak, rank, module
  progress, recent verdicts.
- `[new] src/app/actions/program-mission-actions.ts` — `getHiddenTestInputsAction`,
  `submitMissionRunAction`, `useSkipTokenAction`, `startConceptCheckAction`,
  `submitConceptCheckAction` — Zod (payload size caps: code ≤20k, prompt ≤4k,
  answers ≤20 items) + envelope.

**UI**
- `[edit] src/app/program/(app)/day/[day]/page.tsx` — replace 026's placeholder panel
  with `mission-panel.tsx` (per-type payload wiring) + `concept-check-panel.tsx` below.
- `[new] src/components/program/mission-panel.tsx` — Client orchestrator: per type —
  CODE_SPRINT (Workbench + "Run visible checks" locally + "Submit for verification"
  which fetches hidden inputs, runs them, submits), SHIP_IT (repo path instructions +
  "Verify my repo" button), DATA_ROOM (Workbench + answer form), PROMPT_FORGE (prompt
  editor + live case results), BOSS_BUILD (project form). All verdicts render through
  026's `check-list.tsx`. Pass state: confetti (existing `canvas-confetti`), "Day N
  cleared — Day N+1 unlocked" banner, next-day CTA. Failed ≥3 runs → skip-token offer
  (tokens left, irreversible warning modal).
- `[new] src/components/program/concept-check-panel.tsx` — Client; 3 quick MCQs, single
  attempt, inline explanations after submit, +N pts chip.
- `[new] src/app/program/(app)/dashboard/page.tsx` — mission control per roadmap §10:
  stat cards (total score, rank, day X/30 vs cohort day, clean passes), score
  breakdown bars, today's mission card (type badge + CTA), module campaign strip,
  recent verdict lines.
- `[new] src/app/program/(app)/leaderboard/page.tsx` — ranked table (rank, name,
  company, role, yrs, component mini-bars, clean-pass %, total), caller highlighted,
  top-3 podium block.
- `[new] src/app/program/(app)/videos/page.tsx` — module-filtered library (client
  filter chips, string props); videos for days > cohort calendar day locked.
- `[new] src/app/program/(app)/arena/page.tsx` — Practice Arena: unscored exercises in
  the Workbench (visible modules only), completion badges via
  `completeExercise`-style action (no points — engagement only).
- `[new] src/app/actions/program-arena-actions.ts` — `completeArenaExerciseAction`
  (server re-checks expectedOutput normalization; writes completion, NO score change).
- `[edit] src/app/program/(app)/curriculum/page.tsx` — day states now from
  `progression.ts`; add mission-type filter chips.
- `[edit] docs/project-context.md` — mission engine shipped.

## 4. Server vs Client
| File | Type | Notes |
|---|---|---|
| verify/missions/concept/progression/leaderboard/dashboard features | server | `missionSpec` handled ONLY here; hidden `expected`/answers never in any action response |
| mission-panel, concept panel, filters | Client | JSON props; verdicts arrive as plain arrays |
| all pages | Server | explicit selects |

## 5. Steps
1. `verify-mission.ts` (type by type, CODE_SPRINT → SHIP_IT → DATA_ROOM →
   PROMPT_FORGE → BOSS_BUILD) → `missions.ts` → `concept-check.ts` → actions.
2. `mission-panel.tsx` + day page wiring. 3. Concept panel. 4. Progression +
   curriculum update. 5. Dashboard. 6. Leaderboard. 7. Videos. 8. Arena.
9. Verify (§8), context doc, commit.

## 6. Guardrails for Cursor (DO NOT)
- Do NOT return `missionSpec`, `hiddenTests[].expected`, `answers[].value`, or
  `evalCases` assertions to the client — `getHiddenTestInputsAction` returns inputs
  ONLY. Grep the diff for these fields before finishing.
- Do NOT trust client-side check results — the server verdict is the only verdict.
- Do NOT allow runs on locked/passed/skipped/frozen days at the ACTION level.
- Do NOT put Anthropic/GitHub calls inside Prisma transactions (verify first, then
  transact).
- Do NOT bypass the PROMPT_FORGE rate limits (15 s spacing, 30 runs/day cap).
- Points/unlocks happen ONLY in `submitMissionRun`'s transaction via
  `recomputeMemberScore`; `cleanPassCount` only on attempt #1 passes.
- Skip tokens: hard cap 2, require ≥3 failed runs, irreversible — no admin-free undo.
- Do NOT touch student challenge/leaderboard code. No new deps.

## 7. DB safety
No schema change. All writes transactional; recompute keeps scores idempotent.

## 8. Verification
- CODE_SPRINT day: fail a hidden test → red check line with detail; fix → all green →
  confetti, +12 pts, day 2 unlocked, attempt #2 pass ⇒ cleanPassCount unchanged.
- SHIP_IT: repo missing file → named check fails with path detail; push file → green.
- DATA_ROOM: tolerance + case-insensitivity honored. PROMPT_FORGE (real API key):
  weak prompt fails named cases; strong prompt passes; 2 rapid runs → rate-limit message.
- BOSS_BUILD day 7: submit → day passes, project row SUBMITTED.
- Skip token: blocked before 3 fails; works after; second token works; third refused.
- Concept check: one attempt, +0–3 pts, works on a SKIPPED day.
- Frozen cohort (endsAt past) rejects everything; leaderboard + dashboard totals match
  recompute; videos pace-lock; arena awards no points. Mobile 390px pass.
- Network tab: no spec/expected fields anywhere. Build + tsc clean; §3 files only.

## 9. Commit message
`feat(program): Daily Mission engine — 5 verified mission types, iterate-until-green gating, skip tokens, concept checks, leaderboard, mission-control dashboard`
