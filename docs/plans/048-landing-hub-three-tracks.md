# 048 — Landing hub + track pages (Challenge / Hackathon / AI Bootcamp / Claude)

## 1. Goal

Make a public landing hub at `/` the permanent front door, offering three
always-on tracks — 60-Day Challenge, Vibe Code Hackathon, AI Bootcamp — each
opening its own public page, each registering through the existing
auth → register → dashboard flow.

**The hub is the front door regardless of `ENABLE_CLAUDE_CHALLENGE`.** Claude
stops being a redirect that pre-empts the homepage and becomes a **flag-gated
fourth track**: a fourth hub card, a fourth domain on `/challenges`, and a
fourth card in the `/register` picker — all appearing only while the flag is on,
and none of them locking the user into Claude.

This means the flag no longer controls *routing*, only *whether Claude is
offered*. Both flag states must work; neither is "the launch state".

## 2. Current behavior

**Front door is hard-wired to Claude.**
`src/app/page.tsx` — logged-out users hit `isClaudeEnabled()` and are redirected
to `/claude-signup` before `OnboardingClient` ever renders. With the flag on
(current production state), the 5-slide onboarding carousel at
`src/components/landing/onboarding-client.tsx` is effectively dead.

**Three tracks exist but are structurally different:**

| Track | Public page | Register route | Storage | Post-register |
|---|---|---|---|---|
| 60-Day Challenge | **none** | `/register` (protected) | Neon: `StudentProfile` + `Enrollment` | `/dashboard` |
| Hackathon | `/hackathon` | `/hackathon/register` (protected) | Neon: `HackathonParticipant` | `/hackathon/dashboard` |
| AI Bootcamp | `/ai-workshop` | inline form → `/api/ai-workshop/register` | **Supabase** `registrations` table | none — no account |

- There is **no public overview page for the 60-Day Challenge**. That is the
  real gap this plan fills.
- `/hackathon` and `/ai-workshop` are already built and polished.
- The Bootcamp is **lead capture, not enrollment** — no `User` row, no
  dashboard. See §5 Phase 0 decision.

**Auth funnel already works.** `middleware.ts` protects `/register`,
`/hackathon/register`, `/dashboard`. A logged-out user hitting `/register` is
sent to `/login?from=/register` and bounced back after sign-in. No new auth
work is needed — only correct `href`s.

**The register form locks to Claude while the flag is on — this is the blocker.**
`src/app/register/page.tsx:60` computes:
```ts
const initialDomain =
  claudeEnabled || params.domain === "CLAUDE" ? ("CLAUDE" as const) : undefined;
```
and `registration-form.tsx` uses `forceClaudeDomain` to **hide the SE/DS/AI
cards entirely** (`domainCardList` returns `[]`). So with the flag on, `/register`
offers no domain choice at all. A user arriving from `/challenges` →
"Start the challenge" would land locked into Claude. Everything else in this
plan works around that fact.

**Domain validation has no flag guard.** `src/lib/validations/register.ts:11`
is `z.enum(["SE","DS","AI","CLAUDE"])` — unconditional. With the flag off, a
crafted POST of `domain=CLAUDE` still creates a Claude enrollment and triggers
the Claude welcome email + PDF in `registration-actions.ts:105`. Pre-existing,
but it matters more once CLAUDE is a visible picker option.

**Middleware drops the query string on the login bounce.** `middleware.ts:94`
is `url.searchParams.set("from", pathname)` — `pathname` only. So
`/register?domain=AI` hit while logged out returns to a bare `/register` after
sign-in, silently losing the domain choice.

## 3. Files to touch

### Phase 1 — front door
- `src/app/page.tsx` — `[edit]` drop the `isClaudeEnabled()` redirect; render `<LandingHub claudeEnabled={…} />`.
- `src/components/landing/landing-hub.tsx` — `[new]` the hub. Server Component.
- `src/components/landing/track-card.tsx` — `[new]` one card. Server Component.

**No env change.** `ENABLE_CLAUDE_CHALLENGE` keeps whatever value it has; see §7.

### Phase 2 — challenge page + unlocking the register funnel
- `middleware.ts` — `[edit]` preserve the query string on the login bounce (§5 Step 6). The `"/challenge"` → `"/challenge/"` entry is **already applied**.
- `src/app/challenges/page.tsx` — `[new]` public 60-Day Challenge overview. Server Component.
- `src/components/challenges/domain-picker.tsx` — `[new]` SE/DS/AI + flag-gated Claude. **Client**.
- `src/components/shared/faq-accordion.tsx` — `[new]` reusable collapsed-row FAQ. **Client**.
- `src/components/challenges/streak-grid.tsx` — `[new]` static 60-cell preview. Server Component.
- `src/app/register/page.tsx` — `[edit]` stop forcing CLAUDE; pass `claudeEnabled` through.
- `src/app/register/registration-form.tsx` — `[edit]` stop discarding the domain list; swap `forceClaudeDomain` for `claudeEnabled`. The CLAUDE card already exists.
- `src/app/actions/registration-actions.ts` — `[edit]` reject `domain: "CLAUDE"` server-side when the flag is off.

### Phase 3 — restyle existing pages (optional, do last)
- `src/components/hackathon/hero.tsx` — `[edit]` restyle only.
- `src/components/workshop/Header.tsx` — `[edit]` restyle only.

### Not touched
`prisma/schema.prisma`, `auth.ts`, `auth.config.ts`, `src/components/ui/*`,
`src/app/ai-workshop/**`, `src/app/api/ai-workshop/**`.

## 4. Server vs Client

| Component | Type | Note |
|---|---|---|
| `app/page.tsx` | Server | `auth()` + redirects; reads `isClaudeEnabled()` |
| `LandingHub` | **Server** | fully static — keep it that way for mobile TTFB |
| `TrackCard` | **Server** | plain markup + exactly one `<Link>` wrapping the card; CTA is inert markup inside it |
| `app/challenges/page.tsx` | **Server** | reads `isClaudeEnabled()` |
| `DomainPicker` | **Client** | `useState` for selection |
| `FaqAccordion` | **Client** | open/close state |
| `StreakGrid` | Server | static preview, no state |
| `ThemeToggle` | Client | already exists, reuse as-is |
| `RegistrationForm` | **Client** | already client; gains `claudeEnabled: boolean` |

**Feature flags never cross into a Client Component as a function.**
`isClaudeEnabled()` is server-only (`process.env`). Call it in the Server
Component and pass the resolved **boolean** down: `LandingHub`, `DomainPicker`
and `RegistrationForm` each take `claudeEnabled: boolean`. A boolean crosses the
boundary safely; the function would not.

**Server→Client boundary:** `FaqAccordion` takes `items: { q: string; a: string }[]`
— plain strings only. `DomainPicker` takes `domains: { value: "SE"|"DS"|"AI";
label: string; blurb: string }[]`. **Do not pass lucide icon components or any
function into either.** Map the icon inside the client component from a string
key.

## 5. Steps

### Phase 0 — Bootcamp stays unauthenticated (DECIDED)

The AI Bootcamp remains **lead capture, not enrollment**: no sign-in, no
account, no dashboard. The CTA scrolls to the inline form, which posts to
`/api/ai-workshop/register` → Supabase, exactly as it does today.

**This requires no code change — it is already fully public.** Verified:

| Surface | Status |
|---|---|
| `/ai-workshop` | public — no `protectedPaths` prefix match |
| `/ai-workshop/events` | public |
| `/api/ai-workshop/register` | public — no session check in `route.ts` |
| `src/app/ai-workshop/**` | no `auth()`, `requireRole`, or `requireAdmin` calls |

The only action is a guardrail: **do not let this become protected.** See §6.

### Phase 1 — landing hub

1. **Regenerate both landing designs in Stitch first — they are unusable as-is.**
   - `ABTalks Mobile Landing Page` (`c3079acc47234bbfb858af1c0e27a1d6`) — `htmlCode` is **empty**; screenshot is a 286×512 thumbnail.
   - `ABTalks Desktop Landing Page` (`57f0a7697e9741cf9c6607b43aba7de2`) — `htmlCode` empty **and** `deviceType: MOBILE` at 768×1376, identical to the mobile screen. It is not a desktop design.
   - Regenerate both with `generate_screen_from_text`, desktop with `deviceType: DESKTOP`, and confirm `get_screen` returns a non-empty `htmlCode.downloadUrl` before writing any code.

2. **`src/app/page.tsx`** — delete these three lines:
   ```ts
   if (isClaudeEnabled()) {
     redirect("/claude-signup");
   }
   ```
   **Keep the `isClaudeEnabled` import** — it is still needed, just for a
   different purpose. Replace the redirect with:
   ```ts
   return <LandingHub claudeEnabled={isClaudeEnabled()} />;
   ```
   Leave the entire signed-in block above it untouched — profile →
   `/dashboard`, hackathon-registrant → `/hackathon/dashboard`, else
   `/register`.

   This is the whole "hub is the front door regardless of the flag" change: the
   flag now decides what the hub *renders*, not whether it renders.

3. **`landing-hub.tsx`** — build from the regenerated Stitch markup. Props:
   `{ claudeEnabled: boolean }`. Sections in order: header (wordmark,
   `ThemeToggle`, `Sign in` → `/login`); hero; track cards; stats strip;
   "How ABTalks works"; WhatsApp banner
   (`https://chat.whatsapp.com/LSru1BgvifpEB4OMZsaZEi`, from
   `community-slide.tsx`); footer.

   Render three `TrackCard`s always, plus a fourth **only** when
   `claudeEnabled`. Do not build a separate "Claude layout" — it is one
   conditional card appended to the same grid, so the three-card and four-card
   states share all markup.

4. **`track-card.tsx`** — props:
   ```ts
   {
     accent: "violet" | "indigo" | "orange";
     title: string;
     blurb: string;
     pill: string;
     chips: string[];
     href: string;      // the card's ONE destination
     ctaLabel: string;  // button TEXT ONLY — not a destination
   }
   ```
   Resolve `accent` to Tailwind classes via a lookup object **inside** the
   component.

   **Exactly one destination per card.** The whole card is a single `<Link>`;
   the CTA is styled markup *inside* that link, not its own link. Nesting an
   `<a>` inside an `<a>` is invalid HTML — it breaks screen readers, Cmd-click
   and middle-click. Do not reach for a stretched-pseudo-element workaround;
   there is no second destination to reach.

   | Card | `href` | `ctaLabel` | Shown |
   |---|---|---|---|
   | 60-Day Challenge | `/challenges` | "Start the challenge" | always |
   | Vibe Code Hackathon | `/hackathon` | "Register now" | always |
   | AI Bootcamp | `/ai-workshop` | "Save my seat" | always |
   | Claude Challenge | `/claude-signup` | "Join the Claude track" | **only when `claudeEnabled`** |

   The Claude card needs a fourth `accent`. Add `"amber"` to the union rather
   than reusing violet — it must not read as a duplicate of the 60-Day
   Challenge card sitting directly above it.

   `/claude-signup` already self-guards (`if (!isClaudeEnabled()) redirect("/")`),
   so a stale link is harmless — but the card must still be flag-gated, or the
   hub would advertise a track that bounces the user straight back.

   **No card links to a register route.** Registration is an action on the
   destination page, which is the whole point of building those pages:
   - `/challenges` → its own CTA → `/register?domain=<picked>` (Step 10)
   - `/hackathon` → existing CTA → `/hackathon/register`
   - `/ai-workshop` → existing in-page form, no auth
   - `/claude-signup` → existing CTA → `/register?domain=CLAUDE`

   `/register` and `/hackathon/register` are already in `protectedPaths`, so
   middleware handles the login bounce **from those pages**. Do not add auth
   checks anywhere on the landing hub — it is fully public.

5. Use `buttonVariants` directly on `<Link>` — never `<Button asChild>`.

6. **Preserve the query string on the login bounce — now REQUIRED.**

   `middleware.ts:94` is:
   ```ts
   url.searchParams.set("from", pathname);
   ```
   `pathname` excludes the query string, so a logged-out user hitting
   `/register?domain=AI` returns to a bare `/register` after sign-in and their
   domain choice is silently gone. Change to:
   ```ts
   url.searchParams.set("from", pathname + req.nextUrl.search);
   ```
   Stays edge-safe — `req.nextUrl` is `next/server`, no new import.

   This was optional in an earlier draft. It is **required now**, because
   `/challenges` deep-links the picked domain into `/register?domain=…`
   (Step 10) and most first-time visitors hit it logged out — the exact path
   where the parameter is lost.

   `resolveRedirectTo` in `login/page.tsx` and the `from` handling at
   `middleware.ts:99` already validate that `from` starts with a single `/`,
   which still holds for a path-plus-query string. **Do not loosen those
   checks** — they are what stops an open redirect.

### Phase 2 — `/challenges`

7. **The `/challenge` prefix — ALREADY APPLIED, do not redo.**

   `middleware.ts` now reads `"/challenge/"` with the trailing slash. Verify it
   is still there and move on. Recorded here so the reasoning is not lost:

   `pathname.startsWith("/challenge")` swallows **any** route beginning with
   those characters, including the plural:

   ```
   "/challenges".startsWith("/challenge")   // true  ← public page gets protected
   "/challenges".startsWith("/challenge/")  // false ← fixed
   "/challenge/today".startsWith("/challenge/")  // true  ← still protected
   "/challenge/12".startsWith("/challenge/")     // true  ← still protected
   ```

   Renaming the page alone does not escape it. Safe because there is no bare
   `/challenge` route (only `challenge/[day]` and `challenge/today`), so the
   trailing slash loses no coverage.

8. Build `app/challenges/page.tsx` from Stitch screen
   `13decdfccb194a0fa5d04aef8e298b5c` (780×5246, `htmlCode` present).
   Sections, in the design's order: hero → domain picker → "How a day works"
   → streak preview → "Finish and get discovered" → Community rules → FAQ →
   sticky CTA.

   The page is a Server Component: call `isClaudeEnabled()` here and pass the
   boolean into `DomainPicker`.

9. **Community rules copy is authoritative — copy it verbatim** from
   `src/components/landing/slides/rules-slide.tsx`:
   - Red card, `ShieldX`: *Foul Language or Harassment* — permanent ban.
   - Amber card, `AlertTriangle`: *Cheating or Platform Misuse* — 60-day challenge ban.

10. **`domain-picker.tsx`** — Client Component, props
    `{ claudeEnabled: boolean }`. Renders SE / DS / AI always, plus a fourth
    **Claude** card only when `claudeEnabled`. `useState` holds the selection;
    default `"SE"`.

    The primary CTA and the sticky mobile bar both link to
    `/register?domain=<selected>`. This is why Step 6 is required — logged-out
    visitors are the common case here, and without it the choice is lost.

11. **`src/app/register/page.tsx`** — stop forcing Claude. Replace:
    ```ts
    const initialDomain =
      claudeEnabled || params.domain === "CLAUDE" ? ("CLAUDE" as const) : undefined;
    ```
    with a preselect that honours any valid domain and only allows CLAUDE while
    the flag is on:
    ```ts
    const claudeEnabled = isClaudeEnabled();
    const requested = params.domain;
    const initialDomain =
      requested === "CLAUDE"
        ? (claudeEnabled ? "CLAUDE" : undefined)
        : requested === "SE" || requested === "DS" || requested === "AI"
          ? requested
          : undefined;
    ```
    Then at **line 105**, replace `forceClaudeDomain={claudeEnabled}` with
    `claudeEnabled={claudeEnabled}`. That single line is what currently hides
    the picker whenever the flag is on.

12. **`registration-form.tsx`** — the picker is never hidden now.

    **`domainCards` already contains all four domains.** CLAUDE is the first
    entry (`value: "CLAUDE"`, `featured: true`, `border-l-primary`) and the grid
    is already `lg:grid-cols-4`. **Do not add a CLAUDE entry — it exists.** The
    only defect is that `domainCardList` throws the whole list away when
    `forceClaudeDomain` is true.

    Swap the prop `forceClaudeDomain: boolean` for `claudeEnabled: boolean`,
    then unwind all nine usages:

    | Line | Now | Change to |
    |---|---|---|
    | 62 | `forceClaudeDomain: boolean;` | `claudeEnabled: boolean;` |
    | 108 | destructures `forceClaudeDomain` | destructures `claudeEnabled` |
    | 118–119 | `forceClaudeDomain ? [] : domainCards` | `claudeEnabled ? domainCards : domainCards.filter(c => c.value !== "CLAUDE")` |
    | 133 | `forceClaudeDomain ? "CLAUDE" : (initialDomain ?? "SE")` | `initialDomain ?? "SE"` |
    | 166–169 | `useEffect` pinning `domain` to `"CLAUDE"` | **delete the whole effect** |
    | 249 | `forceClaudeDomain \|\| values.domain === "CLAUDE"` | `values.domain === "CLAUDE"` |
    | 486 | ternary: Claude info card **instead of** the Domain section | see below |

    **Line 486 is the one that actually hides the picker.** Today it renders a
    "Claude AI Mastery Challenge" info card *in place of* the entire Domain
    block. Always render the Domain block; move the info card **below** the
    picker and show it only when the selected domain is `"CLAUDE"`. That keeps
    the Claude context for people who choose Claude without taking the choice
    away from anyone.

    That info card hardcodes `Synchronized June 1, 2026 start · 60 days` —
    **already in the past.** Either update the copy or drop the second line;
    do not ship a stale date onto a now-visible surface.

    Also widen `initialDomain` from `"CLAUDE"` to the full `RegistrationDomain`
    union.

    **Note the deliberate behavior change:** Claude signups currently land on a
    form with no choice. They will now see four options and can pick something
    else. That is the intent of this plan, but it is a live funnel — worth
    watching Claude conversion after deploy.

13. **`registration-actions.ts`** — add the server-side guard. `domainSchema`
    (`src/lib/validations/register.ts:11`) accepts `"CLAUDE"` unconditionally,
    so validation alone will not stop a crafted POST once the flag is off.
    After `parsed` succeeds and **before** `completeRegistration`:
    ```ts
    if (parsed.data.domain === "CLAUDE" && !isClaudeEnabled()) {
      return { ok: false as const, message: "That track is not open." };
    }
    ```
    Do **not** edit `domainSchema` — it is shared, and the enum is correct;
    availability is a runtime concern, not a shape concern.

### Phase 3 — restyle `/hackathon` and `/ai-workshop` (optional)

14. **The hackathon Stitch design is incomplete.** Screen
    `7763ad59551e4acd8a8c3d70b772805f` is 780×**1768** and contains only hero +
    two "Register now" buttons — no How-it-works, Timeline, Deliverables,
    Rules, Prizes, FAQ or team-code section. Compare with challenge (5246px)
    and bootcamp (4282px). Regenerate it in full before touching
    `src/components/hackathon/`.

15. Both pages already work. Restyle for visual consistency **only** — do not
    change `HACKATHON` config, `getMyRegistration`, the team-code flow, or the
    `/api/ai-workshop/register` contract.

### Working from the designs (applies to every phase)

**The MCP screenshots are thumbnails — do not implement from them.** The API
caps the longest side at 512px, so tall pages come back as slivers:

| Screen | Design size | Screenshot returned |
|---|---|---|
| 60-Day Challenge | 780×5246 | **77×512** |
| FREE AI Bootcamp | 780×4282 | **93×512** |
| Vibe Code Hackathon | 780×1768 | 226×512 |
| Mobile / Desktop Landing | 768×1376 | 286×512 |

A 5246px page rendered 77px wide has no legible text, spacing or color. If you
must work from images, **export them from the Stitch web UI at full
resolution** — the MCP screenshot endpoint cannot give you a usable one.

Otherwise use `htmlCode`, which exists for all three track pages (see
Appendix). Either way the values below are authoritative, because neither a
thumbnail nor eyedropping a PNG gives reliable hex or spacing.

**Stitch emitted a Material Design 3 palette, not the ABTalks brand palette.**
This is the single biggest trap in these files. All three pages carry a
generated Material token set:

| Stitch emitted | Where it came from | Use instead |
|---|---|---|
| `#d0bcff` primary (most-used color on the challenge page) | Material baseline purple | app `primary` token |
| `#111415` background | Material `surface` | `#0A0A0F` per the brief |
| `#e1e3e4` on-background | Material `on-surface` | app `foreground` token |
| `#4edea3` tertiary | Material tertiary | not part of the brand — drop |
| `on-surface-variant`, `surface-container-high`, `inverse-primary`, … | Material 3 role names | app tokens |

The **brand accents only partially landed**. Verified counts in the markup:
- **Bootcamp** — `#FF7A1A` (7×) and `#FF4D94` (5×). Correct, use as-is.
- **Hackathon** — `#7364E6` appears only 2×; the page is mostly Material purple.
  Restyle to the real hackathon palette already in `src/components/hackathon/`:
  `#7364E6`, `#968BEC`, borders `#403880`, fill `#030712`.
- **Challenge** — the intended violet `#8B5CF6` is **absent**; `#d0bcff` took
  its place. Use the app's existing `primary` token, not `#d0bcff`.

**Ignore these Stitch-only utility classes** — they are not in the app's
Tailwind config and will silently do nothing: `px-margin-mobile`,
`p-margin-mobile`, `text-label-sm`, `p-md`.

Geometry worth keeping (consistent across all three pages):
- Radii: `rounded-xl` / `rounded-2xl` for cards, `rounded-full` for pills.
- Card padding: `p-4` mobile, `p-6` on the bootcamp's larger cards.
- Type scale is arbitrary pixel values (`text-[11px]` … `text-[32px]`) — map to
  the app's existing scale rather than copying the pixel values.

Other prototype artifacts to strip:
- Loads **Tailwind via CDN** — the app compiles Tailwind. Drop the CDN script.
- Uses **Material Symbols Outlined** icons — the app uses `lucide-react`. Swap every icon.
- Pulls **Sora / Hanken Grotesk / Geist** — use the app's existing `font-display`
  and body fonts. Do not add font imports.

Treat the Stitch output as a **layout and hierarchy reference**. Take structure,
section order and proportion from it; take color, type and spacing from the app's
existing tokens.

## 6. Guardrails for Cursor (DO NOT)

- **DO NOT** add `requireRole` / `requireAdmin` to `/`, `/challenges`,
  `/hackathon`, `/ai-workshop`, `/login`, or the Auth.js handler. All are
  **public** surfaces.
- **DO NOT** import from `@/lib/*` in `middleware.ts` or anything it imports —
  1 MB Edge bundle limit. Only `next-auth` and `next/server`. The §5 Step 7 edit
  is a string literal inside the existing `protectedPaths` array — **do not add
  any import while you are in that file.**
- **DO NOT** add `/challenges` to `protectedPaths`. It is a public marketing
  page. The only `protectedPaths` change in this plan is the trailing slash on
  `/challenge/`.
- **DO NOT** protect the AI Bootcamp. `/ai-workshop`, `/ai-workshop/events` and
  `/api/ai-workshop/register` must stay public — no `protectedPaths` entry, no
  `auth()` call, no session check in the route handler. It is a no-account lead
  form by design (§5 Phase 0). If a build error tempts you to "fix" it by
  requiring a session, stop — that is the wrong fix.
- **DO NOT** delete Claude code, and **do not change `ENABLE_CLAUDE_CHALLENGE`**.
  Claude becomes a flag-gated fourth track, not a removal. `Domain.CLAUDE`,
  `/claude-signup`, `ClaudeChallengeModal`, `ClaudeEnrollmentBanner` and
  `ClaudeFAQ` all stay.
- **DO NOT** reintroduce any flag-based redirect on `/`. The hub renders in both
  flag states — that is the entire point of this revision. The flag may only
  decide *what the hub renders*, never *whether* it renders.
- **DO NOT** gate Claude in the UI only. The `registration-actions.ts` guard
  (Step 13) is required: `domainSchema` accepts `"CLAUDE"` unconditionally, so
  hiding the card does not stop a crafted POST from creating an enrollment and
  firing the welcome email.
- **DO NOT** edit `src/lib/validations/register.ts`. The enum is correct;
  availability is a runtime concern.
- **DO NOT** loosen the `from` validation in `login/page.tsx` or `middleware.ts`
  while making the Step 6 query-string change — those checks prevent an open
  redirect.
- **DO NOT** delete `onboarding-client.tsx` or `slides/` in this commit. Leave
  them unreferenced so `page.tsx` can be reverted in one line. Separate cleanup
  commit later.
- **DO NOT** paste Stitch HTML as-is, and **do not implement from the MCP
  screenshots** — they are 512px-capped thumbnails (the challenge page comes
  back 77px wide). See "Working from the designs" above.
- **DO NOT** carry over Stitch's Material Design 3 tokens — `#d0bcff`,
  `#111415`, `#e1e3e4`, `#4edea3`, or any `on-*` / `surface-container-*` role
  name. They are generator defaults, not ABTalks brand colors.
- **DO NOT** create new abstraction files beyond the four listed in §3.
- **DO NOT** use `<Button asChild>` or `<Button render={<Link>}>` — use
  `buttonVariants` on `<Link>`.
- **DO NOT** put a second `<Link>` or `<a>` inside `TrackCard`. The card is one
  link to one destination; `ctaLabel` is text. No nested anchors, no
  stretched-link workaround, no register routes on the landing hub.
- **DO NOT** pass icon components, functions, or class instances from a Server
  Component into `DomainPicker` or `FaqAccordion`.
- **DO NOT** touch `prisma/schema.prisma` — this plan has no schema change.
- **DO NOT** use `console.error`; use `lib/logger.ts`.
- **DO NOT** report done without confirming the files were written and
  `npm run build` passes.

## 7. DB safety

**No schema change, no migration, no seed.** Nothing in this plan writes to the
database.

**No env change either.** `ENABLE_CLAUDE_CHALLENGE` keeps whatever value
production currently has. This plan deliberately makes both states valid:

| Flag | Hub | `/challenges` picker | `/register` picker | `/claude-signup` |
|---|---|---|---|---|
| `true` | 4 cards | SE/DS/AI + Claude | SE/DS/AI + Claude | live |
| `false` | 3 cards | SE/DS/AI | SE/DS/AI | redirects to `/` |

Because routing no longer depends on the flag, flipping it is now a **content**
change, not a funnel change — it adds or removes a card and a domain option and
nothing else. Rollback in either direction is instant and needs no redeploy.

The one live-funnel consequence is in Step 12: Claude signups currently get a
form with no domain choice, and after this they see all four options. Existing
CLAUDE `Enrollment` rows are untouched either way.

## 8. Verification

Build/typecheck:
```
npm run build
```
Zero TS errors, zero `any`.

**Every flag-sensitive check below must be run twice — once with
`ENABLE_CLAUDE_CHALLENGE=true` and once with `false`.** Neither state is
"the" state; both ship.

Manual, logged out:
1. `/` renders the hub in **both** flag states, and never redirects to
   `/claude-signup`. This is the core of the change.
2. Flag `true` → hub shows **4** cards; flag `false` → **3**. The Claude card
   is the only difference; the other three are byte-identical.
3. Each card opens its overview page — `/challenges`, `/hackathon`,
   `/ai-workshop`, `/claude-signup`. No card goes straight to a register route,
   and no card triggers a login prompt.
4. `/challenges` loads **without** bouncing to `/login`. Verify explicitly, in a
   private window. If it redirects, the trailing slash on `/challenge/` is gone.
5. Still-protected, logged out: `/challenge/today` and `/challenge/1` **do**
   redirect to `/login`. The trailing-slash fix must not open them up.
6. `/ai-workshop` and `/ai-workshop/events` load logged out, and the
   registration form submits successfully with no session.
7. `/challenges` picker: flag `true` → 4 domains; flag `false` → 3, no Claude.
8. **The query-string round trip (Step 6).** Logged out, pick "AI" on
   `/challenges` → CTA → `/login?from=/register%3Fdomain%3DAI` → sign in →
   lands on `/register` with **AI preselected**. If it lands on a bare
   `/register` defaulting to SE, the `req.nextUrl.search` change is missing.
9. "Register now" (hackathon) → `/login?from=/hackathon/register`; after sign-in lands on `/hackathon/register`.
10. Bootcamp CTA scrolls to the form; submitting still returns 200 from `/api/ai-workshop/register`.

Manual, logged in:
11. User **with** profile → `/` still redirects to `/dashboard`.
12. User **without** profile but hackathon-registered → `/` still redirects to `/hackathon/dashboard`.
13. **`/register` shows all four domain cards with the flag ON, and every one
    of them is selectable.** Pick SE, submit, and confirm the enrollment is
    created with `domain: "SE"` — not CLAUDE. This is the single most important
    check in this plan; it is the regression that made the 60-Day Challenge
    funnel unreachable.
14. `/register` picker: flag `true` → 4 cards; flag `false` → 3, no Claude.
    No duplicate Claude card in either state (`domainCards` already had one).
15. `/register?domain=CLAUDE` with flag **off** → does *not* preselect Claude
    and does not offer it.
16. **Server guard (Step 13).** With the flag off, POST the register action with
    `domain=CLAUDE` directly (devtools, replay the form submit). It must be
    rejected — no `Enrollment` row, no Claude welcome email sent.
17. Existing **CLAUDE enrollee** → `/dashboard` renders their enrollment in both flag states.
18. `/claude-signup` with flag off → redirects to `/`.

Still protected, logged in as a normal student — regression check on the
middleware edits:
19. `/dashboard`, `/profile`, `/quiz`, `/register`, `/talent`,
    `/hackathon/dashboard` all still require auth.
20. An `?from=` value pointing off-site (`//evil.com`) is still rejected by
    `resolveRedirectTo` — the Step 6 change must not have opened a redirect.

Responsive: 375px wide, no horizontal scroll on any page.

Files changed should be exactly:
```
middleware.ts                                  (preserve query string in `from`)
src/app/page.tsx                               (drop redirect, pass claudeEnabled)
src/app/register/page.tsx                      (stop forcing CLAUDE)
src/app/register/registration-form.tsx         (forceClaudeDomain → claudeEnabled, 9 usages)
src/app/actions/registration-actions.ts        (server-side CLAUDE guard)
src/app/challenges/page.tsx                    [new]
src/components/landing/landing-hub.tsx         [new]
src/components/landing/track-card.tsx          [new]
src/components/challenges/domain-picker.tsx    [new]
src/components/challenges/streak-grid.tsx      [new]
src/components/shared/faq-accordion.tsx        [new]
```
Nothing under `src/app/ai-workshop/`, `src/app/api/ai-workshop/`, or
`src/lib/validations/register.ts` should appear in the diff.

## 9. Commit message

```
feat(landing): make the landing hub the front door in all flag states

Add a public landing hub at / offering the 60-Day Challenge, Vibe Code
Hackathon and AI Bootcamp, plus a new public /challenges overview page.
The hub now renders regardless of ENABLE_CLAUDE_CHALLENGE — the flag no
longer redirects / to /claude-signup.

Claude becomes a flag-gated fourth track rather than the default entry
point: a fourth hub card, a fourth domain on /challenges, and a fourth
card in the /register picker, all shown only while the flag is on.

Stop /register from forcing domain=CLAUDE and hiding the SE/DS/AI picker
whenever the flag is on — that made the 60-Day Challenge funnel
unreachable. Add a server-side guard in registration-actions so a
CLAUDE domain is rejected when the flag is off; domainSchema accepts it
unconditionally, so UI gating alone was not enough.

Preserve the query string on the login bounce so /register?domain=AI
survives sign-in.

The AI Bootcamp stays unauthenticated — a no-account lead form, fully
public. No schema changes, no env changes.
```

## Appendix — Stitch access for Cursor

Project `11022296872016044091`. MCP server `stitch` is configured at local
scope in `~/.claude.json`; the endpoint is stateless, so
`get_screen { projectId, screenId }` is a single call. `list_screens` omits
`htmlCode` — you must call `get_screen` per screen to get the download URL,
then `curl -L` it.

| Screen | ID | Size | `htmlCode` | Screenshot |
|---|---|---|---|---|
| Mobile Landing | `c3079acc47234bbfb858af1c0e27a1d6` | 768×1376 | **empty — regenerate** | 286×512 |
| Desktop Landing | `57f0a7697e9741cf9c6607b43aba7de2` | 768×1376 | **empty + wrong deviceType — regenerate** | 286×512 |
| 60-Day Challenge | `13decdfccb194a0fa5d04aef8e298b5c` | 780×5246 | yes | **77×512 — unusable** |
| Vibe Code Hackathon | `7763ad59551e4acd8a8c3d70b772805f` | 780×1768 | yes, but **hero only — incomplete** | 226×512 |
| FREE AI Bootcamp | `b8f9a78703f64f48a9bca0d306a57b48` | 780×4282 | yes | **93×512 — unusable** |

Both `htmlCode.downloadUrl` and `screenshot.downloadUrl` are short-lived —
re-fetch via `get_screen` rather than reusing a saved link.

The screenshot endpoint caps the longest side at 512px and cannot be asked for
more. **Full-resolution images must be exported from the Stitch web UI by hand.**
