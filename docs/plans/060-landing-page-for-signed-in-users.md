# 060 — Landing page for signed-in users + enrollment-aware track cards

## 1. Goal
Make `/` always render the landing hub — for signed-out **and** signed-in users —
so `abtalks.in` is the front door for everyone, and the dashboard is reached only
at `/dashboard`. On that landing page, each track card's CTA becomes
enrollment-aware: a user already in that track sees **"Open dashboard"** pointing
at their track dashboard, everyone else sees today's label.

## 2. Current behavior

**`/` never renders for a signed-in user.** `src/app/page.tsx:11-24` calls `auth()`
and hard-redirects:
- profile exists → `/dashboard`
- no profile + hackathon registration → `/hackathon/dashboard`
- no profile, no hackathon → `/register`

Only signed-out visitors reach `<LandingHub />`.

**`/login` also bounces signed-in users to `/dashboard`.** Two layers do this:
- `middleware.ts:101-113` — `isAuthPage && isLoggedIn` → `from` if valid, else `/dashboard`.
  This fires first, so it is the one that actually runs.
- `src/app/login/page.tsx:42-74` — defensive duplicate. `resolveRedirectTo()`
  (line 19-24) is used for **two different things**: the already-signed-in bounce
  target *and* the `redirectTo` prop handed to `<LoginClient>` (the post-sign-in
  destination). They must be split — see step 3.

**Track cards are static and session-unaware.** `src/components/landing/landing-hub.tsx:20-62`
holds a module-level `TRACKS` array plus `CLAUDE_TRACK`, each with a fixed
`href` + `ctaLabel`. `TrackCard` (`src/components/landing/track-card.tsx`) is a
Server Component that wraps the whole card in a `<Link href>` and renders
`ctaLabel` in a styled `<span>`. Nothing reads the session.

**Landing header always shows "Sign in"** (`landing-hub.tsx:111-117`) — correct
today only because signed-in users never see this page.

Existing data helpers we can reuse (no new queries need inventing):
- `getUserActiveEnrollments()` — `src/features/enrollment/get-user-enrollments.ts` (ACTIVE only; **not** what we want here)
- `resolveProgramMemberForUser()` — `src/lib/program-auth.ts:58`
- `isUserRegistered()` — `src/features/hackathon/registration-status.ts:4`
- `signOutAction()` — `src/app/actions/auth-actions.ts` (redirects to `/`)

## 3. Decisions already made (do not re-litigate)

| Question | Decision |
|---|---|
| Which cards react to enrollment | **Per-track.** Each card checks its own track. |
| Landing header when signed in | **Avatar + dropdown menu** (new lightweight landing-only menu, *not* `AppHeader`). |
| Signed-in user opens `/login` with no `?from=` | **Redirect to `/`**, not `/dashboard`. |
| CTA label casing | `"Open dashboard"` — matches sibling labels ("Start the challenge", "Apply now"). Not `OPEN DASHBOARD`. |

### Per-track predicates and destinations

| Card | "Enrolled" means | Href when enrolled |
|---|---|---|
| 60-Day Coding Challenge | **any** `Enrollment` row for the user — any `domain`, any `status` (`ACTIVE` / `COMPLETED` / `ABANDONED`) | `/dashboard` |
| Claude Challenge | an `Enrollment` with `domain: CLAUDE` (any status) | `/dashboard?challenge=<enrollmentId>` |
| 31 Days AI Cohort | `resolveProgramMemberForUser()` returns non-null (`ENROLLED` or `COMPLETED`) | `/program/dashboard` |
| Vibe Code Hackathon | `isUserRegistered()` is true | `/hackathon/dashboard` |

Two things about the 60-Day predicate that are deliberate, not sloppy:

1. **Any status, not just `ACTIVE`.** `/dashboard` renders a real screen for all
   three statuses (`ABANDONED` → `EnrollmentEndedScreen`, `dashboard/page.tsx:200-258`;
   `COMPLETED` → challenge-complete card). Filtering to `ACTIVE` would show
   "Start the challenge" to a removed user and send them into `/register`, which
   immediately bounces back to `/dashboard` (`register/page.tsx:43-45`) — a loop.
2. **Any domain, including CLAUDE-only.** A CLAUDE-only enrollee (created via
   `/claude-signup` → `/register?domain=CLAUDE`) cannot register again —
   `register/page.tsx:47-49` redirects them to `/dashboard`. So "Start the
   challenge" would be a dead end for them. `/dashboard` with no `?challenge=`
   resolves a sensible enrollment via `resolveDashboardEnrollment`
   (`get-dashboard-data.ts:125`), so the link is always valid.

`ENABLE_PROGRAM` gating: `src/app/program/layout.tsx:9` calls `notFound()` when
the flag is off. Skip the program membership query entirely when
`isProgramEnabled()` is false — the card keeps its current href/label.

## 4. Files to touch

| Path | Kind | Note |
|---|---|---|
| `src/features/landing/get-landing-state.ts` | **[new]** | Server-only. One function returning the signed-in user snapshot + the four per-track CTA overrides. |
| `src/components/landing/landing-user-menu.tsx` | **[new]** | Client. Avatar + dropdown (Dashboard / Profile / Logout) for the landing header. |
| `src/app/page.tsx` | **[edit]** | Delete all redirects; fetch landing state; pass to `LandingHub`. |
| `src/components/landing/landing-hub.tsx` | **[edit]** | Accept `user` + `ctaOverrides`; apply overrides to `TRACKS`/`CLAUDE_TRACK`; swap the header "Sign in" link for the user menu when signed in. |
| `src/app/login/page.tsx` | **[edit]** | Split the bounce target from `redirectTo`; signed-in + no `from` → `/`. |
| `middleware.ts` | **[edit]** | `isAuthPage && isLoggedIn` fallback `/dashboard` → `/`. **One string.** |
| `docs/CHANGELOG.md` | **[edit]** | One dated line under `## Pending reconcile`. |

`src/components/landing/track-card.tsx` is **not** touched — it already takes
`href` and `ctaLabel` as props. Do not add session logic to it.

## 5. Server vs Client

| Component | Boundary | Notes |
|---|---|---|
| `src/app/page.tsx` | **Server** | Already async; already calls `auth()`. |
| `getLandingState()` | **Server-only module** | `import "server-only"` at the top, like `registration-status.ts:1`. |
| `LandingHub` | **Server** (unchanged — no `"use client"`) | Receives only plain serializable props. |
| `TrackCard` | **Server** (unchanged) | Receives strings only. |
| `LandingUserMenu` | **Client** (`"use client"`) | New. Receives `{ name, email, image, isAdmin }` — all `string \| null \| boolean`. |
| `ThemeToggle` | Client (unchanged) | Already in the landing header. |

**Server → Client boundary check:** the only crossing is
`LandingHub` (Server) → `LandingUserMenu` (Client). Pass **only** the four
primitive fields above. Do NOT pass the `Session` object, a Prisma record, an
icon component, or a function. Logout goes through the existing
`signOutAction` Server Action inside a `<form action={...}>`, exactly as
`app-header.tsx:218-225` does — do not pass a handler down.

## 6. Steps

### Step 1 — `src/features/landing/get-landing-state.ts` [new]

Create the directory `src/features/landing/`. One exported async function plus
its return type. Shape:

```ts
import "server-only";
import { Domain } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isProgramEnabled } from "@/lib/feature-flags";
import { resolveProgramMemberForUser } from "@/lib/program-auth";
import { isUserRegistered } from "@/features/hackathon/registration-status";

export type LandingUser = {
  name: string | null;
  email: string;
  image: string | null;
  isAdmin: boolean;
};

/** Per-track CTA override. `null` = keep the card's default href/label. */
export type TrackCta = { href: string; ctaLabel: string } | null;

export type LandingState = {
  user: LandingUser | null;
  challengeCta: TrackCta;
  claudeCta: TrackCta;
  programCta: TrackCta;
  hackathonCta: TrackCta;
};
```

`getLandingState(): Promise<LandingState>`:

1. `const session = await auth();`
2. If `!session?.user?.id` → return `{ user: null, challengeCta: null, claudeCta: null, programCta: null, hackathonCta: null }`. **Zero DB queries for signed-out visitors — this is the hot path.**
3. Otherwise run the lookups in a single `Promise.all`:
   - `prisma.enrollment.findFirst({ where: { userId }, select: { id: true }, orderBy: { startedAt: "asc" } })` → any-status, any-domain enrollment
   - `prisma.enrollment.findFirst({ where: { userId, domain: Domain.CLAUDE }, select: { id: true } })`
   - `isProgramEnabled() ? resolveProgramMemberForUser(userId) : Promise.resolve(null)`
   - `isUserRegistered(userId)`
4. Build the overrides:
   - `challengeCta` = enrollment ? `{ href: "/dashboard", ctaLabel: "Open dashboard" }` : `null`
   - `claudeCta` = claudeEnrollment ? `{ href: \`/dashboard?challenge=${claudeEnrollment.id}\`, ctaLabel: "Open dashboard" }` : `null`
   - `programCta` = programMember ? `{ href: "/program/dashboard", ctaLabel: "Open dashboard" }` : `null`
   - `hackathonCta` = hackathonRegistered ? `{ href: "/hackathon/dashboard", ctaLabel: "Open dashboard" }` : `null`
5. `user` = `{ name: session.user.name ?? null, email: session.user.email ?? "", image: session.user.image ?? null, isAdmin: session.user.isAdmin ?? false }`

Wrap the whole `Promise.all` block in `try/catch`. On error: log via
`logger` from `@/lib/logger` and return the state with `user` set but all four
CTAs `null` — a signed-in user must still get a rendering landing page if a
query fails. Never `throw` out of this function.

All four Prisma calls use `select`. No transaction — reads only.

### Step 2 — `src/components/landing/landing-user-menu.tsx` [new]

`"use client"`. Props: `{ user: LandingUser }` (import the type from the feature
module — type-only import is fine across the boundary).

Copy the dropdown structure from `src/components/shared/app-header.tsx:159-228`,
trimmed to the landing context:
- Same `Avatar` / `AvatarImage` / `AvatarFallback` + local `initials()` and
  `displayLabel()` helpers (copy them from `app-header.tsx:46-56`; they are 8
  lines — do **not** extract a shared util file for this).
- `DropdownMenuTrigger` with the avatar; label/email column hidden below `md`.
- Menu items, in order: **Dashboard** (`/dashboard`), **Profile** (`/profile`),
  **Admin** (`/admin`, only when `user.isAdmin`), separator, **Logout** via
  `<form action={signOutAction}>` with a submit button.
- Use `<Link>` for navigation items, not `router.push` — this menu has no other
  reason to pull in `useRouter`.

Do **not** import `SynergyChip`, `MobileSidebar`, or `ChallengeSwitcher`. Do
**not** import `AppHeader` itself — its sticky bar, jobs link and synergy fetch
do not belong on the marketing page.

### Step 3 — `src/app/page.tsx` [edit]

Replace the entire body. Result:

```tsx
import { getLandingState } from "@/features/landing/get-landing-state";
import { isClaudeEnabled } from "@/lib/feature-flags";
import { LandingHub } from "@/components/landing/landing-hub";

export default async function HomePage() {
  const state = await getLandingState();
  return <LandingHub claudeEnabled={isClaudeEnabled()} state={state} />;
}
```

Delete the now-unused imports: `redirect` from `next/navigation`, `auth`,
`prisma`, `hackathonRedirectForProfilelessUser`. **No `redirect()` call may
remain in this file.**

`hackathonRedirectForProfilelessUser` stays in the codebase — it is still used
by `dashboard/page.tsx:155` and `login/page.tsx:71`. Do not delete it.

### Step 4 — `src/components/landing/landing-hub.tsx` [edit]

1. Add `state: LandingState` to `LandingHubProps` (keep `claudeEnabled`).
2. Leave the `TRACKS` array and `CLAUDE_TRACK` constant **as the defaults** —
   do not delete the current hrefs/labels. Add a stable `key` field to each
   track entry so overrides can be matched without string-matching titles:
   `key: "challenge" | "hackathon" | "program"`, and `key: "claude"` on
   `CLAUDE_TRACK`.
3. Inside the component, before the JSX, resolve each card:

```tsx
const ctaByKey = {
  challenge: state.challengeCta,
  hackathon: state.hackathonCta,
  program: state.programCta,
  claude: state.claudeCta,
} as const;
```

   Then in the render, spread the override last:

```tsx
{TRACKS.map(({ key, ...track }) => (
  <TrackCard key={track.title} {...track} {...(ctaByKey[key] ?? {})} />
))}
{claudeEnabled ? (
  <TrackCard {...claudeTrackProps} {...(ctaByKey.claude ?? {})} />
) : null}
```

   (Destructure `key` off before spreading so it is not forwarded to
   `TrackCard`, which does not accept it. Same for `CLAUDE_TRACK`.)

4. Header (currently lines 109-117): keep `<ThemeToggle />`; replace the
   `Sign in` `<Link>` with a conditional:

```tsx
{state.user ? (
  <LandingUserMenu user={state.user} />
) : (
  <Link href="/login" className={cn(buttonVariants({ variant: "ghost" }), "h-10")}>
    Sign in
  </Link>
)}
```

   The `buttonVariants`-on-`<Link>` pattern stays exactly as-is for the
   signed-out branch — do not convert it to `<Button asChild>`.

5. Do not change the hero copy, stats, steps, WhatsApp band, or testimonials.
   The landing page reads the same for both audiences apart from the header and
   the four CTAs. That is the whole intent.

### Step 5 — `src/app/login/page.tsx` [edit]

The bug to avoid: `resolveRedirectTo()` currently feeds both the signed-in
bounce and `<LoginClient redirectTo>`. Changing it in place would send users to
`/` **after they sign in**, which is wrong. Split it:

1. Add a helper above the component:

```ts
/** Valid same-origin `from`, or null. */
function safeFrom(from: string | undefined): string | null {
  if (!from || !from.startsWith("/") || from.startsWith("//")) return null;
  return from;
}
```

2. In the component:
   - `const from = safeFrom(params.from);`
   - `const redirectTo = from ?? "/dashboard";` — **unchanged semantics**, still
     passed to `<LoginClient>` at line 108. Signing in still lands on the dashboard.
   - In the `session?.user?.id` branch (line 47), the **first** thing:
     `if (!from) redirect("/");`
   - Everything after that (the `/program` / `/talent` / `/hackathon` prefix
     check, the profile+enrollment lookup, the hackathon divert, the
     `registerHrefWithRef` fallback) stays exactly as written and now only runs
     when `from` is present.
3. `resolveRedirectTo` becomes unused — delete it.

### Step 6 — `middleware.ts` [edit]

Line 106 only. Change the fallback in the `isAuthPage && isLoggedIn` branch:

```ts
const destination =
  from && from.startsWith("/") && !from.startsWith("//")
    ? from
    : "/";
```

Nothing else in this file changes. **No new imports** — the edge-safe rule
(`next-auth` + `next/server` only) must hold.

### Step 7 — `docs/CHANGELOG.md` [edit]

Append one dated line under `## Pending reconcile`:

```
- 2026-08-10 — `/` now renders the landing hub for signed-in users too (no more redirect to /dashboard); track cards show "Open dashboard" per-track via `features/landing/get-landing-state.ts`; `/login` bounces signed-in users to `/` instead of `/dashboard`.
```

## 7. DB safety
Not applicable. No schema change, no migration, no seed, no writes. All four new
queries are `select`-scoped reads.

## 8. Guardrails for Cursor (DO NOT)

- **DO NOT** add any `@/lib/*` import to `middleware.ts`. The only change there is
  one string literal. Adding an import blows the 1 MB Edge bundle.
- **DO NOT** add `requireRole` / `requireAdmin` to `/`, `/login`, or the new
  landing feature module. `/` and `/login` are **public surfaces** and must stay
  reachable signed-out.
- **DO NOT** leave any `redirect()` in `src/app/page.tsx`. If one survives, the
  entire feature is a no-op.
- **DO NOT** change the `redirectTo` value passed to `<LoginClient>`. Post-sign-in
  must still land on `/dashboard` (or `from`). Only the already-signed-in bounce
  changes.
- **DO NOT** reuse `AppHeader` on the landing page. Build the small
  `LandingUserMenu` instead — `AppHeader` drags in `SynergyChip`,
  `ChallengeSwitcher` and `MobileSidebar`.
- **DO NOT** create a shared `initials()` / `displayLabel()` util file. Copy the
  8 lines. No new abstraction files for trivial logic.
- **DO NOT** put session logic inside `TrackCard`. It stays a dumb presentational
  Server Component driven by props.
- **DO NOT** convert `LandingHub` or `TrackCard` to Client Components. Only the
  new menu gets `"use client"`.
- **DO NOT** pass the `Session` object, a Prisma record, an icon component, or a
  function across the Server→Client boundary into `LandingUserMenu`.
- **DO NOT** use `<Button asChild>` or `<Button render={<Link>}>`. Keep
  `buttonVariants` applied directly to `<Link>`.
- **DO NOT** use `console.error` in the new feature module — use `@/lib/logger`.
- **DO NOT** query program membership when `isProgramEnabled()` is false.
- **DO NOT** touch `dashboard/page.tsx`, `register/page.tsx`, `challenges/page.tsx`,
  `claude-signup/page.tsx`, or `hackathonRedirectForProfilelessUser`. They are
  out of scope for this change.
- **DO NOT** add `any`. `LandingState` and `TrackCta` are fully typed; the
  override spread must typecheck without a cast.

## 9. Verification

Build gate: `npm run build` must pass (or `npx tsc --noEmit` for a faster loop).
Confirm the middleware bundle still builds — the Edge size warning must not appear.

Manual test matrix (use `npm run db:seed` test users, `@abtalks.dev`):

| # | State | Visit | Expected |
|---|---|---|---|
| 1 | Signed out | `/` | Landing hub. Header shows **Sign in**. All four CTAs at their current labels. |
| 2 | Signed out | `/dashboard` | Redirect to `/login?from=/dashboard` (unchanged). |
| 3 | Signed in, active 60-day enrollment | `/` | **Landing hub renders — no redirect.** Header shows avatar. 60-Day card = "Open dashboard" → `/dashboard`. |
| 4 | Same user | `/dashboard` | Normal dashboard. Unchanged. |
| 5 | Same user | `/login` | Redirect to `/` (was `/dashboard`). |
| 6 | Same user | `/login?from=/profile` | Redirect to `/profile`. Unchanged. |
| 7 | Signed in, **no** profile / no enrollment | `/` | Landing hub. 60-Day card = "Start the challenge" → `/challenges`. **Not** bounced to `/register`. |
| 8 | Signed in with CLAUDE enrollment, `ENABLE_CLAUDE_CHALLENGE=true` | `/` | Claude card = "Open dashboard" → `/dashboard?challenge=<id>`, and it opens the Claude enrollment. |
| 9 | Enrolled program member, `ENABLE_PROGRAM=true` | `/` | AI Cohort card = "Open dashboard" → `/program/dashboard`. |
| 10 | Hackathon-registered user | `/` | Hackathon card = "Open dashboard" → `/hackathon/dashboard`. |
| 11 | User with `ABANDONED` enrollment | `/` | 60-Day card = "Open dashboard" → `/dashboard` → `EnrollmentEndedScreen`. No `/register` loop. |
| 12 | Signed in, fresh sign-in from landing | Click Sign in → Google → | Lands on `/dashboard`, **not** `/`. |
| 13 | Any signed-in user | `/` → avatar → Logout | Signs out, lands on `/` signed-out. |
| 14 | `ENABLE_PROGRAM` unset | `/` | AI Cohort card keeps "Apply now" → `/program`. No crash, no extra query. |

Cases 5 and 12 together are the regression that step 5 exists to prevent —
test both.

Exactly these files should show in `git status`:
```
src/features/landing/get-landing-state.ts        (new)
src/components/landing/landing-user-menu.tsx     (new)
src/app/page.tsx
src/components/landing/landing-hub.tsx
src/app/login/page.tsx
middleware.ts
docs/CHANGELOG.md
```
Anything else changed = out of scope, revert it.

## 10. Commit message

```
feat(landing): keep signed-in users on / and make track CTAs enrollment-aware

/ no longer redirects authenticated users to /dashboard — the landing hub is
the front door for everyone, and the dashboard lives only at /dashboard.
Each track card now resolves its own CTA: users already in a track see
"Open dashboard" pointing at that track's dashboard (challenge, Claude,
program, hackathon), everyone else sees the original label. The landing
header swaps "Sign in" for an avatar menu when a session exists, and an
already-signed-in visit to /login now lands on / instead of /dashboard
(post-sign-in still goes to /dashboard).
```

---

## Deliberately out of scope (flagged, not changed)

- **`AppHeader` logo links to `/`** (`app-header.tsx:102`). After this change a
  student clicking the ABTalks logo from `/dashboard` lands on the marketing
  landing page instead of bouncing back to the dashboard. That follows directly
  from making `/` reachable, and the new "Open dashboard" CTA is one click back.
  If it turns out to feel wrong in use, the fix is a separate one-line change to
  point the in-app logo at `/dashboard`.
- **`/challenges` for an already-enrolled user** — the domain picker there still
  routes to `/register`, which bounces to `/dashboard`. Harmless, pre-existing,
  and no longer on the enrolled user's path now that their card links straight
  to `/dashboard`.
