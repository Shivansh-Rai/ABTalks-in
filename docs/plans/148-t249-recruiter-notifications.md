# Plan 148 — T-249 Recruiter Notifications

**Owner:** Manuvrtti
**Ticket:** T-249 — "Told when something needs you"
**Demo:** Demo 2 (implementation ≤ 2026-09-11, internal test ≤ 2026-09-14, demo ≤ 2026-09-15)
**Depends on:** T-248 ✅ notification service on master · T-247 ✅ merged (PR #405) · T-205 (infra, in place)

## 1. Goal

The recruiter gets a real, delivered notification (in-app always, email
optionally per their preferences) whenever any of the five events on the
sheet happens to them:

- a **new application** arrives on a job they posted
- a **candidate replies** to their outreach
- an **assigned assessment** is completed by a candidate
- a **pipeline action** is required — a `JobApplication.status` transitions
  in a way that lands work back on the recruiter
- a **system issue** affects their workspace — an admin-initiated broadcast
  they specifically need to see

One of the five (`outreach.reply_received`) already fires end-to-end today
at [src/features/hire/outreach.ts:509](../../src/features/hire/outreach.ts#L509).
This plan covers the remaining four.

## 2. Current behavior

- The T-248 notification service (`dispatch()`) is live and used by 7+ call
  sites — recruiter jobs, admin jobs, assessments, outreach, profile views,
  T-250 job alerts, T-251 profile-view rolling notification.
- The event-type registry
  ([src/features/notification/event-types.ts](../../src/features/notification/event-types.ts))
  already contains `application.received`, `application.status_changed`,
  `outreach.reply_received`, `outreach.message_received` and others.
- **Nothing fires `application.received` today.** Grep confirms the only
  matches are the type registry, the acceptance tests, and email delivery
  tests — no production call site.
- **`assessment.completed` is not registered.** The registry has
  `assessment.assigned` (recruiter → candidate) only.
- The T-247 hook site (`convergeApplicantToPipeline`) is the natural place
  to fire `application.received` — the recruiter workspace is already
  resolved there.
- The assessment submit path exits at
  [src/features/assessment-attempts/service.ts:566](../../src/features/assessment-attempts/service.ts#L566)
  via `store.submit()` — the completion signal every downstream consumer
  reads from.

## 3. Files to touch

- [edit] `src/features/notification/event-types.ts` — register **three** new
  event types: `assessment.completed`, `application.status_changed`
  (already registered — just verify), and `system.notice`. Reuse
  `application.status_changed` for the pipeline-action event; add
  `system.notice` for the admin broadcast.
- [edit] `src/features/pipeline-convergence/converge-applicant.ts` — after
  the successful `addToPipeline` call, dispatch `application.received` to
  the recruiter's userId. Same fail-open pattern as the pipeline write:
  log-and-swallow on error. **Never blocks the applicant.**
- [edit] `src/features/assessment-attempts/service.ts` — after a
  successful `store.submit` result, resolve the assessment's owning
  recruiter and dispatch `assessment.completed`. Fail-open.
- [new] `src/features/recruiter-notifications/notify-recruiter.ts` —
  server-only aggregator that centralises the four recruiter-facing
  events. One function per event
  (`notifyApplicationReceived`, `notifyAssessmentCompleted`,
  `notifyApplicationStatusChanged`, `notifySystemNotice`) each doing:
  resolve recipient userId → build DispatchEvent → call `dispatch()` →
  log-and-swallow.
- [new] `src/app/actions/admin-notify-actions.ts` — a single admin action
  `broadcastRecruiterSystemNoticeAction({recruiterUserId, title, body,
  href?})` that fires `system.notice`. Guarded by `requireAdmin()`.
- [edit] `src/app/actions/recruiter-review-actions.ts` OR the closest
  existing recruiter-side status change action — after a
  `JobApplication.status` transition initiated by the recruiter that
  needs their own attention downstream (ACCEPTED, REJECTED), dispatch
  `application.status_changed` back to the recruiter as a confirmation
  handle. **This is the "pipeline action" event.** *(If no such action
  exists yet, the pipeline-action event ships behind a small admin-only
  status transition on the applicant row — see step 5.4.)*
- [new] `src/features/recruiter-notifications/notify-recruiter.test.ts`
  — shape guarantees, source-scan style.

## 4. Server vs Client

Entirely server-side. No new component. No client boundary crossing.

The recruiter's existing notification surface (badge count in
`hire/layout.tsx`, notification list at `/settings/notifications`, and
email delivery via the Brevo worker) already renders whatever
`UserNotification` rows the T-248 service writes. This plan only
generates the rows; the read side is done.

## 5. Steps

### 5.1 Register the missing event types

In `event-types.ts` add:

```ts
"assessment.completed": {
  key: "assessment.completed",
  label: "Assessment completed",
  priority: "important",
  suppressionExempt: true,
  emailExempt: false,
  defaultEmailEnabled: true,
},
"system.notice": {
  key: "system.notice",
  label: "System notice",
  priority: "important",
  suppressionExempt: true,
  emailExempt: false,
  defaultEmailEnabled: true,
},
```

`application.status_changed` is already there — do not duplicate it.

### 5.2 Aggregator — `src/features/recruiter-notifications/notify-recruiter.ts`

1. `import "server-only";`
2. Import `dispatch` from `@/features/notification/notification-service`,
   `logger` from `@/lib/logger`, `prisma` from `@/lib/db`.
3. Export four thin wrappers. Each:
   - Takes typed input (`{ recruiterUserId, applicationId, ... }`).
   - Builds a `DispatchEvent` with the right eventType, primaryEntityId,
     title, body, href (`/hire/pipeline` for pipeline-shaped events,
     `/hire/jobs/<id>` for job-shaped, `/hire/assessments/<id>` for
     assessment).
   - Calls `dispatch(event)` in a try/catch.
   - Logs failure via `logger.warn` — never throws.
4. Content strings live inside the aggregator so the emit sites can't
   drift on wording; a rename ripples once.

### 5.3 Fire `application.received` from the T-247 hook

At the end of `convergeApplicantToPipeline`, after `addToPipeline`
returns `ok`, call
`notifyApplicationReceived({ recruiterUserId, applicationId,
candidateLabel })`. Wrap in try/catch. Ordering: pipeline write first,
notification second — a notification without the pipeline row is worse
than the reverse (the notification href would 404 the recruiter into
an empty board).

### 5.4 Fire `assessment.completed` from `submitAttempt`

1. Extend the `AttemptStore.submit` return shape to include
   `recruiterUserId` (the assessment's owning recruiter). The store
   already reads the assessment row; adding a select field is a
   one-liner and keeps the flow synchronous.
2. In `submitAttempt`, on success, call
   `notifyAssessmentCompleted({ recruiterUserId, assignmentId,
   candidateUserId })`. Fail-open.

### 5.5 Fire `application.status_changed` (the "pipeline action" event)

`application.status_changed` is a **notification the recruiter emits to
themselves** — a written-back confirmation record that shows in their
notification list so the pipeline transition is a first-class event, not
just a state change.

1. Locate the recruiter-side `JobApplication.status` transition — if none
   exists yet (Demo 1's T-246 shipped candidate-side apply but the
   recruiter transition may not have landed), add a minimal server
   action `moveApplicationStatusAction({applicationId, next})` that
   guards by `requireRecruiterWorkspace` + verifies
   `application.job.recruiterId === workspace.userId` + updates
   `JobApplication.status` and dispatches
   `application.status_changed` to the recruiter. Whether-to-add is a
   Step-5.5 branch in execution.
2. Idempotent by design: same status two calls in a row → no-op update,
   no duplicate notification (T-248 dedupe on
   `{eventType}:{recipient}:{primaryEntity}` handles that).

### 5.6 Admin system-notice broadcast

1. `src/app/actions/admin-notify-actions.ts` exports
   `broadcastRecruiterSystemNoticeAction(input: unknown)`.
2. Guard by `requireAdmin()` from `@/lib/admin-auth`.
3. Zod-parse `{ recruiterUserId, title, body?, href? }`.
4. Resolve — verify the target is actually a recruiter (existing
   `RecruiterProfile.findUnique`).
5. Call `notifySystemNotice({ recipientUserId, title, body, href })`.
6. Log via `logger.info` with the admin id — audit trail.

### 5.7 Shape tests

Source-scan (same convention as T-240 and T-247):

- Aggregator file exists, is server-only, all four wrappers exported.
- Each wrapper wraps `dispatch()` in try/catch and has no `throw` in the
  body.
- `converge-applicant.ts` imports `notifyApplicationReceived` and calls
  it AFTER the successful `addToPipeline`.
- `submitAttempt` imports and calls `notifyAssessmentCompleted` after
  the successful `store.submit`.
- The admin action calls `requireAdmin()` and uses Zod.
- `system.notice` and `assessment.completed` both registered in
  `event-types.ts`.
- No non-aggregator file directly calls
  `dispatch({ eventType: "application.received" | "assessment.completed"
  | "application.status_changed" | "system.notice" ... })` — enforce
  that the four recruiter events go through the aggregator.
- New npm script `test:t249-recruiter-notifications`.

## 6. Guardrails for Cursor (DO NOT)

- **DO NOT** fire notifications from anywhere except through the aggregator
  functions. That is the whole point of the aggregator — content strings
  in one file, wording changes in one place.
- **DO NOT** let a notification failure fail the underlying action. Apply,
  assessment submit, and pipeline transition all succeed first;
  notifications are side effects and stay side effects.
- **DO NOT** touch `src/features/notification/notification-service.ts`
  (T-248 owner surface). New event types are metadata in
  `event-types.ts` only.
- **DO NOT** send emails outside the T-248 delivery path. The dispatcher
  already handles the Brevo call — a second email path is a design
  regression.
- **DO NOT** dispatch on the applicant side. Every event in this ticket
  is delivered to a recruiter.
- **DO NOT** create new admin surfaces beyond the one broadcast action.
  A full admin panel for system notices is a follow-up.
- **DO NOT** change the notification preference schema or introduce a new
  channel. In-app + email, T-248's contract, unchanged.

## 7. DB safety

No Prisma schema change. All four events store rows in the existing
`UserNotification` and `OutboundDelivery` tables T-248 provisioned.

Checkpoint before executing:
- `git status` clean on `feature/T-249-recruiter-notifications`.
- Local base is `upstream/master@66b8559f`.

## 8. Verification

Gates:
- `npm run test:t249-recruiter-notifications` — new suite, all green.
- `npm run test:t240-pipeline` — must stay 8/8 (no cross-touch regression).
- `npm run test:t247-convergence` — must stay 8/8.
- Existing `npm run test:demo1-security`, `test:profile`, and
  `test:observability:notification` (touched by the assessment path)
  must not regress.
- `npx tsc --noEmit` — zero errors on new files.
- `npm run build` — Next.js `Compiled successfully`.
- `npm run lint` on all edited files — zero issues.

Manual test (Chromium, recruiter + candidate + admin profiles):

1. **New application:** candidate applies to a recruiter-posted job →
   recruiter sees an in-app notification "New application: {name}" with
   a link to `/hire/pipeline`. Email delivered per preference.
2. **Candidate reply:** already works — smoke-test that this ticket
   doesn't regress it. Candidate replies through
   `outreach.reply_received`, recruiter gets both in-app + email.
3. **Assessment completed:** recruiter assigns an assessment to a
   candidate. Candidate signs in, takes it, submits. Recruiter gets
   "Assessment completed: {name}" with a link to
   `/hire/assessments/<id>`.
4. **Pipeline action:** recruiter moves an applicant from Sourced →
   Screening via `/hire/pipeline`. Recruiter sees a confirmation
   notification in their own list. Same transition again is a no-op
   (T-248 dedupe).
5. **System notice:** admin fires
   `broadcastRecruiterSystemNoticeAction` from an admin script or
   surface. Target recruiter sees the notice in-app + email.
6. **Isolation:** a second recruiter never receives any of the above
   for the first recruiter's job / candidate. Confirmed by the T-248
   `recipientUserId` scope.

Files that should have changed:

- `docs/plans/148-t249-recruiter-notifications.md` (this file)
- `src/features/notification/event-types.ts` [edit — 2 new keys]
- `src/features/recruiter-notifications/notify-recruiter.ts` [new]
- `src/features/recruiter-notifications/notify-recruiter.test.ts` [new]
- `src/features/pipeline-convergence/converge-applicant.ts` [edit]
- `src/features/assessment-attempts/service.ts` [edit]
- `src/features/assessment-attempts/prisma-store.ts` [edit — add
  recruiterUserId to submit return shape if not already there]
- `src/app/actions/admin-notify-actions.ts` [new]
- `package.json` [edit — new test script]

Evidence for the demo sheet:
- The PR link.
- `npm run test:t249-recruiter-notifications` output.
- A short screen recording running through manual test steps 1–5 above.

## 9. Commit message

```
feat(hire): T-249 recruiter notifications — 5 event sources plumbed end-to-end

The T-248 dispatcher was live but nothing fired application.received or
assessment.completed for the recruiter. This wires the four remaining
recruiter-facing events on top of the T-247 hook, the assessment submit
flow, the recruiter-side status transition and an admin broadcast.

- src/features/recruiter-notifications/notify-recruiter.ts is the
  aggregator: four thin wrappers, one per event, each wrapping dispatch
  in try/catch and returning nothing. Content strings live here so a
  wording change ripples once. Log-and-swallow on failure — no
  underlying action ever fails because a notification did.
- application.received fires at the tail of
  convergeApplicantToPipeline (T-247 hook), after the pipeline write
  succeeds. Ordering is pipeline-first, notification-second so the
  href always points at a row that exists.
- assessment.completed is a new event registered in event-types.ts and
  fired from submitAttempt after store.submit succeeds. Store return
  shape carries recruiterUserId so the aggregator has what it needs.
- application.status_changed fires from the recruiter-side
  moveApplicationStatusAction — the "pipeline action" event on the
  sheet. Dedupe on {eventType}:{recipient}:{primaryEntity} kills the
  duplicate on same-status re-submit.
- system.notice is a new event fired by
  broadcastRecruiterSystemNoticeAction — an admin action guarded by
  requireAdmin() that lets an admin deliver a workspace-specific
  notice to a recruiter, in-app and by email.

outreach.reply_received (event #2) already fires at
src/features/hire/outreach.ts:509 — untouched, still authoritative.

Plan: docs/plans/148-t249-recruiter-notifications.md.

Closes the Demo 2 recruiter notification surface. No schema change.
No new client surface.
```
