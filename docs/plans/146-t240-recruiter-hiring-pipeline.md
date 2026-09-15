# Plan 146 — T-240 Recruiter Hiring Pipeline

**Owner (execution):** Manuvrtti (Sohail approved the cross-module build)
**Ticket:** T-240 — "Shortlist, reject and hiring pipeline"
**Demo:** Demo 1 acceptance (implementation ≤ 2026-09-10, internal test ≤ 2026-09-11)
**Unblocks:** T-247 (applicant convergence) and T-249 (recruiter notifications)

---

## 1. Goal

A working per-recruiter hiring pipeline board at `/hire/pipeline`. A recruiter
adds a candidate to the pipeline, advances them through nine stages
(`SOURCED` → `SHORTLISTED` → `CONTACTED` → `SCREENING` → `INTERVIEWING` →
`OFFER` → `HIRED`, with `REJECTED` / `WITHDRAWN` as terminal off-track states),
and every change persists across refresh, sign-out and device. The board is
strictly scoped to the owning recruiter — nobody else in the org or platform
sees it.

The 9-stage schema (`enum PipelineStage`, `model TalentListItem`,
`model TalentList`) has existed since the 078 Phase 1 migration
(`20260820120000_platform_data_architecture_phase1`). This plan is the
reader + writer + server actions + UI that turn the schema into a working
feature.

## 2. Current behavior

- **Schema:** `TalentList` (recruiter-owned or org-shared) and `TalentListItem`
  (candidate on a list, with a `PipelineStage` field) exist in
  [prisma/schema.prisma:3684](../../prisma/schema.prisma#L3684) and
  [prisma/schema.prisma:3705](../../prisma/schema.prisma#L3705).
  `enum PipelineStage` at [prisma/schema.prisma:2246](../../prisma/schema.prisma#L2246)
  defines 9 values. `RecruiterProfile.talentLists TalentList[]` relation
  already declared at [prisma/schema.prisma:1109](../../prisma/schema.prisma#L1109).
- **Reader / writer:** none anywhere in `src/`. Grep for
  `prisma\.talentListItem|prisma\.talentList\b|talentListItem\.(create|update|upsert|delete)`
  returns zero matches.
- **UI:** none. No `/hire/pipeline` route, no pipeline component.
- **The only pipeline-adjacent thing that works today** is the per-project
  shortlist triage backed by `TalentRequestMatch.decision`
  (`SHORTLISTED` / `REJECTED` / `UNDECIDED`), read by
  [src/features/hire/project-shortlist.ts](../../src/features/hire/project-shortlist.ts).
  It is a search-result triage keyed by `(TalentRequest, candidate)`, not a
  persistent recruiter pipeline. Comment at
  [src/features/admin/inspect-talent-project.ts:58-62](../../src/features/admin/inspect-talent-project.ts#L58-L62)
  confirms: "`decision` is the ONLY pipeline state that exists; `PipelineStage`
  / `TalentListItem` are schema-only with no reader, writer or UI anywhere in
  `src/`."
- **Recruiter org:** `provisionRecruiterIdentity`
  ([src/features/hire/provision-recruiter.ts](../../src/features/hire/provision-recruiter.ts))
  guarantees every active recruiter has an `Organization` row (one org per
  recruiter — T-226) and a `RecruiterProfile`. `TalentList.organizationId`
  therefore has a home already.

## 3. Files to touch

### Schema — none
No schema change. The 078 Phase 1 model is enough for T-240 as written on the
sheet. (A future `sourceJobId` field will be considered inside T-247's own
plan; do not preempt it here.)

### New — repository / feature layer
- [new] `src/repositories/talent-pipeline.ts` — sole reader/writer for
  `TalentList` + `TalentListItem`. All access filtered by
  `ownerRecruiterId = <caller>`. Provides:
  - `ensureRecruiterPipeline(recruiter)` → returns the recruiter's private
    pipeline list, upserting it on first use.
  - `listPipeline(recruiter)` → 9 stage buckets with candidate rows.
  - `addToPipeline(recruiter, candidateUserId, stage?)` — idempotent per
    `(list, candidateUserId)` via existing `@@unique`.
  - `moveStage(recruiter, itemId, nextStage)`.
  - `removeFromPipeline(recruiter, itemId)`.
- [new] `src/features/hire/pipeline/format.ts` — shape a `TalentListItem` +
  candidate identity into a card row (name, role, skills, thumbnail).
  Reuses `loadRecruiterIdentities` from
  [src/repositories/talent.ts](../../src/repositories/talent.ts) so field
  exposure honours `RECRUITER_FIELD_POLICY` (T-133 policy — do not bypass).
- [new] `src/lib/validations/pipeline.ts` — Zod schemas:
  `pipelineStageSchema` (enum of 9), `addToPipelineInputSchema`,
  `moveStageInputSchema`, `removeItemInputSchema`.

### New — server actions
- [new] `src/app/actions/recruiter-pipeline-actions.ts` — `"use server"`.
  Actions: `addCandidateToPipelineAction`, `moveCandidateStageAction`,
  `removeCandidateFromPipelineAction`. Each: auth → recruiter guard →
  Zod-parse → repository call → `revalidatePath("/hire/pipeline")` →
  result envelope.

### New — routes & UI
- [new] `src/app/hire/pipeline/page.tsx` — Server Component. Resolves
  recruiter from session, loads pipeline, renders board.
- [new] `src/components/hire/pipeline/pipeline-board.tsx` — Client Component
  (`"use client"`). 9-column kanban board, per-column candidate list.
- [new] `src/components/hire/pipeline/pipeline-card.tsx` — Client Component.
  Candidate card with name, role, stage picker `<Select>` + Remove button.
  Optimistic move via `useTransition`, revert on server refusal.
- [new] `src/components/hire/pipeline/stage-labels.ts` — display labels &
  ordered stage list (single source of truth for column order and copy).
- [new] `src/components/hire/pipeline/pipeline-empty-state.tsx` — column
  empty state ("No candidates in Screening").

### Edit — bridge from existing shortlist
- [edit] `src/components/hire/candidate-inspector.tsx` (or wherever the
  shortlist row's action buttons live — confirm exact file during Step 5.5)
  — add an "Add to Pipeline" button that calls
  `addCandidateToPipelineAction`. This is the ONLY existing surface T-240
  edits; the per-project `TalentRequestMatch.decision` triage stays
  untouched.
- [edit] `src/components/hire/hire-chrome.tsx` (or `hire-desk-context.tsx`
  if the nav lives there) — add a "Pipeline" nav entry pointing to
  `/hire/pipeline`. One line of copy; no logic change.

### New — tests
- [new] `src/repositories/talent-pipeline.test.ts` — cross-recruiter
  isolation, idempotent add, stage move updates `stageChangedAt`,
  `candidateLabel` tombstone survives candidate delete.
- [new] `src/features/hire/pipeline/actions.test.ts` — auth refusal for
  unauthenticated / non-recruiter / unapproved recruiter callers, Zod
  refusal on bad stage.
- [new] `src/features/hire/pipeline/persistence.test.ts` — the sheet's
  acceptance line: two independent DB sessions read the same state after a
  move (proxy for "sign in on another device").

## 4. Server vs Client

| Component | Boundary | Notes |
|---|---|---|
| `src/app/hire/pipeline/page.tsx` | **Server** | Session + repo read, then hands data to `PipelineBoard` as plain-object props. |
| `PipelineBoard` | **Client** | Owns local optimistic state + `useTransition` calls to actions. |
| `PipelineCard` | **Client** | Stage `<Select>` fires the action. |
| `stage-labels.ts`, `format.ts`, repository, validations | Server-only modules. |
| Server → Client props | **Only plain data.** No `Date` — pre-format `stageChangedAt` to ISO string in the server component. No functions, no icons-as-props, no class instances. |

## 5. Steps (file-by-file, no design decisions left to the executor)

### 5.1 Repository
1. Create `src/repositories/talent-pipeline.ts`.
2. Export `RECRUITER_PIPELINE_SLUG_PREFIX = "__pipeline:"` and a helper
   `pipelineListName(recruiterId)` returning
   `` `__pipeline:${recruiterId}` `` — used ONLY as the reserved name of the
   personal pipeline row so the `@@unique([organizationId, name])` cannot
   collide with a recruiter-created list.
3. `ensureRecruiterPipeline({ recruiterProfileId, organizationId })`:
   `prisma.talentList.upsert({ where: { organizationId_name: { organizationId, name: pipelineListName(recruiterProfileId) } }, create: { organizationId, ownerRecruiterId: recruiterProfileId, isSharedWithOrg: false, name: pipelineListName(recruiterProfileId), description: "Hiring pipeline" }, update: {}, select: { id: true } })`.
4. `listPipeline(recruiter)`: guard `list.ownerRecruiterId === recruiter.id`
   after the read, then `findMany` on `talentListItem` with
   `{ talentListId, candidateUserId: { not: null } }`, ordered by
   `[stage asc, addedAt desc]`, selecting the minimum fields needed for the
   card. Return `{ stages: Record<PipelineStage, PipelineRow[]>, counts: Record<PipelineStage, number> }`.
5. `addToPipeline(recruiter, candidateUserId, stage = "SHORTLISTED")`:
   ensure list, then `upsert` on `@@unique([talentListId, candidateUserId])`.
   On update, keep the existing stage (adding an already-tracked candidate
   never demotes them). Return `{ ok: true, itemId }`.
6. `moveStage(recruiter, itemId, nextStage)`: `updateMany` with a
   `where.talentList.ownerRecruiterId = recruiter.id` guard. If `count === 0`
   → `{ ok: false, message: "Pipeline item not found." }`. On success, set
   `stage` and `stageChangedAt: new Date()`.
7. `removeFromPipeline(recruiter, itemId)`: `deleteMany` with the same
   ownership guard.

### 5.2 Validation
1. Create `src/lib/validations/pipeline.ts`.
2. `pipelineStageSchema = z.enum([...9 stages])`.
3. `addToPipelineInputSchema = z.object({ candidateUserId: z.string().min(1), stage: pipelineStageSchema.optional() })`.
4. `moveStageInputSchema = z.object({ itemId: z.string().min(1), stage: pipelineStageSchema })`.
5. `removeItemInputSchema = z.object({ itemId: z.string().min(1) })`.

### 5.3 Server actions
1. Create `src/app/actions/recruiter-pipeline-actions.ts` with `"use server"`.
2. Helper `resolveRecruiterOrRefuse()`: `session = await auth()`; if no
   `session.user.id` → `{ ok: false, message: "Sign in required." }`;
   `recruiter = await prisma.recruiterProfile.findUnique({ where: { userId }, select: { id: true, approved: true } })`;
   if not found or `!approved` → `{ ok: false, message: "Recruiter access required." }`.
   Then load the org via `prisma.organization.findUnique({ where: { slug: recruiterWorkspaceSlug(userId, company) }, select: { id: true } })` — reuse the slug helper already exported by `provision-recruiter.ts` (export it if it isn't already).
3. Each action: `resolveRecruiterOrRefuse` → Zod-parse the input → repository
   call → `revalidatePath("/hire/pipeline")` → result envelope
   `{ ok: true, data } | { ok: false, message }`.
4. Log every refusal via `logger` from `@/lib/logger` — never
   `console.error`.

### 5.4 Route + board UI
1. Create `src/app/hire/pipeline/page.tsx`. Follow the same session +
   `getRecruiterState` guard that `src/app/hire/layout.tsx` uses. If
   `state.status !== "active"` render a small "Approved recruiters only" empty
   state — never throw.
2. Read pipeline via `listPipeline(recruiter)`, ISO-format any Date fields,
   pass to `<PipelineBoard initial={...} />`.
3. Create `src/components/hire/pipeline/stage-labels.ts` — export
   `STAGE_ORDER: PipelineStage[]` (SOURCED first, WITHDRAWN last) and
   `STAGE_LABEL: Record<PipelineStage, string>`.
4. Create `src/components/hire/pipeline/pipeline-board.tsx` (`"use client"`).
   Horizontal-scroll flex row on mobile, CSS grid on ≥ md. One column per
   stage with header (label + count) and a scrollable card list. Column
   width fixed (~ 280 px) so mobile shows one column at a time via
   `scroll-snap-align`.
5. Create `src/components/hire/pipeline/pipeline-card.tsx` (`"use client"`).
   Renders name/role/skills. Bottom row: stage `<Select>` + trash-icon
   Remove. `useTransition` around the action call; on `ok: false` show a
   toast via the existing hire toast hook (whatever `hire-chrome.tsx`
   already uses — mirror it, do not introduce a new one).
6. Create `pipeline-empty-state.tsx` — one line per column ("No one in
   Screening yet"). Do NOT put a global empty state; each column having its
   own is what the sheet's "the pipeline belongs to that recruiter alone"
   line implies visually.

### 5.5 Bridge from shortlist
1. Identify the shortlist-row action-button component. Start at
   `src/components/hire/candidate-inspector.tsx` and follow the imports
   until the row-level primary/secondary buttons are found.
2. Add an "Add to Pipeline" secondary button next to Shortlist. Wire it to
   `addCandidateToPipelineAction`. Show "In pipeline" state if the row is
   already tracked (piggyback on whatever `hire-desk-context.tsx` already
   caches, or add a light client-side `useState` seeded from a single
   `pipelineCandidateIds: Set<string>` prop passed in from the server layout
   — cheaper than another round trip).
3. Add a "Pipeline" nav entry to the hire chrome pointing to
   `/hire/pipeline`.

### 5.6 Tests
1. `src/repositories/talent-pipeline.test.ts`
   - Recruiter A cannot read or move Recruiter B's items (isolation).
   - `addToPipeline` twice → single row (idempotent).
   - `moveStage` updates `stage` + `stageChangedAt`.
   - Delete of `User` does not delete the row (SetNull on
     `candidateUserId`, `candidateLabel` survives).
2. `src/features/hire/pipeline/actions.test.ts`
   - No session → `{ ok: false }`.
   - Non-recruiter → `{ ok: false }`.
   - Unapproved recruiter → `{ ok: false }`.
   - Bad `stage` string → Zod rejects.
3. `src/features/hire/pipeline/persistence.test.ts`
   - Two `prisma` reads (simulating device A after device B moves) see the
     new stage. This is the "sign in on another device" evidence line the
     sheet requires.

## 6. Guardrails for Cursor (DO NOT)

- **DO NOT** touch `TalentRequestMatch.decision` or
  `src/features/hire/project-shortlist.ts`. The per-project shortlist
  triage is a separate, live system. T-240 lives beside it, not on top of
  it.
- **DO NOT** add `TalentListItem` reads/writes anywhere except
  `src/repositories/talent-pipeline.ts`. Any new caller uses that module.
  This mirrors the 078 rule "no `/hire` code reads a table that 078
  migrates."
- **DO NOT** change the Prisma schema. If a field looks missing, stop and
  raise it — schema is Sohail-review territory.
- **DO NOT** call `prisma.talentList.findMany` on the pipeline surface
  without an `ownerRecruiterId` filter. Every read/write must scope by
  recruiter id inside the repository layer.
- **DO NOT** pass `Date` or class instances from the Server Component to
  the Client board. ISO strings only.
- **DO NOT** use `<Button asChild>` or `render={<Link>}`. If a card links
  out to a profile, apply `buttonVariants` directly on `<Link>`.
- **DO NOT** hard-code `Asia/Kolkata` for `stageChangedAt` display —
  format at render time using the existing hire time formatter.
- **DO NOT** introduce a new toast library or nav layout — reuse whatever
  `HireChrome` already provides.
- **DO NOT** add rate limiting, auth middleware or admin surfaces —
  Sohail's territory. If a limit becomes necessary, park it in a
  follow-up.
- **DO NOT** log with `console.error`. Use `@/lib/logger`.

## 7. DB safety

No schema change → no migration → no Neon branch snapshot required.

Before starting execution:
- `git status` clean.
- Commit checkpoint: `git commit --allow-empty -m "checkpoint before T-240 pipeline"` on the working branch. Record the commit hash in the PR description.
- Verify local Prisma client is fresh: `npx prisma generate`.

If during execution a schema gap is discovered, STOP and raise it here — do
not add a field silently.

## 8. Verification

Build & type gates (all must pass):
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- Repository + action + persistence tests (Vitest) all green.

Manual test script (Chromium, two profiles = "device A" and "device B"):
1. Sign in as an approved recruiter on device A → `/hire/pipeline` shows an
   empty board with 9 columns.
2. From a Scout project row, click **Add to Pipeline** on a candidate.
   Confirm the card appears in **Shortlisted** on `/hire/pipeline`.
3. Move the card to **Interviewing** via the stage picker.
4. Refresh the page → still in **Interviewing**.
5. Sign out, sign back in → still in **Interviewing**.
6. Open device B (second Chromium profile) with the same recruiter → the
   card is in **Interviewing** without a refresh cycle triggered by the
   move.
7. Sign in as a *different* recruiter on device A → their `/hire/pipeline`
   is empty. Confirm the first recruiter's candidates are invisible.
8. Move card to **Rejected** → card renders in the Rejected column and does
   not disappear. Move to **Hired** → same, in Hired.
9. Click Remove on a card → card disappears; refresh confirms deletion.

Files that should have changed (exact list):

- `docs/plans/146-t240-recruiter-hiring-pipeline.md` (this file)
- `src/repositories/talent-pipeline.ts` [new]
- `src/repositories/talent-pipeline.test.ts` [new]
- `src/features/hire/pipeline/format.ts` [new]
- `src/features/hire/pipeline/actions.test.ts` [new]
- `src/features/hire/pipeline/persistence.test.ts` [new]
- `src/lib/validations/pipeline.ts` [new]
- `src/app/actions/recruiter-pipeline-actions.ts` [new]
- `src/app/hire/pipeline/page.tsx` [new]
- `src/components/hire/pipeline/pipeline-board.tsx` [new]
- `src/components/hire/pipeline/pipeline-card.tsx` [new]
- `src/components/hire/pipeline/pipeline-empty-state.tsx` [new]
- `src/components/hire/pipeline/stage-labels.ts` [new]
- `src/components/hire/candidate-inspector.tsx` [edit] — "Add to Pipeline"
  button + already-tracked pill
- `src/components/hire/hire-chrome.tsx` [edit] — Pipeline nav entry
- `src/features/hire/provision-recruiter.ts` [edit] — export
  `recruiterWorkspaceSlug` if it isn't already exported

Evidence for the demo sheet:
- The PR link.
- Vitest output showing the three test files green.
- A short Loom/OBS recording running through steps 1-9 above.

## 9. Commit message

```
feat(hire): T-240 recruiter hiring pipeline — 9-stage board with cross-device persistence

The 078 Phase 1 schema (PipelineStage / TalentListItem / TalentList) has been
sitting unused since 2026-08-20. This is the reader, writer, server actions
and UI that turn it into a working feature.

- src/repositories/talent-pipeline.ts is the only reader/writer for
  TalentListItem. Every path scopes on TalentList.ownerRecruiterId so a
  recruiter never sees anyone else's pipeline.
- /hire/pipeline renders a 9-column board (SOURCED → HIRED, plus REJECTED /
  WITHDRAWN) with per-card stage picker and remove. Optimistic UI, server
  is source of truth.
- "Add to Pipeline" button on the Scout project row bridges the existing
  per-project shortlist (TalentRequestMatch.decision — untouched) into the
  recruiter-wide persistent pipeline this ticket introduces.
- Tests cover cross-recruiter isolation, idempotent add, stageChangedAt on
  move, and two independent reads seeing the same state after a move —
  the "sign in on another device" acceptance line.

Unblocks T-247 (applicants converge into the pipeline) and T-249 (recruiter
notifications on pipeline actions).

Sohail approved the cross-module scope (T-240 owned by Shashank on the
CLAUDE.md ownership block; his call went to Manuvrtti for the Demo 1
window).
```
