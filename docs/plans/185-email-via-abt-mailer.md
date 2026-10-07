# 185 — Send selected transactional mail through ABT-Mailer (SES)

**Owner:** Manuvrtti (notifications / notification delivery).
**Review needed:** Sohail — `src/lib/email.ts` is shared infrastructure.

## 1. Goal
Start moving transactional mail off Brevo onto ABT-Mailer, our own SES sender
(`github.com/manuVrtti/ABT-mailer`), one mail `kind` at a time. First kinds:
`profile.viewed` and `job.alert.match` — both opt-in notices the recipient can
turn off, so a problem costs little. Everything else, sign-in codes included,
stays on Brevo until these have run cleanly.

## 2. Current behavior
- Every outbound mail goes through `sendEmail()` in `src/lib/email.ts`, which
  sends the app-rendered subject / html / text through Brevo's
  `sendTransacEmail`. No Brevo templates or automations are used.
- `profile.viewed` and `job.alert.match` are `UserNotification`s delivered by
  `processEmailDelivery(deliveryId)` in
  `src/features/notification/email-delivery.ts`; failures are retried by
  `retryFailedDeliveries()` with backoff (max 5 attempts). The 24-hour
  per-(candidate, recruiter) window for profile views lives in
  `features/profile-view-notification/service.ts` and is unchanged.

## 3. Files to touch
- `src/lib/abt-mailer.ts` `[new]` — env-driven routing, HMAC signing, the
  POST to ABT-Mailer's raw-mode transactional endpoint, response mapping.
- `src/lib/abt-mailer.test.ts` `[new]` — routing, signature, response mapping.
- `src/lib/email.ts` `[edit]` — route listed kinds to ABT-Mailer; header
  building moved above the provider branch (unchanged); new optional
  `idempotencyKey`. Brevo path unchanged.
- `src/features/notification/email-delivery.ts` `[edit]` — pass the
  `NotificationDelivery` id as `idempotencyKey`.
- `.env.example` `[edit]` — the three new variables.
- `package.json` `[edit]` — `test:abt-mailer` script.
- `docs/CHANGELOG.md` `[edit]` — one line under Pending reconcile.

## 4. Server vs Client
All server-only. `abt-mailer.ts` is imported only by `email.ts`
(`import "server-only"`). Nothing crosses to the client; not in the
middleware / edge import path.

## 5. Steps
1. `abt-mailer.ts`: `routesViaAbtMailer(kind, hasAttachments)` is true only
   when `ABT_MAILER_URL` and `ABT_MAILER_HMAC_SECRET` are set, the mail has no
   attachments, and `kind` is in comma-separated `EMAIL_VIA_ABT_KINDS`.
   `sendViaAbtMailer` POSTs `{ eventType: kind, eventId: idempotencyKey,
   recipient, content: { subject, html, text, headers }, category:
   "TRANSACTIONAL_NONESSENTIAL", overrides: { from, replyTo } }` signed with
   `X-ABTalks-Timestamp` + `X-ABTalks-Signature: v1=<hmac>`, 10 s timeout.
   200 `enqueued` / `duplicate` → SENT; 200 `suppressed` → SKIPPED; anything
   else (incl. 503 `retry`, 401, network error) → FAILED.
2. `email.ts`: compute `viaAbt` first; the Brevo-key skip only applies when
   not `viaAbt`; the test-address skip applies to both. Build the same
   headers as before, then either call ABT-Mailer and `recordDelivery` the
   outcome, or fall through to the unchanged Brevo call.
3. `email-delivery.ts`: `idempotencyKey: deliveryId` so a retried delivery
   is deduplicated by ABT-Mailer instead of sent twice.

## 6. Guardrails (DO NOT)
- Do not route sign-in codes / password reset / account notices yet.
- Do not touch the Brevo path's behaviour, headers or tags.
- Do not log the recipient address or the HMAC secret.
- No schema change.

## 7. DB safety
None — no schema or data change.

## 8. Verification
- `npx tsx src/lib/abt-mailer.test.ts` passes; typecheck and lint pass.
- With `EMAIL_VIA_ABT_KINDS` unset, behaviour is exactly as before.
- Preview: set `ABT_MAILER_URL`, `ABT_MAILER_HMAC_SECRET` (= ABT-Mailer's
  `TRANSACTIONAL_API_HMAC_SECRET`) and `EMAIL_VIA_ABT_KINDS=profile.viewed`;
  view a test candidate's profile as a recruiter; the mail arrives, the
  `OutboundDelivery` row is SENT, and ABT-Mailer → Transactional → Logs shows
  the job delivered. Repeat for `job.alert.match`, then production.
- Rollback: remove the kind from `EMAIL_VIA_ABT_KINDS`.
- Known difference: delivered / bounced events for moved kinds arrive in
  ABT-Mailer, not at `/api/webhooks/brevo`.
- Files changed: exactly those in §3.

## 9. Commit message
`feat(email): route selected transactional kinds through ABT-Mailer (plan 185)`
