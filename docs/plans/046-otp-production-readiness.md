# 046 — OTP Production Readiness (pre-push verification)

## 1. Goal
Prove, before pushing `feature/otp-restore`, that the OTP restore will **not** error
in production. Localhost passing is not sufficient: prod differs in env vars, the
build's `prisma migrate deploy` step, the real MSG91 widget, and the current
(already-broken) prod state. This is a verification + go/no-go checklist, not a code
change.

## 2. Why "works on localhost" ≠ "safe in prod" (the deltas)
- **Two independent bypass switches** decide OTP mode, and they live in different
  places. On localhost both resolve to bypass, so it works. In prod they can
  disagree and silently block all +91 signups.
- **Prod build runs `prisma migrate deploy`** ([package.json:7](../../package.json)).
  Localhost dev (`next dev`) never runs it. This is what broke prod before.
- **Real MSG91 widget + auth key** only matter in live mode; never exercised locally
  in bypass.
- **Prod DB** must physically have `phoneVerified` + `PhoneVerification`; the new
  getters/actions select them on every dashboard/profile/registration load.
- **Prod is already broken right now** (dashboard "Something went wrong"). Deploying
  on top without knowing why won't fix it and will muddy the signal.

## 3. Risk inventory + how to verify each

### R1 — OTP mode mismatch (feature-breaking, HIGHEST for correctness)
Two switches must agree:
- Client bypass = `!NEXT_PUBLIC_MSG91_WIDGET_ID || !NEXT_PUBLIC_MSG91_TOKEN_AUTH`
  ([phone-verify-field.tsx:54-57](../../src/components/shared/phone-verify-field.tsx)).
- Server bypass = `OTP_DEV_BYPASS === "true"`
  ([otp-actions.ts:46](../../src/app/actions/otp-actions.ts)).

Only two safe prod configurations:
| Mode | `NEXT_PUBLIC_MSG91_WIDGET_ID` + `NEXT_PUBLIC_MSG91_TOKEN_AUTH` | `MSG91_AUTH_KEY` | `OTP_DEV_BYPASS` |
|------|------|------|------|
| **LIVE (real SMS)** | set | set | **unset / not "true"** |
| **BYPASS (fixed 1234)** | **both unset** | n/a | **"true"** |

Dangerous combos to avoid:
- Widget vars unset **and** `OTP_DEV_BYPASS` unset → client shows fixed-code box,
  server takes live branch → "Missing verification token" → **every +91 signup fails.**
- Widget vars set **and** `OTP_DEV_BYPASS=true` → client does real SMS, server expects
  `1234` → mismatch → fails.
- BYPASS in prod is functional but **insecure**: anyone registers with `1234` and no
  real phone. Acceptable only as a short, deliberate stopgap.

**Verify:** decide the mode (see §5 decision), then in Vercel → Production env confirm
the exact row above — all three (or the absence) consistent. `NEXT_PUBLIC_*` values are
baked at **build time**, so a change requires a fresh deploy, not just a redeploy of the
same build.

### R2 — Build fails on `prisma migrate deploy` (prod-breaking, already bit us)
Migration `20260720143000_add_phone_verified` adds `phoneVerified` +
`PhoneVerification`. If the prod DB already has them (it does, per you) but the
migration is **not recorded as applied** in `_prisma_migrations`, `migrate deploy`
runs it → "column already exists" → build fails → deploy fails.

**Verify (run against PROD, read-only):**
```
# with prod DIRECT_URL in env:
npx prisma migrate status
```
- All applied / "up to date" → safe.
- `20260720143000_add_phone_verified` pending or failed while columns exist → reconcile:
  ```
  npx prisma migrate resolve --applied 20260720143000_add_phone_verified
  ```
  (marks applied; does NOT alter data). **Never** `migrate reset`.

### R3 — Prod DB missing the columns/table (runtime crash on every load)
The getters ([get-user-with-profile](../../src/features/user/get-user-with-profile.ts),
[get-profile](../../src/features/profile/get-profile.ts),
[get-dashboard-data](../../src/features/dashboard/get-dashboard-data.ts)) and
[otp-actions](../../src/app/actions/otp-actions.ts) select `phoneVerified` /
`PhoneVerification`. If absent, Prisma throws on dashboard/profile/register.

**Verify (read-only, prod DB):**
```sql
SELECT column_name FROM information_schema.columns
  WHERE table_name = 'StudentProfile' AND column_name IN ('phoneVerified','phoneVerifiedAt');
SELECT to_regclass('"PhoneVerification"');
```
Expect both columns + a non-null regclass. (Consistent with R2 being resolvable.)

### R4 — Current prod already broken (must isolate BEFORE deploying)
Prod dashboard currently errors (digest `2375783266` in the screenshot). Master's
code does **not** select `phoneVerified`, so that break is a *different* root cause
(likely the Supabase `createClient` throw at import, or a DB connection issue).

**Verify:** Vercel → Deployment → Runtime Logs, search the digest. Identify and fix
that root cause first, or knowingly accept it. Otherwise a post-deploy error can't be
attributed to OTP vs the pre-existing break. If it is the Supabase env var, set
`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in Production and redeploy.

### R5 — Full production build correctness (beyond tsc)
`tsc --noEmit` passed, but `next build` also runs lint + RSC boundary checks.

**Verify (safely — do NOT run `npm run build`, its first step is `migrate deploy`
against whatever `DATABASE_URL` is loaded):**
```
npx next build     # runs the real build WITHOUT migrate deploy
```
Must complete with no errors. (Optionally `npm run lint`.)

### R6 — MSG91 live-path specifics (only if Mode = LIVE)
- `MSG91_AUTH_KEY` required or [msg91.ts:27-29](../../src/lib/msg91.ts) warns and
  verification returns not-ok.
- Widget script loads from `https://verify.msg91.com/otp-provider.js`. No CSP exists
  in this app today, so it is not blocked — but if a CSP is ever added, allowlist that
  host + MSG91 API/XHR origins.
- Smoke-test on a Vercel **Preview** deploy (same code, live vars) with one real +91
  number end-to-end before promoting to Production.

## 4. Go / No-Go checklist (all must be ✅ before push+deploy)
1. ☐ Mode decided (LIVE or BYPASS) and Vercel Production env matches the R1 table exactly.
2. ☐ `npx prisma migrate status` against prod = clean (or `20260720143000` resolved --applied).
3. ☐ Prod DB confirmed to have `phoneVerified`, `phoneVerifiedAt`, `PhoneVerification` (R3).
4. ☐ Current prod dashboard break (R4) root-caused and fixed, or explicitly accepted.
5. ☐ `npx next build` passes locally.
6. ☐ (LIVE only) End-to-end OTP verified on a Preview deploy with a real +91 number.
7. ☐ Rollback understood (§6).

## 5. Decision needed from you
**Production OTP mode: LIVE (real MSG91 SMS) or BYPASS (fixed 1234 in prod)?**
- LIVE = secure, real verification; requires an MSG91 widget (widgetId + tokenAuth)
  and `MSG91_AUTH_KEY`. Recommended for launch.
- BYPASS = ships without MSG91, but anyone registers with `1234` (insecure); only as a
  deliberate temporary measure.
This choice drives R1/R6 and whether R6 applies.

## 6. Rollback plan
- Not pushed yet: everything is local on `feature/otp-restore`; discard anytime.
- After deploy, if prod errors: in Vercel, **Instant Rollback** to the previous
  deployment (or `git revert` the merge). No DB rollback needed — the OTP code adds no
  migration; columns already existed and are harmless when unused.
- Env-only issues (R1) are fixable by correcting Vercel vars + redeploy, no code change.

## 7. Not doing in this plan
No code changes, no migration, no `db push`, no deploy. This plan gates the push; the
actual push/merge happens only after §4 is all green.
