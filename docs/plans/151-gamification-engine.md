# 151 — ABTalks Gamification Engine: product + architecture proposal

> **Type:** Product and architecture design document, **not** a Cursor
> implementation plan. When a phase below is scheduled, each slice gets its own
> numbered plan written against the standard `CLAUDE.md` template. §V1-IMPL at
> the end sketches the template sections for V1 so those plans start from
> decisions, not from a blank page.
>
> **Written:** 2026-09-16 against `master` @ `0b4faa7a`.
> **Status:** Proposal. Nothing here is approved, scheduled or built.
> **Timing:** Do not start before the September release is signed off (plan
> 112). Phase 7 W1-B onward stays frozen, and this plan does not depend on it.
> **Owner:** None yet. Gamification is not in anyone's `CLAUDE.md` ownership
> list. **Sohail has to name an owner before Phase 1.** See §0.3.

---

## 0. Read this first

### 0.1 The three findings that shape everything below

**1. The problem is activation, not power-user retention.** Read-only
production aggregates, 2026-09-16:

| Measure | Value |
|---|---|
| Users (not deleted) | **13,020** (329 new in 30 days, 123 in 7 days) |
| Users with a submitted `ActivityAttempt`, last 30 days | **157** |
| …last 7 days | **50** |
| …active in ≥ 2 distinct weeks of the last 30 days | **86** |
| Challenge `Enrollment` rows that **never completed a day** | **2,556 of 3,341 (76.5%)** |
| Enrollments that reached day 50–59 / day 60 | 96 / 92 |
| Legacy hackathon: participants → teams → team submissions | 8,293 → 5,309 → **1,638 (31% of teams)** |
| Legacy hackathon participants who ever enrolled in any learning program | **441 (5.3%)** |
| ViCoDathon 2 so far: registrations / new users among them / submissions | 220 / 91 / 0 |
| `CandidateProfile` rows / with headline / with LinkedIn / with GitHub username | 10,961 / **45** / 954 / 682 |

A monthly active base of ~157 on 13k accounts means gamification's main job is
**getting people to their first verified action and back for a second week**,
and **turning hackathon registrants into learners**. Most of the prompt's
competition machinery (global boards, college boards, top-1% badges) is tuned
for a population ABTalks does not have yet. With 50 weekly actives, a "top 100
this week" board lists everyone. The roadmap is ordered around this.

**2. The evidence layer is empty.** `SkillEvidence` has **0 rows**.
`emitSkillEvidence` in `src/repositories/skill-evidence.ts` is still a frozen
**no-op stub** (T-146). `ActivitySkill` has **0 rows**, so no cohort activity
maps to any skill. Only `ProgramSkill` (58 rows) links programs to skills, and
`get-verified-skills.ts` derives "verified" at read time from curriculum plus
completion. **"Skill progression" and "evidence-backed levels" cannot ship
until evidence is written**, and that work is a prerequisite owned by
Shivansh, not a gamification task (§0.3, Phase 0).

**3. SP is money, not progress.** `PointsAccount` + `PointsTransaction` are
write-authoritative (W1-A). Synergy Points buy marketplace items (1,800 SP
catalog), pay for mock interviews after the free allowance, and are capped at
10 SP per IST day (plan 111) because multi-enrollment farming was real. 33
admin grants account for 38,802 SP, about 13% of everything earned. **XP must
be a separate, non-spendable ledger.** Reusing SP would inflate a currency with
real redemption cost, and admin grants would make level meaningless.
Gamification **never calls `applyPointsChange`** in this plan.

### 0.2 The principle every mechanic below must pass

> **No reward without a verifiable source row.**
> Every XP transaction, badge and quest step points at a durable row another
> part of the platform already wrote: an `ActivityEvaluation`, a `Credential`,
> a `HackathonSubmission`, a `ProgramEnrollment`. If that row stops qualifying
> (reset, rejected, re-graded, deleted), the reward is reversed automatically.
> Logging in, viewing, applying and claiming earn nothing.

This one rule does most of the anti-abuse work, makes backfill free, and keeps
recruiter-facing data independent of gamification. Turning gamification off
changes no evidence, no credential and no search result.

### 0.3 Ownership: what this plan touches that others own

Gamification is a new module with no owner. Everything below is a proposal to
the owners named. **Nothing here authorizes editing their modules.** Each row
is a future `CROSS-MODULE CHANGE REQUIRED` request.

| Touchpoint | Owner | What gamification needs | Phase |
|---|---|---|---|
| New module `src/features/gamification/`, its tables, cron, admin | **Unassigned. Sohail to assign** | Everything in §4 | 1 |
| Schema, cron route, feature flags, `lib/feature-flags.ts`, admin authz | **Sohail** (shared architecture, DB conventions, infra, security) | Review of every migration, cron and flag | 1+ |
| `emitSkillEvidence` implementation, `ActivitySkill` seeding, evidence backfill | **Shivansh** (Evidence) | Evidence written. Gamification only *reads* it | **0** |
| Profile Progress strip, `/profile` report card, completeness events | **Shivansh** (Candidate profile) | One `after()` emit on profile save, one read-only strip | 2 |
| Career Guidance daily mix (T-224): quests as cards | **Shivansh** (Career guidance) | Quest cards join the existing picker; no second "what next" panel | 2 |
| Candidate assessments completed event | **Shivansh** | One `after()` emit | 2 |
| Notification event types, bundling, email defaults | **Manuvrtti** (Notifications, analytics events) | New `EVENT_TYPE_REGISTRY` keys; GA4 names in `ANALYTICS_EVENTS` | 2 |
| Mock interview completed event | **Zainab** (Mock interviews) | One `after()` emit | 2 |
| Hackathon registry, submission checks, judging, results | **Not listed in `CLAUDE.md`. Sohail to confirm** (T-276 hackathon ops was Manuvrtti) | §14 | 0 (small), 3 |
| Recruiter signal filters, review panel, Scout dossier | **Shashank** (review panel, pipeline); **Sohail** (search ranking) | Evidence-based signals, never XP (§19) | 4 |
| Hub dashboard layout, badge visuals, all new UI | **Shallika** (UI/UX, design system) | Designs ahead of build (§34) | 2+ |

---

## 1. Current-system observations

### 1.1 What exists and should be reused

| System | Where | How gamification uses it |
|---|---|---|
| **Unified attempt/evaluation spine** | `ActivityAttempt` + `ActivityEvaluation` (`isAuthoritative`, `evaluatorType`, `lateness`) | **The** source of "a learning action happened and was accepted." Every track lands here: challenge submissions via dual-write (`ev_sub_*`), legacy program missions via dual-write, and the four 078-native open cohorts (Databricks, DS Architect, Power BI, Snowflake) directly. PROGRESS reads are already on it, so XP will agree with what users see. |
| Activity metadata | `Activity.estimatedMinutes`, `.difficulty`, `.type`, `.points`, `.dueOffsetDays`, `ActivitySkill.weight` | XP formula inputs (§6). No new per-activity XP column is needed. |
| Daily activity grain | `EnrollmentDayActivity` (unique enrollment × date × source) | Weekly streak computation (§10). |
| Cohort progress cache | `EnrollmentProgress` (`percentCompleteBp`, streaks, `@@index([cohortId, pointsEarned desc])`) | Cohort journey view and cohort rank (§15). Already indexed for leaderboards. |
| Idempotent ledger **pattern** | `PointsTransaction.idempotencyKey @unique`, `applyPointsChange`, `logMoney` | Copy the pattern for `XpTransaction`. **Do not use the ledger.** |
| Platform-issued proof | `Credential` (`@@unique([type, sourceType, sourceKey])`, `metadata.hackathonVariant`) | Completion and hackathon placement events. V1 hackathon placements come from here, with no new hackathon schema. |
| Professional accomplishments bridge | `CandidateAchievement` (`@@unique([sourceType, sourceId])`, `isPublic`), 6,823 rows | Stays the **recruiter-facing** accomplishment record. Gamification badges are a separate, candidate-facing concept (§11). |
| Evidence write contract | `emitSkillEvidence` (stub, signature frozen) | Gamification consumes `skill_evidence.added`. It never writes evidence. |
| Read-time verified skills | `features/profile/get-verified-skills.ts` (ProgramSkill + 50-day / COMPLETED bar) | Becomes one input to skill stage "Verified" once completion also emits evidence (§8). |
| Profile strength | `features/profile/completeness.ts` (UX only, gates nothing, plan 132) | Source for one-time profile quest steps. **The "gates nothing" invariant is preserved.** |
| Next-best-action engine | `features/career-guidance/*` (T-224: facts → rules → daily mix of 4, IST-day dismissals) | Quests render as cards **inside** this mix. `CandidateFacts` becomes the segmentation input (§33). |
| Notifications | `dispatch()` + `EVENT_TYPE_REGISTRY` + `UserNotification.dedupeKey` + `NotificationPreference` (T-248/T-251) | All gamification notifications. The rolling `dedupeKey` gives daily bundling for free. |
| Runtime config pattern | `lib/platform-config.ts` (typed registry, bounded values, audited writes, safe fallback) | Template for `GamificationRule` (§29.1). |
| Audit | `features/admin/audit.ts` `writeAudit` → `AdminAction` (actor snapshot, previous/new state) | **Every** manual XP/badge operation. No new audit table. |
| Post-response work | `after()` from `next/server` (already used in `admin-actions.ts`) | Records and processes events after the domain response is sent. |
| Scheduled work | Vercel crons (`program-commits`, `hire-alerts`), daily, `CRON_SECRET` bearer | One daily `gamification-sweep` cron. |
| Existing streaks | `compute-activity-streak.ts` (hub, read-time, milestones 3/7/14/30/60/100); `Enrollment.currentStreak` (write-time, challenge rules) | Hub card is replaced by the weekly streak in Phase 3. Track streaks stay as they are. |
| Existing boards | Challenge leaderboard (`get-leaderboard.ts`, 5-min `unstable_cache`), program leaderboard (`totalScore`), `community-leaderboard.tsx` | Kept. Not replaced by an XP board. |
| Existing mini-badges | Referral bronze/silver/gold/platinum (1/5/10/25) | Migrated into the badge catalog as-is (Phase 2). |
| Recruiter interest | `CandidateProfileEvent` (DETAIL_VIEW / RESUME_UNLOCK, per-viewer per-IST-day dedupe) | Private career signal for the candidate. **Never XP, never a badge** (§5.2). |
| Observability | Sentry + pino (T-259), `domain-log` | `gamification.*` log events with the same redaction rules. |
| Test style | `tsx` test files wired as `npm run test:*`, Prisma-injectable stores (`candidate-jobs/prisma-store.ts`), static source-scan tests (`synergy-cap.test.ts`) | Same style (§30). |

### 1.2 Technical debt and traps gamification must route around

1. **Challenge submissions look "AUTO-verified" when they are not.** Dual-write
   records every challenge day as `evaluatorType: AUTO, passed: true, score: 100`
   (`dual-write.ts`), and GitHub/LinkedIn proof has been optional since
   Synergy. XP verifiability must come from **activity type + proof payload**,
   not from `evaluatorType` (§6.1).
2. **Double counting across dual-write.** A challenge day exists as a legacy
   `Submission` *and* an `ActivityEvaluation`. Emit only from the 078 side and
   key on `(userId, activityId)` (§6.3), so neither a legacy event nor a
   re-grade can pay twice.
3. **The four open-cohort copies are deliberately not abstracted**
   (`repositories/{databricks,ds-architect,powerbi,snowflake}.ts`). One emit per
   copy is fine for the fast path. The **sweep over `ActivityEvaluation`** is
   copy-agnostic and is the correctness guarantee (§31.4).
4. **Hackathon has no results model.** Placements live in a hard-coded array
   inside `prisma/scripts/issue-hackathon-award-certificates.ts` and end up only
   as `Credential.metadata.hackathonVariant`. `HackathonEvent` is a singleton;
   events are code config (`components/hackathon/hackathon-config.ts`).
   `HackathonSubmission` overwrites in place with no history. `liveUrl` is
   optional in `hackathonSubmissionSchema`, although the landing copy says it
   is required. There is no repo-URL uniqueness across teams, and
   `HackathonProblem` has no skills column.
5. **Dashboard reads must never write** (project rule). No on-read catch-up
   processing. Gamification writes happen in `after()` or in the cron only.
6. **Neon pooler drops SAVEPOINT transactions.** The processor uses
   `writeClient()` (direct host) and no savepoints.
7. **Unapplied migrations crash pages** (the `/jobs` P2022). Every gamification
   read on a shared page (hub, profile) is flag-gated **and** wrapped so that a
   missing table hides the panel instead of 500ing the page.
8. **This machine's `.env` is the production database** (`ep-young-shadow`).
   The `PRODUCTION_NEON_HOST_ID` constant in `migrate-078-shared.ts` names an old
   host and guards nothing. Every integration test and backfill in this plan
   must target a Neon **child branch** with an explicit host check.
9. **GA4 is consent-gated and client-side** (T-252/T-253). Retention and funnel
   analytics cannot be built on it. The server-side event log in §4 is the
   measurement source.
10. **Privacy copy still says discoverability is opt-in** (D-8, open). Any
    public leaderboard showing names or colleges widens that gap. Boards default
    to pseudonymous display (§13) until D-8 closes.
11. **Account lifecycle:** `User.disabledAt` (T-272) and candidate self-delete
    (T-217, cascades). Gamification rows cascade on delete, and disabled users
    are skipped and excluded from boards.
12. **Naming collision.** `/achievements` is the certificates page and
    `CandidateAchievement` is the recruiter bridge. Gamification uses **"Badges"**
    in UI and schema (`BadgeDefinition`, `UserBadge`) so three different things
    are not all called "achievement."

### 1.3 Systems gamification could accidentally break

| System | How it could break | Guard |
|---|---|---|
| Money path (`applyPointsChange`) | Gamification awarding SP | Static test: `features/gamification/**` never imports the points write path |
| Challenge submission / mission verify / open-cohort verify | A gamification throw fails the user's submit | Emit only inside `after()` with a catch-all. Static test asserts every call site is inside `after(` |
| Recruiter search and ranking | XP or level leaking into `score-candidate` or filters | Recruiter surfaces read evidence-derived signals only (§19); static test on `features/hire/**` |
| Profile completeness semantics | Completeness quietly becoming a gate because a quest uses it | Quests read it; nothing gates on it (plan 132 invariant restated in code comments) |
| Hub performance | Leaderboard/rank computed per request | Top-N from index + one count query, 5-min cache (§37) |
| Notification volume | Badge spam | One bundled gamification item per user per IST day (§22) |

---

## 2. Gamification product philosophy

**Career growth should feel like progress in a game, and every step should
leave behind proof a recruiter can check.**

Five concepts, kept apart on purpose:

| Concept | Represents | Spendable? | Decays? | Recruiter sees it? |
|---|---|---|---|---|
| **XP** | Verified effort: progress | No | Never | **No** |
| **Level** | Milestones: XP **and** specific accomplishments | No | Never (drops only on fraud reversal) | No (candidate may show it on their public profile, Phase 4) |
| **Badges** | Achievements: a behavior worth repeating | No | No (revocable) | Only badges that are also `CandidateAchievement`s |
| **Evidence / skill stage** | Credibility per skill | No | Strength decays with age; the history does not | **Yes, with provenance** |
| **Signals** | Trust dimensions (builder, consistency, competition, completion, readiness) | No | Windowed (recent months) | **Yes, as bands with reasons** (Phase 4) |
| *SP (existing)* | *Wallet* | *Yes* | *No* | *No* |

Design commitments:

1. **Reward proof, not presence.** No login rewards, no streak-length XP, no XP
   for applications, views or self-claims.
2. **Relative competition, absolute progress.** Levels and badges are absolute
   and permanent. Rankings are always scoped (week, cohort, hackathon, league)
   and reset, so newcomers can win something.
3. **One "what next" surface.** Quests live inside Career Guidance, not beside it.
4. **Professional aesthetic.** GitHub-contribution restraint, Stack Overflow
   legibility, Duolingo cadence. No coins, no confetti by default, no cartoon art.
5. **No anxiety mechanics.** Weekly streaks with freezes, no rank-drop alerts,
   no "you'll lose everything" copy.
6. **Everything reversible and audited.** Every reward traces to a source row
   and an audit trail.

---

## 3. Core user loop

```
DISCOVER ── hackathon / workshop / referral / landing
   │
JOIN ────── signup → Starter Quest assigned by segment (§9)
   │
LEARN ───── pass verified activities (challenge day, cohort mission)      → XP (Learning)
   │
BUILD ───── project activity, SHIP_IT mission, hackathon repo + live URL  → XP (Building)
   │
SUBMIT ──── automated checks pass                                         → badge / quest step
   │
VERIFY ──── evaluation, completion credential, assessment score           → SkillEvidence (owner: Evidence)
   │
EARN REPUTATION ── skill stage rises, signals bands move                  → level gates unlock
   │
UNLOCK ──── next level, advanced challenges, early hackathon access (Phase 3+)
   │
COMPETE ─── cohort rank, hackathon results, weekly league
   │
GET DISCOVERED ── recruiters search evidence, not XP                      → private career signals to candidate
   │
GET OPPORTUNITIES ── assessment invites, outreach, jobs
```

The loop's weakest link today is **JOIN → LEARN** (76.5% never pass Day 1) and
**DISCOVER (hackathon) → LEARN** (5.3% cross over). V1 is aimed at those two
edges.

---

## 4. Gamification system architecture

### 4.1 Shape

```
            ┌──────────────── Domain write paths (unchanged behavior) ──────────────┐
            │ submit-day · verify-mission · open-cohort verify · issue-certificate    │
            │ profile save · assessment submit · mock report ready · hackathon close  │
            └───────┬──────────────────────────────────────────────────────────────────┘
                    │ commit succeeds, response sent
                    ▼
        after(() => recordGamificationEvent({...}))     ◄── FAST PATH (seconds)
                    │   never throws; logs on failure
                    ▼
        ┌──────────────────────────────┐
        │ GamificationEvent (outbox)    │  unique idempotencyKey
        │ PENDING → PROCESSING → DONE   │
        └──────────────┬───────────────┘
                       │ processEvent(id)  (same after() callback, then cron retries)
                       ▼
        ┌──────────────────────────────────────────────────────────────────┐
        │ Rules engine (PURE): event + rules + user snapshot → Effect[]     │
        │   xp · periodScore · questRecheck · badgeRecheck · levelRecheck   │
        └──────────────┬───────────────────────────────────────────────────┘
                       ▼  one transaction, writeClient(), no savepoints
        XpTransaction (append-only) → UserProgress (row lock) → XpPeriodScore
        → UserQuest (re-derived) → UserBadge (insert-if-absent) → event DONE
                       │ after commit
                       ▼
        dispatch() bundled notification · GA4-free server metrics

        Daily cron /api/cron/gamification-sweep       ◄── CORRECTNESS PATH
          1. DERIVE: scan source tables (48h overlap window) → insert missing events
          2. PROCESS: PENDING/FAILED (attempts < 5) in batches of 500
          3. RECONCILE: XP whose source no longer qualifies → reversal tx
          4. NIGHTLY CACHES: badge earn counts + rarity, UserProgress spot-recompute
```

### 4.2 Why this shape for this stack

- **No queue infrastructure.** Vercel + Neon free tier, daily crons. An outbox
  table plus `after()` plus a daily sweep gives at-least-once delivery with
  idempotent effects. Nothing new to operate.
- **The sweep derives from facts, so lost events heal.** Every V1 event has a
  durable source row with a stable id. A crashed `after()` means the XP shows up
  after the next sweep instead of in seconds. It is never lost.
- **Backfill is the same code** with a wider window.
- **Evaluate from state, don't increment.** Quest progress, badge criteria and
  levels are recomputed from ledger and source queries on each relevant event.
  Only `XpTransaction` is append-only. Replays and out-of-order processing then
  cannot corrupt counts.
- **Transport-independent.** `processEvent(id)` does not care who calls it. If
  volume ever outgrows `after()` plus a daily sweep, swap in a queue consumer
  (Vercel Queues, QStash, Inngest) without touching rules.

### 4.3 Module layout (proposed; the owner confirms)

```
src/features/gamification/
  event-types.ts        registry: type → sourceType, category, payload Zod schema (client-safe, no Prisma)
  record-event.ts       recordGamificationEvent() — server-only, never throws
  process-event.ts      claim → evaluate → apply → release
  rules/evaluate.ts     PURE: (event, rules, snapshot) → Effect[]
  rules/xp-formula.ts   PURE: §6
  levels.ts             PURE: level table + gate evaluation
  badges/criteria.ts    Zod discriminated union of criterion kinds + PURE evaluators
  quests/progress.ts    PURE: derive quest progress from counts
  streak-weeks.ts       PURE: IST ISO-week math, freezes
  sweep/derive-*.ts     one deriver per source table
  sweep/reconcile.ts    reversal of disqualified sources
  loaders.ts            getMyProgress / getMyQuests / getMyBadges / getBoard (server-only reads)
src/repositories/gamification.ts   Prisma boundary (078-native; injectable store for tests)
src/app/actions/gamification-actions.ts         candidate actions (mark badges seen)
src/app/actions/admin-gamification-actions.ts   admin actions (§28)
src/app/api/cron/gamification-sweep/route.ts    CRON_SECRET bearer
src/components/gamification/*                   UI (Shallika designs)
src/app/admin/gamification/*                    admin control center
```

Edge rule: nothing here is imported by `middleware.ts`. `event-types.ts` stays
free of `server-only`, `@prisma/client` and `@/lib/*` runtime imports, the same
constraint `notification/types.ts` has.

---

## 5. Event taxonomy

**Naming** follows the codebase's frozen notification convention,
`<domain>.<past_tense>` in lowercase, stored as a `String` rather than a Prisma
enum. New types need no migration. A shipped key is never renamed.

**Idempotency key** = `"<type>:<scope>"`, where scope is the smallest identity
that must pay at most once.

### 5.1 Events that can carry XP

| Event | Maps prompt event(s) | Source row (sweep derives from) | Idempotency scope | Fast-path emitter (owner) | Phase |
|---|---|---|---|---|---|
| `activity.passed` | COHORT_DAY_COMPLETED, CHALLENGE_COMPLETED (day) | `ActivityEvaluation` where `isAuthoritative AND passed` | `userId:activityId` | `dual-write.ts` challenge + mission paths (Sohail); 4 open-cohort repos (track owners) | 1 |
| `enrollment.completed` | COHORT_COMPLETED, 60-day finish | `ProgramEnrollment.status = COMPLETED` | `enrollmentId` | cohort completion writes / challenge mirror | 1 |
| `credential.issued` | certificate, HACKATHON_WINNER/FINALIST (via variant) | `Credential` (ISSUED) | `credentialId` | `features/certificate/*` | 1 |
| `profile.section_completed` | PROFILE_SECTION_COMPLETED, PROFILE_COMPLETED | `computeCompleteness` transition at save | `userId:sectionKey` (lifetime) | `candidate-profile-actions.ts` (Shivansh) | 2 |
| `hackathon.submitted` | HACKATHON_SUBMITTED | `HackathonSubmission` at **window close**, fanned out to members present at close | `eventId:teamId:userId` | close job (hackathon owner) | 2 (V1 via sweep after close) |
| `hackathon.placed` | HACKATHON_SHORTLISTED / FINALIST / WINNER | V1: placement `Credential.metadata.hackathonVariant`; Phase 3: `HackathonResult` | `eventId:userId` (highest placement wins, see §14.6) | results publish | 2 |
| `assessment.completed` | ASSESSMENT_COMPLETED | `AssessmentAttemptSession` ended normally | `assignmentId` | `assessment-attempt-actions.ts` (Shivansh) | 2 |
| `mock_interview.completed` | MOCK_INTERVIEW_COMPLETED | `MockInterviewReport` created | `mockInterviewId` | `features/interview/platform/service.ts` (Zainab) | 2 |
| `referral.qualified` | REFERRAL_COMPLETED | `Referral.rewardGiven` (referred user's Day 7) | `referralId` | `award-referral-synergy.ts` | 2 |
| `hackathon.milestone_passed` | build-period check-in | `HackathonSubmissionCheck` at milestone | `eventId:teamId:milestone` | Phase 3 | 3 |
| `peer_review.completed` | COMMUNITY_CONTRIBUTION (the verifiable part) | `HackathonPeerReview` | `reviewId` | Phase 3b | 3 |

### 5.2 Events recorded for quests, badges, levels and analytics that carry **zero XP**

| Event | Maps | Why zero XP |
|---|---|---|
| `enrollment.started` | COHORT_JOINED | Intent, not work. It opens the Starter Quest. |
| `hackathon.registered` | HACKATHON_JOINED | Intent. It opens the Hackathon Arrival quest. |
| `skill_evidence.added` / `skill.stage_changed` | SKILL_VERIFIED, EVIDENCE_VERIFIED | The underlying action already paid. Paying again double counts. It drives level gates and badges. |
| `recruiter.profile_viewed` | RECRUITER_PROFILE_VIEW | Outside the candidate's control; farmable with a fake recruiter; popularity is not proof. Private signal only. |
| `recruiter.shortlisted`, `recruiter.contact_unlocked` | RECRUITER_SHORTLIST, RECRUITER_CONTACT_REQUEST | Same. It also leaks recruiter activity that recruiters did not agree to broadcast. |
| `job.applied` | JOB_APPLIED | Rewarding applications trains spray-and-pray. |
| `workshop.registered` | — | No attendance data exists. |

### 5.3 Deliberately **not** events

`user.signed_in` / DAILY_LOGIN (never recorded for gamification), WEEKLY_ACTIVE
(derived from ledger, not emitted), GITHUB_CONNECTED / LEETCODE_CONNECTED (no
verification exists: `githubUsername` is a typed string, and `CandidateLink`
has 0 GitHub rows. They become `external_profile.verified` once an ownership
check exists, Phase 4), PROJECT_ADDED (self-authored `CandidateProjectEntry` is
a claim; PROJECT_VERIFIED needs a verification flow that does not exist).

### 5.4 Adding an event later

1. Add the key and payload schema to `event-types.ts`.
2. Add a deriver in `sweep/` (required, since this is the correctness path).
3. Optionally add a fast-path `after()` emit in the owning module (cross-module request).
4. Add `GamificationRule` rows (disabled), enable from admin.

No engine code changes. That meets the "add future events without modifying
the core" requirement.

---

## 6. XP model

### 6.1 Framework: *Effort × Difficulty × Verifiability × Timeliness*, with caps

```
XP = min(ruleCap, round( Base × D × V × T × Rep ))
```

**Anchor: 1 XP ≈ one minute of verified, focused work.** It is explainable to
users ("about 45 XP ≈ a 45-minute task"), it resists inflation because minutes
per day are bounded, and it is already modelled by `Activity.estimatedMinutes`
and `DailyTask.estimatedMinutes`.

| Factor | Values | Source |
|---|---|---|
| **Base** | `estimatedMinutes` clamped to [10, 90]; for `PROJECT` / `BOSS_BUILD`, clamped to [60, 240]. Fallback by `ActivityType`: CODING 30, QUIZ 15, PROJECT 120, ASSIGNMENT 45, EXTERNAL_SUBMISSION 30, DAILY_CHALLENGE 30, CONTENT 5, VIDEO 5, INTERVIEW 30 | `Activity` |
| **D**ifficulty | easy 1.0 · medium 1.25 · hard 1.5 · unknown 1.0 | `Activity.difficulty` |
| **V**erifiability | **1.0** server-verified (CODE_SPRINT hidden outputs, DATA_ROOM answers, PROMPT_FORGE evals, quiz auto-graded) · **1.2** rubric-graded project (AI + human, or human) · **1.0** SHIP_IT repo check · **0.6** challenge day **with** GitHub proof URL (format + HEAD check) · **0.4** challenge day with **no** proof · **0** any admin-issued completion | activity type + `ActivityAttempt.payload` (see §1.2 #1: **not** `evaluatorType`) |
| **T**imeliness | on-time 1.0 · late 0.75 · not applicable 1.0 | `ActivityAttempt.lateness` |
| **Rep**etition | first time for this content 1.0 · same `LearningProgram` completed before 0.25 | enrollment history |

**Rarity/outcome** does not multiply per-activity XP. It enters through
milestone events (completion, placement), where it belongs.

### 6.2 Categories

`LEARNING` (activities, quizzes) · `BUILDING` (projects, SHIP_IT, hackathon
submission) · `COMPETITION` (placements) · `CAREER` (profile setup, mock
interview, assessments) · `COMMUNITY` (qualified referrals, peer reviews).
Categories power the XP breakdown UI and per-category caps. **Levels use total
XP plus gates, never one category alone.**

### 6.3 Caps and diminishing returns

| Rule | Value (calibration default) | Why |
|---|---|---|
| `activity.passed` daily soft cap (IST day, all enrollments) | 100% up to 150 XP, 50% from 150 to 300, 0 beyond | Plan 111 precedent: multi-enrollment farming. Content unlocks daily anyway, so honest users rarely hit it. |
| One payment per `(userId, activityId)` | Idempotency key | Retries, re-grades and re-submits never pay twice |
| Re-grade to failed | Reversal (sweep reconcile) | The source no longer qualifies |
| `assessment.completed` | 40 XP, max 2 counted per ISO week | Recruiter-assigned volume is not the candidate's effort choice |
| `mock_interview.completed` | 60 XP, max 1 per ISO week | Practice matters; repetition beyond weekly is low value |
| `profile.section_completed` | One-time lifetime per section: basic 30, education 20, experience 20, projects 30, skills 20, resume 20, links 10, preferences 10; **total ≤ 160** | A nudge, not a farm. Remove and re-add pays nothing. |
| `referral.qualified` | 50 XP, lifetime max 10 counted | Existing Day-7 qualification already filters fakes |
| `enrollment.completed` | `clamp(0.25 × XP earned inside that enrollment, 200, 1,000)` | Scales with real program size without per-program config |
| Per-user daily hard ceiling, all categories | 1,000 XP (placements exempt) | Circuit breaker; hitting it raises a `GamificationFlag` |

### 6.4 Tier table (what the formula produces; shipped as `GamificationRule` rows)

| Tier | Examples | Typical XP |
|---|---|---|
| T0 — nothing | login, view, apply, claim a skill, recruiter action on you | 0 |
| T1 — setup (lifetime) | profile sections, first mock interview | 10–60 each, ≤ 160 profile total |
| T2 — practice (daily-capped) | challenge day (with proof ≈ 18–27), cohort mission (≈ 30–70), quiz (≈ 15) | 10–90 |
| T3 — build / complete | project activity (≈ 100–290), hackathon valid submission 300, program completion 200–1,000 | 100–1,000 |
| T4 — prove / compete | hackathon Top 10% 400, finalist 600, Top 5 800, 3rd 1,000, 2nd 1,200, winner 1,500 | 400–1,500 |

### 6.5 Why values are not final

Phase 1 runs in **shadow mode**: events recorded, XP computed and stored, no UI.
Backfilling roughly 15k historical evaluations, 3.4k credentials and 1.6k
hackathon submissions gives a real distribution. Level thresholds (§7) and caps
are then set from percentiles, not guesses (§26 economy review).

---

## 7. Level progression model

### 7.1 Levels require XP **and** proof

Seven levels. Few enough that each means something; a committed learner reaches
Builder in about two months and a strong competitor reaches Distinguished in a
year or more.

| # | Name | XP (provisional) | **And** gates (all required) | Behavior it encourages |
|---|---|---|---|---|
| 1 | **Explorer** | 0 | Account exists | — |
| 2 | **Learner** | 100 | 1 verified activity passed | Cross the Day-1 cliff (76.5% never do) |
| 3 | **Practitioner** | 750 | Verified activity on **7 distinct IST days** | Come back, not binge |
| 4 | **Builder** | 2,500 | **1 verified build**: a passed PROJECT/BOSS_BUILD/SHIP_IT activity **or** a hackathon submission that passed checks | Ship something real |
| 5 | **Proven Builder** | 6,000 | **1 program completion** (`enrollment.completed`) **and** 1 skill at stage ≥ Verified (§8) | Finish, and turn the finish into evidence |
| 6 | **Specialist** | 12,000 | **3 skills at Verified** in one `SkillCategory` **and** (2 completions **or** a hackathon result in the top 25%) | Depth in an area |
| 7 | **Distinguished Builder** | 25,000 | Stage **Advanced** in ≥ 1 skill **and** a hackathon Top 10 / finalist or better **and** 26 active weeks in the last 52 | Sustained, externally judged excellence |

Rules:

- **XP alone never levels you up.** The progress UI shows XP remaining **and**
  the unmet gates as action items: "2 steps to Builder: submit one project ·
  7,120 / 2,500 XP ✓".
- Gates for levels 5 to 7 depend on evidence (Phase 0). Until evidence is live,
  **V1 exposes levels 1 to 4 only**. Level 4+ users see "Proven Builder unlocks
  when verified skills launch," which is honest and sets up Phase 4.
- **No decay.** A level is a record of what you did. Levels drop only when a
  fraud or source reversal removes the XP or gate that earned them. That does
  not generate a notification; the admin action audit covers it.
- **Pseudo-levels are banned.** No "Level 7.3", no prestige, no infinite levels.
  After Level 7, progress is expressed through skill stages and signals.
- **Professionals (Program track, `UserType.PROFESSIONAL`)** get the same levels
  with no name changes. The names are professional enough, and one ladder keeps
  recruiter and candidate language consistent.

### 7.2 Economy sanity check (provisional numbers)

| Persona | Behavior | XP / month | Reaches |
|---|---|---|---|
| Casual student | 2 challenge days/week with proof | ~200 | L2 week 1; L3 month 4 (**day gate binds before XP**) |
| Committed learner | 5 cohort missions/week, medium, on time | ~1,200 | L3 month 1; L4 month 2 (with a project); L5 month 5 |
| Hackathon-first | Registers, warm-up quest, valid submission | ~450 in the hackathon month | L2 → L3 quickly; L4 via the submission gate |
| Grinder | 4 enrollments, everything every day | capped ~4,500 | Blocked at L4/L5 by build and completion **gates**, not XP |
| Winner | Committed learner + monthly hackathon wins | +1,500 per win | L6/L7 within about a year, and only with verified skills |

---

## 8. Skill progression model

### 8.1 Stages, derived purely from `SkillEvidence`

Stars are self-ratings, and self-rating was **removed end-to-end on 2026-09-09**
for good reason. Stages are computed, never chosen.

| Stage | Rule (all from evidence rows for one `CandidateSkill`) | Example for "Agentic AI" |
|---|---|---|
| **Claimed** | `claimedByCandidate` with 0 evidence | Added in profile |
| **Learning** | Enrolled in a program whose `ProgramSkill` includes it, **or** ≥ 1 `ACTIVITY_EVALUATION` evidence | Joined the Claude track |
| **Practicing** | Evidence weight sum ≥ 10 from `ACTIVITY_EVALUATION` | ~10 passed missions tagged to the skill |
| **Applied** | ≥ 1 evidence from a build: PROJECT/SHIP_IT activity or `HACKATHON` | Built an agent in the hackathon |
| **Verified** | ≥ 1 of: `CREDENTIAL` evidence (program completion teaching it) · `ASSESSMENT_SCORE` ≥ 70% · `HACKATHON` placement Top 25% using it | Completed the Claude challenge (50+ days) |
| **Advanced** | Verified **and** ≥ 2 **independent** source types **and** (assessment ≥ 85% **or** hackathon Top 10%) **and** latest evidence ≤ 12 months old | Verified + 90% assessment + a hackathon finalist agent |

`deriveSkillStage(evidence[]) → stage` is a pure function in the Evidence module
(**Shivansh**). Gamification reads the stage. V1 computes it at read time (tens
of rows per user). Phase 4 caches `CandidateSkill.stage` for recruiter filtering
(**Shivansh + Sohail** schema review).

### 8.2 Evidence strength (the recruiter-facing number)

Recommendation for T-146, which owns `CandidateSkill.evidenceScore` (0–100,
currently never written):

```
strength = min(100, Σ_evidence  w_source × w_activity × scoreRatio × recency ) + diversityBonus
  w_source:   CREDENTIAL 30 · ASSESSMENT_SCORE 25 · HACKATHON 25 · ACTIVITY_EVALUATION 3 · EXTERNAL 10
  w_activity: ActivitySkill.weight / 5 (1–10 → 0.2–2.0); 1.0 for non-activity sources
  scoreRatio: score/maxScore where present, else 1.0
  recency:    0.5 ^ (ageMonths / 18)   (18-month half-life)
  diversityBonus: +10 when ≥ 3 distinct sourceTypes
```

XP never decays. **Evidence strength does**, because recruiters care whether a
skill is current.

### 8.3 Per-skill display (candidate view)

```
Agentic AI                                   ● Verified
██████████████░░░░░  Strength 68 / 100       Next: Advanced — score ≥ 85% on an assessment
Evidence (5)
  ✓ ABTalks Claude Challenge — completed 55/60 days      Credential ABT-CC-7K2QX · 2026-08-30
  ✓ ViCoDathon 2 — Top 25%, team Nova                     Hackathon result · 2026-10-02
  ✓ 18 missions passed (Claude track)                     Auto-verified · latest 2026-08-29
Acquired: first evidence 2026-07-02 · Verified 2026-08-30 via program completion
```

### 8.4 Prerequisites (Phase 0, Evidence owner)

1. Implement `emitSkillEvidence` (upsert + `CandidateSkill` cache recompute),
   the P0-0 from plan 112.
2. Seed `ActivitySkill` for the four open cohorts and challenge `DailyTask.tags`
   (currently 0 rows).
3. Emit evidence on: `ActivityEvaluation` pass (per `ActivitySkill`),
   `enrollment.completed` (per `ProgramSkill`, sourceType `CREDENTIAL`),
   `AssessmentScore`, and hackathon placement (needs `HackathonProblem.skills`).
4. Idempotent historical backfill keyed by `sourceKey`, on a child branch first.
5. A drift check. Plan 112 §15 names "table central to the architecture went
   unwritten for months" as a process gap.

---

## 9. Quest system

### 9.1 Rules

- Every task maps to a §5 event with a verifiable source. **Tasks without a
  source row do not exist.**
- Progress is **derived** (count events in window), so it is replay-safe.
- No claiming step. Completion applies rewards automatically.
- Quests are **selected by segment** (§33). Nobody gets the same list.
- At most **1 active onboarding/career quest + 1 weekly quest** at a time.
  Monthly quests only exist inside the hackathon cycle.
- Quest XP is modest. The underlying actions already pay; the quest bonus
  rewards finishing the set.
- Rendered as **cards inside the Career Guidance daily mix** (T-224). A quest
  step takes the first slot; guidance recommendations fill the rest.

### 9.2 V1 onboarding and career quests

| Quest | Segment | Tasks (in order) | Reward | Targets |
|---|---|---|---|---|
| **First Steps** | New: no verified action | 1. Add headline + education (`profile.section_completed` basic, education) · 2. Join a track (`enrollment.started`) · 3. Pass Day 1 (`activity.passed`) · 4. Pass on 3 distinct days within 7 days of task 3 | +100 XP, badge *First Step* | 76.5% Day-1 cliff; 0.4% headline rate |
| **Hackathon Arrival** | `hackathon.registered`, no learning enrollment | 1. Confirm team or solo (roster complete) · 2. Add GitHub username · 3. **Warm-up**: pass 2 activities in the warm-up track (a short challenge/cohort tagged to the brief's skills) · 4. Submit repo + live URL that pass checks (`hackathon.submitted`) | +150 XP, badge *Warmed Up* at step 3 | 31% team submission rate; 5.3% hackathon → learning |
| **Comeback** | Dormant: had verified activity, none in 30 days | Verified activity on 2 distinct days within 7 days | +75 XP; at most once per 60 days | Reactivation of the 86 → 157 → 13k gap |

### 9.3 Later quests

| Cadence | Examples | Phase |
|---|---|---|
| **Weekly** (Mon 00:00 IST reset; 1 quest of 2–3 tasks, picked by segment) | "Pass 4 missions on 3 days" · "Finish Module 2 boss build" · "Do one mock interview and review its report" · "Complete an assigned assessment" | 3 |
| **Monthly** (hackathon cycle only) | "Register → warm-up → milestone deploy → final submission" | 3 |
| **Career** (long-running) | **Interview-Ready**: profile ≥ 80, 1 mock interview, 1 verified skill, 1 build. **Job-Ready** (openToWork only): Interview-Ready + résumé + apply to **1–3 jobs with ≥ 60% skill overlap** (0 XP for the applications themselves; the quest measures fit, not volume) | 4 |

### 9.4 Banned quest patterns

"Log in N days" · "Apply to N jobs" (unbounded) · "Add N skills" · "Get N
profile views" · "Invite N friends" (use qualified referrals only) · "Spend N SP" ·
any task an unverified user can finish in under a minute and repeat.

---

## 10. Streak system

### 10.1 Decision: the primary streak is **weekly**

| | Daily streak (today's hub card) | **Weekly building streak (proposed)** |
|---|---|---|
| Unit | IST day with a submission | IST ISO week (Mon–Sun) |
| "Active" means | any submission | verified activity on **≥ 2 distinct days**, **or** one T3+ event (build, completion, hackathon submission) |
| Pressure | daily, 365 chances a year to break | weekly, room for exams and festivals |
| Fit | challenge rules | students and working professionals alike |

**Keep** track-internal day streaks (`Enrollment.currentStreak` is part of
challenge leaderboard tie-breaks; cohort `EnrollmentProgress.currentStreak`).
**Replace** only the hub's cross-track daily card with the weekly streak
(Phase 3), so the hub shows one streak, not three.

### 10.2 Mechanics

| Mechanic | Rule |
|---|---|
| Grace | The current week is never "broken" until it ends (Sunday 23:59:59 IST). |
| **Freeze** | Earn 1 per **4 consecutive** active weeks; bank at most 2; **auto-applied** to a missed week. Shown as "Protected 1 week". |
| **Comeback** | A broken streak of ≥ 4 weeks triggers the Comeback quest. Copy celebrates the personal best; it never mourns the loss. |
| Personal best | `longestWeekStreak`, always shown next to current. |
| Rewards | **Badges only**, at 4 / 12 / 26 / 52 weeks. **Streak length never pays XP** (no farming, no anxiety loop). |
| Nudge | One opt-in in-app nudge on **Saturday** if the week has 1 of 2 days. **Off by default.** Never email. |
| What counts | Only events that can carry XP (§5.1). Views, logins and claims never count. |
| Admin-issued completions | Never count. |

### 10.3 Timezone

Week key = ISO week of `occurredAt` **in `Asia/Kolkata`**, computed with
`lib/date-utils.ts` helpers (`IST`, calendar-key math). `PROGRAM_TZ` is also IST
today. The engine uses one zone for all gamification periods and reads the IST
constant, never a hard-coded string. Users abroad (the US cohort) see IST week
boundaries labelled as such.

---

## 11. Badges (achievements)

### 11.1 Two layers, kept separate

| | **Badge** (gamification, new) | **CandidateAchievement** (existing bridge) |
|---|---|---|
| Purpose | Recognise a behavior; motivate | A professional accomplishment a recruiter can rely on |
| Audience | Candidate; public profile opt-in (Phase 4) | Recruiters (inspector ABTalks Evidence tab) |
| Examples | *4-Week Builder*, *First Step*, *Warmed Up* | "ViCoDathon 2026 — 2nd place, team Nova", "Completed Databricks cohort" |
| Link | A badge **may reference** a `CandidateAchievement` / `Credential` as its evidence | Unchanged |

### 11.2 Badge record

`name` · `description` · `criteria` (typed, §11.4) · `category` · `baseRarity` +
`measuredRarity` · `earnedAt` · `evidence` snapshot (`{sourceType, sourceId,
label, href}`) · `iconKey` (glyph + tier shape, §34) · share URL (Phase 3:
`/b/<publicCode>`, unguessable and revocable).

### 11.3 V1 catalog (14 badge families, 17 badges since Referral has 4 tiers; each answers "what behavior?")

| Category | Badge | Criteria | Behavior | Base rarity |
|---|---|---|---|---|
| Learning | **First Step** | First `activity.passed` | Cross Day 1 | Common |
| Learning | **Week One** | Verified activity on 7 distinct days | Return | Common |
| Learning | **Finisher** | 1 `enrollment.completed` | Finish a program | Uncommon |
| Learning | **Multi-Track Finisher** | 2 completions in different `LearningProgram`s | Breadth | Rare |
| Building | **First Build** | First passed PROJECT/BOSS_BUILD/SHIP_IT **or** valid hackathon submission | Ship | Uncommon |
| Building | **Shipped Live** | Hackathon submission whose live URL passed checks | Deploy, not just commit | Uncommon |
| Competition | **Hackathon Finisher** | `hackathon.submitted` (valid) | Submit, not just register | Common |
| Competition | **Hackathon Top 5** | Placement variant top5 or better | Excellence | Epic |
| Competition | **Hackathon Champion** | Placement variant winner | Excellence | Legendary |
| Career | **Profile Ready** | Completeness ≥ 80 **with** headline + education + ≥ 1 project | A recruiter-usable profile | Common |
| Career | **Interview Practice** | First `mock_interview.completed` | Practice | Common |
| Career | **Assessment Taker** | First `assessment.completed` | Respond to recruiter asks | Uncommon |
| Community | **Referral** bronze / silver / gold / platinum | 1 / 5 / 10 / 25 `referral.qualified` | Existing badges, migrated | Common → Epic |
| Starter | **Warmed Up** | Hackathon Arrival quest step 3 | Hackathon → learning | Common |

Phase 3 adds consistency badges (4/12/26/52-week builder), *Top 10% (season)*
and *Top 1% (season)* from frozen standings, and *Peer Reviewer*. Phase 4 adds
*Verified Skill*, *Specialist: <category>*, *Interview-Ready*.

**Rejected badges:** *Recruiter Viewed*, *Recruiter Shortlisted* (outside the
candidate's control; farmable; privacy); *GitHub Verified* (no verification
exists yet); *N Applications*; *Daily Login*; *Mentor* / *Community Champion*
(no data source until mentor/peer systems exist).

### 11.4 Criteria language: a closed set, not an expression engine

Stored as JSON, validated by a Zod discriminated union. **No eval, no DSL, no
SQL from admins.**

| `kind` | Params | Example |
|---|---|---|
| `event_count` | `eventType`, `count`, optional `filter` (whitelisted payload keys) | First Build |
| `distinct_days` | `eventTypes[]`, `days`, optional `withinDays` | Week One |
| `distinct_values` | `eventType`, `payloadKey`, `count` | Multi-Track Finisher |
| `week_streak` | `weeks` | 12-Week Builder |
| `level_reached` | `level` | — |
| `hackathon_placement` | `atLeast`: top10pct / finalist / top5 / third / second / winner | Champion |
| `season_percentile` | `board`, `atMost` | Top 1% (Phase 3) |
| `skill_stage` | `stage`, `count`, optional `categorySlug` | Specialist (Phase 4) |
| `profile_completeness` | `atLeast`, `requiredSections[]` | Profile Ready |
| `all_of` | `criteria[]` (depth ≤ 2) | Interview-Ready |

The admin editor has a **dry run**: "N users would earn this now" before saving.
Changing criteria on a shipped badge **bumps a version**. Existing holders keep
the badge (grandfathered), and the version is stored on `UserBadge`.

---

## 12. Rarity system

- **Base rarity** is set by the designer from difficulty. It is used until
  enough people could have earned the badge.
- **Measured rarity** = holders ÷ **eligible active candidates** (≥ 1 verified
  action in the last 180 days). **Not ÷ 13,020 accounts**, which would make
  everything look legendary because most accounts are dormant.
- Display measured rarity once the denominator is ≥ 200 **and** the badge has
  existed ≥ 30 days; otherwise show base rarity.
- Bands: > 40% **Common** · 15–40% **Uncommon** · 5–15% **Rare** · 1–5% **Epic** · < 1% **Legendary**.
- Recomputed **nightly** in the sweep (`BadgeDefinition.earnedCount`,
  `.measuredRarity`). Never per request.
- Competition badges tied to frozen season standings (Top 1%) are stable by
  construction. Their rarity reflects the percentile, not a moving population.
- Display: "Rare · held by 7% of active builders". Rarity is **text plus tier
  shape**, never color alone (§36).

---

## 13. Leaderboard system

### 13.1 Scale-aware decision

At 50 weekly actives, a global weekly XP board lists everyone and looks empty.
It shows the same 20 names and tells newcomers they are last. So:

| Board | Scope | Ranks by | Resets | Phase / flag |
|---|---|---|---|---|
| **Hackathon results** | Per event | Final evaluated score (§14.5) | Per event | **V1** (ViCoDathon 2 from placement credentials) |
| **Cohort rank** (existing data) | Per cohort | `EnrollmentProgress.pointsEarned`, then `percentCompleteBp` | Per cohort run | **V1**: shown as a percentile band below the top 10 |
| **Challenge leaderboard** (existing) | Per domain | daysCompleted → streaks | — | Unchanged |
| **Weekly board** | Everyone with ≥ 1 XP this week | Weekly XP, **excluding** backfill and placement XP | Monday IST | Built in V1, `ENABLE_LEADERBOARD_WEEKLY` **off** until WAU ≥ 300 |
| **Weekly leagues** | Groups of ~30 matched by level band | Weekly XP | Monday; top 5 promote, bottom 5 demote | Phase 3, when WAU ≥ 300 |
| **Rising Builders** | Joined ≤ 90 days | Monthly XP | Month | Phase 3 |
| **Most Consistent** | Everyone | Current weekly streak, then total active weeks in 26 | Rolling | Phase 3 |
| **Hackathon season** | Quarter | Sum of percentile points across hackathons | Quarter | Phase 3 |
| **Skill board** | Per skill | Evidence strength | Rolling 12 months | Phase 4 |
| **College board** | Colleges with ≥ 5 active members | **Median** weekly XP of active members **and** active-member count (two columns, no composite) | Month | Phase 4; candidate-facing only, **never a recruiter filter** |
| Global all-time XP | — | — | — | **Never** (§48) |
| City, friends | — | — | — | **Not now** (§48) |

### 13.2 Anti-domination mechanisms

Leagues matched by level band; Rising Builders bracket; placement and backfill
XP excluded from weekly boards (a one-off win doesn't sit on the weekly board);
weekly and monthly resets; percentile display ("Top 18%") below the top 10
instead of "Rank 214"; consistency boards reward showing up, which newcomers can
do from week 1.

### 13.3 Mechanics

- **Materialization:** `XpPeriodScore(userId, periodType, periodKey, xp,
  lastXpAt)`, upserted **in the same transaction** as the XP ledger. Index
  `(periodType, periodKey, xp desc, lastXpAt asc)`.
- **Read:** top N via the index; viewer rank via
  `count(*) WHERE xp > mine OR (xp = mine AND lastXpAt < mine)`. Both are cheap
  well past 1M rows. Wrapped in `unstable_cache` for 5 min, tag
  `board:<type>:<key>` (existing pattern).
- **Ties:** equal XP → whoever reached it first (`lastXpAt` asc) → `userId`.
  Deterministic and explainable.
- **Exclusions:** `deletedAt`, `disabledAt`, open **HIGH** `GamificationFlag`,
  users without a `CandidateProfile`, recruiter-role accounts, `@abtalks.dev`
  test accounts.
- **Display identity (privacy):** default is **first name + last initial**,
  with college **hidden**. Showing college is an explicit candidate opt-in
  (Phase 3). Public boards stay behind a sign-in wall until D-8 (privacy copy)
  is resolved. **Sohail decision.**
- **Season finalize:** 48 hours after period end (late-processed events
  settle), write `SeasonStanding` snapshots (Phase 3). Percentile badges read
  snapshots only, so badges never flicker.

---

## 14. Monthly hackathon system

Hackathons are the strongest acquisition loop by far (8,293 participants on
13k users), but they convert almost nobody into learning (5.3%). The monthly
cycle is designed to fix the conversion while making results trustworthy
enough to become recruiter evidence.

### 14.1 The cycle (monthly, one flagship)

| Stage | Week | Gamification | Owner-side prerequisite |
|---|---|---|---|
| Announcement | M-2 wk | Hub card; "Hackathon starts in N days" in Career Guidance | `Hackathon` registry row |
| Registration | M-2 → M | `hackathon.registered` → **Hackathon Arrival quest** | Exists (event-scoped since 2026-09-08) |
| Team formation | M-1 | Quest step: roster complete / solo confirmed | Exists (team codes) |
| **Warm-up** | M-1 | 2–3 short activities in a **78-native warm-up program** tagged to the briefs' skills → XP + *Warmed Up*; **this is the hackathon → learning bridge** | New `LearningProgram` per season (plan 104 shape) |
| Build period | M | Daily "build log" is **not** rewarded (unverifiable) | — |
| **Milestone** | M mid | Automated check: repo exists, public, ≥ 1 commit after build start, live URL responds → `hackathon.milestone_passed` +50 XP | `HackathonSubmissionCheck` |
| Final submission | M end | Required: **GitHub repo URL** and **live project URL**; configurable extras | Make `liveUrl` required (today optional in Zod) |
| Automated evaluation | +1 day | Checks gate eligibility (§14.3) | GitHub API (`GITHUB_API_TOKEN` exists) |
| AI pre-score | +2 days | Rubric score for all eligible submissions | `lib/anthropic.ts` |
| Peer review (3b) | +2–5 days | Each submitting team reviews 3 others → +XP weighted by agreement with judges | `HackathonPeerReview` |
| Community engagement | +2–5 days | **Community Choice** vote, 0% weight on placement | Phase 3b |
| Judging | +3–7 days | Shortlist judged by humans | `HackathonScore` |
| Results | +7 days | `hackathon.placed` → XP, badges, **Credential**, **CandidateAchievement**, **SkillEvidence** | `HackathonResult` |
| Profile evidence | same | Skill stages move; recruiter ABTalks Evidence tab updates | Evidence owner |
| Recruiter visibility | same | Placement is a recruiter-searchable signal (Phase 4 filter) | Shashank / Sohail |
| Next hackathon | +8 days | "Next: <name> registration opens" + Comeback-style quest for non-submitters | registry |

### 14.2 Submission requirements, extensible without code

`Hackathon.submissionRequirements` JSON, validated by a closed registry of field
kinds:

```json
{ "fields": [
  { "key": "repoUrl",  "kind": "github_repo", "required": true },
  { "key": "liveUrl",  "kind": "https_url",   "required": true },
  { "key": "aiLogUrl", "kind": "https_url",   "required": false },
  { "key": "demoVideo","kind": "video_url",   "required": false }
]}
```

Making a field mandatory next month is a data change, **not a deploy**. The
existing columns (`repoUrl`, `liveUrl`, `aiLogUrl`) remain. New kinds go into a
`fields` JSON column on a new append-only `HackathonSubmissionRevision`, which
also fixes the "overwrite in place, no history" gap.

### 14.3 Automated checks (eligibility gate, not score)

| Check | Pass rule | Fail → |
|---|---|---|
| Repo exists and is public | GitHub API 200, not private | Ineligible |
| **Head-start rule** (already in the rules copy) | First commit ≥ build start; or pre-existing code disclosed | Flag for judge review |
| Activity during window | ≥ 3 commits across ≥ 2 days in window | Warning |
| Contributors ⊆ team | Commit authors map to team members' GitHub usernames (best effort) | Warning |
| **Duplicate repo** | Normalized `owner/repo` unique per event; not a fork of another submission | Ineligible (both flagged) |
| **Frozen at deadline** | Record HEAD SHA at close; judges evaluate that SHA | — |
| Live URL | HTTPS 2xx/3xx within 10 s; not a known placeholder page | Ineligible for *Shipped Live*; warning for placement |
| Late | `updatedAt` > close | Not accepted (rules copy: "Late submissions don't count") |

### 14.4 Evaluation mechanisms considered

| Mechanism | Strength | Weakness | Used as |
|---|---|---|---|
| AI rubric (Claude) | Scales to 1,600+ submissions; consistent | Gameable by README prose; hallucination | **Pre-score for shortlisting** and 25% of the final score; a judge can override |
| Automated technical checks | Objective, cheap | Shallow | **Gate** |
| Human judges | Real judgment; credible to recruiters | Doesn't scale; per-judge bias | **60% of final** on the shortlist; ≥ 2 judges per entry; z-score normalized per judge |
| Peer review | Scales; engages participants; learning | Collusion; low effort | **15% of final** (Phase 3b); random assignment excluding own team **and** own college; median of 3; reviewers calibrated on 2 anchor submissions |
| Community voting | Engagement, sharing | **Popularity ≠ quality**; brigading; college size bias | **0% weight.** A separate *Community Choice* award only |
| GitHub analysis | Signals real building | Commit counts are gameable | Checks and judge context only, never score directly |
| Product metrics (users, uptime) | Real-world value | Needs telemetry; unfair to niche problems | Optional judge context |

### 14.5 Weighted hybrid

```
Eligible = all automated gate checks pass
Shortlist = top max(30, 15%) by AI pre-score   (judges may add wildcards)
Final (shortlisted) = 0.60 × judgeZ + 0.25 × AI + 0.15 × peer      (peer disabled → 0.70 / 0.30)
Non-shortlisted eligible: percentile from AI + peer only; placement band capped at "Top 50%"
Ties: judge component → AI component → earlier final submission
```

Community Choice: signed-in voters with ≥ 1 verified activity **before** the
hackathon started; 1 vote per voter; own team excluded; hourly velocity anomaly
detection; results published separately.

### 14.6 Team handling

- Hackathon submissions are **team-owned** (078 §3.4). XP and badges **fan out
  at window close** to members present at close, so a leaver's XP never needs
  reversing.
- **Full XP to each member**, not split. Splitting punishes collaboration, and
  team size is already capped by slots.
- A member who joined **< 48 h before close** gets participation XP, but
  placement XP is held for admin review (a collusion signal).
- Placement XP is **non-cumulative**: `hackathon.placed` pays the highest band
  achieved (winner 1,500 does not also pay Top 5 800). Submission XP (300) is
  separate.
- A result corrected after publishing produces a reversal of the prior
  placement transaction plus a new one. The idempotency key includes the
  placement band.
- **Phone-verified** participants only (MSG91 already exists) for placement XP
  and leaderboard eligibility. This is the main multi-account defense.

### 14.7 Hackathon schema (owner-confirmed, Phase 3; V1 needs none)

`Hackathon` (registry: `eventId` pk, name, windows, status,
`submissionRequirements`, `rulesVersion`) · `HackathonProblem.skills` (skill
ids) · `HackathonSubmissionRevision` (append-only) · `HackathonSubmissionCheck`
(per check, per run) · `HackathonScore` (team × judge × criterion) ·
`HackathonPeerReview` · `HackathonResult` (team: finalScore, rank, percentile,
band, publishedAt, version). The `HackathonEvent` singleton and code config
retire into the registry. The legacy `eventId = "legacy"` becomes a registry row.

---

## 15. Cohort gamification: journeys, not courses

```
Cohort ─► Modules ─► Daily missions (Activity) ─► Module boss build (BOSS_BUILD) ─► Final project
   │           │              │                          │                             │
   │           │              └─ XP (Learning) ──────────┴─ XP (Building) ─────────────┤
   │           └─ module complete marker                                                 │
   └──────────────────────────────────────────────── Credential ─► SkillEvidence ─► skill stage ↑
```

**Cohort progress panel** (per enrollment, reads existing cache):

| Element | Source |
|---|---|
| Progress % | `EnrollmentProgress.percentCompleteBp` |
| Days / missions completed | `completedActivities` / `totalActivities` |
| Current streak (cohort days) | `EnrollmentProgress.currentStreak` |
| XP earned in cohort | `XpTransaction` filtered by enrollment (payload) |
| Skill XP / stage per cohort skill | `ProgramSkill` + evidence stage (Phase 4) |
| Cohort rank | Top 10 → "#4 of 50"; otherwise "Top 30%" |
| Milestones | Week 1 ✓ · Halfway ✓ · Boss Build ○ · Final project ○ · Completed ○ |
| Badges earned in this cohort | `UserBadge.evidence.sourceId` ∈ enrollment |
| Remaining | "9 missions · 1 boss build · final project" |

No new cohort tables. Milestone markers are derived from activity positions and
types. **All four open-cohort copies read the same cache**, so the panel is
written once.

---

## 16. Challenge gamification

Every challenge maps onto existing 078 fields. **No new challenge schema** is
needed for the metadata the prompt lists:

| Attribute | Field |
|---|---|
| Difficulty | `Activity.difficulty` |
| Estimated time | `Activity.estimatedMinutes` |
| Skills tested | `ActivitySkill` (**seed it; Phase 0**) |
| XP | **Computed preview** from §6 ("≈ 45 XP"), never stored per activity |
| Badge eligibility | Badges whose criteria reference the activity type or program |
| Verification method | `verificationSpec` / mission type / `ExternalSubmissionConfig` → shown as "Auto-checked", "Repo-checked", "AI-graded", "Self-reported" |
| Submission requirements | Typed activity config |
| Deadline | `dueOffsetDays` / cohort window |
| Leaderboard eligibility | Program-level flag (Phase 3) |

Challenge kinds, all modelled as a `LearningProgram` + `Cohort` (**078-native,
per CLAUDE.md**):

| Kind | Cohort shape | Phase |
|---|---|---|
| Daily challenge (existing 60-day) | ROLLING | Exists |
| Weekly skill challenge | FIXED, 7-day window, 3–5 activities | 3 |
| Hackathon warm-up | FIXED, pre-hackathon window | 3 (first one can be hand-built for V1's Hackathon Arrival quest) |
| Cohort challenge / boss build | Inside a cohort | Exists |
| Company-sponsored / hiring challenge | FIXED + organization ownership + recruiter visibility | 5 (needs recruiter-side owners) |

**Self-reported** challenge days (no proof) stay allowed, because they are the
bulk of engagement, but are labelled as such and weighted 0.4 in XP (§6.1).
Coding-execution challenges need a sandbox (plan 112 "Later").

---

## 17. Reputation system

### 17.1 Recommendation: no single public score

A "Reputation 742 / 1000" is rejected, for five reasons:

1. **Not enough signal yet.** 0 evidence rows and 157 monthly actives. A score
   would mostly measure platform tenure.
2. **Anchoring.** Recruiters would sort by it and stop reading evidence, which
   undoes the product thesis ("what has this person actually done?").
3. **Goodhart plus gaming.** One number becomes the target.
4. **Fairness.** Composite scores silently encode access to free time, college
   resources and English fluency. Scout already hard-gates protected attributes;
   a composite would be a proxy leak.
5. **Explainability and DPDP exposure.** Automated profiling that affects
   employment opportunity needs to be explainable per dimension.

### 17.2 Instead: **Proof Signals**, multidimensional bands with reasons

| Signal | Inputs | Band rule (example) | Excludes |
|---|---|---|---|
| **Evidence strength** (per skill) | §8.2 | Emerging < 30 ≤ Established < 60 ≤ Strong | Self-claims |
| **Builder** | Verified builds: passed projects, SHIP_IT, valid hackathon submissions (12 mo) | 0 / 1 / 2–3 / 4+ | Self-added projects |
| **Completion** | Programs completed ÷ programs where Day 1 was passed (lifetime), plus credentials | — | Enrollments never started (don't punish exploring) |
| **Competition** | Best hackathon percentile in 12 months | Participated / Top 50% / Top 25% / Top 10% | Community Choice |
| **Consistency** | Active weeks in last 26 | < 4 / 4–12 / 13+ | Logins |
| **Career readiness** | Profile ≥ 80, mock interview, assessment completed, résumé | checklist count | Applications |

- **Candidate sees** all signals, their band and "how to move up."
- **Recruiter sees** bands with provenance on hover ("Builder: Strong — 3
  verified builds: ViCoDathon 2 repo, Snowflake Day 15 SHIP_IT, …").
- **Search ranking** may use the numeric features behind the bands as
  **features**, not as a displayed score. This is a Sohail/Shashank decision
  with an explicit fairness review.
- **Recruiter interactions never feed signals** (views, shortlists, unlocks).
  They create rich-get-richer loops and measure popularity. Structured
  post-interview recruiter evaluations could become a signal later (Phase 5),
  with consent.
- **Platform behavior** (flags, reversals) affects **eligibility**, not a
  visible "trust" number. A candidate under an open HIGH flag is simply excluded
  from boards and badge awards until reviewed.

Stored as a nightly `CandidateSignalSnapshot` (Phase 4). Never computed per
recruiter request.

---

## 18. Candidate profile integration

**Own profile (`/profile`, Shivansh).** Add a **Progress strip** above the
report card:

```
Builder · Level 4                  2,940 XP    ▸ 2 steps to Proven Builder
[██████████████░░░░░░]                          · Complete one program   · Verify one skill
Weekly streak 6 (best 9) · 1 week protected     Badges 7  ▸ view all
```

Plus, inside existing sections (no new sections): **Skills** show stage chips
from evidence (Phase 4); **Evidence & accomplishments** gains the badge shelf
(top 6 by rarity, then "all"); **Recent milestones** (last 5 of level-ups,
badges, completions, placements).

- Profile completeness **stays a UX number that gates nothing**. Its sections
  only emit one-time `profile.section_completed`.
- CTA copy comes from the next-level gates, most attainable first ("Add a
  project → closer to Builder"), never "Earn XP."
- **Public profile** (`/students/[id]`): level and up to 6 badges, **opt-in**
  (Phase 4).
- **Recruiter signals the candidate sees** (private): "3 recruiters viewed your
  profile this month" (T-251 data), "Shortlisted for 1 project" if D-8 allows.
  **Never** XP, never badges.

---

## 19. Recruiter integration

**Rule: gamification improves recruiter decisions by making evidence legible.
It never inserts engagement metrics into hiring.**

| Recruiter surface | Gets | Never gets |
|---|---|---|
| Scout / search filters (Phase 4, Shashank + Sohail) | Verified skill (stage ≥ Verified) · skill stage · hackathon result band · programs completed · verified builds ≥ N · evidence strength band · assessment score (recruiter's own) · **active in last 30 days** · open to work / availability | XP · level · streak · badge count · leaderboard rank · consistency as a filter |
| Candidate inspector (ABTalks Evidence tab) | Signal bands with provenance; hackathon results; completion credentials | Gamification badges (except those that are `CandidateAchievement`s) |
| Scout dossier / `score-candidate.ts` | Evidence-derived features, **if** the ranking owner adopts them after a fairness review | Anything from §5.2 |
| Recruiter analytics | — | Candidate XP |

**Recency:** "active in the last 30 days" is a legitimate availability signal
and is shown as a fact, not a score. **GitHub verified** becomes a filter only
after an ownership verification exists (Phase 4). A typed username proves
nothing.

---

## 20. Evidence integration

```
Activity passed ──► ActivityEvaluation ──► emitSkillEvidence(per ActivitySkill)      ┐
Program completed ─► Credential ──────────► emitSkillEvidence(per ProgramSkill)       │ Evidence module
Assessment scored ─► AssessmentScore ─────► emitSkillEvidence(per question skill)     │ (Shivansh)
Hackathon result ──► HackathonResult ─────► emitSkillEvidence(per HackathonProblem.skills)┘
                                              │
                                              ▼
                           CandidateSkill cache (strength, verified, count, last)
                                              │ skill_evidence.added / skill.stage_changed
                                              ▼
                             Gamification engine: level gates, badges, quests   (read-only consumer)
```

Worked example (the prompt's Agentic AI case), as a recruiter sees it:

```
Agentic AI — Verified · Strength 72 (Strong)
  ABTalks Agentic AI Cohort — completed 2026-10-14 · Credential ABT-CH-4MX9P (verify ↗)
     31/31 missions (auto-checked) · Boss build: AI-graded 86/100 · Final project: judge-reviewed 78/100
  ViCoDathon 2 — Top 10% (team Nova) · repo @ a41c9e2 (↗) · live (↗)
  Recruiter assessment "LLM Engineer screen" — 88%
Verification sources: auto-checks, AI rubric + human override, hackathon judges, assessment
```

**Gamification never writes evidence and never changes evidence strength.** It
only listens. That keeps the recruiter-facing layer free of engagement
incentives, and switching gamification off changes nothing a recruiter sees.

---

## 21. Personalized home dashboard

The hub (`/dashboard`) answers **"What should I do next?"** Order is hierarchy,
built mobile-first at 390 px:

```
┌──────────────────────────────────────────────┐
│ Good afternoon, Sarthak                       │
│ Builder · Level 4         2,940 / 6,000 XP    │
│ [███████████░░░░░░░░░]                        │
│ 2 steps to Proven Builder ▸                    │  ← gates, tappable
├──────────────────────────────────────────────┤
│ NEXT UP  (Career Guidance mix, quest first)   │
│ ▸ Continue Snowflake — Day 9 mission  ≈45 XP  │  ← quest step / continue
│ ▸ Hackathon Arrival 2/4: warm-up mission      │
│ ▸ Your profile is 72% — add a project         │
├──────────────────────────────────────────────┤
│ ViCoDathon 3 starts in 4 days  [Register]     │  ← only if relevant
├──────────────────────────────────────────────┤
│ This week ●●○  streak 6 (best 9) · 1 protected │
├──────────────────────────────────────────────┤
│ Recent: Badge "First Build" · Top 25% cohort  │
├──────────────────────────────────────────────┤
│ Continue journey (existing cards) …           │
└──────────────────────────────────────────────┘
```

- Rank statements are relative and positive only ("You're in the top 25% of
  your cohort"), never "You dropped 12 places."
- At most **one** hackathon card and **one** profile card. Career Guidance
  already caps the mix at 4.
- **Zero-state** (new user): no XP bar, no streak. One card: "Start here —
  First Steps (1/4)". Progression UI appears after the first verified action.
  An empty "0 XP" bar on day one reads as failure.
- Dormant user: Comeback quest first; the broken streak is not mentioned.

---

## 22. Notification strategy

### 22.1 Channels

- **In-app** (bell, `UserNotification`): all gamification notices, bundled.
- **Email:** only `hackathon.result_published`, `skill.stage_changed` → Verified,
  and `level.reached` for L4+ (default **off**, opt-in via
  `NotificationPreference`).
- **In-UI celebration** (not a notification): unseen `UserBadge.seenAt IS NULL`
  shows a modal on the next hub visit.
- No push; no push infrastructure exists.

### 22.2 Priority and frequency rules

| Priority | Event | In-app | Email |
|---|---|---|---|
| 1 | Hackathon result published | Immediate | Yes (default on) |
| 2 | Skill became Verified | Immediate | Opt-in |
| 3 | Level reached | Bundled | L4+ opt-in |
| 4 | Quest completed | Bundled | Never |
| 5 | Badge earned | Bundled | Never |
| 6 | Weekly streak at risk (Saturday) | Opt-in only | Never |
| 7 | Board movement ("Top 20% this week") | Weekly digest item only (Phase 3) | Never |

- **Bundling:** at most **1 gamification in-app item per user per IST day**:
  `dedupeKey = "gamification.digest:<userId>:<istDayKey>"`, updated with a count
  ("You earned 2 badges and reached Builder").
- **Email cap:** ≤ 1 gamification email per user per week (P1 exempt).
- **Never send:** "Only 240 XP to the next level," rank drops, streak lost,
  "you haven't logged in," or badges earned by backfill. Backfill sets `seenAt`
  and shows one summary: "We've credited your past work: Builder, 5 badges."
- **Registry entries** (Manuvrtti): `gamification.digest` (low),
  `hackathon.result_published` (important, suppression-exempt),
  `skill.verified` (important), `level.reached` (important,
  `defaultEmailEnabled: false`).

---

## 23. Social mechanics

| Mechanic | Recommendation | Why |
|---|---|---|
| **Share badge / result / level** | **Phase 3.** Public `/b/<code>` page + OG image; LinkedIn share text, reusing the challenge's LinkedIn template habit | Organic acquisition; students already post proof |
| **Build-in-public card** | **Phase 3.** Weekly auto-summary ("3 missions, 1 deploy") the candidate can share | Proof-of-work marketing, no likes needed |
| **Hackathon teams** | Exists. Add **team badges** (all members earn) | Collaboration |
| **College leaderboard** | Phase 4, candidate-facing, median-based, ≥ 5 active members | Campus ambassador motivation; guarded against size and proxy bias |
| **Community milestones** | Phase 3. "ABTalks builders shipped 1,000 live projects" on the hub | Belonging without comparison |
| Friend comparison / following | **Not now** | No social graph; privacy; low value at current scale |
| Challenge a friend | **Not now** | Spam vector; needs a social graph |
| Likes / upvotes on projects | **Never** as a reward input | Popularity ≠ proof |

---

## 24. Gamification loops

**Daily loop:** open hub → one Next-Up card (quest step or continue mission) →
pass a verified activity → XP toast with source ("+45 XP · Snowflake Day 9,
auto-checked") → the progress bar moves and the gate list updates → the next
card is already there.

**Weekly loop:** Monday: weekly quest assigned by segment → progress through the
week → 2-day activity keeps the building streak → Sunday close → (Phase 3)
league result, promote or stay → Monday reset, freezes banked.

**Monthly loop:** hackathon announced → register (Arrival quest) → warm-up
missions (learning bridge) → milestone deploy check → final submission (repo +
live) → checks + AI + judges (+ peers) → results board → placement badge + XP →
Credential + CandidateAchievement + SkillEvidence → recruiter-searchable
evidence → next hackathon teaser + Comeback quest for non-submitters.

**Career loop:** learn (activities) → build (projects, hackathons) → prove
(completion, assessments, placements) → verify (evidence stages) → improve
profile (gates show what's missing) → get discovered (signals in recruiter
search) → opportunity (outreach, assessment invite, job) → private career
signals feed back into the Career quest.

---

## 25. Anti-gaming and anti-abuse

### 25.1 Threats and controls

| Threat | Control |
|---|---|
| **Repeated submissions** | XP key `activity.passed:<userId>:<activityId>` — first pass only |
| Re-grade farming | Re-grades create evaluations, not payments; failing re-grade → reversal |
| **Fake projects** | Self-added `CandidateProjectEntry` = 0 XP. Only evaluated project activities and checked hackathon repos pay |
| **GitHub spam** | Commit counts never pay XP; milestone checks require the event repo; the program commit cron stays SP-only |
| **Duplicate repositories** | Unique normalized `owner/repo` per hackathon event; `Submission.githubUrl` already globally unique for challenges; fork-of-submission check |
| **Copied projects / plagiarism** | Frozen HEAD SHA; file-tree hash similarity across same-event submissions (Phase 3); AI-usage log field; judges see flags |
| **Fake referrals** | Qualify only at the referred user's Day-7 verified activity (existing); cluster flag: ≥ 5 referrals qualifying within 48 h, or all with identical college + graduation year + signup hour |
| **Mass job applications** | 0 XP, no badge, no quest step by count |
| **Multiple accounts** | Google OAuth + **verified phone required** for leaderboard eligibility and placement XP; one verified phone per account |
| **Automated activity** | Existing mission spacing (15 s, 30/day); velocity flag: > 10 passes in 10 minutes, or passes at a sub-human cadence |
| **Community-vote manipulation** | 0% placement weight; voter eligibility gate; 1 vote; hourly anomaly detection; votes from flagged accounts voided |
| **Team collusion** | Peer reviews exclude own team and college; judges z-normalized; members joining < 48 h pre-close → placement XP held |
| **Artificial streaks** | Only §5.1 events count; admin-issued completions excluded; backfill never extends *current* streaks |
| **Admin grants** | SP grants never create XP; manual XP adjustments bounded ±5,000 per action, reason required, audited |
| **Self-delete and re-signup** | New account starts at zero; phone reuse is flagged |

### 25.2 Structural guarantees

- **Idempotent processing:** unique `GamificationEvent.idempotencyKey`, unique
  `XpTransaction.idempotencyKey`, `UserBadge @@unique(userId, badgeId)`,
  `UserQuest @@unique(userId, questId, periodKey)`.
- **Atomic claim:**
  `UPDATE "GamificationEvent" SET status='PROCESSING', "lockedAt"=now(), attempts=attempts+1 WHERE id=$1 AND (status IN ('PENDING','FAILED') OR (status='PROCESSING' AND "lockedAt" < now()-interval '10 minutes')) RETURNING id`,
  the same pattern as `NotificationDelivery`.
- **Per-user serialization:** `SELECT … FOR UPDATE` on `UserProgress` inside the
  processing transaction, so two concurrent events for one user apply in order.
- **Retries:** max 5 attempts, then `DEAD`, visible in the admin event log with
  replay.
- **Rate limits:** candidates cannot emit events (**no public emit action
  exists**). Events come only from server-side domain writes and the sweep.
- **Caps** (§6.3) plus a daily hard ceiling that raises a flag.
- **Fraud flags:** `GamificationFlag` (kind, severity, details, status). HIGH
  pauses badge awards and board eligibility for that user until an admin
  reviews it; XP still accrues on hold so innocents lose nothing.
- **Reconciliation:** the sweep reverses XP whose source no longer qualifies
  (submission reset, credential revoked, evaluation flipped, hackathon
  disqualification).
- **Audit:** every manual adjustment, revoke, reversal, flag resolution and rule
  change goes through `writeAudit` with previous and new state.

---

## 26. Economy design

| Lever | Design |
|---|---|
| XP sources | 5 categories; §6.4 tiers; activity XP bounded by content unlock cadence plus daily soft cap |
| Distribution target | After shadow backfill: weekly XP p50 / p90 / p99 among actives within ~1× / 4× / 8×. Wider means caps are too loose |
| Level curve | Thresholds set so L2 ≈ 60% of activated users, L4 ≈ 15%, L6 ≈ 2%, L7 < 0.5% of active candidates at 6 months; gates do most of the limiting |
| Badge rarity | Measured monthly; a "Legendary" badge held by > 1% is re-tiered (criteria versioned, holders keep it) |
| Board normalization | Leagues by level band; percentiles; placement and backfill excluded from weekly XP |
| Reward frequency | Target a visible progress event (XP toast, quest step, badge) in ≥ 70% of sessions with a verified action, but **≤ 1 badge per week** for the median active user |
| Diminishing returns | Daily soft cap; repeat-program 0.25×; weekly caps on assessments and mocks; lifetime caps on setup |
| Inflation control | No XP from time or logins; no campaign multiplier above 2×, and campaigns limited to one category for ≤ 7 days |
| **Economy review** | Monthly admin report: XP issued by category, share hitting caps, level distribution drift, flag rate. Retune via `GamificationRule` rows. **Changes apply forward only; history is never rewritten** |

---

## 27. Reward system

| Type | Rewards | Notes |
|---|---|---|
| **Intrinsic** | Visible mastery (skill stages), progress bars toward real gates, evidence that grows, "you shipped a live project" | The core. Everything else supports it |
| **Status** | Levels, badges, tier shapes, season standings, placement credentials | Professional aesthetic; no titles beyond level names |
| **Functional** (Phase 3+) | **Unlocks:** advanced challenges at L4, early hackathon registration at L5, mentor office-hours seat at L6, beta cohorts. Stored as `RewardUnlock` with the gate that earned it | Access, not currency |
| **Opportunity** (Phase 4–5) | Hackathon results and verified skills surface in recruiter search; hiring challenges; company-sponsored projects; interview invites | Earned by evidence, never XP |
| *SP (existing)* | *Unchanged: marketplace, mock interviews* | Gamification does **not** mint SP. Awarding SP on level-up is a later product decision (Appendix A, G-4) |

**Monetary rewards are not the foundation.** Hackathon prizes exist and stay a
hackathon-owner concern, separate from the XP economy.

---

## 28. Admin gamification control center

Route: `/admin/gamification/*`. Access: Platform Admin (`UserRoleAssignment`
GLOBAL ADMIN) via `requireAdmin()`. All mutations are Server Actions in
`admin-gamification-actions.ts`: Zod-validated, transactional, `writeAudit` in
the same transaction.

| Page | Capabilities | Phase |
|---|---|---|
| **Overview** | Events/day by status, XP issued/day by category, level distribution, open flags, DEAD events | 1 (read-only) |
| **Event log** | Filter by type/status/user/date; payload view; **replay** FAILED/DEAD; **re-derive** a user from sources | 1 |
| **User inspector** | XP ledger, level + gates, badges, quests, flags. Actions: **manual XP adjust** (±, bounded, reason ≥ 10 chars), **reverse transaction**, **revoke badge** (reason), **recompute progress**, **hold/unhold** | 2 |
| **Rules** | XP values, multipliers, caps, enable/disable per rule; forward-only; shows "last changed by" | 2 |
| **Badges** | Create/edit (criteria editor constrained to §11.4 kinds), **dry-run count**, activate/deactivate, version | 2 |
| **Quests** | Create onboarding/weekly quests from event-backed task templates; segment; schedule; deactivate | 2 |
| **Flags queue** | Review, clear, action (hold, reverse XP, revoke badges, board exclusion) | 2 |
| **Seasons & boards** | Create/close seasons, finalize standings, exclusions, board visibility flags | 3 |
| **Hackathon rewards** | Map placement bands to XP/badges per hackathon; publish results | 3 |
| **Campaigns** | Time-boxed category multiplier (≤ 2×, ≤ 7 days), audited | 3 |
| **Analytics** | §32 dashboards | 2–3 |

**Every manual XP change** writes `AdminAction` with `actorUserId`,
`targetUserId`, `entityType: "XpTransaction"`, `entityId`, `reason`,
`previousState: {xpTotal, level}`, `newState: {xpTotal, level}`, and the
timestamp. The ledger row itself carries `createdByUserId` and `reason`.
**Nothing is ever deleted from the ledger**; reversal is a new negative row.

---

## 29. Database architecture

### 29.1 V1 tables (all additive; all cascade on user delete, per T-217)

```prisma
enum GamificationEventStatus { PENDING PROCESSING PROCESSED SKIPPED FAILED DEAD }
enum XpCategory { LEARNING BUILDING CAREER COMPETITION COMMUNITY }
enum GamificationFlagSeverity { LOW MEDIUM HIGH }
enum GamificationFlagStatus { OPEN CLEARED ACTIONED }
enum QuestCadence { ONBOARDING WEEKLY MONTHLY CAREER }
enum UserQuestStatus { ACTIVE COMPLETED EXPIRED }

/// Outbox + log. Written post-commit (after()) or derived by the sweep.
model GamificationEvent {
  id             String                  @id @default(cuid())
  userId         String
  /// Registry key, e.g. "activity.passed". String, not enum (NotificationEventKey precedent).
  type           String
  /// Source table name, e.g. "ActivityEvaluation". Polymorphic, no FK (Credential precedent).
  sourceType     String
  sourceId       String
  idempotencyKey String                  @unique
  /// Domain time, never insert time. Drives period and week keys.
  occurredAt     DateTime
  /// Bounded, Zod-validated per type. No PII.
  payload        Json?
  status         GamificationEventStatus @default(PENDING)
  attempts       Int                     @default(0)
  lockedAt       DateTime?
  lastError      String?
  /// True when created by a historical backfill — no notifications, no weekly-board XP.
  isBackfill     Boolean                 @default(false)
  processedAt    DateTime?
  createdAt      DateTime                @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([status, createdAt])
  @@index([userId, occurredAt(sort: Desc)])
  @@index([type, occurredAt(sort: Desc)])
  @@index([sourceType, sourceId])
}

/// Append-only. SUM(amount) per user is the true XP. Never updated, never deleted.
model XpTransaction {
  id              String     @id @default(cuid())
  userId          String
  amount          Int
  category        XpCategory
  ruleKey         String
  eventId         String?
  sourceType      String
  sourceId        String
  idempotencyKey  String     @unique
  /// Set on a reversal row; unique so a transaction is reversed at most once.
  reversesId      String?    @unique
  isBackfill      Boolean    @default(false)
  reason          String?
  createdByUserId String?
  createdAt       DateTime   @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt(sort: Desc)])
  @@index([sourceType, sourceId])
  @@index([createdAt(sort: Desc)])
}

/// CACHE. Source of truth: XpTransaction + gate queries. Nightly spot-recompute.
model UserProgress {
  userId            String    @id
  xpTotal           Int       @default(0)
  level             Int       @default(1)
  levelReachedAt    DateTime?
  weekStreak        Int       @default(0)
  longestWeekStreak Int       @default(0)
  lastActiveWeekKey String?
  streakFreezes     Int       @default(0)
  /// Fraud/admin hold: badges and board eligibility paused; XP still accrues.
  heldAt            DateTime?
  recomputedAt      DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([level])
}

/// Leaderboard materialization. periodType WEEK|MONTH (String), periodKey "2026-W41" | "2026-10" (IST).
model XpPeriodScore {
  id         String   @id @default(cuid())
  userId     String
  periodType String
  periodKey  String
  xp         Int      @default(0)
  lastXpAt   DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, periodType, periodKey])
  @@index([periodType, periodKey, xp(sort: Desc), lastXpAt])
}

model BadgeDefinition {
  id             String      @id @default(cuid())
  /// Frozen once shipped.
  slug           String      @unique
  name           String
  description    String
  category       String
  baseRarity     String
  /// Zod discriminated union (§11.4). Never an expression.
  criteria       Json
  criteriaVersion Int        @default(1)
  xpReward       Int         @default(0)
  iconKey        String
  isActive       Boolean     @default(true)
  isHidden       Boolean     @default(false)
  sortOrder      Int         @default(0)
  earnedCount    Int         @default(0)
  measuredRarity String?
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt
  holders        UserBadge[]
}

model UserBadge {
  id              String          @id @default(cuid())
  userId          String
  badgeId         String
  criteriaVersion Int
  earnedAt        DateTime
  sourceEventId   String?
  /// Snapshot {sourceType, sourceId, label, href}.
  evidence        Json?
  seenAt          DateTime?
  revokedAt       DateTime?
  revokedReason   String?

  user  User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  badge BadgeDefinition @relation(fields: [badgeId], references: [id], onDelete: Restrict)

  @@unique([userId, badgeId])
  @@index([badgeId, earnedAt])
  @@index([userId, earnedAt(sort: Desc)])
  @@index([userId, seenAt])
}

model QuestDefinition {
  id          String       @id @default(cuid())
  slug        String       @unique
  name        String
  description String
  cadence     QuestCadence
  /// Segment key from §33, null = everyone eligible.
  segment     String?
  /// Array of {taskKey, label, eventTypes[], count, distinctDays?, withinDays?, filter?}. Zod-validated.
  tasks       Json
  xpReward    Int          @default(0)
  badgeSlug   String?
  startsAt    DateTime?
  endsAt      DateTime?
  isActive    Boolean      @default(true)
  sortOrder   Int          @default(0)
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  userQuests  UserQuest[]
}

model UserQuest {
  id          String          @id @default(cuid())
  userId      String
  questId     String
  /// "once" for ONBOARDING/CAREER; ISO week / month key otherwise.
  periodKey   String
  status      UserQuestStatus @default(ACTIVE)
  /// CACHE of derived per-task progress.
  progress    Json
  startedAt   DateTime        @default(now())
  completedAt DateTime?

  user  User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  quest QuestDefinition @relation(fields: [questId], references: [id], onDelete: Restrict)

  @@unique([userId, questId, periodKey])
  @@index([userId, status])
}

/// Runtime-tunable rules (PlatformConfig registry pattern: typed keys in code, values in rows).
model GamificationRule {
  key             String     @id
  eventType       String
  category        XpCategory
  /// Flat amount; null = formula (§6.1).
  xpAmount        Int?
  /// Basis points applied to formula output. 10000 = 1.0×.
  multiplierBp    Int        @default(10000)
  dailyCap        Int?
  weeklyCap       Int?
  lifetimeCap     Int?
  isActive        Boolean    @default(false)
  updatedByUserId String?
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
}

model GamificationFlag {
  id               String                   @id @default(cuid())
  userId           String
  kind             String
  severity         GamificationFlagSeverity
  status           GamificationFlagStatus   @default(OPEN)
  details          Json?
  sourceEventId    String?
  reviewedByUserId String?
  reviewedAt       DateTime?
  resolution       String?
  createdAt        DateTime                 @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([status, severity, createdAt])
  @@index([userId, createdAt(sort: Desc)])
}
```

### 29.2 The prompt's list mapped to this design

| Requested | Decision |
|---|---|
| GamificationEvent | ✔ as above |
| XPTransaction | ✔ `XpTransaction` |
| UserXP, UserLevel, Streak | **Collapsed** into one `UserProgress` cache row (one lock, one read) |
| Achievement, UserAchievement | ✔ as `BadgeDefinition` / `UserBadge` (naming, §1.2 #12) |
| Quest, QuestTask, UserQuestProgress | `QuestDefinition` (tasks as validated JSON; ≤ ~20 quests do not justify a task table) + `UserQuest` |
| Leaderboard, LeaderboardEntry | `XpPeriodScore` (live) + `SeasonStanding` (frozen, Phase 3). Boards are code-defined queries, not rows |
| Season | Phase 3: `Season(id, type, key, startsAt, endsAt, status, finalizedAt)` + `SeasonStanding(seasonId, userId, rank, xp, percentile)` |
| Skill, UserSkill, SkillEvidence | **Reuse** `Skill`, `CandidateSkill`, `SkillEvidence`. No duplicates |
| Reputation | Phase 4 `CandidateSignalSnapshot(userId, computedAt, signals Json, version)` |
| Reward, RewardUnlock | Phase 3 `RewardUnlock(userId, rewardKey, gate, unlockedAt, revokedAt)`; rewards are code-registered keys |
| GamificationRule | ✔ |
| FraudFlag | ✔ `GamificationFlag` |
| GamificationAuditLog | **Reuse** `AdminAction` via `writeAudit` |

### 29.3 What is derived, not stored

Level gates status, quest task definitions' progress (cached in
`UserQuest.progress`, re-derivable), skill stage (V1), rank (query), rarity
(nightly cache), streak freezes' application (computed at week close, cached).

---

## 30. APIs

The codebase uses **Server Components + Server Actions**, with route handlers
only for crons and external callers. The prompt's REST shapes become:

| Prompt endpoint | ABTalks implementation | Auth |
|---|---|---|
| `GET /gamification/me`, `/progress` | `getMyProgress(userId)` loader in RSC | session (own data only) |
| `GET /gamification/quests` | `getMyQuests(userId)` (feeds Career Guidance picker) | session |
| `GET /gamification/achievements` | `getMyBadges(userId)` | session |
| `GET /users/:id/achievements` | `getPublicBadges(profileId)`, opt-in only (Phase 4) | public, only opted-in data |
| `GET /leaderboards` | `getBoard({ board, periodKey, viewerUserId, limit ≤ 50 })` | session (public boards wait on D-8) |
| `GET /skills/:skill/progress` | `getSkillProgress(userId, skillId)` in the **Evidence** module | session |
| `POST /admin/gamification/rules` | `upsertGamificationRuleAction` | Platform Admin |
| (new) mark badges seen | `markBadgesSeenAction({ ids })` | session; ids must belong to caller |
| (new) admin actions | `adjustXpAction`, `reverseXpTransactionAction`, `revokeBadgeAction`, `upsertBadgeAction`, `previewBadgeCriteriaAction`, `upsertQuestAction`, `resolveFlagAction`, `replayEventAction`, `recomputeUserProgressAction` | Platform Admin |
| (new) cron | `GET /api/cron/gamification-sweep` | `Bearer CRON_SECRET` |
| (Phase 3) share | `GET /b/[code]` page + OG image route | **public**: no `requireRole`, edge-safe middleware untouched |

All actions return `{ ok: true, data } | { ok: false, message }`, validate with
Zod, and use `select` in every Prisma query. **There is no action that lets a
client emit a gamification event.**

---

## 31. Event processing architecture

### 31.1 Recording (fast path)

```ts
// inside an existing domain action, AFTER the domain transaction commits
after(() => recordGamificationEvent({
  type: "activity.passed",
  userId,
  sourceType: "ActivityEvaluation",
  sourceId: evaluation.id,
  scopeKey: `${userId}:${activityId}`,
  occurredAt: attempt.submittedAt,
  payload: { activityId, enrollmentId, activityType, estimatedMinutes, difficulty, lateness, hasGithubProof },
}));
```

`recordGamificationEvent`: flag check → Zod-validate payload →
`INSERT … ON CONFLICT (idempotencyKey) DO NOTHING` → `processEvent(id)` →
catch everything, log `gamification.record.failed`, never rethrow.

### 31.2 Processing

1. **Claim** (atomic update, §25.2). Not claimed → return.
2. **Snapshot**: `UserProgress` (`FOR UPDATE`), user status (disabled/deleted →
   `SKIPPED`), active rules (cached 60 s in memory), counts needed by the rules
   touched by this event type (precomputed map of event type → rules, badges,
   quests).
3. **Evaluate** (pure) → `Effect[]`: `xp`, `periodScore`, `badgeAward`,
   `questUpdate`, `levelChange`, `streakUpdate`, `flag`.
4. **Apply** in one transaction on `writeClient()`: effects in fixed order; each
   insert is idempotent; `UserProgress` updated last.
5. **Mark** `PROCESSED`. On error: `FAILED`, `lastError` (truncated, no PII),
   attempts incremented; `DEAD` after 5.
6. **After commit:** bundled notification via `dispatch()`; structured log
   `gamification.event.processed` with type, XP and duration.

### 31.3 Failure isolation (the prompt's hackathon example)

The hackathon submission commits in its own transaction **before** any
gamification code runs. Gamification runs in `after()`; its failure is logged
and retried by the sweep. **The submission is never affected.** Hub and profile
loaders wrap gamification reads in try/catch plus a flag, so an outage hides a
panel and fails no page.

### 31.4 Sweep (daily, `30 20 * * *` UTC = 02:00 IST)

1. Derive, per source, rows with `createdAt/updatedAt ≥ now() - 48h`, then
   insert-if-missing events (batches of 500).
2. Process PENDING and FAILED (oldest first, time-boxed to 50 s, resumable next
   run).
3. Reconcile: sources that no longer qualify → reversal effects.
4. Week close (Monday run): streak finalize, freezes, weekly quest expiry.
5. Nightly caches: badge counts and rarity, `UserProgress` recompute for a
   rotating 1/7 of active users (drift check; mismatch → log + fix).
6. Emit `gamification.sweep.summary`.

The backfill command is the same derivers with `window = all` and
`isBackfill = true`, run from a script against a **child branch** first.

---

## 32. Analytics framework

### 32.1 Source of truth

**Server-side**: `GamificationEvent` plus source tables. GA4 is consent-gated
and client-side, so it would bias retention. GA4 is used only for UI
interaction events (quest card viewed/clicked, badge modal viewed, share
clicked), added to `ANALYTICS_EVENTS` by **Manuvrtti** under the existing
allowlist and bucket rules.

### 32.2 Definitions

- **Proof-Active User (PAU):** a user with ≥ 1 event from §5.1 in the window.
  **DAU/WAU/MAU are PAU-based**; logins don't count.
- **Retention D1/D7/D30:** among a signup-week cohort, the share with a verified
  action on day 1 / days 2–7 / days 8–30.

### 32.3 Metrics (baseline from 2026-09-16 where available)

| Area | Metric | Baseline |
|---|---|---|
| Activity | DAU / WAU / MAU (PAU) | – / 50 / 157 |
| Stickiness | DAU/MAU; users active ≥ 2 weeks in 30 days | – / 86 |
| Activation | Enrollment → Day-1 pass | 23.5% |
| Activation | Signup → first verified action (median days) | to measure |
| Profile | Headline / completeness ≥ 80 among PAU | 45 of 10,961 overall |
| Completion | Day-1 passers → completion | 92 reached day 60 |
| Hackathon | Registered → team complete → submitted → checks passed → placed | legacy teams 31% submitted |
| Cross-track | Hackathon participant → learning enrollment within 30 days | 5.3% lifetime |
| Evidence | SkillEvidence rows per PAU; time to first evidence | 0 |
| Recruiter | Profile views / shortlists per PAU; interview conversions | 53 view events total |
| Gamification | Quest start → complete; badge earn rates; streak survival curve; level distribution; weekly XP p50/p90/p99 and Gini; % XP capped; flag rate; notification CTR and opt-outs; leaderboard participation | new |

### 32.4 Funnels

```
Signup → First Steps quest started → headline+education → joined track → Day-1 pass
       → 3 days in week 1 → Week One badge → first build → completion → first evidence
       → hackathon submission → recruiter view → shortlist
```
```
Hackathon registered → team complete → warm-up 2 passed → milestone check → final submitted
       → checks passed → placed → learning enrollment ≤ 30 days → second hackathon
```

### 32.5 Measuring causality honestly

At ~329 signups a month, a per-user A/B holdout is under-powered. Use: (a)
**shadow-phase baseline** of 4+ weeks; (b) **cohort comparison by signup
month**; (c) a **hackathon-level natural experiment** (ViCoDathon 2 without the
Arrival quest vs ViCoDathon 3 with it); (d) a 10% holdout **only once monthly
signups exceed ~2,000**. Readouts must state the confidence level.

Admin analytics pages compute from indexed queries with 1-hour `unstable_cache`.
A `GamificationDailyStat` rollup table is added only if those queries exceed
1 s.

---

## 33. Segmentation

Segments are computed from facts, extending Career Guidance's `CandidateFacts`
with the gamification snapshot. Each user has one primary segment and optional
overlays.

| Segment | Rule | Focus (quests / cards) | Hidden until later |
|---|---|---|---|
| **New** | No verified action | First Steps; profile basics; one track | XP bar, streak, boards |
| **Hackathon-only** | Registered for a hackathon, no learning enrollment | Hackathon Arrival; warm-up; GitHub username | Boards |
| **Activated Learner** | ≥ 1 verified action, no build | Week One; weekly missions quest; first build | Leagues until L3 |
| **Builder** | ≥ 1 verified build | Complete a program; hackathon; verified skill | — |
| **Advanced** | L5+ or a Top-25% placement | Specialization, advanced challenges, peer review (Phase 3b), seasons | — |
| **Dormant** | History, no verified action in 30 days | Comeback only | Streak loss, rank |
| Overlay: **Job Seeker** | `CandidatePreference.openToWork` | Interview-Ready / Job-Ready career quests (Phase 4), mock interview, assessment | — |
| Overlay: **Professional** | `UserType.PROFESSIONAL` or Program member | Same ladder; boards opt-in by default | Public boards |

---

## 34. UI/UX recommendations

**Owner: Shallika** (design system, flows, responsive, visual QA). Follows
**Design System v2** as implemented in `src/app/globals.css` and
`components/dashboard-hub/nav-items.ts`: primary teal `#03535F`, `#F4F4F4`
ground, `#EEF6F6` tints, clay tiles, Outfit + Inter, light only.
`docs/design-system.md` still describes the retired orange system and should
not be used. Designs land before build, per plan 112 practice.

**Concept film:** [`assets/151-proof-film/`](assets/151-proof-film/README.md)
has an interactive page and mobile, web and Instagram MP4 cuts of the V1
journey, built on the v2 tokens with sample data.

| Concept | Recommendation |
|---|---|
| **Profile** | Progress strip (§18); badge shelf; skill stage chips; restrained typography, no mascots |
| **Dashboard** | §21 hierarchy; one primary CTA above the fold on mobile |
| **Leaderboard** | Table with your row pinned; top 10 names, then percentile bands; tabs Week / Cohort / Hackathon; empty state explains how to appear |
| **Badge modal** | Glyph in tier shape, name, one-line behavior, rarity text, **evidence link**, share (Phase 3). Fade-in only; no confetti except hackathon placement and L4+; reduced motion → no animation |
| **Skill evidence** | §8.3 layout; provenance line per item; verification-source icons with text labels |
| **Level progress** | Bar + "N steps" gate list; each gate is a link to the action |
| **Quest panel** | Card inside Career Guidance; step dots with text "2 of 4"; next step as CTA |
| **Cohort progress** | §15 panel; milestone rail |
| **Hackathon progress** | Stage rail (Registered → Warm-up → Milestone → Submitted → Checked → Results); checks shown with pass/warn text |
| **Notifications** | Bell item "Today: +2 badges · reached Builder"; tap opens a progress summary |
| **Recruiter view** | Evidence bands with provenance; **no** XP, levels or badges |
| **Badge visuals** | Monochrome line glyph; tier encoded by **shape** (Common circle · Uncommon rounded square · Rare hexagon · Epic shield · Legendary notched star) **plus** label; primary teal for earned, neutral for locked |
| **Avoid** | Coins, gems, chests, mascots, flashing, slot-machine reveals, countdown pressure, red "lost" states |

**Server vs Client** (for implementation plans): progress strip, quest card,
cohort panel, leaderboard table, admin lists are **Server Components**. Badge
celebration modal, leaderboard tabs, admin editors and the seen-marker are
**Client**. Props crossing the boundary are serialized data only: `iconKey`
strings (mapped to glyphs client-side), ISO date strings, numbers. **No Lucide
components, functions or class instances.**

---

## 35. Mobile responsiveness

- Mobile first at 390 px (project standard). Progress card ≤ 140 px tall;
  Next-Up list ≤ 3 items; everything else below the fold.
- Leaderboard on mobile: rank, name, value only; college and details in an
  expandable row. The table scrolls inside its own container.
- Badge shelf: horizontal scroll with snap on mobile; grid on tablet and desktop.
- Admin control center: desktop-first, but lists must not break the body width.
- No gamification element may push the Continue Journey card below the second
  screen on mobile.

---

## 36. Accessibility

- Progress bars: `role="progressbar"`, `aria-valuenow/min/max`, and
  `aria-valuetext="2,940 of 6,000 XP; 2 steps to Proven Builder"`.
- Unlocks announced once via `aria-live="polite"`; the modal traps focus and
  closes on Escape; the evidence link is reachable by keyboard.
- `prefers-reduced-motion`: no confetti, no count-up, no bar animation.
- Rarity and tier: **shape plus text**, never color alone; 4.5:1 contrast for
  text, 3:1 for tier outlines.
- Streak dots have text equivalents ("2 of 2 days this week").
- No time-pressure copy; nudges are opt-in.
- Tested with axe on hub, profile and board pages, and a manual screen-reader
  pass (VoiceOver iOS) on the badge modal.

---

## 37. Performance

| Concern | Approach |
|---|---|
| Core flows | Zero synchronous gamification work; `after()` only |
| Hub load | +3 indexed reads (`UserProgress` PK, active `UserQuest`, unseen `UserBadge`), run in the existing `Promise.all`; budget **+30 ms p95** |
| Rankings | Never global per request: top-N index scan + one count query, 5-min `unstable_cache` keyed by board and period |
| Rarity, drift, week close | Nightly sweep |
| Processing cost | Rules pre-indexed by event type; only badges and quests referencing the event type are evaluated |
| Writes | One transaction per event, ~6 statements; `UserProgress` row lock per user |
| Volume today | ~2,200 activity events/month → ~30k events/year. At 100× → ~3M/year: fine on these indexes |
| Growth path | Past ~50M `XpTransaction` rows, partition by month. `GamificationEvent` PROCESSED older than 180 days → drop `payload` (ledger is permanent). Past what `after()` + daily sweep can handle → queue consumer (§4.2) |
| Neon free-tier storage | Payloads capped at 1 KB (Zod); no raw text; retention policy above |
| Pagination | Ledger, events and boards cursor-paginated (limit ≤ 50) |

---

## 38. Feature flags

Env flags in `lib/feature-flags.ts` (Sohail review), read on the server and
passed to clients as props (existing convention). Runtime per-rule kill
switches live in `GamificationRule.isActive`.

| Flag | Controls | Default | Turn on when |
|---|---|---|---|
| `ENABLE_GAMIFICATION_EVENTS` | Record, process, sweep (shadow mode) | off | Phase 1 deploy |
| `ENABLE_XP_UI` | XP, levels, progress strip, hub card | off | Shadow calibration done |
| `ENABLE_BADGES_UI` | Badge shelf, modal | off | Catalog reviewed |
| `ENABLE_QUESTS` | Quest cards in Career Guidance | off | V1 |
| `ENABLE_GAMIFICATION_NOTIFICATIONS` | Bundled in-app items | off | V1 + 1 week |
| `ENABLE_HACKATHON_RESULTS_BOARD` | Per-hackathon results board | off | Results published |
| `ENABLE_LEADERBOARD_WEEKLY` | Weekly XP board | off | WAU ≥ 300 **and** D-8 resolved |
| `ENABLE_WEEK_STREAK` | Weekly streak replaces hub daily card | off | Phase 3 |
| `ENABLE_LEAGUES` | Weekly leagues | off | Phase 3, WAU ≥ 300 |
| `ENABLE_SKILL_STAGES` | Stage chips, levels 5–7 | off | Evidence live and backfilled |
| `ENABLE_CANDIDATE_SIGNALS` | Recruiter-facing signal bands | off | Phase 4 + fairness review |
| `ENABLE_COMMUNITY_VOTING` | Community Choice | off | Phase 3b |
| `ENABLE_GAMIFICATION_EMAIL` | Email channel for P1–P3 | off | After in-app proves low-noise |

---

## 39. Testing strategy

Follows repo conventions: `tsx` test files, `npm run test:gamification:*`
scripts, Prisma-injectable stores for logic tests, static source-scan tests for
architectural rules. **Integration tests run on a Neon child branch only, with
an explicit host allow-list check** (local `.env` is production).

| Layer | Cases |
|---|---|
| **Unit (pure)** | XP formula (every factor, clamps, fallback by type); daily soft cap boundaries (149/150/151, 299/300/301); repeat-program multiplier; level gates for every level, including "XP met, gate unmet"; IST week keys (Sunday 23:59:59 IST vs Monday 00:00 IST; UTC Sunday 18:29/18:30); streak freeze earn, bank limit and auto-apply; rarity bands and denominator threshold; every badge criterion kind; quest derivation (counts, distinct days, `withinDays`); board tie-break; idempotency key builders; payload Zod rejects PII-shaped fields |
| **Integration** | **Same event processed twice** (sequential and concurrent) → one XP row; two events for one user concurrently → correct total; **submission reset** → reversal; **re-grade to failed** → reversal; **badge revoked** → badge `xpReward` reversed, `UserBadge.revokedAt` set, re-award blocked while revoked; **manual XP reversal** → audit row with previous/new state; **user disabled** → events SKIPPED, excluded from boards; **user self-deleted** → cascade, boards clean; **team hackathon**: member removed before close gets nothing, member joined < 48 h gets held placement XP; **late submission** → no event; **leaderboard ties**; **season end**: events processed after period end land in the correct period, finalize after 48 h freezes standings; rule changed mid-week → forward only; backfill → no notifications, no weekly-board XP, no current-streak extension; sweep heals a dropped `after()`; DEAD after 5 failures and replay works |
| **Static / architectural** | `features/gamification/**` never imports `applyPointsChange` or `repositories/points` writes; every `recordGamificationEvent(` call site sits inside `after(`; `features/hire/**` never imports gamification XP/level; `event-types.ts` has no `server-only`/`@prisma/client` imports; no client-callable emit action exists |
| **Notifications** | Daily digest dedupe; P1 immediate; email cap; preference off respected |
| **Performance** | Child branch seeded with 1M `XpTransaction`, 200k `XpPeriodScore`: board top-50 plus viewer rank p95 < 150 ms; hub delta p95 < 30 ms; sweep processes 10k events in < 50 s batches |
| **Accessibility** | axe on hub, profile, board, badge modal; reduced-motion snapshot; keyboard path |
| **Browser verification** | Per the Scout loop lesson, offline suites miss seams: run the hub with a seeded child-branch user through First Steps end to end in the preview browser |

---

## 40. Phased implementation roadmap (adapted to the codebase and calendar)

> The prompt's suggested phases put skill progression in Phase 4. Here, **evidence
> is Phase 0**, because levels 5–7, verified skills and every recruiter benefit
> depend on it, and it is already a committed P0 of its own.

| Phase | When (proposed) | Scope | Exit criteria |
|---|---|---|---|
| **0 — Prerequisites** | Oct wk 1–2, after September UAT sign-off | **Evidence** (Shivansh): `emitSkillEvidence`, `ActivitySkill` seed, emit on pass/completion/assessment, backfill, drift check. **Hackathon** (owner TBD): `liveUrl` required; per-event repo uniqueness. **Sohail:** assign gamification owner; D-8 direction for boards; fix the production host guard constant | `SkillEvidence` > 0 and growing daily; drift check green |
| **1 — Foundation (shadow)** | Oct wk 2–4 | Tables (§29.1), event registry, recorder, processor, sweep cron, XP formula + rules seeded **inactive → active**, level computation (1–7), **historical backfill** on a child branch then production, admin Overview + Event log (read-only). No candidate UI | 2 weeks of shadow data; XP distribution reviewed; thresholds set from percentiles; zero domain-action regressions |
| **2 — V1 candidate experience** | Nov wk 1–3 | Hub progress card + gates (L1–4), First Steps / Hackathon Arrival / Comeback quests inside Career Guidance, 14-family badge catalog + modal, profile Progress strip, cohort progress panel, hackathon results board (placement credentials), bundled in-app notifications, admin user inspector / rules / badges / quests / flags, analytics pages | §V1.2 journey walkable on a preview; production smokes; guardrail metrics flat |
| **3 — Engagement + competition** | Nov wk 4 – Dec | Weekly streak replaces hub daily card; weekly quests by segment; **monthly hackathon system** (registry, revisions, checks, AI pre-score, judges, results, warm-up programs); seasons + standings + percentile badges; weekly board/leagues (if WAU ≥ 300); share pages; peer review + Community Choice (3b) | First fully gamified monthly hackathon run; submission rate and cross-track conversion measured |
| **4 — Professional proof** | Jan 2027 | Skill stages UI + levels 5–7; `CandidateSignalSnapshot`; recruiter filters on evidence signals (Shashank/Sohail, fairness review); public profile badges (opt-in); Interview-Ready / Job-Ready career quests; college board; functional unlocks | Recruiter shortlist rate on evidence-filtered candidates ≥ baseline |
| **5 — Intelligence** | Q1 2027+ | Personalized quest selection (contextual bandit over templates); fraud clustering; company-sponsored and hiring challenges; recruiter structured feedback as a signal (consent); holdout experiments once signup volume allows | Measured lift with stated confidence |

---

## 41. Migration requirements

- **All additive.** New tables and enums only. **No change** to
  `PointsTransaction`, `PointsAccount`, `SynergyEvent`, `Enrollment`,
  `Submission`, or any legacy table. Nothing in Phase 7 W1-B+ is touched or
  needed.
- Migrations follow whatever D-2 decision is in force (plan 112 §13).
  Checkpoint commit, Neon branch snapshot and commit hash noted before any
  schema apply (CLAUDE.md DB safety).
- Every new user-referencing FK is `onDelete: Cascade` (T-217 self-delete
  invariant); definitions use `Restrict` from holder rows.
- **Backfill** (`prisma/scripts/gamification-backfill.ts`, proposed): child
  branch first, then production with an explicit allow flag and a **correct**
  host check; batched `INSERT … ON CONFLICT DO NOTHING` (the 078 performance
  lesson: never per-row upserts); resumable by source and cursor; `isBackfill =
  true`; badges get `seenAt = now()`; no notifications; no current-week
  `XpPeriodScore`; streaks computed historically but the **current** streak only
  from the last 8 weeks.
- Rule and badge seed via an idempotent seed script
  (`npm run db:seed:gamification`), with `SEED_ALLOW_PRODUCTION` respected.
- Phase 3 hackathon migrations: `legacy` and `vicodathon-2-2026` become
  `Hackathon` registry rows; placement credentials map to `HackathonResult` with
  `version = 1`.

---

## 42. Scalability considerations

| Dimension | Now | Designed for | Upgrade trigger / path |
|---|---|---|---|
| Events | ~30k/yr | ~3M/yr on current indexes | > 10M/yr → monthly partitions, queue consumer |
| Processing latency | seconds (`after()`) / ≤ 24 h (sweep) | same | Users complain about next-day XP → second cron or queue |
| Boards | < 1k rows/week | 200k rows/period with index scan | > 1M/period → nightly `SeasonStanding` read model for top-N |
| Rules evaluation | < 30 rules, < 30 badges | ~300 | Per-type rule index already bounds cost |
| Admin analytics | direct queries | ~1M events | > 1 s → `GamificationDailyStat` rollups |
| Hackathon evaluation | 1.6k submissions per legacy event | 5k/month | AI pre-score batching with a daily token budget in `PlatformConfig` |

---

## 43. Security considerations

- **No client-originated events.** Rewards derive only from server-written
  source rows. There is no endpoint to "complete a task."
- **AuthZ:** candidates read only their own progress; public badge data only
  when opted in; admin surfaces require Platform Admin; the cron requires
  `CRON_SECRET`. Middleware is unchanged; any public share route is explicitly
  public.
- **Admin safety:** bounded adjustments, required reasons, and every mutation
  audited in the same transaction. Rule and badge edits are forward-only and
  versioned.
- **No expression engine:** criteria are a closed Zod union. No admin-authored
  code or SQL.
- **PII:** event payloads carry ids and enums only (Zod enforces an allow-list);
  logs follow the existing redaction scan (`test:observability:scan`); GA4 gets
  no ids or values.
- **Privacy / DPDP:** gamification data is personal data. Include it in DSAR
  export and self-delete. Board display defaults pseudonymous. College display
  is opt-in. Resolve D-8 before any public board.
- **Fairness:** college and city boards are never recruiter filters; signals
  undergo a protected-attribute proxy review before recruiter exposure (Scout's
  hard gate precedent).
- **Share URLs:** random codes, revocable, no user ids.
- **Sohail review required** for: schema, cron route, flags, admin authz, public
  share route, recruiter-facing signals.

---

## 44. Technical risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Evidence prerequisite slips → levels 5–7 and recruiter value stall | **High** (capacity gap) | High | V1 ships L1–4 without evidence; evidence is Phase 0 with its own owner |
| Double XP from dual-write paths | Medium | Medium | Single 078-side source; `userId:activityId` key; integration test |
| `after()` lost on function termination | Medium | Low | Daily sweep derives from sources |
| Rule tuning retroactivity disputes | Medium | Medium | Forward-only rules; visible "rule changed" admin log |
| Gamification reads crash hub on unapplied migration | Medium | High | Flag + try/catch around loaders; migration-applied check in smoke |
| Running scripts or tests against production from local env | Medium | **Severe** | Host allow-list in every script; child-branch-only integration tests; fix the stale guard constant |
| Four cohort copies drift and one misses the fast-path emit | High | Low | Sweep covers all; static test lists expected call sites |
| Neon free-tier storage growth from payloads | Low | Medium | 1 KB payload cap, 180-day payload trim |
| Vercel cron limits (daily only) | Known | Low | Design assumes daily; confirm plan limits before adding crons |
| Naming confusion (badges vs achievements vs credentials) | High | Medium | "Badges" in schema and UI; glossary in project-context on reconcile |
| Ownership vacuum for a cross-cutting module | **High** | High | §0.3; no Phase 1 without a named owner |

---

## 45. Product risks

| Risk | Mitigation |
|---|---|
| **Two numbers (SP and XP) confuse users** | SP appears only as the wallet chip and in marketplace/mock contexts; XP appears only in progress. Copy: "XP tracks progress · SP is what you spend." Decide by Phase 4 whether level-ups grant SP |
| Empty boards make the platform look dead | Boards gated on WAU ≥ 300; scoped boards (cohort, hackathon) first |
| Feels childish, loses professionals | Level names, tier shapes, no coins or confetti; professionals' boards opt-in |
| Overjustification: XP crowds out intrinsic motivation | XP always shown with its source; celebrate the artifact ("your repo passed checks") over the number |
| Anxiety and dark patterns | Weekly streaks, freezes, opt-in nudges, no loss copy |
| Hackathon cheating rises once results mean recruiter visibility | §14.3 checks, frozen SHA, judge normalization, placement holds |
| Recruiter distrust if engagement metrics leak into hiring | §19 hard rule + static test |
| College boards create pressure or class proxies | Median-based, ≥ 5 members, candidate-facing only, opt-in display |
| Team capacity (plan 112 ran a 26.4 dev-day gap) | Phased; V1 is about 3 dev-weeks after Phase 0/1; release valves: drop boards, then notifications, then cohort panel |
| Metrics can't prove lift at current volume | §32.5 honest methods; decide by guardrails as well as lift |

---

## 46. Metrics to evaluate success

**North star: Weekly Proof-Active Users (WPAU).** Baseline **50**.

| Metric | Baseline | 90 days after V1 (proposed, re-set after shadow phase) |
|---|---|---|
| WPAU | 50 | 250 |
| Enrollment → Day-1 pass | 23.5% | 40% |
| Users active ≥ 2 of the last 4 weeks | 86 | 300 |
| Hackathon team submission rate | 31% (legacy) | 45% |
| Hackathon participant → learning enrollment ≤ 30 days | 5.3% lifetime | 15% |
| Profiles with headline (among PAU) | ~0.4% overall | 50% of PAU |
| `SkillEvidence` rows per PAU | 0 | ≥ 3 |
| First Steps quest completion | — | 25% of new signups |
| Recruiter shortlists per 100 PAU | to measure | ≥ baseline |

**Guardrails (must not regress):** share of proofless challenge submissions;
flag rate < 2% of PAU; gamification notification opt-out < 5%; hub p95 +≤ 30 ms;
support complaints about fairness; recruiter-reported candidate quality.

---

## 47. Recommended MVP (summary; exact V1 in §V1)

**Phase 0 prerequisites + Phase 1 shadow foundation + Phase 2 candidate
experience**, built on the principle "no reward without a verifiable source
row." It targets the two measured weak points: the Day-1 cliff and the
hackathon-to-learning gap.

---

## 48. What NOT to build yet

| Not now | Why | Revisit |
|---|---|---|
| Single public reputation score | §17.1 | Never as a single number |
| Global all-time leaderboard | Permanent domination; empty at current scale | Never |
| Weekly global board / leagues **visible** | WAU 50 | WAU ≥ 300 |
| City boards | Location data sparse; low value | Phase 5 |
| Friends, following, challenge-a-friend | No social graph; spam vector | Phase 5+ |
| Community voting affecting placement | Popularity ≠ proof | Never (Community Choice only) |
| XP shop, spendable XP, a third currency | Inflation; confusion with SP | Never |
| SP minted by gamification | Money-path inflation | Phase 4 decision |
| Login rewards, streak-length XP | Rewards presence, creates anxiety | Never |
| Badges for recruiter views, shortlists, applications | Not candidate effort; farmable; privacy | Never |
| GitHub commit-count XP; LeetCode sync | Unverified, gameable; no ownership check | Phase 4 with verification |
| Mentor review, community contributions | No data source | After peer review proves out |
| Company-sponsored / hiring challenges | Needs recruiter-side owners and org model | Phase 5 |
| AI-personalized missions | Too few users to learn from | Phase 5 |
| Push notifications | No infrastructure; spam risk | Later |
| Admin expression-language rule builder | Security and correctness risk | Never; extend the closed criteria set |
| Queue or microservice infrastructure | Unneeded at ~30k events/yr | §42 triggers |
| Prize or monetary rewards tied to XP | Wrong foundation | Never |

---

## 49. Decision table

| Feature | User problem | Behavior encouraged | Business value | Complexity | Priority | MVP? |
|---|---|---|---|---|---|---|
| Evidence writer + ActivitySkill seed (Phase 0, Evidence owner) | "My work doesn't show as skills" | Finishing verified work | Recruiter trust; unlocks L5–7 and signals | M | **P0** | **Prereq** |
| Event outbox + processor + sweep | — | — | Everything below; analytics source | M | **P0** | **Yes** |
| XP ledger + formula + caps | "Am I making progress?" | Verified effort, sustainably | Engagement; economy control | M | **P0** | **Yes** |
| Levels 1–4 with gates | "What's my next milestone?" | First action, return, first build | Activation; retention | S | **P0** | **Yes** |
| Levels 5–7 | "What does mastery look like?" | Completion, verified depth | Recruiter-quality profiles | S (after evidence) | P1 | No (flagged) |
| First Steps quest | "Where do I start?" | Cross the Day-1 cliff | Activation (76.5% drop) | S | **P0** | **Yes** |
| Hackathon Arrival quest + warm-up program | "I registered, now what?" | Submit; start learning | Cross-track conversion (5.3%) | M | **P0** | **Yes** |
| Comeback quest | "I fell off" | Return | Reactivation | S | P1 | **Yes** |
| Weekly quests | "What should I do this week?" | Regular building | WAU | M | P1 | No |
| Badge catalog (14) + modal | "Recognition for real milestones" | Build, finish, practice interviews | Engagement; shareable proof | M | **P0** | **Yes** |
| Rarity (measured) | "Is this badge special?" | Harder goals | Status clarity | S | P2 | No (base rarity only) |
| Profile Progress strip | "What's missing?" | Profile quality, gates | Recruiter-usable profiles | S | **P0** | **Yes** |
| Cohort progress panel | "How am I doing in this cohort?" | Finish | Completion rate | S | P1 | **Yes** |
| Hackathon results board | "How did we place?" | Submit quality work | Hackathon credibility | S | **P0** | **Yes** |
| Hackathon registry + checks + judging + results | "Is judging fair?" | Real, original builds | Monthly loop at scale; evidence | L | P1 | No (Phase 3) |
| Peer review / Community Choice | "Engage beyond my team" | Reviewing others' work | Scale judging; community | M | P2 | No |
| Weekly streak + freezes | "Keep momentum without daily pressure" | Consistency | WAU; retention | S | P1 | No (Phase 3) |
| Weekly board / leagues | "How do I compare?" | Competition among peers | WAU (at scale) | M | P2 | Built flag-off |
| Seasons + standings + percentile badges | "Fresh start each month" | Newcomer competition | Retention | M | P2 | No |
| Skill stages UI | "How strong am I in X?" | Deepen skills | Recruiter signal | M | P1 | No (Phase 4) |
| Proof signals (multidimensional) | "Why would a recruiter pick me?" | Evidence across dimensions | Recruiter decisions | L | P1 | No (Phase 4) |
| Recruiter evidence filters | "Find verified builders" | — | Recruiter conversion | L | P1 | No (Phase 4) |
| Bundled in-app notifications | "Tell me what I earned" | Return to the hub | Re-engagement | S | P1 | **Yes** |
| Gamification email | "Tell me big news" | — | Re-engagement | S | P2 | No |
| Admin: event log, user inspector, adjust/revoke/reverse, rules, badges, quests, flags | "Fix mistakes and abuse" | — | Trust, operability | M | **P0** | **Yes** |
| Admin: seasons, campaigns, analytics depth | Tune the economy | — | Growth ops | M | P2 | Partial |
| Anti-abuse: idempotency, caps, flags, reconciliation | "The system is fair" | Honest effort | Trust; recruiter signal integrity | M | **P0** | **Yes** |
| Share pages / OG cards | "Show my proof on LinkedIn" | Build in public | Acquisition | M | P2 | No |
| College board | "Campus pride" | Campus-level activation | Ambassador programs | M | P3 | No |
| Functional unlocks | "What does leveling give me?" | Progress toward access | Retention | M | P2 | No |
| Personalized quest selection | "Relevant tasks" | — | Efficiency at scale | L | P3 | No |
| Global reputation score | — | Gaming the score | Negative | — | **Rejected** | No |

---

## 50. Final quality check: challenging this proposal

| Question | Honest answer | Redesign made |
|---|---|---|
| Can users exploit this? | The softest spot is proofless challenge days. Day locks limit the rate, V = 0.4, and the daily cap applies. Hackathon teams could collude. | Weighted verifiability; placement holds for late joiners; phone-verified placement XP; frozen SHA |
| Does it encourage spam? | Only where a count pays. | Removed application, view, login and skill-count rewards entirely; per-activity single payment |
| Does it create useful recruiter signals? | Only through evidence, which doesn't exist yet. | Made evidence Phase 0; banned XP from recruiter surfaces; signals are provenance-backed bands |
| Will new users understand it? | A bare XP number wouldn't mean anything to them. | Progress UI hidden until the first verified action; levels explained as gates ("2 steps to Builder"); one Next-Up surface |
| Can new users catch up? | All-time boards would block them. | No all-time board; weekly resets, leagues by level band, Rising Builders, percentile display |
| Will existing users dominate? | Backfilled veterans would top week 1. | Backfill XP excluded from period boards; seasons reset; placement XP excluded from weekly boards |
| Are rewards meaningful? | Badges become noise past ~20. | 14-badge V1 catalog, each tied to a behavior; ≤ 1 badge/week target; rarity measured against active users |
| Is the architecture scalable? | For 100× volume, yes; beyond that, the upgrade path is defined. | Outbox + transport-independent processor; partition and queue triggers |
| Are rules configurable? | Yes, within a closed criteria language. | `GamificationRule` rows, badge criteria union, quest templates; no deploy for values |
| Can admins reverse mistakes? | Yes: reversal rows, revokes, holds, replay, recompute. | Ledger never mutated; bounded manual adjustments |
| Can every reward be audited? | Yes: every XP row names its rule, source row and event; manual ops go to `AdminAction`. | — |
| Does it integrate naturally? | It reuses the 078 attempt spine, Credential, Career Guidance, notifications, the PlatformConfig pattern, audit and crons. | Quests inside Career Guidance, not beside it; badges named apart from achievements |
| Professional, not childish? | Depends on execution. | Shape-tier glyphs, no coins or confetti by default, level names about proof |
| Does each action strengthen proof of work? | Every XP source is a verified artifact or outcome; setup XP is capped at 160 lifetime. | Profile XP made one-time; zero XP for anything unverifiable |
| **Weak answer found:** leaderboards in V1 | At 50 WAU they hurt more than help. | V1 board = hackathon results + existing cohort ranks; weekly board built but flag-off until WAU ≥ 300 |
| **Weak answer found:** reputation | A single score would mislead. | Replaced by multidimensional Proof Signals, Phase 4 |
| **Weak answer found:** skill progression in V1 | Impossible without evidence rows. | Moved evidence to Phase 0; V1 levels capped at 4 |

---

# §V1 — ABTalks Gamification V1

## V1.1 Definition

V1 = **Phase 0 prerequisites (owned elsewhere) + Phase 1 shadow foundation +
Phase 2 candidate experience**, with these exact capabilities:

**Engine**
1. `GamificationEvent` outbox, recorder (`after()`), processor, daily sweep with
   derive / process / reconcile / nightly caches.
2. V1 event types: `activity.passed`, `enrollment.started`,
   `enrollment.completed`, `credential.issued` (incl. hackathon placement
   variants), `hackathon.registered`, `hackathon.submitted` (derived at window
   close), `profile.section_completed`, `assessment.completed`,
   `mock_interview.completed`, `referral.qualified`, `skill_evidence.added`
   (consumed if Phase 0 lands).
   **V1 hackathon validity** is two cheap checks run by the deriver at window
   close, not the Phase 3 suite: the repo URL answers a GitHub API request as
   public (reusing the challenge's HEAD-check approach and `GITHUB_API_TOKEN`),
   and the live URL returns 2xx/3xx within 10 s. Duplicate repos within the
   event are excluded. *Shipped Live* and the Builder gate read these results.
3. `XpTransaction` ledger with the §6 formula, caps and reversal;
   `GamificationRule` rows.
4. `UserProgress` with levels 1–4 (5–7 computed but hidden behind
   `ENABLE_SKILL_STAGES`).
5. `XpPeriodScore` maintained (weekly board flag-off).
6. Historical backfill (child branch → production).

**Candidate experience**
7. Hub progress card (appears after the first verified action) with next-level gates.
8. Quests in Career Guidance: **First Steps**, **Hackathon Arrival** (with one
   hand-built 78-native warm-up program for the next hackathon), **Comeback**.
9. 14 badge families (17 badges) with an unlock modal (reduced-motion safe) and a badge shelf on `/profile`.
10. Profile Progress strip.
11. Cohort progress panel (percentile rank, milestones) for 078-native and
    dual-written cohorts.
12. Hackathon results board for ViCoDathon 2 from placement credentials.
13. Bundled daily in-app gamification notification; P1 hackathon results
    notification.

**Operations**
14. Admin: Overview, Event log (replay), User inspector (adjust / reverse /
    revoke / hold / recompute), Rules, Badges (dry run), Quests, Flags queue.
    All audited.
15. Anti-abuse: idempotency keys, caps, daily ceiling flag, velocity flag,
    reconciliation, phone-verified placement XP.
16. Flags: `ENABLE_GAMIFICATION_EVENTS`, `ENABLE_XP_UI`, `ENABLE_BADGES_UI`,
    `ENABLE_QUESTS`, `ENABLE_GAMIFICATION_NOTIFICATIONS`,
    `ENABLE_HACKATHON_RESULTS_BOARD` (plus `ENABLE_LEADERBOARD_WEEKLY` and
    `ENABLE_SKILL_STAGES` built but off).

**Explicitly not in V1:** weekly streak (Phase 3), weekly quests, leagues or any
visible XP board, seasons, the hackathon registry and judging pipeline, skill
stage UI, recruiter-facing signals, share pages, email, college board.

## V1.2 The V1 journey, step by step

| Step (prompt) | What the user experiences in V1 | Built on |
|---|---|---|
| Signup | Lands on hub: one card, "Start here — First Steps (0/4)" | Career Guidance + `UserQuest` |
| Profile progression | Adds headline + education → step ✓, +50 XP (one-time) | `profile.section_completed` |
| First quest | Joins the Snowflake cohort → step ✓ | `enrollment.started` |
| Meaningful activity | Passes Day 1 mission (auto-checked) | `activity.passed` from `ActivityEvaluation` |
| XP | Toast: "+45 XP · Snowflake Day 1 · auto-checked"; progress card appears | ledger + `UserProgress` |
| Level progression | Reaches **Learner (L2)**; card shows "Practitioner: verified work on 7 days (1/7)" | level gates |
| Skill evidence | *(If Phase 0 landed)* evidence row per `ActivitySkill`; profile evidence section lists it | Evidence module |
| Achievement | Badge modal: **First Step** · Common · evidence link to the mission | `UserBadge` |
| Cohort/challenge progress | Cohort panel: 1/15 days, milestones rail, "Top 40% of cohort" | `EnrollmentProgress` |
| Leaderboard | Cohort percentile; after ViCoDathon 2, the **hackathon results board** | existing cache + credentials |
| Hackathon | Registers for the next hackathon → **Hackathon Arrival** quest; warm-up missions → **Warmed Up**; valid repo + live submission → +300 XP, **Hackathon Finisher**, **First Build**, **Builder (L4)** gate met | quests + derived `hackathon.submitted` |
| Profile improvement | Progress strip: "Builder · 2 steps to Proven Builder" (L5 teaser) | `UserProgress` |
| Recruiter-visible evidence | Placement credential + `CandidateAchievement` already appear in the Scout inspector's ABTalks Evidence tab; evidence rows if Phase 0 landed. **No XP or badges shown to recruiters** | existing bridges |

## V1-IMPL — template sections for the V1 implementation plans

Each slice below becomes its own `docs/plans/NNN-*.md` when scheduled.

### Slices

| # | Slice | Owner (to confirm) | Depends on |
|---|---|---|---|
| S0a | Evidence writer, ActivitySkill seed, emitters, backfill | Shivansh | — |
| S0b | Hackathon `liveUrl` required + per-event repo uniqueness | Hackathon owner | — |
| S1 | Schema (§29.1) + seed rules/badges/quests (inactive) | Gamification owner + Sohail review | — |
| S2 | Engine: registry, recorder, processor, XP formula, levels, badges, quests (pure + repo) | Gamification owner | S1 |
| S3 | Sweep cron + derivers + reconcile + backfill script | Gamification owner + Sohail review | S2 |
| S4 | Fast-path emits in owned modules (cross-module requests) | Each module owner | S2 |
| S5 | Admin control center (V1 pages) | Gamification owner | S2 |
| S6 | Candidate UI: hub card, quest cards, badge modal/shelf, profile strip, cohort panel, results board | Gamification owner + Shivansh (profile, guidance) + Shallika (design) | S2, designs |
| S7 | Notifications registry + digest | Manuvrtti | S2 |

### Files to touch (V1, indicative; each slice plan finalizes)

- `prisma/schema.prisma` **[edit]**: §29.1 models, relations on `User`
- `prisma/migrations/<ts>_gamification_foundation/` **[new]**: additive DDL
- `prisma/seed-gamification.ts` **[new]**: rules, 17 badges, 3 quests
- `prisma/scripts/gamification-backfill.ts` **[new]**: idempotent, host-guarded
- `src/features/gamification/**` **[new]**: §4.3
- `src/repositories/gamification.ts` **[new]**: Prisma boundary
- `src/app/api/cron/gamification-sweep/route.ts` **[new]**: bearer `CRON_SECRET`
- `vercel.json` **[edit]**: one cron entry (Sohail)
- `src/lib/feature-flags.ts` **[edit]**: §38 flags (Sohail)
- `src/app/actions/gamification-actions.ts` **[new]**: `markBadgesSeenAction`
- `src/app/actions/admin-gamification-actions.ts` **[new]**
- `src/app/admin/gamification/**` **[new]**
- `src/components/gamification/**` **[new]**
- `src/repositories/dual-write.ts` **[edit]**: `after()` emits, cross-module (Sohail)
- `src/repositories/{databricks,ds-architect,powerbi,snowflake}.ts` or their actions **[edit]**: `after()` emits, cross-module
- `src/features/certificate/*` **[edit]**: `after()` emit on issue, cross-module
- `src/app/actions/candidate-profile-actions.ts` **[edit]**: section-completed emit (Shivansh)
- `src/app/actions/assessment-attempt-actions.ts` **[edit]**: completed emit (Shivansh)
- `src/features/interview/platform/service.ts` **[edit]**: completed emit (Zainab)
- `src/features/career-guidance/{types,rules,pick-daily}.ts` **[edit]**: quest cards (Shivansh)
- `src/features/dashboard/get-hub-data.ts` + hub page **[edit]**: progress card (Shivansh / Shallika)
- `src/features/notification/event-types.ts` **[edit]**: registry keys (Manuvrtti)
- `package.json` **[edit]**: `test:gamification:*`, `db:seed:gamification`
- `docs/CHANGELOG.md` **[edit]**: one line per architecturally significant slice

### Guardrails for Cursor (DO NOT)

- DO NOT call `applyPointsChange` or write `PointsTransaction`, `PointsAccount`,
  `User.synergyPoints` or `SynergyEvent` from gamification code.
- DO NOT write `SkillEvidence`, `CandidateSkill`, `CandidateAchievement` or
  `Credential` from gamification code. The engine only reads them.
- DO NOT await gamification work in a domain action. Every emit goes inside
  `after(() => …)`, and `recordGamificationEvent` must never throw.
- DO NOT add a client-callable action or route that creates events or awards
  XP or badges.
- DO NOT write from any dashboard, profile or board read path. Gamification
  writes happen in `after()` and the cron only.
- DO NOT import anything gamification-related into `middleware.ts` or
  `auth.config.ts`; keep `event-types.ts` free of `server-only`,
  `@prisma/client` and `@/lib/*`.
- DO NOT expose XP, level, streak, badges or board rank on any `/hire`,
  `/talent` or recruiter surface, or in `score-candidate.ts`.
- DO NOT key idempotency on `ActivityEvaluation.id` for `activity.passed`. Use
  `userId:activityId`, so re-grades cannot pay twice.
- DO NOT derive verifiability from `evaluatorType`. Challenge dual-writes are
  recorded as `AUTO` with no proof check (§1.2 #1).
- DO NOT use `getCurrentDayNumber` or hard-code a timezone for week keys. Use
  the IST helpers in `lib/date-utils.ts`.
- DO NOT use savepoints or the pooled client in the processor; use `writeClient()`.
- DO NOT run the backfill, seed or integration tests against the host in local
  `.env`; it is production. Child branch plus an explicit host allow-list only.
- DO NOT add `requireRole`/`requireAdmin` to any public share route (Phase 3).
- DO NOT create abstraction files the slice plan doesn't list; do not refactor
  the four open-cohort copies.
- DO NOT modify another owner's module without the approved cross-module request.
- DO NOT pass Lucide icons or functions from Server to Client components; pass `iconKey` strings.

### DB safety (S1, S3)

1. `git add -A && git commit -m "checkpoint before gamification foundation"`; note the hash.
2. Neon: create a snapshot branch of production **and** a working child branch.
3. Apply the migration to the child branch; run `npm run db:seed:gamification`
   (rules inactive); run the backfill on the child; verify counts: events ≈
   authoritative passed evaluations + completions + credentials + hackathon
   rows; XP sums per user are deterministic across two runs (idempotency).
4. Apply to production per the D-2 migration path; seed; backfill with the
   explicit allow flag and host check; spot-check 20 users against the child
   results.
5. Keep `ENABLE_GAMIFICATION_EVENTS` off until the backfill completes, then on
   (shadow). UI flags stay off.

### Verification

- `npx tsc --noEmit` and `npm run build` pass; `npm run lint` clean on touched files.
- `npm run test:gamification:unit`, `:integration` (child branch), `:static` pass.
- Existing suites unchanged and green: `test:synergy-cap`, `test:078-points-writes`,
  `test:078-dual-write`, `test:078-progress`, `test:career-guidance`,
  `test:profile`, `test:notification-dispatch`, `test:observability`.
- Preview browser, seeded child-branch user: First Steps end to end; submit a
  mission → XP toast within seconds; kill `after()` (fault flag) → XP appears
  after a manual sweep run; hub renders with gamification tables absent (flag on,
  table missing) → panel hidden, page 200.
- Admin: adjust ±100 XP with reason → ledger row + `AdminAction` with previous/new
  state; revoke badge → reversal row; replay a DEAD event.
- Files changed match the slice plan's list exactly.

### Commit message (S1 example)

```
feat(gamification): additive foundation schema and seed (plan 151 S1)

Outbox events, XP ledger, progress cache, period scores, badges, quests,
rules and flags. Additive only; cascades on user delete. Rules seeded
inactive; no UI; ENABLE_GAMIFICATION_EVENTS off.
```

---

## Appendix A — Open decisions for Sohail

| ID | Decision | Recommendation |
|---|---|---|
| G-1 | Who owns the gamification module? | One owner for engine + admin; UI co-owned with Shallika |
| G-2 | Who owns hackathon (registry, judging, results)? | Name one owner before Phase 3; S0b is small and can go to whoever holds T-276 hackathon ops |
| G-3 | Public board display identity before D-8 closes | Signed-in only; first name + last initial; college opt-in |
| G-4 | Does level-up ever grant SP? | Not before Phase 4 economy review |
| G-5 | Phone verification required for placement XP and board eligibility? | Yes |
| G-6 | Start date | After September UAT sign-off; Phase 0 evidence first |
| G-7 | Recruiter use of signal features in ranking | Phase 4, with a documented fairness review |

## Appendix B — Baseline query provenance

Aggregates were read on 2026-09-16 through a `DIRECT_URL` session with
`default_transaction_read_only=on` (verified `on`). The queries were counts and
distributions only; no row-level or personal data was read or recorded. Re-run
the same aggregates at the start of Phase 1 to refresh the baseline.
