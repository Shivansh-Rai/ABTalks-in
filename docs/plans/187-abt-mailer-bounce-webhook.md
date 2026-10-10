# 187 — ABT-Mailer bounce / complaint webhook

**Owner:** Manuvrtti (notification delivery). **Review:** Sohail (`src/lib/abt-mailer.ts`,
shared), Zainab (calls the résumé-import outreach repository — read/stop only, no change to it).

## 1. Goal
Since plan 186 routes all mail through ABT-Mailer, Brevo's webhook no longer
hears about bounces and complaints on résumé-import outreach, so sequences to
dead or complaining addresses are not stopped as BOUNCED / UNSUBSCRIBED.
Restore that with ABT-Mailer's equivalent callback.

## 2. Current behavior
`/api/webhooks/brevo` stops `resume_import.outreach.*` sequences on Brevo's
`hard_bounce` / `blocked` / `invalid_email` (BOUNCED) and `spam`
(UNSUBSCRIBED). ABT-Mailer suppresses those addresses itself, so no further
mail goes out, but the outreach row is not stopped with the right reason.

## 3. Files to touch
- `src/app/api/webhooks/abt-mailer/route.ts` `[new]` — public, HMAC-verified.
- `src/lib/abt-mailer.ts` `[edit]` — `verifyAbtMailerSignature`.
- `src/lib/abt-mailer.test.ts` `[edit]` — signature cases.
- `docs/CHANGELOG.md` `[edit]`.

## 4. Server vs Client
Route handler only. Not in the middleware / edge path (`/api` is not gated).

## 5. Steps
1. ABT-Mailer (its repo): with `CALLER_WEBHOOK_URL` set, POST
   `{ type: "bounce"|"complaint", bounceType?, kind, eventId, email, occurredAt }`
   signed with `X-ABTalks-Timestamp` / `X-ABTalks-Signature` (same secret).
2. Route: verify (5-minute window, constant time) → 403 if bad. Act only when
   `kind` starts with `resume_import.outreach.`: Permanent bounce → BOUNCED,
   complaint → UNSUBSCRIBED, via `findLatestImportIdByEmail` +
   `stopOutreachForImport` (idempotent). Anything else → 200, handled 0.
   DB error → 500 so it can be retried.

## 6. Guardrails (DO NOT)
No change to the Brevo webhook (it still serves late events on Brevo-sent
mail). No change to the outreach repository.

## 7. DB safety
None.

## 8. Verification
`npm run test:abt-mailer`, typecheck, lint. Set ABT-Mailer's
`CALLER_WEBHOOK_URL=https://abtalks.in/api/webhooks/abt-mailer`; a hard
bounce on an outreach mail sets that row to STOPPED / BOUNCED.

## 9. Commit message
`feat(email): stop résumé-import outreach on ABT-Mailer bounces and complaints (plan 187)`
