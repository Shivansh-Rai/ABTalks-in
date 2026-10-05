# 182 — Profile project reorder

## 1. Goal
Let candidates reorder projects on Profile → Projects so their strongest
project can sit first. Order must persist and stay visible wherever
`CandidateProjectEntry` is listed.

## 2. Current behavior
- Schema already has `CandidateProjectEntry.sortOrder`.
- Read: `getCandidateDetail` orders `projects` by `sortOrder asc`.
- Write: `saveProjects` delete-all + recreate with `sortOrder: i` from form
  row order.
- UI: `ProjectsSection` uses `useFieldArray` with append/remove only — no
  `move`.
- Surfaces that already follow that array order after save: Profile Review
  (`build-review.ts`), admin career sections, refresh of `/profile`.

Out of scope: Public share `/r/[token]` and recruiter PDF use admin-curated
**RecruiterReview** JSON, not live `CandidateProjectEntry`.

## 3. Files to touch
- `docs/plans/182-profile-project-reorder.md` **[new]** — this plan.
- `src/components/profile/wizard-fields.tsx` **[edit]** — optional
  `onMoveUp` / `onMoveDown` on `PwEntryCard`; render grip + Move Up/Down
  next to Delete when provided.
- `src/components/profile/projects-section.tsx` **[edit]** — destructure
  `move` from `useFieldArray`; wire move handlers (disable at ends).
- `src/components/profile/profile-wizard.css` **[edit]** — styles for
  `.pw-entry-actions`, grip, and move buttons.

Not touched: schema, `saveProjects`, validations, middleware, recruiter
review JSON, experience/education sections.

## 4. Server vs Client
- All edits are Client components already (`"use client"`).
- Save path unchanged: form row order → `saveProjectsAction` →
  `sortOrder: i`.
- No new Server→Client props.

## 5. Steps
1. Write this plan file.
2. Extend `PwEntryCard` with optional `onMoveUp?` / `onMoveDown?`. When set,
   show grip + Move Up / Move Down; leave other sections unchanged (props
   omitted).
3. In `ProjectsSection`, destructure `move` from `useFieldArray`; pass move
   handlers with end-of-list guards.
4. Add CSS for compact action row in `.pw-entry-head` (title left; actions
   right: Move Up, Move Down, Delete). Keep touch targets; wrap on narrow
   widths.
5. Verify: reorder → Save → refresh keeps order; Profile Review reflects
   order; edit/delete still work; education/experience cards unchanged.

## 6. Guardrails for Cursor (DO NOT)
- Do not add a DnD library or a separate `reorderProjects` action.
- Do not change `saveProjects` delete-all semantics or invent stable
  client-side project ids for this task.
- Do not reorder experience/education in this change.
- Do not edit RecruiterReview / `/r/[token]` / PDF.
- Do not edit `CLAUDE.md` or `docs/project-context.md`.
- Do not touch Neon / migrations (no schema change → no CHANGELOG line).

## 7. Verification
- Manual: `/profile` → Projects → Move Up/Down → Save → hard refresh → same
  order; Profile Review projects match; Delete / Add More still work.
- `npx tsc --noEmit` (or project typecheck script) on touched area.
- No new unit test required unless a pure helper is extracted (none planned).

## 8. Commit message
`feat(profile): allow candidates to reorder projects`
