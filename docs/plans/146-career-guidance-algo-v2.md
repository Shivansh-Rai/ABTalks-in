# 146 — Career Guidance algorithm v2

## Goal

Harden Career Guidance with browser-local algorithm fixes and remove job suggestions. No database changes.

## Locked decisions

- Dashboard horizontal rail only; max 4 cards per IST day.
- No job/opportunity cards.
- Dismiss, cadence, and one-time refill stay in localStorage.
- No invented %, salary, or market claims.

## Approach

1. Strip jobs from types, loader, rules, deck, tests.
2. Data-driven progression edges (`progression.json`) walked by `evaluateRules` (pool cap 8).
3. Accomplishment-aligned gates: days ≥ 50 or COMPLETED; Claude credential OR completed enrollment.
4. Skill aliases via `canonicalSkillName`.
5. Slot-based daily mix + istDay rotation; catalog specificity scoring.
6. Soft-dedupe vs ACTIVE enrollments; flag-safe edge fallthrough.
7. One-time refill after dismiss; profile-first hydration (no null flash).

## Guardrails

- No Prisma/schema/migrations for guidance.
- No jobs. No dedicated guidance page. No header nav restore.
- Do not edit `CLAUDE.md` or `docs/project-context.md`.

## Verification

`npm run test:career-guidance`. Manual: ≤4 cards; one refill; dismiss all hides section; no `/jobs/` cards.

## Commit message

`feat(dashboard): career guidance algo v2 without jobs`
