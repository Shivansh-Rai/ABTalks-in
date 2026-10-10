# 186 — ABT-Mailer for every mail kind (wildcards, exceptions, codes)

**Owner:** Manuvrtti. **Review needed:** Sohail — `src/lib/email.ts` is shared infrastructure.
Follows plan 185.

## 1. Goal
Let every transactional mail move to ABT-Mailer without listing ~30 kinds in an
env var, keep a short escape hatch back to Brevo, and make one-time codes,
password mail and account notices safe to send there.

## 2. Current behavior
`EMAIL_VIA_ABT_KINDS` is an exact-match list; everything sent through ABT-Mailer
is `TRANSACTIONAL_NONESSENTIAL` and ABT-Mailer keeps every subject and body.

## 3. Files to touch
- `src/lib/abt-mailer.ts` `[edit]` — `*` / `prefix.*` matching,
  `EMAIL_KEEP_ON_BREVO_KINDS`, category and sensitive flags per kind.
- `src/lib/abt-mailer.test.ts` `[edit]` — cases for the above.
- `src/lib/email.ts` `[edit]` — pass `hasSecrets` when the caller set `redact`.
- `.env.example` `[edit]`, `docs/CHANGELOG.md` `[edit]`.

## 4. Server vs Client
Server-only; nothing in the edge path.

## 5. Steps
1. `kindMatches(patterns, kind)`: exact, `*`, or `prefix.*`.
2. `routesViaAbtMailer`: false if `EMAIL_KEEP_ON_BREVO_KINDS` matches, else
   `EMAIL_VIA_ABT_KINDS` matches.
3. Essential (only a hard bounce stops them): `recruiter.otp`,
   `auth.signin_code`, `auth.password_code`, `auth.password_reset`,
   `account.admin_update[.*]`, `account.self_deleted`, `recruiter.welcome`.
4. Sensitive (ABT-Mailer wipes subject and body once sent — needs ABT-Mailer
   with `sensitive` support): the three code kinds, `auth.password_reset`,
   `recruiter.welcome`, and any call that passes `redact`.

## 6. Guardrails (DO NOT)
No change to the Brevo path. No change when the env vars are unset.

## 7. DB safety
None.

## 8. Verification
`npm run test:abt-mailer`, typecheck, lint. Rollout and the per-kind test
matrix are in the PR description.

## 9. Commit message
`feat(email): route all kinds to ABT-Mailer with wildcards and exceptions (plan 186)`
