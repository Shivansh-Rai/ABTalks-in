# 167 — Recruiter onboarding must not restart, and a signed-in recruiter must never re-onboard

Date: 2026-09-30 · Author: Sohail

---

## 1. Goal

A recruiter who has already created an account, or who already holds a
session, must never be walked through `/recruiter-onboarding` again. Two
changes: make the wizard's progress survive a closed tab, and give a
signed-in-but-unregistered recruiter a path that finishes their workspace from
the session instead of re-proving their email with a fresh 6-digit code.

---

## 2. Current behavior

### 2a. The wizard keeps its entire state in `sessionStorage`

`src/components/recruiter-onboarding/onboarding-draft.ts`

```ts
const DRAFT_KEY = "abtalks-recruiter-onboarding";
window.sessionStorage.getItem(DRAFT_KEY)   // readDraft
window.sessionStorage.setItem(DRAFT_KEY, …) // writeDraft
```

The file says so outright: *"Nothing here is written to the server"* and *"The
draft lives in sessionStorage — it survives a refresh, not a closed tab."*

`sessionStorage` is scoped to **one tab**. The flow's own shape guarantees the
tab is left: step 3 emails a 6-digit code, so the recruiter switches to their
mail app to read it. On mobile — the platform's main audience — that tab is
routinely evicted, and a code tapped from the email opens a *new* tab. Either
way `readDraft()` returns `null` on return and the wizard mounts at
`welcome` with **every field blank**: full name, work email, company, website,
industry, company size, location.

That is the reported symptom. The recruiter retypes all of it.

### 2b. `registered: true` — the one flag that matters — is in that same storage

```ts
function resumeScreen(draft: OnboardingDraft): Screen {
  if (draft.registered) return "signin-code";
  return isScreen(draft.step) ? draft.step : "verify";
}
```

`registerRecruiterWithOtpAction` creates the account, then the wizard calls
`signIn("recruiter-otp", …)`. If that sign-in does not land (or the recruiter
closes the tab on the "Account created" card), `registered: true` is the only
record that the account already exists — and it dies with the tab. On return,
the wizard starts at `welcome`, the recruiter fills everything in again, presses
**Send code**, and `issueRecruiterOtp(intent: "register")` answers *"This email
is already registered. Sign in instead."* They have paid for the whole wizard to
be told to use a different door.

### 2c. A signed-in recruiter without a `RecruiterProfile` gets the full wizard

`src/app/recruiter-onboarding/page.tsx` (and `/signup/page.tsx`) guard on one
condition only:

```ts
const state = await getRecruiterState(session.user.id);
if (state.status === "active") redirect("/hire");
```

`getRecruiterState` returns `active` **only** when a `RecruiterProfile` row
exists. Any other signed-in visitor falls through to
`<RecruiterOnboardingWizard />`, which receives no session at all — its only
props are `initialScreen` and `passwordEnabled`. So that recruiter is asked for
their name and work email again, is emailed another code to prove an address
the session already proves, and signs in a second time at the end.

This state is not hypothetical: a `role = RECRUITER` user with no
`RecruiterProfile` exists on **all three** databases (read-only count,
2026-09-30: young-shadow 1, nameless 1, proud-sky 1). Plan 160's account
deletion and plan 159's admin-created accounts both produce it.

### 2d. What is NOT the cause (checked, so the next person need not re-check)

- **Session cookie config.** `auth.config.ts` overrides
  `cookies.sessionToken.name` with no `options`. `@auth/core/lib/init.js`
  merges via `utils/merge.js`, which is a **deep** merge, so the default
  `{ httpOnly, sameSite, path, secure }` survive and `session.maxAge` (30 days)
  still applies. Not a truncated cookie.
- **Server-side gates.** `/`, `/recruiter-onboarding`,
  `/recruiter-onboarding/signup`, `/recruiter-onboarding/signin`,
  `/talent/login`, `/talent/register` all redirect an `active` recruiter to
  `/hire`. Correct as written.
- **Registration writes.** `registerRecruiterWithOtpAction` creates
  `RecruiterProfile` + `provisionRecruiterIdentity` in one transaction, so a
  registered recruiter reads back as `active` immediately.
- **Password-first sign-in (plan 166).** Eight of ten recruiters on
  young-shadow have no password, so they land on a form they cannot complete —
  but plan 166 §2a already records that as a known, accepted cost, and the code
  link sits directly below it. Friction, not this bug.

---

## 3. Files to touch

| File | | Note |
|---|---|---|
| `src/components/recruiter-onboarding/onboarding-draft.ts` | `[edit]` | `localStorage` + a `savedAt` stamp and a 7-day TTL; new key; clear the old `sessionStorage` key. |
| `src/components/recruiter-onboarding/recruiter-onboarding-wizard.tsx` | `[edit]` | Accept `session`; skip the code cards when it is present and finish through `registerRecruiterAction`. |
| `src/components/recruiter-onboarding/steps/identity-step.tsx` | `[edit]` | Read-only email + changed hint when the session supplies it. |
| `src/components/recruiter-onboarding/steps/verify-step.tsx` | `[edit]` | Signed-in copy for the review card and its primary label. |
| `src/app/recruiter-onboarding/page.tsx` | `[edit]` | Pass the session's email/name to the wizard. |
| `src/app/recruiter-onboarding/signup/page.tsx` | `[edit]` | Same. |
| `src/features/hire/recruiter-onboarding-persistence.test.ts` | `[new]` | Pin the storage choice, the TTL, the no-OTP-when-signed-in rule and the enumeration line. |

No schema change. No new server action — `registerRecruiterAction`
(`src/app/actions/talent-actions.ts`) already registers from the session and is
left untouched.

---

## 4. Server vs Client

| Component | | |
|---|---|---|
| `src/app/recruiter-onboarding/page.tsx` | **Server** | Resolves `auth()` + `getRecruiterState`. |
| `src/app/recruiter-onboarding/signup/page.tsx` | **Server** | Same. |
| `RecruiterOnboardingWizard` | **Client** | `"use client"` already. |
| `IdentityStep`, `VerifyReviewStep`, `CodeStep` | **Client** | Already. |
| `onboarding-draft.ts` | **Client-only module** | Touches `window`. Imported only by client components. |

**Server → Client props crossing the boundary:** `session` is a plain object of
two optional strings, `{ email: string; name: string }`. No functions, no
icons, no `Date`, no class instances. `initialScreen` and `passwordEnabled` are
unchanged.

---

## 5. Steps

### Step 1 — `onboarding-draft.ts`: survive the closed tab

1. Replace the storage constant:
   ```ts
   const DRAFT_KEY = "abtalks-recruiter-onboarding.v2";
   const LEGACY_DRAFT_KEY = "abtalks-recruiter-onboarding";
   const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
   ```
2. Add an envelope schema beside `draftSchema` — do **not** add fields to
   `draftSchema` itself, so nothing downstream changes shape:
   ```ts
   const storedSchema = z.object({ savedAt: z.number(), draft: draftSchema });
   ```
3. `writeDraft` writes `{ savedAt: Date.now(), draft }` to
   `window.localStorage` under `DRAFT_KEY`.
4. `readDraft` reads `DRAFT_KEY` from `localStorage`, parses with
   `storedSchema`, and returns `null` when
   `Date.now() - parsed.data.savedAt > DRAFT_TTL_MS` (also removing the key in
   that case). Keep the existing `try/catch → null`.
5. `clearDraft` removes `DRAFT_KEY` from `localStorage` **and**
   `LEGACY_DRAFT_KEY` from `sessionStorage`, each in its own `try/catch`.
6. Rewrite the file's header comment to state what is now true: the draft holds
   a name and a work email, it lives on the device in `localStorage` for at
   most 7 days, it is never sent to the server, it never holds a code or a
   password, and it is cleared the moment onboarding finishes.

### Step 2 — `recruiter-onboarding-wizard.tsx`: a session finishes without a code

1. Add the prop:
   ```ts
   session?: { email: string; name: string } | null;
   ```
   Destructure with `session = null`.
2. Seed the draft from it, so the identity card is already answered:
   ```ts
   const [draft, setDraft] = useState<OnboardingDraft>(() => ({
     ...EMPTY_DRAFT,
     step: initialScreen,
     ...(session
       ? { fullName: session.name, email: session.email }
       : {}),
   }));
   ```
3. In the restore effect, when `session` is present, the session's address
   wins over whatever the draft holds, and a `registered` draft must not send
   them to a sign-in code they do not need:
   - after `setDraft({ ...saved, … })`, override
     `email: session.email` and `fullName: saved.fullName.trim() || session.name`;
   - compute the resume target as
     `session ? (isScreen(saved.step) ? saved.step : "verify") : resumeScreen(saved)`;
   - skip the `requestRecruiterOtpAction({ intent: "signin" })` call entirely
     when `session` is set.
4. Add the signed-in completion, next to `register()`:
   ```ts
   function createFromSession() {
     if (!acceptedTerms) { setShowErrors(true); return; }
     setServerError(null);
     startTransition(async () => {
       const res = await registerRecruiterAction({
         fullName: draft.fullName.trim(),
         company: draft.company.trim(),
         acceptLegal: true,
         newsletterOptIn: draft.newsletterOptIn,
       });
       if (!res.ok) {
         // A second tab already finished: they have the workspace, so send
         // them to it rather than showing a refusal for work already done.
         if (/already have recruiter access/i.test(res.message)) {
           persisting.current = false;
           clearDraft();
           window.location.href = "/hire";
           return;
         }
         setServerError(res.message);
         return;
       }
       track(ANALYTICS_EVENTS.recruiterRegSubmitted, { method: "session" });
       update({ registered: true });
       go("ready", 1);
     });
   }
   ```
   Import `registerRecruiterAction` from `@/app/actions/talent-actions`.
   Keep the same `validateIdentity` / `validateCompany` pre-checks
   `sendRegisterCode` runs, so an edited draft cannot reach the action invalid.
5. Wire the review card: `onSend={session ? createFromSession : sendRegisterCode}`
   and pass `signedIn={Boolean(session)}` to `VerifyReviewStep`.
6. Hide the "Already have an account? Sign in" aside when `session` is set —
   they are signed in. Fold it into the existing `accountExists` expression.
7. Leave `register()`, `openWorkspace()`, both `CodeStep` cards and
   `finish()` exactly as they are. The anonymous path must not change.

### Step 3 — `identity-step.tsx`: do not ask for an address the session proves

1. Add `lockedEmail?: boolean`.
2. When it is true: `readOnly`, `aria-readonly`, a muted class, and the hint
   becomes *"This is the address you signed in with."* — the "we'll send a
   6-digit code" hint is a lie on that path.
3. `validateIdentity` is unchanged. The session's address is still checked
   against `isPersonalEmailDomain` by the same rules, and `registerRecruiter`
   refuses a personal domain server-side regardless — a signed-in Gmail
   account must still not become a recruiter.

### Step 4 — `verify-step.tsx`: the review card's last mile

1. Add `signedIn?: boolean` to `VerifyReviewStep`.
2. When true: eyebrow `"Step 3 of 3 · Confirm"`, the description becomes
   *"You're signed in as <email>. Confirm your details to open your
   workspace."* (no code is being sent), and the primary label becomes
   `"Create workspace"`.
3. Everything else — the two summary rows, the terms checkbox, the newsletter
   checkbox, `serverError` — is shared. The `alreadyRegistered` "Sign in
   instead" link stays for the anonymous path only.

### Step 5 — the two pages: pass the session down

In both `page.tsx` files, after the existing `active → redirect("/hire")`:

```ts
const sessionIdentity =
  session?.user?.id && session.user.email
    ? { email: session.user.email, name: session.user.name ?? "" }
    : null;
```

and pass `session={sessionIdentity}`. The `active` redirect stays first, so an
already-registered recruiter never reaches the wizard at all. `/signup` keeps
`initialScreen="identity"`.

### Step 6 — the test

`src/features/hire/recruiter-onboarding-persistence.test.ts`, in the
house source-assertion style used by `recruiter-signin.test.ts`:

- `onboarding-draft.ts` reads and writes `window.localStorage`, not
  `window.sessionStorage`, and carries a TTL constant.
- `clearDraft` still removes the legacy `sessionStorage` key.
- The wizard imports `registerRecruiterAction` and its signed-in branch does
  **not** call `requestRecruiterOtpAction` or `registerRecruiterWithOtpAction`.
- Both pages keep `state.status === "active"` → `redirect("/hire")` ahead of
  rendering the wizard.
- **The enumeration line from plan 166 §2b holds:** no new surface tells an
  anonymous caller whether an address has an account. Assert that the identity
  step calls no server action at all.

---

## 6. Guardrails for Cursor (DO NOT)

- **DO NOT** add a server action, route or field that reports whether an email
  already has a recruiter account. Plan 166 §2b refuses that: it is account
  enumeration. The only place "already registered" may surface stays
  `requestRecruiterOtpAction`, where the caller is actively registering.
- **DO NOT** put the draft in a cookie, or send it to the server, or add a
  database table for it. It holds a name and a work email; it stays on the
  device.
- **DO NOT** ever persist the 6-digit code or the optional password. `code` and
  `password` are React state and must stay out of `OnboardingDraft`.
- **DO NOT** touch `middleware.ts`, `auth.ts`, `auth.config.ts` or the cookie
  configuration. The session cookie is not the fault (§2d) and `/hire`'s
  public/protected split is deliberate.
- **DO NOT** add `requireRole` / `requireAdmin` to any
  `/recruiter-onboarding/*` page. All four are **public** and must stay public.
- **DO NOT** change `register()`, `openWorkspace()`, the two `CodeStep` cards
  or `signIn("recruiter-otp", …)`. The anonymous registration path is not in
  scope and must behave identically after this change.
- **DO NOT** remove the `active → redirect("/hire")` guard from any page, or
  reorder it after the flag check.
- **DO NOT** create new abstraction files. Six edits and one test file; nothing
  else appears.
- **DO NOT** relax `isPersonalEmailDomain`. A signed-in personal-domain account
  must still be refused by `registerRecruiter`.

---

## 7. DB safety

Not applicable. No schema change, no migration, no seed, no backfill. The only
new write path is `registerRecruiterAction`, which already exists and already
writes `RecruiterProfile` + the 078 workspace in one transaction.

---

## 8. Verification

**Typecheck / build**

```
npx tsc --noEmit
npm run build
npm run test:recruiter-signin
npm run test:recruiter-profile
npm run test:recruiter-workspace
npm run test:work-email
```
plus the new `recruiter-onboarding-persistence` test.

**Manual — the reported bug**

1. `/recruiter-onboarding`, signed out. Fill You + Company, reach Verify.
2. **Close the tab.** Reopen `/recruiter-onboarding`.
   *Before:* blank welcome card. *After:* the wizard resumes with name, email
   and every company field still filled.
3. Press Send code, enter it, create the workspace, land on `/hire`.
4. Reopen `/recruiter-onboarding` → still redirected to `/hire`, and
   `localStorage` no longer holds `abtalks-recruiter-onboarding.v2`.

**Manual — signed in, no profile**

5. With a session whose user has no `RecruiterProfile`, open
   `/recruiter-onboarding`. The identity card is prefilled and the email is
   read-only.
6. Continue → Company → Confirm. The primary button reads **Create
   workspace**; pressing it opens the workspace with **no code emailed and no
   second sign-in**.
7. A personal-domain session (e.g. `@gmail.com`) is refused on that same card
   with the work-email message, and no profile is created.

**Files that should have changed:** exactly the seven in §3, plus this plan and
one dated line in `docs/CHANGELOG.md`. Nothing under `src/lib/`,
`src/features/notification/`, `middleware.ts` or `prisma/`.

---

## 9. Commit message

```
fix(recruiter): onboarding survives a closed tab, and a session skips the code

The wizard kept its whole draft in sessionStorage, so the mail-app detour that
step 3 requires wiped it: the recruiter came back to a blank welcome card and
retyped everything, then learned at Verify that the account already existed.
The draft now lives in localStorage behind a 7-day TTL, still device-only and
still never holding a code.

A signed-in recruiter without a RecruiterProfile also got the full wizard,
including a fresh 6-digit code for an address the session already proves. Those
pages now pass the session down and that path finishes through
registerRecruiterAction: no code, no second sign-in.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
