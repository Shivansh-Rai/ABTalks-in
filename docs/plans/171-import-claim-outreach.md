# Plan 171 — Claim-and-complete emails for imported résumés

> **Owners.** Résumé import (`features/resume`, `/admin/resume-imports`,
> `repositories/resume-import.ts`, the résumé-import cron, the `ResumeImport`
> model) belongs to **@zainabshujat**. The claim fix in `lib/email-auth.ts` and
> `repositories/visibility.ts`, the public `/claim` pages, the Brevo webhook,
> the signing secret and the schema change are auth / security / database
> work and need **Sohail**'s review. The locked notification module is not
> touched: this plan only calls `sendEmail` in `src/lib/email.ts`, the shared
> sender.
>
> The non-technical version of this plan, shared with management, is the doc
> "Imported Profiles: Email Follow-up Plan". This file is the build spec for
> the same flow.

## 0. Decisions (settled)

| # | Decision | Outcome |
|---|---|---|
| D1 | Should an imported profile be visible to recruiters before it is claimed? | **Yes, always.** Profiles are never hidden by this flow. The only way a profile is withdrawn is the person clicking "Remove my data" |
| D2 | What does the claim link do? | It opens a preview page and **signs nobody in**. The person then continues with Google or an emailed code. There is no magic-link sign-in: a forwarded email must not hand over the account |
| D3 | How many emails at most? | **4 per person**: 2 before claiming and 2 after |
| D4 | How many sends per day? | Up to `IMPORT_OUTREACH_DAILY_CAP`, starting at 50 and raised step by step (for example to 200) as the sending domain's reputation grows |
| D5 | What does "Remove my data" do? | Withdraws recruiter visibility straight away, soft-deletes the unclaimed user, stops every email, and raises the existing data-request notice so an admin finishes the erasure |

Still open, and needed before launch (it does not block the build): the exact
line in the invite about where the résumé came from (`IMPORT_SOURCE_LABEL`).

## 1. Goal

When an admin registers a student from an imported résumé, email the student
automatically. The emails get them to **claim** the profile (their first
sign-in with the résumé's email) and then to **complete** it. Keep the
follow-up light: at most 4 emails. Give admins a per-person status, so a small
team can follow up by hand, even after a 500+ import.

## 2. Current behavior

- `registerImportedStudent` ([register.ts](../../src/features/resume/import/register.ts))
  creates a `User` with **no `Account` and no password**, a `CandidateProfile`
  with `reviewPendingSince = now` and `phone = null`, a READY
  `CandidateResume`, and visibility `admin_import` (searchable straight away).
  It then merges the parsed education, experience, projects, skills and links,
  and sets the import status to `REGISTERED`.
- **No email is sent.**
- **Claiming** happens only through Google: `evaluateGoogleLink` →
  `events.linkAccount` → `onGoogleAccountLinked` sets the import to
  `CLAIMED`, stamps `emailVerified`, and changes the consent source to
  `oauth_claim` ([claim.ts](../../src/features/resume/import/claim.ts),
  [auth.ts:245](../../src/auth.ts#L245)).
- **Bug fixed here.** With `ENABLE_EMAIL_LOGIN=true`, an imported student can
  sign in on `/login` with an emailed code (`authorizeEmailCode`,
  [email-auth.ts:228](../../src/lib/email-auth.ts#L228)). But that path never
  claims: the import stays `REGISTERED`, recruiters keep seeing the
  "unclaimed" badge, and consent stays marked as coming from the admin.
  Students whose résumé email isn't a Google account depend on this path.
- `sendEmail` ([lib/email.ts](../../src/lib/email.ts)) sends through Brevo,
  writes an `OutboundDelivery` row, and returns failure **only when the Brevo
  API call itself fails**. Bounces that happen later are not seen today.
- The daily cron `/api/cron/resume-imports` runs at 03:30 UTC (09:00 IST) and
  calls `drainAndContinue()`.
- `/admin/resume-imports` shows stat tiles and a paged table
  (`loadImportStatus`, `import-table.tsx`). It has no per-person outreach
  status, no filters beyond import status, and no CSV export. `src/lib/csv.ts`
  (`toCSV`, `downloadCSV`) already exists.

## 3. The flow

```
Import registered ──► INVITE 1 (day 0) ──► INVITE 2 (day 7) ──► stop: NO_RESPONSE
        │                    │                    │                (profile stays visible)
        │                    └──── claimed (Google or emailed code) at any point ───┐
        │                                                                           ▼
        │                                     ONBOARD 1 (right away: welcome + what's left)
        │                                                   │
        │                                     ONBOARD 2 (claim + 5 days, only if incomplete)
        │                                                   │
        │                                     stop: COMPLETE or FINISHED_SEQUENCE
        │
        └──► at any point: Remove my data → REMOVED · Unsubscribe → UNSUBSCRIBED · bounce → BOUNCED
```

| Stage | Step | Due | Sent only if | Template |
|---|---|---|---|---|
| INVITE | 1 | `registeredAt` (next 09:00 IST run) | always | `invite`: where the résumé came from; a preview (name, headline, top 5 skills); **completeness %** and the missing items; **Claim my profile**; **Remove my data** |
| INVITE | 2 | `registeredAt + 7d` | import still `REGISTERED` | `invite_reminder`: "Your profile is waiting", with the same buttons |
| INVITE | — | after step 2 | — | stop, `NO_RESPONSE`. **Visibility unchanged** |
| ONBOARD | 1 | `claimedAt` (next run) | completeness < 100 | `onboard_welcome`: "Here's what's left", listing the missing items |
| ONBOARD | 2 | `claimedAt + 5d` | completeness < 100 | `onboard_reminder`: the single highest-priority missing item |
| ONBOARD | — | after step 2, or as soon as completeness = 100 | — | stop, `COMPLETE` or `FINISHED_SEQUENCE` |

Emails per person: minimum 0 (bounced), maximum 4.

**Completeness** (`profileCompleteness(p)`, pure) has 5 equally weighted
checks, 20% each, listed in priority order:
1. `phoneVerified`
2. `education.length ≥ 1`
3. `experience.length ≥ 1 || hasNoWorkExperience`
4. `skills.length ≥ 5`
5. `githubUsername || linkedinUrl`

It returns `{ percent, missing: string[] }`. Imported profiles never have a
verified phone, so they start at 80% at most.

The "you're live" message on the dashboard is **not** in this plan. The
dashboard belongs to another owner, so it will be a separate follow-up plan
with that owner's approval. No email is sent for it.

## 4. Files to touch

| File | | Note |
|---|---|---|
| `prisma/schema.prisma` | [edit] | New model `ResumeImportOutreach` and enums `ImportOutreachStage` / `ImportOutreachStop`; `ResumeImport.batchLabel String?` |
| `prisma/migrations/<ts>_resume_import_outreach/migration.sql` | [new] | Generated with `--create-only` |
| `src/features/resume/import/outreach-token.ts` | [new] | HMAC sign/verify for claim-link tokens. Pure |
| `src/features/resume/import/outreach-steps.ts` | [new] | `profileCompleteness()` and `nextOutreachAction()`, the step picker. Pure |
| `src/features/resume/import/outreach-templates.ts` | [new] | 4 templates (HTML + text). Pure |
| `src/features/resume/import/outreach.ts` | [new] | `server-only`: `enrollOutreach`, `runImportOutreach`, `stopOutreach`, `moveOutreachToOnboard`, `removeImportedProfile` |
| `src/features/resume/import/outreach.test.ts` | [new] | Tests for the token, step picker and completeness |
| `src/features/resume/import/register.ts` | [edit] | After a `REGISTERED` outcome, call `enrollOutreach` (never throws) |
| `src/features/resume/import/claim.ts` | [edit] | Pull out `claimImportOnSignIn(userId, source)`; on claim, call `moveOutreachToOnboard` |
| `src/features/resume/import/status.ts` | [edit] | Outreach funnel counts; per-row outreach status; new filters |
| `src/repositories/resume-import.ts` | [edit] | Outreach reads/writes; `batchLabel` on create and list; the list sorted by `overallScore` for the "clicked, not claimed" filter |
| `src/repositories/visibility.ts` | [edit] | Add `EMAIL_CODE_CLAIM_CONSENT_SOURCE`; `claim_consent` takes an optional `consentSource` |
| `src/lib/email-auth.ts` | [edit] | `authorizeEmailCode`: claim the import for an existing user (never throws) |
| `src/app/api/cron/resume-imports/route.ts` | [edit] | Run `runImportOutreach()` after the drain, in its own try/catch |
| `src/app/api/webhooks/brevo/route.ts` | [new] | `POST` from Brevo: `hard_bounce` / `blocked` / `invalid_email` / `spam` → stop with `BOUNCED` (or `UNSUBSCRIBED` for spam) |
| `src/app/claim/[token]/page.tsx` | [new] | Public Server Component: the claim preview |
| `src/app/claim/[token]/claim-actions.tsx` | [new] | Client: the Google and emailed-code buttons |
| `src/app/claim/[token]/remove/page.tsx` | [new] | Public Server Component: confirm "Remove my data" |
| `src/app/actions/import-claim-actions.ts` | [new] | `removeImportedProfileAction(token)` |
| `src/app/api/import-outreach/unsubscribe/route.ts` | [new] | RFC 8058 one-click `POST` plus a `GET` confirmation page |
| `src/app/actions/admin-resume-import-actions.ts` | [edit] | `registerUploadsAction` accepts `batchLabel`; new `enrollUnclaimedAction`; new `exportOutreachCsvAction` |
| `src/app/admin/resume-imports/import-table.tsx` | [edit] | Batch-label input on upload; funnel tiles; Outreach column; filters; "Send invites to unclaimed"; CSV download |
| `.env.example` | [edit] | `IMPORT_CLAIM_SECRET`, `IMPORT_OUTREACH_ENABLED`, `IMPORT_OUTREACH_DAILY_CAP`, `IMPORT_SOURCE_LABEL`, `BREVO_WEBHOOK_SECRET` |
| `.github/CODEOWNERS` | [edit] | Add `/src/app/claim/`, `/src/app/api/import-outreach/`, `/src/app/api/webhooks/brevo/` and `/src/app/actions/import-claim-actions.ts` under @zainabshujat |

**No edits to** `middleware.ts` (`/claim`, `/api/import-outreach` and
`/api/webhooks` aren't in `protectedPaths`, so they are already public),
`auth.ts`, `auth.config.ts`, any dashboard file, or any locked notification
path.

## 5. Server vs Client

| Component | Kind | Notes |
|---|---|---|
| `app/claim/[token]/page.tsx` | Server | Passes only plain values to the client: `email: string`, `googleEnabled: boolean`, `emailCodeEnabled: boolean` |
| `app/claim/[token]/claim-actions.tsx` | Client | `signIn("google", { callbackUrl: "/dashboard" })`; the code option is a `<Link className={buttonVariants(...)}>` to `/login?email=…&from=/dashboard`. No functions or icons cross the boundary |
| `app/claim/[token]/remove/page.tsx` | Server | `<form action={removeImportedProfileAction}>` with a hidden token |
| `app/admin/resume-imports/page.tsx` | Server (existing) | Unchanged; still passes plain JSON `initial` |
| `app/admin/resume-imports/import-table.tsx` | Client (existing) | Gets the new counts and row fields as plain JSON; calls the new actions |

## 6. Steps

### 6.1 Schema

```prisma
enum ImportOutreachStage { INVITE ONBOARD STOPPED }
enum ImportOutreachStop  { COMPLETE FINISHED_SEQUENCE NO_RESPONSE UNSUBSCRIBED REMOVED BOUNCED ADMIN }

model ResumeImportOutreach {
  id             String              @id @default(cuid())
  importId       String              @unique
  userId         String
  stage          ImportOutreachStage @default(INVITE)
  /// Last step sent in the current stage; 0 = none yet.
  step           Int                 @default(0)
  /// How many emails this person has received in total (≤ 4).
  sentCount      Int                 @default(0)
  nextSendAt     DateTime?
  lastSentAt     DateTime?
  lastDeliveryId String?
  /// Consecutive API send failures; 3 → STOPPED/BOUNCED.
  failCount      Int                 @default(0)
  firstClickAt   DateTime?
  stoppedAt      DateTime?
  stopReason     ImportOutreachStop?
  createdAt      DateTime            @default(now())
  updatedAt      DateTime            @updatedAt

  @@index([stage, nextSendAt])
  @@index([userId])
}
```

Also add to `ResumeImport`: `batchLabel String?` (max 80 characters,
enforced in Zod) and `@@index([batchLabel])`.

There are no foreign keys, so deleting a user never erases the outreach
history.

### 6.2 `outreach-token.ts`

- Token = `base64url(JSON{ i: importId, u: userId, e: expiryEpochSec, v: 1 })`
  + `.` + `base64url(HMAC-SHA256(payload, IMPORT_CLAIM_SECRET))`.
- `signClaimToken(importId, userId, now)` sets the expiry to 45 days.
  `verifyClaimToken(token, now)` compares with `timingSafeEqual` and returns
  `{ ok: true, importId, userId } | { ok: false }`. It throws if the secret is
  missing or shorter than 32 bytes.
- A token only allows three things: viewing the preview, unsubscribing, and
  "Remove my data" **while the import is `REGISTERED`**. It never signs
  anyone in.

### 6.3 `outreach-steps.ts`

- `profileCompleteness(p)` as described in §3.
- `nextOutreachAction(row, facts, now)` returns
  `{ kind: "send", template, step } | { kind: "skip", step } | { kind: "stop", reason } | { kind: "move_to_onboard" } | { kind: "wait" }`,
  following the table in §3. `facts` = `{ importStatus, registeredAt, claimedAt, completeness }`.
  It is pure, so all the timing logic can be unit-tested.

### 6.4 `outreach-templates.ts`

- `invite`, `invite_reminder`, `onboard_welcome`, `onboard_reminder`. Each is
  `(data) => { subject, html, text }`.
- Plain single-column HTML with inline styles, in the same style as
  `renderCodeHtml` in `email-code.ts`. No images. The footer of every email
  carries the unsubscribe and remove links.
- The invite text says plainly: "{IMPORT_SOURCE_LABEL} shared your résumé with
  ABTalks. We built a profile from it, and recruiters can see it. Claim it to
  edit it, or remove it."
- Escape every value that came from the résumé with a local `escapeHtml`.
- Never invent numbers. The only figure used is the completeness %.

### 6.5 `outreach.ts` (`server-only`)

- `enrollOutreach(importId, userId)`: an upsert on `importId` with
  `stage=INVITE`, `step=0`, `nextSendAt=now`. It does nothing if
  `IMPORT_OUTREACH_ENABLED !== "true"`, and it logs errors instead of throwing.
- `moveOutreachToOnboard(importId)`: sets `stage=ONBOARD`, `step=0`,
  `nextSendAt=now`. It does nothing if the row is `STOPPED` for `REMOVED`,
  `UNSUBSCRIBED` or `BOUNCED`.
- `runImportOutreach(now)`:
  1. If disabled, return `{ sent: 0 }`.
  2. Load up to `IMPORT_OUTREACH_DAILY_CAP` due rows (stage `INVITE`/`ONBOARD`,
     `nextSendAt <= now`) ordered by `nextSendAt`. `select` only the user's
     email, name, `deletedAt`/`disabledAt`, the import status and timestamps,
     and the completeness inputs.
  3. If the user is deleted or disabled, stop with `ADMIN`. Otherwise apply
     `nextOutreachAction`. This also catches claims made by any route (an
     INVITE row whose import is `CLAIMED` → `move_to_onboard`).
  4. For each send, call `sendEmail({ kind: "resume_import.outreach.<template>", subjectType: "ResumeImport", subjectId: importId, bulk: false, headers: { "List-Unsubscribe": "<https://…/api/import-outreach/unsubscribe?t=…>, <mailto:…>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } })`.
     - `ok`: advance the step, `sentCount++`, reset `failCount`, set the next
       `nextSendAt`.
     - `skipped` (key missing or test address): leave the row due.
     - `failed`: `failCount++`, retry on the next run; at 3 failures stop with
       `BOUNCED`.
  5. Send one email at a time, never in parallel. Return `{ sent, skipped, failed, stopped }`.
- `stopOutreach(importId, reason)`.
- `removeImportedProfile(token)`: the import must be `REGISTERED` and its
  `registeredUserId` must equal the token's `u`; otherwise return
  `{ ok: false }`. In one transaction: `applyVisibilityChange(tx, { userId, kind: "admin_withdraw" })`,
  set `user.deletedAt = now`, stop with `REMOVED`. After the transaction:
  `notifyDataRightsRequest(...)` and `writeAudit` with
  `RESUME_IMPORT_SUBJECT_REMOVED`.

### 6.6 Claim fix (Sohail review)

- `visibility.ts`: add `EMAIL_CODE_CLAIM_CONSENT_SOURCE = "email_code_claim"`.
  `claim_consent` takes an optional `consentSource`, defaulting to
  `OAUTH_CLAIM_CONSENT_SOURCE`, so Google's behaviour is unchanged.
- `claim.ts`: pull the body of `onGoogleAccountLinked` out into
  `claimImportOnSignIn(userId, source)`. `onGoogleAccountLinked(userId)` keeps
  its signature and calls it with `"oauth_claim"`. After a successful claim,
  call `moveOutreachToOnboard` for that import, inside a try/catch.
- `email-auth.ts` `authorizeEmailCode`, existing-user branch, just before
  `return toSessionUser(user)`:
  `try { if (await claimImportOnSignIn(user.id, "email_code_claim")) await recordLegalConsents({ userId: user.id, email: user.email, source: "email_code_claim" }); } catch (error) { logger.error(...) }`.
  If `recordLegalConsents`'s `source` is a union type, add
  `"email_code_claim"` to it.

### 6.7 Public pages and routes

- `/claim/[token]`: invalid or expired → "This link has expired. Sign in with
  the email on your résumé" plus a link to `/login`. Import `CLAIMED` →
  redirect to `/login?from=/dashboard`. Import `REGISTERED` → set
  `firstClickAt` if it's empty, then show: a masked email (`a***@gmail.com`),
  the name, headline, top skills and completeness %. **No phone number, full
  email or education details.** Render `<ClaimActions>` and a "Not you? Remove
  my data" link. Use `dynamic = "force-dynamic"` and `robots: { index: false }`.
- `/claim/[token]/remove` → `removeImportedProfileAction`: Zod
  `{ token: z.string().max(1024) }`, `assertRateLimit` using an existing public
  bucket, and the result envelope.
- `/api/import-outreach/unsubscribe`: `POST` verifies the token, stops with
  `UNSUBSCRIBED`, and always returns 200. `GET` renders a one-line page with a
  POST button.
- `/api/webhooks/brevo`: requires `?secret=` to equal `BREVO_WEBHOOK_SECRET`
  (compared with `timingSafeEqual`, otherwise 403). Zod-parse
  `{ event, "X-Mailin-custom"?, email, tags? }`. Act only on
  `tags` containing a `resume_import.outreach.*` tag: map the recipient to its
  latest outreach row (via `normalizedEmail`) and stop it. Always return 200
  to Brevo after a valid secret.
- All four are **public**: no `requireAdmin` / `requireRole` / `auth()`
  guard. The token or the webhook secret is the only authorisation.

### 6.8 Admin page (`/admin/resume-imports`)

- **Upload**: an optional "Batch / college name" text input, sent as
  `batchLabel` with every file in that upload.
- **Funnel tiles**: Invited · Clicked · Claimed · Completed · Removed ·
  Bounced. Counts come from one `groupBy` on `ResumeImportOutreach`, plus a
  `firstClickAt` count and a completed count (stop reason `COMPLETE`).
- **Outreach column** on each row, e.g. "Invited · 1 of 2 sent · not
  clicked", "Clicked · not claimed", "Claimed · 60% · missing: phone,
  GitHub", "Completed", "Removed", "Bounced", "No response".
- **Filters**: Clicked but not claimed (sorted by `overallScore`, highest
  first), Claimed but incomplete, Completed, Bounced, No response, and by
  `batchLabel`. Show the claim rate per batch when a batch filter is active.
- **"Send invites to unclaimed (N)"** → `enrollUnclaimedAction`
  (`requireAdmin`, audit): enrolls every `REGISTERED` import with no outreach
  row. The daily cap spreads the sends out.
- **"Download CSV"** of the current filter → `exportOutreachCsvAction`
  (`requireAdmin`, audit, max 5,000 rows) returns rows. The client calls
  `toCSV` / `downloadCSV`. Columns: name, email, phone from the résumé if
  parsed, batch, outreach status, completeness %, missing items, last email
  sent, clicked at.

### 6.9 Wiring

- `register.ts`: add `await enrollOutreach(imp.id, userId)` just before
  `return "REGISTERED"`. Do not enroll `attachToExisting` outcomes.
- Cron route: after `drainAndContinue()`, run
  `runImportOutreach().catch(...)` and add its result to `data`. The drain's
  result and status code are unchanged.
- Brevo dashboard (a manual step after deploy): add a transactional webhook
  pointing to `/api/webhooks/brevo?secret=…` for the events `hard_bounce`,
  `blocked`, `invalid_email` and `spam`.

## 7. Guardrails for Cursor (DO NOT)

- DO NOT hide or withdraw a profile anywhere except `removeImportedProfile`.
  `NO_RESPONSE` leaves visibility unchanged.
- DO NOT send more than 4 outreach emails per person (check `sentCount`
  before every send), exceed the daily cap, or send in parallel.
- DO NOT edit locked notification paths (`src/features/notification/**`,
  `src/lib/observability/notification-*.ts`, …). Only call `sendEmail`.
- DO NOT touch any dashboard file. The "you're live" message is a separate
  plan.
- DO NOT let a claim token create a session, set `emailVerified`, or act on an
  import that isn't `REGISTERED` or whose `registeredUserId` doesn't match.
- DO NOT add `requireAdmin` / `requireRole` / `auth()` to `/claim/**`,
  `/api/import-outreach/**` or `/api/webhooks/brevo`.
- DO NOT touch `middleware.ts`, `auth.ts` or `auth.config.ts`, and DO NOT
  change `onGoogleAccountLinked`'s signature or its consent source.
- DO NOT show a phone number, full email or education on `/claim/[token]`.
- DO NOT put invented figures in emails. Completeness % is the only number.
- DO NOT let outreach errors break the drain, registration or sign-in: every
  new call site gets a try/catch plus `logger.error`.
- No `console.*`, no `any`, no Prisma calls without `select`, no files beyond
  §4.
- DO NOT use `migrate reset` on Neon (see §8).

## 8. DB safety

1. Commit everything else and note the hash.
2. Neon console → branch `pre-171-<hash>` from production.
3. `npx prisma migrate dev --create-only --name resume_import_outreach` on a
   Neon **dev branch**. The SQL should be: 2 enums, 1 table and its indexes,
   one nullable column on `ResumeImport`, one index. Nothing else.
4. If drift is reported, do not reset. Stop and ask; `db push` is for the dev
   branch only.
5. Production: `npx prisma migrate deploy`, then `npx prisma generate`.
6. Set the Vercel env vars before deploying: `IMPORT_CLAIM_SECRET`
   (`openssl rand -base64 48`), `BREVO_WEBHOOK_SECRET`,
   `IMPORT_OUTREACH_ENABLED=false`, `IMPORT_OUTREACH_DAILY_CAP=50`,
   `IMPORT_SOURCE_LABEL`. Turn outreach on only after §9 passes.

## 9. Verification

**Automated**
- `npx tsc --noEmit`, `npm run lint` and `npm run build` pass.
- `outreach.test.ts` covers:
  - the token round-trips; tampered, expired and wrong-version tokens are
    rejected;
  - `nextOutreachAction` at day 0, 6, 7 and 8 (INVITE) and at claim +0, +4,
    +5 and +6 (ONBOARD);
  - claimed during INVITE → onboard; complete → stop `COMPLETE`;
  - `sentCount` never exceeds 4;
  - completeness percentages and the order of missing items.
- The existing `src/features/resume/**/*.test.ts` and email-auth tests still
  pass.

**Manual** (preview, outreach enabled, cap 5)
1. Upload a PDF whose email is a **non-Gmail** inbox you control, with batch
   label "Test batch". Parse and register it, then run
   `curl -H "Authorization: Bearer $CRON_SECRET" …/api/cron/resume-imports`.
   The invite arrives showing the completeness % and missing items, and the
   Brevo tag is `resume_import.outreach.invite`.
2. Open the link. The masked preview shows, and the row changes to "Clicked ·
   not claimed" under the "Test batch" filter.
3. Use "Email me a code" to sign in. The import is `CLAIMED`, the
   "unclaimed" badge is gone, and `consentSource = email_code_claim`. The next
   run sends `onboard_welcome`.
4. Repeat with a Gmail résumé using Google. The consent source is
   `oauth_claim`, as before.
5. Move a third import's `registeredAt` back 7 days and run the cron. The
   reminder is sent; run again with no action and the row is `NO_RESPONSE`,
   and **the profile is still in `/hire` search**.
6. "Remove my data" on a fourth import: the user is soft-deleted, the profile
   is gone from search, and the admin notice arrives. The same link a second
   time → "no longer valid".
7. One-click unsubscribe (`curl -X POST …`) stops the row.
8. `POST` a fake `hard_bounce` to the webhook with the right secret and a
   `resume_import.outreach.invite` tag → `BOUNCED`. With a wrong secret →
   403.
9. "Download CSV" on the "Clicked but not claimed" filter gives the expected
   rows, strongest first.
10. A normal Google signup and a recruiter code sign-in behave exactly as
    before.

**Files expected to change:** exactly §4, plus the migration folder.

## 10. Commit message

```
feat(resume-import): claim-and-complete emails for imported students

- ResumeImportOutreach: invite (day 0, day 7) and onboarding (claim +0,
  +5 if incomplete); max 4 emails; profiles are never hidden
- signed /claim/[token] preview, remove-my-data, one-click unsubscribe
  (public, token-scoped, never signs in); Brevo bounce webhook
- emailed-code sign-in now claims an imported profile, same as Google
- admin: batch label on upload, funnel tiles, per-row outreach status,
  filters, CSV export, "send invites to unclaimed"
- runs from the existing résumé-import cron; off behind IMPORT_OUTREACH_ENABLED
```
