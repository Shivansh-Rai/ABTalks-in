# 023 — B2B AI Mastery Program — Master Roadmap & Shared Architecture (v2)

> **This is NOT an implementation plan.** It is the shared specification that plans
> 024–032 reference. Cursor: read this file before executing any `b2b-program-*` plan.
> Nothing in this file is executable on its own.
>
> **v2 change (owner decision):** daily MCQ quizzes are REPLACED by hands-on **Daily
> Missions** verified like CI. MCQs survive only as (a) the entry assessment and (b) a
> tiny 3-question daily concept check. Sections §4–§6b changed; everything else stands.

## 1. What we are building

A **B2B talent-pipeline product** inside ABTalks, separate from the 60-day student
challenge: professionals (2–7 yrs experience) apply, pass a timed entry assessment
(aptitude + technical MCQs), then run a **30-day, 4-module AI program** with:

- **Daily Missions** — hands-on build tasks in an interactive in-browser workbench,
  verified by CI-style checks (real code execution, GitHub artifact inspection,
  live prompt evaluation) — passing the mission unlocks the next day
- **Real GitHub commit tracking** via the GitHub API (daily cron)
- A **Practice Arena** — extra unscored exercises in the same workbench
- Video library (2 curated YouTube videos per day)
- End-of-module **projects graded by AI** (Anthropic API) with admin override,
  plus an **AI Mentor** that reviews passed mission code
- **AI recommendations** per participant (Anthropic API)
- Exit **real-time voice AI interview** (OpenAI Realtime API, evaluated by Claude)
- A **recruiter portal**: recruiters register, admin approves, and after results are
  published they browse ranked profiles including each member's **mission portfolio**
  (what they actually built, clean-pass rate, AI review notes) and shortlist candidates.

**Business decisions (locked with owner):** free for participants; initially free for
recruiters; one batch at a time, max 100; recruiters get **post-cohort access only**
and **log in**; program is a **visibly separate section**; content authored by the
architect (Claude); owner buys the AI APIs; interview score is **NOT** in the ranking
formula yet. **v2:** challenges must be practical/hands-on, and the platform should
feel professional and interactive — owner delegated the format design.

## 2. Plan sequence (execute strictly in order)

| # | File | Delivers | Depends on |
|---|------|----------|-----------|
| 024 | `b2b-program-01-foundation` | Schema migration (all `Program*` models, `Role.RECRUITER`), env scaffolding, feature flag, middleware + login-redirect exceptions, program shell + landing `/program` | — |
| 025 | `b2b-program-02-entry-funnel` | Apply form, timed entry assessment (aptitude + technical MCQs), pass/capacity/waitlist, enrollment | 024 |
| 026 | `b2b-program-03-workbench` | The interactive Workbench: code runners (Pyodide/sql.js/JS worker/YAML), CI-style check harness, mission renderer shell, curriculum + day-page skeleton | 025 |
| 027 | `b2b-program-04-daily-missions` | The Daily Mission engine: 5 mission types, server verification, gating + skip tokens, concept checks, scoring, leaderboard, member dashboard, videos, Practice Arena | 026 + content seed |
| 028 | `b2b-program-05-github-signals` | `vercel.json` cron, GitHub commits polling, commit points, heatmap, at-risk flags | 027 |
| 029 | `b2b-program-06-projects-ai-grading` | Module project submission, Anthropic AI grading + admin override, AI Mentor mission reviews, AI recommendations | 027 |
| 030 | `b2b-program-07-voice-interview` | OpenAI Realtime voice interview + Claude evaluation + admin monitor | 027 (029 recommended first) |
| 031 | `b2b-program-08-recruiter-portal` | RECRUITER role flows, `/talent` pool, member profiles incl. mission portfolio, shortlists, publish gating, admin approval | 029 (030 for interview data) |
| 032 | `b2b-program-09-admin-analytics` | `/admin/program` cohort management + analytics + CSV exports | 027+ |
| 034 | `b2b-program-11-azure-voice-adapter` | Voice interview transport on Azure OpenAI (owner has Azure keys; OpenAI-direct kept as fallback) | 030 |
| 035 | `b2b-program-12-project-lab` | JupyterLite notebook lab, Colab/Codespaces launchers, git-native notebook verification + grading | 027, 029 |

**Content phase (between 026 and 027):** program content ships as JSON under
`prisma/content/program/` + seed script: `modules.json`, `days.json` (mission briefs +
`missionSpec` per day), `concept-questions.json`, `entry-questions.json`,
`exercises.json` (practice arena), `videos.json`, `rubrics.json`. **Authored by the
architect (Claude) directly** — owner-authorized exception to the docs-only rule.
Videos ship as curated public YouTube IDs, owner-replaceable (flagged).

## 3. Naming & placement

- Program name: **AI Mastery Program** (route namespace `/program`).
- Recruiter portal: **`/talent`** (existing `src/features/recruiter/` =
  admin-authored `RecruiterReview` reports — do NOT touch).
- Feature modules: `src/features/program/`, `src/features/talent-pool/`.
- Components: `src/components/program/`, `src/components/talent/`.
- Server Actions: `src/app/actions/program-*-actions.ts`, `talent-actions.ts`.
- Auth helpers: `src/lib/program-auth.ts` (`requireProgramMember`, `requireRecruiter`) —
  node-only, DB-checked.
- Feature flag: `ENABLE_PROGRAM=true`; flag off → all program/talent routes `notFound()`.

## 4. Full Prisma schema addition (single migration in plan 024)

Modify: `enum Role { STUDENT ADMIN RECRUITER }` (append — additive, safe).

New enums:

```prisma
enum ProgramCohortStatus   { DRAFT ENROLLING ACTIVE COMPLETED ARCHIVED }
enum ProgramMemberStatus   { APPLIED WAITLISTED ENROLLED COMPLETED DROPPED }
enum ProgramLanguage       { PYTHON SQL JAVASCRIPT YAML }
enum ProgramEntrySection   { APTITUDE TECHNICAL }
enum ProgramInterviewStatus { NOT_STARTED IN_PROGRESS COMPLETED FAILED }
enum ProgramProjectStatus  { SUBMITTED GRADED }
enum ProgramMissionType    { CODE_SPRINT SHIP_IT DATA_ROOM PROMPT_FORGE BOSS_BUILD }
enum ProgramDayState       { LOCKED AVAILABLE PASSED SKIPPED }
```

New models (relations/`onDelete: Cascade` per existing conventions; every query uses `select`):

```prisma
model ProgramCohort {
  id                 String              @id @default(cuid())
  name               String
  startsAt           DateTime            // IST Day-1 anchor
  endsAt             DateTime            // hard end — scores freeze after this
  capacity           Int                 @default(100)
  status             ProgramCohortStatus @default(DRAFT)
  resultsPublishedAt DateTime?
  createdAt          DateTime            @default(now())
  members            ProgramMember[]
  entryAttempts      ProgramEntryAttempt[]
}

model ProgramMember {
  id                 String              @id @default(cuid())
  userId             String
  cohortId           String
  status             ProgramMemberStatus @default(APPLIED)
  // professional profile (deliberately NOT StudentProfile)
  fullName           String
  jobRole            String
  company            String
  yearsExperience    Int
  education          String?
  university         String?
  graduationYear     Int?
  skills             String[]            @default([])
  linkedinUrl        String?
  resumeUrl          String?
  phone              String?             // admin-only, NEVER shown to recruiters
  githubUsername     String
  githubRepoUrl      String              // dedicated public repo for the program
  // progression + denormalized scores
  highestUnlockedDay Int                 @default(1)
  skipTokensUsed     Int                 @default(0)   // max 2 per member
  missionPoints      Int                 @default(0)
  conceptPoints      Int                 @default(0)
  commitPoints       Int                 @default(0)
  projectPoints      Int                 @default(0)
  totalScore         Int                 @default(0)
  cleanPassCount     Int                 @default(0)   // missions passed on 1st verification run
  aiRecommendation   String?
  aiRecommendationAt DateTime?
  enrolledAt         DateTime?
  completedAt        DateTime?
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt
  user               User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  cohort             ProgramCohort       @relation(fields: [cohortId], references: [id], onDelete: Cascade)
  missionSubmissions  ProgramMissionSubmission[]
  conceptAttempts     ProgramConceptAttempt[]
  commitDays          ProgramCommitDay[]
  exerciseCompletions ProgramExerciseCompletion[]
  projects            ProgramProject[]
  interview           ProgramInterview?
  shortlistedBy       RecruiterShortlistItem[]

  @@unique([userId, cohortId])
  @@index([cohortId, totalScore(sort: Desc)])
  @@index([cohortId, status])
}

model ProgramModule {
  id        String       @id @default(cuid())
  number    Int          @unique   // 1..4
  title     String
  subtitle  String
  color     String
  startDay  Int
  endDay    Int
  days      ProgramDay[]
}

model ProgramDay {
  id            String             @id @default(cuid())
  moduleId      String
  dayNumber     Int                @unique   // 1..30
  title         String
  missionType   ProgramMissionType
  briefMd       String             // the mission briefing: realistic enterprise scenario, markdown
  assetsJson    Json?              // client-safe assets: datasets (CSV text), API specs, starter files
  missionSpec   Json               // SERVER-ONLY verification spec (see §6b) — never serialized to client
  starterCode   String?
  language      ProgramLanguage?   // for CODE_SPRINT / DATA_ROOM workbench default
  objectives    String[]           @default([])
  tools         String[]           @default([])
  estimatedMin  Int                @default(60)
  missionPoints Int                @default(12)
  isProjectDay  Boolean            @default(false)  // days 7, 14, 21, 30 (BOSS_BUILD)
  module        ProgramModule      @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  conceptQuestions ProgramConceptQuestion[]
  videos           ProgramVideo[]
}

model ProgramConceptQuestion {
  id           String     @id @default(cuid())
  dayId        String
  order        Int
  question     String
  options      String[]              // exactly 4
  correctIndex Int
  explanation  String
  day          ProgramDay @relation(fields: [dayId], references: [id], onDelete: Cascade)
  @@unique([dayId, order])
}

model ProgramMissionSubmission {
  id            String        @id @default(cuid())
  memberId      String
  dayNumber     Int
  attemptNumber Int
  payload       Json          // type-specific: {code} | {repoRef} | {answers} | {prompt} | {checkOutputs}
  verdict       Json          // per-check results: [{check, passed, detail}]
  passed        Boolean       @default(false)
  pointsAwarded Int           @default(0)
  aiFeedback    String?       // AI Mentor review (029), post-pass
  createdAt     DateTime      @default(now())
  member        ProgramMember @relation(fields: [memberId], references: [id], onDelete: Cascade)
  @@unique([memberId, dayNumber, attemptNumber])
  @@index([memberId, dayNumber])
}

model ProgramConceptAttempt {
  id          String        @id @default(cuid())
  memberId    String
  dayNumber   Int
  questionIds Json          // string[] — 3 sampled ids
  answers     Json?
  score       Int           @default(0)   // 0..3
  createdAt   DateTime      @default(now())
  member      ProgramMember @relation(fields: [memberId], references: [id], onDelete: Cascade)
  @@unique([memberId, dayNumber])          // ONE attempt — it's a warm-up, not a gate
}

model ProgramEntryQuestion {
  id           String              @id @default(cuid())
  section      ProgramEntrySection
  question     String
  options      String[]
  correctIndex Int
  explanation  String
  active       Boolean             @default(true)
  @@index([section, active])
}

model ProgramEntryAttempt {
  id             String        @id @default(cuid())
  userId         String
  cohortId       String
  attemptNumber  Int
  questionIds    Json
  answers        Json?
  aptitudeScore  Int           @default(0)
  technicalScore Int           @default(0)
  passed         Boolean       @default(false)
  startedAt      DateTime      @default(now())
  submittedAt    DateTime?
  user           User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  cohort         ProgramCohort @relation(fields: [cohortId], references: [id], onDelete: Cascade)
  @@unique([userId, cohortId, attemptNumber])
  @@index([userId, cohortId])
}

model ProgramVideo {
  id          String     @id @default(cuid())
  dayId       String
  order       Int
  title       String
  youtubeId   String
  durationMin Int?
  day         ProgramDay @relation(fields: [dayId], references: [id], onDelete: Cascade)
  @@unique([dayId, order])
}

model ProgramExercise {              // Practice Arena — UNSCORED
  id             String          @id @default(cuid())
  slug           String          @unique
  title          String
  language       ProgramLanguage
  moduleNumber   Int
  order          Int
  description    String
  starterCode    String
  setupSql       String?
  expectedOutput String?
  completions    ProgramExerciseCompletion[]
  @@index([moduleNumber, order])
}

model ProgramExerciseCompletion {
  id          String          @id @default(cuid())
  memberId    String
  exerciseId  String
  code        String
  completedAt DateTime        @default(now())
  member      ProgramMember   @relation(fields: [memberId], references: [id], onDelete: Cascade)
  exercise    ProgramExercise @relation(fields: [exerciseId], references: [id], onDelete: Cascade)
  @@unique([memberId, exerciseId])
}

model ProgramCommitDay {
  id          String        @id @default(cuid())
  memberId    String
  date        DateTime      @db.Date
  commitCount Int           @default(0)
  member      ProgramMember @relation(fields: [memberId], references: [id], onDelete: Cascade)
  @@unique([memberId, date])
}

model ProgramProject {
  id           String               @id @default(cuid())
  memberId     String
  moduleNumber Int
  repoUrl      String
  writeup      String
  status       ProgramProjectStatus @default(SUBMITTED)
  aiScore      Int?
  aiFeedback   String?
  aiRubricJson Json?
  adminScore   Int?
  submittedAt  DateTime             @default(now())
  gradedAt     DateTime?
  member       ProgramMember        @relation(fields: [memberId], references: [id], onDelete: Cascade)
  @@unique([memberId, moduleNumber])
}

model ProgramInterview {
  id           String                 @id @default(cuid())
  memberId     String                 @unique
  status       ProgramInterviewStatus @default(NOT_STARTED)
  startedAt    DateTime?
  endedAt      DateTime?
  durationSec  Int?
  transcript   Json?
  commScore    Int?
  techScore    Int?
  problemScore Int?
  overallScore Int?                   // NOT part of totalScore
  summary      String?
  evaluatedAt  DateTime?
  resetCount   Int                    @default(0)
  member       ProgramMember          @relation(fields: [memberId], references: [id], onDelete: Cascade)
}

model RecruiterProfile {
  id                String    @id @default(cuid())
  userId            String    @unique
  fullName          String
  company           String
  phone             String?
  approved          Boolean   @default(false)
  approvedAt        DateTime?
  approvedByAdminId String?
  createdAt         DateTime  @default(now())
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model RecruiterShortlistItem {
  id              String        @id @default(cuid())
  recruiterUserId String
  memberId        String
  note            String?
  createdAt       DateTime      @default(now())
  recruiter       User          @relation(fields: [recruiterUserId], references: [id], onDelete: Cascade)
  member          ProgramMember @relation(fields: [memberId], references: [id], onDelete: Cascade)
  @@unique([recruiterUserId, memberId])
}
```

`User` gains relations: `programMembers ProgramMember[]`,
`programEntryAttempts ProgramEntryAttempt[]`, `recruiterProfile RecruiterProfile?`,
`shortlistItems RecruiterShortlistItem[]`.

## 5. Scoring specification (single source of truth — max 1000 pts)

| Component | Formula | Max |
|---|---|---|
| Daily Missions | 12 pts per mission on first PASS (verification runs are unlimited — iterating is the point). Skipped day = 0. | 30 × 12 = **360** |
| Concept checks | 3 MCQs per day, 1 pt each, single attempt, no gate | 30 × 3 = **90** |
| Commit consistency | 5 pts per IST day with ≥1 commit in the program repo between `startsAt` and `min(now, endsAt)` | 30 × 5 = **150** |
| Module projects (Boss Builds) | AI-graded 0–100; `effectiveScore = adminScore ?? aiScore` | 4 × 100 = **400** |
| **Total** | denormalized on `ProgramMember.totalScore` via `recomputeMemberScore` (missionPoints + conceptPoints + commitPoints + projectPoints) inside every awarding transaction | **1000** |

- `cleanPassCount` (missions passed on verification run #1) is tracked and shown as a
  quality signal to recruiters — it does NOT add points.
- Practice Arena exercises: unscored (engagement signal only).
- Interview: separate 0–100 signal, never in `totalScore`.
- Leaderboard sort: `totalScore DESC, projectPoints DESC, missionPoints DESC, enrolledAt ASC`.
- **Hard end date:** after `cohort.endsAt` (IST) all mission runs, concept checks,
  project submissions are rejected server-side; scores freeze.

## 6. Progression rules (mission-gated, "iterate until green")

- Day 1 unlocked at enrollment. **Passing day N's mission** immediately unlocks day
  N+1 (same transaction). The concept check never gates.
- Verification runs are **unlimited** — a mission is a build, not an exam. Every run
  is stored as a `ProgramMissionSubmission` with its per-check verdict (the attempt
  history itself becomes recruiter-visible signal).
- **Skip tokens:** each member has 2. Using one marks the day `SKIPPED` (0 mission
  points, concept check still allowed), unlocks the next day, and is irreversible.
  Self-serve unstick mechanism; admin `adminUnlockDay` remains the escape hatch beyond
  that.
- Members can be behind the cohort calendar day — expected, visible (at-risk = stuck
  >2 days on the same mission, or behind by >2 days, or 0 commits in last 5 days).
- All IST math via `lib/date-utils.ts`.

## 6b. Mission types & verification (the heart of the product)

Every day is ONE mission of one of these types. `ProgramDay.missionSpec` (Json,
**server-only**) holds the verification spec; `assetsJson` holds client-safe materials.

| Type | Days (typical) | The member does | Verification (server-authoritative) |
|---|---|---|---|
| **CODE_SPRINT** | most M1/M2 days | Solves a scenario coding task in the Workbench (Python/SQL/JS) against provided data; runs visible checks locally | Client runs the day's **hidden test inputs** (fetched at submit time) and submits outputs; server compares against `missionSpec.hiddenTests[].expected` (normalized). Visible tests are UX; hidden tests are the verdict. |
| **SHIP_IT** | infra days (Docker, K8s, FastAPI, MCP server) | Builds a real artifact and pushes it to their program GitHub repo at a specified path | Server fetches the repo via GitHub API and runs `missionSpec.repoChecks[]`: file-exists, regex/content-includes, min-line-count, JSON/YAML-parses. Each check maps to a named CI line. |
| **DATA_ROOM** | analysis days | Investigates a provided dataset (in Workbench or their own tools) and submits precise answers ("How many orders exceed ₹50k?", "Which vendor has the worst SLA?") | Exact/tolerance match against `missionSpec.answers[]` (numeric tolerance, case-insensitive strings). Deterministic, mobile-friendly. |
| **PROMPT_FORGE** | M3/M4 LLM days | Writes a system prompt / agent instruction to satisfy a spec ("extract these fields", "refuse out-of-scope", "route these intents") | Server runs the member's prompt against `missionSpec.evalCases[]` on the Anthropic API (claude-sonnet-5, bounded tokens); deterministic assertions on outputs (contains/JSON-field/refusal), plus an LLM-judge criterion where needed. The flagship interactive feature. |
| **BOSS_BUILD** | days 7/14/21/30 | The module project (see 029) — day passes when the project is SUBMITTED (grading is async) | Submission validation only; AI grading per 029. |

Verification contract (implemented in 027): `verifyMission(day, payload) →
{ passed, verdict: [{check, passed, detail}] }` — pure per type, transactional award
around it. The UI renders `verdict` as CI-style check lines (✓/✗ + detail), which is
the product's signature interaction.

## 7. Entry assessment rules

- 20 questions: 10 random `APTITUDE` + 10 random `TECHNICAL` from active bank (≥30/section).
- **25 minutes**, server-enforced (client timer cosmetic).
- Pass = total ≥ 12/20 AND technical ≥ 5/10.
- Max 2 attempts; attempt 2 unlocks 24 h after attempt 1 `submittedAt`.
- Pass → `ENROLLED` if capacity allows (transactional count) else `WAITLISTED`.

## 8. External services & env vars (all server-only, never `NEXT_PUBLIC_`)

| Var | Used by | Notes |
|---|---|---|
| `ENABLE_PROGRAM` | all program routes | feature flag |
| `GITHUB_API_TOKEN` | commits cron (028) + SHIP_IT verification (027) + project grading (029) | classic PAT, public-repo read |
| `CRON_SECRET` | `/api/cron/*` (028) | bearer check |
| `ANTHROPIC_API_KEY` | PROMPT_FORGE verification (027), grading + mentor + recs (029), interview evaluation (030) | `PROGRAM_ANTHROPIC_MODEL` default `claude-sonnet-5` |
| `OPENAI_API_KEY` | voice interview (030) | browser sees only ephemeral secrets |

`vercel.json` (028): one daily cron `30 19 * * *` UTC (01:00 IST).
Note: `src/lib/anthropic.ts` now ships in **026** (PROMPT_FORGE needs it) — 029 reuses it.

## 9. Cross-cutting guardrails (apply to EVERY plan in this series)

1. **Edge safety:** `middleware.ts` gets ONLY new path strings; no imports.
2. **Login redirect exception (024):** `from` starting `/program` or `/talent` skips
   the student `/register` redirect. Never regress.
3. Student surfaces untouched; program members invisible to student leaderboards.
4. Do NOT touch `src/features/recruiter/` (RecruiterReview share reports).
5. Result envelope, Zod at every boundary, `select` on every query, transactions for
   multi-step writes, `lib/logger.ts`.
6. `buttonVariants` on `<Link>`; never `<Button asChild>`.
7. AI keys server-side only; every AI call try/caught and degrades gracefully.
8. **`missionSpec` is server-only** — it contains answers/hidden tests. It must never
   appear in any client component prop, serialized page payload, or action response.
   `assetsJson` is the ONLY client-safe day asset field.
9. Phone numbers and entry-attempt details never reach recruiters.
10. `ENABLE_PROGRAM` unset → every `/program` and `/talent` route `notFound()`.

## 10. Experience bar ("professional and interactive" — owner directive)

Applies to every UI plan (026, 027, 031 especially):
- The Workbench is the signature surface: split brief/editor/console panes, CI-style
  check list with staggered pass animation, terminal aesthetic for output, keyboard
  Run shortcut (Ctrl/Cmd+Enter). Passing a mission fires the existing `canvas-confetti`
  once, with a "Day N cleared — Day N+1 unlocked" banner.
- Dashboard reads like mission control: campaign-map module path, score trajectory,
  behind-by state framed constructively ("2 days to catch up"), streak of clean passes.
- Motion via `framer-motion` (already a dep) — subtle, 150–250 ms, no bounce; respect
  `prefers-reduced-motion`.
- Dark-mode-first for the Workbench (both themes still supported site-wide).
- Empty/loading/error states designed, never default browser text. Mobile (390px)
  always usable: DATA_ROOM/SHIP_IT/concept checks fully; CODE_SPRINT shows a
  "best on desktop" banner but remains functional.

## 11. Verification ladder (every plan ends with)

`npx tsc --noEmit` clean → `npm run build` clean → manual flows per plan →
`docs/project-context.md` updated when the phase actually ships.
