# T-253 — Event instrumentation with no personal data

**Owner:** Manuvrtti
**Branch:** `feature/T-253-GA-2`
**Implementation date:** 2026-09-10
**Depends on:** T-150 (`docs/plans/114-ga4-event-taxonomy.md`), T-252 (`docs/plans/115-t252-ga4-consent-loader.md`) — both merged
**Blocks:** T-254 (UTM capture + DebugView verification)
**Test case:** not yet confirmed against `ABTalks_Execution_Plan.xlsx` — the acceptance criteria in §3 are taken from the T-253 task brief, not quoted from the sheet.

> Written alongside the implementation rather than before it, because T-253 is
> the follow-up plan 115 §12 already scoped ("the typed `track()` wrapper and
> event emit sites — that's T-253"). The design decisions that were genuinely
> open are recorded in §10.

---

## 1. Goal

Send GA4 a named event at the moment each of nine product actions **successfully
completes**, carrying the minimum non-personal information required — reusing
T-252's loader and consent gate, adding no second analytics system.

Seven of the nine are implemented. Two have no honest emit site; see §10.1.

## 2. Current behavior (verified 2026-09-10 on `feature/T-253-GA-2`)

- **T-252 shipped the loader only.** `src/components/analytics/ga4-loader.tsx`
  mounts `gtag.js` and calls `gtag('config', …)`. Under its strict gate
  (`ga4-loader-gate.ts`) it renders `null` unless `ready && isProduction() &&
  measurementId && choice ∈ {limited, all}`.
- **Nothing emitted a single event.** A repo-wide grep for `gtag(`,
  `dataLayer`, `trackEvent` returned no hits outside
  `src/components/analytics/`. GA4 therefore recorded automatic `page_view`
  only — which pages were visited, never what was done on them.
- **None of the four excluded behaviours were tracked**, because nothing was.
  There was no analytics instrumentation anywhere to remove.
- **`src/lib/analytics/consent.ts` already anticipated this plan** — its header
  says it carries no `"server-only"` marker so "client callers (the GA4 loader)
  and server callers (T-253 emit sites) can share one source of truth."
- **Only `NEXT_PUBLIC_GA_MEASUREMENT_ID` exists** in `.env.example`. There is no
  Measurement Protocol API secret, so there is no server-side transport.

### 2.1 Where the nine behaviours actually complete

| Behaviour | Exists? | Completion point |
| --- | --- | --- |
| Recruiter signup completed | yes | `registerRecruiterWithOtpAction` → `recruiter-register-form.tsx` |
| Candidate profile updated | yes | 8 wizard sections, all via `use-section-save.ts` |
| Candidate skill added | yes | `saveSkillsAction` → `skills-section.tsx` |
| Job application created | yes | `applyToJobAction` → `apply-job-button.tsx` |
| Assessment submitted | yes | `submitQuizAction` → `quiz-form.tsx` |
| Contact unlock completed | yes | `decideEngagementAction` → `CONTACT_SHARED` → `engagement-decision.tsx` |
| Candidate profile viewed | yes | `/talent/members/[id]` — Server Component render |
| **Job alert sent** | yes, but | `runHireAlertsCron` — Vercel cron, **no browser** |
| **Profile-view notification sent** | **no** | **feature does not exist** |

Notes on the last two, both confirmed by inspection:

- `runHireAlertsCron` is triggered by `/api/cron/hire-alerts` with a
  `CRON_SECRET` bearer token. No session, no browser, no consent choice to read.
- There is no `ProfileView` model in `prisma/schema.prisma`, no view recording
  anywhere, and the only writers of `Notification` are admin broadcasts
  (`admin-notification-actions.ts`) plus the code-derived workshop / hackathon /
  cohort feed in `derive-event-notifications.ts`. Nothing notifies a candidate
  that a recruiter viewed them. `SkillEvidence` has no live writer either
  (CLAUDE.md), which is the same class of gap.

The entry assessment (`submitEntryAssessmentAction`) is dead — the page at
`/program/ai-cohort/assessment` is a bare `redirect()` back to `/apply`. The
live assessment surface is the weekly quiz, so "assessment submitted" maps to
`submitQuizAction`.

## 3. Acceptance criteria (from the T-253 brief)

| # | Criterion | Status |
| --- | --- | --- |
| 1 | The nine behaviours emit events **only after the action succeeds** — not on click, not on render, not on request start. | **7 of 9.** Two are not implemented — see §10.1. The seven that are all emit from a confirmed-success branch. |
| 2 | One successful action produces **exactly one** event. | Met for all seven. Not proven by execution — see §8.1. |
| 3 | **No personal data** reaches GA4. Events that need no data send no parameters. | Met. Three events declare no parameters at all; the rest carry bounded enums only. |
| 4 | **No events** for candidate visibility toggles, recruiter Google login, Company Admin, team invitation. | Met. There was nothing to remove — none of them were tracked, because nothing was. Guarded by a regression test. |
| 5 | Uses T-252's existing analytics/consent mechanism. No second GA4 initialisation, no second analytics system. | Met and enforced as a build-failing invariant. |

**Criterion 1 is the one this plan does not fully satisfy.** "Job alert sent"
and "profile-view notification sent" are not implemented — the first has no
browser to emit from, the second has no feature to emit about. Both were put to
Sohail as explicit questions during implementation and both answered "skip it,
document why"; the reasoning is in §10.1.

Separately, **no GA4 DebugView verification has been performed** (§8.2), so no
criterion above has been confirmed against the live property.

## 4. Files to touch

### New

| Path | Note |
| --- | --- |
| `src/lib/analytics/events.ts` | Pure: event names, per-event parameter allowlist, `sanitizeParams`, bucket rules, `hasAnalyticsConsent`. No React, no `window`. |
| `src/lib/analytics/use-track.ts` | `"use client"` — `useTrack()`, the only `gtag('event')` call site in the repo. |
| `src/components/talent/track-candidate-view.tsx` | `"use client"` — renders nothing; the one emit site whose trigger is a render, so it carries its own dedupe. |
| `src/lib/analytics/events.test.ts` | Unit tests for the pure module. |
| `src/lib/analytics/instrumentation.test.ts` | Source-level guards: one transport, one emit per event, exclusions clean. |

### Edited

| Path | Note |
| --- | --- |
| `src/components/talent/recruiter-register-form.tsx` | Emit `recruiter_reg_submitted`. |
| `src/components/profile/use-section-save.ts` | New required `section` arg; emit `site_profile_updated`. |
| `src/components/profile/{basic-info,certifications,education,experience,links,preferences,projects,skills}-section.tsx` | Pass the `section` argument (one line each). |
| `src/components/profile/skills-section.tsx` | Also emit `site_skill_added` when the save added a new skill id. |
| `src/components/jobs/apply-job-button.tsx` | Emit `site_job_applied`. |
| `src/app/quiz/[quizId]/quiz-form.tsx` | Emit `site_test_completed` with `score_bucket`. |
| `src/components/admin/engagement-decision.tsx` | Emit `recruiter_contact_unlocked` on a persisted `CONTACT_SHARED`. |
| `src/app/talent/members/[id]/page.tsx` | Mount `<TrackCandidateView>`. |
| `src/features/hire/run-hire-alerts.ts` | Doc comment only — records why it is deliberately not instrumented. |
| `package.json` | Two `test:analytics-*` scripts. |
| `docs/CHANGELOG.md` | One line under `## Pending reconcile`. |

**Not touched:** `middleware.ts`, `auth.config.ts`, `auth.ts`, `prisma/schema.prisma`,
`src/components/analytics/*` (all of T-252), `src/lib/analytics/consent.ts`.

## 5. Server vs Client

Every emit site is a **Client Component**. Plan 114 §9 forbids emitting from
Server Actions: the actions return `{ ok, data }` and the client caller reads
the envelope and emits, which keeps the event next to the user intent and stops
admin- or system-triggered writes entering the funnel.

| File | Kind |
| --- | --- |
| `events.ts` | plain module — importable from both, no `"server-only"`, no `next/headers` |
| `use-track.ts`, `track-candidate-view.tsx` | Client |
| all 7 emit sites | Client (already were) |
| `src/app/talent/members/[id]/page.tsx` | **Server** — mounts the client island |

**The one Server → Client prop crossing:** `TrackCandidateView` receives
`candidateRef: string` — the pseudonymous public id already printed on the page.
A plain string. No functions, no icons, no class instances.

## 6. Steps

1. **`events.ts`** — declare `ANALYTICS_EVENTS` (7 names), the bounded value sets
   (`PROFILE_SECTIONS`, `SKILL_COUNT_BUCKETS`, `SCORE_BUCKETS`, `SIGNUP_METHODS`),
   the `EVENT_PARAMS` runtime allowlist and its `AnalyticsEventParams`
   compile-time mirror, `sanitizeParams`, `skillCountBucket`, `scoreBucket`, and
   `hasAnalyticsConsent` — the last derived from T-252's `toGaConsent`, never
   from a fresh copy of the "limited or all" rule.
2. **`use-track.ts`** — `useTrack()` reads `useCookieConsent()`, returns a
   `useCallback` that no-ops unless `ready`, consent grants `analytics_storage`,
   and `window.gtag` is a function; otherwise sanitises and calls
   `gtag('event', name)` or `gtag('event', name, safe)`.
3. **`use-section-save.ts`** — add a third required `section: ProfileSection`
   parameter, emit `site_profile_updated` immediately after the `!result.ok`
   early return, add `section` and `track` to the `useCallback` deps.
4. **The 8 section components** — pass the matching section literal. TypeScript
   makes this exhaustive: a missed one fails the build.
5. **`skills-section.tsx`** — before calling `save`, compute `submittedIds` and
   `addedCount` against the pre-save `persistedIds`; after `ok`, emit
   `site_skill_added` only when `addedCount > 0`.
6. **`apply-job-button.tsx`, `quiz-form.tsx`, `recruiter-register-form.tsx`** —
   emit inside the existing success branch.
7. **`engagement-decision.tsx`** — emit only when
   `res.data.status === "CONTACT_SHARED"`, so the other three decisions sharing
   the handler stay silent.
8. **`track-candidate-view.tsx`** — `useEffect` guarded by `if (!ready) return`
   and a `useRef` holding the last id emitted for; mount it in the page.
9. **Tests + scripts + CHANGELOG.**

## 7. DB safety

**Not applicable.** No schema change, no migration, no seed, no new Prisma
model, no data written. Consent stays a cookie
(`docs/legal/business-decisions.md`). Plan 078 is untouched — no repository is
read or written by this work.

## 8. Verification

### 8.1 Automated — all green on 2026-09-10

| Command | Result |
| --- | --- |
| `npm run test:analytics-events` | 19 assertions passed |
| `npm run test:analytics-instrumentation` | 9 assertions passed |
| `npm run test:analytics-consent` (T-252) | 4 passed |
| `npm run test:analytics-loader` (T-252) | 12 passed |
| `npx tsc --noEmit` | clean |
| `npm run lint` | 191 problems — **identical to the stashed baseline**, zero new |
| `npm run build` | compiled in 44s, 82/82 static pages |

**What the two suites actually prove — and don't.** `events.test.ts` executes
real code: it throws emails, phones, names, recruiter notes, tokens, a whole raw
registration form and free text smuggled under an allowlisted key at all seven
events and asserts nothing survives. `instrumentation.test.ts` does **not**
execute anything — it is a regex scan over file contents, proving properties of
the source ("exactly one `gtag('event')` call site", "each event constant
appears in exactly one file, once", "no excluded file imports the analytics
module"). Both were mutation-tested — a duplicated `track()` call and an
instrumented login page each failed the suite as they should — so the
assertions are not vacuous.

**Known test gap:** `useTrack()` itself is never executed. There is no React
test framework in this repo (no vitest, jest or RTL), so the three-condition
gate inside the hook has no automated coverage, and "fires once, only on
success" rests on control-flow reading plus the occurrence count above. Closing
this properly means extracting the emit decision into a pure
`buildEmit({ ready, choice, name, params })` — the same split T-252 used to pull
`ga4-loader-gate.ts` out of `ga4-loader.tsx`. Not done here; see §11.

### 8.2 Manual — GA4, NOT yet performed

No DebugView or Realtime verification has been done. `gtag` does not exist
outside production, so this cannot be checked from a normal dev session.

To verify locally before deploying:

1. Set `NEXT_PUBLIC_APP_ENV=production` in `.env.local` and restart `npm run dev`
   (`NEXT_PUBLIC_*` is read at startup).
2. Accept cookies in the banner — "all" or "limited". Under "essential" or
   undecided, nothing loads, by design.
3. Perform each of the seven actions.
4. GA4 → **Reports → Realtime** → "Event count by Event name". Events appear
   within ~30 seconds. For per-event detail use **Admin → DebugView** with the
   *Google Analytics Debugger* Chrome extension, since T-252's `config` call
   does not set `debug_mode`.
5. **Revert `NEXT_PUBLIC_APP_ENV` to `development`** — otherwise every local dev
   session sends hits to the production property.

This sends real hits to the live GA property from localhost. Note the timestamp
if they need excluding later.

### 8.3 GA4 property configuration (manual, one-off)

Events appear on their own; their parameters do not. Register these as **Event**
scoped custom dimensions under **Admin → Data display → Custom definitions**,
before the deploy — GA does not backfill:

`section` · `score_bucket` · `skill_count_bucket` · `method`

Plan 114 §4.12 recommends marking `recruiter_reg_submitted`, `site_job_applied`,
`site_test_completed` and `recruiter_contact_unlocked` as **Key events**.

### 8.4 Files that should have changed

`git status --short` shows **17 modified, 6 untracked** — the table in §4, plus
`package.json`, `docs/CHANGELOG.md` and this plan. `git diff` was reviewed line
by line; there are no unrelated changes.

## 9. Guardrails (DO NOT)

- **DO NOT** touch `middleware.ts`, `auth.config.ts` or `auth.ts`. Analytics is
  client-side only; a `@/lib/*` import in the edge path blows the 1 MB bundle.
- **DO NOT** modify anything under `src/components/analytics/` or
  `src/lib/analytics/consent.ts`. T-252 is merged and tested; T-253 rides on it.
- **DO NOT** add a second `gtag('config')`, a second `googletagmanager` script,
  or a second reader of `NEXT_PUBLIC_GA_MEASUREMENT_ID`.
  `instrumentation.test.ts` fails the build if you do.
- **DO NOT** call `gtag` directly from any component. Use `useTrack()`.
- **DO NOT** pass an event name as a string literal — always
  `ANALYTICS_EVENTS.*`, because the parameter allowlist keys off the name.
- **DO NOT** emit from a Server Action, a route handler, or a cron. Plan 114 §9.
- **DO NOT** wire an event to `onClick` / `onChange` / `onSubmit`. Emit from the
  branch that already knows the server confirmed the write.
- **DO NOT** widen a parameter's value set to accept free text. If a new
  dimension is needed, add a **bounded enum or a bucket rule**, never a
  pass-through string.
- **DO NOT** instrument candidate visibility toggles, recruiter Google login,
  Company Admin (seats / roles / company settings) or team invitations.
- **DO NOT** add `debug_mode` to the T-252 config to make DebugView work — use
  the Chrome extension.

## 10. Decision record

### 10.1 Two of the nine are not implemented (decided 2026-09-10, by Sohail)

Both were put as explicit questions during implementation; both answered
"skip it, document why".

**Job alert sent.** `runHireAlertsCron` runs on a Vercel cron with no browser
and no viewer. ABTalks sends GA4 events one way only — `window.gtag`, gated on
the recipient's own consent cookie. Reaching GA from there means adding the
Measurement Protocol: a second transport, a second credential
(`GA_API_SECRET`), and events sent about a recruiter with no consent signal of
theirs to attach. Rejected as a second analytics system and a consent
regression. The count is already available from `HireAlertsResult.alerted`,
which `/api/cron/hire-alerts` returns in its JSON response and logs on a partial
failure. The reasoning is recorded as a doc comment at the function itself, so
the next person to look does not re-derive it.

**Profile-view notification sent.** The product behaviour does not exist —
nothing records a profile view, nothing notifies a candidate. Building it would
mean a schema change, which the brief excluded. The name stays reserved for
whoever builds T-085. Note that plan 114 §4.11 lists profile-view tracking under
*deliberate omissions* on PII grounds ("they contain recruiter identity"); a
parameter-less event carries no such identity, so the exclusion there is not a
blocker if the feature is later built — but the feature has to exist first.

### 10.2 Allowlist, not denylist (decided 2026-09-10)

Plan 114 §7 specifies a `sanitizeParams` helper against a list of forbidden
strings. Implemented as the inverse: a per-event allowlist where every
permitted parameter has a **bounded set of permitted values**.

A denylist only catches the leaks somebody thought of, and has to be kept in
step with every new field on every model. An allowlist of eight short enums
cannot carry a name, an email, a phone number, a note, an answer or a row id no
matter what a call site passes — including a call site that hands over a whole
raw form object, which `events.test.ts` exercises directly. Strictly stronger
than §7 and strictly less maintenance.

### 10.3 `section` is an argument, not derived from `label` (decided 2026-09-10)

`useSectionSave` already took a `label` ("Basic information", "Career
preferences") used in the toast. Deriving the analytics dimension from it would
have avoided eight one-line edits, but `label` is user-facing copy: an analytics
dimension that silently changes when somebody rewords a toast is not a
dimension. Added as a required third parameter instead, so TypeScript makes the
eight call sites exhaustive.

### 10.4 `preferences` added to the section enum, `resume` dropped

Plan 114 §4.8 lists eight `section` values including `resume` but not
`preferences` — it gives preferences its own `site_preference_updated` event in
§4.9, which is not among T-253's nine. Since the preferences step saves through
the same hook as its seven siblings, excluding it would have meant special-casing
one wizard step into silence. `preferences` was added and `resume` dropped, so
the enum matches exactly what can fire. **This is a deliberate divergence from
plan 114 §4.8** and should be folded back into the taxonomy at the next
reconcile.

### 10.5 Known coverage gap: resume and avatar

The "Resume" step is a peer section in the same profile wizard
(`src/app/profile/page.tsx`, key `"resume"`) but is marked `savable: false` — it
saves itself through `uploadResumeAction` / `saveResumeLinkAction` /
`removeResumeAction` and bypasses `useSectionSave`. Avatar upload does the same
from `profile-card.tsx`. **Neither emits `site_profile_updated` today.**

Left as-is because plan 114 gives resume its own event (`site_resume_uploaded`,
with `parsed_ok` and `size_bucket`) which is not among T-253's nine, and avatar
has no taxonomy event at all. Adding `{ section: "resume" }` to the two
successful resume paths is a two-line change if the coverage is wanted.

### 10.6 Contact unlock is an admin surface

Plan 114 §4.11 excludes `/admin/*` from tracking as internal and noisy. But
`CONTACT_SHARED` on a `TalentEngagementRequest` is the only contact unlock that
exists in this codebase, and it is decided by an admin in `/admin/hire`. The
T-253 brief requires the event, so the brief wins. It carries no parameters, so
nothing about the admin, the recruiter or the candidate is sent — and
`recruiter_contact_unlocked` is a Key event in plan 114 §4.12, which would be
unfillable otherwise.

## 11. Follow-ups

- **T-254** — UTM capture and the DebugView verification pass.
- **Runtime coverage for `useTrack`** — extract `buildEmit(...)` as a pure
  function and unit-test every branch of the gate and every payload (§8.1).
- **Reconcile plan 114** — fold in §10.4 (`preferences` / `resume`), and record
  that `site_job_alert_sent` and the profile-view notification events have no
  emit site.
- **Resume / avatar coverage** — §10.5, if wanted.

## 12. Commit message

```
T-253: GA4 event instrumentation with no personal data

Adds the typed event vocabulary and the emit sites plan 115 §12 left to
T-253, riding entirely on T-252's loader and consent gate — no second GA4
initialisation, no second transport.

src/lib/analytics/events.ts is pure (no React, no window): the seven event
names, a per-event parameter ALLOWLIST of bounded value sets, sanitizeParams,
the bucket rules, and hasAnalyticsConsent derived from T-252's toGaConsent so
the emit gate cannot drift from the loader's. src/lib/analytics/use-track.ts
holds the only gtag('event') call in the repo and no-ops unless consent is
read, grants analytics_storage, and window.gtag exists.

Seven events, each emitted once from the branch that already knows the server
confirmed the write: recruiter_reg_submitted, site_profile_updated (new
required `section` arg on useSectionSave, 8 wizard sections), site_skill_added
(only when the save added a new skill id), site_job_applied, site_test_completed
(score_bucket only, never the score), recruiter_contact_unlocked (only on a
persisted CONTACT_SHARED), and recruiter_candidate_viewed via a ref-deduped
render beacon on /talent/members/[id].

Not tracked, deliberately: candidate visibility toggles, recruiter Google
login, Company Admin and team invitations — none of which had any
instrumentation to remove. Also not tracked: "job alert sent"
(runHireAlertsCron is a browserless cron; reaching GA would need the
Measurement Protocol) and "profile-view notification sent" (no such feature
exists). Both decisions are recorded in docs/plans/117 §10.1.

No PII: every parameter is a bounded enum, so names, emails, phones, notes,
answers and row ids cannot pass whatever a call site hands over.

Tests: test:analytics-events (19), test:analytics-instrumentation (9).
T-252's suites, tsc, lint (identical to baseline) and build all pass.
GA4 DebugView verification is NOT done — see plan 117 §8.2.

Refs: T-253
Plan: docs/plans/117-t253-event-instrumentation.md
```
