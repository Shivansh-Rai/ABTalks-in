# 025 — B2B Program 02 — Entry funnel: apply, timed assessment, enrollment

> Depends on 024. Read roadmap `023` §4 (schema), §7 (entry assessment rules), §9 (guardrails).

## 1. Goal
Professionals apply with a profile form, take a server-timed entry assessment
(10 aptitude + 10 technical MCQs, 25 min, pass = ≥12/20 AND technical ≥5/10, max 2
attempts 24 h apart), and on pass are enrolled into the active cohort with capacity
check → `ENROLLED`, overflow → `WAITLISTED`.

## 2. Current behavior
After 024: schema + shell exist; `/program` landing links to `/program/apply` which 404s.
`getActiveCohort()` exists. No entry questions seeded yet (admin/seed can insert
`ProgramEntryQuestion` rows; the content phase fills the real bank — build against the
model, and seed ~10 placeholder questions per section in `prisma/content/program/entry-questions.json`
marked clearly as placeholders so the flow is testable).

## 3. Files to touch
- `[new] src/lib/validations/program.ts` — Zod schemas: `applyProfileSchema`
  (fullName, jobRole, company, yearsExperience 0–40, education?, university?,
  graduationYear?, skills string[] 1–8, linkedinUrl (reuse LinkedIn pattern from
  `lib/validations` if a URL helper exists, else `z.string().url()` + host check),
  resumeUrl optional url, phone via existing `optionalPhoneSchema`, githubUsername
  `/^[a-zA-Z0-9-]{1,39}$/`, githubRepoUrl `https://github.com/{owner}/{repo}` pattern —
  owner must equal githubUsername, case-insensitive), plus `entrySubmitSchema`
  (attemptId cuid, answers array of `z.number().int().min(0).max(3).nullable()` length 20).
- `[new] src/features/program/entry.ts` — logic:
  - `getEntryState(userId)` — cohort + member row + attempts summary → drives which
    screen the apply page shows (form / assessment CTA / cooldown / failed / enrolled / waitlisted).
  - `createApplication(userId, profile)` — upsert `ProgramMember` (status `APPLIED`)
    for active `ENROLLING` cohort; reject if none or if user already `ENROLLED/WAITLISTED`.
  - `startEntryAttempt(userId)` — guards: member APPLIED, attempts < 2, 24 h since
    attempt 1 (`submittedAt`), cohort still `ENROLLING`. Samples 10 random active
    questions per section (`ORDER BY random()` via `prisma.$queryRaw` OR fetch ids +
    shuffle in JS — choose JS shuffle, simpler), creates `ProgramEntryAttempt` with
    `questionIds`, returns questions WITHOUT `correctIndex`/`explanation`.
  - `submitEntryAttempt(userId, attemptId, answers)` — transaction: load attempt (must
    be caller's, unsubmitted), **server-enforce timer**: if `now > startedAt + 25min`,
    grade only as-is (client can't extend). Grade both sections, set scores +
    `passed`, and if passed: count `ENROLLED` members in cohort **inside the
    transaction** → set member `ENROLLED` + `enrolledAt` (else `WAITLISTED`).
    Return per-question review (correctIndex + explanation now allowed) + outcome.
- `[new] src/app/actions/program-entry-actions.ts` — `"use server"`; thin Zod-validated
  wrappers: `applyToProgramAction`, `startEntryAssessmentAction`,
  `submitEntryAssessmentAction`. Result envelope everywhere.
- `[new] src/app/program/apply/page.tsx` — Server Component (protected by middleware,
  NOT by `requireProgramMember` — applicants aren't members yet). Reads
  `getEntryState`; renders one of: `ApplyForm`, assessment intro + start CTA,
  cooldown notice (shows unlock time IST), failed-twice notice, already
  enrolled/waitlisted → link to `/program/dashboard` or waitlist notice.
- `[new] src/components/program/apply-form.tsx` — Client; RHF + zodResolver on
  `applyProfileSchema`; skills as tag input (comma-entry, chips); submits action, on
  success `router.refresh()`.
- `[new] src/app/program/assessment/page.tsx` — Server Component; guards via
  `getEntryState` (must be APPLIED with a startable/in-progress attempt) else redirect
  to `/program/apply`.
- `[new] src/components/program/entry-assessment.tsx` — Client; receives
  `{ attemptId, deadlineIso, questions: {id, section, question, options[]}[] }` (plain
  JSON only). One-question-at-a-time UI with progress, prev/next, countdown from
  `deadlineIso` (cosmetic — server is authoritative), auto-submit on expiry, result
  screen with section scores + per-question review + outcome (enrolled / waitlisted /
  retake at <time> / not eligible).
- `[edit] src/app/program/page.tsx` — landing CTA now reflects state for logged-in
  users (Apply / Continue assessment / Go to dashboard) via a small server-side lookup.
- `[edit] docs/project-context.md` — entry funnel shipped.

## 4. Server vs Client
| File | Type | Notes |
|---|---|---|
| `apply/page.tsx`, `assessment/page.tsx` | Server | serialize plain objects to clients |
| `apply-form.tsx`, `entry-assessment.tsx` | Client | JSON props only; no Date objects (pass ISO strings) |
| `entry.ts` | server (feature) | all Prisma here, `select` everywhere |

## 5. Steps
1. Validations file → feature logic (`entry.ts`) → actions. Unit-test the grading
   mentally against roadmap §7 rules; timer + capacity checks MUST be inside the
   transaction in `submitEntryAttempt`.
2. Apply page + form. 3. Assessment page + client. 4. Landing CTA state.
5. Placeholder entry questions JSON (10+10, clearly `"PLACEHOLDER — replace in content phase"`)
   and verify `npm run db:seed:program` loads them.
6. Verify (§8), update context doc, commit.

## 6. Guardrails for Cursor (DO NOT)
- Do NOT gate `/program/apply` with `requireProgramMember` (applicants aren't members);
  middleware already forces login.
- Do NOT send `correctIndex`/`explanation` to the client before submission.
- Do NOT trust the client timer or client-computed scores — server grades from
  `questionIds` + stored correct answers only.
- Do NOT allow a third attempt or a second concurrent unsubmitted attempt.
- Capacity check must be `tx.programMember.count({ where: { cohortId, status: "ENROLLED" }})`
  inside the SAME transaction that flips status — no race.
- No new deps.

## 7. DB safety
No schema change. Seed touches only `ProgramEntryQuestion` (clean-replace) — safe.

## 8. Verification
- Full happy path with a dev user: apply → start → answer → pass → `ENROLLED`, redirected
  state shows dashboard link. Repeat with a failing score → cooldown message with IST time;
  second fail → "not eligible".
- Set cohort capacity to 1 in DB, enroll a second passing user → `WAITLISTED`.
- Start an attempt, wait past deadline (temporarily set 25 min → 1 min in a local const
  for testing, restore before commit), submit → only in-time answers graded.
- Timer/attempt guards hold on direct action invocation (not just UI).
- `npx tsc --noEmit` + `npm run build` clean; only §3 files changed.

## 9. Commit message
`feat(program): entry funnel — application, timed entry assessment, capacity-checked enrollment`
