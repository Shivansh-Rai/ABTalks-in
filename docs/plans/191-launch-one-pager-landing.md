# 191 — Launch one-pager home page, recruiter side hidden (temporary)

## 1. Goal

Replace `/` with a single-screen launch page announcing that the next **Claude
Challenge starts 15 November 2026**, carrying a sign-in button and the
candidate-side entry points only, and hide the whole recruiter product (`/hire`,
`/talent`, `/recruiter-onboarding`) from the UI *and* from direct navigation for
everyone except admins. **Temporary.** Every existing file stays in place; the
whole thing is one env var (`LANDING_ONE_PAGER`) so it reverts without a code
change.

## 2. Current behavior

- `src/app/page.tsx` — signed-out visitors get the full marketing landing
  (`LandingPage`: hero video, stats, bridge, keep-three, cohorts, testimonials,
  FAQ, global community, community, CTA band, footer). Signed-in: admins →
  `/admin`, accounts with a `RecruiterProfile` → `/hire`, everyone else →
  `/dashboard`.
- Recruiter CTAs on the landing are already conditional on
  `isRecruiterAuthEnabled()` (`showRecruiterCta` threaded through `LandingNav`,
  `HeroSection`, `CtaBand`, `SiteFooter`) — but `ENABLE_RECRUITER_AUTH=true`
  today, so they show, and `/hire` is reachable by URL regardless.
- `middleware.ts` treats `/hire`, `/talent`, `/hire/matches`,
  `/talent/shortlist`, `/talent/login`, `/talent/register` as *public* recruiter
  entries and gates the rest of those prefixes behind a session.
- The Claude Challenge is `COHORT_DEFAULTS`' fourth card, shown only when
  `ENABLE_CLAUDE_CHALLENGE=true`; `/claude-signup` redirects to `/` when it is
  off.

## 3. Files to touch

| Path | Kind | Note |
| --- | --- | --- |
| `src/lib/feature-flags.ts` | `[edit]` | add `isLaunchOnePagerEnabled()` — on unless `LANDING_ONE_PAGER=false` |
| `src/components/landing/launch/launch-content.ts` | `[new]` | all copy + `CLAUDE_LAUNCH_AT` (one line to change the date) |
| `src/components/landing/launch/launch-one-pager.tsx` | `[new]` | Server Component — the whole page |
| `src/components/landing/launch/launch-countdown.tsx` | `[new]` | Client Component — live countdown only |
| `src/components/landing/launch/launch.css` | `[new]` | one-pager layout, on top of `landing.css` tokens |
| `src/app/page.tsx` | `[edit]` | branch to the one-pager; stop routing recruiters to `/hire` while on |
| `middleware.ts` | `[edit]` | redirect `/hire`, `/talent`, `/recruiter-onboarding` → `/` unless admin |
| `.env.example` | `[edit]` | document `LANDING_ONE_PAGER` and how to revert |
| `.github/CODEOWNERS` | `[edit]` | rule 13: list the new landing/launch paths under `@byteninjaa0` |

Nothing under `src/components/landing/site/**`, `src/app/hire/**`,
`src/app/talent/**` or `src/app/recruiter-onboarding/**` is edited, moved or
deleted.

## 4. Server vs Client

| Component | Boundary | Notes |
| --- | --- | --- |
| `HomePage` (`src/app/page.tsx`) | Server | reads session + flags |
| `LaunchOnePager` | **Server** | renders nav, hero, cards, footer; no state |
| `LaunchCountdown` | **Client** | `useEffect` tick; receives `targetIso: string` + `targetLabel: string` — plain strings only |
| `LandingUserMenu` | Client (existing) | already takes a serialisable `LandingUser` |

Server→Client props crossing the boundary: `targetIso`/`targetLabel` (strings)
and `user` (plain object of `string | null | boolean`). No functions, icons or
class instances cross.

## 5. Steps

1. **`src/lib/feature-flags.ts`** — append, with a comment saying it is plan
   191 and temporary:
   ```ts
   export function isLaunchOnePagerEnabled(): boolean {
     return process.env.LANDING_ONE_PAGER !== "false";
   }
   ```
   Default-on by design: production needs no new env var to get the one-pager,
   and `LANDING_ONE_PAGER=false` in Vercel brings the full landing back.

2. **`launch-content.ts`** — export:
   - `CLAUDE_LAUNCH_AT = "2026-11-15T00:00:00+05:30"` (IST, per the project's
     day-boundary rule) and `CLAUDE_LAUNCH_LABEL = "15 November 2026"`.
   - `LAUNCH_HERO` (eyebrow, headline, body).
   - `LAUNCH_POINTS` — three candidate-side points (build daily with Claude /
     proof of work on GitHub + LinkedIn / verified certificate on finish).
   - `LAUNCH_TRACKS` — the candidate tracks that are live now:
     `/challenges`, `PROGRAM_AI_COHORT_BASE`, `/hackathon`.
   - `LAUNCH_FOOTER_LINKS` — Mission, Terms, Privacy, Cookies. **No `/hire`,
     no `/talent`, no `/recruiter-onboarding` anywhere in this file.**
   - re-use `WHATSAPP_INVITE` from `landing-content.ts` rather than copying it.

3. **`launch-countdown.tsx`** — `"use client"`. `useState<null | {d,h,m,s}>`
   starting `null`, `useEffect` sets it immediately then every 1000 ms,
   clearing on unmount. While `null` (server render + first paint) it renders
   `targetLabel`, so there is no hydration mismatch. Past the target it renders
   the label too.

4. **`launch-one-pager.tsx`** — Server Component, props
   `{ user: LandingUser | null; getStartedHref: string; claudeHref: string }`.
   Markup inside `<div className="abtalks-landing launch">`, importing
   `../site/landing.css` (tokens, `.container`, `.btn*`) and `./launch.css`:
   - skip link → `#main`
   - header: ABTalks logo mark (`/landing/abtalks-logo-mark.png`), then either
     `LandingUserMenu` or `Sign in` (`/login`, `btn btn--ghost btn--sm`) +
     `Get started` (`getStartedHref`, `btn btn--clay btn--nav`)
   - hero: eyebrow pill, `<h1>`, `<LaunchCountdown />`, body copy, primary CTA
     (`claudeHref`) + `Sign in`
   - three `LAUNCH_POINTS` cards; `LAUNCH_TRACKS` list ("Live right now");
     WhatsApp community button
   - footer: `LAUNCH_FOOTER_LINKS` + `© ABTalksOnAI <year>`
   - Buttons that navigate are `<Link className={...btn}>` (plain anchors/Links,
     never `<Button asChild>`).

5. **`launch.css`** — scoped `.abtalks-landing.launch …` only. One-screen hero
   (`min-height: 100svh` desktop, auto on phones), eyebrow pill, countdown
   digits, 3-up card grid collapsing to one column ≤720 px, footer row.
   `prefers-reduced-motion` guard on the one fade-in.

6. **`src/app/page.tsx`** —
   - keep the Google Ads `<Script>` block byte-for-byte; lift it into a local
     `GoogleAdsScripts()` function in the same file so both branches render it
     (no new file for three lines).
   - admin redirect to `/admin` stays first and unchanged.
   - when the flag is on: a signed-in user who `isCandidateRegistered` still
     goes to `/dashboard` (unchanged); **do not** call `getRecruiterState` and
     **do not** redirect to `/hire` — middleware would bounce them straight
     back here, which is an infinite redirect. A recruiter account therefore
     sees the one-pager with its user menu.
   - when the flag is off: today's code path verbatim (`getRecruiterState` →
     `/hire` or `/dashboard`, then `getLandingState()` → `<LandingPage>`).
   - `claudeHref` = `/claude-signup` when `isClaudeEnabled()`, else the
     register/login href — so the CTA is never a link that redirects to `/`.

7. **`middleware.ts`** — above the existing `isProtected && !isLoggedIn`
   branch:
   - `const launchOnePager = process.env.LANDING_ONE_PAGER !== "false";` read
     straight from `process.env` with a comment pointing at
     `isLaunchOnePagerEnabled()` — middleware must not import `@/lib/*`, so
     this duplication is deliberate (same convention as the consent constants).
   - `isRecruiterSurface` = exact or prefix match on `/hire`, `/talent`,
     `/recruiter-onboarding`.
   - admin exemption from the session already decrypted here:
     `req.auth?.user?.isAdmin === true || role === "ADMIN"` (same pair of checks
     `page.tsx` uses).
   - when hidden → `NextResponse.redirect(new URL("/", req.nextUrl))` through
     the existing `withTracking(...)` so the request id and cookie handling are
     unchanged. It must come **first** so a signed-out visitor to `/hire` lands
     on `/` rather than `/talent/login`.
   - `protectedPaths`, `isPublicRecruiterEntry` and the matcher are left alone.

8. **`.env.example`** — document `LANDING_ONE_PAGER` next to the other flags:
   default on, `=false` restores the full landing and unhides the recruiter
   routes, and note it also gates the middleware block.

9. **`.github/CODEOWNERS`** — add `/src/components/landing/` and
   `/src/components/landing/launch/` → `@byteninjaa0` (design/front-end and
   shared architecture are Sohail's in CLAUDE.md; today they only match the `*`
   default).

## 6. Guardrails (DO NOT)

- DO NOT delete, move, rename or gut anything under
  `src/components/landing/site/**`, `src/app/hire/**`, `src/app/talent/**`,
  `src/app/recruiter-onboarding/**`, `src/features/hire/**` or
  `src/features/talent-pool/**`. This is a UI/route hide, not a removal.
- DO NOT import from `@/lib/*` in `middleware.ts` — it blows the 1 MB Edge
  bundle. Read `process.env.LANDING_ONE_PAGER` inline.
- DO NOT add `requireRole`/`requireAdmin` to `/`, `/login` or the Auth.js
  handler. `/` stays public.
- DO NOT touch any notification path — the Notifications module is locked to
  Manuvrtti. Nothing in this plan goes near it.
- DO NOT change `ENABLE_RECRUITER_AUTH`, `ENABLE_CLAUDE_CHALLENGE` or any other
  existing flag's meaning, and do not remove the `showRecruiterCta` plumbing.
- DO NOT block `/api/**`, `/admin/**` or `/admin/hire` — admin keeps full
  access, and no API is gated by this change.
- DO NOT add a waitlist table, model, migration or email capture. There are no
  schema changes in this plan.
- DO NOT use `<Button asChild>` / `<Button render={<Link>}>`; put
  `btn`/`buttonVariants` classes on the `Link` itself.
- DO NOT create files the table in §3 does not list.
- DO NOT hard-code the launch date in more than one place —
  `CLAUDE_LAUNCH_AT` / `CLAUDE_LAUNCH_LABEL` only.

## 7. DB safety

None. No schema change, no migration, no seed, no data write.

## 8. Verification

- `npx tsc --noEmit` and `npm run build` pass.
- `npm run dev`, signed out:
  - `/` is the one-pager — Claude Challenge launch, "15 November 2026",
    countdown ticking, Sign in + Get started, no recruiter copy or link
    anywhere (`view-source` grep for `/hire`, `/talent`,
    `recruiter-onboarding` → nothing).
  - `/hire`, `/hire/matches`, `/talent`, `/talent/login`, `/talent/register`,
    `/recruiter-onboarding` all 307 to `/`.
  - `/login`, `/register`, `/challenges`, `/program/ai-cohort`, `/hackathon`,
    `/terms`, `/privacy` unchanged.
- Signed in as a candidate: `/` still redirects to `/dashboard`.
- Signed in as an admin: `/` → `/admin`; `/hire` and `/admin/hire` both open.
- Signed in as a recruiter (non-admin): `/` renders the one-pager with the user
  menu and does **not** redirect-loop.
- With `LANDING_ONE_PAGER=false` in `.env.local` and the server restarted: the
  full landing is back and `/hire` opens for the public exactly as today.
- Mobile width 375 px: hero fits, no horizontal scroll.
- Files changed = exactly the nine in §3, four of them new.

## 9. Commit message

```
landing: temporary Claude Challenge launch one-pager, recruiter side hidden

`/` renders a single-screen launch page (next Claude Challenge, 15 Nov 2026,
live countdown, sign-in and candidate entry points) and the recruiter product
is hidden from the UI and from direct navigation.

Both halves are one flag, LANDING_ONE_PAGER, on unless set to "false":

  - page.tsx branches to the new one-pager and, while it is on, stops routing
    recruiter accounts to /hire — middleware would bounce them back to /,
    which is an infinite redirect.
  - middleware redirects /hire, /talent and /recruiter-onboarding to / for
    everyone except admins, who keep the desk and /admin/hire.

Nothing is deleted. The full landing, the hire desk, the talent pool and
recruiter onboarding are untouched on disk; LANDING_ONE_PAGER=false restores
all of it with no code change.
```
