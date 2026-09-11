# Plan 131 — Builder "Create": publish and send to Shortlisted candidates in one step

**Tickets:** T-243 builder (plan 121) + T-244 publish/assign (plan 128), feeding T-218 (plan 129).
**Owner:** Shivansh (assessment builder, recruiter-side and candidate-side assessments — `CLAUDE.md` ownership).
**Status:** implemented on `ab-dev` (2026-09-11, commit `fb30179a`), merged with master's
assessment presets (PR #298). Written as plan 130; renumbered to 131 at that merge because
master's presets plan (`130-recruiter-assessment-presets.md`) took 130 first.
Merged builder: `candidates` (this plan) + `presetLocked` (presets) props; `/hire/create-test`
serves a blank builder, `?id=` (edit a draft) and `?presets=` (customize templates), all with
the live Shortlist and the Create button.

## 1. Goal

Today a recruiter builds at `/hire/create-test`, saves a draft, goes to
`/hire/assessments`, opens the draft, publishes it, then assigns it — three pages
before a candidate sees anything. This plan adds a **Create** button beside
**Save draft** that, in one click, saves the assessment, publishes it and sends it
to the Shortlisted candidates the recruiter ticked. Each candidate gets the
existing `assessment.assigned` notification, and the test appears on their
`/assessments` page (T-218). Two builder fixes ride along: the Edit/Preview toggle
is hidden on desktop, and new options start empty with an "Option N" placeholder.

## 2. Current behavior (verified)

- `assessment-builder.tsx` has one action, **Save draft** → `saveRecruiterAssessmentAction`
  → `router.push("/hire/assessments")`. It already keeps `assessmentId` in state.
- Publish and assign exist as separate, idempotent service functions (plan 128):
  `publishAssessment` (DRAFT guard in the `updateMany` WHERE) and `assignAssessment`
  (re-resolves every ref against the live Shortlist, all-or-nothing, one notification
  per candidate per assessment). The UI for them is only on `/hire/assessments/[id]`.
- `/hire/create-test` reads the **legacy** Shortlist only (`getShortlist`) for the
  "For N shortlisted candidates" line and `shortlistRefs`. The assign panel uses the
  full union (`listAssignableCandidates`: legacy + T-149 project halves, searchable only).
- **Toggle:** at ≥1100px both panes are always visible (`hire-scout.css`
  `@media (min-width: 1100px)` forces `display: block`), so the Edit/Preview
  segmented control does nothing there. Below 1100px it switches panes.
- **Options:** new MCQs (`NEW_MCQ`), a type switch to Multiple Choice, and
  "Add option" all prefill `body: "Option N"`. The inputs already carry
  `placeholder="Option N"`, so the value hides the placeholder.
- Candidate side (T-218) is complete: notification link and `/assessments` list →
  `/assessments/[assignmentId]`. **No candidate-side change is needed.**

## 3. Files to touch

- `src/lib/validations/assessment.ts` [edit] — `createAndSendSchema`.
- `src/features/recruiter-assessments/service.ts` [edit] — `listSendableCandidates`,
  `createPublishAndAssign`.
- `src/app/actions/recruiter-assessment-actions.ts` [edit] —
  `createAndSendRecruiterAssessmentAction`.
- `src/app/hire/create-test/page.tsx` [edit] — load the full Shortlist through the
  service; `maxDuration = 60`.
- `src/components/hire/assessment/assessment-builder.tsx` [edit] — send step
  (candidate picker), **Create** + confirm, empty option values.
- `src/components/hire/assessment/question-editor.tsx` [edit] — empty option values.
- `src/app/hire/hire-scout.css` [edit, shared file — `.hire-assess*` builder rules
  only] — hide the toggle at ≥1100px; send-step and button styles.
- `src/features/recruiter-assessments/recruiter-assessments.test.ts` [edit] — new cases.
- `docs/CHANGELOG.md` [edit] — one line.

**Not touched:** T-218 files, the notification module, `middleware.ts`, `schema.prisma`,
`isolation.test.ts`, `hire-chrome.tsx`, `assessment-assign-panel.tsx`, the detail and
list pages.

## 4. Server vs Client

| File | Boundary | Notes |
|---|---|---|
| `create-test/page.tsx` | Server | Passes the builder `candidates: { candidateRef, label, jobRole }[]` — plain JSON, **no user ids**. |
| `assessment-builder.tsx` | Client | Calls the two actions via `useTransition`. |
| `service.ts` | Server only | Store- and notifier-injectable; no Prisma. |
| `recruiter-assessment-actions.ts` | `"use server"` | Gate: `requireRecruiterWorkspace()`. |

## 5. Steps

1. **Schema** — `createAndSendSchema = z.object({ draft: assessmentDraftSchema,
   candidateRefs: assignAssessmentSchema.shape.candidateRefs })` (≥1, ≤25 refs).
2. **Service** —
   - `listSendableCandidates(store, recruiterUserId)` → the live Shortlist without user ids.
   - `createPublishAndAssign(store, notifier, scope, input)`:
     1. parse → `INVALID` (nothing written);
     2. every ref must be on the live Shortlist → else `INVALID`, **nothing written**;
     3. save: `saveAssessmentDraft` when the draft has an id (DRAFT only — a
        published id is a `CONFLICT`), else `createAssessment`;
     4. `publishAssessment` → on failure return the error **with the draft's id** so the
        builder's next click updates it instead of creating a duplicate;
     5. `assignAssessment` → on failure the assessment is already live: return ok with
        `assignError`, so the builder hands over to the detail page's assign panel;
     6. return `{ id, assigned, alreadyAssigned, notificationFailures, assignError }`.
     No transaction spans the three steps; each is idempotent and every failure leaves
     a state the recruiter can finish from.
3. **Action** — `createAndSendRecruiterAssessmentAction(input)`: gate, Zod, service with
   the existing `assessmentNotifier()`; error envelope adds optional `assessmentId`;
   revalidate `/hire/assessments` and the detail path; `logger.warn` on notification
   failures; never `console.*`.
4. **Page** — `listSendableCandidates(prismaAssessmentStore(), userId)`; `shortlistRefs`
   now comes from the same union (it was legacy-only; nothing reads it — plan 128 §2).
5. **Builder** —
   - `NEW_MCQ` options `body: ""`.
   - A **Send to shortlisted candidates** section: checkbox list (reusing the
     `.hire-assess-assign__*` classes), "Select all" toggle, empty-Shortlist hint.
   - Buttons: **Save draft** (secondary) and **Create** (primary, disabled with a
     reason until ≥1 candidate is ticked, or when >25 are).
   - Create → client-side draft validation (same as Save) → inline confirm
     ("Publish and send to N candidates? …") → action → on success
     `router.push(\`/hire/assessments/${id}\`)` with toasts for partial outcomes; on
     failure keep `assessmentId` from the response.
6. **Question editor** — `switchType` to MCQ and **Add option** use `body: ""`.
7. **CSS** — inside the existing `@media (min-width: 1100px)` builder block:
   `.hire-assess__seg { display: none; }`; add `.hire-assess__send*`,
   `.hire-assess__savebtn--ghost`; `.hire-assess__save` becomes a wrapping flex row.
8. **Tests** — see §8.

## 6. Guardrails (DO NOT)

- Do not accept a user id from the client — refs only, re-resolved server-side.
- Do not publish or save anything when a ref is off the Shortlist or the refs are invalid.
- Do not add a new notification path — reuse `assessmentNotifier()` (fixed copy,
  `primaryEntityId = assessmentId`).
- Do not touch T-218 files, `middleware.ts`, the schema or the notification module.
- Do not remove the toggle below 1100px — the panes switch there.
- Explicit `select`, no `any`, no `console.*`, `buttonVariants` rule unchanged.

## 7. DB safety

No schema or data change. Uses the tables from plans 121 / 128 / 129 — those three
migrations must be applied (child branch first, per plan 129 §7) before this runs.

## 8. Verification

- `tsc --noEmit`, `eslint` on touched files, `npm run build`.
- `npm run test:recruiter-assessments` — existing 26 + new: create-new sends to the
  picked candidates; an existing draft id is updated, not duplicated; publish failure
  returns the draft id and assigns nobody, and a retry reuses the id; assign failure
  after publish reports `assignError`; a foreign draft id is NOT_FOUND; zero or 26 refs
  and an off-Shortlist ref write nothing; a published id is refused; the action is gated.
- `npm run test:assessment-attempts` — still 29/29 (regression).
- Manual (child branch): build → tick 2 candidates → Create → confirm → lands on the
  detail page with 2 "Not started"; each candidate's bell and `/assessments` show it;
  one takes and submits → monitor shows the result. At ≥1100px no Edit/Preview toggle;
  at 375px it is there and switches panes. New questions show empty options with
  "Option 1 / Option 2" placeholders.

## 9. Commit message

```
feat(hire): Create publishes an assessment and sends it to picked Shortlisted candidates

The builder gains a send step: tick candidates from the live Shortlist
(legacy + project halves, searchable only) and press Create to save,
publish and assign in one click — each candidate gets one
assessment.assigned notification and the test appears on their
/assessments page. Save/publish failures write nothing live and keep the
draft id for the retry; an assign failure after publishing hands over to
the detail page. The Edit/Preview toggle is hidden on desktop, where both
panes are always visible, and new options start empty with placeholders.
```
