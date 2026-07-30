# 049 — Disable Phone OTP in Local Development

## 1. Goal
Remove phone OTP as a requirement while running `next dev`, so local registration,
profile editing, and dashboard testing do not require sending or entering a code.
Production and production-mode builds must keep the existing MSG91 verification flow unchanged.

## 2. Current behavior
- Indian (`+91`) registration always requires a matching verified
  `PhoneVerification` row on both the client and server.
- `OTP_DEV_BYPASS=true` only bypasses MSG91: the user must still enter the fixed
  development code (`OTP_DEV_CODE`, default `1234`).
- Unverified users can still see the profile Verify button and the one-time
  dashboard verification nudge during local development.
- Client bypass mode is currently inferred from missing public MSG91 widget
  variables, while server bypass mode is controlled by `OTP_DEV_BYPASS`; this plan
  does not change those production/live-path rules.

## 3. Files to touch
- `src/lib/feature-flags.ts` `[edit]` — add one server-side helper that returns
  whether OTP verification is required (`process.env.NODE_ENV !== "development"`).
- `src/app/register/page.tsx` `[edit]` — evaluate that helper and pass the primitive
  boolean to the client registration form.
- `src/app/register/registration-form.tsx` `[edit]` — skip the client submit gate in
  local development and pass the requirement into the phone field.
- `src/components/shared/phone-verify-field.tsx` `[edit]` — when verification is not
  required, keep phone/country collection but hide OTP controls and report the
  field as allowed to continue.
- `src/features/registration/complete-registration.ts` `[edit]` — skip the
  `PhoneVerification` lookup only in development; persist the phone as unverified
  rather than manufacturing a successful verification.
- `src/app/profile/page.tsx` `[edit]` — pass the primitive OTP requirement to the
  profile form.
- `src/app/profile/profile-form.tsx` `[edit]` — in development, retain the editable
  phone input but hide the Verify button/dialog and show no verification prompt.
- `src/app/dashboard/page.tsx` `[edit]` — do not render `PhoneVerifyNudge` when OTP
  verification is disabled.
- `docs/CHANGELOG.md` `[edit]` — append one dated rule line under
  `## Pending reconcile` describing the local-development exception.

## 4. Server vs Client
- **Server:** `feature-flags.ts`, `register/page.tsx`,
  `complete-registration.ts`, `profile/page.tsx`, `dashboard/page.tsx`.
- **Client:** `registration-form.tsx`, `phone-verify-field.tsx`,
  `profile-form.tsx`.
- **Server→Client props:** pass only `otpVerificationRequired: boolean` from the
  register/profile Server Components. No functions, icons, or class instances
  cross the boundary.

## 5. Steps
1. In `src/lib/feature-flags.ts`, add
   `isOtpVerificationRequired(): boolean`, returning
   `process.env.NODE_ENV !== "development"`. Keep
   `isOtpDevBypassEnabled()` and `otpDevCode()` unchanged; they remain useful for
   testing the OTP flow in a production-mode environment.
2. In `src/app/register/page.tsx`, call the new helper and pass its result as
   `otpVerificationRequired` to `RegistrationForm`.
3. In `src/app/register/registration-form.tsx`:
   - Add the boolean prop.
   - Initialize/interpret the local continuation state so development does not
     require a successful OTP.
   - Apply the existing `+91 && !phoneVerified` submit rejection only when
     `otpVerificationRequired` is true.
   - Pass `verificationRequired={otpVerificationRequired}` to
     `PhoneVerifyField`.
4. In `src/components/shared/phone-verify-field.tsx`:
   - Add `verificationRequired?: boolean` with a default of `true`.
   - When false, continue emitting country code and phone values through
     `onChange`, call `onVerifiedChange(true)` so the parent can submit, and do
     not initialize/load MSG91 or show Send/Resend/Verify controls.
   - Keep the existing phone format validation and country selector. Do not
     write a `PhoneVerification` row or call `onVerified`; local bypass means
     “verification not required,” not “verified.”
5. In `src/features/registration/complete-registration.ts`, guard the existing
   India-only verification lookup with `isOtpVerificationRequired()`. In
   development, create the profile with the submitted E.164 phone and
   `phoneVerified: false`. In production, preserve the current required lookup,
   phone match, error message, and `phoneVerified: true` result exactly.
6. In `src/app/profile/page.tsx`, pass the server-computed requirement to
   `ProfileForm`.
7. In `src/app/profile/profile-form.tsx`, add the boolean prop. For an unverified
   profile in development, render the normal editable phone input without the
   Verify button, OTP dialog, or OTP helper copy. Leave already-verified profile
   display unchanged.
8. In `src/app/dashboard/page.tsx`, call the same helper and conditionally render
   `PhoneVerifyNudge` only when verification is required.
9. Append exactly one line to `docs/CHANGELOG.md`:
   `- 2026-07-29 [rule] Phone OTP remains required in production but is skipped under next dev so local registration and profile testing need no verification code`

## 6. Guardrails for Cursor (DO NOT)
- DO NOT change production OTP behavior, MSG91 token verification, widget
  configuration, or the fixed-code bypass behavior.
- DO NOT use `OTP_DEV_BYPASS` as the new off switch; it means “test with a fixed
  code,” not “verification is optional.”
- DO NOT mark locally entered phones as verified and DO NOT create fake
  `PhoneVerification` rows.
- DO NOT weaken the server-side production check based only on a client prop.
- DO NOT add a new environment variable; `NODE_ENV=development` from `next dev`
  is the local-development boundary.
- DO NOT edit Prisma schema/migrations or run migration/seed commands.
- DO NOT touch `middleware.ts`, auth configuration, or public-route guards.
- DO NOT add new files or abstractions beyond this listed plan file.
- Keep middleware edge-safe and keep all Server→Client props serializable.

## 7. Verification
- With `npm run dev`, register a new user using a valid `+91` number without
  sending or entering an OTP; registration succeeds and the stored profile has
  `phoneVerified=false`.
- In local development, registration has no OTP controls, an unverified profile
  has no Verify button/dialog, and the dashboard does not show the phone
  verification nudge.
- Confirm non-India phone behavior and phone format validation remain unchanged.
- Run a production-mode UI/build check and confirm the `+91` submit gate and
  server-side `PhoneVerification` lookup still apply.
- `npx tsc --noEmit` passes.
- `npx next build` passes. Do not use `npm run build` for this verification
  because it runs `prisma migrate deploy`.
- Exact changed application/doc files are the nine paths in §3; no Prisma,
  middleware, auth, or environment files change.

## 8. Commit message
```text
feat(otp): skip phone verification in local development

Keep production MSG91 enforcement intact while allowing next dev registration,
profile editing, and dashboard testing without an OTP code.
```
