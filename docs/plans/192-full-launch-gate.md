# 192 — Close the whole platform behind the launch one-pager, with two preview links

## 1. Goal

Extend plan 191 from "hide the recruiter side" to "hide everything": while
`LANDING_ONE_PAGER` is on, **every** visitor — signed out or signed in — sees
only the launch one-pager. The team gets in through two secret links, one for
the candidate side and one for the recruiter side, plus admin accounts which
pass both. **Temporary.** No file is deleted; one env var lifts all of it.

## 2. Current behavior (after plan 191)

- `/` renders `LaunchOnePager`; `middleware.ts` redirects `/hire`, `/talent`,
  `/recruiter-onboarding` to `/` unless the session is an admin.
- Everything else is open: `/dashboard`, `/challenges`, `/program/*`,
  `/hackathon`, `/register`, `/jobs`, `/claude-signup` and the rest of the
  candidate product are all reachable by anyone.
- `/` redirects a signed-in admin to `/admin`, and a registered candidate to
  `/dashboard`.
- The one-pager advertises "Get Started" → `/register` and an "Open right now"
  list pointing at `/challenges`, `/program/ai-cohort`, `/hackathon`.

## 3. Files to touch

| Path | Kind | Note |
| --- | --- | --- |
| `middleware.ts` | `[edit]` | the gate: public allowlist, two preview cookies, admin bypass; absorbs 191's recruiter block |
| `src/app/page.tsx` | `[edit]` | admin → `/dashboard` (not `/admin`); only exempt visitors leave the one-pager |
| `src/lib/feature-flags.ts` | `[edit]` | `previewTokens()` + `isPreviewExempt()` helpers for the app side |
| `src/components/landing/launch/launch-content.ts` | `[edit]` | copy for a closed funnel; drop `LAUNCH_TRACKS` |
| `src/components/landing/launch/launch-one-pager.tsx` | `[edit]` | sign-in only; no Get Started, no track list |
| `src/components/landing/launch/launch.css` | `[edit]` | drop the track-list rules |
| `.env.example` | `[edit]` | document both tokens and how to build the links |
| `docs/plans/192-full-launch-gate.md` | `[new]` | this file |

## 4. Server vs Client

| Component | Boundary | Notes |
| --- | --- | --- |
| `middleware.ts` | Edge | reads `process.env` + cookies only; **no `@/lib/*` imports** |
| `HomePage` | Server | reads session + `cookies()` |
| `LaunchOnePager` | Server | loses a prop (`getStartedHref`, `claudeHref`) |
| `LaunchCountdown` | Client | unchanged |

No new Server→Client prop crosses the boundary; the one-pager sheds two.

## 5. Steps

1. **`middleware.ts`** — replace 191's `recruiterHidden` block with the full
   gate, in this order:

   a. **Unlock handling, before anything else.** When `?preview=` is present:
      compare the value against `PREVIEW_TOKEN_CANDIDATE` and
      `PREVIEW_TOKEN_RECRUITER`; on a match set `klymb_preview_candidate` /
      `klymb_preview_recruiter` (httpOnly, sameSite lax, secure in production,
      path `/`, 30 days) and redirect to the same URL with the param stripped,
      so the secret never stays in the address bar, in history or in a
      `Referer`. `?preview=off` clears both. No match: strip and set nothing —
      never say which it was.

   b. **Exemption.** `isAdminSession` (as 191 computes it) passes both sides.
      Otherwise the candidate cookie passes candidate routes and the recruiter
      cookie passes recruiter routes — one does not imply the other.

   c. **Public allowlist**, as one array with a one-line reason each:
      - `/` — the one-pager itself
      - `/login` — the only door in; without it nobody, admin included, can
        sign in on a fresh browser
      - `/terms`, `/privacy`, `/cookies` — footer and consent-banner links,
        and they have to stay reachable anyway
      - `/mission` — footer link
      - `/verify/…` — the link printed on every certificate already issued;
        closing it breaks verification for people who hold one
      `/api/auth/*` is already outside the matcher. Everything else, candidate
      or recruiter, redirects to `/`.

   d. Keep `withTracking(...)` on every response so the request id and the
      consent/attribution cookies behave exactly as they do today.

2. **`src/app/page.tsx`** —
   - Admin → `redirect("/dashboard")`, replacing `/admin`. Deliberate, asked
     for: the admin's way in is the product, not the console. `/admin` is
     still there by URL. An admin with no `CandidateProfile` will be bounced
     on to `/register` by the dashboard's own gate, which is correct and
     reachable for them.
   - A visitor holding the candidate preview cookie and already registered →
     `/dashboard`, as before.
   - **Everyone else renders the one-pager, signed in or not.** The old
     "registered candidate → /dashboard" redirect must not fire for them, or
     `/` → `/dashboard` → `/` loops.
   - Drop `getStartedHref` / `claudeHref`; the page is sign-in only now.

3. **`src/lib/feature-flags.ts`** — `previewTokens()` reading both env vars and
   `isPreviewExempt(side, cookieValue)`, so `page.tsx` is not a second copy of
   the comparison. Middleware still reads `process.env` by hand (Edge bundle),
   with the comment saying so.

4. **`launch-content.ts`** — body copy that is true with registration closed
   ("Registration opens shortly before kickoff"), no "create your account
   now". Delete `LAUNCH_TRACKS`: every one of those links is gated now, so
   each would bounce the visitor back to `/`.

5. **`launch-one-pager.tsx` / `launch.css`** — remove the Get Started buttons
   and the whole "Open right now" section plus its CSS. Keep one quiet
   "Sign in" in the nav and one in the hero, the three points, the WhatsApp
   invite (external, and the only way an interested visitor can stay in touch
   while signup is shut) and the footer.

6. **`.env.example`** — document both tokens, the link shape
   (`https://app.klymb.ai/?preview=<token>`), the 30-day cookie, `?preview=off`,
   and that rotating a token in Vercel revokes every link built from it.

## 6. Guardrails (DO NOT)

- DO NOT import from `@/lib/*` in `middleware.ts` (1 MB Edge limit).
- DO NOT treat this as a security boundary. It is a marketing gate in front of
  surfaces that keep their own auth: `protectedPaths` still redirects signed-out
  visitors to `/login`, and every page guard stays exactly as it is. Do not
  remove or weaken a single existing check while adding this one.
- DO NOT gate `/api/**`. The auth callbacks must work, and those routes carry
  their own authorization.
- DO NOT put the token in a URL that stays in the address bar — strip it and
  redirect.
- DO NOT log, echo or render the token, and do not report which of the two a
  failed value nearly matched.
- DO NOT delete the recruiter block from plan 191 — it is absorbed into the
  allowlist, not dropped, and `/hire` must still be closed to a candidate
  preview cookie.
- DO NOT touch any notification path (locked to Manuvrtti), the hire desk, the
  talent pool or the full landing components.
- DO NOT add a waitlist, email capture, schema change or migration.

## 7. DB safety

None. No schema change, no migration, no data write.

## 8. Verification

- `npx tsc --noEmit`, `npx eslint`, `next build` all pass.
- Against a production build, signed out, no cookie: `/` is the one-pager;
  `/dashboard`, `/challenges`, `/program/ai-cohort`, `/hackathon`, `/register`,
  `/jobs`, `/claude-signup`, `/hire`, `/talent`, `/recruiter-onboarding` all
  land on `/`; `/login`, `/terms`, `/privacy`, `/cookies`, `/mission` and
  `/verify/x` still answer.
- `/?preview=<candidate token>` → 307 to `/`, cookie set, `/dashboard` and
  `/challenges` now open, `/hire` still bounces.
- `/?preview=<recruiter token>` → `/hire` opens, `/dashboard` still bounces.
- `/?preview=wrong` → no cookie, nothing opens, no hint which token it missed.
- `/?preview=off` → both cookies cleared, everything closed again.
- Signed in as a candidate with no cookie: `/` is still the one-pager and
  does not loop.
- `LANDING_ONE_PAGER=false`: the full landing is back and every route opens
  exactly as it does today.

## 9. Commit message

```
landing: close the whole platform behind the one-pager, with two preview links

Plan 191 hid the recruiter side. This hides the candidate side too: while
LANDING_ONE_PAGER is on, every visitor — signed out or signed in — gets the
launch page, and only /, /login, the legal pages, /mission and /verify/*
answer.

Access for the team is two secret links, one per side:

  /?preview=$PREVIEW_TOKEN_CANDIDATE   candidate side
  /?preview=$PREVIEW_TOKEN_RECRUITER   recruiter side

Each sets an httpOnly cookie for 30 days and the token is stripped from the
URL immediately, so it never sits in the address bar, history or a Referer.
One side does not imply the other. ?preview=off clears both, and rotating a
token in Vercel revokes every link built from it. Admin sessions pass both
without a link, and / now sends an admin to /dashboard rather than /admin.

This is a marketing gate, not a security boundary: every route keeps the auth
it already had. Nothing is deleted, and LANDING_ONE_PAGER=false reopens all of
it with no code change.
```
