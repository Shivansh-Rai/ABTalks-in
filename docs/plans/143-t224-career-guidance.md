# 143 — T-224 Career guidance and next steps

## Goal

Tell the candidate what to do next to prepare for their next job, using only facts already on their profile and activity. Honest copy, no invented statistics. Surface: `/dashboard` immediately under Continue your journey, heading Career Guidance.

## Current behavior

No career-guidance engine or UI exists. The hub already knows challenge enrollments, AI-cohort membership, Databricks / DS Architect / Power BI flags, and hackathon registration, but does not assemble next-step advice.

## Files to touch

- `docs/plans/143-t224-career-guidance.md` `[new]`
- `src/features/career-guidance/types.ts` `[new]`
- `src/features/career-guidance/rules.ts` `[new]` — pure `evaluateRules`
- `src/features/career-guidance/get-career-guidance.ts` `[new]` — server loader
- `src/features/career-guidance/career-guidance.test.ts` `[new]`
- `src/repositories/candidate-detail.ts` `[edit]` — slim `getCareerGuidanceFacts`
- `src/components/dashboard-hub/career-guidance.tsx` `[new]`
- `src/app/dashboard/page.tsx` `[edit]` — load + mount
- `src/components/dashboard-hub/dashboard-header.tsx` `[edit]` — `#career-guidance` nav
- `package.json` `[edit]` — `test:career-guidance`
- `docs/CHANGELOG.md` `[edit]` — one Pending reconcile line

## Server vs Client

Loader + rules + section are server-only / Server Components. The page passes `GuidanceItem[]` (plain JSON) into `CareerGuidance`. No functions or icons across the RSC boundary.

## Steps

1. Add types and a pure rule engine. Every card interpolates a real fact; a rule that cannot name one does not fire. Cap 6 after href dedupe.
2. Add `getCareerGuidanceFacts` (skills, preferred roles, opportunity types, resumeUrl) and `getCareerGuidance` assembling enrollments, flags, jobs, mocks.
3. Table-driven tests for the locked mappings, skips, job match, empty facts.
4. Hub section under Continue your journey; header anchor after Your Challenges.
5. CHANGELOG one-liner. `npm run test:career-guidance` and `npx tsc --noEmit`.

Locked mappings (priority): completed AI cohort → mock; AI challenge active/completed → AI cohort; Claude completed → AI cohort; DS challenge → Databricks; Databricks completed → DS Architect; DS/Databricks + Power BI/Tableau skill → Power BI; SE or any completed challenge + open hackathon → hackathon; skill/role → matching challenge; published jobs overlapping skills/roles (max 2); fallback mock after a completed challenge.

## Guardrails for Cursor (DO NOT)

- Do not call an LLM or invent percentages, salary, demand, or market claims.
- Do not recommend a flag-off program, already ACTIVE/COMPLETED track, abandoned challenge, or a job already applied to.
- Do not duplicate Continue your journey (“continue Day N”).
- Do not put guidance on `/profile`.
- Do not edit jobs / hackathon / interview modules; read existing APIs.
- Do not add schema, env vars, or middleware imports.
- Do not edit `CLAUDE.md` or `docs/project-context.md`.
- Do not restyle the rest of the hub.
- Keep middleware edge-safe (this work does not touch it).

## DB safety

Read-only. No migration, seed, or write.

## Verification

`npm run test:career-guidance` and `npx tsc --noEmit`. Manual: AI challenge → AI Cohort because-line; completed AI cohort → mock not apply; completed Claude → AI Cohort; DS → Databricks when flag on; overlapping-skill job with no pay; empty candidate sees the honest empty state; section sits under Continue your journey on desktop and 375px.

## Commit message

`feat(dashboard): evidence-backed career guidance from profile and activity (T-224)`
