# 114 — GA4 Event Taxonomy (P7 · Week 1 pre-instrumentation)

## 1. Goal

Publish the agreed **event taxonomy** for Google Analytics 4 on ABTalks — one
naming convention, every event named with its trigger, actor, parameters, and
key-event flag, plus an explicit list of what must never be sent — **before any
GA snippet, `gtag` call, or GTM container ships to production**.

This plan does not add analytics code. It fixes the vocabulary so a follow-up
plan can wire GA4 with zero ad-hoc naming or "we'll decide the params later"
decisions in Cursor.

## 2. Current behavior (verified 2026-09-08 on `feature/GA4-T-150`)

Re-verified the 6-Sep finding line-by-line:

- **No GA / GTM / analytics SDK anywhere in the repo.**
  - `package.json` has zero matches for `@vercel/analytics`, `posthog-js`,
    `@sentry/*`, `@datadog/*`, `mixpanel`, `amplitude`, `@segment/*`, `react-ga`,
    `next-third-parties`.
  - Source grep for real GA/GTM markers — `gtag(`, `GoogleAnalytics`,
    `GA_MEASUREMENT`, `GTM-…`, `googletagmanager`, `window.dataLayer`,
    `posthog`, `@sentry` — returns **no application code matches**. The only
    hits are prose in [content/legal/privacy.md:101](content/legal/privacy.md#L101)
    and [content/legal/cookies.md:46](content/legal/cookies.md#L46) that state
    outright: *"We do not currently use Google Analytics, PostHog, Meta Pixel …
    in the product."*
  - No Tag Manager container is embedded anywhere — the earlier note
    ("check for a GTM container before assuming nothing exists") is
    confirmed negative.
- **The cookie-consent mechanism exists and is production-grade.**
  It is described in [docs/plans/060-legal-compliance-hardening.md](docs/plans/060-legal-compliance-hardening.md)
  and lives across:
  - [src/lib/cookies.ts](src/lib/cookies.ts) — `CONSENT_COOKIE_NAME =
    "abtalks_consent"`, `COOKIE_CHOICES = ["all","limited","essential"]`,
    `allowsAttribution()` returning `true` only for `all` and `limited`
    ([src/lib/cookies.ts:18-24](src/lib/cookies.ts#L18-L24)).
  - [src/lib/legal-constants.ts:16](src/lib/legal-constants.ts#L16) —
    `COOKIE_POLICY_VERSION = "2026-08-10"`. The cookie is stored as
    `<choice>.<version>`; bumping the version invalidates every stored choice
    and re-prompts.
  - [middleware.ts:14-27](middleware.ts#L14-L27) and
    [middleware.ts:99-121](middleware.ts#L99-L121) — Edge-safe reader; on
    `essential` it actively **deletes** `abtalks_ref` / `abtalks_src`.
  - [src/components/legal/cookie-consent-provider.tsx](src/components/legal/cookie-consent-provider.tsx)
    — client provider, `useCookieConsent()` returns the current choice,
    replays `?ref=` / `?s=` through `setCookieConsentAction` on accept.

**Consequence for GA4:** we have exactly one authoritative source of consent
state, on both server and client, and it distinguishes `all` / `limited` /
`essential`. GA4 must gate on it (see §6).

## 3. Naming convention (single source of truth)

Every custom event on ABTalks uses this form:

```
<track>_<object>_<verb_past_tense>
```

- `track` — the ABTalks track the event happened in.
  Allowed values, matching the four tracks in [CLAUDE.md](CLAUDE.md):
  `challenge` (60-Day), `program` (AI Cohort + Databricks + DS-Architect +
  PowerBI), `hackathon`, `workshop`, `recruiter` for the hiring platform,
  and `site` for cross-track surfaces (landing, legal pages, cookie banner,
  generic auth, candidate hiring journey, notifications).
- `object` — the noun the user acted on: `registration`, `application`,
  `submission`, `quiz`, `day`, `certificate`, `product`, `job`,
  `intro_request`, `interview`, `resume`, `cookie_banner`, `session`, `page`,
  `project`, `contact`, `outreach`, `test`, `pipeline`, `hire`, `plan`,
  `member`, `role`, `company`, `onboard`, `criteria`, `shortlist`,
  `candidate`, `checkout`, `visibility`, `skill`, `link`, `preference`,
  `notif_pref`, `profile`, `search`.
- `verb_past_tense` — `viewed`, `started`, `submitted`, `completed`,
  `failed`, `abandoned`, `accepted`, `declined`, `clicked`, `opened`,
  `verified`, `redeemed`, `ran`, `added`, `requested`, `moved`, `posted`,
  `closed`, `created`, `assigned`, `changed`, `updated`, `invited`,
  `uploaded`, `decided`, `issued`, `broken`, `unlocked`, `sent`, `applied`.

Rules:

- **Lowercase, snake_case, ASCII only.** GA4 event names are case-sensitive.
- **Max 40 characters** (GA4 limit); we cap ourselves at **32** to keep
  future room.
- **We do NOT rename GA4 reserved events** (`page_view`, `login`, `sign_up`,
  `select_content`, `view_search_results`, `session_start`, `first_visit`).
  Those keep their reserved names; only ABTalks-specific events use the
  `<track>_<object>_<verb>` form.
- **Parameter names**: snake_case, ≤ 40 chars. `user_properties` are prefixed
  `up_` in code, unprefixed at the GA property.

Rejected alternatives (do not reintroduce):

- `abtalks.challenge.registration.submitted` — dot-notation isn't GA4
  idiomatic and blows the length budget once we add day/track suffixes.
- `RegistrationSubmitted` — TitleCase collides with GA4 reserved-event
  casing behavior.

## 4. Event catalog

Legend for **Actor**: `anon` (no session), `student`, `program_member`,
`recruiter`, `admin`, `system` (server-emitted, never from the browser).
"Key event" = marked as a GA4 Key Event (formerly "conversion") in the
GA property.

### 4.1 Site-wide (reserved GA4 events + banner)

| Event                    | Trigger                                             | Actor  | Key? | Params                                                                                     |
| ------------------------ | --------------------------------------------------- | ------ | ---- | ------------------------------------------------------------------------------------------ |
| `page_view` (reserved)   | Every route change (client-side nav + first paint)  | any    | no   | `page_location`, `page_title`, `page_referrer`, `content_group` (= track), `logged_in`     |
| `session_start` (reserved) | First event of a session                          | any    | no   | auto                                                                                       |
| `first_visit` (reserved) | First-ever session on this client                   | anon   | no   | auto                                                                                       |
| `login` (reserved)       | Successful `signIn` callback fires                  | any    | no   | `method` = `google` \| `credentials` \| `otp`                                              |
| `sign_up` (reserved)     | First-ever session persisted for a new user id      | any    | **yes** | `method`, `track` (which track's funnel completed the sign-up)                          |
| `site_cookie_banner_viewed` | Banner mounts because `choice === null`          | anon   | no   | `policy_version`                                                                           |
| `site_cookie_banner_decided` | User picks a choice in the banner or `/cookies` | any    | no   | `choice` = `all` \| `limited` \| `essential`, `policy_version`, `source` = `banner` \| `settings_page` |

### 4.2 60-Day Challenge (`challenge_*`)

| Event                          | Trigger                                                       | Actor    | Key?    | Params                                                              |
| ------------------------------ | ------------------------------------------------------------- | -------- | ------- | ------------------------------------------------------------------- |
| `challenge_registration_started`   | Landing → clicks "Join the challenge" on `/` or `/challenges` | anon     | no      | `entry_ref` (= `abtalks_src` cookie or `null`), `campus` (if known) |
| `challenge_registration_submitted` | Registration server action returns `{ ok: true }`             | anon → student | **yes** | `method`, `has_referral` (bool), `entry_ref`                    |
| `challenge_day_viewed`             | `/challenge/[day]` (or `/claude/day/[day]`) renders           | student  | no      | `day` (1-60), `domain` = `ai` \| `ds` \| `se` \| `claude`, `is_backfill` |
| `challenge_submission_started`     | Submission modal opens                                        | student  | no      | `day`, `domain`                                                     |
| `challenge_submission_submitted`   | `submitDay` server action returns `{ ok: true }`              | student  | **yes** | `day`, `domain`, `is_backfill`, `has_github`, `has_linkedin`        |
| `challenge_streak_broken`          | Nightly job / next-day render detects a gap                   | system   | no      | `day_missed`, `streak_length_before`                                |
| `challenge_completed`              | Day 60 submission accepted                                    | student  | **yes** | `domain`, `total_days_submitted`                                    |
| `challenge_certificate_viewed`     | `/verify/[certificateId]` opens for a cert owned by the viewer | any     | no      | `cert_kind` = `challenge` \| `hackathon`                            |

### 4.3 AI Cohort Program (`program_*`)

Covers `/program/ai-cohort`, `/program/databricks`, `/program/ds-architect`,
`/program/powerbi`. `cohort_slug` disambiguates.

| Event                            | Trigger                                                              | Actor            | Key?    | Params                                                    |
| -------------------------------- | -------------------------------------------------------------------- | ---------------- | ------- | --------------------------------------------------------- |
| `program_landing_viewed`         | `/program/*` landing renders                                          | any              | no      | `cohort_slug`                                             |
| `program_application_started`    | `/program/*/apply` renders                                            | any              | no      | `cohort_slug`, `entry_ref`                                |
| `program_application_submitted`  | Apply action returns `{ ok: true }`                                   | anon → applicant | **yes** | `cohort_slug`, `method`                                   |
| `program_assessment_started`     | `/program/ai-cohort/assessment` renders                               | applicant        | no      | `cohort_slug`                                             |
| `program_assessment_submitted`   | Assessment action returns `{ ok: true }`                              | applicant        | **yes** | `cohort_slug`, `score_bucket` (`low` \| `mid` \| `high`)  |
| `program_day_viewed`             | `/program/*/day/[day]` renders                                        | program_member   | no      | `cohort_slug`, `day`, `phase`, `is_behind_pace`           |
| `program_mission_verified`       | `verifyMission` returns pass                                          | program_member   | no      | `cohort_slug`, `day`, `attempts`                          |
| `program_project_submitted`      | Project submission action returns `{ ok: true }`                      | program_member   | **yes** | `cohort_slug`, `project_slug`                             |
| `program_interview_started`      | Cohort interview stage `intro` mounts                                 | program_member   | no      | `cohort_slug`, `blueprint`                                |
| `program_interview_completed`    | Report page reachable / server confirms terminal state                | program_member   | **yes** | `cohort_slug`, `blueprint`, `score_bucket`                |
| `program_certificate_issued`     | Server issues a cohort cert                                           | system           | **yes** | `cohort_slug`                                             |

### 4.4 Hackathon (`hackathon_*`)

| Event                              | Trigger                                    | Actor         | Key?    | Params                                          |
| ---------------------------------- | ------------------------------------------ | ------------- | ------- | ----------------------------------------------- |
| `hackathon_landing_viewed`         | `/hackathon` renders                        | any           | no      | `entry_ref`, `campaign` (if `?utm_campaign`)    |
| `hackathon_registration_started`   | `/hackathon/register` mounts                | any           | no      | `entry_ref`                                     |
| `hackathon_registration_submitted` | Registration action returns `{ ok: true }` | anon → student | **yes** | `method`, `team_role` = `solo` \| `leader` \| `member` |
| `hackathon_team_invite_sent`       | Invite action returns `{ ok: true }`       | student       | no      | `role_invited`                                  |
| `hackathon_team_invite_accepted`   | Accept invite server action                | student       | no      | —                                               |
| `hackathon_submission_submitted`   | Submission action returns `{ ok: true }`   | student       | **yes** | `has_video`, `has_repo`, `submitted_within_hours` |
| `hackathon_certificate_issued`     | Participation cert issued                  | system        | no      | `is_finalist`                                   |

### 4.5 Workshop / Cohort funnel (`workshop_*`)

Covers `/ai-workshop`, `/ai-cohort-register`, `/ai-cohort-india`.

| Event                             | Trigger                                              | Actor          | Key?    | Params                        |
| --------------------------------- | ---------------------------------------------------- | -------------- | ------- | ----------------------------- |
| `workshop_landing_viewed`         | Landing page mounts                                   | any            | no      | `funnel_slug`, `entry_ref`    |
| `workshop_registration_started`   | Form mounts / first field focused                     | any            | no      | `funnel_slug`                 |
| `workshop_registration_submitted` | Registration server action returns `{ ok: true }`     | anon → applicant | **yes** | `funnel_slug`, `method`      |
| `workshop_event_viewed`           | `/workshop/events` opens a scheduled event card       | any            | no      | `event_id`                    |

### 4.6 Recruiter / Hire desk (`recruiter_*`)

`recruiter_*` events fire only when the actor is a recruiter session (public
`/hire` and `/talent` landings still emit `page_view` under `content_group`
= `recruiter`).

**Existing recruiter funnel (pre-September):**

| Event                            | Trigger                                                     | Actor     | Key?    | Params                                                  |
| -------------------------------- | ----------------------------------------------------------- | --------- | ------- | ------------------------------------------------------- |
| `recruiter_reg_submitted`        | `/talent/register` completes                                | anon → recruiter | **yes** | `method`                                        |
| `recruiter_search_ran`           | Scout query returns                                          | recruiter | no      | `result_count_bucket` (`0`, `1-5`, `6-20`, `20+`)      |
| `recruiter_candidate_viewed`     | `/hire/[requestId]/candidates` opens a candidate            | recruiter | no      | `card_variant`                                          |
| `recruiter_shortlist_added`      | Add-to-shortlist action returns `{ ok: true }`              | recruiter | no      | `origin` = `card` \| `search` \| `match`                |
| `recruiter_intro_requested`      | Request-intro server action returns `{ ok: true }`          | recruiter | **yes** | `origin`, `has_note`                                    |
| `recruiter_checkout_started`     | Checkout modal mounts                                        | recruiter | no      | `cart_size`                                             |
| `recruiter_checkout_completed`   | Post-payment confirmation reached                            | recruiter | **yes** | `plan`, `cart_size`                                     |

**September hiring features (new — built by T-017 through T-035, T-090 through T-095, T-126 through T-129):**

| Event                            | Trigger                                                          | Actor     | Key?    | Params                                                          |
| -------------------------------- | ---------------------------------------------------------------- | --------- | ------- | --------------------------------------------------------------- |
| `recruiter_onboard_completed`    | Company onboarding finished (all steps done, lands on Home)      | recruiter | **yes** | `method`, `onboard_route` (`self` \| `invited` \| `admin`)      |
| `recruiter_project_created`      | Talent project created and saved                                 | recruiter | **yes** | —                                                               |
| `recruiter_criteria_saved`       | Project criteria saved or updated                                | recruiter | no      | `filter_count`                                                  |
| `recruiter_contact_unlocked`     | Credit spend confirmed server-side (NOT on button press)         | recruiter | **yes** | `credits_left_bucket` (`0` \| `1-5` \| `6-20` \| `20+`)       |
| `recruiter_outreach_sent`        | Outreach email sent successfully                                 | recruiter | no      | `has_subject` (bool)                                            |
| `recruiter_job_posted`           | Job published (moved from draft to live)                         | recruiter | no      | `has_skills` (bool)                                             |
| `recruiter_job_closed`           | Job closed by recruiter                                          | recruiter | no      | —                                                               |
| `recruiter_test_created`         | Assessment published                                             | recruiter | no      | `question_count_bucket` (`1-5` \| `6-10` \| `11+`)             |
| `recruiter_test_assigned`        | Assessment assigned to candidates                                | recruiter | no      | `assignee_count_bucket` (`1` \| `2-5` \| `6+`)                 |
| `recruiter_pipeline_moved`       | Candidate moved to a new hiring stage                            | recruiter | no      | `stage_name`                                                    |
| `recruiter_hire_completed`       | Candidate marked as hired                                        | recruiter | no      | —                                                               |
| `recruiter_plan_viewed`          | Plans/pricing page opened                                        | recruiter | no      | —                                                               |

### 4.7 Company admin (`recruiter_*` — elevated role, same track)

Company admins are recruiters with OWNER or ADMIN role. Events stay in the
`recruiter_*` track because the GA property groups by track, and company
management is part of the recruiter workspace.

| Event                            | Trigger                                                     | Actor     | Key? | Params                                                     |
| -------------------------------- | ----------------------------------------------------------- | --------- | ---- | ---------------------------------------------------------- |
| `recruiter_member_invited`       | Admin invites a colleague by email                          | recruiter | no   | —                                                          |
| `recruiter_role_changed`         | Admin changes a member's role                               | recruiter | no   | `new_role` (`admin` \| `recruiter` \| `viewer`)            |
| `recruiter_company_updated`      | Company settings saved                                      | recruiter | no   | —                                                          |

### 4.8 Auth & profile (`site_*`)

| Event                            | Trigger                                                        | Actor  | Key? | Params                                     |
| -------------------------------- | -------------------------------------------------------------- | ------ | ---- | ------------------------------------------ |
| `site_login_failed`              | `signIn` callback rejects                                       | anon   | no   | `method`, `reason_bucket` (never raw error) |
| `site_profile_updated`           | Profile save action returns `{ ok: true }`                      | student / recruiter | no | `section` = `basic` \| `skills` \| `resume` \| `links` \| `education` \| `experience` \| `projects` \| `certifications` |
| `site_resume_uploaded`           | Resume ingest action returns `{ ok: true }`                     | student | no  | `parsed_ok` (bool), `size_bucket`          |

### 4.9 Candidate hiring journey (`site_*`)

These events cover the candidate experience within the September hiring
features — job discovery, applications, assessments, and profile
discoverability. They use the `site_` prefix because they span the
cross-track candidate surface, not a specific program.

Built by T-013 through T-016 (profile/discoverability), T-077 through T-079
(jobs & applicants), T-080/T-081 (assessments), T-087 (external links),
T-135 (preferences).

| Event                            | Trigger                                                              | Actor   | Key?    | Params                                                          |
| -------------------------------- | -------------------------------------------------------------------- | ------- | ------- | --------------------------------------------------------------- |
| `site_visibility_changed`        | Candidate toggles recruiter visibility on or off                     | student | no      | `new_state` (`on` \| `off`)                                     |
| `site_skill_added`               | Candidate adds a self-declared skill                                 | student | no      | `skill_count_bucket` (`1-3` \| `4-10` \| `11+`)                |
| `site_job_viewed`                | Candidate opens a job listing                                        | student | no      | —                                                               |
| `site_job_applied`               | Job application submitted                                            | student | **yes** | —                                                               |
| `site_test_started`              | Candidate begins a recruiter's assessment                            | student | no      | —                                                               |
| `site_test_completed`            | Candidate submits a recruiter's assessment                           | student | **yes** | `score_bucket` (`low` \| `mid` \| `high`)                      |
| `site_link_added`                | Candidate connects GitHub, LeetCode or CodeChef                      | student | no      | `platform` (`github` \| `leetcode` \| `codechef`)              |
| `site_preference_updated`        | Candidate saves job preferences (opportunity type, availability)     | student | no      | —                                                               |

### 4.10 Notifications (`site_*`)

| Event                            | Trigger                                                              | Actor               | Key? | Params                                             |
| -------------------------------- | -------------------------------------------------------------------- | -------------------- | ---- | -------------------------------------------------- |
| `site_notif_pref_changed`        | User toggles a notification preference                               | student / recruiter  | no   | `channel` (`bell` \| `email`), `new_state` (`on` \| `off`) |

### 4.11 Not tracked (deliberate omissions)

- Admin routes (`/admin/*`). Internal tool; noisy; would pollute funnels.
- Every keystroke, hover, or scroll depth. GA4 auto-collects enhanced
  measurement (scrolls, outbound clicks, file downloads); we do **not** add
  our own on top.
- Chatbot conversation content. Message counts, if ever needed, go through
  our own DB, not GA.
- Individual quiz answers. Only `challenge_quiz_submitted` with
  `score_bucket` (never the score, never per-question data).
- Individual assessment question answers. Only `site_test_completed` with
  `score_bucket`.
- Profile-view tracking events (P4 / T-085). These are DB-recorded for the
  candidate to see, not analytics events — they contain recruiter identity
  which is PII in this context.
- Notification delivery success/failure. These are tracked in the delivery
  log (T-110), not GA — they would carry recipient identifiers.
- Credit ledger movements. Tracked in the database ledger (R2). GA gets only
  the `recruiter_contact_unlocked` event with a bucketed balance.

### 4.12 Key events summary

20 key events total. **Discuss with Sohail whether this should be trimmed.**
GA4 has no hard limit on key events, but more than ~15 dilutes the
conversion signal. If the September hiring funnel is the priority,
consider demoting the track-specific key events (challenge, program,
hackathon, workshop registrations and completions) to regular events
and keeping only the cross-track `sign_up` plus the hiring events.

| # | Event | Track | Actor |
|---|-------|-------|-------|
| 1 | `sign_up` (reserved) | site | any |
| 2 | `challenge_registration_submitted` | challenge | anon → student |
| 3 | `challenge_submission_submitted` | challenge | student |
| 4 | `challenge_completed` | challenge | student |
| 5 | `program_application_submitted` | program | anon → applicant |
| 6 | `program_assessment_submitted` | program | applicant |
| 7 | `program_project_submitted` | program | program_member |
| 8 | `program_interview_completed` | program | program_member |
| 9 | `program_certificate_issued` | program | system |
| 10 | `hackathon_registration_submitted` | hackathon | anon → student |
| 11 | `hackathon_submission_submitted` | hackathon | student |
| 12 | `workshop_registration_submitted` | workshop | anon → applicant |
| 13 | `recruiter_reg_submitted` | recruiter | anon → recruiter |
| 14 | `recruiter_intro_requested` | recruiter | recruiter |
| 15 | `recruiter_checkout_completed` | recruiter | recruiter |
| 16 | `recruiter_onboard_completed` | recruiter | recruiter |
| 17 | `recruiter_project_created` | recruiter | recruiter |
| 18 | `recruiter_contact_unlocked` | recruiter | recruiter |
| 19 | `site_job_applied` | site | student |
| 20 | `site_test_completed` | site | student |

**Recommended trim (discuss with Sohail):** demote #2–#12 to regular events.
That leaves 8 key events — all focused on the September hiring funnel plus
the universal `sign_up`. The demoted events are still recorded and
queryable; they just stop being counted as conversions.

| # | Event | Why it stays |
|---|-------|-------------|
| 1 | `sign_up` | Universal — every user |
| 13 | `recruiter_reg_submitted` | Recruiter enters the funnel |
| 16 | `recruiter_onboard_completed` | Company is set up |
| 17 | `recruiter_project_created` | Recruiter starts hiring |
| 18 | `recruiter_contact_unlocked` | Money is spent |
| 15 | `recruiter_checkout_completed` | Payment completed |
| 19 | `site_job_applied` | Candidate applies |
| 20 | `site_test_completed` | Candidate finishes assessment |

## 5. `user_properties` (GA property-level, capped at 25)

Set once per session on the client after login. All are low-cardinality.

| GA name          | Source                                              | Notes                                        |
| ---------------- | --------------------------------------------------- | -------------------------------------------- |
| `logged_in`      | `!!session.user`                                    | Also a per-event param on `page_view`.       |
| `primary_track`  | Derived from user's most-recent active track        | `challenge` / `program` / `hackathon` / `recruiter` |
| `challenge_domain` | User's chosen `ai` / `ds` / `se` / `claude`       | Only for challenge users.                    |
| `cohort_slug`    | Program membership if any                            | Null-safe.                                   |
| `signup_month`   | `YYYY-MM` of first sign-up                          | Retention cohorts. Never the day.            |

## 6. Consent gating (non-negotiable)

The GA4 loader **must not** run at all until we can read `abtalks_consent`.
`page_view` before consent is decided is fine only via GA4 **Consent Mode
v2** with all signals defaulted to `denied`, and no ID collection.

| Consent choice | `ad_storage` | `analytics_storage` | `ad_user_data` | `ad_personalization` | ABTalks behavior                                             |
| -------------- | ------------ | ------------------- | -------------- | -------------------- | ------------------------------------------------------------ |
| null (unread)  | denied       | denied              | denied         | denied               | Consent Mode default. No `client_id`. Pinged events only.    |
| `essential`    | denied       | denied              | denied         | denied               | Same as null. GA4 remains in "cookieless ping" mode.         |
| `limited`      | denied       | **granted**         | denied         | denied               | Full analytics events, no ad signals. **This is our target.** |
| `all`          | granted      | granted             | granted        | granted              | Same event set as `limited`; only Consent Mode flags differ. |

Enforcement rule for the follow-up instrumentation plan: **there is no code
path that calls `gtag('event', …)` without first checking the current
`CookieChoice` from `useCookieConsent()` (client) or `getConsentChoice()`
(server)**. The `signal` flag `analytics_storage` is not enough on its own —
we also gate at the emit site so an accidental script load can't leak
identifiers.

## 7. Never send (PII / secret exclusion list)

These strings must NEVER appear in an event name, parameter value, or user
property — reviewed at code review AND enforced by a shared `sanitizeParams`
helper in the follow-up plan:

- Email address (raw or hashed — we do not need it in GA).
- Phone number (raw, E.164, or last-N-digits).
- Full name, first name, last name.
- OTP codes, session tokens, JWTs, cookies of any kind, CSRF tokens.
- Free-text form fields: profile bio, submission notes, chat messages,
  recruiter intro notes, resume file contents.
- URLs that contain query params with the above (strip `?ref=`, `?s=`,
  `?token=`, `?email=` from `page_location` before send).
- Prisma / internal IDs of individual users, submissions, or interviews.
  Use bucketed / hashed values only where a per-event dimension is needed,
  and never the primary key.
- Raw error messages. Use `reason_bucket` enums (`invalid_credentials`,
  `network`, `rate_limited`, `server`).
- Geolocation finer than country (GA4 default IP handling is fine; no
  manual geo params).
- Referral codes as values — capture existence as `has_referral: true`, not
  the code itself.
- Assessment question text, answer options, or selected answers. Only
  `score_bucket` reaches GA — never per-question data.
- Candidate notes written by recruiters (free-text, may contain names,
  opinions, salary discussions).
- Outreach email subject lines or body content.
- Hiring pipeline stage names if they are custom free-text (the default
  enum values `screening` / `interview` / `offer` / `hired` are safe).
- Notification content or recipient details. Only the event type and
  channel reach GA, never who received it or what it said.
- Credit balances as exact numbers. Use `credits_left_bucket` only.
- Skill names entered by candidates (could contain employer names or
  other identifying context). Use `skill_count_bucket` instead.

## 8. Files this taxonomy will eventually touch (INFORMATIONAL — no edits today)

For the *next* plan (GA4 loader + first emit sites). Listed so the
executor sees the scope, but this plan writes only `docs/plans/114-…md`.

- `src/app/layout.tsx` `[edit]` — mount a `<GoogleAnalytics />` client component
  behind the consent provider.
- `src/components/analytics/ga4-loader.tsx` `[new]` — Consent-Mode-v2 loader,
  reads `useCookieConsent`, calls `gtag('consent', 'default'|'update', …)`.
- `src/lib/analytics/events.ts` `[new]` — typed `track(event, params)` wrapper
  + the enum of every name from §4 + `sanitizeParams`. The enum must include
  every name from §4.1 through §4.10. The September hiring events (§4.6 new
  table, §4.7, §4.9, §4.10) are instrumented by Shivansh (T-152, candidate
  events), shashank (T-153, recruiter events), and Manuvrtti (notification
  events) in their respective plans.
- `src/lib/analytics/consent.ts` `[new]` — maps `CookieChoice` → Consent Mode
  signal object. Imports `CookieChoice` from `src/lib/cookies.ts`.
- Emit call-sites — added in a per-track series of small plans (challenge
  → program → hackathon → workshop → recruiter → candidate hiring →
  notifications), one PR per track.
- `middleware.ts` — **must not change.** Edge-safe rule
  ([CLAUDE.md](CLAUDE.md) "Non-negotiable rules") forbids `@/lib/*` imports.
  GA is client-side or server-action-side only.
- `content/legal/privacy.md` + `content/legal/cookies.md` — remove the "we
  do not use Google Analytics" paragraphs and add GA4 + consent-mode
  disclosure. Bumps `PRIVACY_VERSION` and `COOKIE_POLICY_VERSION`, which
  correctly re-prompts every existing user for consent.

## 9. Server vs Client

- Consent Mode loader and every `gtag('event', …)` call: **Client Component**.
  Any server-only helpers (`sanitizeParams`, the event-name enum, the
  Consent Mode mapping) live in plain modules importable from both — no
  `"server-only"` marker, no `next/headers`.
- Do NOT emit from Server Actions directly. Actions return `{ ok, data }`;
  the client caller reads the envelope and emits the corresponding
  `_submitted` event. Rationale: keeps the emit site next to the user
  intent, and avoids sending events for admin-triggered or system-triggered
  writes we do not want in the funnel.
- No functions, icons, or class instances cross the Server → Client
  boundary in any of the follow-up plans — only serializable event names
  and primitive params.

## 10. DB safety

No schema change. No migration. No seed. No new Prisma model. Consent state
is a cookie, not a table (see [docs/legal/business-decisions.md](docs/legal/business-decisions.md)),
and we are keeping that decision.

## 11. Verification (of this plan)

- `docs/plans/114-ga4-event-taxonomy.md` exists.
- Every event in §4 is unique, lowercase, snake_case, ≤ 32 chars.
- Every event has an actor, a trigger, and — for every parameter — either
  a bounded value set or a bucket rule.
- Every parameter satisfies the §7 "never send" rules.
- No application code has changed. `git status` shows only this one
  untracked file.

## 12. Regression risks

**Nothing is instrumented today, so nothing can break.** The specific
risks this plan is designed to prevent in *later* plans are:

- Instrumenting `gtag` before Consent Mode defaults → identifiers leaked
  for users who eventually pick `essential`.
- Importing analytics anywhere reachable from `middleware.ts` → Edge bundle
  blows the 1 MB limit ([CLAUDE.md](CLAUDE.md)).
- Emitting from Server Actions and *also* client callers → double-count on
  every key event, invalidating conversion rates.
- Passing free-text through `params` → PII in GA, which is a policy
  violation and reportable.
- Adding events with ad-hoc names → the whole reason this taxonomy plan
  exists.

## 13. Commit message

```
docs(analytics): GA4 event taxonomy for P7 — plan 114

Codifies naming convention, per-track event catalog (including September
hiring features: recruiter onboarding, talent projects, contact unlock,
candidate jobs/assessments, company admin, and notifications), consent-mode
gating, key event summary, and PII exclusion list.

No application code touched. Follow-up plans wire the GA4 loader and
per-track emit sites against this vocabulary.

Refs: T-150
```
