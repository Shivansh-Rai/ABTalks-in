# 168 — Platform-wide navigation loading feedback

## 1. Goal

Make every in-app navigation visibly acknowledge the click within ~150 ms, so a
recruiter clicking a Hire tab never wonders whether the app registered them.
Fix it once at the shell level so all 160 pages benefit, not just `/hire`.

## 2. Current behavior

The symptom is real and it has **two compounding causes**, not one.

**(a) There is no Suspense boundary for navigation.** The App Router keeps the
*old* page mounted and interactive until the entire RSC payload for the new
route resolves. With no `loading.tsx`, there is nothing to swap in, so the
screen is frozen on the previous tab — indistinguishable from a dead click.

Counted on master:

| | count |
|---|---|
| `page.tsx` under `src/app` | 160 |
| `loading.tsx` under `src/app` | **1** (`src/app/hire/credits/loading.tsx`) |
| files using `Suspense` | 6 (all under `src/app/admin`) |
| navs with any pending state | **0** |

`src/components/hire/hire-sidebar.tsx` renders 15 bare `<Link>`s with nothing
but a `usePathname()` comparison for `is-current`. `dashboard-sidebar.tsx`,
`admin-sidebar.tsx`, `bottom-nav.tsx` and `program-nav.tsx` are the same shape.
There is no progress bar, no spinner, no `aria-busy`, and no dependency such as
nprogress. The platform has no navigation-feedback primitive at all.

**(b) The missing `loading.tsx` also silently disabled prefetching.** From
`node_modules/next/dist/client/link.d.ts` on the pinned Next 16.2.4:

> `"auto"`, null, undefined (default): For statically generated pages, this will
> prefetch the full React Server Component data. For dynamic pages, this will
> prefetch up to the nearest route segment with a `loading.js` file. **If there
> is no loading file, it will not fetch the full tree to avoid fetching too
> much data.**

Every authenticated route is dynamic (`auth()` in the layout). So on 159 of 160
pages the default prefetch resolves to *nothing*: each tab click is a cold
server round trip to Vercel + Neon. The navigation is not merely unlabelled, it
is genuinely slow, and the absent `loading.tsx` is what makes it slow.

This is why the fix below is worth more than a cosmetic spinner: adding the
loading files restores prefetching as a side effect.

Relevant versions (verified in `package.json` / `node_modules`): Next 16.2.4,
React 19.2.4. Both `useLinkStatus` and `<Link onNavigate>` are available and
exported from `next/link`. `src/components/ui/skeleton.tsx` already exists.

## 3. Recommended solution — three layers

Layered on purpose: each layer ships independently and the earlier ones are the
cheapest per route covered.

| Layer | What | Routes covered | Files |
|---|---|---|---|
| **1. Global route progress bar** | Top-of-viewport bar, starts on any internal anchor click, clears on pathname change | **all 160**, no per-route edits | 2 new + 1 edit |
| **2. Segment `loading.tsx`** | Skeleton per section; also re-enables prefetch | ~all authenticated routes | ~8 new |
| **3. `useLinkStatus` on nav items** | Spinner on *the row you clicked* | nav components | 1 new + per-nav edits |

Layer 1 is the answer to "is this loading?". Layer 2 is the answer to "why is
it so slow?". Layer 3 is the answer to "which tab did I click?". Ship 1 and 2;
3 is a refinement for the sidebars.

**Explicitly rejected: disabling the nav while pending.** Repeated clicks on the
same `<Link>` are already idempotent in the App Router — they are not causing
damage. Blocking input makes a slow app feel broken instead of slow. Feedback,
not blocking.

## 4. Files to touch

### Layer 1 — global progress bar
- `src/components/shared/route-progress.tsx` `[new]` — client component; the
  whole mechanism.
- `src/app/globals.css` `[edit]` — bar keyframes + reduced-motion branch.
- `src/app/layout.tsx` `[edit]` — mount `<RouteProgress />` once in `<body>`.

### Layer 2 — segment loading files (one per section, covers all descendants)
- `src/app/hire/loading.tsx` `[new]` — covers all 18 `/hire/*` routes. **Owner: @zainabshujat.**
- `src/app/dashboard/loading.tsx` `[new]`
- `src/app/admin/loading.tsx` `[new]`
- `src/app/program/loading.tsx` `[new]`
- `src/app/talent/loading.tsx` `[new]` — **Owner: @shashank-mishra08.**
- `src/app/jobs/loading.tsx` `[new]` — **Owner: Manuvrtti.**
- `src/app/settings/loading.tsx` `[new]`
- `src/app/profile/loading.tsx` `[new]` — **Owner: Shivansh.**
- `src/components/shared/page-skeleton.tsx` `[new]` — one shared skeleton the
  above import, so eight files stay three lines each.

### Layer 3 — per-link pending state
- `src/components/shared/nav-link.tsx` `[new]` — `<NavLink>` wrapping `<Link>`
  + a `useLinkStatus()` child.
- `src/components/hire/hire-sidebar.tsx` `[edit]` — swap `<Link>` → `<NavLink>`
  on the 15 section rows. **Owner: @zainabshujat.**
- `src/app/hire/hire-scout.css` `[edit]` — `:has()` rule for the pending row.
- `.github/CODEOWNERS` `[edit]` — add the new shared shell paths under Sohail.

## 5. Server vs Client

| File | Boundary | Notes |
|---|---|---|
| `route-progress.tsx` | **Client** | needs `usePathname` + DOM listeners |
| `nav-link.tsx` | **Client** | `useLinkStatus` is client-only |
| `page-skeleton.tsx` | **Server** (no directive) | pure markup, no state |
| all `loading.tsx` | **Server** | must stay server — they render before hydration |
| `src/app/layout.tsx` | **Server** | unchanged; just renders the client child |

**No Server→Client prop passing is introduced.** `<RouteProgress />` takes no
props. `<NavLink>` takes only `href` (string) and `className` (string) — the
Lucide icons already passed into the sidebar rows stay *inside* the existing
client component, so no icon crosses the boundary.

## 6. Steps

### Step 1 — `src/components/shared/route-progress.tsx` [new]

Client component. No props. Behaviour:

1. State: `const [active, setActive] = useState(false)`.
2. **Start signal** — a `click` listener on `document` in the **capture** phase,
   registered once in a `useEffect`. Begin only when all hold:
   - `event.button === 0`, and none of `metaKey / ctrlKey / shiftKey / altKey`
   - `!event.defaultPrevented`
   - `event.target.closest("a[href]")` returns an anchor
   - the anchor has no `target` other than `_self`, no `download` attribute,
     and no `data-no-progress` attribute (the opt-out hook)
   - `new URL(a.href, location.href).origin === location.origin`
   - the resolved `pathname + search` differs from the current one (so hash
     links and re-clicks on the current tab do not start the bar)
3. **Back/forward** — also start on `window.addEventListener("popstate", …)`.
4. **Stop signal** — a `useEffect` keyed on `usePathname()` that calls
   `setActive(false)`. The new pathname only commits once the RSC payload has
   arrived, which is exactly the moment the bar should finish.
5. **Anti-flicker** — do not paint for the first **150 ms**. Hold the start in a
   `setTimeout` ref; if the pathname changes first, clear it and never paint.
6. **Safety timeout** — force `setActive(false)` after **10 s**. A cancelled or
   failed navigation must never strand the bar on screen. Clear both timers in
   the effect cleanup.
7. **Render** — when inactive, return `null`. When active:
   - `<div className="route-progress" aria-hidden="true" />` — the visual bar,
     `position: fixed; top: 0; left: 0; height: 3px; z-index: 100`.
   - plus a sibling `<span role="status" className="sr-only">Loading page</span>`
     so screen readers get one polite announcement and the bar itself stays out
     of the a11y tree.

### Step 2 — `src/app/globals.css` [edit]

Add `.route-progress` with a brand-coloured background and an
`animation: route-progress-grow 10s cubic-bezier(0.1, 0.9, 0.2, 1) forwards`
keyframe that runs `width` 0% → 90% and holds. Completion is the unmount, not a
100% frame — that is what makes it feel snappy. Inside
`@media (prefers-reduced-motion: reduce)`, drop the animation and render a
static full-width bar at reduced opacity instead.

### Step 3 — `src/app/layout.tsx` [edit]

Import and render `<RouteProgress />` as the **first** child of `<body>`,
outside `ThemeProvider` and outside `MainShell`, so no provider re-render and no
`main` overflow rule can affect it.

### Step 4 — `src/components/shared/page-skeleton.tsx` [new]

Server component, props `{ rows?: number }` (default 6). Renders an
`aria-busy="true"` wrapper containing a `role="status"` `sr-only` "Loading"
label, a title-width `<Skeleton className="h-8 w-48" />`, and `rows` body
`<Skeleton className="h-20 w-full" />` blocks. Import `Skeleton` from
`@/components/ui/skeleton` — do **not** write new skeleton CSS.

### Step 5 — the eight `loading.tsx` files [new]

Each is three lines:

```tsx
import { PageSkeleton } from "@/components/shared/page-skeleton";

export default function Loading() {
  return <PageSkeleton />;
}
```

A `loading.tsx` at a segment covers that segment **and every descendant that
lacks its own**, which is why eight files reach nearly the whole authenticated
surface. `src/app/hire/credits/loading.tsx` already exists and keeps winning for
its own route — leave it alone.

**Known limit, stated honestly:** a `loading.tsx` at `/hire` renders *inside*
`src/app/hire/layout.tsx`, so on a **first** entry to `/hire` the layout's own
six sequential awaits still block before the skeleton can appear. Layer 1's bar
covers that window. Tab-to-tab navigation within `/hire` does not re-run the
layout, so the skeleton appears immediately there — which is the reported case.
Do **not** add a root `src/app/loading.tsx` to chase the first-entry gap; it
would blank the entire app shell on every top-level navigation.

### Step 6 — `src/components/shared/nav-link.tsx` [new]

```tsx
"use client";
import Link, { useLinkStatus } from "next/link";
```

`useLinkStatus()` must be called in a **descendant** of `<Link>`, never in the
same component that renders it. So: a tiny `NavLinkPending` component calls the
hook and returns `null` when not pending, or
`<span className="nav-pending" aria-hidden="true" />` when pending. `<NavLink>`
renders `<Link {...props}>{children}<NavLinkPending /></Link>`.

### Step 7 — `src/components/hire/hire-sidebar.tsx` [edit]

Swap `<Link>` → `<NavLink>` on the 15 section rows only. Leave the two
non-navigation uses alone: the `/contact` row and the `render={<Link …>}` at
line 744. Keep every existing `className`, `aria-current` and `cn(...)` call
exactly as-is — this edit adds a child, it does not restyle the sidebar.

### Step 8 — `src/app/hire/hire-scout.css` [edit]

```css
.hire-side__item:has(.nav-pending) { opacity: 0.7; }
.hire-side__item:has(.nav-pending)::after { /* 12px spinner, margin-inline-start: auto */ }
```

### Step 9 — `.github/CODEOWNERS` [edit]

Append under a Shared Architecture section owned by Sohail:
`/src/components/shared/route-progress.tsx`,
`/src/components/shared/nav-link.tsx`,
`/src/components/shared/page-skeleton.tsx`.

## 7. Guardrails for Cursor (DO NOT)

- **DO NOT call `useSearchParams()` in `route-progress.tsx`.** It mounts in the
  root layout; `useSearchParams` in a client component with no Suspense parent
  forces a client-side-rendering bail-out on **every** statically generated
  page — `/`, `/privacy`, `/terms`, `/cookies` would stop being static. Use
  `usePathname()` only and let the 10 s safety timeout handle the rare
  search-param-only navigation. If a build warning about `useSearchParams`
  appears, the hook was added — remove it, do not wrap the root layout in
  Suspense to silence it.
- **DO NOT add an npm dependency** (`nprogress`, `@bprogress/next`,
  `next-nprogress-bar`). The component is ~70 lines and the project ships none
  of these today.
- **DO NOT** call `useLinkStatus()` in the component that renders `<Link>`. It
  returns the status of the nearest `<Link>` **ancestor**; called as a sibling
  it is permanently `pending: false`. This will look like it "just doesn't
  work" — the cause is the call site, not the hook.
- **DO NOT** disable, `pointer-events: none`, or `aria-disabled` the nav links
  while pending. See §3.
- **DO NOT** convert `src/app/layout.tsx`, any `loading.tsx`, or
  `page-skeleton.tsx` to `"use client"`.
- **DO NOT** add `prefetch={true}` anywhere. Once `loading.tsx` exists, the
  default `"auto"` prefetches the cheap static shell. Forcing `true` pulls the
  full dynamic tree for every visible link — on a 15-row sidebar that is 15 cold
  Neon queries on mount, on free-tier hosting.
- **DO NOT** touch `src/features/notification/**` or any locked notification
  path. `notification-bell-button.tsx` renders in headers near this work — leave
  it untouched.
- **DO NOT** restyle, re-order, or "tidy" the sidebars. Step 7 adds one child
  element per row and changes nothing else.
- **DO NOT** add `loading.tsx` under `src/app/api/**`.
- **DO NOT** start the bar for hash-only links, external links, `target=_blank`,
  `download`, or modifier-clicks — each one paints a bar for a navigation that
  never happens, and it will then sit there for the full 10 s.

## 8. DB safety

Not applicable — no schema, migration, or data change.

## 9. Verification

**Build / static-rendering guard**

```bash
npm run build
```

Must pass, and the route table must still show `/`, `/privacy`, `/terms` and
`/cookies` as static (`○`). If any flipped to dynamic (`ƒ`), the
`useSearchParams` guardrail was violated.

```bash
npx tsc --noEmit && npm run lint
```

**Manual, in the browser (this is the part that actually proves it):**

1. `npm run dev`, sign in as a recruiter, open `/hire`.
2. DevTools → Network → throttle to **Slow 4G**. The bug is invisible on
   localhost without this.
3. Click through Jobs → Pipeline → Analytics → Messages. For each: the bar must
   appear at the top within ~150 ms, the skeleton must replace the page body,
   and the bar must disappear exactly when content paints.
4. Click the **currently active** tab — nothing should happen, no bar.
5. Click an external link and a `mailto:` — no bar.
6. Browser **back** and **forward** — bar appears.
7. Fast navigation on a warm route — the bar must *not* flash (the 150 ms delay).
8. OS "reduce motion" on — bar still visible, not animating.
9. Repeat 3 on `/dashboard` and `/admin`.

**Files that should have changed:** exactly the 13 listed in §4 — 6 new shared/
skeleton files, 8 new `loading.tsx` (one pre-existing untouched), and 5 edits
(`layout.tsx`, `globals.css`, `hire-sidebar.tsx`, `hire-scout.css`,
`CODEOWNERS`). Nothing under `src/features/`, `src/repositories/`, `prisma/`,
or any notification path.

## 10. Commit message

```
feat(shell): platform-wide navigation loading feedback

Navigations gave no indication they had started: with 1 loading.tsx across
160 pages the App Router held the old page on screen until the full RSC
payload resolved, so a tab click looked dead and users clicked repeatedly.

The missing loading files also disabled prefetching — Next's default
prefetch="auto" skips dynamic routes that have no loading boundary — so the
navigations were genuinely cold round trips, not just unlabelled ones.

- RouteProgress: top bar on any internal navigation, 150ms anti-flicker
  delay, 10s safety timeout, cleared on pathname commit. Mounted once in the
  root layout, covers all routes with no per-route changes.
- Segment loading.tsx for hire/dashboard/admin/program/talent/jobs/settings/
  profile over a shared PageSkeleton; each covers its descendants and
  restores shell prefetching.
- NavLink + useLinkStatus marks the specific sidebar row that was clicked.

No schema changes. Links stay interactive while pending — feedback, not
blocking.
```
