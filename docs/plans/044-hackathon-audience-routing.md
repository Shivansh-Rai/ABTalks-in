# 044 — Keep Hackathon Registrants Out of the 60-Day Funnel

## 1. Goal

A hackathon registrant is a **separate audience**: they have an ABTalks login (Auth.js
`User`) and a hackathon record (Supabase), but no 60-day `StudentProfile`/`Enrollment`,
and they should never be pushed into the 60-day challenge registration. Today the main
app funnels every profile-less logged-in user to `/register`. Divert hackathon
registrants to `/hackathon/dashboard` instead, at every funnel point, and make sure new
hackathon visitors who log in land back in the hackathon (not `/dashboard`).

## 2. Current behavior

**Reassuring context (not a bug):** `abtalks.in` is this **same** Next.js app — it's the
production domain (the `NEXT_PUBLIC_APP_URL` fallback in
[registration-actions.ts:97](src/app/actions/registration-actions.ts:97) and
[admin-actions.ts:101](src/app/actions/admin-actions.ts:101); support is
`team@abtalks.in`). So `abtalks.in/hackathon` and `abtalks.in/register` share one origin,
one Google session, one cookie. **There is no domain/cookie split**, and logging in for
the hackathon already creates an ABTalks `User` row. The only thing a hackathon
registrant lacks is a 60-day **challenge profile**.

The two registrations are intentionally decoupled — login already sends `/hackathon`
`from`-users straight through without the profile gate
([login/page.tsx:49-55](src/app/login/page.tsx:49)). The problem is the **fallback
funnel**: a profile-less logged-in user is redirected to `/register` (the 60-day signup)
from three places:

- **`/` root** — [page.tsx:16-20](src/app/page.tsx:16): has session, no profile → `/register`.
- **`/dashboard`** — [dashboard/page.tsx:150-151](src/app/dashboard/page.tsx:150):
  `!profile || !enrollment` → `/register`.
- **`/login`** — [login/page.tsx:70](src/app/login/page.tsx:70): has session, no profile
  → `registerHrefWithRef(...)` (i.e. `/register`).

So a hackathon-only person who hits the bare domain, or taps into the main app, gets
dropped into the 60-day form they never asked for.

**Already handled (do not touch):** the mobile bottom-nav already returns `null` on
`/hackathon` and `/hackathon/*` ([bottom-nav.tsx:80-81](src/components/shared/bottom-nav.tsx:80)),
so hackathon pages already don't show the main-app nav.

**Related gap:** the hackathon header's signed-out CTA links to a bare `/login`
([hackathon-header.tsx:20](src/components/hackathon/hackathon-header.tsx:20)) with no
`from`, so `resolveRedirectTo` defaults to `/dashboard` — a brand-new hackathon visitor
who signs in there lands on `/dashboard` → `/register`, the wrong place.

## 3. Files to touch

| Path | New/Edit | Note |
|---|---|---|
| `src/lib/hackathon-supabase.ts` | `[edit]` | Add `hackathonRedirectForProfilelessUser(email)` helper. |
| `src/app/page.tsx` | `[edit]` | Divert hackathon registrants before `/register`. |
| `src/app/dashboard/page.tsx` | `[edit]` | Divert hackathon registrants before `/register`. |
| `src/app/login/page.tsx` | `[edit]` | Divert hackathon registrants before `registerHrefWithRef`. |
| `src/components/hackathon/hackathon-header.tsx` | `[edit]` | Signed-out login link carries `?from=/hackathon/register`. |

**Not touched:** `middleware.ts`, `bottom-nav.tsx` (already hides on `/hackathon`),
`auth.ts`/`auth.config.ts`, `prisma/`, `src/components/ui/`, the 60-day
`registration-form.tsx`.

## 4. Server vs Client boundaries

All four edited pages/components are **Server Components** and already `await auth()`.
The new helper is a server-only Supabase read. No client code changes, no props cross a
boundary. `src/lib/hackathon-supabase.ts` is `server-only` — it is imported only by these
server components (never middleware, never a `"use client"` file).

## 5. Steps

### Step 1 — `src/lib/hackathon-supabase.ts` `[edit]`

Add:

```ts
/**
 * For a logged-in user WITHOUT a 60-day profile: return "/hackathon/dashboard" if they
 * registered for the hackathon, else null (caller proceeds to the normal /register
 * funnel). Fails open to null on any error so legitimate new 60-day users are never
 * blocked from registering.
 */
export async function hackathonRedirectForProfilelessUser(
  email: string | null | undefined,
): Promise<"/hackathon/dashboard" | null> {
  if (!email) return null;
  try {
    const registered = await isEmailRegistered(email.trim().toLowerCase());
    return registered ? "/hackathon/dashboard" : null;
  } catch {
    return null;
  }
}
```

Reuse the existing `isEmailRegistered` (queries `hackathon_participants` by
case-insensitive email). Do **not** duplicate the query.

### Step 2 — `src/app/page.tsx` `[edit]`

In the `session?.user?.id` branch, the `else` (no profile) currently does
`redirect("/register")`. Change to:

```ts
} else {
  const hx = await hackathonRedirectForProfilelessUser(session.user.email);
  if (hx) redirect(hx);
  redirect("/register");
}
```

Leave the `if (profile) redirect("/dashboard")` path untouched — 60-day members with a
profile never trigger the Supabase lookup.

### Step 3 — `src/app/dashboard/page.tsx` `[edit]`

Replace the `if (!data.profile || !data.enrollment) redirect("/register");` at
[line 150](src/app/dashboard/page.tsx:150) with:

```ts
if (!data.profile || !data.enrollment) {
  const hx = await hackathonRedirectForProfilelessUser(session.user.email);
  if (hx) redirect(hx);
  redirect("/register");
}
```

Use whatever the in-scope session/email variable is at that point (the page already has
the session). The lookup runs **only** in this profile-less branch, so real 60-day
members (who have a profile) pay no cost.

### Step 4 — `src/app/login/page.tsx` `[edit]`

At [line 70](src/app/login/page.tsx:70), before `redirect(registerHrefWithRef(params.ref))`:

```ts
const hx = await hackathonRedirectForProfilelessUser(session.user.email);
if (hx) redirect(hx);
redirect(registerHrefWithRef(params.ref));
```

Do **not** change the existing `/program` `/talent` `/hackathon` `from`-handling at
[lines 49-55](src/app/login/page.tsx:49) — that already routes hackathon `from`-users
correctly and this new check sits in the separate profile-less branch.

### Step 5 — `src/components/hackathon/hackathon-header.tsx` `[edit]`

The signed-out login link becomes `href="/login?from=/hackathon/register"` (currently a
bare `/login`). So a new hackathon visitor who signs in is routed back to
`/hackathon/register` (via login's existing `/hackathon` `from`-passthrough), not to
`/dashboard` → `/register`.

> **Coordinates with plan 043:** 043 makes this header auth-aware (signed-in → account
> menu). This edit only sets the `from` on the **signed-out** link. If 043 lands first,
> apply this `from` change to whatever the signed-out branch renders. They touch
> different branches of the same component — no conflict, but land them consistently.

## 6. Guardrails for Cursor (DO NOT)

- **DO NOT** run `hackathonRedirectForProfilelessUser` for users who already have a
  60-day profile. It belongs strictly inside the existing profile-less branches, so real
  members never incur the Supabase round-trip.
- **DO NOT** make the helper throw or block on Supabase errors — it must fail open to
  `null` so a new 60-day registrant is never trapped out of `/register`.
- **DO NOT** touch `middleware.ts` (it's edge-safe and must not import Supabase/Prisma),
  `bottom-nav.tsx` (already hides on `/hackathon`), or the 60-day `registration-form.tsx`.
- **DO NOT** import `@/lib/hackathon-supabase` from any `"use client"` file or from
  middleware — only these server components call it.
- **DO NOT** change the existing `/program` `/talent` `/hackathon` `from`-handling in
  `login/page.tsx`.
- **DO NOT** add `requireRole`/`requireAdmin` to any of these pages — `/`, `/login` are
  public; `/dashboard` keeps its current gating.
- **DO NOT** hard-code the diversion target anywhere but the helper; pages just call it.

## 7. DB safety

No schema, migration, or data change. Read-only Supabase lookups against the existing
`hackathon_participants` table.

## 8. Verification

**Build/typecheck (must pass clean):**
```
npx tsc --noEmit
npm run build
```

**Manual test script:**
1. **Hackathon-only user** (registered for the hackathon, no 60-day profile):
   - Visit `/` → redirected to `/hackathon/dashboard` (not `/register`).
   - Visit `/dashboard` → redirected to `/hackathon/dashboard`.
   - Log out, log back in from the hackathon header → land on `/hackathon/register` →
     (already registered) → `/hackathon/dashboard`. Never see the 60-day form.
2. **Brand-new user, no accounts:**
   - From the hackathon header, click "Log In / Sign Up" → after Google auth → land on
     `/hackathon/register` (because of the `from`), not `/dashboard`/`/register`.
3. **Genuine new 60-day user** (not a hackathon registrant):
   - Visit `/` or `/login` and sign in with no profile → still routed to `/register`
     (the diversion returns null for them). The 60-day funnel is intact.
4. **Existing 60-day member** (has profile + enrollment):
   - `/dashboard` renders normally; no diversion, no extra Supabase call.
5. **Both audiences** (hackathon registrant who also completed the 60-day challenge):
   - `/dashboard` shows the normal 60-day dashboard (profile present → no diversion).
6. **Supabase down / env missing:** the helper returns null → profile-less users still
   reach `/register`. Nothing hangs or 500s.

**Exactly these files should show as changed:**
```
src/lib/hackathon-supabase.ts
src/app/page.tsx
src/app/dashboard/page.tsx
src/app/login/page.tsx
src/components/hackathon/hackathon-header.tsx
```

## 9. Commit message

```
fix(hackathon): route hackathon registrants away from the 60-day funnel

Hackathon registrants are a separate audience (login + Supabase record, no 60-day
profile). The root, dashboard, and login pages previously funneled every
profile-less user into /register; they now divert hackathon registrants to
/hackathon/dashboard instead, and the hackathon header's sign-in link returns new
visitors to /hackathon/register. The 60-day funnel is unchanged for everyone else,
and the lookup runs only for profile-less users so real members pay no cost.
```

## 10. Dependencies & residual notes

- **Hard dependency on plan 042:** the diversion target `/hackathon/dashboard` must
  exist. If 042 hasn't shipped, temporarily target `/hackathon` (landing) in the helper
  instead, then switch to `/hackathon/dashboard` once 042 lands.
- **Residual edge (acceptable for a one-off event):** deep main-app routes
  (`/profile`, `/challenge`, `/quiz`) aren't diverted — but the bottom-nav is hidden on
  `/hackathon`, so a hackathon-only user has no organic path to them; only manual URL
  entry reaches them. Apply the same helper there later only if it comes up.
- Not building any hackathon→60-day funnel or account-linking — that was explicitly
  deferred ("separate audiences").
