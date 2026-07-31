# 045 — Restore MSG91 Phone OTP (new branch, no schema change)

## 1. Goal
Bring back the phone OTP verification feature that plan 040 stripped from the app,
re-applying it onto **current master** (not the stale `feature/otp-implementation`
branch, which is 53 commits behind). The DB already has the columns/table, so this
is a **code-only restore** — no migration, no `db push`, no schema edit.

## 2. Current behavior
- OTP was built in `fcac369` (plan 039), verified working locally in dev-bypass
  mode, then fully removed from app code by plan 040 (`revert(otp)...`). The DB
  was intentionally left intact.
- Today: `prisma/schema.prisma` still has `StudentProfile.phoneVerified` /
  `phoneVerifiedAt`, `model PhoneVerification`, and `User.phoneVerification`
  (lines 183-184, 242, 261). The production/shared DB also has these columns +
  table (confirmed by user).
- Registration/profile currently capture phone as a plain optional field with no
  OTP, no dashboard nudge, no admin verified badge.
- `feature/otp-implementation` branch tip **is** `fcac369` and is 53 commits
  behind master — DO NOT merge or check it out. Use it (or `fcac369`) only as a
  read-only source to copy from.

## 3. Files to touch
All paths are on **current master**. New-file bodies are copied verbatim from
`fcac369`; edited files get the OTP hunks re-applied by hand.

**New files — restore verbatim from `fcac369`** (imports already verified to
resolve on master):
- `src/app/actions/otp-actions.ts` `[new]` (101 lines) — `sendOtpAction` / `verifyOtpAction` server actions.
- `src/lib/msg91.ts` `[new]` (61 lines) — MSG91 access-token verification helper (`server-only`).
- `src/lib/validations/otp.ts` `[new]` (48 lines) — `otpVerifySchema` (imports `INDIA_DIALING_CODE`, `indianMobileNumberSchema` from `phone.ts`).
- `src/components/shared/phone-verify-field.tsx` `[new]` (437 lines) — Client OTP widget field.
- `src/components/dashboard/phone-verify-nudge.tsx` `[new]` (102 lines) — Client dashboard nudge for unverified existing users.

**Edited files — re-apply OTP hunks onto master's current version:**
- `src/lib/validations/phone.ts` `[edit]` — **append** India OTP helpers: `INDIA_DIALING_CODE`, `indianMobileNumberSchema`, `toE164`, `isIndianPhone`, `toWidgetMobile`. Keep existing helpers.
- `src/lib/validations/register.ts` `[edit]` — replace `phone: optionalPhoneSchema` with `countryCode` (default `"+91"`) + `phoneNumber` (default `""`), and add the `.superRefine` that requires a valid 10-digit Indian mobile when `countryCode === "+91"`.
- `src/lib/feature-flags.ts` `[edit]` — add `isOtpDevBypassEnabled()` and `otpDevCode()` (append after `isProgramEntryBypassEnabled`).
- `src/app/actions/registration-actions.ts` `[edit]` — Server: read `countryCode` (default `"+91"`) + `phoneNumber` from FormData; pass both into `registerPayloadSchema` instead of `phone`.
- `src/features/registration/complete-registration.ts` `[edit]` — Server: build E.164 phone via `toE164`; for `+91`, re-check `phoneVerification` server-side and set `phoneVerified`; write `phone` + `phoneVerified` in both create/update branches.
- `src/features/user/get-user-with-profile.ts` `[edit]` — add `phone: true`, `phoneVerified: true` to the `studentProfile` select.
- `src/features/profile/get-profile.ts` `[edit]` — add `phoneVerified` to the `ProfileData` type and the select.
- `src/features/dashboard/get-dashboard-data.ts` `[edit]` — add `phone: string | null` and `phoneVerified: boolean` to `DashboardDataWithEnrollment["profile"]` and to the `profileSnapshot`.
- `src/app/profile/page.tsx` `[edit]` — Server: pass `phoneVerified={profile.phoneVerified}` into `<ProfileForm>`.
- `src/app/profile/profile-form.tsx` `[edit]` — Client: add `phoneVerified` prop; verified → read-only input + Verified badge; unverified → Verify button opening a `Dialog` with `PhoneVerifyField`.
- `src/app/register/registration-form.tsx` `[edit]` — Client: swap `phone` field for hidden `countryCode`/`phoneNumber` + `<PhoneVerifyField>`; gate submit on `phoneVerified` when `+91`; append `countryCode`/`phoneNumber` to FormData.
- `src/app/dashboard/page.tsx` `[edit]` — Server: import + render `<PhoneVerifyNudge phone={profile.phone} phoneVerified={profile.phoneVerified} />` (place it right after the `PastMissedChallengeToast` block, matching `fcac369`).
- `src/app/admin/students/[id]/page.tsx` `[edit]` — Server: import `CheckCircle2`; render Verified / Not verified badge next to phone when `data.profile.phone` exists.

**Do NOT touch:**
- `prisma/schema.prisma` — already has all OTP fields; no change.
- Any migration files / `_prisma_migrations`.
- `middleware.ts` — OTP does not touch it (the earlier 9-line diff was hackathon's). Keep edge-safe.
- `docs/plans/039-*` and `docs/plans/040-*`.

## 4. Server vs Client
- **Server:** `otp-actions.ts` (delete? no — server action file), `msg91.ts`, `registration-actions.ts`, `complete-registration.ts`, getters (`get-user-with-profile`, `get-profile`, `get-dashboard-data`), `dashboard/page.tsx`, `profile/page.tsx`, `admin/students/[id]/page.tsx`.
- **Client:** `phone-verify-field.tsx`, `phone-verify-nudge.tsx`, `registration-form.tsx`, `profile-form.tsx`.
- **Server→Client props (all primitives — safe):**
  - `dashboard/page.tsx` → `PhoneVerifyNudge`: `phone: string | null`, `phoneVerified: boolean`.
  - `profile/page.tsx` → `ProfileForm`: `phoneVerified: boolean`.
  - No functions / icons / class instances cross the boundary. `PhoneVerifyField`'s callbacks (`onChange`, `onVerified`, `onVerifiedChange`) are wired **inside** client components only.

## 5. Steps (ordered)
1. **Branch:** from up-to-date `master`, create and check out a new branch
   `feature/otp-restore`. Do all work here. Do NOT branch off
   `feature/hackathon-dashboard-popup` or `feature/otp-implementation`.
2. Restore the 5 new files verbatim from `fcac369`
   (`git show fcac369:<path> > <path>` for each of the New files above).
3. `phone.ts`: append the 5 India OTP helpers (see §3). Leave existing schemas intact.
4. `register.ts`: apply the `countryCode`/`phoneNumber` + `superRefine` change.
5. `feature-flags.ts`: add `isOtpDevBypassEnabled` + `otpDevCode`.
6. `registration-actions.ts` + `complete-registration.ts`: apply server phone/OTP logic.
7. Getters: add the `phone`/`phoneVerified` selects + types
   (`get-user-with-profile`, `get-profile`, `get-dashboard-data`).
8. `profile/page.tsx` + `profile-form.tsx`: wire `phoneVerified` and the Verify dialog.
9. `register/registration-form.tsx`: swap in `PhoneVerifyField` + submit gate.
10. `dashboard/page.tsx`: render `<PhoneVerifyNudge>`.
11. `admin/students/[id]/page.tsx`: add the verified badge.
12. Grep `src/` for the OTP symbols to confirm all wired: `PhoneVerifyField`,
    `PhoneVerifyNudge`, `verifyOtpAction`, `isOtpDevBypassEnabled`, `toE164`.
13. `.env.local`: set `OTP_DEV_BYPASS="true"` (and optionally `OTP_DEV_CODE="1234"`)
    to test without SMS first. Add `DIRECT_URL` if not already present.

## 6. Guardrails for Cursor (DO NOT)
- DO NOT check out or merge `feature/otp-implementation` — it is 53 commits behind
  and would revert hackathon/program/Claude work. Copy files from `fcac369` only.
- DO NOT edit `prisma/schema.prisma` or create/run any migration or `db push`.
  The columns/table already exist.
- DO NOT run `prisma migrate reset` (WOULD WIPE DATA).
- DO NOT touch `middleware.ts` or add auth guards to public surfaces.
- DO NOT re-apply blindly by line number — master has moved since `fcac369`;
  match by surrounding code and re-apply each hunk in context.
- DO NOT add new abstraction files beyond the 5 listed New files.
- Keep the Result envelope + Zod-at-boundary + `select`-only conventions already
  present in the restored code.

## 7. DB safety
No schema/data migration in this branch. **However**, the production build runs
`prisma migrate deploy` ([package.json:7](../../package.json)). If the DB already
has `phoneVerified` but the migration `20260720143000_add_phone_verified` is NOT
marked applied in that DB's `_prisma_migrations`, `migrate deploy` will fail the
build with "column already exists". Before deploying this branch, run against the
**production** DB (using `DIRECT_URL`):
- `npx prisma migrate status` — inspect state of `20260720143000_add_phone_verified`.
- If it shows pending/failed while the columns physically exist:
  `npx prisma migrate resolve --applied 20260720143000_add_phone_verified`
  (mark applied — do NOT reset). This is a manual pre-deploy step for the user, not
  part of the code change.

## 8. Verification
- Manual (dev-bypass on): `/register` with a `+91` number → Verify → enter `1234`
  → verified → submit succeeds; submitting unverified `+91` is blocked. Non-`+91`
  number registers with no OTP. `/profile` shows Verify dialog for unverified and
  a Verified badge once done. `/dashboard` shows the nudge only for unverified
  users with a phone. Admin student page shows Verified / Not verified badge.
- `npx tsc --noEmit` passes; `next build` (or `npm run build` locally with a dev DB)
  passes.
- `git diff prisma/` is empty.
- Changed files exactly match §3 (5 new + 13 edited + this plan).

## 9. Going live (later, separate step — not required for this branch)
Keep dev-bypass for verification. To enable real SMS: user creates an MSG91 OTP
widget, then sets in Vercel **Production** env: `NEXT_PUBLIC_MSG91_WIDGET_ID`,
`NEXT_PUBLIC_MSG91_TOKEN_AUTH`, `MSG91_AUTH_KEY`, and **unset** `OTP_DEV_BYPASS`.
The client auto-selects live vs bypass by whether the widget env vars are present.
Redeploy after changing env (Vercel does not hot-reload env vars).

## 10. Commit message
```
feat(otp): restore MSG91 phone OTP verification (code-only)

Re-apply the OTP feature removed in plan 040 onto current master: OTP
server actions, MSG91 helper, phone-verify field/nudge, +91 registration
gate, profile verify dialog, dashboard nudge, admin verified badge.
No schema change — DB already has phoneVerified / PhoneVerification.
Runs in dev-bypass until MSG91 widget env vars are set.
```
