# ABTalks — Project Context Document

> **Purpose of this file:** Single-source-of-truth context to start fresh chats. Paste this at the beginning of any new conversation so the AI has full project context.

> **Last updated:** 2026-08-05, reconciled against commit `519cc34` (master). Covers everything logged under `## Pending reconcile` in `docs/CHANGELOG.md` through 2026-08-04.

---

## 1. What is ABTalks

Originally a 60-day coding challenge platform built around Anil Bajpai's community of recruiters and students. It has since grown into a **multi-track platform** with four distinct products sharing one auth + admin spine:

1. **60-Day Challenge** — daily tasks across SE / DS / AI / CLAUDE, GitHub + LinkedIn proof of work, streaks, leaderboard, certificates.
2. **AI Cohort Program** (`/program`, formerly "B2B AI Mastery") — a 31-day cohort for working professionals with server-verified Daily Missions, GitHub commit tracking, AI-graded projects, an exit voice interview, and a recruiter talent portal (`/talent`).
3. **Hackathon** (`/hackathon`) — solo/team registration with share-link attribution and a participant dashboard.
4. **Workshops & AI Cohort applications** (`/ai-workshop`, `/ai-cohort-register`, `/ai-cohort-india`) — top-of-funnel webinar signups and long-form applications.

**Vision:** Public daily commitment (GitHub + LinkedIn) produces real skill and real visibility.

**Audience:** Indian college students (1st year through recent graduates), primarily mobile — plus working professionals for the Program track.

---

## 2. Hard constraints

- Solo developer, building with Cursor + Claude (Claude plans, Cursor executes)
- Free or near-free hosting (Vercel free tier, Neon free tier)
- Max scale: ~1,500 students, 100 recruiters, 1,500 daily submissions
- IST (Asia/Kolkata) for challenge day boundaries — **exception:** the Program track uses America/Chicago (see §5)
- One database for both dev and production (single Neon DB)

---

## 3. Tech stack (as deployed)

- **Framework:** Next.js 16.2.4 (App Router, TypeScript strict, Turbopack), React 19.2.4
- **Database:** PostgreSQL on Neon (single shared instance — dev and prod). `DATABASE_URL` (pooled) + `DIRECT_URL` (migrations).
- **ORM:** Prisma 6.19.3 (NOT Prisma 7 — pinned)
- **Auth:** Auth.js v5 (next-auth@beta) with split config (`auth.config.ts` edge-safe, `auth.ts` full Node)
- **Auth providers:** Google OAuth (production), Credentials (dev-only, gated by `ENABLE_DEV_AUTH=true`, plain string compare, no bcrypt)
- **Deployment:** Vercel (`abtalksapp.vercel.app`), plus a Vercel cron for program commit polling
- **Styling:** Tailwind CSS + shadcn/ui on Base UI (`@base-ui/react`), slate base
- **Fonts:** Plus Jakarta Sans (display), Inter (body); `@fontsource/dseg7-classic` for countdown displays
- **Forms:** React Hook Form + Zod 4
- **Motion:** framer-motion; `canvas-confetti` for celebrations
- **Charts:** Recharts (admin analytics)
- **Toasts:** sonner
- **Markdown:** react-markdown (program day briefs, mission content)
- **AI:** Anthropic via `lib/anthropic.ts` (project grading, AI mentor, recommendations, interview evaluation); OpenAI Realtime (WebRTC voice interview only)
- **Email:** Resend (`RESEND_API_KEY`) and Brevo (`@getbrevo/brevo`) — see `lib/email.ts`, `lib/workshop-email.ts`, `lib/hackathon-email.ts`
- **SMS/OTP:** MSG91 widget (`lib/msg91.ts`) for phone verification
- **PDF:** `pdf-lib` + `qrcode` for certificates (template overlay); `@react-pdf/renderer` for the recruiter report at `/r/[token]/pdf` (Node runtime only)
- **Supabase (residual):** `@supabase/supabase-js` still used for exactly two things — the hand-edited `workshop_config` row and the `cohort_applications` / `cohort_applications_india` tables. Everything else moved to Neon.
- **Validation:** Zod everywhere
- **Logging:** Custom `lib/logger.ts` (console wrappers, edge-safe)

**Critical:** Middleware must remain edge-safe — NO `@/lib/*` imports in `middleware.ts`. Uses only `next-auth` and `next/server`.

---

## 4. Domain model (Prisma schema)

### Auth tables (Auth.js standard)
- `User` — `email`, `password` (dev only, plaintext), `role` (STUDENT | ADMIN | RECRUITER)
- `Account`, `Session`, `VerificationToken`

### Core enums
- `Role`: STUDENT, ADMIN, **RECRUITER**
- `UserType`: STUDENT, PROFESSIONAL — a `StudentProfile` row can represent either. Distinct from `Role`.
- `Domain`: SE, DS, AI, CLAUDE (Claude AI Mastery track — synchronized cohort, see `Challenge.startsAt`). Was ML originally, renamed to DS.
- `EnrollmentStatus`: ACTIVE, COMPLETED, ABANDONED
- `SubmissionStatus`: ON_TIME, LATE

### Challenge tables
- `StudentProfile` (1:1 with User) — `userType`, `fullName`, `domain`, `skills[]`, `phone` + `phoneVerified` / `phoneVerifiedAt` (admin-only visibility), `resumeUrl`, `linkedinUrl`, `githubUsername`, `referralCode` (unique), `isReadyForInterview`, **`synergyPoints`** (denormalized SP balance). Student-only: `college`, `graduationYear`. Professional-only: `organization`, `role`, `yearsExperience`. Campus-ambassador: `isCampusAmbassadorCandidate`, `ambassadorAppliedAt`, `ambassadorDismissedAt`.
- `Challenge` — one per Domain, `totalDays = 60`. Optional `startsAt: DateTime?` — when set (CLAUDE), the reference start is `max(startsAt, enrollment.startedAt)`; null = rolling start (SE/DS/AI).
- `DailyTask` — 1–60 per Challenge: `problemStatement`, `learningObjectives`, `resources`, `difficulty`, `estimatedMinutes`, `linkedinTemplate` (`{{github_link}}` placeholder), `solutionApproach` (admin-only), `tags`, `dayContent` (Json?) for rich CLAUDE day pages.
- `Enrollment` (unique userId+challengeId) — daysCompleted, currentStreak, longestStreak, lastSubmittedDay, status, startedAt, completedAt; 0–1 `Certificate`.
- `Submission` (unique enrollmentId+dayNumber) — `githubUrl` and `linkedinUrl` are both **nullable** (proof URLs became optional when Synergy landed); `githubUrl` still globally unique when present. Has 0–1 `SynergyEvent`.
- `Quiz` (unique challengeId+weekNumber), `QuizQuestion` (10 per quiz), `QuizAttempt` (unique userId+quizId)
- `Referral` (unique referredId) — referrerId, referredId, rewardGiven
- `PhoneVerification` (unique userId) — E.164 phone, verified flag; bridges OTP done before `StudentProfile` exists

### Synergy / rewards
- `SynergyEvent` — append-only SP ledger: userId, points (+/-), type, optional submissionId (unique) / enrollmentId / dayNumber / rankAtAward / reason / createdByAdminId. **Every SP movement gets a row** — redemptions and refunds included.
- `MarketplaceItem` — slug, title, description, `costSP`, imagePath, active, sortOrder
- `Redemption` — userId, itemId, costSP + itemTitle snapshots, `status` (PENDING | SHIPPED | FULFILLED | …), shippingAddress, recipientPhone, trackingNote

### Certificates
- `Certificate` — `certificateId` (public, `ABT-XX-XXXXX`, Crockford alphabet, unique), userId, `type` (CLAUDE_CHALLENGE | HACKATHON | COHORT | WORKSHOP), `status` (ISSUED | REVOKED), `recipientName` + `domain` + `metadata` **snapshots at issue time** (never re-read from the profile), `enrollmentId` (unique, one cert per completed enrollment), revokedAt / revokedReason.

### Recruiter-facing (challenge side)
- `RecruiterReview` (unique userId) — admin-curated anonymized assessment report: `/100` scores (communication / programming / behavior) + feedback, resume sections (`skillGroups`, `education`, `certifications`, `experience`, `projects`, `achievements[]`, `languagesSpoken[]`), `codingChallenges`, strengths / areasForGrowth, `recommendation` (`RecommendationLevel`), admin-only `logistics` + `compensation`, `isPublished` + `shareToken` (unique) for the public `/r/[token]` page.
- `Job` (`JobType`: FULL_TIME | INTERNSHIP | CONTRACT | PART_TIME) and `JobApplication` (unique jobId+userId)

### Admin tables
- `AdminAction` — adminUserId, targetUserId, `actionType` (string), metadata (Json), reason, createdAt. Written by every admin mutation across all tracks, not just the 5 original student actions.
- `AdminRemark` — admin-only free-text remark history on a student (CRUD writes an `AdminAction` audit row)

### Hackathon tables (all on Neon — the Supabase `hackathon_*` tables are retired)
- `HackathonTeam` — `entryType` (SOLO | TEAM), teamName, `teamCode` (unique). Unique index on `lower(team_name)` where not null.
- `HackathonParticipant` — `userId` **globally unique** (one hackathon registration per person), teamId + `slotIndex` (unique together), isLeader, contact/college fields, `sourceSlug` (share-link attribution)
- `HackathonRemoval` — append-only removal log. The participant row is **hard-deleted** on removal (frees `userId` and the slot); this table preserves who/by whom/original `sourceSlug` so a rejoin keeps attribution. `removedByRole`: LEADER | ADMIN.
- `HackathonEvent` — singleton (id = 1), `problemStatement` for the live kickoff brief
- `HackathonLink` — named share links (`?s=<slug>`), inserted by hand / seeded

### Workshop table
- `WorkshopRegistration` — every workshop/webinar signup, **all events in one table** keyed by `eventId` (matches `WorkshopEvent.id` in `components/workshop/events-data.ts`; events stay code-defined because they carry marketing copy + Lucide icons). `userId` is **REQUIRED** — Google sign-in is mandatory, so every row belongs to a real User. Only constraint is `@@unique([eventId, userId])`: the same person is expected to register for each weekly workshop, but not twice for the same one. Row snapshots name/email/phone/role/organization/graduationYear because a workshop-only attendee has a `User` but no `StudentProfile`.

### Program tables (`/program` track, ~20 models)
Enums: `ProgramCohortStatus` (DRAFT | ENROLLING | ACTIVE | COMPLETED | ARCHIVED), `ProgramMemberStatus` (APPLIED | WAITLISTED | ENROLLED | COMPLETED | DROPPED), `ProgramLanguage` (PYTHON | SQL | JAVASCRIPT | YAML), `ProgramEntrySection`, `ProgramInterviewStatus`, `ProgramProjectStatus`, `ProgramMissionType` (CODE_SPRINT | SHIP_IT | DATA_ROOM | PROMPT_FORGE | BOSS_BUILD), `ProgramDayState` (LOCKED | AVAILABLE | PASSED | SKIPPED).

- `ProgramCohort` — name, `joinCode` (unique), startsAt / endsAt, capacity (100), status, `requiresJoinCode` (default true; false = open enrollment), `resultsPublishedAt`
- `ProgramMember` — professional profile kept **deliberately separate from `StudentProfile`** (fullName, jobRole, company, yearsExperience, education, university, …), status, scores, skip tokens, highest unlocked day
- `ProgramModule`, `ProgramDay`, `ProgramConceptQuestion`, `ProgramMissionSubmission`, `ProgramConceptAttempt`
- `ProgramEntryQuestion`, `ProgramEntryAttempt` (entry assessment — retained in schema, bypassed in product)
- `ProgramVideo`, `ProgramExercise`, `ProgramExerciseCompletion`
- `ProgramCommitDay` — one row per member per qualifying GitHub commit day
- `ProgramProject` (AI-graded module projects), `ProgramInterview` (exit voice interview + Claude evaluation)
- `RecruiterProfile`, `RecruiterShortlistItem` — the `/talent` portal

---

## 5. Business rules

### Challenge day calculation (IST)
- All challenge day boundaries in IST (Asia/Kolkata)
- Day 1 = day of the reference start in IST (`max(challenge.startsAt, enrollment.startedAt)` when synchronized; else `enrollment.startedAt`)
- `getCurrentDayNumber` in `lib/date-utils.ts` **caps at 60** — use for display, unlocking, streaks
- `getElapsedDayNumber` is **uncapped** (61+) — the only correct input for backfill / relaxation-window decisions. Using the capped version here is what broke day-60 submissions; do not use it for UI day labels either.
- CLAUDE enrollments roll from the real join date, floored at the cohort `startsAt`
- `BYPASS_DAY_LOCKS=true` bypasses challenge day-lock gating server-side (dev only)

### Submission validation
- GitHub URL must match `https://github.com/{owner}/{repo}`, be globally unique, and return HTTP 2xx on HEAD (5s timeout)
- LinkedIn URL format-only (`/posts/…` or `/feed/update/…`) — LinkedIn blocks bots
- Both proof URLs are **optional** since Synergy; a submission with neither still counts for the day but earns fewer SP

### Synergy points (SP)
- Per submission: `10` base `+ 5` if GitHub proof `+ 8` if LinkedIn proof (`features/synergy/scoring.ts`)
- Referral: `3` SP
- `StudentProfile.synergyPoints` is a denormalized balance; `SynergyEvent` is the source of truth. Never move SP without writing an event row.

### Streaks
- `currentStreak` = consecutive ON_TIME submissions ending today/yesterday; `longestStreak` = max ever reached
- Late submissions don't count; missing a day resets to 0
- Streaks / `daysCompleted` are **write-time only** (`submitDay`) — dashboard read paths must never write

### Leaderboard (per-domain)
1. daysCompleted DESC → 2. currentStreak DESC → 3. longestStreak DESC → 4. startedAt ASC. Cached 5-min TTL via `unstable_cache`.
- Immutable content (daily tasks, `Challenge.startsAt`) cached via `unstable_cache` tags `daily-tasks:<challengeId>` / `challenge:CLAUDE`, busted on reseed/redeploy.

### Certificates
- Claude Challenge certificate issues when there is a **Day 60 submission AND `daysCompleted >= 50`** — deliberately not gated on `EnrollmentStatus.COMPLETED`
- ID format `ABT-XX-XXXXX` (CC / HK / CH / WS per type), Crockford alphabet (no 0/O/1/I/L)
- Rendered by overlaying `pdf-lib` text + QR onto a template PDF in `public/certificates/` (mtime-busted cache). `CERTIFICATE_TEMPLATE_URL` / `CERTIFICATE_TEMPLATE_PATH` optionally override with a no-store fetch.
- Public verification at `/verify/[certificateId]`, download at `/verify/[certificateId]/download`

### Marketplace
- Redeem spends SP inside a transaction: balance check → `Redemption` row → negative `SynergyEvent`. Refund is the mirror image (also a `SynergyEvent`).
- Catalog `costSP` currently 1800 SP across `marketplace.json`

### Quiz availability
- Only the CURRENT week's quiz is shown; `currentWeek = Math.min(Math.floor(daysCompleted / 7), 8)`
- Already-attempted → show score; not seeded → show nothing; past attempts in "Quiz History"

### Referrals
- 6-char uppercase alphanumeric code per StudentProfile; reward at referred user's Day 7
- Persisted via `abtalks_ref` httpOnly cookie (7 days, set in middleware)
- Badges: bronze (1), silver (5), gold (10), platinum (25)

### Hackathon
- Solo or team entry; team joined by `teamCode`; duplicate team names blocked case-insensitively
- Registration requires a Google session; one participant row per user globally
- Share-link attribution: `?s=<slug>` → `abtalks_src` httpOnly cookie, **first touch wins**, 30 days, copied to `HackathonParticipant.sourceSlug`
- Removal hard-deletes the participant and writes a `HackathonRemoval` row (leader or admin); rejoin re-uses the preserved `sourceSlug`
- A logged-in user with a hackathon registration but no `StudentProfile` is diverted to `/hackathon/dashboard` (not `/register`) from `/`, `/dashboard` and `/login`

### Workshop
- Page public, **form session-gated**: the event is resolved server-side from the IST day key, never from the client; email comes from the session
- `P2002` on `[eventId, userId]` → friendly duplicate message; confirmation email failure is logged and swallowed

### Program (AI Cohort) — differs from the challenge on purpose
- **Timezone: America/Chicago**, not IST. Day unlock uses the Chicago cohort calendar with a sequential gate (no unlock-on-pass); admin `highestUnlockedDay` is a floor override. Calendar-key math is UTC-based (`addCalendarDaysToKey`) so the Chicago reformat doesn't drop day 0.
- 31 days total (`PROGRAM_TOTAL_DAYS`), max score 1020 = 372 mission + 93 concept + 155 commit + 400 project
- New ENROLLED members **start at Day 4**; Days 1–3 are waived as PASSED with mission points (`npm run db:bootstrap:program-start-day` backfills existing members)
- 5 server-verified mission types: CODE_SPRINT (hidden outputs), SHIP_IT (GitHub repo checks — file existence only; content/minLines/notebook checks gated off), DATA_ROOM (answers), PROMPT_FORGE (Anthropic eval cases), BOSS_BUILD (project submit). Unlimited runs, 15s spacing, 30/day cap. Pass unlocks the next day (+12 mission pts; `cleanPassCount` when passed on attempt #1).
- Skip tokens (2, after ≥3 fails) are **disabled for members** currently; concept checks and the entry assessment are **bypassed** (`isProgramEntryBypassEnabled()` returns true unconditionally) — apply enrolls or waitlists directly
- Commit tracking: daily Vercel cron polls GitHub per member repo; `commitPoints = 5 × qualifying ProgramCommitDay rows` (cap 150), preserving the existing floor via `Math.max` so seeded days aren't wiped. Commit UI is archived on Mission Control (`PROGRAM_COMMIT_UI_ENABLED = false`); backend retained.
- At-risk = behind >2 days, stuck on a mission >2 IST days, or 0 commits in the last 5 days
- Exit voice interview: one 15-min OpenAI Realtime WebRTC session per member, unlocked on Day 31 progress or cohort end; server-minted ephemeral secret at `POST /api/program/interview/session`; transcript stored then Claude-evaluated (comm / tech / problem / overall + summary), scored separately from `totalScore`; max 2 member restarts; admin can reset / re-evaluate
- AI layer: admin-triggered Claude project grading (rubrics.json + GitHub context, admin override → AdminAction); member-triggered AI Mentor review (one per passed mission/day); batch recommendations with 7-day TTL; `projectPoints` recomputed idempotently via `recomputeMemberScore`
- Recruiter portal `/talent`: Google sign-in + company profile, admin approval, pool gated on `cohort.resultsPublishedAt`; ranked profiles with mission portfolio, projects, interview summary, private shortlists. **Member phone / entry details are never exposed.**
- `missionSpec` is server-only; `assetsJson` is the only client-safe day asset

### Phone OTP
- MSG91 OTP required in production; **skipped under `next dev`** (`isOtpVerificationRequired()` returns false when `NODE_ENV === "development"`)
- `OTP_DEV_BYPASS=true` + `OTP_DEV_CODE` (default `1234`) for non-dev-mode local/CI runs

### Admin actions
- Original 5 student actions: markDayComplete (`admin-marked://` URL), resetProgress, toggleReadyForInterview, removeFromChallenge (soft → ABANDONED), rejectSubmission
- Plus hackathon, program, recruiter, redemption, job, remark and link admin mutations — **all wrapped in a transaction with an `AdminAction` audit row**, surfaced in the paginated `/admin/actions` feed

---

## 6. Authentication architecture

### Two auth modes
- **Production (Vercel):** Google OAuth only. `ENABLE_DEV_AUTH` not set.
- **Local dev:** Google OAuth (if configured) AND Credentials (email + plaintext password).
- Dev credentials login always navigates **same-origin** (ignores the `AUTH_URL` host in `result.url`) so LAN/phone testing works; local `AUTH_URL` is optional when `trustHost` is on. `allowedDevOrigins` auto-includes LAN IPv4s so Next 16 serves `/_next` on the Network URL.

### Auth.js v5 split config
- `src/auth.config.ts` — minimal, edge-safe (no Prisma, no `@/lib/*`). Used by middleware.
- `src/auth.ts` — PrismaAdapter + real Credentials authorize. Used everywhere else.
- Required because Vercel middleware runs in Edge Runtime with a 1 MB bundle limit.

### Session strategy
- JWT sessions (stateless). `AUTH_SECRET` required, no fallback. `trustHost: true`.
- Cookies: `__Secure-authjs.session-token` (prod) / `authjs.session-token` (local)

### Authorization layers
- **Admin:** email-based via `ADMIN_EMAILS`; `requireAdmin()` in `lib/admin-auth.ts`; `session.user.isAdmin` computed in the JWT/session callback. No DB role for admin.
- **Program / recruiter:** `lib/program-auth.ts` (node-only) — `requireProgramMember` (resolved by membership, not by role) and `requireRecruiter` (DB-checked, `Role.RECRUITER` + admin approval)
- **Middleware:** path-prefix list only (`/dashboard`, `/explore`, `/challenge/`, `/profile`, `/achievements`, `/quiz`, `/register`, `/admin`, `/jobs`, `/mission`, `/program/*` app routes, `/talent`, `/hackathon/register`, `/hackathon/dashboard`) — redirects to `/login?from=…`. It also sets the `abtalks_ref` and `abtalks_src` tracking cookies on every request.

### Stale session warning
- JWT sessions don't verify the user still exists in the DB per request. Deleted users keep a valid cookie until expiry; FK violations are possible. Cleanup-script deletions require clearing cookies / incognito.

---

## 7. Routing structure

### Public
- `/` — signed-out **three-track landing hub** (`components/landing/landing-hub.tsx`). Signed-in with a profile → `/dashboard`; signed-in without a profile → hackathon dashboard if registered, else `/register`.
- `/challenges` — public 60-day challenge overview (domain picker, streak grid, FAQ)
- `/login`
- `/students/[id]` — public student profile (basic info only)
- `/claude-signup` — Claude track signup / interest page
- `/verify/[certificateId]` + `/verify/[certificateId]/download` — public certificate verification and PDF download
- `/r/[token]` + `/r/[token]/pdf` — public share link for an admin-curated recruiter assessment report
- `/ai-workshop`, `/ai-workshop/events` — workshop microsite. Page public; the **registration form requires a Google session**. Signups → Neon `WorkshopRegistration`; `workshop_config` (Zoom/WhatsApp links) still read from Supabase.
- `/ai-cohort-register` + `/apply` — AI Cohort (US) onboarding + 5-step application → Supabase `cohort_applications`
- `/ai-cohort-india` + `/apply` — India clone → Supabase `cohort_applications_india`
- `/hackathon` — hackathon landing (`/hackathon/register` and `/hackathon/dashboard` are protected)
- `/program` — program landing (gated by `ENABLE_PROGRAM`; `notFound()` when unset)

### Protected (student)
- `/register` — supports STUDENT and PROFESSIONAL `userType`, plus CLAUDE-forced mode via `?domain=CLAUDE`; auto-cleans orphaned profiles
- `/dashboard` — stats, today's task, leaderboard, heatmap, quiz card, recent activity
- `/explore` — track list / cross-track discovery
- `/challenge/today` → `/challenge/[day]` — uses `dailyTask.dayContent` when present, else legacy text fields
- `/profile`, `/quiz/[quizId]`
- `/achievements` — earned certificates
- `/mission` — community / mission page (Discord link)
- `/marketplace` — redeem SP
- `/jobs`, `/jobs/[id]` — jobs board + apply

### Protected (hackathon)
- `/hackathon/register`, `/hackathon/dashboard`

### Protected (program — all behind `ENABLE_PROGRAM`)
- `/program/apply`, `/program/assessment`
- `/program/dashboard` (Mission Control), `/program/day/[day]`, `/program/curriculum`, `/program/videos`, `/program/leaderboard`, `/program/interview`

### Protected (recruiter talent portal)
- `/talent`, `/talent/register`, `/talent/pending`, `/talent/members/[id]`, `/talent/shortlist`

### Admin (`/admin`, requires admin email)
- `/admin` — overview, live submissions feed, recent admin actions
- `/admin/students`, `/admin/students/[id]` (tabs + StudentActionPanel + remarks)
- `/admin/submissions`, `/admin/content`, `/admin/analytics`
- `/admin/actions` — paginated audit-log feed
- `/admin/campus-ambassadors`, `/admin/referrals`, `/admin/redemptions`
- `/admin/jobs`, `/admin/jobs/[id]`
- `/admin/workshop` — per-event rosters (Registrations / Analytics tabs, `?events=` filter), CSV export
- `/admin/hackathon`, `/admin/hackathon/students`, `/admin/hackathon-links`
- `/admin/ai-cohort` — Supabase cohort applications (US + India)
- `/admin/program`, `/admin/program/members`, `/admin/program/members/[id]`, `/admin/program/content`, `/admin/program/projects`, `/admin/program/interviews`, `/admin/program/recruiters`

### API routes (sparse — most logic via Server Actions)
- `/api/auth/[...nextauth]` — Auth.js handler
- `/api/claude-recent-signups` — public ticker data
- `/api/cron/program-commits` — Vercel cron, Bearer-auth via `CRON_SECRET`
- `/api/program/interview/session` — mints an OpenAI Realtime ephemeral secret

---

## 8. Server Actions (`src/app/actions/`)

**Challenge core:** `auth-actions`, `registration-actions`, `enrollment-actions`, `submission-actions`, `profile-actions`, `quiz-actions`, `referral-actions`, `otp-actions`, `synergy-actions`

**Student features:** `marketplace-actions`, `job-actions`

**Hackathon:** `hackathon-actions`, `hackathon-auth-actions`, `hackathon-team-actions`

**Workshop / cohort funnel:** `workshop-actions`, `cohort-application-actions`, `cohort-application-india-actions`

**Program:** `program-entry-actions`, `program-mission-actions`, `program-ai-actions`, `program-interview-actions`, `talent-actions`

**Recruiter (challenge side):** `recruiter-review-actions`

**Admin:** `admin-actions`, `admin-export-actions`, `admin-remark-actions`, `admin-redemption-actions`, `admin-job-actions`, `admin-recruiter-actions`, `admin-hackathon-actions`, `admin-hackathon-link-actions`, `admin-program-actions`, `admin-program-export-actions`, `campus-ambassador-actions`

All return the discriminated union `{ ok: true, data } | { ok: false, message }`.

---

## 9. Feature modules (`src/features/`)

`registration/` · `enrollment/` · `submission/` · `challenge/` · `dashboard/` · `profile/` · `quiz/` · `user/` · `synergy/` · `certificate/` · `marketplace/` · `jobs/` · `recruiter/` · `hackathon/` · `workshop/` · `program/` · `talent-pool/` · `email/` · `admin/`

Notes:
- `program/` is the largest module (missions, verify-mission, days, progression, commits, mentor, recommendations, projects, interview, leaderboard, entry, admin, bootstrap-start-day, parse-brief, constants)
- `certificate/` owns ID generation, eligibility/issue, PDF render, template source, achievements
- `workshop/` has admin data, analytics, prefill, recent registrations, registration status. `getWorkshopConfig` is **not** here — it stays in `lib/workshop-supabase.ts`.
- `recruiter/` holds the `@react-pdf/renderer` document (`recruiter-pdf.tsx`) — keep it out of client/edge bundles

---

## 10. Content management

- Challenge content: `prisma/content/problems.json`, `prisma/content/quizzes.json`, seeded via `npm run db:seed`
- Upserts on (challengeId, dayNumber) / (challengeId, weekNumber); quiz questions clean-replaced each reseed
- Program content seeded separately (`npm run db:seed:program`) — reseed after any mission-spec change
- Marketplace catalog from `marketplace.json` (`npm run db:seed:marketplace`)
- Days/weeks not in JSON render as "Day X placeholder"
- NO admin UI for challenge content editing (program content has a read view at `/admin/program/content`)

---

## 11. Seed scripts

```
npm run db:seed                    # challenge content + 10 test users (@abtalks.dev)
npm run db:seed:content            # content only
npm run db:seed:test-users         # test logins only
npm run db:seed:claude-test        # CLAUDE test users (incl. one deterministic 60/60 completed login)
npm run db:seed:program            # program cohort content / missions
npm run db:seed:program:users      # prog.*@abtalks.dev / "test" + test cohort, members, recruiters
npm run db:seed:marketplace        # marketplace catalog
npm run db:seed:hackathon-links    # named share links
npm run db:bootstrap:program-start-day   # waive Days 1–3 for existing ENROLLED/COMPLETED members
npm run db:backfill:certificates   # issue certs for already-eligible enrollments
```

Base test users (password `test`): Arjun (SE D1), Priya (DS D1), Rohan (AI D1), Sneha (SE D7 + quiz), Vikram (DS D15), Anika (SE D30), Karan (AI D45 broken streak), Meera (SE D60 COMPLETED + ready), Dhruv (SE D20 + 3 referrals), `admin@abtalks.dev` (ADMIN, password `admin`).

`SEED_ALLOW_PRODUCTION` guards seeds against a production database.

---

## 12. Cleanup & migration scripts

- `npm run db:cleanup:test | :real | :all` — delete test users / real Google users / everything (5s pause; cascades handle related rows)
- `npm run hackathon:preflight | hackathon:migrate | hackathon:verify` — the Supabase → Neon hackathon cutover (`scripts/migrate-hackathon-to-neon.ts`). Already executed; kept for reference.
- `scripts/merge-problems.mjs`, `scripts/seed-swarit-recruiter-profile.ts`

---

## 13. Environment variables

### Core
- `DATABASE_URL` — Neon pooled connection
- `DIRECT_URL` — Neon direct connection (migrations; added to fix deploy lock timeouts)
- `AUTH_SECRET` — random hex, no fallback
- `AUTH_URL` / `NEXTAUTH_URL` — site URL (optional locally when `trustHost` is on)
- `NEXT_PUBLIC_APP_URL` — same as AUTH_URL
- `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
- `ADMIN_EMAILS` — comma-separated admin emails

### Feature flags
- `ENABLE_DEV_AUTH` — Credentials provider, localhost only
- `ENABLE_CLAUDE_CHALLENGE` — Claude track visibility
- `ENABLE_PROGRAM` — gates all `/program` and `/talent` routes (`notFound()` when unset)
- `BYPASS_DAY_LOCKS` — bypass challenge/program day gating server-side (dev)
- `OTP_DEV_BYPASS`, `OTP_DEV_CODE` — skip MSG91, accept a fixed code (default `1234`)
- `SEED_ALLOW_PRODUCTION` — required to run seeds against prod

### Integrations
- `ANTHROPIC_API_KEY` (+ optional `PROGRAM_ANTHROPIC_MODEL`, default `claude-sonnet-5`) — server-only Claude JSON grading via `lib/anthropic.ts`
- `OPENAI_API_KEY` — Realtime `client_secrets` minting for the exit voice interview (server-only)
- `GITHUB_API_TOKEN` — GitHub REST for SHIP_IT verification + the commit cron
- `CRON_SECRET` — Bearer auth on `/api/cron/program-commits`
- `RESEND_API_KEY`, `BREVO_API_KEY`, `FROM_EMAIL`, `FROM_NAME` — transactional email
- `MSG91_AUTH_KEY`, `NEXT_PUBLIC_MSG91_WIDGET_ID`, `NEXT_PUBLIC_MSG91_TOKEN_AUTH` — phone OTP
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — `workshop_config` + cohort applications
- `SUPABASE_SERVICE_ROLE_KEY` — server-only; was required for the Supabase hackathon tables (now retired)
- `CERTIFICATE_TEMPLATE_URL` / `CERTIFICATE_TEMPLATE_PATH` — optional overrides for the certificate template

---

## 14. Conventions

### Code style
- TypeScript strict, no `any`
- Server Components by default; `"use client"` only when needed
- Server Actions for mutations (preferred over API routes)
- Zod validation at every boundary
- Prisma queries always use `select`; multi-step writes in transactions
- Errors via `lib/logger.ts`, never `console.error`
- Result envelope `{ ok: true, data } | { ok: false, message }` everywhere

### Routing
- Auth routes are public (no `requireRole`)
- Everything else uses `requireRole([...])` / `requireAdmin()` / `requireProgramMember()` / `requireRecruiter()`
- Logout is idempotent (fail-closed silent)

### Files
- `src/features/<domain>/` — business logic
- `src/lib/` — shared utilities (db, auth, logger, validations, date-utils, feature-flags)
- `src/app/actions/` — Server Actions
- `src/components/ui/` — shadcn primitives (don't modify)
- `src/components/<feature>/` — feature components

### Changelog discipline
Cursor appends ONE dated line to `docs/CHANGELOG.md` under `## Pending reconcile` after any schema change, new/changed business rule, new env var, or new convention — never for cosmetic changes or bug fixes. Those lines are folded into **this** document during a reconcile pass. Cursor never edits `CLAUDE.md` or `docs/project-context.md`.

---

## 15. Design system

### Typography
- Display: Plus Jakarta Sans (`font-display`) for headings; Body: Inter
- `dseg7-classic` for seven-segment countdown displays

### Colors (CSS vars in `globals.css`)
- Light: warm off-white background, pure white cards. Dark: deep blue-gray.
- Primary: indigo `239 84% 67%` (#4F46E5)
- Domain colors — AI violet `#8B5CF6`, DS cyan `#0891B2`, SE emerald `#10B981`

### UX patterns
- Cards: `rounded-xl`, soft border, subtle shadow, `hover:shadow-md`
- Buttons: NEVER `<Button asChild>` or `<Button render={<Link>}>` — use `buttonVariants` directly on the `<Link>` (Base UI is strict about button semantics)
- Theme toggle: single sun/moon button, system default; optional click sound (off by default)
- Mobile-first (390px tested)
- Program day pages use a distinct **Figma dark shell** with a `briefMd` section parser — deliberately not the challenge theme

---

## 16. Known issues / decisions parked

### Resolved (don't touch)
- Edge Runtime middleware must avoid `@/lib/*` imports → split `auth.config.ts`
- Auth.js v5 default cookie name change → `auth()` middleware pattern
- Stale Prisma client after `node_modules` delete → `npx prisma generate`
- Postgres enum rename ML → DS via `ALTER TYPE RENAME VALUE`
- FK violation when User deleted but session still valid → clear cookies
- `<Button render={<Link>}>` Base UI nativeButton warning → `buttonVariants`
- Deploy lock timeouts on migrate → added `DIRECT_URL`
- Day 60 not submittable → use uncapped `getElapsedDayNumber` for backfill/relaxation
- Chicago reformat dropping commit day 0 → UTC calendar-key math
- Dead login form over LAN IP → `allowedDevOrigins` includes LAN IPv4s

### Cleanup candidates spotted during this reconcile
- `src/lib/hackathon-supabase.ts` has **no importers** — dead since the Neon cutover; the same is true of `SUPABASE_SERVICE_ROLE_KEY`'s only documented purpose
- `StudentProfile.phoneVerified*` + `PhoneVerification` were noted as "unused" when MSG91 was removed on 2026-07-21, then OTP was restored on 2026-07-27 — they are live again, but the OTP surface is skipped in dev
- `ProgramEntryQuestion` / `ProgramEntryAttempt` and the skip-token machinery remain in the schema while bypassed in product

### Deferred / not built
- Resume **upload** (binary, Vercel Blob) — only the URL field exists
- Admin UI for challenge content CRUD
- Plagiarism detection beyond global URL uniqueness
- Rate limiting on auth/submission endpoints
- Email verification (Google handles OAuth users)
- Heatmap cells clickable to view a past day's problem
- Logo scroll animation (ABTalks → AB collapse)

### Security TODOs
- No rate limiting on auth or submission endpoints
- No email verification for any flow
- No password policy beyond min 8 chars
- No CSRF tokens beyond Next.js defaults
- No content security policy headers
- No automated session invalidation on user deletion

---

## 17. Working with Cursor — guardrails

### Before any DB-touching change
1. `git add -A && git commit -m "checkpoint before X"`
2. Create a Neon branch as a snapshot
3. Note the commit hash

### Cursor failure modes observed
- Adds `requireRole` to public routes (logout, login) — mark exceptions explicitly
- Confuses Server vs Client boundaries when passing props (Lucide icons, functions)
- Defends wrong choices when build errors contradict its model (jose subpath import)
- Over-engineers (new files for trivial logic)
- Misses transitive imports causing Edge bundle violations
- Sometimes silently fails to apply file changes

### Working pattern
Small scoped prompts → explicit "do NOT" lists → Cursor reports back → you verify → manually test → commit per task. On breakage, gather data (logs, file contents, exact error) before fixing.

---

## 18. Current state

### Live and working
- Auth (Google OAuth + dev credentials), registration (STUDENT / PROFESSIONAL / CLAUDE-forced)
- 60-Day Challenge: dashboard, day pages, submissions with optional proofs, streaks, leaderboard, heatmap, quizzes, profile, referrals, Synergy points
- Certificates: issue, achievements page, public verification + PDF download
- Marketplace (SP redemption) and Jobs board
- Hackathon: landing, solo/team registration, dashboard, share-link attribution, member removal
- Workshops: microsite, session-gated registration on Neon, admin rosters + analytics
- AI Cohort applications (US + India) on Supabase, admin viewer
- Program (`/program`): apply, Mission Control, day pages, missions, commits cron, AI grading/mentor/recommendations, exit voice interview, leaderboard
- Recruiter surfaces: `/talent` portal (program) and `/r/[token]` assessment reports + PDF (challenge)
- Admin: 20+ pages spanning students, submissions, content, analytics, actions feed, referrals, redemptions, jobs, workshop, hackathon, ai-cohort, program
- Production deployment on Vercel

### Not yet built
- Full real Day 1–60 content for SE / DS / AI (placeholders remain where JSON is missing)
- Resume upload (binary)

### Next priorities
Driven by whichever track is actively launching. Check `docs/plans/` for the newest numbered plans — `052`–`054` (workshop → Neon + auth) are the most recent completed work.

---

## 19. How to use this document in new chats

Paste this entire document at the start of a new chat with:

> "I'm working on a project called ABTalks. Read this context document carefully before we start. After reading, just say 'Context loaded' and ask me what I want to work on."

---

## 20. Document maintenance

Update this document when:
- A major feature ships
- A core decision changes (tech stack, business rule, scope)
- Schema changes
- New env vars added
- New conventions adopted

Don't update for tiny bug fixes, cosmetic changes, or routine commits.

**Reconcile pass:** read `docs/CHANGELOG.md` → `## Pending reconcile`, fold every line into the right section here, then clear that list and note the reconciled-through date at the top of this file. The doc should reflect architecture and decisions, not every line of code.
