# 184 — Publishing a recruiter assessment never needs a candidate

**Owner:** Shivansh (assessment builder). CODEOWNERS routes these paths to
@zainabshujat, so the PR requests that review.
**Decision (Shivansh, 2026-10-07):** publishing requires no candidates. After
publishing, picking candidates must be an obvious, visible next step.

## 1. Goal
One rule everywhere: **publishing locks the assessment; sending it is a separate,
optional step that can happen at publish time or any time after.** Today the
builder and the template picker refuse to publish without a Shortlisted
candidate while the detail page publishes with nobody, so recruiters cannot tell
whether publishing needs an assignee. Remove the block, reword the copy that
implied it, and make "assign candidates" the visible next action on a published
assessment that has not been sent.

## 2. Current behavior
Three paths reach `PUBLISHED`, under two rules:

| Path | File | Needs a candidate |
|---|---|---|
| Detail page, draft → **Publish assessment** | `assessment-assign-panel.tsx` `PublishBlock` | No |
| Builder → **Create** ("Publish and send to N candidates?") | `assessment-builder.tsx` `createBlockedReason` | Yes, 1–25 |
| Template landing → **Publish and send** | `preset-picker.tsx` `createBlockedReason` | Yes, 1–25 |

- Server: `publishAssessment` has no candidate check. `createAndSendSchema` and
  `createAndSendFromPresetsSchema` reuse `assignAssessmentSchema.shape.candidateRefs`
  (`min(1)`), so `createPublishAndAssign` refuses zero refs. Tests C6 and T3 pin
  "zero → INVALID, nothing saved".
- With an empty Shortlist the builder shows "Your Shortlist is empty — shortlist
  candidates on Hire to send this. You can still save a draft." and disables
  Create. The same recruiter can save the draft, open it and publish.
- After a publish with nobody on it, nothing says so: `/hire/assessments` shows
  "0 candidates · 0 passed · 0 failed" with **View results**, and the detail
  page's assign block is a plain list under a disabled "Assign to 0 candidates".

## 3. Files to touch
- `src/lib/validations/assessment.ts` `[edit]` — the one-step schemas accept 0–25
  refs; `assignAssessmentSchema` keeps `min(1)`.
- `src/features/recruiter-assessments/service.ts` `[edit]` —
  `createPublishAndAssign` skips the Shortlist check and the assign step when no
  refs were sent.
- `src/app/actions/recruiter-assessment-actions.ts` `[edit]` — doc comments only.
- `src/components/hire/assessment/assessment-builder.tsx` `[edit]` — recruiter
  branch: no block on zero picked, adaptive label / hint / confirm / toast,
  optional send step copy. Platform (`platform` prop) branch untouched.
- `src/components/hire/assessment/preset-picker.tsx` `[edit]` — the same.
- `src/components/hire/assessment/assessment-assign-panel.tsx` `[edit]` —
  publish confirm copy; "not sent yet" notice; `#assign` anchor; clearer empty
  Shortlist state and assign button.
- `src/components/hire/assessment/assessment-row-menu.tsx` `[edit]` — "Assign
  candidates" item on published rows.
- `src/app/hire/assessments/[assessmentId]/page.tsx` `[edit]` — pass
  `assignedCount`; draft footnote copy.
- `src/app/hire/assessments/page.tsx` `[edit]` — published with nobody assigned:
  "Not sent yet" and an **Assign candidates** primary action.
- `src/features/recruiter-assessments/recruiter-assessments.test.ts` `[edit]` —
  C6 / T3 updated, new cases.
- `docs/CHANGELOG.md` `[edit]` — one line under Pending reconcile.

**Not touched:** `hire-scout.css` (existing classes and Tailwind utilities only),
`hire-talent-pod.tsx` (its CTA is "Create assessment for Shortlisted", correctly
disabled with no Shortlist), `prisma-store.ts`, `schema.prisma`, the notification
module, the platform (`/admin/assessments`) actions and service, candidate-side
(`/assessments`) files, `middleware.ts`.

## 4. Server vs Client
| File | Boundary | Notes |
|---|---|---|
| `[assessmentId]/page.tsx` | Server | Adds one prop to the panel: `assignedCount: number` (plain JSON). |
| `assessments/page.tsx` | Server | Renders a lucide icon itself; nothing new crosses a boundary. |
| `assessment-assign-panel.tsx` | Client | New prop `assignedCount`. |
| `assessment-row-menu.tsx` | Client | No new props (`status` is already passed). |
| `assessment-builder.tsx`, `preset-picker.tsx` | Client | No prop changes. |
| `service.ts`, `assessment.ts` | Server / shared | No Prisma; store-injectable as before. |

## 5. Steps
1. **Schema.** Add `sendCandidateRefs` — `z.array(ref).max(MAX_ASSIGN_PER_CALL, …)`,
   no `min`. Use it for `candidateRefs` in `createAndSendSchema` and
   `createAndSendFromPresetsSchema`. `assignAssessmentSchema` is unchanged.
2. **Service.** In `createPublishAndAssign`: `const sending = refs.length > 0`.
   Read the pool and run the off-Shortlist check only when `sending`. After a
   successful publish, when `!sending` return
   `{ id, assigned: 0, alreadyAssigned: 0, notificationFailures: 0, assignError: null }`
   without calling `assignAssessment` (which still requires ≥1 ref).
3. **Builder (recruiter branch only).**
   - `createBlockedReason`: only "more than 25 picked" blocks.
   - Primary button: **Publish** with nobody ticked, **Publish and send** with
     ≥1. Hint, confirm text and pending label follow the same split.
   - Send step: sub-line "Optional — tick who gets it now, or publish first and
     assign later from the assessment's page." Empty Shortlist copy says the
     same instead of "shortlist candidates first".
   - Success with nobody: toast "Published. Pick candidates on this page to send
     it." Redirect to the detail page, carrying `?projectId=` when the builder
     had one so the assign panel offers the same Shortlist.
4. **Template picker.** Same changes as step 3.
5. **Detail page panel.**
   - `PublishBlock` confirm adds "You don't need to pick anyone now"; success
     toast "Published. Pick candidates below to send it."
   - `AssignBlock`: `id="assign"`; when `assignedCount === 0` a status callout
     "Published — not sent to anyone yet."; empty Shortlist state gets a real
     button to Hire; the button reads "Assign to candidates" with a one-line
     hint until something is ticked.
6. **Detail page.** Pass `assignedCount={summary.assigned}`; reword the draft
   footnote.
7. **List page.** For `PUBLISHED` with `results.students === 0`: Results cell
   "Not sent yet"; primary action **Assign candidates** →
   `/hire/assessments/{id}#assign`.
8. **Row menu.** Published rows gain "Assign candidates" → the same anchor.
9. **Tests**, then the CHANGELOG line.

## 6. Guardrails for Cursor (DO NOT)
- DO NOT relax `assignAssessmentSchema` — an assign call with nobody is still an
  error.
- DO NOT skip the off-Shortlist check when refs are sent; a stale pick must still
  write nothing.
- DO NOT send a notification on a publish with nobody picked.
- DO NOT change the `platform` branch of the builder (audience + deadline) or any
  admin assessment action.
- DO NOT add unpublish, archive or edit-after-publish — out of scope.
- DO NOT touch the notification module, `middleware.ts` or the schema.
- DO NOT add a new CSS file or component for this; reuse `.hire-assess__callout`,
  `.hire-assess-hint` and `buttonVariants` on `<Link>`.
- Explicit `select`, no `any`, no `console.*` — unchanged.

## 7. DB safety
Not applicable — no schema or data change. Assessments already published with
nobody assigned stay valid and now show "Not sent yet".

## 8. Verification
- `npm run test:recruiter-assessments` — 54 existing (C6 and T3 rewritten) plus
  new: nobody picked → published, no assignment, no notification; works with an
  empty Shortlist; a template with nobody picked; publish-then-assign-later; 26
  refs and an off-Shortlist ref still write nothing.
- `npm run test:assessment-attempts` — unchanged (reads the builder source).
- `npx tsc --noEmit`, `npx eslint` on the touched files.
- Manual, as a recruiter:
  1. Empty Shortlist → `/hire/create-test?from=scratch` → the button reads
     **Publish** and is enabled → confirm → lands on the detail page with the
     "not sent yet" callout and a **Go to Hire** button.
  2. With a Shortlist, tick nobody → **Publish** → detail page → tick two →
     **Assign to 2 candidates** → both appear as "Not started".
  3. Tick two in the builder → the button reads **Publish and send** → both are
     notified once (unchanged behaviour).
  4. `/hire/assessments`: the unsent one shows "Not sent yet" and **Assign
     candidates**; the sent one shows counts and **View results**.
  5. Template landing: pick a template, tick nobody → **Publish** works.
- `git diff --stat` shows exactly the eleven files in §3 plus this plan.

## 9. Commit message
```
fix(hire): publishing an assessment never needs a candidate

The builder's Create and the template picker refused to publish without a
Shortlisted candidate, while the detail page published with nobody — so it
was unclear whether publishing required an assignee. Publishing now only
locks the assessment everywhere: the one-step paths accept zero candidates
(save + publish, no assign, no notification) and still send when 1–25 are
ticked. An assessment that is live but unsent says so and offers "Assign
candidates" on the list, in the row menu and on its page.
```
