# CLAUDE.md — ABTalks

## What this project is
ABTalks started as a 60-day coding challenge platform for Indian college students
(1st year through recent grads, mostly mobile): daily tasks across four domains
(AI / DS / SE / CLAUDE), GitHub + LinkedIn proof of work, streaks, and recruiter
discoverability after finishing. It now runs four tracks on one auth + admin spine:
the **60-Day Challenge**, the **AI Cohort Program** (`/program`, 31 days, working
professionals, plus the `/talent` recruiter portal), the **Hackathon**
(`/hackathon`), and the **Workshop / cohort-application funnel** (`/ai-workshop`,
`/ai-cohort-register`, `/ai-cohort-india`). Solo-developer build, free-tier hosting
(Vercel + Neon), live in production.

## Full context
`docs/project-context.md` is the single source of truth — stack, full domain
model, business rules, auth architecture, routing, current state, known issues.
Read it before planning anything non-trivial. (Intentionally not auto-imported
here, to keep this file lean.)

## Non-negotiable rules (always apply)
- Edge-safe middleware: `middleware.ts` and anything it imports use ONLY
  `next-auth` and `next/server`. NO `@/lib/*` imports — they blow the 1 MB Edge
  bundle limit.
- Split auth config: `auth.config.ts` is edge-safe (no Prisma); `auth.ts` has
  PrismaAdapter + Credentials. Keep them split.
- Prisma pinned to 6.x (NOT 7).
- **Plan 078 migration is PAUSED AFTER PHASE 6 + W1-A** (corrected 2026-09-04 —
  this block previously said all `ENABLE_NEW_*` were off, which stopped being
  true on 2026-08-26). Production today: **every Phase 6 read flag is ON**
  (`ENABLE_NEW_CREDENTIAL`, `_POINTS`, `_CANDIDATE`, `_LEARNING`, `_PROGRESS`,
  `_TALENT`), `ENABLE_NEW_POINTS_WRITES` is ON so `PointsAccount` +
  `PointsTransaction` are **write-authoritative**, and `ENABLE_DUAL_WRITE` is
  still on. Legacy tables are **mirrors, not read sources** — `User.synergyPoints`
  and `SynergyEvent` included. Phase 7 W1-B onward has **not** started and is
  **frozen for September 2026** (see `docs/plans/112-september-execution-plan.md`
  §13 D-1); nothing legacy has been dropped.
  New code reaches candidate/learning/progress/talent/points/credential data
  through `src/repositories/`, never through fresh `prisma.studentProfile` /
  `prisma.programMember` calls. **New features are built 078-native** — a new
  cohort or surface writes `ProgramEnrollment` / `ActivityAttempt` /
  `ActivityEvaluation` with plain cuids and no legacy row, the way
  `/program/databricks` and `/program/ds-architect` already do.
- **`SkillEvidence` has no live writer** (verified 2026-09-04). Only
  `prisma/scripts/migrate-2i-achievements.ts` writes it, so
  `CandidateSkill.evidenceScore` / `.verified` are frozen at backfill time.
  Any plan that depends on evidence-based ranking, candidate insights or skill
  strength must account for this. Fixing it is P0-0 in plan 112.
- IST (Asia/Kolkata) for all CHALLENGE day boundaries. Day 1 = reference start day
  in IST. Use `lib/date-utils.ts`. `getCurrentDayNumber` caps at 60 (display,
  unlocking, streaks); `getElapsedDayNumber` is uncapped and is the ONLY correct
  input for backfill / relaxation-window decisions.
  The `/program` track has its own zone constant, `PROGRAM_TZ` in
  `features/program/constants.ts` — as of 2026-08-12 it is **`Asia/Kolkata`**
  (was America/Chicago). Read `PROGRAM_TZ`; never hard-code the zone.
- Result envelope everywhere: `{ ok: true, data } | { ok: false, message }`.
- Zod at every boundary (action entry, route handler). Strict TS — no `any`.
- Server Components by default; `"use client"` only when needed. Mutations via
  Server Actions, not API routes.
- Prisma queries always use `select` (no full-record returns). Multi-step
  writes wrapped in transactions.
- Buttons: use `buttonVariants` directly on `<Link>`; never `<Button asChild>`
  or `<Button render={<Link>}>` (Base UI button semantics).
- Logging via `lib/logger.ts`, never `console.error`.

## Project layout
- `src/features/<domain>/` — business logic. 19 modules: registration, enrollment,
  submission, challenge, dashboard, profile, quiz, user, synergy, certificate,
  marketplace, jobs, recruiter, hackathon, workshop, program, talent-pool, email,
  admin. (No `auth/` module — auth lives in `src/auth.ts` + `src/lib/*-auth.ts`.)
- `src/app/actions/` — Server Actions (34 files, grouped by track)
- `src/repositories/` — the 078 read/write boundary (candidate, learning,
  progress, talent, points, credentials, dual-write, drift, `legacy/` adapters)
- `src/lib/` — db, auth (admin-auth, program-auth), logger, validations,
  date-utils, feature-flags, anthropic, email, csv
- `src/components/ui/` — shadcn primitives (do not modify)
- `src/components/<feature>/` — feature components
- `prisma/content/*.json` — seeded problem/quiz content

## Commands
- `npm run db:seed` — challenge content + 10 test users (@abtalks.dev)
- `npm run db:seed:program | :program:users | :marketplace | :claude-test |
  :hackathon-links | :content | :test-users` — per-track seeds
- `npm run db:cleanup:test | :real | :all` — wipe test / real / all (5s pause)
- `npm run db:backfill:certificates`, `npm run db:bootstrap:program-start-day`
- `npx prisma generate` — regenerate client (required after node_modules changes)

## Reconcile pass
Cursor logs every architecturally significant change as ONE dated line under
`## Pending reconcile` in `docs/CHANGELOG.md` (see `.cursorrules`). When I say
"reconcile": read that list, fold each line into the right section of
`docs/project-context.md`, verify it against the actual code (the log is a claim,
not proof), and update the reconciled-through date at the top of that file. Ask
before clearing the CHANGELOG list — it is Cursor's append-only log, outside the
file set above.

## Planning workflow
When I ask you to plan a feature:
1. Investigate the relevant code first.
2. Write ONE plan: `docs/plans/NNN-short-name.md` (zero-padded sequential).
3. Summarize in chat with the file path. Write NO code.

### Plan template (every plan uses this)
1. Goal — what and why (1–2 sentences).
2. Current behavior — what exists today in this area.
3. Files to touch — exact paths, each `[new]` or `[edit]` + one-line note.
4. Server vs Client — label every component touched; flag any Server→Client
   prop passing (no functions/icons/class instances across the boundary).
5. Steps — ordered, file-by-file, concrete enough that the executor makes no
   design decisions.
6. Guardrails for Cursor (DO NOT) — relevant items below + task-specific ones.
7. DB safety (only if schema/data changes) — commit checkpoint, Neon branch
   snapshot, note commit hash; then exact migration/seed steps.
8. Verification — how to manually test, what build/typecheck must pass, and
   exactly which files should have changed.
9. Commit message.

### Standing Cursor guardrails (observed failure modes — pre-empt in plans)
- Public surfaces (login, logout, Auth.js handler) must NOT get
  `requireRole`/`requireAdmin` — mark them public explicitly.
- Keep the edge/middleware import path clean (see edge-safe rule) — flag any
  file in it.
- No new abstraction files for trivial logic; inline it. New files appear only
  if the plan lists them.
- When a build error contradicts an assumption, trust the error and gather data
  — don't defend the prior choice (e.g. jose subpath import traps).
- Confirm files were actually written and the build passes before reporting done.

# ABTalks Developer Ownership Rules

You are working inside the ABTalks platform.

The codebase is shared by multiple developers using AI-assisted coding.

Your first responsibility is to respect module ownership.

## My Ownership

Developer: Shivansh

I own these modules/features:
- Candidate profile
- Candidate skills
- Education / experience / projects
- Opportunity preferences
- Candidate-side assessments
- Evidence
- Assessment Builder
- Career guidance
- Recruiter-side assessment builder

Typical files/folders related to my ownership:
Typical files/folders related to my ownership:

Candidate profile
- src/app/profile/
- src/app/actions/profile-actions.ts
- src/app/actions/candidate-profile-actions.ts
- src/app/api/profile/
- src/features/profile/
- src/components/profile/
- src/lib/validations/candidate-profile.ts
- src/lib/validations/profile.ts
- src/lib/profile-display.ts
- src/repositories/candidate.ts
- src/repositories/candidate-detail.ts
- src/repositories/candidate-primary.ts
- src/repositories/candidate-resume.ts
- src/repositories/candidate-merge.ts

Candidate skills
- src/components/profile/skills-section.tsx
- src/components/profile/skill-combobox.tsx
- src/features/profile/get-verified-skills.ts
- src/features/skill/
- src/lib/skill-catalog.ts
- src/app/api/skills/search/route.ts

Education / experience / projects
- src/components/profile/education-section.tsx
- src/components/profile/experience-section.tsx
- src/components/profile/projects-section.tsx
- src/components/profile/accomplishments-section.tsx
- src/components/profile/resume-section.tsx
- src/components/profile/links-section.tsx
- src/components/profile/basic-info-section.tsx

Opportunity preferences
- src/components/profile/preferences-section.tsx
- src/lib/validations/candidate-profile.ts

Candidate-side assessments (T-218)
- src/app/assessments/
- src/app/actions/assessment-attempt-actions.ts
- src/features/assessment-attempts/
- src/components/hire/assessment/candidate-assessment-screen.tsx
- src/components/hire/assessment/candidate-assessment-screen.css
- src/components/hire/assessment/assessment-types.ts
- prisma/migrations/20260911210000_assessment_answer/
- docs/plans/129-t218-assessment-taking-autosave.md

Evidence
- src/repositories/skill-evidence.ts
- src/features/profile/get-evidence.ts
- src/components/profile/evidence-section.tsx
- src/features/interview/evidence.ts
- src/app/hire/evidence/page.tsx
- src/components/hire/evidence-resume.tsx
- src/components/hire/evidence-cache.ts

Assessment builder + recruiter-side assessments (T-243 / T-244)
- src/app/hire/create-test/
- src/app/hire/assessments/
- src/app/actions/recruiter-assessment-actions.ts
- src/features/recruiter-assessments/
- src/components/hire/assessment/assessment-builder.tsx
- src/components/hire/assessment/question-editor.tsx
- src/components/hire/assessment/assessment-assign-panel.tsx
- src/lib/validations/assessment.ts
- prisma/migrations/20260911090000_recruiter_assessment_builder/
- prisma/migrations/20260911180000_recruiter_assessment_assignment/
- docs/plans/121-recruiter-assessment-builder.md
- docs/plans/128-t244-assessment-publish-assign-results.md

Career guidance
- (no dedicated src/ folder yet — T-224; mock-interview report is adjacent:
  src/components/profile/mock-interviews-section.tsx)

## Modules I Do NOT Own

Do not modify functionality owned by other developers unless explicitly approved.

Other ownership:

Zainab:
- Recruiter registration
- Recruiter profile
- Company identity
- Credits
- Credit ledger
- Contact unlock
- Plans / limits
- Outreach
- Mock Interviews

Shashank:
- Talent projects
- Search synonyms
- Candidate review panel
- Shortlist / reject
- Hiring pipeline

- Recruiter analytics

Manuvrtti:
- Jobs
- Applications
- Job alerts
- Notifications
- Notification delivery
- Analytics events
- UTM tracking

Sohail:
- Authentication architecture
- Authorization
- Recruiter isolation
- Platform Admin
- Security
- Rate limiting
- Audit
- System configuration
- Shared architecture
- Infrastructure
- Database conventions
     •  Candidate search
* Search ranking

Shallika:
- UI/UX
- Design system
- Information architecture
- Product flows
- Responsive behaviour
- Visual QA

# Mandatory Rules

1. Before writing code, identify which owned module this task belongs to.

2. Before modifying files, show:

TASK:
MODULE:
FILES TO READ:
FILES YOU PLAN TO MODIFY:
WHY EACH FILE NEEDS TO CHANGE:

3. Prefer modifying only files inside my owned area.

4. Do not make unrelated changes.

5. Do not refactor another developer's module just because it makes implementation easier.

6. If the task requires modifying another developer's module, STOP before editing it.

Explain:

CROSS-MODULE CHANGE REQUIRED

Owner:
Module:
Files:
Why the change is required:
Proposed change:

Wait for approval before making that change.

7. Shared files should only be modified when truly necessary.

8. Changes involving authentication, authorization, shared architecture, database architecture, security or infrastructure must be reviewed by Sohail.

9. Never silently change existing behaviour.

10. Preserve existing working functionality unless the task explicitly requires changing it.

11. Run relevant tests after implementation.

12. At the end of implementation provide:

WHAT CHANGED:
FILES MODIFIED:
CROSS-MODULE CHANGES:
DATABASE CHANGES:
SECURITY IMPACT:
TESTS RUN:
MANUAL TEST STEPS:
KNOWN RISKS: