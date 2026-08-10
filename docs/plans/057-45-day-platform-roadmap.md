# 057 — 45-Day Platform Roadmap: Hiring, Profiles, Podcast Connect, UX

> **Type:** Internal planning doc (roadmap), not a Cursor-executable plan.
> This doc locks scope, architecture, ownership and dates. Each workstream below
> lists the numbered plan files (058+) that must still be written using the plan
> template in `CLAUDE.md` before Cursor touches any code.
>
> **Window:** 2026-08-08 → 2026-09-21 (45 days)
> **Team:** Sohail (lead), Shivansh (senior), Suyash (junior), Shashank (junior)
> **Author:** Claude (architect) · **Owner:** Sohail
> **Status:** Draft — 6 decisions still open (§10)

---

## 1. Why this exists

ABTalks currently proves a student did the work (streaks, submissions, certificates,
SP). It does **not** yet close the loop that the whole platform promises: *a recruiter
finds that student and hires them.* Today the only recruiter surfaces are `/talent`
(program cohort members only, gated on `cohort.resultsPublishedAt`) and `/r/[token]`
(a hand-curated report an admin makes one student at a time). Neither scales, and
neither can see a 60-Day Challenge student or a hackathon participant.

Four workstreams close that loop and make the platform look like a product rather
than four microsites sharing a login:

| # | Workstream | One-line outcome |
|---|---|---|
| **W1** | Unified recruiter portal (`/hire`) | Any approved recruiter can search every opted-in candidate across all four tracks, shortlist, and post jobs. |
| **W2** | Profile completeness + job matching | Students are pushed to a complete profile because completeness is what makes them visible and matchable. |
| **W3** | Podcast Connect (SP burn) | Students spend Synergy Points to request time with podcast guests — the first real SP sink besides merch. |
| **W4** | Flow, navigation, analytics | One coherent IA across four tracks, plus first-party funnel data so we stop guessing. |

W1 and W2 are one product: a recruiter portal with nothing to search is worthless, and
profile completion has no teeth unless it controls visibility. Build them together.

---

## 2. Scope and non-goals

### In scope
- Cross-track candidate index and search, opt-in visibility, shortlists, contact reveal with audit.
- Recruiter-posted jobs with admin approval; deterministic candidate↔job matching.
- Profile completeness scoring, gating, nudges, and an SP reward.
- Podcast guest directory, SP-burning connect requests, admin-mediated scheduling.
- Navigation/IA consolidation, persona-aware shells, onboarding checklist, empty states.
- First-party analytics event pipeline + funnel views in `/admin/analytics`.

### Explicitly NOT in scope (do not let these creep in)
- Payments / recruiter subscriptions. Build the seam (`RecruiterProfile.plan` nullable), not the feature.
- Resume **upload** (binary/Vercel Blob). URL field only, as today. (Long-parked; still parked.)
- In-app chat/DM between recruiter and candidate. Contact reveal only, admin-auditable.
- AI-scored candidate ranking. v1 matching is deterministic and explainable. AI later.
- Migrating `/talent` (program cohort pool) into `/hire`. They coexist; see AD-2.
- Rewriting the challenge/program day UIs.

---

## 3. Architecture decisions (locked unless Sohail overrules)

**AD-1 — One candidate index, not a 3-way join.**
Candidates live in three incompatible shapes: `StudentProfile` (challenge/professional),
`ProgramMember` (deliberately separate, per project context §4), and
`HackathonParticipant` (registration-only, may have no `StudentProfile`). Searching,
filtering and ranking across all three at query time means a heterogeneous union with no
stable sort — it will be slow and it will be wrong.

Instead: a new `TalentCandidate` table keyed by `userId @unique`, holding **(a)** the
student's opt-in and hiring preferences and **(b)** a denormalized, searchable snapshot
of the fields recruiters filter on (name, headline, skills[], domain, tracks[], college,
gradYear, yearsExperience, city, completion score, activity signals). One indexed table,
one sort. Precedent already exists in this codebase: `StudentProfile.synergyPoints` is a
denormalized balance and `Certificate` snapshots its recipient fields.

Snapshot is refreshed by one function, `syncTalentCandidate(userId)`, called from exactly
three places: profile save, submission write, and a nightly cron. Never inline anywhere else.

**AD-2 — `/hire` is a new portal; `/talent` stays.**
`/talent` is welded to `ProgramCohort` (`resultsPublishedAt` gating,
`RecruiterShortlistItem.memberId → ProgramMember`) and gated behind `ENABLE_PROGRAM`.
Retrofitting it to cross-track is a rewrite disguised as a refactor. Build `/hire` fresh
against `TalentCandidate`; link to `/talent` from `/hire` as a "AI Cohort pool" tab.
`RecruiterProfile` is the **shared** recruiter identity across both — one registration,
one approval. New shortlists use a new `CandidateShortlistItem` FK'd to `User`.

**AD-3 — Visibility is student-controlled, not admin-controlled.**
`StudentProfile.isReadyForInterview` is flipped **only by an admin**
(`admin-actions.ts:toggleReadyForInterview`) and is reset on `resetProgress`. It is an
admin's assessment flag and must keep that meaning. The new `TalentCandidate.openToWork`
is the student's own consent to be listed. Both are shown to recruiters; only `openToWork`
controls listing. **Never** list a candidate who has not set `openToWork = true`.

**AD-4 — Completeness is one pure function.**
`computeProfileCompletion(profile) → { score, missing[] }` lives in
`features/profile/completion.ts`, takes a plain object, imports no Prisma, and is the
single source of the number. Stored denormalized as `StudentProfile.profileCompletion`.
UI never recomputes it client-side; it renders what the server sends.

**AD-5 — Matching is deterministic in v1.**
`scoreMatch(candidate, job) → { score, reasons[] }`, pure, unit-testable, weights in one
const block. Recruiters and students both see the same score and the same `reasons[]`.
No Anthropic call in the matching path — it would cost money per search, be
non-reproducible, and be unexplainable to a recruiter asking "why this person?".

**AD-6 — Every SP movement writes a `SynergyEvent`. No exceptions.**
Podcast Connect burns SP. It mirrors `features/marketplace/redeem-item.ts` exactly:
one `prisma.$transaction` → balance check → request row → **negative** `SynergyEvent` →
decrement `StudentProfile.synergyPoints`. Refunds are the mirror image with a **positive**
event. There is no code path that writes `synergyPoints` without an event row in the same
transaction. This is the one rule in this doc that is never bent.

**AD-7 — Analytics is first-party + Vercel, server-side.**
No analytics package is installed today. Add `@vercel/analytics` for page-level traffic
(free tier), plus a first-party `AnalyticsEvent` table for the funnels we actually need
to answer questions about. A `track()` helper in `lib/analytics.ts` is fire-and-forget:
it never throws, never blocks, never fails a Server Action. Event names come from a
`const` union — free-form strings will rot within a month. **No PII in `props`.**

---

## 4. W1 — Unified recruiter portal (`/hire`)

**Goal:** an approved recruiter logs in, searches opted-in candidates across the 60-Day
Challenge, AI Cohort, Hackathon and Workshop tracks, filters by skill/domain/college/year,
opens a proof-of-work profile, shortlists, reveals contact, and posts a job.

### Current behavior
- `RecruiterProfile` (userId, fullName, company, phone, approved) + `Role.RECRUITER`; approval by admin at `/admin/program/recruiters`.
- `requireRecruiter()` in `lib/program-auth.ts` — DB-checked, redirects to `/talent/pending`.
- `registerRecruiter()` **rejects any account that has a `StudentProfile`** ("use a separate Google account").
- `/talent` pool = `ProgramMember` only, gated on a published cohort.
- `Job` is admin-created (`createdByAdminId`), `JobApplication` unique on (jobId, userId).
- `/r/[token]` = admin-curated `RecruiterReview` + PDF. Unrelated surface; leave alone.

### Data model (new)
```
TalentCandidate            userId @unique → User
  openToWork Boolean       // student's consent — the visibility switch
  openToWorkAt DateTime?
  headline String?         // "Final-year CSE · Python, ML"
  roleTypes String[]       // INTERNSHIP | FULL_TIME | CONTRACT | PART_TIME
  locations String[]       // city names + "REMOTE"
  availableFrom DateTime?
  noticeDays Int?
  -- denormalized snapshot (written only by syncTalentCandidate) --
  fullName, domain, skills[], college, graduationYear, yearsExperience,
  tracks String[]          // CHALLENGE | PROGRAM | HACKATHON | WORKSHOP
  profileCompletion Int, synergyPoints Int, daysCompleted Int, longestStreak Int,
  hasCertificate Boolean, lastActiveAt DateTime?, syncedAt DateTime
  @@index([openToWork, profileCompletion(sort: Desc)])
  @@index([openToWork, domain])

CandidateShortlistItem     recruiterUserId + candidateUserId @@unique, note, createdAt
RecruiterViewEvent         recruiterUserId, candidateUserId, kind (VIEW|CONTACT_REVEAL), createdAt
```
`Job` gains: `postedByUserId String?`, `status JobStatus (DRAFT|PENDING_REVIEW|OPEN|CLOSED)`,
`skills String[]`, `domains Domain[]`, `minCompletion Int @default(0)`, `location`/`type`
already exist. `createdByAdminId` becomes nullable and stays for legacy rows — do not
backfill-delete it.

### Surfaces
| Route | Component type | Guard |
|---|---|---|
| `/hire` | Server — public marketing + "Register to hire" CTA | public |
| `/hire/candidates` | Server (list) + Client (filter bar) | `requireRecruiter()` |
| `/hire/candidates/[userId]` | Server | `requireRecruiter()` |
| `/hire/shortlist` | Server | `requireRecruiter()` |
| `/hire/jobs`, `/hire/jobs/new`, `/hire/jobs/[id]` | Server + Client form | `requireRecruiter()` |
| `/hire/jobs/[id]/matches` | Server | `requireRecruiter()` |
| `/admin/hire` | Server | `requireAdmin()` — recruiter approvals, job approvals, view audit |

Middleware `protectedPaths` gains `/hire/candidates`, `/hire/shortlist`, `/hire/jobs`
(**not** bare `/hire` — it is the public marketing page).

### Business rules
1. Listing requires **all** of: `openToWork = true`, `profileCompletion >= 70`, account not removed/abandoned-only.
2. Phone is **never** returned to a recruiter. Email is revealed only via an explicit "Reveal contact" action that writes a `RecruiterViewEvent` — capped at 25 reveals/recruiter/day.
3. Profile opens write a `VIEW` event. Students see "N recruiters viewed your profile this week" — this is the strongest possible nudge for W2, and it is free.
4. Recruiter-posted jobs start `PENDING_REVIEW`; an admin flips to `OPEN`. Nothing a recruiter types is publicly visible before approval.
5. Every admin mutation here (approve recruiter, approve job, hide candidate) wraps in a transaction with an `AdminAction` audit row — the existing convention, no exceptions.
6. `registerRecruiter()`'s "no StudentProfile" rule is retained for now (see open decision D2).

### Risks
- **Privacy is the whole ballgame.** These are college students. An unlisted-by-default,
  opt-in, phone-never-exposed, audit-logged design is not optional polish — it is the
  feature. Any shortcut here is the one that ends up on LinkedIn.
- Empty-portal problem: a recruiter who lands on 6 candidates never returns. Do not open
  `/hire` to real recruiters until ≥150 candidates are opted-in (see §7 launch gate).

### Plans to write
- `058-talent-candidate-index.md` — schema, `syncTalentCandidate`, backfill script. *(Sohail)*
- `059-hire-portal-search.md` — `/hire` routes, search/filter, profile page, shortlist. *(Sohail + Suyash)*
- `060-recruiter-jobs-and-approval.md` — Job model changes, posting flow, admin approval. *(Shivansh)*
- `064-contact-reveal-and-audit.md` — reveal action, caps, `RecruiterViewEvent`, student-facing view counts. *(Shivansh)*

---

## 5. W2 — Profile completeness + matching

**Goal:** make a complete profile the obvious thing to do, because completeness is what
gets you seen and matched.

### Current behavior
`/profile` is a plain form (`profile-form.tsx` + `features/profile/update-profile.ts`,
Zod-validated per `userType`). Nothing tells a student their profile is thin; nothing
rewards finishing it. `skills[]`, `resumeUrl`, `linkedinUrl`, `githubUsername` are all
optional and frequently empty.

### Scoring (locked — one const block in `features/profile/completion.ts`)
| Item | Pts |
|---|---|
| Core identity (name, domain, userType) — auto at registration | 10 |
| Phone verified (`phoneVerified`) | 10 |
| College + graduation year *(or* organization + years experience *for PROFESSIONAL)* | 10 |
| Skills ≥ 5 | 15 |
| GitHub username | 10 |
| LinkedIn URL | 10 |
| Resume URL | 15 |
| Headline (new, ≤ 90 chars) | 10 |
| Hiring preferences set (roleTypes + locations) | 10 |
| **Total** | **100** |

### Mechanics
- Stored as `StudentProfile.profileCompletion`; recomputed on every profile write and mirrored into `TalentCandidate` by `syncTalentCandidate`.
- **Gate:** `openToWork` cannot be enabled below 70. The toggle renders disabled with "Complete 3 more items to appear to recruiters" and links to the exact missing fields.
- **Reward:** first time a profile hits 100 → one-time `+25 SP`, `SynergyEvent.type = "PROFILE_COMPLETE"`, idempotent (guard on an existing event of that type for the user, inside the transaction).
- **Nudges:** ring meter + checklist on `/profile`; a dismissible dashboard card below ~70; the recruiter-view counter from W1 rule 3 once they are listed.
- **Anti-pattern to avoid:** no modal on login, no nag on every page. One card, one dismissal, respected for 7 days.

### Matching
`scoreMatch(candidate, job)`: skills overlap **60** (Jaccard against `job.skills`) + domain
in `job.domains` **15** + `job.type` in `candidate.roleTypes` / location overlap **15** +
completeness & activity **10**. Returns `reasons[]` like `"4 of 6 required skills"`,
`"Domain match: AI"`. Surfaces:
- `/hire/jobs/[id]/matches` — ranked candidates, recruiter side.
- `/jobs` — "Matched for you" section, student side, with the same reasons.
- Threshold for showing a match at all: score ≥ 40. Below that it is noise and it damages trust.

### Plans to write
- `061-profile-completion-scoring.md` — pure function, schema field, backfill, `/profile` meter + checklist, SP award. *(Shivansh spec + Suyash UI)*
- `062-job-matching-engine.md` — `scoreMatch`, both surfaces, thresholds. *(Shivansh)*

---

## 6. W3 — Podcast Connect (SP burn)

**Goal:** a student spends Synergy Points to request a real conversation with someone we
have had on the podcast. This gives SP a second sink beyond merch and gives the podcast a
product surface.

### Current behavior
None. No podcast model, route or component exists anywhere in the repo. The only SP sink
is `/marketplace` (catalog items at 1800 SP).

### Data model (new)
```
PodcastGuest      slug @unique, fullName, headline, company, bio, avatarPath,
                  expertise String[], episodeUrl?, linkedinUrl?,
                  connectCostSP Int, monthlySlots Int, isActive, sortOrder

ConnectRequest    userId, guestId, costSP (snapshot), message (≤ 300 chars),
                  status ConnectStatus (PENDING|ACCEPTED|DECLINED|SCHEDULED|COMPLETED|EXPIRED|REFUNDED),
                  scheduledAt?, meetingUrl?, adminNote?, decidedByAdminId?, refundedAt?
                  @@index([userId]) @@index([guestId, status]) @@index([status, createdAt])
```

### Business rules
1. **SP burns at request time**, inside one transaction: balance check → `ConnectRequest` (PENDING) → negative `SynergyEvent` (`type: "PODCAST_CONNECT_SPEND"`, `reason: guest slug`) → decrement `synergyPoints`. Copied structurally from `redeemItem` (AD-6).
2. **Refund is automatic** on `DECLINED` and on `EXPIRED` (no admin decision within 14 days): positive `SynergyEvent` (`"PODCAST_CONNECT_REFUND"`) + increment, in one transaction, `refundedAt` set. Idempotent — a second refund attempt is a no-op, not a double credit.
3. `ACCEPTED`/`SCHEDULED`/`COMPLETED` are **never** refunded.
4. One `PENDING`/`ACCEPTED` request per student at a time; max 2 requests per student per calendar month (IST).
5. Guest capacity: `monthlySlots` accepted requests per guest per calendar month; the request button shows "Fully booked this month" past that.
6. Eligibility to request: profile completion ≥ 70 (same bar as `openToWork`) — a guest's time is not spent on an empty profile.
7. **Admin mediates.** Guest contact details are never exposed to students. Admin accepts, sets `scheduledAt` + `meetingUrl`; the student sees only that.
8. Every admin decision writes an `AdminAction` row.

### Surfaces
| Route | Type | Guard |
|---|---|---|
| `/connect` | Server — guest directory, costs, teaser for signed-out | public |
| `/connect/[slug]` | Server + Client request form | session + `StudentProfile` |
| `/connect/requests` | Server — my requests + status timeline | session |
| `/admin/podcast` | Server + Client — guest CRUD, request queue, accept/decline/schedule | `requireAdmin()` |

Guests seeded from `prisma/content/podcast-guests.json` via `npm run db:seed:podcast`,
following the existing content-seed convention.

### Risks
- Pricing is a one-way door: too cheap and guests get spammed, too expensive and nobody
  converts. Start high (see D4), it is easier to discount than to raise.
- A guest who ghosts an accepted request costs us trust and the student's SP. Rule 3 is
  deliberate; if it bites, admin issues a manual refund via the existing admin SP action
  (`056-admin-student-synergy-points`), which is already audited.

### Plans to write
- `063-podcast-connect.md` — schema, SP-burn/refund transactions, `/connect` surfaces, admin queue, seed. *(Sohail schema + ledger; Suyash public UI; Shashank admin UI)*

---

## 7. W4 — Flow, navigation, UX, analytics

**Goal:** stop shipping four microsites. One shell, one mental model, and data on where
people fall off.

### Current behavior
- `bottom-nav.tsx` has one hard-coded 5-tab set (Home/Jobs/Rewards/Explore/Profile) and a growing regex blacklist of routes where it hides — `/hire` and `/connect` would make that regex worse.
- `app-header.tsx` links `/`, `/jobs`, `/admin`; `mobile-sidebar.tsx` links a different set. They drift.
- `/explore`, `/challenges` and `/mission` overlap in purpose and nobody can say which is which.
- No analytics package installed. `/admin/analytics` computes registration/submission charts from Prisma directly — good, but it measures the challenge only and nothing upstream of signup.

### Work
1. **Persona-aware shell.** Replace the blacklist regex with an explicit `getNavForPersona(pathname, persona)` — personas: `student`, `program`, `recruiter`, `admin`, `public`. Adding a route becomes adding an entry, not editing a regex. Header and sidebar read the same config; one file.
2. **IA consolidation.** `/explore` becomes the single cross-track discovery page (challenge / cohort / hackathon / connect / hire). `/mission` folds into it. `/challenges` stays as the public SEO landing for the 60-day track only.
3. **Onboarding.** First-run checklist on `/dashboard`: complete profile → pick domain → submit Day 1 → set open-to-work. Dismissible, per-item state derived from data, not stored flags.
4. **Empty/loading/error states.** Every new W1–W3 route gets a real empty state, a `loading.tsx` skeleton and an error boundary. This is where the platform will look amateur if we skip it — it is assigned, not optional.
5. **Analytics pipeline (AD-7).**
   ```
   AnalyticsEvent  id, name, userId?, anonId?, path?, source?, props Json?, createdAt
                   @@index([name, createdAt]) @@index([userId])
   ```
   `lib/analytics.ts` exports `track(name, { userId, props })` — typed name union, wrapped
   in try/catch that logs via `lib/logger.ts` and swallows. Instrument five funnels:
   **signup** (landing → register → enroll → Day 1 submit), **profile** (view → edit →
   ≥70 → openToWork), **recruiter** (register → approved → search → shortlist → reveal),
   **job** (view → apply), **connect** (view → request → accepted).
   `/admin/analytics` gains a "Funnels" tab rendering these with Recharts (already a dep).
6. **Housekeeping while in there:** `@vercel/analytics` in `app/layout.tsx`; delete
   `src/lib/hackathon-supabase.ts` (no importers since the Neon cutover — confirmed in
   project-context §16).

### Plans to write
- `065-nav-persona-shell.md` — nav config, header/sidebar/bottom-nav unification, IA moves. *(Shashank)*
- `066-analytics-events.md` — schema, `track()`, instrumentation points, admin funnels tab. *(Shivansh)*
- `067-onboarding-and-empty-states.md` — checklist, skeletons, error boundaries. *(Suyash + Shashank)*

---

## 8. Team, ownership, and working rules

### Who does what — and why
| Person | Owns | Rationale |
|---|---|---|
| **Sohail** | Architecture, all schema + migrations, auth guards, middleware, the SP ledger transactions, `/hire` core, deploys, PR review of both juniors | Every irreversible surface (DB, auth, money-equivalent) sits with the person who carries prod. |
| **Shivansh** | Matching engine, profile-completion scoring, recruiter jobs + approval flow, contact-reveal caps/audit, analytics pipeline | The correctness-heavy, transaction-heavy, testable work — second-strongest hands on the hardest logic. |
| **Suyash** (new) | Student-facing UI: profile meter/checklist, `/connect` public pages, `/hire` presentational components, empty states, seed content JSON | UI behind typed contracts someone else defined. Visible wins, low blast radius, fast feedback. |
| **Shashank** (new) | Nav/IA refactor, `/admin/podcast` + `/admin/hire` panels, onboarding checklist, CSV exports, QA passes | Admin pages have 20+ existing examples to copy — the fastest way for a new dev to learn this codebase's conventions. |

### Hard rules for Suyash and Shashank (non-negotiable for 45 days)
1. **Never** touch `prisma/schema.prisma`, migrations, `middleware.ts`, `auth.ts`/`auth.config.ts`, or anything that writes `SynergyEvent` / `synergyPoints`.
2. Work only against typed data contracts (exported types + server functions) that Sohail or Shivansh has already merged. If the contract does not exist yet, the task is blocked — say so, do not invent it.
3. Every PR: `npm run build` clean, no `any`, Server Component by default, `buttonVariants` on `<Link>` (never `<Button asChild>`).
4. No new files that the plan does not list. No new abstraction for trivial logic.
5. Ask before day 2 of being stuck. A junior stuck for three days is the most expensive thing in a 45-day window.

### Team-scale infrastructure (Sohail, **Day 1, blocking**)
The repo is set up for one developer and will break with four:
- **One Neon DB serves dev *and* prod** (project-context §2). Four developers running seeds against production is a matter of when, not if. → Give each dev their own Neon branch + `.env.local`; keep `SEED_ALLOW_PRODUCTION` unset everywhere except a deliberate prod run.
- **Everyone on `master`.** → Branch per plan (`feat/058-talent-candidate-index`), PR into master, Sohail or Shivansh approves. Juniors never merge their own PR.
- `.cursorrules` changelog discipline (one dated line per architecturally significant change) applies to all four people, not just Sohail.

---

## 9. Schedule — 45 days, 2026-08-08 → 2026-09-21

### S0 · Foundations — Aug 8 → Aug 12 (5 days)
| Owner | Task |
|---|---|
| Sohail | Neon branch per dev; branch+PR workflow; open decisions D1–D6 closed; write plans 058, 059 |
| Shivansh | Write plans 060, 061, 062; sketch `computeProfileCompletion` weights against 20 real profiles |
| Suyash | Read `docs/project-context.md`; ship one warm-up PR (`/profile` completion meter, static props) |
| Shashank | Read `docs/project-context.md`; ship one warm-up PR (nav config extraction, no behavior change) |
**Exit:** every plan for S1 is written; four devs can run the app on isolated DBs.

### S1 · Candidate index + profile completeness — Aug 13 → Aug 24 (12 days)
| Owner | Task |
|---|---|
| Sohail | `TalentCandidate` schema + migration + `syncTalentCandidate` + backfill script (058); `/hire/candidates` search & profile pages (059) |
| Shivansh | `computeProfileCompletion` + `profileCompletion` field + backfill + SP award (061); `openToWork` ≥70 gate |
| Suyash | `/profile` ring meter, checklist, missing-field deep links; open-to-work preferences form |
| Shashank | Nav persona shell (065) merged; dashboard completion nudge card |
**Exit:** a student can complete a profile and opt in; an admin-flagged recruiter can search and open a real candidate. **Milestone M1 — Aug 24.**

### S2 · Jobs, matching, podcast — Aug 25 → Sep 5 (12 days)
| Owner | Task |
|---|---|
| Sohail | `PodcastGuest` / `ConnectRequest` schema + SP burn/refund transactions + seed (063); review load |
| Shivansh | Recruiter job posting + admin approval (060); `scoreMatch` + both match surfaces (062) |
| Suyash | `/connect` directory + guest detail + request form + `/connect/requests` |
| Shashank | `/admin/podcast` queue (accept/decline/schedule); `/admin/hire` approvals panel |
**Exit:** a recruiter posts a job and sees ranked matches; a student burns SP and gets a scheduled call. **Milestone M2 — Sep 5.**

### S3 · Contact, analytics, polish — Sep 6 → Sep 15 (10 days)
| Owner | Task |
|---|---|
| Sohail | Contact reveal + caps + `RecruiterViewEvent` (064); `/hire` public marketing page |
| Shivansh | Analytics pipeline + 5 funnels + admin Funnels tab (066) |
| Suyash | Empty states, skeletons, error boundaries across all new routes (067) |
| Shashank | Onboarding checklist; IA consolidation (`/mission` → `/explore`); CSV exports for `/admin/hire` |
**Exit:** feature-complete. **Milestone M3 — Sep 15. Code freeze on new features.**

### S4 · Hardening + launch — Sep 16 → Sep 21 (6 days)
| Owner | Task |
|---|---|
| All | QA matrix: 4 personas × 4 tracks × mobile 390px + desktop |
| Sohail | Security pass: no phone leaks, opt-in enforced server-side on every path, admin audit rows present, rate-limit reveal + connect endpoints |
| Shivansh | Load sanity on `/hire/candidates` at 1,500 candidates; N+1 audit on new Prisma reads |
| Suyash/Shashank | Copy pass, mobile pass, broken-link sweep, `docs/CHANGELOG.md` reconcile lines |
| Sohail | Staged rollout: flags on for admins → 5 pilot recruiters → open |
**Launch: 2026-09-21.**

### Launch gates (all must be true; any false = hold)
- ≥ 150 candidates with `openToWork = true` and completion ≥ 70.
- ≥ 5 approved recruiters have completed one search + one shortlist in the pilot.
- ≥ 6 podcast guests live with capacity set.
- Zero paths return `phone` to a recruiter (grep + manual verify).
- `npm run build` clean; all five funnels emitting events in prod.

### Buffer
There is **no slack** in this schedule. If something slips, cut in this order:
**(1)** job matching on the student side (`/jobs` "Matched for you"), **(2)** analytics funnels
beyond signup + recruiter, **(3)** onboarding checklist. Do **not** cut privacy controls,
the audit rows, or empty states.

---

## 10. Open decisions — need Sohail before S0 ends (Aug 12)

| # | Decision | Recommendation |
|---|---|---|
| **D1** | Portal route name: `/hire` vs `/recruiters` vs merging into `/talent` | `/hire` — short, verb, unambiguous for a recruiter arriving cold |
| **D2** | May an account with a `StudentProfile` also be a recruiter? | Keep the block for now; revisit post-launch. Mixed-role accounts break every guard we have. |
| **D3** | Completion bar for `openToWork` — 70 or 80? | 70. 80 filters out real students who lack a resume URL. |
| **D4** | Podcast connect price | Tiered by guest: 400 / 800 / 1500 SP. Anchor: marketplace items are 1800 SP. |
| **D5** | Do hackathon-only users (no `StudentProfile`) get listed? | Yes, but only after they complete a profile — the hackathon row alone has no skills to match on. This is a strong conversion lever back into the challenge. |
| **D6** | Is `/hire` behind a feature flag at launch? | Yes — `ENABLE_HIRE`, mirroring `ENABLE_PROGRAM`. Cheapest possible rollback. |

---

## 11. Doc maintenance

- Each plan file (058–067) is written **before** its sprint starts, using the template in `CLAUDE.md`.
- This roadmap is updated at each milestone (M1/M2/M3) with actual vs planned — no silent slips.
- Schema changes land in `docs/CHANGELOG.md` under `## Pending reconcile`, folded into `docs/project-context.md` at the next reconcile pass.
- Every plan with a schema change carries the DB safety block: commit checkpoint → Neon branch snapshot → commit hash noted.
