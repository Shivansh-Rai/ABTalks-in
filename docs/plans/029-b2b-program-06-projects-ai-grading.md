# 029 — B2B Program 06 — AI grading (Boss Builds), AI Mentor reviews, AI recommendations

> Depends on 027 (+028's at-risk helpers for context blocks). `src/lib/anthropic.ts`
> already exists (shipped in 026); project SUBMISSION already exists (027's BOSS_BUILD
> missions create `ProgramProject` rows). This plan is the AI layer on top:
> grading, mentor reviews, recommendations. Env: `ANTHROPIC_API_KEY`,
> `PROGRAM_ANTHROPIC_MODEL` (default `claude-sonnet-5`).

## 1. Goal
Three AI features: (1) admin-triggered Claude grading of submitted Boss Build projects
(0–100 vs per-module rubric, written feedback, admin override), (2) **AI Mentor** —
member-triggered code review of a passed daily mission with 2–3 concrete improvement
notes, (3) batch AI recommendations per member for dashboards and recruiter profiles.

## 2. Current behavior
After 027: `ProgramProject` rows accumulate with status `SUBMITTED`, `projectPoints`
stays 0, `ProgramMissionSubmission.aiFeedback` always null,
`ProgramMember.aiRecommendation` null. `askClaudeJson` (026) and
`recomputeMemberScore`/`parseRepo` (027) exist.

## 3. Files to touch
- `[new] prisma/content/program/rubrics.json` — 4 module rubrics (placeholder structure
  now; architect authors real ones in the content phase): `{ moduleNumber, criteria:
  [{ name, weight, description }] }`. Loaded at grade time via `fs` — NOT seeded to DB.
- `[new] src/features/program/projects.ts` —
  - `gradeProject(projectId)` — fetch repo context via GitHub API (`parseRepo` from
    027; token `GITHUB_API_TOKEN`): README (`/readme`, base64), file tree
    (`/git/trees/HEAD?recursive=1`, first 200 paths), languages (`/languages`).
    Prompt = rubric + writeup + README + tree + languages →
    `askClaudeJson<{ score: number; criteria: {name, score, note}[]; feedback: string }>`.
    Clamp 0–100. Then transaction: save `aiScore/aiFeedback/aiRubricJson/gradedAt/
    status=GRADED`, set `projectPoints = Σ effectiveScore` across the member's graded
    projects, `recomputeMemberScore`.
  - `overrideProjectScore(adminId, projectId, score, reason)` — sets `adminScore`,
    recomputes, writes `AdminAction` (`PROGRAM_OVERRIDE_PROJECT_SCORE`).
- `[new] src/features/program/mentor.ts` — `reviewMission(memberId, dayNumber)` —
  guards: that day has a PASSED submission by this member, its `aiFeedback` is null
  (ONE review per member per day — cost control), cohort not frozen. Prompt = day
  brief summary + the passing submission's payload (code/prompt/answers — truncate to
  8k chars) → `askClaudeJson<{ strengths: string[]; improvements: string[] }>` →
  store formatted markdown into that submission's `aiFeedback`. Returns it.
- `[new] src/features/program/recommendations.ts` — `generateRecommendations(cohortId)`
  — for each ENROLLED/COMPLETED member without a rec newer than 7 days: compact stats
  block (score components, clean-pass rate, behind-by, skip tokens used, commit rate,
  project scores) → `askClaudeJson<{ recommendation: string }>` (2–3 sentences,
  recruiter-readable, concrete) → save to member. Sequential, 500 ms gap; returns
  `{ generated, skipped, failed }`.
- `[new] src/app/actions/program-ai-actions.ts` — member: `requestMentorReviewAction`
  (Zod: dayNumber 1–30). Admin (`requireAdmin`): `gradeProjectAction`,
  `overrideProjectScoreAction`, `generateRecommendationsAction`. Envelope everywhere.
- `[edit] src/components/program/mission-panel.tsx` — pass state gains a "Get AI
  Mentor review" button → strengths/improvements card (stored, shown on revisit).
- `[edit] src/app/program/(app)/dashboard/page.tsx` — project scores + feedback in
  breakdown; "Your AI mentor note" card showing `aiRecommendation`.
- `[new] src/app/admin/program/projects/page.tsx` — `requireAdmin`; ungraded queue
  ("Grade with AI" per row + "Grade all ungraded" batch), graded list with criteria
  bars + override form (score + reason), "Generate recommendations" button with result
  toast. (Gets its nav home in 032.)
- `[edit] docs/project-context.md` — AI layer shipped (+ rubrics.json location).

## 4. Server vs Client
| File | Type | Notes |
|---|---|---|
| features (projects/mentor/recommendations) | server | API keys server-only; AI calls OUTSIDE Prisma transactions (call first, then transact) |
| mission-panel additions, admin grade UI | Client | JSON props |
| admin page | Server | `requireAdmin()` |

## 5. Steps
1. `rubrics.json` placeholder + `projects.ts` (grade → override). 2. `mentor.ts` +
   mission-panel button. 3. `recommendations.ts`. 4. Actions. 5. Admin projects page.
6. Dashboard additions. 7. Verify with real `ANTHROPIC_API_KEY`; commit.

## 6. Guardrails for Cursor (DO NOT)
- Do NOT auto-grade on submission — grading is an explicit admin action (cost control).
  Mentor reviews are member-triggered, hard-capped at ONE per member per day-mission.
- Do NOT let AI responses write anything beyond the specified fields; clamp scores
  0–100; malformed AI response → project stays `SUBMITTED` / `aiFeedback` stays null,
  error toast, never a crash or partial write.
- Do NOT expose rubric internals or other members' feedback to members; a member sees
  only their own scores/feedback/mentor notes.
- Do NOT install `@anthropic-ai/sdk` — `src/lib/anthropic.ts` (plain fetch) only.
- Do NOT regenerate recommendations fresher than 7 days.
- `projectPoints` recompute covers ALL the member's projects (not incremental) and
  ends with `recomputeMemberScore` — idempotent re-grades.

## 7. DB safety
No schema change. All writes transactional; recompute idempotent.

## 8. Verification
- Member's day-7 Boss Build (submitted in 027) → admin "Grade with AI" → score,
  criteria bars, feedback appear; member dashboard `projectPoints` up; leaderboard moves.
- Re-grade the same project → identical totals (idempotent). Admin override 85 →
  effective score changes + `AdminAction` row.
- Pass a CODE_SPRINT → "Get AI Mentor review" → strengths/improvements card; second
  request for the same day → friendly "already reviewed" with stored note.
- Generate recommendations → 2–3 sentence recs on dashboards; immediate re-run → all skipped.
- Kill the API key → all three features degrade to `{ ok:false }` toasts, nothing crashes.
- Non-admin calling admin actions directly → rejected. Build + tsc clean; §3 files only.

## 9. Commit message
`feat(program): AI layer — Claude project grading with admin override, AI Mentor mission reviews, member recommendations`
