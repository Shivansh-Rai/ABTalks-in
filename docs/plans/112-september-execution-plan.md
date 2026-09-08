# 112 — September 2026 Product Execution Plan

> **Type:** Program execution document, not a Cursor implementation plan.
> Each P0 workstream below is handed to Cursor as its own numbered plan (`113`+)
> using the standard template in `CLAUDE.md`.
>
> **Written:** 2026-09-04 · **Revision 6:** 2026-09-05 — the full committed
> product is restored into September; nothing is deferred. Priority is execution
> order, not a deferral list. Revision 5's three changes stand:
> **Shallika joins as full-time UI/UX designer** (design now runs ahead of
> development and gates frontend work); **Sundays are holidays** (6, 13, 20 Sep);
> and the **deadline moves to 20 September**.
> **Hard deadline:** **2026-09-20** — which is itself a **Sunday**, so the product
> goes **live and verified on Saturday 19 September**. The 20th is the stated
> deadline date only; nobody works it.
> **Feature freeze:** **2026-09-15, 20:00 IST.**
> **Working days remaining from 5 Sep: 13, of which 10 are build days.**
> **Committed scope 60.4 dev-days against 34.0 effective — a 26.4-day gap, stated on the Delivery Risk sheet.**
> *(Historical note: revisions 1–4 targeted 20 and then 30 September with a
> 25 September freeze. Those dates are superseded.)*
> **Basis:** direct inspection of `master` @ `9294720` (964 TS/TSX files, ~168k LOC,
> 3,368-line Prisma schema), `docs/project-context.md` (reconciled through 2026-08-24)
> and the 60 unreconciled `docs/CHANGELOG.md` entries covering 2026-08-25 → 2026-09-04.

> **Day-to-day tracker:** [`assets/ABTalks-September-Execution-Tracker.xlsx`](assets/ABTalks-September-Execution-Tracker.xlsx)
> — 11 sheets. Developers live on **Team Execution Board**; everyone reads
> **How We Work** once before their first task; **AI Prompt Library** holds the
> twelve prompts they paste into Claude/Cursor. Plus User Journeys, E2E Tests,
> UAT written for a non-technical tester, Bugs, Milestones & Release, and
> Decisions & Risks.
>
> **Day-by-day view:** [`112-A-daily-task-board.md`](112-A-daily-task-board.md)
> — the same tasks laid out per day, per person, with checkboxes.
>
> Regenerate both with [`assets/112-build-tracker.py`](assets/112-build-tracker.py)
> and [`assets/112-build-daily-board.py`](assets/112-build-daily-board.py).

---

## The north star

Everything in this plan exists to make one journey work end to end:

```
Recruiter registration → company onboarding → choose a plan → enter a workspace
  → create a talent project → define hiring criteria → search candidates
  → read candidate insights → shortlist → unlock contact → send an email
  → track the pipeline → build an assessment → assign it → candidate takes it
  → review the result → continue hiring
        …with notifications and analytics throughout.
```

**It is one product, not a set of recruiting features.** The test on 19 September
is not that each part works; it is that a real recruiter can walk the whole
journey without anyone from ABTalks explaining where to click next. That test has
a UAT script of its own (U-R12) and it is run twice.

---

## Revision 6 — the committed product, restored

**Revision 5 deferred 13 committed items to make the arithmetic work. That was
wrong and it has been reversed.** Every one is back in September:

jobs & applicants · the evidence layer · assessments · candidate insights ·
non-technical hiring · the full recruiter notification set · recruiter analytics ·
product analytics · mock interview · cohorts & hackathons · profile-view
tracking · GitHub/LeetCode/CodeChef links.

**Priority now means execution ORDER, not a deferral list.** P0 is critical-path
and built first; P1 follows once its dependencies exist; P2 is lower-critical-path
work that still belongs to September. Nothing has been moved to October.

### What changed to accommodate it

**A tenth build day**, by making testing continuous inside each task rather than
a separate phase. Build now runs 5, 7–12, 14–16; UAT is the 17th; fixes,
regression and sign-off the 18th; release Saturday the 19th.

**11.6 days recovered by simplification, with no functionality removed** — mostly
by using schema that already exists and is referenced by no application code:
talent lists, candidate notes, job skills, question storage and assessment
results. Full table on the workbook's **Delivery Risk** sheet.

**Design runs a full feature ahead** so no developer waits, and backend, schema
and authorization work never waits on a design at all.

### The capacity gap — stated, not hidden

| | Days |
|---|---|
| Committed scope, after every simplification | **60.4** |
| Capacity: 10 build days × 4.0 developer FTE, less 15% | **34.0** |
| **Gap** | **26.4 developer-days** |

That is roughly **2.6 additional full-time developers** for the whole window.
Parallelisation cannot recover it — every developer is already scheduled at
~150%. Options A, B, C and E are already applied and are inside the 11.6 days
above; **Option D, adding capacity, is the only one that closes it.**

If no capacity is added, some committed functionality will be incomplete on
19 September. That is a product decision, to be taken deliberately at the
**Saturday 12 September gate** — not discovered on the 18th. The execution order
in this plan is exactly the order work should land, so that whatever is
unfinished is the least critical rather than the most recent.

### Sundays and the deadline

Sundays 6, 13 and 20 September are holidays. **20 September is itself a Sunday**,
so the product is live and verified on **Saturday 19 September**; the 20th is the
stated deadline date only.

---

## The cycle at a glance

```
┌─ BUILD ─────────────────────────────────────────────────┐┌─ HARDEN ─────────┐┌ SHIP ┐
│ P1  Sat  5 – Mon  8   Architecture, contracts, schema   ││ U1 Sat 26  Find  ││Wed 30│
│ P2  Tue  9 – Tue 16   Core implementation               ││ U2 Sun 27  S1    ││Deploy│
│ P3  Wed 17 – Tue 23   Feature completion + integration  ││ U3 Mon 28  S2 +  ││+ prod│
│ P4  Wed 24 – Thu 25   Final feature completion          ││    polish        ││verify│
│                                                          ││ U4 Tue 29  Regr. ││+ sign│
│ ▸ FEATURE FREEZE — Thu 25 Sep, 20:00 IST                ││    + SIGN-OFF    ││      │
└──────────────────────────────────────────────────────────┘└──────────────────┘└──────┘
     21 calendar days of build               4 days of UAT          1 release day
```

**Nine gates.** Nothing crosses one without the named owner's signature.

| Gate | When | Who signs | Meaning |
|---|---|---|---|
| **Foundation exit** | Mon 8 Sep | Sohail | Contracts C1–C5 published, migration path proven, **all thirteen decisions closed**. |
| **Checkpoint 1** | Tue 16 Sep | Sohail | A recruiter can register, onboard, create a project and search on a preview. First release-valve decision. |
| **Checkpoint 2** | Tue 23 Sep | Sohail | **The whole recruiter journey is walkable on a preview**, even if rough. Final valve decision. |
| **FEATURE FREEZE** | Thu 25 Sep, 20:00 IST | Sohail | Code complete. 17 E2E journeys green, migrations on the UAT branch. No feature commit after this. |
| **U1 complete** | Sat 26 Sep | Sohail | All 21 UAT scripts executed, every defect triaged. No fixing on U1. |
| **U2 exit** | Sun 27 Sep | Sohail | Zero S1 open. |
| **U3 exit** | Mon 28 Sep | Sohail | Zero S2 open; the first-impression review closed. |
| **UAT sign-off** | Tue 29 Sep, 18:00 IST | All 5 | Every script passed on the U4 re-run. Cleared for production. |
| **RELEASE** | Wed 30 Sep, 17:00 IST | Sohail | **Every one of the 30 journey steps reads PROD VERIFIED.** |

## 0. Read this first — three corrections to the working assumptions

Three things the team's own documentation currently gets wrong. Every decision
below depends on these being right.

**0.1 — The 078 migration is much further along than `CLAUDE.md` said.**
`CLAUDE.md` stated "every `ENABLE_NEW_*` flag is OFF and legacy tables are
authoritative for all reads." That was true on 2026-08-24 and **false today**.
Per the changelog, between 2026-08-26 and 2026-08-28 every Phase 6 read switch
was flipped on production in order — `CREDENTIAL` → `POINTS` → `CANDIDATE` →
`LEARNING` → `PROGRESS` → `TALENT` — and W1-A made `PointsAccount` +
`PointsTransaction` **write-authoritative**. Phase 6 is complete; the migration
is paused after W1-A. `CLAUDE.md` has been corrected as part of this plan.

Consequence: **new work is built 078-native, full stop.** The Databricks and
DS-Architect cohorts already ship with no legacy row and no dual-write — that is
the pattern every new feature follows.

**0.2 — The evidence spine has no live writer.** The most important finding in
this review. `SkillEvidence` — the table the entire 078 architecture is built
around, the one that makes "learning WRITES evidence, recruiting READS evidence"
true — is written by exactly one thing in this repository:
`prisma/scripts/migrate-2i-achievements.ts`, the historical backfill. No
submission, mission, quiz, project, interview or hackathon result emits a row.
`CandidateSkill.evidenceScore` and `.verified` are frozen at backfill time and
drift further from reality every day.

Everything downstream — candidate insights with explainability, evidence-based
ranking, match explanations — is built on a table nothing fills. **Fixing this
is **P1 Evidence Spine** and it is the first thing that ships.**

**0.3 — Roughly a third of the recruiter product already exists as unused
schema.** `TalentList`, `TalentListItem` (with a full `PipelineStage` enum),
`CandidateNote`, `JobSkill` and `AssessmentReport`/`AssessmentScore`/
`AssessmentReportShare` are all in production and referenced by **zero**
application code — only by migration scripts. The persistent sourcing project
you asked for is largely a matter of *using tables that are already there*,
which is the only reason it is achievable in a 12-day build window.

---

## 0.4 — What the recruiter audit found (revision 3)

Four findings from direct code inspection changed this plan materially.

**No payment infrastructure exists.** `package.json` carries no Razorpay, Stripe
or equivalent dependency. `src/components/hire/subscription-gate.tsx` is
presentation-only and says so in its own header: *"There is no billing here: no
checkout, no payment provider, no entitlement write."* Its `$69/$99/$199` tiers
came from a reference design and the file flags them as unverified. A paid
subscription is therefore a genuine new build, not an entitlement toggle —
**and it has been deferred to October by product decision (D-4).** September
ships the whole plan journey (view → compare → select → activate → meter →
expire) with an admin activating instead of a webhook, and `activateSubscription()`
is the single seam October's gateway will call.

**Contact release was admin-mediated.** `hasContactAccess()` in
`features/hire/contact-access.ts` derives access from
`TalentEngagementRequest.status === CONTACT_SHARED`, decided by an admin. Under
the paid model this becomes a **plan credit with instant unlock** (D-5) — the
recruiter spends an entitlement, the same `CONTACT_SHARED` row is written, and
`hasContactAccess()` does not change. That is deliberate: the one place that
decides whether PII may be seen keeps deciding it.

**The recruiter surface is five pages.** `/hire` contains `page`, `requests`,
`matches`, `evidence` and `[requestId]`. There is no jobs surface, no
assessments, no analytics, no billing, and the nav in `hire-chrome.tsx` has five
destinations. A workspace is a funded workstream (R12), not a polish pass.

**A third of the recruiter product already exists as unused schema.**
`TalentList`, `TalentListItem` (with a full `PipelineStage` enum), `CandidateNote`,
`JobSkill`, `AssessmentReport`/`AssessmentScore` and `Question`/`QuestionOption`
are all in production and referenced by **zero** application code. The persistent
project, the pipeline, org-scoped notes and the MCQ assessment are largely a
matter of *using tables that are already there* — which is the only reason this
scope is achievable at all.

## 1. Executive Summary

### What ABTalks is today

A strong learning platform with a recruiter product bolted to its side. The
candidate half was substantially rebuilt in the last two weeks: a nine-section
profile editor on normalized 078 tables, résumé upload with parsing and additive
merge, an eight-domain AI mock-interview platform with voice and rubric-backed
reports, four learning tracks, certificates, points, hackathons, workshops.

The recruiter half — `/hire` — is architecturally careful (Scout is a LangGraph
agent where the model proposes and the engine validates; contact release is
server-side and derived from an admin decision, never a stored flag) but it is a
**demo of a sourcing product, not a sourcing product**.

The honest gap: **candidate work does not become recruiter-visible evidence, and
recruiter intent does not persist.** A candidate can complete sixty days of
verified submissions and none of it writes a skill-evidence row. A recruiter can
run a perfect search, and their shortlist lives in `localStorage` on one device —
and only cohort members can even be saved to the database, because
`RecruiterShortlistItem` is foreign-keyed to `ProgramMember`.

### What ABTalks is on 19 September

**One hiring workspace, and proof that it works on production rather than in a
branch.**

A recruiter registers, describes their company, chooses a plan, and lands in a
workspace — not a search box. They create a named hiring project, define ten
criteria, search, read insights that cite the rows behind every claim, shortlist
across all four candidate tracks, spend a plan credit to unlock contact, email
the candidate from inside ABTalks, watch the pipeline move, build an MCQ
assessment, assign it, read the scored report, post a job whose applicants land
in that same pipeline — and see analytics where every number traces to a row.
They are told when something needs them, and only then. Three days later they
come back on a different machine and everything is exactly where they left it.

Underneath it, the supply side holds: every verified thing a candidate does
writes one `SkillEvidence` row through one emitter; every profile section works
end to end for engineers **and** for Product, Sales, Marketing, Design, Finance,
HR, Ops, BD and BA candidates; and nothing on a recruiter's screen claims to be
verified when it is not.

### What is deliberately not there on 19 September

**No payment gateway.** The plan journey is complete — view, compare, select,
activate, meter, expire — but an admin activates instead of a webhook, by product
decision (D-4). `activateSubscription()` is the single seam October's gateway
calls, so nothing is rebuilt.

**No candidate job alerts, no GitHub live sync, no candidate profile-view
notification, no descriptive or coding assessments.** Each is named in §3 with
what it cost and why it was safe to move.

### The honest number

The mandatory scope estimates at **77.3 build-days against ~63.5 effective** —
about **122%**. That is stated in §5 and on the tracker's Ownership sheet rather
than absorbed by hoping, five release valves are named and ordered, and Zainab is
held at 92% as the designated absorber.

### The one-sentence version

> By 19 September a real recruiter can walk the sourcing and outreach journey on ABTalks
> without anyone explaining where to click — and every step of it has one
> developer who has personally walked it on production with a fresh account.

## 2. Current Product Assessment

Based on code inspection, not documentation claims. "Risk" is risk to the
20 September deadline.

### 2.1 Candidate side

| Area | Current State | Gaps | Risk | Recommendation |
|---|---|---|---|---|
| **Registration / onboarding** | `/register` is profile-only. ~8 fields + phone OTP (India). Google OAuth only in prod. Consent + newsletter captured. | Two competing candidate write paths: `/register` writes `StudentProfile` (legacy, mirrored to `CandidateProfile`); `/profile` writes 078 tables directly. No guided post-signup completion. | **High** | Cut `/register` to 5 fields; move the rest into a progressive checklist. Write-path reconciliation → **debt, not September**. **C1.** |
| **Candidate profile** | Nine-section editor on 078 tables (`repositories/candidate-detail.ts`, 26KB). Skills from a canonical catalog. Avatar upload. Profile strength UX-only. | No "preview as a recruiter sees me", no visibility control surface. `RecruiterReview` still stores education/experience as JSON — a competing facts store (flagged DEBT 2026-08-31). | **Low** | Do not rebuild. Add preview + visibility control, and audit every section against a 12-point check. **C1.** |
| **Résumé** | `CandidateResume` + Gemini parse + additive merge into 078 children. Additive by construction — cannot delete or overwrite candidate data. Two test suites. | Merge quality unmeasured at scale. | **Low** | Leave alone. |
| **Mock interviews** | **Live and strong.** 8 domains, frozen plan + rubric per attempt, voice, deterministic degradation, public catalogue, history, wired into `/dashboard` and `/profile`. | **Results go nowhere.** No `SkillEvidence`, not visible to recruiters. The best-built candidate feature is invisible to the product's buyer. | **Medium** | Do not extend the engine. Audit it on production, then wire its output into evidence. **C4 + P1.** |
| **Jobs & applications** | `Job` (admin-created only), `JobApplication` (`jobId`+`userId`+`note`, nothing else). `/jobs` lists open roles: no search, no filter, no pagination. Apply = one insert. | No application status. No "my applications". No recruiter applicant view. `JobSkill` exists with **zero** usage. No notifications. The weakest system in the product. | **Critical** | Rebuild as a two-sided system whose applicants enter the same hiring pipeline as sourced candidates. **R8 + R5.** |
| **Cohorts / challenges / hackathons** | Four tracks live. Databricks + DS-Architect are 078-native. Hackathon has teams, attribution, submissions, placement certificates. | Participation writes `Credential` and `CandidateAchievement` but **not** `SkillEvidence`. `HackathonParticipant.userId` is globally unique — one hackathon per person, ever. | **Low** | Production audit plus evidence emission (**C5 + P1**). Constraint change → Later. |
| **GitHub** | Used only for `/program` mission verification and the commit cron. `GITHUB_API_TOKEN` configured. Handle collected and shown as a link. | No repos, languages, contributions, or recruiter-facing signal. | **Medium** | **Moved to October.** Well-bounded but not affordable in 12 days. |
| **LeetCode / CodeChef / Codeforces / Kaggle** | `CandidateLink` + type enum exists; candidates paste a URL. Nothing fetched or verified. | No verified stats. | **Low** | **Do not build ingestion** (§13 D-7). Label declared links "self-reported". |
| **Notifications** | `Notification` (admin broadcast) + `NotificationRead` (opaque key, deliberately not an FK). Automated notices derived at read time. Bell shows newest 5. | **No transactional notifications at all.** Nothing tells a candidate their application moved or that a recruiter shortlisted them. No preferences. | **High** | Extend the existing derived-key design, for candidates **and** recruiters. **P2 + R7.** |
| **Email** | Brevo via `lib/email.ts`. Workshop, hackathon, challenge-reset, recruiter OTP, DSAR, contact. `@abtalks.dev` suppressed. | No send log, no preferences, no suppression list. Resend was dead for months and nobody noticed. | **Medium** | Add a send log + preference check inside `sendEmail`. No new provider. It now also carries recruiter outreach. **P2 + R6.** |
| **Analytics** | **None.** No PostHog, GA, Mixpanel, Segment, Amplitude or Sentry anywhere. The only "analytics" are `/admin` aggregate queries. | No funnel visibility. No error tracking. | **High** | Self-hosted event table + one helper. No vendor. **P3.** |

### 2.2 Recruiter side

| Area | Current State | Gaps | Risk | Recommendation |
|---|---|---|---|---|
| **Recruiter auth & onboarding** | Email OTP at `/talent/login`, admin approval, then `provisionRecruiterIdentity` writes `UserRoleAssignment(RECRUITER)` + `Organization` + `OrganizationMember` (find-or-create by company slug, so teammates share an org). | **Closed in production** — `ENABLE_RECRUITER_AUTH` unset, so registration and sign-in refuse. Registration collects **three fields**: name, company (free text), phone. `Organization` has columns for website, industry, size, logo — all null. | **Critical** | Open the flag (allow-list, D-6); collect real company data through a five-step guided onboarding. **R1.** |
| **Scout (search agent)** | LangGraph `StateGraph` + `ToolNode` + `ChatGroq`. Eight tools, each returning `{applied, rejected}`; the model proposes, the engine validates, so a tool call cannot widen the pool. Protected attributes refused before the model. Guest browsing public. | Conversation is the **only** way to build a spec. No form, no filter panel — a recruiter who knows what they want must negotiate for it. | **Medium** | Keep Scout, and give the project a persistent criteria panel bound to the same spec. **R3.** |
| **Candidate search** | Loads up to `CHALLENGE_POOL_CAP = 600` rows per track, merges, ranks in memory. `searchableUserWhere()` is the single discovery gate, ANDed into every query. | Filters applied **after** loading, in JS. No DB-side filtering, no pagination, no sort control. The 600 cap silently truncates before filters run. Scoring dimensions are all engineering evidence. | **High** | Push hard filters into SQL; keep ranking in memory. **No new search infrastructure** (§8). **R3.** |
| **Shortlist / Talent Hub** | Two shortlists that are not the same thing: `RecruiterShortlistItem` (DB, FK to **`ProgramMember`** — cohort only) and Save-for-later (`localStorage`, key `abtalks-hire-star`, all tracks). | A challenge or hackathon candidate **cannot be persistently shortlisted at all**. Clearing site data destroys a recruiter's work. No stages, notes, team sharing or contact history. `TalentList`/`TalentListItem`/`CandidateNote` sit unused with exactly the right shape. | **Critical** | Migrate onto `TalentListItem` keyed on `candidateUserId`. One change fixes the multi-track bug, the device-local bug and the pipeline gap. **R5.** |
| **Search persistence** | `TalentRequest` persists the brief. `TalentRequestMatch` snapshots matches. `/hire/requests` lists **engagements**, not searches. | `runMatchAction` does `deleteMany` then `createMany` on every re-run — **match history is destroyed**, so "new since last visit" is impossible. No `viewedAt`, no rejected state, no recruiter-chosen project name. | **High** | Upsert with `firstSeenAt`, and make the request a **named project**. **R3.** |
| **Engagements / contact release** | `TalentEngagementRequest`, one row per recruiter/candidate pair. `status` (DRAFT→SUBMITTED→IN_REVIEW→CONTACT_SHARED/DECLINED/CLOSED) releases identity; access is *derived*, never a second stored flag. Admin queue at `/admin/hire`. | Correct by design. No candidate-side notification that they were requested. | **Low** | Keep the model — `hasContactAccess()` does not change. Unlock now spends a **plan credit** (D-5) and writes the same `CONTACT_SHARED` row. **R6.** |
| **Candidate insights** | `explain-matches.ts` (13KB) + `score-candidate.ts` (20KB) produce a real breakdown, gaps and rationale. Compensation is an estimate, never candidate-declared. | Insight quality is capped by evidence quality, and evidence has no live writer (§0.2). | **Medium** | Unblocked by P1 (evidence); surfaced by **R4, now committed P0** — facts and inference visually separated, every claim openable. |
| **Assessments** | `AssessmentReport`/`AssessmentScore`/`AssessmentReportShare` in production, **zero usage**. Legacy `RecruiterReview` + `/r/[token]` is what runs. | No recruiter can create anything. | **Medium** | Build the loop on the tables that already exist: `Question`/`QuestionOption` for MCQs, `AssessmentReport`/`AssessmentScore` for results. **R9.** |
| **Recruiter analytics** | `demand-analytics.ts` + `demand-board.ts` — **admin-facing** only, gated behind `HIRE_VIRTUAL_CANDIDATES`. | Recruiters see nothing about their own funnel. | **Medium** | Recruiter-facing overall and per-project analytics, every number traceable to a row. **R10.** |
| **Plans / subscription / payment** | `components/hire/subscription-gate.tsx` — a **presentational dialog**. Three tiers, USD prices from a reference design, explicitly not signed off ("safe to show the team, not safe to charge against"). No plan model, no entitlement, no counter, no payment provider anywhere. | Everything premium is gated in React. | **Critical** | Backend entitlements on **three seeded tiers**, admin activation, usage meter, expiry. Payment gateway deferred to October (D-4); `activateSubscription()` is its seam. **R2.** |
| **Non-technical candidates** | `role-family.ts` has 9 families, all engineering-adjacent. `SkillCategory` seeds: programming, data, ai-ml, cloud, tools, professional, uncategorized. | No Product, Sales, Marketing, Design, Ops, Finance, HR or BA. Scoring dimensions are missions, commits, projects, submissions — a marketer has none. The platform can *store* a non-technical candidate and can never *rank* one. | **Medium** | Nine new role families, non-technical skill seed, optional role-specific signals, recruiter search by family. No role-aware scoring yet. **R11.** |

### 2.3 Platform & engineering

| Area | Current State | Gaps | Risk | Recommendation |
|---|---|---|---|---|
| **078 migration** | Phases 1–6 complete, all read flags on, W1-A points writes authoritative. Dual-write still on. Legacy tables intact. | Paused mid-Phase-7. | **Medium** | **Freeze Phase 7 through September** (§13 D-1). |
| **Authorization** | `requireAdmin` (email), `requireRecruiter` (DB role + approval), `requireProgramMember`. Middleware path-prefix only, correctly edge-safe. Contact release derived from status. | `/hire/evidence` requires a session but not an *approved recruiter* — low severity today (renders only client-cached data) but one refactor from a leak. Rate limiting exists only in `hire-guest-actions` and program missions. | **Medium** | Tighten `/hire/*`; rate-limit OTP, apply, outreach send and assessment submit. **P5.** |
| **Testing** | 12 hand-rolled `tsx` scripts. No test runner. No E2E. No CI gate. | Nothing verifies a *journey*. | **Critical** | Playwright + 17 journeys + CI. **P5.** |
| **Observability** | `lib/logger.ts` console wrappers only. | A production 500 is invisible unless someone reads Vercel logs. | **High** | Sentry — 2 hours, disproportionate payoff. **P3.** |
| **Migrations** | 24 folders. `vercel.json` runs `build:deploy` = `prisma migrate deploy && next build`. | `docs/project-context.md` says `migrate deploy` **cannot** run on production because of a leftover `20260813000000_general_interview` folder; the changelog says Vercel applies migrations automatically. **Both cannot be true.** September adds ~5 migrations. | **Critical** | Settle **Fri 5 Sep**, before anything merges. **§13 D-2.** |
| **Scale** | ~12,803 users, ~3,183 challenge enrolments, ~15k submissions, ~64 `ProgramMember`. Neon + Vercel free tier. | Search loads 600 rows/track per query. | **Low** at these volumes | Filter in SQL (§8). Do not over-engineer. |

---

## 3. September Scope — restructured around the recruiter journey

### Capacity, honestly

| Input | Value |
|---|---|
| Build window | **Sat 5 Sep** → Thu 25 Sep = **21 calendar days** |
| Shivansh, Zainab, shashank | 3 × 17.9 effective days = **53.7** |
| Sohail (architect + builder, ~0.6 FTE) | **12.6** |
| Manuvrtti (part-time, ~0.4 FTE) | **8.4** |
| **Gross** | **74.7 person-days** |
| Less 15% for review, deploy and the unexpected | **~63.5 effective build-days** |
| **Committed** | **77.3 — 103% of gross, ~122% of effective** |

The recruiter restructure added roughly **24 build-days** of new scope: outreach,
recruiter notifications, candidate insights promoted to P0, the workspace UI, and
the full subscription journey. Six things paid for it, and every one reduces
sophistication rather than removing a journey step:

| Cut | What it costs | Why it is safe |
|---|---|---|
| **Payment gateway → October** | ~7d | Product decision (D-4). The plan journey ships whole; only the charge is missing, and `activateSubscription()` is the one seam a webhook will call. |
| **Candidate job alerts → October** | ~3d | The only removed journey, and it is candidate-side demand distribution, not part of the protected recruiter journey. |
| **GitHub live sync → declared links** | ~3d | LeetCode and CodeChef were already declared-only. Three providers now share one connector and one honest trust label. |
| **Candidate profile-view *notification* → October** | ~1d | The **recording** stays, because recruiter analytics needs "candidates viewed". Only the candidate-facing notice moves. |
| **Cohort / hackathon / mock interview → audit-and-fix** | ~4d | They become production audits with manual UAT rather than new automated E2E. The journeys still have to work; they just are not re-engineered. |
| **Job filters cut to five** | ~1.5d | Skills, role, location, work mode, type. Experience and eligibility in October. |

### The protected product — never traded

```
Company onboarding → Paid plan → Talent project → Candidate search
  → Candidate insights → Shortlist → Outreach → Assessment → Pipeline
  → Notifications → Analytics
```

**No step in that chain is removed to preserve a lower-value isolated feature.**
If capacity runs out, complexity inside a step is reduced — free-text email
instead of templates, top-signals instead of gap analysis — but the step exists.

### P0 workstreams — 24, each with one accountable owner

| # | Outcome | Owner | Est. |
|---|---|---|---|
| **G0** | Governance, decisions and contracts — thirteen blocking decisions, five contract stubs, the migration path, plans 113+ | Sohail | 4.0d |
| **R1** | **Recruiter registration & company onboarding** — a five-step guided journey, not a drop into a search screen | Shivansh | 4.0d |
| **R2** | **Subscription, plans & entitlements** — catalogue, selection, admin activation, usage meter, limit experience, expiry; every limit enforced server-side | Sohail | 5.5d |
| **R3** | **Talent projects & candidate search** — named persistent projects, ten saved criteria, SQL filters, new-since-last-visit | shashank | 5.5d |
| **R4** | **Candidate insights** — top signals, gaps, every claim openable to its source row; facts and inference visually distinct | shashank | 3.0d |
| **R5** | **Talent Hub & hiring pipeline** — DB-backed multi-track shortlist, twelve stages, org-scoped notes, an "awaiting action" board | shashank | 3.0d |
| **R6** | **Outreach & email** — plan-credit contact unlock, compose, four templates, send, history, pipeline moves to CONTACTED | Zainab | 3.5d |
| **R7** | **Recruiter notifications** — seven types, three by email, a notification centre whose links open the right thing | Manuvrtti | 2.5d |
| **R8** | **Jobs, applications & applicants** — both sides, and an applicant enters the same pipeline with no duplicate candidate record | Shivansh | 6.5d |
| **R9** | **Assessment builder & candidate tests** — build, publish, assign, attempt, auto-evaluate, review, evidence | Zainab | 4.5d |
| **R10** | **Recruiter analytics** — overall and per-project, every number traceable to a row | shashank | 2.5d |
| **R11** | **Non-technical hiring** — nine new role families, optional role-specific signals, no coding signal required | shashank | 3.0d |
| **R12** | **Recruiter workspace UI/UX & Home** — the nav, the shell, the "what should I do next" home, design consistency, interaction quality, performance | Shivansh | 4.0d |
| **C1** | Complete candidate profile — the supply side of the recruiter product | Shivansh | 5.0d |
| **C2** | External profile links — GitHub, LeetCode, CodeChef, declared and honestly labelled | Manuvrtti | 1.5d |
| **C4** | Mock interview verification — audit and fix, production-proven | Zainab | 2.0d |
| **C5** | Cohort & hackathon journeys — audit and fix, production-proven | Zainab | 2.0d |
| **P1** | Evidence spine — the emitter every insight, assessment and journey writes through | Zainab | 5.0d |
| **P2** | Notifications & email infrastructure | Manuvrtti | 2.6d |
| **P3** | Analytics & observability | Manuvrtti | 2.4d |
| **P4** | Profile-view tracking — recorded once, feeding recruiter analytics | shashank | 1.5d |
| **P5** | Testing, security & hardening — 17 journeys, cross-org, PII, rate limits | Sohail | 3.5d |
| **UAT** | 21 scripts across four days, nobody testing their own work | all 5 | — |
| **REL** | 30 production smokes, one per journey step | all 5 | — |

### P1 — started only when the owner's P0 is UAT-ready

**R9 AI-drafted questions** (Zainab) is the only P1 inside a P0 workstream: the
builder works without it, the recruiter simply types the questions.

### Moved to October — deliberately

Payment gateway · candidate job alerts · GitHub live sync · candidate
profile-view notification · assessment descriptive questions and manual grading ·
coding-execution assessments (no sandbox exists) · per-job analytics drill-down ·
self-serve plan upgrade/downgrade · open self-serve recruiter signup (waits on
the gateway) · role-aware ranking for non-technical roles · automated E2E for
cohort, hackathon and mock interview · job filters on experience and eligibility ·
078 Phase 7 W1-B onward.

## 4. The Recruiter Journey, step by step

Each arrow is a handoff someone owns. The full 30-step matrix with task ids, E2E
ids, UAT ids and production-verification owners is the **Recruiter Journey** sheet
in the tracker.

```
RECRUITER LANDS ON /hire
  → Register + email OTP (allow-list, D-6)               [R1 · Shivansh]
  → Tell us about your company                            [R1 · Shivansh]
      website · logo · industry · size · location
  → Tell us what you are hiring for                       [R1 · Shivansh]
      └→ pre-fills the first project's criteria            [→ R3]
  → Choose a plan (no charge in September, D-4)           [R2 · Sohail]
      └→ admin activates → entitlements live               [R2 · Sohail]
  → ENTER THE WORKSPACE — not a search screen             [R12 · Shivansh]
      └→ Home: what should I do next?                      [R12 · Shivansh]

  → CREATE A TALENT PROJECT                               [R3 · shashank]
      "Senior Backend Engineer — Delhi NCR"
  → Define hiring criteria (ten fields, saved)            [R3 · shashank]
      role · skills · experience · location · education
      · graduation year · candidate type · role family
      · open-to-work · evidence
      └→ non-technical families work identically          [R11 · shashank]
  → Search — hard filters run in SQL                      [R3 · shashank]
  → Open a candidate → INSIGHTS                           [R4 · shashank]
      top signals · gaps · every claim opens its row
      └→ the view is recorded, once per window            [P4 · shashank]
  → Shortlist — DB-backed, all four tracks, any device    [R5 · shashank]
  → Private org-scoped note                               [R5 · shashank]
  → UNLOCK CONTACT — spends a plan credit (D-5)           [R6 · Zainab]
  → SEND AN EMAIL — template or free text                 [R6 · Zainab]
      └→ pipeline moves to CONTACTED automatically        [R6 · Zainab]
      └→ outreach history recorded                        [R6 · Zainab]
  → TRACK THE PIPELINE                                    [R5 · shashank]
      NEW → VIEWED → SHORTLISTED → CONTACT_REQUESTED
      → CONTACTED → ASSESSMENT_SENT → ASSESSMENT_COMPLETED
      → SCREENING → INTERVIEWING → OFFER → HIRED / REJECTED
  → BUILD AN ASSESSMENT (MCQ + multi-select, D-10)        [R9 · Zainab]
  → Assign it to shortlisted candidates                   [R9 · Zainab]
      └→ candidate notified, attempts, submits            [R9 · Zainab]
      └→ auto-evaluated → AssessmentReport                [R9 · Zainab]
      └→ score → SkillEvidence → back into insights       [P1 → R4]
  → Review the result                                     [R9 · Zainab]
  → POST A JOB, receive applicants                        [R8 · Shivansh]
      └→ applicant enters the SAME pipeline, no duplicate [R8 → R5]
  → RETURN THREE DAYS LATER                               [R3 · shashank]
      criteria intact · NEW flagged correctly
      · every decision remembered
  → NOTIFICATIONS throughout (7 types, 3 by email, D-9)   [R7 · Manuvrtti]
  → ANALYTICS throughout — overall and per project        [R10 · shashank]
```

### The seams that must not break

| Seam | From | To | Contract |
|---|---|---|---|
| Hiring need pre-fills project criteria | R1 (Shivansh) | R3 (shashank) | Shape handed over in P1 Foundation |
| Applicant into the hiring pipeline | R8 (Shivansh) | R5 (shashank) | `addApplicantToTalentList` (C4), stub 6 Sep — **same `candidateUserId`, no duplicate record** |
| Assessment score into insights | R9 (Zainab) | R4 (shashank) | `emitSkillEvidence` (C1), stub 5 Sep |
| Contact unlock spends a credit | R6 (Zainab) | R2 (Sohail) | `assertEntitlement` (C5), stub 6 Sep |
| Every recruiter action into analytics | all | R10 (shashank) | `track` (C2), stub 6 Sep |
| Every recruiter-relevant event into the bell | all | R7 (Manuvrtti) | `notify` (C3), stub 6 Sep |

**Six seams, six stubs, all on master by 6 September.** No stream waits on
another stream's implementation — only on its signature.

### The candidate side exists to feed this

A recruiter searching an empty or broken candidate pool has nothing to hire.
That is the whole reason C1 (complete profile), C2 (external links), C4 (mock
interview), C5 (cohort and hackathon) and P1 (the evidence spine) are still
funded: **they are the supply side of the recruiter product**, not a separate
roadmap. The evidence spine in particular is upstream of candidate insights,
assessment scoring, and the ranked search — which is why P1 ships first and
`SkillEvidence` having had no live writer is the single most consequential
finding in this document (§0.2).

## 5. Developer Ownership

### 5.1 The principle

**Ownership is outcome-based, not component-based.** Nobody owns "the email
sending code"; someone owns *"a recruiter can email a shortlisted candidate
without leaving ABTalks, and the pipeline and history record that it happened —
from the contact unlock through the send, the failure path, the E2E and the
production walk."*

Each workstream has **exactly one accountable owner**. Others contribute;
accountability does not move. The question the tracker answers for every step is:
*if this breaks on 19 September, exactly which developer owns fixing the entire
step?*

### 5.2 A note on how this team works

**Every developer is junior and pairs with Claude.** That changes what a good
task looks like, and the tracker reflects it in three ways:

1. **Every task has a "Where to start" column** naming the real file, model or
   existing pattern. Most of these tasks extend something that already exists —
   `TalentList` and `TalentListItem` are already in the database, `Question` and
   `QuestionOption` already model MCQs, `hasContactAccess()` already decides PII
   access. A task that reads "build a shortlist" invites a new table; a task that
   reads "`TalentListItem` exists and is referenced by zero application code —
   make it the live shortlist" does not.
2. **Every task has its own acceptance criterion, written as observable steps.**
   Not *"recruiters can hire professionally"* but *"shortlist a candidate in
   Browser A, sign out, open Browser B, sign in, and the candidate is still
   shortlisted in the correct project."* The workstream outcome is a separate
   column and is explicitly **not** what a task is tested against.
3. **Every task names the decision it waits on.** Starting a task whose D-number
   is still Open is how rework happens.

**If an acceptance criterion cannot be demonstrated in a browser or a test, the
task is badly written — raise it at standup rather than guessing.**

### 5.3 Ownership table

| Developer | Accountable for | Load | The sentence they sign on 30 Sep |
|---|---|---|---|
| **Shivansh-Rai**<br>*Full-time* | **R1** onboarding (4.0d) · **R8** jobs & applicants (6.5d) · **R12** workspace UI/UX & Home (4.0d) · **C1** candidate profile (5.0d) | **109%** | *"A recruiter creates an account, tells us about their company, chooses a plan and walks into a workspace that makes sense — and the candidates they find there have profiles that actually hold together."* |
| **ZainabShujat**<br>*Full-time* | **P1** evidence spine (5.0d) · **R6** outreach & email (3.5d) · **R9** assessments (4.5d) · **C4** mock interview (2.0d) · **C5** cohort & hackathon (2.0d) | **95%** | *"A recruiter can reach a candidate and test them without leaving ABTalks — and every verified thing that candidate has ever done is a row that recruiter can open."* |
| **shashank kumar**<br>*Full-time* | **R3** talent projects & search (5.5d) · **R4** insights (3.0d) · **R5** hub & pipeline (3.0d) · **R10** analytics (2.5d) · **R11** non-tech (3.0d) · **P4** profile views (1.5d) | **104%** | *"A recruiter creates a hiring project, comes back a week later on another machine, and finds their criteria, their candidates and every decision they made exactly where they left them — for any role family, not just engineering."* |
| **Manuvrtti**<br>*Part-time ~0.4 FTE* | **R7** recruiter notifications (2.5d) · **P2** notifications & email (2.6d) · **P3** analytics & observability (2.4d) · **C2** external links (1.5d) | **107%** | *"A recruiter is told when something needs them and only then, the link opens the right thing, and what a candidate claims about GitHub is labelled honestly rather than dressed up as verified."* |
| **Sohail**<br>*Architect + builder ~0.6 FTE* | **G0** decisions & contracts (4.0d) · **R2** subscription & entitlements (5.5d) · **P5** security & testing (3.5d) · migration custodian · release coordination | **104%** | *"A recruiter knows what their plan allows, cannot exceed a single limit from the client, cannot see another company's data, and the 19 September release was signed step by step by the people who own each step."* |

**Zainab at 95% is deliberate.** She is the designated absorber: if Shivansh is
behind at the 16 September checkpoint, C1's remaining profile fixes move to her
**before** any release valve is called.

### 5.4 Release valves — dropped WHOLE, in this order

Called by Sohail at the 16 and 23 September checkpoints:

1. **R9 AI-drafted questions** — the builder still works; the recruiter types the questions.
2. **R10 per-project metrics** — overall analytics only.
3. **R6 templates** — free-text email only, which is still a complete outreach journey.
4. **R4 gap analysis** — top signals and evidence links only.
5. **C2 external links** — dropped entirely.

**No journey step is ever traded — only complexity inside one.** A step that
cannot be finished is flagged **OFF** at the release with its owner named, rather
than shipped half-working.

### 5.5 Shared responsibilities

- **Every developer owns their own E2E specs.** The harness is Sohail's; the spec
  belongs to the stream owner. A failing spec blocks that owner's merges.
- **Every developer runs their own production smoke on Saturday 19 September**, with a
  fresh account, and records the row id. Sohail signs the release only at 30/30.
- **Every developer writes their own loading / empty / error / success states.**
  They are in the Definition of Done, not a polish pass. R12 is a *consistency*
  pass over states that already exist, not the place they get written.
- **Migrations are reviewed by Sohail before merge**, without exception, and
  rehearsed on a Neon child branch first (`.cursorrules`, `AGENTS.md`).
- **Review pairing:** Shivansh ↔ shashank; Zainab ↔ Manuvrtti. **Review SLA: 4
  working hours.**
- **Cross-stream UAT** (§7.3): nobody UATs their own work.

### 5.6 Interfaces — published early, then frozen

| # | Contract | Owner | Consumers | Stub due |
|---|---|---|---|---|
| **C1** | `emitSkillEvidence(input)` — idempotent on `(sourceType, sourceKey, skillId)` | Zainab | R4, R9, C4, C5 | **Fri 5 Sep** |
| **C2** | `track(event, userId, props)` — never throws, never blocks | Manuvrtti | all | **Sat 6 Sep** |
| **C3** | `notify({userId, type, payload, channels})` | Manuvrtti | R6, R7, R8 | **Sat 6 Sep** |
| **C4** | `addApplicantToTalentList(talentListId, candidateUserId, source)` | Shivansh | shashank | **Sat 6 Sep** |
| **C5** | `assertEntitlement(orgId, key, n)` | **Sohail** | R3, R6, R8, R9 | **Sat 6 Sep** |

## 6. BUILD CYCLE — Sat 5 Sep → Thu 25 Sep

Four phases. Each ends with a demo on a preview deployment, not a status update.
Task-by-task dates and owners are on the tracker's Activity Tracker sheet.

### P1 — Architecture, contracts, blockers, schema · Sat 5 – Mon 8 Sep

**Nothing is built this phase that is not a contract, a schema, an audit or a
decision.** Thirteen decisions close, five contract stubs land on master, and
four audits replace assumptions with lists:

| Audit | Owner | Replaces the assumption that… |
|---|---|---|
| Recruiter first-run walk-through | Shivansh | …a new recruiter knows what to do after registering |
| Does `TalentRequest` save a **search** or a **project**? | shashank | …the current model already persists a hiring project |
| Complete-profile 12-point check across every section | Shivansh | …the profile works because the code exists |
| Every `Job` / `JobApplication` read and write path | Shivansh | …an applicant can reach the hiring pipeline today (they cannot) |

> **This phase is now four days, not five.** The start moved to 5 September while
> the freeze held at 25 September, so the window lost a day off the front — and it
> came out of the tightest phase in the plan: thirteen decisions, five contract
> stubs and four audits. If Foundation is going to slip, it will show on **Sunday
> 7 September**, and the response is to cut decisions to their recommendations
> rather than let the audits go unwritten. The audits are what stop four junior
> developers inventing architecture in week two.

**Exit gate — Mon 8 Sep:** C1–C5 on master · migration path proven on a child
branch · D-1…D-13 all Decided · every P0 workstream has a numbered plan.

### P2 — Core implementation · Tue 9 – Tue 16 Sep

By the checkpoint a recruiter can **register, onboard, create a project and
search** on a preview. The evidence emitter is live with all six learning call
sites. Entitlements refuse a limit with the client bypassed. `TalentListItem` is
the live shortlist and a hackathon candidate can finally be saved.

**Checkpoint 1 — Tue 16 Sep:** each owner demos. **First release-valve decision.**

### P3 — Feature completion + integration · Wed 17 – Tue 23 Sep

Insights, outreach, the pipeline board, assessments, recruiter notifications,
analytics, the workspace shell and Home all land and connect.

**Checkpoint 2 — Tue 23 Sep:** the **whole** recruiter journey is walkable on a
preview, even if rough. **Final valve decision.** Anything still not walkable is
descoped in writing, not carried into the last two days.

### P4 — Final feature completion · Wed 24 – Thu 25 Sep

No new features. The 17 E2E specs written and green, the responsive and
performance passes, the UAT environment stood up, the release branch cut.

**▸ FEATURE FREEZE — Thu 25 Sep, 20:00 IST.** Six entry criteria, on the
Milestones & Gates sheet. **No feature commit after this.**

---

## 7. UAT CYCLE — Sat 26 Sep → Tue 29 Sep

Twenty-one scripts, on the tracker's **UAT** sheet, run with **fresh accounts**
on a dedicated Neon child branch. Nobody UATs their own work.

| Day | Purpose | Rule |
|---|---|---|
| **U1** Sat 26 | Execute all 21 | **Find only. No fixing.** |
| **U2** Sun 27 | Fix every S1 | Retested by the reporter, never the fixer |
| **U3** Mon 28 | Fix every S2 · polish · responsive · **the first-impression review** | Every hesitation is an S2 |
| **U4** Tue 29 | Full re-run · regression · performance · **sign-off 18:00 IST** | A script that passed on U1 but not U4 has not passed |

**Cross-stream assignment:** Zainab tests recruiter onboarding and plans;
Shivansh tests sourcing; Manuvrtti tests jobs, assessments, analytics and
notifications; shashank tests the candidate side; Sohail tests security,
performance and the workspace feel.

**The script that matters most is U-R12.** Someone who has never seen ABTalks is
asked to reach candidate search, shortlist a person and email them, with no
explanation. It runs on U1 and again on U4.

### Exit criteria — all true at Tue 29 Sep, 18:00 IST

- [ ] Zero **S1** and zero **S2** defects open
- [ ] All 21 scripts passed on the U4 re-run, not merely on first attempt
- [ ] All 17 E2E journeys green in CI on the release branch
- [ ] Every existing `tsx` suite green
- [ ] Manual regression clean: challenge, program, hackathon, certificate, marketplace, workshop, points
- [ ] S3/S4 logged to the October backlog **with owners**
- [ ] Sentry quiet on the UAT deployment for four hours

---

## 8. Search Architecture Review

You asked specifically whether the current architecture can support multi-filter
search, saved searches and persistent projects. Direct answer:

### What runs today

`features/hire/search-candidates.ts` loads up to `CHALLENGE_POOL_CAP = 600` rows
per track through `repositories/hire.ts`, merges the tracks, then ranks with a
pure in-memory function. The only DB-side predicates are the visibility gate
(`searchableUserWhere()`) and an evidence-days floor. **Skills, experience,
location, education, graduation year and role are all filtered in JavaScript,
after loading.** The code's own comment is honest: 600 is "comfortably above the
whole eligible cohort today (320)".

### Verdict

**Correct for the current pool, wrong for the product being sold.** Not because
Postgres is too slow — at ~12,800 users it is nowhere near its limits — but
because filtering after loading means:

- the 600 cap truncates *before* filters are applied, so a narrow filter over a
  large track can return fewer results than the pool actually contains;
- no pagination, so a recruiter cannot page past the first ranked batch;
- sort order is fixed by the scorer — no "sort by recency" or "by experience";
- a persistent project cannot answer "how many match now?" without a full reload.

### Recommendation: stay on Postgres. Move the hard filters into SQL.

**Do not add** Elasticsearch, Typesense, Meilisearch, OpenSearch or pgvector.
A second datastore buys latency the product does not need, costs an entire
workstream, and introduces a consistency problem between two sources of truth.
With twelve build days it is not a close call.

**Do this instead** (R3, shashank, phase P3):

1. **Hard filters become a `Prisma.UserWhereInput`** composed *on top of*
   `searchableUserWhere()` — always ANDed, never replacing, so a caller cannot
   omit the discovery gate:

   | Filter | Source | Index |
   |---|---|---|
   | Skills (any / all) | `CandidateSkill.skillId` | `@@index([skillId, candidateUserId])` |
   | Years of experience | `CandidateProfile` derived span | b-tree |
   | Location / city | `CandidatePreference.preferredLocations` | GIN |
   | Graduation year | `CandidateEducation.endMonth` | b-tree composite |
   | Education level | `CandidateEducation.degree` | b-tree |
   | Open to work | `CandidatePreference.openToWork` | partial |
   | Opportunity type | `CandidatePreference.opportunityTypes` | GIN |
   | Track / cohort | `ProgramEnrollment.cohortId` | existing |

2. **Ranking stays in memory** over the filtered set. Evidence scoring is
   nuanced and well-tested (`score-candidate.test.ts` is 20KB); it does not
   belong in SQL. Filter to ≤300 rows in Postgres, then rank those.

3. **Keyset pagination** on `(score, candidateUserId)` for stable pages.

4. **Fuzzy matching via `pg_trgm`** — already proven here on the 54,651-row
   `College` catalog. No new dependency.

5. **Persistent projects need no new search technology at all.** A project is a
   `TalentRequest` row plus `TalentRequestMatch` rows with `firstSeenAt`.
   "What's new?" is `WHERE firstSeenAt > lastVisitedAt`. That is a query, not an
   index.

**Revisit a search engine when** the searchable pool passes ~100k candidates, or
free-text relevance across résumés becomes a primary filter. Neither is close.

> Indexes are built with `CREATE INDEX CONCURRENTLY` on populated tables, and
> rehearsed on a Neon child branch like every other migration.

---

---

## 9. Acceptance Criteria

**Acceptance criteria are per task and live in the workbook**, in the
`Task-level acceptance criteria` column of the Activity Tracker — 209 of them,
each written as observable steps against that one task. The `Workstream outcome`
column carries the shared goal and is explicitly **not** what a task is tested
against. See Appendix A for the good/bad worked example.

The workstream-level bar is the `Workstream outcome` column on the **Workstream
Rollup** sheet, and the journey-level bar is the **Recruiter Journey** sheet.

---

## 10. E2E Test Matrix

**Seventeen journeys** — eight recruiter, nine candidate — on the tracker's **E2E
Matrix** sheet, each with a spec owner, a fixture, its UAT script, and the
specific assertion that must not be faked.

| Recruiter | Candidate |
|---|---|
| **E-R1** register → onboard → plan → workspace | **E-C1** signup → profile → discoverable |
| **E-R2** project → criteria → search → leave → return | **E-C2** complete profile lifecycle |
| **E-R3** search → insights → shortlist → unlock → email → CONTACTED | **E-C3** browse → filter → apply → track |
| **E-R4** create assessment → assign → completed → review | **E-C4** mock interview → report → evidence |
| **E-R5** post job → apply → shortlist → email → stage → notified | **E-C5** cohort → activity → evidence |
| **E-R6** notification opens the right context | **E-C6** hackathon → submit → result → evidence |
| **E-R7** entitlement limits cannot be bypassed from the client | **E-C7** assessment attempt, resume, submit |
| **E-R8** privacy: private candidate, protected contact, another org, expired plan | **E-C8** external links with correct trust labels |
| | **E-C9** non-technical profile → discovery → shortlist |

**Fixtures.** `db:seed:e2e` provides four fresh personas — a technical candidate,
a **non-technical** candidate, a recruiter with an active plan, and an admin —
plus an open cohort, an open hackathon, a published job and a published
assessment, so every journey starts from a genuine zero state.

### Analytics events — frozen after Mon 8 Sep

`registration_completed` · `profile_section_completed` · `visibility_changed` ·
`plan_selected` · `subscription_activated` · `talent_project_created` ·
`search_run` · `profile_viewed` · `candidate_shortlisted` ·
`candidate_stage_changed` · `contact_unlocked` · `outreach_sent` ·
`job_created` · `job_published` · `job_viewed` · `job_applied` ·
`application_stage_changed` · `assessment_published` · `assessment_assigned` ·
`assessment_started` · `assessment_submitted`

---

## 11. Dependencies

### Cross-developer — six, all contract-mediated

All six stubs are on master by **6 September**, so no stream waits on another
stream's implementation — only on its signature. The seam table is in §4.

### External API dependencies

| Service | Used for | Risk | Mitigation |
|---|---|---|---|
| **Brevo** | All transactional email, now including **recruiter outreach** | Deliverability on a new class of mail: recruiter-to-candidate | Send log + retry; per-user cap; D-9 limits recruiter email to three event types; bounce monitoring from 20 Sep |
| **Google OAuth** | Candidate auth | Low | — |
| **Anthropic** | Grading, mentor, interview evaluation, **AI-drafted assessment questions** | Cost, latency, and questions nobody checked | Every AI-drafted question requires explicit recruiter approval before it can be assigned (R9) |
| **Groq** | Scout | 429s | Three-key fallthrough in `askGroqJson` |
| **Gemini** | Résumé parsing | Quota | Degrades to manual entry |
| **MSG91** | Phone OTP | Delivery failure blocks registration | Existing dev bypass; monitored during UAT |
| **Vercel Blob** | Résumé, avatar, **company logo** | **Two stores/tokens** (`BLOB_READ_WRITE_TOKEN`, `avatar_*`) | Verify both set in production before 30 Sep |
| **No payment provider** | — | — | **Deferred to October (D-4).** No dependency added; `activateSubscription()` is the seam |
| **GitHub / LeetCode / CodeChef** | Declared profile links only | No reliable API from a datacenter IP | Declared links with a **Self-reported** label. Nothing is fetched in September |

### Database migrations — 12 expected, all additive

Organization onboarding fields · `SubscriptionPlan` + `OrganizationSubscription` +
`EntitlementUsage` · `TalentRequest.name` + `TalentRequestMatch` state columns ·
`TalentList`/`TalentListItem` activation · `CandidateProfileView` ·
`OutreachMessage` · four assessment tables · `Job` fields ·
`JobApplication.stage` · `AnalyticsEvent` + `NotificationPreference` ·
non-technical skill seed · search indexes (`CONCURRENTLY`).

**Every one rehearsed on a Neon child branch first**, per `.cursorrules` and
`AGENTS.md`. D-2 must be settled on 5 September before any of them merges.

---

## 12. Risk Register

Fifteen risks on the tracker's **Decisions & Risks** sheet, reviewed at every
gate. The five that shape this plan:

| # | Risk | Mitigation | Owner |
|---|---|---|---|
| **R3** | **`SkillEvidence` has had no live writer since the platform was built.** Insights, ranked search, assessment evidence and three journeys all read it. | P1 ships first and is upstream of R4, R9, C4, C5. Nothing downstream is Done until it can point at a real row. | Zainab |
| **R4** | Outreach, recruiter notifications, insights and the workspace UI are all **new surfaces with no existing UI to lean on** — roughly half the recruiter scope. | Each has a decision closed before build (D-5, D-9, D-11, D-13) and a valve that reduces it to a simpler *complete* version rather than removing it. | Sohail |
| **R8** | Entitlements ship as another client-side gate under time pressure — `subscription-gate.tsx` is presentation-only today. | E-R7 and U-R7 test six gated actions with the client **removed**, plus a ten-concurrent-call test against a limit of five. | Sohail |
| **R9** | **Every developer is junior and pairing with Claude.** Ambiguous tasks become invented architecture. | Every task carries a "Where to start" naming the real file or pattern, and an acceptance criterion written as observable steps. New files appear only if a plan lists them. | Sohail |
| **R15** | The product works but does not **feel** like one workspace — the failure mode that loses a paying recruiter. | R12 is a funded workstream, not a polish pass. U-R12 puts it in front of someone who has never seen it and logs every hesitation as an S2. Run on U1 **and** U4. | Shivansh |

---

## 13. Technical Decisions Required

Thirteen, all owned by Sohail, on the tracker's **Decisions & Risks** sheet with
options, a recommendation and the tasks each blocks. **Three are already
Decided** by product direction on 2026-09-04:

| ID | Decision | Status |
|---|---|---|
| **D-4** | Payment gateway in September? | **Decided — no.** Plan journey ships without the charge; `activateSubscription()` is October's seam |
| **D-5** | What unlocks a candidate's contact? | **Decided — plan credit, instant unlock.** `hasContactAccess()` unchanged |
| **D-7** | Company verification before search? | **Decided — no gate.** Details collected and shown; nothing blocks search |

The other ten are open and due 5–7 September: D-1 (Phase 7 freeze), **D-2
(migrate deploy — blocks all twelve migrations)**, D-3 (plan limits as seed data),
D-6 (allow-list vs open signup), **D-8 (privacy copy — now higher stakes because
money changes hands for contact)**, D-9 (which recruiter events earn email),
D-10 (assessment question types), D-11 (insight methodology: facts vs inference),
D-12 (role-family taxonomy), D-13 (workspace information architecture).

---

## 14. Release Checklist — Saturday 19 September

The tickable version is the **Release Checklist** sheet — 27 steps with a status
and an evidence column each, and a five-signature block. Seventeen of them are
**production smokes**, one per journey step, each walked by its accountable owner
with a fresh account.

> **The rule that makes this a contract, not a ceremony:** a journey step with no
> passed production smoke **is not released**. It ships behind an OFF flag and its
> owner keeps the defect. Sohail signs only when the **Recruiter Journey** sheet
> reads 30 of 30 `PROD VERIFIED`.

---

## 15. October Backlog

**From the September cut, with owners:** payment gateway (Sohail) · candidate job
alerts (Manuvrtti) · GitHub live sync (Manuvrtti) · candidate profile-view
notification (shashank) · assessment descriptive questions and manual grading
(Zainab) · per-job analytics drill-down (shashank) · self-serve plan
upgrade/downgrade (Sohail) · open self-serve recruiter signup, which waits on the
gateway (Shivansh) · role-aware ranking for non-technical roles (shashank) ·
automated E2E for cohort, hackathon and mock interview (Zainab) · job filters on
experience and eligibility (Shivansh).

**Later:** coding-execution assessments (needs a sandbox) · recommendation engine
· dedicated search infrastructure · Kaggle, Codeforces, Behance and Dribbble
links on the same tiered-trust model · 078 Phase 7 W1-B onward.

**Standing technical debt:** `SkillEvidence` had no live writer for the
platform's entire history. P1 fixes it forward and the backfill fixes it
backward; what neither fixes is the process gap that let a table central to the
architecture go unwritten for months. Add a drift check. Also: D-8 must not be
carried into October a third time, and `docs/project-context.md` is reconciled
only through 2026-08-24.

## Appendix A — Definition of Done

**A feature is NOT complete because the frontend exists, the backend exists, the
API works, one happy-path test passes, or existing functionality was assumed to
work.**

For every mandatory feature, complete means all of the following, in order:

1. **A user enters the journey** — from a genuinely fresh account, not a cached session.
2. **They complete every important action in it** — not the happy path only.
3. **Data persists correctly** — across a reload, and across a real logout and login.
4. **Downstream systems receive the correct data** — evidence, points, pipeline, analytics, the recruiter surface, the candidate surface.
5. **Permissions are correct** — server-side, including cross-organization isolation, **with the client bypassed**.
6. **Notifications and analytics work** where the feature requires them, and stay silent where the user switched them off.
7. **Edge cases work** — empty, error, loading, duplicate, expired, exhausted entitlement, failed provider, rate-limited.
8. **The automated E2E passes** in CI on the release branch, with a fresh account.
9. **The production smoke passes** — the accountable owner walked the journey on production and recorded the row id.

And the standing engineering bar:

10. Works on desktop **and** at 390px, with tap targets ≥44px.
11. Zod at the boundary, `{ok}` envelope, Prisma `select` only, transactions for multi-step writes, `lib/logger.ts` not `console.error`.
12. Design-system conformance stated: which existing pattern the screen reuses, which tokens carry its colour and type, and the one place accent is spent.
13. Migrations rehearsed on a Neon child branch before they touch production.
14. Relevant existing suites still pass; nothing regressed.
15. No console errors, no new Sentry error class.
16. **Its UAT script passed on the U4 re-run**, verified by someone other than the author.
17. `docs/CHANGELOG.md` has its one-line entry if the change was architecturally significant.
18. Any new environment variable is set in Vercel **before** the code that reads it deploys.

> **A feature cannot be marked COMPLETE while its UAT script or its production
> smoke is outstanding.** Not "complete pending UAT". Not complete.

### On acceptance criteria

Task-level acceptance criteria are **per task and observable**. The workstream
outcome is a separate column and is explicitly not what a task is tested against.

> **Bad** — Task: *Implement shortlist persistence.* Acceptance: *Recruiters can
> professionally hire candidates end-to-end.*
>
> **Good** — Task: *Make `TalentListItem` the live shortlist, keyed on
> `candidateUserId`.* Acceptance: *Shortlist a candidate in Browser A, sign out,
> open Browser B, sign in, and the candidate is still shortlisted in the correct
> talent project. Nothing about the shortlist is read from `localStorage`.*

> **The question every row must answer:** if this breaks on 19 September, exactly
> which developer owns fixing the **entire** journey step? If the answer is
> unclear, the ownership is not strong enough and the row is wrong.

### The final bar

By 19 September a real recruiter should be able to use ABTalks **without anyone
from the team explaining where to click next**. That is UAT script U-R12, it is
run on U1 and again on U4, and every hesitation the tester shows is logged as an
S2 defect.

The experience should feel like *"I have a hiring workspace"* — not *"I have
access to several unrelated recruiting features."*

## Appendix B — Escalation

- **Blocked > 3 hours** → post in the team channel, tag Sohail. A day lost is 1/21st of the build window.
- **A P0 will miss its phase** → escalate at the checkpoint, not afterwards. **Tue 16 Sep** and **Tue 23 Sep** are the designated moments, and they are when release valves are called.
- **An S1 open past 4 hours during UAT** → Sohail decides: extend, flag off, or move the release. **Scope moves before the date does.**
- **A migration behaves unexpectedly on a child branch** → stop, gather the exact error, do not improvise (`.cursorrules`, `AGENTS.md`).
- **A build error contradicts the plan** → trust the error, gather data, report it. Do not defend the plan.
- **Scope pressure** → call the next release valve **whole** before shipping any P0 half-built. A half-built P0 is worse than a missing P1.
- **A journey cannot be finished by the freeze** → it is flagged OFF at the release with its owner named, not shipped half-working. Say so at the checkpoint, not on release day.

## Appendix C — What changed in revision 3

| | Revision 2 | **Revision 3** |
|---|---|---|
| Organising principle | Nineteen parallel workstreams | **One north-star recruiter journey**, with everything else feeding it |
| Workstreams | 19 W-prefixed | **24: G0 governance · C1–C5 candidate supply · R1–R12 recruiter · P1–P5 platform** |
| Tracker tasks | 244 | **209** — fewer and sharper, each with its own acceptance criterion |
| Acceptance criteria | Some shared across a workstream | **Per task, observable**, with `Workstream outcome` split into its own column |
| Junior-developer support | — | **"Where to start" on every task** (real files, models, existing patterns) and a **decision-dependency** column |
| Payment | Admin activation only, gateway unscoped | **D-4 decided: gateway deferred to October**; full plan journey ships; `activateSubscription()` is the seam |
| Contact unlock | Admin-approved introduction | **D-5 decided: plan credit, instant unlock**; `hasContactAccess()` unchanged |
| Recruiter workspace UI | Not a workstream | **R12, funded at 4.0d**, with its own UAT script (U-R12) run twice |
| Outreach / email | **Missing entirely** | **R6, 3.5d** — unlock, compose, templates, send, history, pipeline move |
| Recruiter notifications | Candidate-side only | **R7, 2.5d** — seven types, three by email, a notification centre |
| Candidate insights | P1, first release valve | **R4, P0, 3.0d** — the contradiction between "in UAT" and "out of scope" is removed |
| E2E journeys | 21 | **17**, retargeted at the recruiter journey |
| UAT scripts | 30 | **21**, including U-R12, the first-impression test |
| Decisions | 12 | **13**, three already Decided |
| Coverage matrix | Mandatory feature list | **30-step recruiter journey**, and the release is declared only at 30/30 |
| Load | ~119% of effective | **122%**, balanced 109/104/107/104/95 with Zainab as designated absorber |

**What was removed to fund it:** candidate job alerts, GitHub live sync, the
candidate profile-view notification, automated E2E for three verification
streams, two job filters — and the payment gateway, by product decision. Every
one is in §15 with an owner.

**No step of the protected recruiter journey was removed.**
