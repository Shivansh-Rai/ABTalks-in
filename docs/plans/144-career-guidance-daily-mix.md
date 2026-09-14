# 144 — Daily Career Guidance mix

## Goal

Hub Career Guidance shows at most 4 cards per IST day: profile/activity recs first, then optional check-ins and attributed quotes. Dismiss (X) hides a card for the day; when none remain the section hides until tomorrow. Catalog JSON carries `once` / `daily` / `weekly` cadence. View all opens a factual-only page.

## Current behavior

`evaluateRules` returns up to 6 evidence-backed items. The hub section has no dismiss, no catalog, no View all page.

## Files to touch

- `docs/plans/144-career-guidance-daily-mix.md` `[new]`
- `src/features/career-guidance/catalog.json` `[new]`
- `src/features/career-guidance/catalog.ts` `[new]`
- `src/features/career-guidance/pick-daily.ts` `[new]`
- `src/features/career-guidance/types.ts` `[edit]`
- `src/features/career-guidance/get-career-guidance.ts` `[edit]`
- `src/features/career-guidance/career-guidance.test.ts` `[edit]`
- `src/lib/date-utils.ts` `[edit]` — IST day/week keys
- `src/components/dashboard-hub/career-guidance.tsx` `[edit]`
- `src/components/dashboard-hub/career-guidance-deck.tsx` `[new]`
- `src/app/dashboard/page.tsx` `[edit]`
- `src/app/dashboard/career-guidance/page.tsx` `[new]`
- `docs/CHANGELOG.md` `[edit]`

## Server vs Client

Picker, catalog parse, and rules stay pure. Deck is the only `"use client"` file. Dismiss/cadence live in `localStorage` keyed by userId. Check-in acks are not written to the database.

## Guardrails for Cursor (DO NOT)

- Do not store check-in answers, dismissals, or quotes in Postgres.
- Do not invent %, salary, demand, or job-ready scores.
- Do not backfill after dismiss.
- Do not put quotes on the View all page.
- Do not edit jobs/hackathon/interview modules, `CLAUDE.md`, or `docs/project-context.md`.
- Do not add schema, env vars, or middleware imports.

## Verification

`npm run test:career-guidance` and `npx tsc --noEmit`. Manual: dismiss all 4 → section gone; refresh same day stays gone; View all lists factual recs; check-in Yes creates no evidence.

## Commit message

`feat(dashboard): daily 4-card career guidance mix with dismiss and catalog cadence`
