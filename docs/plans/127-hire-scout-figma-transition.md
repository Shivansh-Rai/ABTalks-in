# 127 — Hire: Figma Scout screens + search transition

Status: drafted 2026-09-11. Source of truth for visuals: Figma
`WsqYYevAiHtqH50SOaoPlh` node `1570-438` (frames "Recruiter Dashboard -
Responsive", "Recruiter Dashboard", "Mobile recruiter sear…").

## 1. Goal
Make `/hire` look and behave like the Figma Scout design: a green hero search
state, a light results state, and ONE continuous shared-element transition
between them, without touching search actions, ranking, candidate data, agent
behaviour, filtering or auth.

## 2. Current behavior
`src/components/hire/scout-chat.tsx` renders one client component for both
`/hire` and `/hire/[requestId]`: a "Scout" bar, a message thread with chips,
match cards pinned inline at `resultsPin`, a bottom composer and the
9-item `.scout-criteria` tick strip. There is no hero state, no green→light
background change, no sidebar, and `resetDesk()` navigates (`router.push`)
when a `requestId` exists. Styling lives in `src/app/hire/hire-scout.css`.

## 3. The two states
- **State A (hero / "Recruiter Dashboard - Responsive", 1956×870)** — full-bleed
  green radial gradient; `AB TALKS` wordmark top-left, `Sign in` pill top-right;
  centered heading `WHO ARE YOU LOOKING FOR?`; a translucent glass card holding
  a white pill input (`Type here....`) with a dark-teal `Search` button to its
  right; under it the criteria row `✓ Location ✓ Years of Experience ✓ Role
  ✓ Education Qualification ✓ Skills`; below the card, left-aligned example
  query lines — the active one bright with a `→` marker, neighbours fading out.
- **State B (results / "Recruiter Dashboard")** — light grey page; left sidebar
  (Home, Projects, Analytics, Current Project + `+ Create New Project`, Support,
  `Upgrade →`, account row); header (Save for Later, Shortlist, Sign in);
  `Filters` control; candidate cards (avatar, Full Name + `Top match` pill,
  Location / Work Mode / Years of Experience / Highest Education meta row,
  Skills chips, `AI Summary` teal pill + tinted rationale box, `View More
  Details ⌄` + `Add to Shortlist`, `Shortlist` checkbox top-right); the search
  bar pinned at the bottom of the results column with the criteria row under it.
- **Mobile A** — heading on two lines; the glass card stacks input above a
  full-width `Search` button; criteria row wraps to two lines.
- **Mobile B** — no frame exists in the file; derive responsively from State B
  (sidebar off-canvas behind a trigger, cards full width, bar stays bottom).

## 4. Transitions
- **Search click (A→B)** — one timeline, ~700ms: hero heading + example lines
  leave (opacity/translate, ease-in); the SAME search element translates from
  hero centre to bottom-pinned (FLIP, transform only); page background
  cross-fades green→light on the same curve; sidebar + cards enter after the
  bar lands (ease-out, staggered).
- **New search** — stays in State B. Thread and cards clear, composer empties
  and focuses. No bar movement, no background change. New chat, same project.
- **New project** — the A→B timeline reversed, then a cleared State A.
- `prefers-reduced-motion` — no travel, no stagger; instant state swap.

## 5. Steps
1. `hire-scout.css` — add `--hire-stage` background tokens (green / light) on a
   stage wrapper, plus the hero, glass-card, example-line, sidebar and card
   styles from Figma. Guard everything behind the stage state class.
2. `scout-chat.tsx` — add a `stage` state (`"hero" | "results"`) derived from
   the existing `searched` flag; render hero chrome only in `hero`, sidebar only
   in `results`. Do NOT touch `send`/`runSearch` internals.
3. Extract the search field + button into `hire-search-bar.tsx` rendered ONCE,
   positioned by the stage class, so it is never unmounted across the change.
4. `hire-stage-transition.ts` — FLIP helper: measure the bar before the stage
   flips, measure after, apply the inverse transform, play it out.
5. Scroll-linked example lines: one IntersectionObserver/scroll handler mapping
   scroll offset to an active index; transform + opacity only.
6. `resetDesk()` split into `newSearch()` (in-place thread clear, no navigation)
   and `newProject()` (reverse timeline + full clear).
7. Mobile: breakpoint rules for the stacked hero card and off-canvas sidebar.

## 6. Guardrails for Cursor (DO NOT)
- Do not touch `hire-actions.ts`, `hire-guest-actions.ts`,
  `talent-project-actions.ts`, ranking, or any repository/feature module.
- Do not unmount and re-mount the search input across the stage change.
- Do not animate layout properties (top/left/width/height) — transform only.
- Do not add a route for State B; both states are the same page.
- No new abstraction files beyond the two listed in steps 3 and 4.
- Keep `buttonVariants` on `<Link>`; no `<Button asChild>`.

## 7. DB safety
None — no schema or data changes.

## 8. Verification
`npm run build` clean; `/hire` in the browser at desktop and 375px: hero renders,
Search plays the single timeline, New search resets in place, New project
returns to hero, reduced-motion collapses the animation. Changed files: the two
new files above, `scout-chat.tsx`, `hire-scout.css`.

## 9. Commit message
`feat(hire): Figma Scout hero + shared-element search transition`
