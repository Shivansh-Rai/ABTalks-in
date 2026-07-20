# 039 — Phone OTP Verification via MSG91 OTP Widget (no DLT)

## 1. Goal
Add SMS OTP verification for phone numbers using the **MSG91 OTP Widget in headless mode**
(our own UI, MSG91's default DLT-registered sender/template under the hood — **no DLT required
by us**). For **new** registrants who choose India (`+91`, the default), entering **and
verifying** a phone is **compulsory** before registration completes → `/dashboard`. Any other
country code keeps today's normal, no-OTP flow. **Existing** users are never forced to verify,
but get a dismissible dashboard nudge + a profile entry point.

## 2. Why the Widget (not the server OTP API)
MSG91's **default widget configuration sends real OTP without the customer doing DLT** — MSG91
uses their own DLT-registered sender + template; charges come from the OTP Widget subscription
plan (per MSG91 docs, "Scenario 1: Using MSG91 Default Configuration"). The raw server OTP API
(`/api/v5/otp`) instead requires *our* DLT-approved `template_id`, which we don't have yet.
Tradeoff accepted: with default config the SMS shows a **generic MSG91 sender + default template
wording** (not branded "ABTalks"); branded sender/template can be added later via our own DLT
without changing app code (just swap the widget's template/sender in MSG91).

## 3. Integration shape (headless widget + server-side trust)
- **Client** loads MSG91's widget script and calls its JS methods directly — **send** and
  **resend** happen entirely client↔MSG91 (MSG91 handles rate limiting). We keep our own
  `<PhoneVerifyField>` UI; the widget only powers the OTP mechanics (no MSG91 popup UI).
- On successful **verify**, the widget returns a JWT **access token**. The client passes that
  token to our **`verifyOtpAction`**, which verifies it **server-side** against MSG91
  (`verifyAccessToken`) using the secret `MSG91_AUTH_KEY`. Only then do we mark the phone
  verified. → the client is never trusted.

## 3b. DLT-free now + local dev bypass
- **Real OTP works immediately** via the widget default config — no DLT needed to launch.
- Add **`OTP_DEV_BYPASS`** (spirit of the existing `ENABLE_DEV_AUTH` / `BYPASS_DAY_LOCKS`
  flags) for **local dev / CI** so we don't load the widget or spend OTP credits:
  when `"true"`, the widget is skipped, no SMS is sent, and the fixed code **`1234`**
  (override via `OTP_DEV_CODE`) verifies. Wrong codes still fail. The DB-write success branch
  is identical to live mode. Bypass is for developers only — real users always run live.

## 4. Enforcement rule (make this exact in code)
- On **registration**: if `countryCode === "+91"` (the **default**), a phone number is
  **strictly required AND must be verified** — blank is rejected, and completion is blocked
  without a matching verified record. Non-`+91` → phone optional, **no OTP**, flow unchanged.
- `completeRegistration` MUST re-check verification against the DB — never trust a client flag.
- **OTP length: 4 digits** — set in the MSG91 widget config (length/expiry live in the panel,
  not the API). The dev-bypass code is also 4 digits.

## 5. Decisions locked (planning Q&A)
- **MSG91 OTP Widget, headless / custom UI** (real OTP, no DLT).
- **Country-code selector + national number** (default `+91`), combined to E.164.
- `+91` new users: **phone required + verified**. 4-digit OTP.
- Existing-user nudge targets **only `+91` (or missing-phone) users**; dismissal is
  **client-side (localStorage)** — no schema field for dismissal.

## 6. Current behavior
- Google login → `/register` (Server Component gate; profile doesn't exist yet) →
  `RegistrationForm` (client) → `completeRegistrationAction` → `completeRegistration` creates
  `StudentProfile` + `Enrollment` → `/dashboard`.
- Phone is a **single optional free-text field** (`registration-form.tsx` lines 598–614),
  validated by `optionalPhoneSchema`, stored as admin-only `StudentProfile.phone`. No country
  code capture, no verification, no `phoneVerified`.
- No MSG91 anything today. `src/components/ui/dialog.tsx` (shadcn) exists for popups.
- Service-client convention: `lib/email.ts`, `lib/anthropic.ts` are `server-only`, read env,
  log via `lib/logger.ts`, return `{ ok }` envelopes.

## 7. Files to touch
- `prisma/schema.prisma` `[edit]` — add `StudentProfile.phoneVerified Boolean @default(false)`;
  add `PhoneVerification` model; add its back-relation on `User`. **(schema change)**
- `src/lib/msg91.ts` `[new]` — `server-only`. Single function `verifyAccessToken(token)` →
  POST MSG91 `widget/verifyAccessToken` with `authkey` + `access-token`; returns
  `{ ok, mobile? }`. Reads env, logs via `logger`. Mirrors `lib/email.ts` style.
- `src/lib/feature-flags.ts` `[edit]` — add `isOtpDevBypassEnabled()` (`OTP_DEV_BYPASS`) and
  `otpDevCode()` (`OTP_DEV_CODE`, default `"1234"`).
- `src/lib/validations/phone.ts` `[edit]` — add `INDIA_DIALING_CODE`,
  `indianMobileNumberSchema` (10 digits, `/^[6-9]\d{9}$/`), `toE164(cc, national)`,
  `isIndianPhone(e164)`, `toWidgetMobile(e164)` (E.164 without `+`). Keep existing exports.
- `src/lib/validations/otp.ts` `[new]` — `otpVerifySchema` for the verify action input:
  `{ countryCode, phoneNumber, accessToken?: string, otp?: string }` with a `superRefine`
  requiring `indianMobileNumberSchema` for `+91`, and (live) `accessToken` present / (bypass)
  `otp` = 4 digits.
- `src/app/actions/otp-actions.ts` `[new]` — **only** `verifyOtpAction` (send/resend are
  client-side widget calls). Session-gated, Zod, `{ ok }` envelope.
- `src/lib/validations/register.ts` `[edit]` — replace `phone: optionalPhoneSchema` on the
  register payload with `countryCode` + `phoneNumber`; `superRefine`: `+91` ⇒ `phoneNumber`
  required + valid Indian mobile; else optional.
- `src/app/actions/registration-actions.ts` `[edit]` — read `countryCode`/`phoneNumber` from
  FormData; pass through.
- `src/features/registration/complete-registration.ts` `[edit]` — compute E.164; enforce §4
  against `PhoneVerification`; set `StudentProfile.phoneVerified`.
- `src/components/shared/phone-verify-field.tsx` `[new]` — reusable **client** component:
  country selector + national number input + Send/Verify/Resend. Loads the MSG91 widget script
  (via next/script) and drives `window.sendOtp/verifyOtp/retryOtp`; in bypass mode it skips the
  widget and uses the fixed code. Emits `onChange({countryCode, phoneNumber, e164})` and
  `onVerifiedChange(boolean)`.
- `src/app/register/registration-form.tsx` `[edit]` — replace the phone `<Input>` block
  (lines 598–614) with `<PhoneVerifyField>`; gate submit for `+91` on verified.
- `src/components/dashboard/phone-verify-nudge.tsx` `[new]` — **client** dismissible banner
  (localStorage) opening a `Dialog` wrapping `<PhoneVerifyField>`.
- `src/app/dashboard/page.tsx` `[edit]` — render `<PhoneVerifyNudge>` in the normal render path
  (near other banners ~lines 317–334) when the user qualifies (§8.H).
- `src/features/dashboard/get-dashboard-data.ts` `[edit]` — add `phone`, `phoneVerified` to the
  profile `select`.
- `src/app/profile/profile-form.tsx` `[edit]` — "Verify phone" button opening the same
  `Dialog` + `<PhoneVerifyField>`; show a "Verified" badge when `phoneVerified`.
- `.env.example` / env doc `[edit]` — document new env vars.
- `docs/project-context.md` `[edit]` — record the feature **after it ships** (per doc rules).

## 8. Server vs Client boundary
- **Server**: `otp-actions.ts` (`verifyOtpAction`), `registration-actions.ts`,
  `complete-registration.ts`, `lib/msg91.ts`, `get-dashboard-data.ts`, both pages.
  Secret `MSG91_AUTH_KEY` is used **only** server-side in `verifyAccessToken`.
- **Client**: `phone-verify-field.tsx` (loads widget JS, calls `window.sendOtp/verifyOtp/
  retryOtp`), `phone-verify-nudge.tsx`, `registration-form.tsx`, `profile-form.tsx`. Client
  reads `NEXT_PUBLIC_MSG91_WIDGET_ID` + `NEXT_PUBLIC_MSG91_TOKEN_AUTH` (public widget creds).
- **Server→Client props** (primitives only — no functions/icons/class instances across the
  boundary): dashboard passes `phone: string | null`, `phoneVerified: boolean` to the nudge.
- Nothing here is imported by `middleware.ts` / `auth.config.ts` → **edge bundle untouched**.

### Steps

#### A. Schema (`prisma/schema.prisma`)
1. `StudentProfile`: add `phoneVerified Boolean @default(false)`.
2. Add model (trust bridge for new users whose profile doesn't exist yet):
   ```prisma
   model PhoneVerification {
     id         String    @id @default(cuid())
     userId     String    @unique
     phone      String    // E.164, e.g. +919876543210
     verified   Boolean   @default(false)
     verifiedAt DateTime?
     createdAt  DateTime  @default(now())
     updatedAt  DateTime  @updatedAt
     user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
   }
   ```
3. `User`: add `phoneVerification PhoneVerification?`. Upsert on `userId`; a new number resets
   `verified=false`.

#### B. MSG91 server client (`src/lib/msg91.ts`)
4. `server-only`. `verifyAccessToken(accessToken: string)`:
   - Read `MSG91_AUTH_KEY`; if missing → `logger.warn` + `{ ok:false, message:"OTP not configured." }`.
   - POST `https://control.msg91.com/api/v5/widget/verifyAccessToken`, JSON body
     `{ authkey: <key>, "access-token": accessToken }`.
   - `type === "success"` → `{ ok:true, mobile: <verified number from response, if present> }`;
     else log + `{ ok:false, message }`. Wrap in try/catch.
   - **Executor note:** confirm the endpoint/body field names and whether the verified mobile is
     returned against current MSG91 widget docs; if the response omits the mobile, bind to the
     client-submitted phone (the token is minted only after that number's OTP verified).

#### C. Validation (`phone.ts`, `otp.ts`, `register.ts`)
5. `phone.ts`: add `INDIA_DIALING_CODE = "+91"`; `indianMobileNumberSchema` (`/^[6-9]\d{9}$/`);
   `toE164`, `isIndianPhone`, `toWidgetMobile`. Keep `phoneSchema`/`optionalPhoneSchema` intact.
6. `otp.ts`: `otpVerifySchema = z.object({ countryCode, phoneNumber, accessToken: z.string().optional(),
   otp: z.string().optional() })` + `superRefine`: `+91` requires valid Indian mobile; require
   `accessToken` in live mode OR `otp` matching `/^\d{4}$/` in bypass mode.
7. `register.ts`: in `registerPayloadBase` replace `phone` with `countryCode:
   z.string().default("+91")` + `phoneNumber: z.string().default("")`; `superRefine`: `+91` ⇒
   `phoneNumber` non-empty + `indianMobileNumberSchema`; else optional.

#### D. Verify server action (`src/app/actions/otp-actions.ts`)
8. `"use server"`. `verifyOtpAction(input)`:
   - `auth()` → require `session.user.id` (authenticated student action; not a public surface).
   - Zod `otpVerifySchema`. `+91` only (reject other codes with a clear message). Build E.164.
   - **Bypass** (`isOtpDevBypassEnabled()`): success iff `otp === otpDevCode()`, else
     `{ ok:false, message:"Invalid code." }` — no MSG91 call.
   - **Live**: `msg91.verifyAccessToken(accessToken)`; on failure return the mapped message. If a
     verified mobile is returned, ensure it matches the submitted E.164.
   - **On success (transaction, identical both modes)**: upsert `PhoneVerification`
     `{ phone: e164, verified:true, verifiedAt: now }`; **if** a `StudentProfile` exists, update
     `{ phone: e164, phoneVerified: true }`. Return `{ ok:true }`.

#### E. Registration enforcement
9. `registration-actions.ts`: read `countryCode` (default `"+91"`) + `phoneNumber` from FormData
   into `registerPayloadSchema.safeParse`.
10. `complete-registration.ts`:
    - Derive `phone`: `phoneNumber === ""` → `null`; else `toE164(countryCode, phoneNumber)`.
    - **Gate**: `countryCode === "+91"` ⇒ `phone` mandatory (reject if null) AND load
      `PhoneVerification` for `userId`, require `verified===true` && `phone===row.phone`; else
      `{ ok:false, reason:"internal_error", message:"Please verify your phone number to continue." }`.
    - Set `phoneVerified: isIndianPhone(phone) && rowMatches` in **both** create branches
      (non-`+91` → `false`). Referral/enrollment/transaction unchanged.

#### F. Reusable field (`src/components/shared/phone-verify-field.tsx`)
11. `"use client"`. Props `{ defaultCountryCode?; defaultPhoneNumber?; onChange?; onVerifiedChange? }`.
12. UI: shadcn `Select` of dialing codes (`+91` India first/default) + `Input type="tel"
    inputMode="numeric"` national number.
13. **Live mode** (`NEXT_PUBLIC_MSG91_WIDGET_ID` present, not bypass): load MSG91 widget script
    once via `next/script` (`https://verify.msg91.com/otp-provider.js`), init with
    `{ widgetId, tokenAuth, exposeMethods: true }`. When `+91`:
    - **Send OTP** → `window.sendOtp(widgetMobile, onSuccess, onFailure)`.
    - Show 4-digit OTP `Input` + **Verify** → `window.verifyOtp(code, onSuccess, onFailure)`;
      `onSuccess` yields the **access token** → call `verifyOtpAction({countryCode, phoneNumber,
      accessToken})`; on `{ ok:true }` set verified + `onVerifiedChange(true)`.
    - **Resend** (30s cooldown) → `window.retryOtp("text", …)`.
14. **Bypass mode** (`OTP_DEV_BYPASS` / no widget id): skip the widget; **Send OTP** just reveals
    the input + toasts "Dev mode — use code 1234"; **Verify** calls `verifyOtpAction(
    {countryCode, phoneNumber, otp})`.
15. Editing the number after verifying resets verified→`false` + emits `onVerifiedChange(false)`.
    Non-`+91`: hide all OTP UI and report `onVerifiedChange(true)`. Use `sonner` toasts.

#### G. Registration form (`registration-form.tsx`)
16. Replace RHF `phone` with `countryCode` (`"+91"` default) + `phoneNumber`. Remove the phone
    `<Input>` block (lines 598–614); render `<PhoneVerifyField>` wired to `setValue`; track local
    `phoneVerified` via `onVerifiedChange`.
17. `onSubmit`: append `countryCode` + `phoneNumber` (not `phone`) to FormData.
18. Gate submit: `countryCode === "+91"` ⇒ require non-empty `phoneNumber` AND `phoneVerified`;
    else block + toast "Please enter and verify your phone number first." (Server enforces too.)

#### H. Existing-user nudge
19. `get-dashboard-data.ts`: add `phone: true, phoneVerified: true` to the profile `select`.
20. `phone-verify-nudge.tsx` (`"use client"`, props `{ phone, phoneVerified }`): on mount read
    `localStorage["ab_phone_nudge_dismissed"]`; if set → null. Else a dismissible banner with a
    **Verify** button opening a `Dialog` with `<PhoneVerifyField defaultCountryCode="+91"
    defaultPhoneNumber={fromPhone}>`. On verified: toast, close, `router.refresh()`. Dismiss
    writes the localStorage flag.
21. `dashboard/page.tsx`: render `<PhoneVerifyNudge phone={profile.phone}
    phoneVerified={profile.phoneVerified} />` only when `!profile.phoneVerified` AND
    (`profile.phone` is null or `isIndianPhone(profile.phone)`). Not in the ABANDONED / pre-start
    early returns.

#### I. Profile surface (`profile-form.tsx`)
22. "Verified"/"Not verified" `Badge` by phone + a **Verify phone** button opening a `Dialog`
    with `<PhoneVerifyField>`; on success `router.refresh()`. Raw phone edit stays as today.

## 9. Guardrails for Cursor (DO NOT)
- **DO NOT** import `@/lib/msg91`, `@/app/actions/otp-actions`, or anything Prisma-touching into
  `middleware.ts` / `auth.config.ts` (edge bundle limit).
- **DO NOT** put `MSG91_AUTH_KEY` (secret) anywhere client-side — it is used **only** in the
  server `verifyAccessToken`. Only `NEXT_PUBLIC_MSG91_WIDGET_ID` / `NEXT_PUBLIC_MSG91_TOKEN_AUTH`
  may reach the browser (they are the widget's public creds).
- **DO NOT** trust a client "verified" flag — `verifyOtpAction` must verify the access token
  server-side, and `completeRegistration` must re-check `PhoneVerification` in the DB.
- **DO NOT** add `requireRole`/`requireAdmin` to the OTP action; gate with `auth()` only. Don't
  touch `/api/auth/[...nextauth]`, `/login`, or logout.
- **DO NOT** build a server send/resend path — send/resend are the widget's client JS. The only
  OTP server action is verify.
- **DO NOT** store/log the OTP code or the raw access token. Log via `lib/logger.ts`, never
  `console.*`. Zod at every action boundary. Prisma `select` + `$transaction` for multi-writes.
- **DO NOT** make phone mandatory or add OTP for non-`+91` users — that path behaves as today.
- **DO NOT** use `<Button asChild>` / `<Button render={<Link>}>` — `buttonVariants` on links.
- **DO NOT** change Prisma from 6.x.

## 10. Env & MSG91 portal setup (outer steps — no DLT)
**Portal (you, in MSG91):**
1. MSG91 → OTP → **create a Widget**, using the **default template + default sender**
   (the no-DLT "Scenario 1" configuration). Set **OTP length = 4**, expiry ~10 min.
2. Ensure the **OTP Widget subscription plan** is active / funded.
3. Copy the widget's **`widgetId`** and **`tokenAuth`**. (Auth key you already have.)
- **No DLT, no sender ID, no custom template needed** for default config. (Branded sender/
  template is a later upgrade requiring your own DLT — no app change.)

**Env vars:**
- Client (public): `NEXT_PUBLIC_MSG91_WIDGET_ID`, `NEXT_PUBLIC_MSG91_TOKEN_AUTH`.
- Server (secret): `MSG91_AUTH_KEY`.
- Dev/local: `OTP_DEV_BYPASS="true"` (skips the widget; code `1234`, override via `OTP_DEV_CODE`).
  Leave `OTP_DEV_BYPASS` unset/false in production once the widget vars are set.

## 11. DB safety (schema changes present)
1. Commit checkpoint: `git add -A && git commit -m "checkpoint before OTP feature"`; note hash.
2. Create a **Neon branch snapshot** before migrating.
3. `npx prisma migrate dev --name add_phone_verification`, then `npx prisma generate`. Existing
   rows default `phoneVerified=false` (intended "unverified" → drives the nudge).

## 12. Verification
- **Build/typecheck**: `npm run build` (or `tsc --noEmit`) passes; strict TS, no `any`.
- **New +91 (DEV BYPASS)**: `OTP_DEV_BYPASS="true"` → `/register`, `+91`, valid 10-digit mobile →
  Send (toast "use 1234", no SMS) → enter `1234` → Verify → Complete → `/dashboard`. Confirm
  `phoneVerified=true` + `PhoneVerification.verified=true`. Wrong code `9999` fails.
- **New +91 (LIVE widget)**: bypass off + widget vars set → real 4-digit SMS from MSG91's default
  sender → verify → registration completes. Access token verified server-side.
- **New +91 (blocked)**: try Complete without verifying (or with blank phone) → server rejects;
  no profile created.
- **New non-India**: switch to e.g. `+1` → no OTP UI → completes as today; `phoneVerified=false`.
- **Existing +91 user**: dashboard nudge shows once (dismissible via localStorage); verifying
  updates `phone`+`phoneVerified` and the nudge stops.
- **Misconfig**: bypass off AND widget/auth vars unset → verify returns "OTP not configured.",
  nothing crashes.
- **Files changed** match §7 (plus the generated Prisma migration folder).

## 13. Commit message
```
feat(otp): MSG91 OTP Widget phone verification (no DLT, compulsory for new +91)

- Add PhoneVerification model + StudentProfile.phoneVerified
- Headless MSG91 OTP widget in a reusable PhoneVerifyField (custom UI)
- server-only verifyAccessToken (lib/msg91.ts) + verifyOtpAction (server-side trust)
- Enforce verified +91 phone in completeRegistration; non-+91 flow unchanged
- Country-code selector on registration; 4-digit OTP
- OTP_DEV_BYPASS mode (code 1234) for local dev/CI
- Dismissible dashboard nudge + profile verify entry for existing users
- New env: NEXT_PUBLIC_MSG91_WIDGET_ID, NEXT_PUBLIC_MSG91_TOKEN_AUTH, MSG91_AUTH_KEY,
  OTP_DEV_BYPASS, OTP_DEV_CODE
```
