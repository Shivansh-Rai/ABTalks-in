# 038 — Day page full-phase sidebar

## 1. Goal
Replace the current-phase-only left nav on the Program day page with a **full curriculum rail**: Phase 1…N headings, days listed under each, sticky chrome, scrollable phase/day list, links only for unlocked days, and ticks on completed (PASSED) days.

## 2. Current behavior
`src/components/program/day-shell.tsx` `DaySidebar` filtered to the **current module only**. The day page already loaded `getMemberDayStates` (all days + modules) but only passed `days`.

## 3. Files to touch
- `[edit] src/components/program/day-shell.tsx`
- `[edit] src/components/program/program-day-client.tsx`
- `[edit] src/app/program/(app)/day/[day]/page.tsx`
- `[new] docs/plans/038-day-sidebar-all-phases.md`

No Prisma, seed, middleware, auth, or progression-rule changes.

## 4. Server vs Client
- **Server:** `page.tsx` — passes serializable `modules` + `days`.
- **Client:** `program-day-client.tsx`, `day-shell.tsx`.

## 5. Steps
1. Plumb `curriculum.modules` page → client → shell → sidebar.
2. Rebuild sidebar: sticky header (current phase/day), scrollable nav with all phases + days; lock/link/tick rules unchanged; auto-scroll active day into view (respect reduced motion).
3. Same component for mobile (`lg:hidden`).

## 6. Guardrails for Cursor (DO NOT)
- Do not change `deriveDayState`, unlock rules, or day page LOCKED redirect.
- Do not add new abstraction files.
- Do not restyle the main day content column.

## 7. DB safety
N/A.

## 8. Verification
- Full phase list visible; locked not clickable; PASSED ticked; sticky shell / scrollable body; `npx tsc --noEmit`.

## 9. Commit message
`Show all course phases in the day page sidebar`
