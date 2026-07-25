# 043 — Vibe Code Hackathon: Account Indicator + Switch / Logout

## 1. Goal

Because hackathon registration is keyed to the **Google session email** (not a form
field), a signed-in user has no way to register under a different Google account
(personal vs. college, or a teammate who logged in first on a shared device). Add a
visible signed-in-account indicator with **Switch account** (forces the Google chooser)
and **Log out**, in the hackathon header (global) and inline on the registration form.

## 2. Current behavior

- `submitHackathonRegistrationAction` reads the email from `auth()`
  ([hackathon-actions.ts:66](src/app/actions/hackathon-actions.ts:66)); the form can't
  override it. So switching identity requires re-authenticating with a different Google
  account — there is no UI for that today.
- `HackathonHeader` is **not auth-aware**: it always renders a static "Log In / Sign Up"
  link to `/login`, even when the viewer is already signed in
  ([hackathon-header.tsx:20](src/components/hackathon/hackathon-header.tsx:20)).
- `HackathonHeader` is rendered **only by the landing page**
  ([hackathon/page.tsx:20](src/app/hackathon/page.tsx:20)) — not by the register page,
  and not by the layout. So it is absent from the exact place we need it most
  (registration).
- `signOutAction` exists but hardcodes `redirectTo: "/login"`
  ([auth-actions.ts:6](src/app/actions/auth-actions.ts:6)) — reusing it drops the user
  out of the hackathon entirely.
- `signIn` and `signOut` are both exported from `@/auth`
  ([auth.ts:7](src/auth.ts:7)). NextAuth v5's `signIn(provider, options,
  authorizationParams)` forwards the third argument to the OAuth authorization request,
  so `{ prompt: "select_account" }` forces Google's account chooser **for that call
  only** — no change to the shared Google provider in `auth.config.ts`, so platform-wide
  login is unaffected.
- The register form already receives the signed-in email as `initialEmail`
  ([register/page.tsx:23](src/app/hackathon/register/page.tsx:23) →
  `RegistrationForm`), and it uses react-hook-form (so `formState.isDirty` is available
  for the "confirm only if data entered" guard).
- `src/components/ui/dropdown-menu.tsx` exists (use it for the header account menu).

## 3. Files to touch

### New

| Path | New/Edit | Server/Client | Note |
|---|---|---|---|
| `src/app/actions/hackathon-auth-actions.ts` | `[new]` | Server actions | `switchHackathonAccountAction`, `logoutHackathonAction`. **Public — no auth guard.** |
| `src/components/hackathon/account-menu.tsx` | `[new]` | **Client** | Header dropdown: email + Switch account + Log out. |

### Edit

| Path | New/Edit | Note |
|---|---|---|
| `src/app/hackathon/layout.tsx` | `[edit]` | Render `<HackathonHeader />` so it appears on landing, register, and dashboard uniformly. |
| `src/app/hackathon/page.tsx` | `[edit]` | Remove the now-duplicate `<HackathonHeader />` (it moves to the layout). |
| `src/components/hackathon/hackathon-header.tsx` | `[edit]` | Make async + auth-aware: signed in → `<AccountMenu email={…} />`; signed out → existing "Log In / Sign Up" link. |
| `src/components/hackathon/registration-form.tsx` | `[edit]` | Add inline "Registering as {email} · Not you? Switch account" with the dirty-aware confirm. |

**Not touched:** `auth.config.ts` / the Google provider (no global `prompt` change),
`middleware.ts`, `auth.ts`, `prisma/`, `src/components/ui/`.

## 4. Server vs Client boundaries

- `hackathon-header.tsx` becomes an **async Server Component** (calls `auth()`), and
  passes only the plain `email` string into the client `AccountMenu`.
- `account-menu.tsx` is `"use client"` (dropdown open/close). Its menu items invoke the
  two **server actions** (which perform the redirects). It receives `email: string`
  only — no functions, no session object.
- The inline switch lives **inside** `registration-form.tsx` (already a client
  component) so it can read `formState.isDirty`; it calls
  `switchHackathonAccountAction` directly.

## 5. Steps

### Step 1 — `src/app/actions/hackathon-auth-actions.ts` `[new]`

```ts
"use server";

import { signIn, signOut } from "@/auth";

// Force Google's account chooser, scoped to THIS call only (no global provider change).
// After re-auth, land on /hackathon/register; that page forwards already-registered
// users to /hackathon/dashboard (plan 042, step 12) — this is the "smart" destination.
export async function switchHackathonAccountAction() {
  await signIn(
    "google",
    { redirectTo: "/hackathon/register" },
    { prompt: "select_account" },
  );
}

// Plain logout → back to the public hackathon landing (not /login).
export async function logoutHackathonAction() {
  await signOut({ redirectTo: "/hackathon" });
}
```

Guardrails baked in: these are the **login/logout surface** — do **not** wrap them in
`requireRole` / `requireAdmin` / any session check (that would break the ability to
switch/out). No `@/lib/*` edge concerns (these live in an app server action, not
middleware).

> **Executor note on `prompt`:** the third arg to `signIn` is `authorizationParams` in
> Auth.js v5 and is appended to Google's authorize URL. If (and only if) that proves not
> to forward, the fallback is a per-call param — **do NOT** add
> `authorization: { params: { prompt: "select_account" } }` to the Google provider in
> `auth.config.ts`, because that forces the chooser on every login across the whole
> ABTalks platform. Keep it scoped to this flow.

### Step 2 — `src/components/hackathon/account-menu.tsx` `[new]` (Client)

- Props: `{ email: string }`.
- Use `DropdownMenu` from `@/components/ui/dropdown-menu`.
- Trigger: a compact pill matching the header's existing button styling (the
  `bg-[#403880]` treatment from [hackathon-header.tsx:21](src/components/hackathon/hackathon-header.tsx:21))
  — show a small avatar circle with the email's first initial + the email (truncate on
  mobile to just the avatar).
- Menu content:
  - A non-interactive header row showing the full `email` ("Signed in as").
  - **Switch account** → calls `switchHackathonAccountAction()`.
  - **Log out** → calls `logoutHackathonAction()`.
- Invoke each action from the menu item (e.g. wrap each in a `<form action={action}>`
  with a full-width button, or call inside `startTransition`). The action redirects, so
  no response handling is needed.
- The **header** switch does **not** confirm (it's used mainly on landing/dashboard where
  no form data is at stake — see the known limitation in §6).

### Step 3 — `src/app/hackathon/layout.tsx` `[edit]`

Render `<HackathonHeader />` as the first child inside the existing wrapper `div`, above
`{children}`, so every `/hackathon/*` route (landing, register, and the planned
dashboard) gets the same header + account menu. Import it at the top.

### Step 4 — `src/app/hackathon/page.tsx` `[edit]`

Remove the `<HackathonHeader />` render (line ~20) and its import — it now comes from the
layout. Do not change any other landing content.

### Step 5 — `src/components/hackathon/hackathon-header.tsx` `[edit]`

- Make the component `async`; `const session = await auth();` (import `auth` from
  `@/auth`).
- If `session?.user?.email` → render `<AccountMenu email={session.user.email} />` in
  place of the "Log In / Sign Up" link.
- Else → keep the existing "Log In / Sign Up" `<Link href="/login">` exactly as-is.
- Keep the logo link and all layout/styling unchanged.

### Step 6 — `src/components/hackathon/registration-form.tsx` `[edit]`

Add, directly above the form fields (visible in every step), a small muted line:

> Registering as **{initialEmail}** · [Not you? Switch account]

- The "Switch account" is a `button type="button"`. On click:
  - If `form.formState.isDirty` (i.e. the user has already typed into any field beyond
    the pre-filled defaults) → `window.confirm("Switch account? You'll lose what you've
    entered here.")`; if they cancel, do nothing.
  - Otherwise (or on confirm) → call `switchHackathonAccountAction()` (the action
    redirects to Google's chooser).
- Style it as an inline link-button (`text-primary underline-offset-2 hover:underline`),
  not a full button. Do not use `<Button asChild>`.
- `initialEmail` is already a prop — reuse it; don't re-fetch.

## 6. Guardrails for Cursor (DO NOT)

- **DO NOT** add `requireRole`, `requireAdmin`, or any auth gate to
  `hackathon-auth-actions.ts`. This is the login/logout surface — guarding it breaks the
  feature. (Recorded #1 Cursor failure mode on this repo.)
- **DO NOT** edit `auth.config.ts` or the Google provider. The account chooser is forced
  per-call via the third `signIn` argument only. A global `prompt: select_account` would
  change login for the entire 60-day-challenge platform.
- **DO NOT** touch `middleware.ts` or `auth.ts`.
- **DO NOT** render `<HackathonHeader />` in both the layout **and** the landing page —
  move it to the layout and delete the landing's copy (avoid a doubled header).
- **DO NOT** pass the session object or any function into `AccountMenu` — only the
  `email` string crosses the client boundary.
- **DO NOT** change `signOutAction` in `auth-actions.ts` (the rest of the app uses it);
  add the hackathon-scoped actions in the new file instead.
- **DO NOT** use `<Button asChild>` / `<Button render={<Link>}>`; use `buttonVariants`
  on links, plain buttons for actions.
- **DO NOT** use `console.*` (use `logger` if you log at all) or `any`.

### Known limitation (acceptable — call it out, don't over-engineer)

The dirty-aware confirm applies to the **inline** switch on the register page (it can
read `formState.isDirty`). The **header** account menu is not form-aware, so using it
mid-registration switches immediately without a warning. The inline control is the
prominent, intended switch affordance on the register page; the header menu is primarily
for the landing/dashboard where nothing is at stake. Do **not** build a shared
form-dirty context to close this gap for v1.

## 7. DB safety

None — no schema, migration, or data change. Auth-session only.

## 8. Verification

**Build/typecheck (must pass clean):**
```
npx tsc --noEmit
npm run build
```

**Greps (eyeball):**
```
grep -rn "requireRole\|requireAdmin" src/app/actions/hackathon-auth-actions.ts   # zero hits
grep -rn "select_account" src/auth.config.ts src/auth.ts                          # zero hits (per-call only)
grep -rn "HackathonHeader" src/app/hackathon                                      # layout only, not page.tsx
```

**Manual test script:**
1. Signed **out**, visit `/hackathon` → header shows "Log In / Sign Up" (unchanged).
2. Sign in (Google or dev login). Visit `/hackathon` → header now shows the **account
   menu** with your email, not "Log In / Sign Up".
3. Go to `/hackathon/register` → the header account menu is present **and** the inline
   "Registering as {email} · Switch account" line shows above the form.
4. Click **Switch account** (before typing anything) → Google's **account chooser**
   appears → pick a *different* account → you land back on `/hackathon/register` as that
   account (or on `/hackathon/dashboard` if that account is already registered — requires
   plan 042's register redirect to be in place).
5. Back on register, type a team name (create-team) → click the **inline** Switch →
   a confirm dialog appears; **Cancel** keeps your text; **OK** proceeds to the chooser.
6. Open the **header** menu → **Log out** → you land on `/hackathon` (public landing),
   signed out; header shows "Log In / Sign Up" again.
7. Mobile 390px: the account pill truncates to the avatar; menu opens and both items work.

**Exactly these files should show as changed:**
```
src/app/actions/hackathon-auth-actions.ts
src/components/hackathon/account-menu.tsx
src/app/hackathon/layout.tsx
src/app/hackathon/page.tsx
src/components/hackathon/hackathon-header.tsx
src/components/hackathon/registration-form.tsx
```
Anything under `auth.config.ts`, `auth.ts`, `middleware.ts`, `src/app/actions/auth-actions.ts`,
or `src/components/ui/` appearing in `git status` means Cursor went off-plan.

## 9. Commit message

```
feat(hackathon): signed-in account indicator with switch / logout

The hackathon header is now auth-aware and rendered on every /hackathon page:
signed-in users see an account menu (email, Switch account, Log out) instead of
"Log In / Sign Up". Switch account forces Google's account chooser per-call
(prompt=select_account, no global provider change) and returns to registration —
or the dashboard if that account is already registered. The register form gains an
inline "Registering as X · Switch account" with a confirm when fields are dirty.

Since registration is keyed to the session email, this is the only way to register
under a different Google account (personal vs. college, or a shared device).
```

## 10. Dependency note

The "smart" post-switch destination (dashboard when the chosen account is already
registered) relies on the register page redirecting registered users to
`/hackathon/dashboard` — specified in **plan 042, step 12**. If 042 is not yet
implemented, `switchHackathonAccountAction` still correctly lands on
`/hackathon/register`; the auto-forward simply doesn't happen until 042 ships.
