# 114 — Recruiter OTP: resend button, 30s cooldown, working rate limit

## 1. Goal

Give the recruiter email-code flow a **Resend code** button that stays disabled for
30 seconds after a code is sent, enforced on the server as well as in the UI, and
repair the per-address rate limit in `issueRecruiterOtp`, which is currently a
no-op.

**Scope note.** The original request also asked for dedicated `/recruiter/*` (later
`/hire/login`, `/hire/register`) sign-in pages. That was explicitly dropped: the
existing `RecruiterAuthDialog` modal stays as the sign-in surface and **no new
routes are created**. Nothing in `middleware.ts`, `next.config.ts` or any layout is
touched by this plan. The resend button lands in the two shared form components, so
the modal and the existing `/talent/login` + `/talent/register` pages all get it
from one implementation.

## 2. Current behavior

`src/features/recruiter-auth/otp.ts` issues a 6-digit code, stores
`sha256(code + AUTH_SECRET)` in `RecruiterEmailOtp`, TTL 10 minutes, 5 wrong
attempts per code, and intends a ceiling of 3 codes per address per 15 minutes.

Three defects:

1. **No resend.** Once `RecruiterLoginForm` / `RecruiterRegisterForm` advance to the
   code step, the only way to get a new code is "Use a different email" / "Change
   details", which throws away the entered details and re-runs the whole step.

2. **No cooldown.** Nothing stops a code request from being repeated immediately.

3. **The rate limit does not work.** `issueRecruiterOtp` counts rows created inside
   the 15-minute window (`otp.ts:106-110`), then the very next statement runs
   `deleteMany({ where: { email } })` before creating the new row (`otp.ts:119-130`).
   At most one row per email ever exists, so `recent >= RATE_LIMIT` is never true.
   The counter is destroyed by the same function that reads it. Codes per address
   are effectively unlimited.

A fourth issue follows from the fix: `verifyRecruiterOtp` and `purgeExpiredOtps` both
**delete** rows. Any delete inside the rate window re-breaks the counter, so
consumption has to stop being a delete.

Both forms are rendered in three places — `/talent/login`, `/talent/register`, and
`RecruiterAuthDialog` (opened from 8 call sites on `/hire`). Changing the forms
covers all three.

## 3. Files to touch

| File | | Note |
|---|---|---|
| `prisma/schema.prisma` | `[edit]` | Add `consumedAt DateTime?` + `@@index([email, createdAt])` to `RecruiterEmailOtp` |
| `src/features/recruiter-auth/otp-policy.ts` | `[new]` | Zero-import module: the OTP constants + two pure decision helpers |
| `src/features/recruiter-auth/otp.ts` | `[edit]` | Consume instead of delete; 30s cooldown; working ceiling; window-safe purge |
| `src/app/actions/recruiter-auth-actions.ts` | `[edit]` | Cooldown refusal message; return `resendInSeconds` in success data |
| `src/components/talent/use-recruiter-otp-resend.ts` | `[new]` | Client hook: countdown + sessionStorage restore |
| `src/components/talent/recruiter-login-form.tsx` | `[edit]` | Resend button on the code step (`intent: "signin"`) |
| `src/components/talent/recruiter-register-form.tsx` | `[edit]` | Resend button on the code step (`intent: "register"`) |
| `src/features/recruiter-auth/otp-policy.test.ts` | `[new]` | Pure-helper tests + source-level regression assertions |
| `package.json` | `[edit]` | Add `test:recruiter-otp` script |

**Why `otp-policy.ts` exists** (it is not a wrapper for trivial logic): `otp.ts`
starts with `import "server-only"` and pulls in `@/lib/db`, so anything importing it
constructs a `PrismaClient`. The repo has no test framework — tests are standalone
`tsx` scripts. A zero-import policy module is the only seam that lets the cooldown
and ceiling rules be asserted without a database, and it is also the module the
**client** forms import `RESEND_COOLDOWN_SECONDS` from. It must import nothing.

## 4. Server vs Client

| Module | Boundary |
|---|---|
| `otp-policy.ts` | **Shared.** Constants + pure functions, no imports. Safe in both bundles. |
| `otp.ts` | **Server only** (`server-only`, Prisma). |
| `recruiter-auth-actions.ts` | **Server Action.** |
| `use-recruiter-otp-resend.ts` | **Client** (`"use client"`). |
| `recruiter-login-form.tsx` | **Client** (already). |
| `recruiter-register-form.tsx` | **Client** (already). |

**Server→Client crossings:** none added. The only new data crossing the boundary is
`resendInSeconds: number` inside the Server Action's already-serializable result. No
functions, icons, or class instances cross. No component prop signatures change, so
no page or the dialog needs editing.

**Constraint:** because client components import `otp-policy.ts`, it must never
import `server-only`, `@/lib/db`, `@/lib/logger`, or any Node built-in. If it grows
an import, the client bundle breaks.

## 5. Steps

### Step 1 — `prisma/schema.prisma`

On `model RecruiterEmailOtp`, add:

```prisma
  /// Set when the code is used, expired out, or superseded by a newer one.
  /// Rows are never deleted inside the rate window — the window count is what
  /// makes the per-address ceiling work, and a delete erases it.
  consumedAt DateTime?
```

Add `@@index([email, createdAt])` (serves both the newest-row lookup and the window
count). Leave `@@index([email])` and `@@index([expiresAt])` in place — dropping
indexes is risk this plan does not need.

Do not run the migration yet; see §7.

### Step 2 — `src/features/recruiter-auth/otp-policy.ts` `[new]`

No imports. Exports:

```ts
export const CODE_LENGTH = 6;
export const TTL_MINUTES = 10;
export const MAX_ATTEMPTS = 5;
export const RATE_LIMIT = 3;
export const RATE_WINDOW_MINUTES = 15;
export const RESEND_COOLDOWN_SECONDS = 30;
```

Two pure functions:

- `cooldownRemainingSeconds(lastCreatedAt: Date | null, now: Date): number`
  - `null` → `0`.
  - `elapsed = now - lastCreatedAt`. If `elapsed >= 30_000` → `0`.
  - Otherwise `Math.ceil((30_000 - elapsed) / 1000)`.
  - If `elapsed` is negative (clock skew), clamp the result to
    `RESEND_COOLDOWN_SECONDS` rather than returning something larger.
- `isOverRateLimit(recentCount: number): boolean` → `recentCount >= RATE_LIMIT`.

### Step 3 — `src/features/recruiter-auth/otp.ts`

Delete the local `CODE_LENGTH` / `TTL_MINUTES` / `MAX_ATTEMPTS` / `RATE_LIMIT` /
`RATE_WINDOW_MINUTES` constants and import them from `./otp-policy`, along with both
helpers. Keep everything else — `hashCode`, `safeEqual`, `normaliseEmail`,
`findLiveSeat`, the `randomInt` generation — exactly as it is.

**3a. Extend `IssueResult`** with a cooldown arm that carries the remaining seconds:

```ts
  | { ok: false; reason: "rate-limited" | "not-registered" | "already-registered" }
  | { ok: false; reason: "cooldown"; retryAfterSeconds: number }
```

**3b. `issueRecruiterOtp`** — keep the identity gates first and unchanged (an
unregistered address must still hear "not registered", not "wait 30s"). After them,
before the window count:

```ts
const latest = await prisma.recruiterEmailOtp.findFirst({
  where: { email },
  orderBy: { createdAt: "desc" },
  select: { createdAt: true },
});
const retryAfterSeconds = cooldownRemainingSeconds(
  latest?.createdAt ?? null,
  new Date(),
);
if (retryAfterSeconds > 0) return { ok: false, reason: "cooldown", retryAfterSeconds };
```

Keep the existing window `count` query, but gate it with `isOverRateLimit(recent)`.

In the transaction, **replace `deleteMany` with an update**:

```ts
await prisma.$transaction([
  // Supersede, never delete: the window count below depends on these rows
  // surviving, and deleting them is what made the ceiling a no-op.
  prisma.recruiterEmailOtp.updateMany({
    where: { email, consumedAt: null },
    data: { consumedAt: new Date() },
  }),
  prisma.recruiterEmailOtp.create({ /* unchanged */ }),
]);
```

**3c. `verifyRecruiterOtp`** — scope the lookup to live rows and replace every
`delete` with a consume:

- `findFirst({ where: { email, consumedAt: null }, orderBy: { createdAt: "desc" }, select: { id, codeHash, purpose, attempts, expiresAt } })`.
- Expired branch → `update({ where: { id: row.id }, data: { consumedAt: new Date() } })`, return `expired`.
- `attempts >= MAX_ATTEMPTS` branch → same update, return `too-many`.
- Wrong code, under the cap → unchanged `update({ data: { attempts: next } })`, return `invalid`.
- Wrong code, hitting the cap → consume, return `too-many`.
- Correct code → consume, return `{ ok: true, email, purpose }`.

Single-use is preserved: `consumedAt: null` in the `where` means a consumed row is
never read again, and superseded rows were consumed at issue time.

**3d. `purgeExpiredOtps`** — this is the subtle one. Change the filter from
`expiresAt` to `createdAt` older than the rate window:

```ts
const { count } = await prisma.recruiterEmailOtp.deleteMany({
  where: { createdAt: { lt: new Date(Date.now() - RATE_WINDOW_MINUTES * 60_000) } },
});
```

The window (15 min) is longer than the TTL (10 min), so everything removed is long
dead. Purging on `expiresAt` would delete rows the ceiling still needs to count and
would silently restore the original bug.

### Step 4 — `src/app/actions/recruiter-auth-actions.ts`

Import `RESEND_COOLDOWN_SECONDS` from `@/features/recruiter-auth/otp-policy`.

Widen the success type to
`ActionResult<{ sent: true; resendInSeconds: number; devCode?: string }>` and return
`resendInSeconds: RESEND_COOLDOWN_SECONDS` alongside `sent: true`.

Add the cooldown branch **first** in the `!issued.ok` chain:

```ts
if (issued.reason === "cooldown") {
  return {
    ok: false,
    message: `Wait ${issued.retryAfterSeconds}s before asking for another code.`,
  };
}
```

Leave the `rate-limited`, `already-registered` and `not-registered` messages exactly
as they are. The seconds go **in the message string** — do not add fields to the
`{ ok: false }` arm; that envelope is fixed by CLAUDE.md.

`registerRecruiterWithOtpAction` and `requestRecruiterOtpSchema` are unchanged. Resend
is the same action called again with the same input.

### Step 5 — `src/components/talent/use-recruiter-otp-resend.ts` `[new]`

`"use client"`. Signature:

```ts
export function useRecruiterOtpResend(email: string): {
  secondsLeft: number;
  start: (seconds: number) => void;
};
```

- `start(seconds)` sets `secondsLeft` and persists the deadline as
  `sessionStorage["abtalks:otp-sent:" + email.trim().toLowerCase()] = String(Date.now() + seconds * 1000)`.
- An effect keyed on `email` restores `secondsLeft` from that key (0 if missing or
  past), so re-entering the code step in the same tab shows a real countdown.
- A 1-second interval decrements to 0, cleared at 0 and on unmount.
- Wrap **every** `sessionStorage` read and write in `try/catch` — it throws outright
  in some privacy modes, and a storage failure must not break sign-in.

### Step 6 — `src/components/talent/recruiter-login-form.tsx`

- `const { secondsLeft, start } = useRecruiterOtpResend(email);`
- In `requestCode()`, on success call `start(res.data.resendInSeconds)` before
  `setStep("code")`, so the button is already counting when the step appears.
- Add a `resend()` transition calling
  `requestRecruiterOtpAction({ email, intent: "signin" })`:
  - success → `setDevCode(res.data.devCode ?? null)`, `setCode("")`,
    `start(res.data.resendInSeconds)`, `toast.success("New code sent.")`
  - failure → `toast.error(res.message)` and `start(RESEND_COOLDOWN_SECONDS)`. The
    client cannot know the server's exact remaining time, so it locks for the full
    period — over-waiting slightly is correct, under-waiting is not.
- On the code step, between the "Sign in" button and "Use a different email", add:

```tsx
<button
  type="button"
  disabled={pending || secondsLeft > 0}
  onClick={resend}
  className="mx-auto block text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
>
  {secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : "Resend code"}
</button>
```

### Step 7 — `src/components/talent/recruiter-register-form.tsx`

Identical to Step 6 with `intent: "register"`, hooked into `sendCode()`, and the
resend button placed between "Complete registration" and "Change details".

### Step 8 — test + script

`src/features/recruiter-auth/otp-policy.test.ts` `[new]`. Mirror the harness in
`src/features/synergy/synergy-cap.test.ts` exactly — the local `suite()` / `assert()`
/ `source()` helpers, the pass/fail tally, and `process.exit(1)` on failure. Do not
add a test framework.

Pure assertions on the helpers:

- `cooldownRemainingSeconds(null, now) === 0`
- 0s elapsed → `30`; 29s → `1`; 30s → `0`; 45s → `0`
- a `lastCreatedAt` in the future → `30` (clamped, not larger)
- `isOverRateLimit(2) === false`, `isOverRateLimit(3) === true`, `isOverRateLimit(4) === true`

Source-level regression assertions (this repo's existing idiom — they pin the exact
mistakes this plan fixes):

- the `issueRecruiterOtp` body does **not** contain `deleteMany`
- it contains `cooldownRemainingSeconds` and `isOverRateLimit`
- the `verifyRecruiterOtp` body does **not** contain `.delete(`, and its lookup
  contains `consumedAt: null`
- the `purgeExpiredOtps` body filters on `createdAt`, not `expiresAt`
- `recruiter-auth-actions.ts` contains `"cooldown"` and `resendInSeconds`
- both form files contain `Resend code` and `secondsLeft`

`package.json`, alongside the other `test:*` entries:

```json
"test:recruiter-otp": "tsx src/features/recruiter-auth/otp-policy.test.ts"
```

No `--conditions=react-server` — the test imports only `otp-policy.ts` and reads the
other files as text, so it never loads Prisma.

**Honest limit:** these are unit + source assertions. They do not prove single-use,
expiry or the ceiling against a real database. That stays a manual check (§8), because
the repo has no test database or integration harness, and adding one is out of scope.

## 6. Guardrails for Cursor (DO NOT)

- **DO NOT create any new routes or pages.** No `/hire/login`, `/hire/register`,
  `/recruiter/*`. The scope was explicitly cut to the existing modal.
- **DO NOT modify `middleware.ts`, `next.config.ts`, or any `layout.tsx`.** Nothing in
  this plan requires them, and `middleware.ts` is the edge-safe file — it must keep
  importing only `next-auth` and `next/server`.
- **DO NOT touch `RecruiterAuthDialog`, `HireAuthProvider`, `HireChrome`,
  `TalentShell`, or any of the 8 `openAuth` call sites.** They render the same two
  form components and pick up the resend button with no edits.
- **DO NOT reintroduce `deleteMany` into `issueRecruiterOtp`.** That single line is
  the bug being fixed.
- **DO NOT let `purgeExpiredOtps` delete rows inside the 15-minute rate window.**
  Filtering on `expiresAt` silently restores the original defect.
- **DO NOT treat the client timer as the enforcement.** The server must refuse
  independently; the countdown is UX only.
- **DO NOT add fields to the `{ ok: false, message }` arm** of the result envelope.
  The remaining seconds belong in the message string.
- **DO NOT let `otp-policy.ts` acquire any import** — client components import it.
- **DO NOT change** `CODE_LENGTH`, `TTL_MINUTES`, `MAX_ATTEMPTS`, the `/^\d{6}$/`
  regex, the hashing, or `safeEqual`.
- **DO NOT change** the `not-registered` / `already-registered` messages. They allow
  account enumeration; that is a known, separate product decision.
- **DO NOT add a Google button** or edit the "No password, no Google account" copy —
  that is ticket T-126.
- **DO NOT route `RecruiterEmailOtp` or `recruiterProfile` access through
  `src/repositories/`.** This is auth infrastructure; under the in-flight 078
  migration the legacy tables stay authoritative and direct Prisma access here is the
  existing, correct pattern.
- **DO NOT create files beyond the three listed as `[new]`.**
- No `console.*` — use `lib/logger.ts`. No `any`. Zod stays the boundary.
- Buttons: `buttonVariants` directly on the element; never `<Button asChild>`.

## 7. DB safety

Schema changes, so in this order:

1. **Commit checkpoint before migrating.** Commit the code changes from Steps 2-8
   first, and record the hash here: `_______`. The migration is the only step that is
   not revertible by `git revert` alone.
2. **Neon branch snapshot** of production before any deploy that carries this
   migration.
3. Locally: `npx prisma migrate dev --name recruiter_otp_consumed_at`, then
   `npx prisma generate`.
4. Production applies it through the existing `npm run build:deploy`
   (`prisma migrate deploy`). No manual SQL.
5. **No backfill.** The column is additive and nullable. Existing rows get
   `consumedAt = NULL`, which the new `verifyRecruiterOtp` reads as live — and the old
   code kept at most one row per email, so a code in flight during the deploy still
   verifies. Zero downtime, no coordination needed.
6. **Rollback:** reverting the application code without reverting the migration is
   safe — the old code never references `consumedAt`. Do not drop the column to roll
   back.

## 8. Verification

**Build gate**

```bash
npx prisma generate && npm run lint && npm run build && npm run test:recruiter-otp
```

All four must pass. `npm run build` must be clean, not merely non-fatal.

**Manual — dev, with `BREVO_API_KEY` unset so codes print on screen**

Run each of these on `/talent/register`, then repeat the first four inside the `/hire`
modal (add a candidate to the cart to trigger the checkout panel) to confirm both
surfaces behave the same:

1. Send a code → the resend button reads "Resend code in 30s" and is disabled, and
   the number decrements once per second.
2. At 0 it enables. Click it → a new code appears, and a success toast fires.
3. Enter the **previous** code → rejected. (Superseded at issue time.)
4. Reload mid-countdown, re-enter the same email, click Continue → refused with
   "Wait Ns before asking for another code." The server, not the timer, does this.
5. **The ceiling, which previously never fired:** request 3 codes for one address
   with 30s+ gaps inside 15 minutes, then request a 4th → "Too many codes requested.
   Try again in a few minutes."
6. Wait past the 15-minute window → allowed again.
7. Enter 5 wrong codes on one code → "Too many wrong codes. Request a new one.", and
   the correct code is then rejected too.
8. Confirm the dev-code banner still shows on both forms after a resend.

**MANDATORY regressions (from the ticket)**

- Sign in as an existing **recruiter**, an existing **candidate**, and an **admin**.
  All three still reach their own home screen.
- On staging with a real `BREVO_API_KEY`, trigger a recruiter sign-in code and
  confirm it arrives in a **real inbox**. Do not test delivery with an
  `@abtalks.dev` address — `sendEmail` hard-skips that domain and the UI will report
  success with nothing sent.

**Exactly these files should have changed**

`prisma/schema.prisma`, `prisma/migrations/*_recruiter_otp_consumed_at/*`,
`src/features/recruiter-auth/otp-policy.ts`, `src/features/recruiter-auth/otp.ts`,
`src/features/recruiter-auth/otp-policy.test.ts`,
`src/app/actions/recruiter-auth-actions.ts`,
`src/components/talent/use-recruiter-otp-resend.ts`,
`src/components/talent/recruiter-login-form.tsx`,
`src/components/talent/recruiter-register-form.tsx`, `package.json`.

Anything else changed — especially a route, a layout, `middleware.ts` or
`next.config.ts` — means the plan was exceeded; stop and report.

Finally, append one dated line to `docs/CHANGELOG.md` under `## Pending reconcile`.

## 9. Commit message

```
feat(recruiter-auth): resend code with 30s cooldown, repair rate limit

Adds a Resend code button to both recruiter OTP forms, disabled for 30
seconds after a send and enforced server-side, not just in the UI.

Repairs the per-address ceiling. issueRecruiterOtp counted rows in the
15-minute window and then deleted every row for that email before
creating the new one, so the count was never above one and the limit of
3 never fired. Codes are now superseded by setting consumedAt instead of
being deleted, which leaves the window count intact; verifyRecruiterOtp
reads only unconsumed rows, so single use is unchanged. purgeExpiredOtps
now prunes on createdAt past the rate window rather than on expiresAt,
which would have deleted the rows the ceiling depends on.

The OTP constants and the two decision rules move to a zero-import
otp-policy module so they can be tested without a database and shared
with the client forms.
```
