# 183 — Smooth stage switcher transitions

## 1. Goal
Make switching between **Build skills**, **Test skills**, and **Get hired**
feel continuous: the white active card should move/settle smoothly, text/icon
contrast should ease, and the panel below should fade instead of hard-cut.
The road pin already hops along the curve — leave that path alone.

## 2. Current behavior
- `stage-switcher.tsx` toggles active tab Tailwind classes with a partial CSS
  transition (`background-color, box-shadow, transform` only) — text/icon
  colors snap.
- Panels use `hidden={s.key !== selected}` — instant cut, no fade.
- Pin hop animation already runs in `StageRoad` (raf hops); keep it.
- No `framer-motion` usage under `dashboard-hub/` yet; tokens live in
  `src/lib/motion.ts` (`DUR.slow` / `EASE_SPARK`, `useSafeReducedMotion`).

## 3. Files to touch
- `docs/plans/183-stage-switcher-motion.md` **[new]** — this plan.
- `src/components/dashboard-hub/stages/stage-switcher.tsx` **[edit]** —
  `LayoutGroup` + active `layoutId` pill; panel `AnimatePresence`; wire
  `useSafeReducedMotion`.
- `src/components/dashboard-hub/stages/stages.css` **[edit]** — only if a
  tiny reduced-motion or pill helper is cleaner in CSS than Tailwind; prefer
  Tailwind/framer in the TSX. No new design tokens.

Not touched: pin hop math, profile-ready gate, panel content components,
middleware, schema.

## 4. Server vs Client
`StageSwitcher` is already `"use client"`. Panels remain ReactNode props from
the server page — no new Server→Client function/icon props.

## 5. Steps
1. Write this plan file.
2. Import `LayoutGroup`, `motion`, `AnimatePresence` from `framer-motion` and
   `DUR` / `EASE_SPARK` / `useSafeReducedMotion` from `@/lib/motion`.
3. Tab buttons: `relative`; when `active`, render absolute inset `motion.span`
   with `layoutId="stage-active-pill"` (rounded-2xl, white frosted styles
   currently on the active button). Idle tabs keep the teal glass background.
   Content `relative z-10`.
4. Broaden content transitions so number/title/meta/icon shell colors ease
   (`transition-colors duration-200` with spark ease).
5. Panels: keep all three mounted (required for in-panel hash targets and to
   avoid rendering the same `panels[key]` ReactNode twice). Wrap each in
   `motion.div` with opacity/y easing to the selected state (`DUR.slow` /
   `EASE_SPARK`). Inactive stay `hidden`. Preserve `id`, `role="tabpanel"`,
   `aria-labelledby`, `data-stage-panel`, `scroll-mt-24 pt-10`.
6. Verify desktop + mobile: click each stage, hash `#test-skills` /
   `#get-hired`, profile-not-ready nudge still works, pin still hops when ready.

## 6. Guardrails for Cursor (DO NOT)
- Do not change profile-ready / 70% gate or pin-stuck bubble logic.
- Do not add a new motion library or invent spring curves outside
  `src/lib/motion.ts`.
- Do not restyle the whole dashboard; motion + minimal class cleanup only.
- Do not edit `CLAUDE.md` / `docs/project-context.md` / Neon.
- No CHANGELOG line (cosmetic motion only).

## 7. Verification
- Manual: click 01→02→03; pill slides; panel fades; pin hops when
  `profileReady`.
- `prefers-reduced-motion: reduce`: no layout slide / no panel y; switch
  still works.
- `npx tsc --noEmit`.

## 8. Commit message
`feat(dashboard): smooth stage rail and panel transitions`
