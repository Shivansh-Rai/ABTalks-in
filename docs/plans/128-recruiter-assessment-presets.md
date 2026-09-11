# Plan 128 — Recruiter assessment presets (templates)

**Status:** planned (2026-09-11). Not started.
**Builds on:** Plan 121 (recruiter assessment builder). Same tables, same
`assessmentDraftSchema`, same `/hire/assessments` + `/hire/create-test` surfaces.
**Local prerequisite:** `/hire` sign-in needs `ENABLE_RECRUITER_AUTH=true` in
`.env.local` (same kill switch noted in plan 121 §prereq).

## 1. Goal
Give recruiters ready-made assessment templates on `/hire/assessments` so they
can ship a test without building one from scratch. Each preset card has two
actions: **Use template** (one click → a new `DRAFT` appears in their list) and
**Customize** (opens the builder pre-filled). In the customize flow the preset's
own questions are **locked** — the recruiter can remove them or add their own,
but cannot edit ABTalks-authored questions.

## 2. Current behavior
- `/hire/assessments` ([page.tsx](../../src/app/hire/assessments/page.tsx))
  lists the recruiter's own assessments; empty state is just "No assessments
  yet → Create your first assessment". No templates anywhere.
- `/hire/create-test` ([page.tsx](../../src/app/hire/create-test/page.tsx))
  always renders `<AssessmentBuilder existingDraft={null} …>` — the builder
  starts blank. It already passes the recruiter's current `shortlistRefs`.
- Saving with **no `assessmentId`** calls `createAssessment` →
  `store.create` → a fresh `DRAFT` owned by that recruiter
  (`prisma-store.ts`). Saving with an id updates an existing DRAFT. So "prefill
  then save" needs zero new persistence — a preset is just an
  `assessmentDraftSchema`-shaped payload with no `assessmentId`.
- The builder holds all form state client-side; `QuestionEditor` edits every
  field freely; `stripKeys` removes the client-only `key` before validating
  against the **strict** per-question Zod union (extra keys are rejected).
- **No edit-existing-draft route exists** — the list title links back to a blank
  `/hire/create-test`. The question-lock therefore only needs to hold during the
  initial customize session; that matches the requirement and this plan does not
  add a draft-reopen flow.

## 3. Design decisions
- **Presets are code-defined, not DB rows.** No schema/migration. A preset is a
  static object matching `assessmentDraftSchema` minus `assessmentId`/
  `shortlistRefs`. This keeps them versioned in git, editable in one file, and
  free of any 078 repository concern (they touch no candidate/points/talent
  data — creation goes through the existing `RecruiterAssessment` writer).
- **Two paths, one existing writer.** "Use template" = a new server action that
  runs `createAssessment` with the preset content. "Customize" = navigate to
  `/hire/create-test?preset=<id>`, prefill the builder, save via the *existing*
  `saveRecruiterAssessmentAction` (no id → create).
- **Lock is a client-only UI constraint.** Preset questions carry a
  `locked: true` flag in builder state; `QuestionEditor` disables their edit
  controls but keeps Delete/Move. `locked` is stripped alongside `key` before
  the payload is validated/sent, so it never reaches Zod (which is `.strict()`)
  or the DB. Correct-answer flags in preset content are fine to send to the
  recruiter's own client — they are the test author; candidates never see this
  screen.
- **Shortlist refs.** Both paths attach the recruiter's *current* shortlist,
  exactly as the builder does today; the preset's `shortlistRefs` is always `[]`.

## 4. Files to touch

**Data**
- `src/features/recruiter-assessments/presets.ts` [new] — `AssessmentPreset`
  type (`id`, `name`, `tagline`, `tags: string[]`, `content: ContentInput`),
  the preset array, `listAssessmentPresets()`, `getAssessmentPreset(id)`. Pure
  data module (no `server-only`, no `"use client"`) so both the server page and
  the server action can import it.
- `src/features/recruiter-assessments/presets.test.ts` [new] — one test that
  parses every preset's `{ ...content, shortlistRefs: [] }` through
  `assessmentDraftSchema` and fails loudly on any authoring mistake; asserts
  `id`s are unique.

**Server**
- `src/app/actions/recruiter-assessment-actions.ts` [edit] — add
  `createAssessmentFromPresetAction({ presetId })`: Zod-validate `presetId`,
  `requireRecruiterWorkspace()`, look up the preset (404-style error if
  missing), fetch current shortlist refs, call `createAssessment` with
  `{ ...preset.content, shortlistRefs }`, `revalidatePath("/hire/assessments")`,
  return `{ ok, data: { id } }`.

**Pages** (both Server Components)
- `src/app/hire/assessments/page.tsx` [edit] — add a "Start from a template"
  section above the list (or above the empty state) rendering preset cards:
  a `<form action=…>` with hidden `presetId` + **Use template** submit, and a
  `<Link href={/hire/create-test?preset=<id>}>` styled with `buttonVariants`
  for **Customize**. A tiny server-action wrapper (mirrors the existing
  `deleteAssessmentFormAction`) calls `createAssessmentFromPresetAction` then
  `redirect("/hire/assessments")`.
- `src/app/hire/create-test/page.tsx` [edit] — accept
  `searchParams: Promise<{ preset?: string }>`; if `preset` resolves to a known
  preset, pass `existingDraft={{ ...preset.content, shortlistRefs: refs }}` and
  `presetLocked` to the builder; otherwise behave exactly as today
  (`existingDraft={null}`, `presetLocked={false}`).

**Client**
- `src/components/hire/assessment/assessment-types.ts` [edit] — add optional
  `locked?: boolean` to `DraftQuestion`.
- `src/components/hire/assessment/assessment-builder.tsx` [edit] — new
  `presetLocked?: boolean` prop; `toDraftQuestions(existing, presetLocked)` sets
  `locked: true` on the prefilled questions; `NEW_MCQ()`/duplicated/added
  questions stay unlocked; `stripKeys` also drops `locked`; pass
  `locked={q.locked}` to `QuestionEditor`; when `presetLocked`, show heading
  "Customize a template" and a one-line note that provided questions can't be
  edited but can be removed.
- `src/components/hire/assessment/question-editor.tsx` [edit] — add
  `locked?: boolean` prop. When `locked`: disable type/points/required/title/
  help-text inputs and all option controls (add/remove/mark-correct/allow-
  multiple), early-return the mutating handlers as a guard, and render a small
  "Provided by ABTalks" badge. **Delete and Move Up/Down stay enabled.** Hide
  Duplicate for locked questions (duplicating would produce an editable copy of
  our content — out of scope; omit to keep the rule clean).

**Styles**
- `src/app/hire/hire-scout.css` [edit] — `.hire-assess-presets`,
  `.hire-assess-preset-card` (+ tag chips, tagline, action row) reusing existing
  tokens; `.hire-assess-q--locked` (muted border/background per the light,
  border-only house style) and a `.hire-assess-q__badge`.

## 5. Server → Client prop passing
- `create-test/page.tsx` (Server) → `AssessmentBuilder` (Client): passes
  `existingDraft` (plain serializable object), `presetLocked` (boolean),
  `shortlistRefs`/`shortlistCount` (existing). No functions, icons, or class
  instances cross the boundary. ✔
- `assessments/page.tsx` (Server) preset cards use `<form action={serverFn}>`
  and `<Link>` only — no client component added there. ✔

## 6. Steps (file-by-file, no design decisions left)
1. **`presets.ts`** — define `AssessmentPreset`; author the seed presets (see
   §7). Each `content` = `{ title, subheading, instructions, durationMinutes,
   passMarkPercent, questions }` with questions in the exact shapes of the Zod
   union (MCQ needs `allowMultipleCorrect` + ≥2 options with exactly one/any
   `isCorrect`; paragraph needs `maxWords`; file-upload needs a real URL — avoid
   file-upload in presets unless a valid destination exists, prefer MCQ +
   paragraph). Export `listAssessmentPresets()` and `getAssessmentPreset(id)`.
2. **`presets.test.ts`** — loop presets, `assessmentDraftSchema.safeParse({
   ...p.content, shortlistRefs: [] })` must succeed; assert unique ids.
3. **action** — add `createAssessmentFromPresetAction`; reuse `scopeFrom`,
   `prismaAssessmentStore()`, `createAssessment`, and `getShortlist` +
   `encodeCandidateRef` (same imports the create-test page uses) for refs.
4. **`create-test/page.tsx`** — await `searchParams`, resolve preset, branch.
5. **`assessment-types.ts`** — add `locked?: boolean`.
6. **`assessment-builder.tsx`** — prop, lock-on-prefill, `stripKeys` drop
   `locked`, pass `locked` down, conditional heading/note.
7. **`question-editor.tsx`** — `locked` prop, disable + guard, badge, keep
   Delete/Move, drop Duplicate when locked.
8. **`assessments/page.tsx`** — preset section + `usePresetFormAction`
   server wrapper + redirect.
9. **CSS** — cards + locked question styling.

## 7. Seed presets (first batch)
Role/tech-specific, per the ask ("Front-end, react, python etc"):
- **Frontend fundamentals** — HTML/CSS/JS MCQs + one short paragraph.
- **React screen** — hooks, rendering, state MCQs + a "explain a bug" paragraph.
- **Python fundamentals** — syntax, data structures, comprehension MCQs +
  paragraph.
- **Backend / API** — HTTP, REST, DB basics MCQs + a design paragraph.
- **General aptitude** — reasoning MCQs + one written problem.

Each: ~6–8 questions, `durationMinutes` 20–30, `passMarkPercent` 60. Content
authored plainly; keep it modest and correct — the test asserts validity.

## 8. Guardrails for Cursor (DO NOT)
- DO NOT add a Prisma model, migration, or repository — presets are static data;
  creation reuses the existing `RecruiterAssessment` writer only.
- DO NOT send `locked` (or `key`) to the server — strip both in `stripKeys`; the
  per-question schema is `.strict()` and will reject extras.
- DO NOT let locked questions be editable or duplicable; DO keep them
  deletable/movable.
- DO NOT mark `/hire/assessments` or `/hire/create-test` public or add
  `requireAdmin`; keep `requireRecruiter()` / `requireRecruiterWorkspace()`.
- DO NOT import `@/lib/*`, Prisma, or presets into anything on the
  edge/middleware path — none of these files are there; keep it that way.
- DO NOT use `<Button asChild>`; style `<Link>` with `buttonVariants` (house
  rule), as the existing page already does.
- DO NOT introduce new abstraction files beyond `presets.ts` (+ its test).
- Effects stay light/border-only (house style) for the new cards and locked
  state — no glows.

## 9. DB safety
None — no schema or data migration. (Creating a preset-based assessment is a
normal DRAFT insert through the plan-121 path.)

## 10. Verification
- `npm run build` and typecheck pass; `presets.test.ts` passes.
- With `ENABLE_RECRUITER_AUTH=true`, sign in at `/hire`, open
  `/hire/assessments`:
  - Preset cards render.
  - **Use template** → redirects to the list with a new `DRAFT` row (title =
    preset title, correct question count).
  - **Customize** → `/hire/create-test?preset=<id>` opens the builder pre-filled;
    preset questions show the "Provided by ABTalks" badge, their inputs are
    disabled, Delete/Move work, Add question adds an editable question; Save
    draft creates a new row on the list.
  - Removing all preset questions and adding one own question still saves.
- Changed files exactly match §4; no other files touched.

## 11. Commit message
```
feat(hire): assessment presets — one-click use + customize with locked questions

Add code-defined assessment templates on /hire/assessments. "Use template"
creates a DRAFT via the existing writer; "Customize" prefills the builder with
preset questions locked (removable/movable, not editable). No schema change.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```
