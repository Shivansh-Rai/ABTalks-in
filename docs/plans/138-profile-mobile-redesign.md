# 138 — Profile mobile redesign

## 1. Goal

Match the mobile reference: hamburger + compact header + completion CTA +
vertical section cards + secondary performance. Desktop (≥1025px) stays the
current sidebar Quick Links + full report card.

**Defaults:** mobile layout at **≤1024px**. **Mock Interview stays** in the
mobile card list (only entry once Quick Links is gone) and stays out of
Complete chips via existing `noGap`.

## 2. Current behavior

- One React tree: `profile-wizard.tsx` renders `ProfileCard` (Quick Links +
  performance) then `ProfileReviewCard` (hero, Still missing, filled/empty
  cards).
- ≤1024px only stacks columns — Quick Links sits above the report card; cards
  stay tall with full `blocks`.
- Still missing is a dashed string join (`pw-rv-gaps`). Meta pills mix
  location, phone, persona, updated — no way to hide secondary ones with CSS
  alone.
- Section open path (`onOpen` / `jump` → sheet) is already correct; reuse it.

## 3. Files to touch

| File | Change |
|------|--------|
| `docs/plans/138-profile-mobile-redesign.md` | `[new]` this plan |
| `src/features/profile/build-review.ts` | `[edit]` structured hero meta + per-card `preview` |
| `src/components/profile/profile-performance.tsx` | `[new]` extract presentational performance block |
| `src/components/profile/profile-card.tsx` | `[edit]` use shared performance component |
| `src/components/profile/profile-review.tsx` | `[edit]` mobile hero/CTA/list/chevrons + performance slot |
| `src/components/profile/profile-wizard.tsx` | `[edit]` pass `performance` into review |
| `src/components/profile/profile-wizard.css` | `[edit]` ≤1024 mobile layout; desktop rules untouched |
| `src/features/profile/profile.test.ts` | `[edit]` assert preview, mobile CSS guards, Quick Links hidden |

## 4. Server vs Client

- `build-review.ts` — server; adds plain strings only (`preview`, structured
  meta fields).
- `profile-review.tsx`, `profile-card.tsx`, `profile-performance.tsx`, wizard —
  client.
- No functions/icons across the RSC boundary.

## 5. Steps

1. Structured hero meta + `preview` on every `ReviewCard` in `build-review.ts`.
2. Extract `ProfilePerformance`; render under Quick Links (desktop) and under
   the section list (mobile, CSS toggle).
3. Mobile overview in `profile-review.tsx`: compact badges, Complete CTA,
   wizard-ordered preview rows with chevron / hit target; keep desktop
   filled→empty list.
4. CSS ≤1024: hide `.pw-profile-card`, show mobile list / CTA / performance;
   compact hero; no horizontal overflow.
5. Tests for the above.

## 6. Guardrails (DO NOT)

- Do not change desktop grid, sticky Quick Links, or sheet z-index (≥1025).
- Do not remove Mock Interview from the wizard or from mobile cards.
- Do not add a new mobile sidebar or bottom tab nav.
- Do not invent orange brand tokens; use existing warning/primary palette.
- Do not rewrite section form sheets or `completeness.ts`.
- Do not edit `CLAUDE.md` / `docs/project-context.md`.
- No new shared abstraction beyond the small performance extract.
- When build/typecheck contradicts an assumption, stop and report.

## 7. Verification

- Desktop ≥1025: Quick Links + full cards + Still missing + performance under
  Quick Links unchanged.
- ≤1024 / 375px: no Quick Links; compact hero; Complete CTA; preview cards;
  performance at bottom; no horizontal scroll.
- `npx tsx src/features/profile/profile.test.ts`; typecheck on touched files.

## 8. Commit message (when asked)

`profile: mobile overview redesign without Quick Links`
