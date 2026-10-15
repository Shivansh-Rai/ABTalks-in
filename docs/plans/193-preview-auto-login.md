# 193 — The preview links sign you in, so neither side needs a login

## 1. Goal

Finish what plans 191–192 started: with the platform closed, a preview link
should open its side **fully** — no Google sign-in, no recruiter OTP — and the
sign-in and register pages should be invisible to everyone else. Opening a link
signs the browser in as a dedicated preview account for that side; the
recruiter one gets a funded workspace so the desk behaves normally.

## 2. What this is

**A URL that authenticates.** Say it plainly, because the rest of the design
follows from it: anyone holding the link is signed in as that account, with no
second factor. A URL leaks differently from a password — screenshots, pasted
chats, browser sync, `Referer` on an outbound click — and the recruiter account
can see the candidate pipeline. It is deliberate and was asked for after the
trade-off was spelled out; these are the containments that cost nothing:

- The provider refuses unless the gate is on (`LANDING_ONE_PAGER` ≠ "false"),
  so turning the launch page off also closes the back door.
- It accepts only a value equal to the configured token. Rotating the token in
  Vercel invalidates every link and every session minted from it is cut off at
  the next sign-in.
- Two dedicated accounts, never a real person's.
- Every preview sign-in is logged.

## 3. Current behavior (after 191 + 192)

- The gate: only `/`, `/terms`, `/privacy`, `/cookies`, `/verify/*` answer.
  `/login` needs the candidate cookie, `/talent/login` the recruiter one.
- `/?preview=<token>` sets a 30-day httpOnly cookie and bounces to `/`.
- With a cookie, the *browsable* product works signed out — `/challenges`,
  `/hire`, `/talent` render anonymously — but everything per-user
  (`/dashboard`, `/profile`, `/hire/projects`, credits, messages) still
  redirects to a login the visitor is not meant to need.

## 4. Files to touch

| Path | Kind | Note |
| --- | --- | --- |
| `src/features/preview/preview-accounts.ts` | `[new]` | find-or-create the two accounts; recruiter gets workspace + onboarding credits |
| `src/auth.ts` | `[edit]` | `preview` Credentials provider, gated on the token and on the launch gate |
| `src/app/preview/enter/route.ts` | `[new]` | the landing point of a preview link: signs in, then forwards to that side's home |
| `middleware.ts` | `[edit]` | unlock redirects to `/preview/enter`; `/preview/*` passes for either cookie |
| `.env.example` | `[edit]` | document that the links now sign in, and what that means |
| `docs/plans/193-preview-auto-login.md` | `[new]` | this file |

Not touched: the one-pager, the gate's public allowlist, any notification path,
and every existing auth path (Google, email code, password, recruiter OTP) is
left exactly as it is.

## 5. Server vs Client

Everything here is server-side: a Route Handler, a Credentials `authorize`, and
Prisma writes. No component changes, so nothing new crosses the
Server→Client boundary.

## 6. Steps

1. **`preview-accounts.ts`** (`import "server-only"`):
   - `PREVIEW_EMAIL = { candidate: "preview-candidate@klymb.ai", recruiter: "preview-recruiter@klymb.ai" }`.
     A work domain on purpose: `registerRecruiter` refuses personal domains,
     and the preview account should not be the one exception to a rule the
     product enforces.
   - `ensurePreviewUser(side)`:
     - find by email; create with `emailVerified` set and the right `Role`
       (`STUDENT` / `RECRUITER`) when absent.
     - candidate: ensure a `CandidateProfile` (`fullName`, a reserved
       `referralCode`) so `isCandidateRegistered` is true and `/dashboard`
       renders instead of bouncing to `/register`.
     - recruiter: ensure a `RecruiterProfile` (`approved`, `setupStep`
       COMPLETE, `setupCompletedAt`) so `getRecruiterState` reports `active`,
       then `ensureRecruiterWorkspace(userId)` for the Organization, then
       `grantOnboardingCreditsAtomic({ organizationId, recruiterUserId })` so
       the desk has its starting balance. That grant is idempotent by
       `idempotencyKey`, so repeat sign-ins do not top it up.
   - Idempotent throughout: the first person to open a link provisions, and
     everyone after reuses. Nothing is seeded by hand into production.

2. **`src/auth.ts`** — a `preview` Credentials provider taking `{ side, token }`:
   returns null unless the gate is on, the side is one of the two, and the
   token equals the configured one (`hasPreviewAccess`). Then
   `ensurePreviewUser(side)` and return the user. Log the sign-in.

3. **`src/app/preview/enter/route.ts`** — GET:
   - read both preview cookies; pick the side (candidate wins when a browser
     holds both, since `/dashboard` is the more common destination).
   - no valid cookie → redirect `/`.
   - **already signed in → do not touch the session**, just forward. An admin
     opening a link keeps their own account rather than being silently
     demoted into the preview one.
   - otherwise `signIn("preview", { side, token, redirectTo })` with
     `/dashboard` or `/hire`.

4. **`middleware.ts`** — the unlock redirects to `/preview/enter` instead of
   `/`, carrying nothing in the URL. `/preview/*` passes whenever either
   preview cookie is valid (a recruiter-cookie browser must reach it too, and
   `/preview` is not inside `RECRUITER_PATHS`).

5. **`.env.example`** — say that the links now sign in, that rotating a token
   revokes them, and that the gate being off disables the provider entirely.

## 7. Guardrails (DO NOT)

- DO NOT weaken, branch or bypass any existing auth path. This provider is
  additive; Google, email code, password and recruiter OTP keep their rules.
- DO NOT let the provider work when the gate is off. A back door that outlives
  the launch page is how this becomes permanent by accident.
- DO NOT accept a side or token from the URL at sign-in time — read them from
  the httpOnly cookie the middleware set.
- DO NOT give the preview accounts admin, and DO NOT grant platform-admin
  anywhere in this flow.
- DO NOT overwrite an existing session.
- DO NOT log, echo or render the token.
- DO NOT seed these accounts by hand against production; provisioning is
  idempotent and happens on first use.
- DO NOT import `@/lib/*` into `middleware.ts`.

## 8. DB safety

No schema change and no migration. It **does** create rows in production on
first use: two `User`s, a `CandidateProfile`, a `RecruiterProfile`, an
`Organization` + `OrganizationMember`, a `CreditAccount` and one
`CreditTransaction`. All of it is ordinary product data created through the
product's own functions, and all of it is removable later by deleting the two
accounts through the admin surfaces that already exist.

## 9. Verification

- `npx tsc --noEmit`, `npx eslint`, `npm run build` pass.
- Against a production build with both tokens set, from a cold browser:
  - candidate link → lands signed in on `/dashboard`; `/profile` and
    `/challenges` render; `/hire` still redirects to `/`.
  - recruiter link → lands signed in on `/hire`; the desk shows a credit
    balance; `/dashboard` still redirects to `/`.
  - a browser holding both reaches both.
  - second use of a link does not create a second account and does not grant
    credits twice.
  - a stranger: `/`, and `/preview/enter` redirects to `/`.
  - `?preview=off` then `/dashboard` → `/`.
- With `LANDING_ONE_PAGER=false`, a preview link signs nobody in.

## 10. Commit message

```
auth: preview links sign in, so a gated side needs no login or OTP

Opening a preview link now signs the browser in as a dedicated account for
that side — preview-candidate@klymb.ai or preview-recruiter@klymb.ai — so the
whole product works behind the launch gate with no Google sign-in and no
recruiter OTP. The recruiter account is provisioned the way a real one is:
RecruiterProfile, Organization, and the onboarding credit grant, so the desk
has a balance.

This is a URL that authenticates, and it is meant to be. The containments:
the provider refuses unless the launch gate is on, it accepts only a value
equal to the configured token, the side and token are read from the httpOnly
cookie rather than the URL, an existing session is never overwritten, the
accounts are dedicated and never admin, and every sign-in is logged.
Rotating a token in Vercel revokes every link made from it.

Provisioning is idempotent and happens on first use, so nothing is seeded by
hand against production.
```
