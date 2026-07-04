# 020 — Dashboard first-visit walkthrough (Jobs + Synergy guide)

## 1. Goal
Show a one-time interactive tooltip walkthrough when a user first lands on the
dashboard, spotlighting the **Synergy chip** (header) and the **Jobs button**
(desktop header nav + mobile bottom nav) so new users understand what they are.
Uses `localStorage` — no schema or migration needed.

## 2. Current behavior
No walkthrough exists. Users land on the dashboard with no guidance on what the
Synergy chip or Jobs button are/do. `SynergyChip` lives in `AppHeader`
(`src/components/shared/synergy-chip.tsx`) and the Jobs link is in
`AppHeader`'s desktop nav (`src/components/shared/app-header.tsx:124`) and
`BottomNav` (`src/components/shared/bottom-nav.tsx`, index 1).

## 3. Files to touch
- `[new]` `src/components/dashboard/dashboard-walkthrough.tsx` — Client
  Component. Manages step state, localStorage check, spotlight positioning,
  and tooltip rendering.
- `[edit]` `src/app/dashboard/page.tsx` — add `<DashboardWalkthrough />` just
  before the closing `</div>` of the main return (no props; everything is
  self-contained client-side).

## 4. Server vs Client
- `dashboard-walkthrough.tsx` — **Client Component** (`"use client"`). Reads
  `localStorage`, uses `useEffect` + `getBoundingClientRect()` + `useState`.
  No functions, icons, or class instances passed from the server — `page.tsx`
  just renders `<DashboardWalkthrough />` with no props.
- `page.tsx` — **Server Component** (unchanged). Only adds one JSX element.

## 5. Steps

### Step 1 — Create `src/components/dashboard/dashboard-walkthrough.tsx`

The component:
- On mount (`useEffect`), checks `localStorage.getItem("abtalks_tour_done")`.
  If set, renders nothing. If not set, starts the walkthrough.
- Two steps:
  - **Step 0 — Synergy**: Target element found via
    `document.querySelector('[aria-label="View your synergy and open rewards"]')`.
    Tooltip text: "⚡ Synergy points — earn them by completing daily challenges
    and redeem rewards in the Marketplace."
  - **Step 1 — Jobs**: Target element found via
    `document.querySelector('[href="/jobs"]')`. On mobile (bottom nav visible)
    this hits the bottom nav item; on desktop it hits the header nav link.
    Tooltip text: "💼 Jobs — browse opportunities and get discovered by
    recruiters after finishing the challenge."
- Spotlight implementation:
  - A `fixed inset-0 z-50` overlay div with `bg-black/50 pointer-events-auto`.
  - A transparent "cutout" punched through using `clip-path: path(...)` or
    simpler: four absolutely-positioned dark panels (top/bottom/left/right)
    around a measured `DOMRect` gap — this avoids SVG complexity and works in
    all browsers.
  - The target element's rect is measured with `getBoundingClientRect()` and
    refreshed on window resize.
- Tooltip card (white, rounded-2xl, shadow-lg, `max-w-xs`) absolutely
  positioned below or above the spotlight rect depending on available space.
  Contains: title, description, step indicator ("1 of 2"), "Next" / "Got it"
  (last step) button, and a "Skip" text link.
- On "Next": increment step, re-measure new target.
- On "Got it" / "Skip": set `localStorage.setItem("abtalks_tour_done", "1")`,
  unmount (set `done` state to true).
- Re-measure on `resize` event (debounced ~100ms).
- Renders `null` until mount (avoids SSR mismatch since it reads localStorage).

Component skeleton (executor fills in):
```tsx
"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const STEPS = [
  {
    selector: '[aria-label="View your synergy and open rewards"]',
    title: "⚡ Synergy Points",
    body: "Earn Synergy by completing daily challenges. Redeem them for rewards in the Marketplace.",
  },
  {
    selector: '[href="/jobs"]',
    title: "💼 Jobs Board",
    body: "Browse opportunities and get discovered by recruiters once you finish the challenge.",
  },
];

const TOUR_KEY = "abtalks_tour_done";

export function DashboardWalkthrough() {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const [done, setDone] = useState(false);

  // ... measure, resize, skip/next/finish handlers
  // ... render: null until mounted, null if done,
  //     otherwise overlay + four panels + tooltip card
}
```

### Step 2 — Edit `src/app/dashboard/page.tsx`
In the main (active) return's top-level `<div>`, add after the existing modals/banners:
```tsx
import { DashboardWalkthrough } from "@/components/dashboard/dashboard-walkthrough";
...
<DashboardWalkthrough />
```
Only add it once, in the main non-ABANDONED, non-isPreStart return path (the
third/final return at line 303) — the one users actually see day-to-day.

## 6. Guardrails for Cursor (DO NOT)
- Do NOT add a DB column or Prisma migration — `localStorage` is sufficient.
- Do NOT target elements by className (they change); target by `aria-label` or
  `href` attribute selectors which are stable.
- Do NOT use `useLayoutEffect` without a mounted guard — it causes SSR errors.
  Use `useEffect` for the mount check; `useLayoutEffect` is fine only inside
  the body of effects that already know they're client-side.
- Do NOT block clicks on the spotlight target — the user should be able to
  click the highlighted element while the tooltip is open (pointer-events on the
  cutout panels must be none over the target area, or just skip pointer-events
  blocking entirely so the user can interact naturally).
- Do NOT render walkthrough inside the ABANDONED or isPreStart returns — only
  the main active-dashboard return.
- Do NOT add new abstraction files. Everything for this feature stays in
  `dashboard-walkthrough.tsx`.

## 7. DB safety
None — no schema or data changes.

## 8. Verification
- Clear `localStorage` (DevTools → Application → Local Storage → delete
  `abtalks_tour_done`), reload `/dashboard` → walkthrough appears.
- Step 1 spotlight is positioned over the Synergy chip in the header.
- Clicking "Next" moves to step 2, spotlight moves to the Jobs link.
- Clicking "Got it" dismisses. Reload → walkthrough does NOT reappear.
- Clicking "Skip" on step 1 → dismisses immediately. Reload → does NOT reappear.
- Resize browser window while walkthrough is open → spotlight re-positions.
- On mobile (or Chrome DevTools mobile emulation) → spotlight on step 2 targets
  the bottom nav Jobs item, not the header.
- `npm run build` and `npx tsc --noEmit` pass.
- Files changed: `src/components/dashboard/dashboard-walkthrough.tsx` (new),
  `src/app/dashboard/page.tsx` (one import + one JSX line).

## 9. Commit message
```
feat(dashboard): add first-visit walkthrough for Synergy and Jobs buttons
```
