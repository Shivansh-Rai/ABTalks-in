# Plan 147 — T-247 Applicant Pipeline Convergence

**Owner:** Manuvrtti
**Ticket:** T-247 — "Applicants join the same pipeline as people you sourced by searching — one hub, not two inboxes"
**Demo:** Demo 2 (implementation ≤ 2026-09-11, internal test ≤ 2026-09-14, demo ≤ 2026-09-15)
**Depends on:** T-246 ✅ merged · T-240 ✅ merged (PR #402, `57497e9a`) · T-204 (infra, in place)

## 1. Goal

When a candidate clicks Apply on a recruiter-posted job, the candidate lands
on that recruiter's hiring pipeline (`/hire/pipeline`) at the **SOURCED**
stage automatically — same list, same board, same nine stages as the
Scout-sourced candidates the recruiter added by hand in T-240.

One hub. The recruiter never has to move a person between two inboxes.

## 2. Current behavior

- **Applying works.** `applyToJobAction` → `applyToPublishedJob`
  ([src/features/candidate-jobs/service.ts:106](../../src/features/candidate-jobs/service.ts#L106))
  → `deps.applications.create` writes `JobApplication` at
  [src/features/candidate-jobs/prisma-store.ts:56](../../src/features/candidate-jobs/prisma-store.ts#L56).
- **The pipeline exists.** T-240 shipped `src/repositories/talent-pipeline.ts`
  with `addToPipeline(workspace, { candidateUserId, label, stage })`.
- **The recruiter is discoverable.** `Job.recruiterId` (nullable — admin-posted
  jobs have it null) is the User.id we resolve into a workspace.
- **The convergence is missing.** Nothing calls `addToPipeline` from the
  application flow, so an applicant sits on `JobApplication` and never
  reaches the recruiter's board.
- **Admin-posted jobs** currently have `recruiterId = null`; those applicants
  have no recruiter to converge into — see step 5.4 for the fallback.

## 3. Files to touch

- [new] `src/features/pipeline-convergence/converge-applicant.ts` — the
  server-only helper that, given a fresh `JobApplication`, resolves the
  recruiter workspace and calls `addToPipeline` at `SOURCED`. Idempotent.
  Fail-open (a broken pipeline write must not fail the applicant).
- [new] `src/features/pipeline-convergence/converge-applicant.test.ts` —
  shape guarantees: hook is called after successful create, calls
  `addToPipeline` at `SOURCED`, swallows errors instead of throwing them
  to the applicant, skips admin jobs (recruiterId=null) cleanly, no
  cross-module writes to `prisma.talentListItem.*` outside the T-240
  repository.
- [edit] `src/app/actions/job-actions.ts` — after
  `applyToPublishedJob` returns `ok`, fire the converge helper on the
  application id and the resolved job. Wrapped so any failure is logged
  and swallowed, not propagated.
- [edit] `src/features/candidate-jobs/service.ts` — extend the ok-path
  result to include the `jobId` and `candidateUserId` the caller needs,
  or read them back from the store. Preferred: the service is unchanged
  and the action does the read; keeps the pure service pure. (Executor
  picks whichever keeps the test surface smaller — plan Step 5.2 decides.)

## 4. Server vs Client

Entirely server-side. No new component. No prop passing across the
Server→Client boundary.

- `converge-applicant.ts` — server-only (`import "server-only"`).
- `job-actions.ts` — `"use server"`, already server-only.

The T-240 board (`/hire/pipeline`) picks up the new row on next load;
no client change needed. The applicant sees the existing "Applied" UX;
the pipeline write is invisible to them.

## 5. Steps

### 5.1 Converge helper — `src/features/pipeline-convergence/converge-applicant.ts`

1. `import "server-only";` at the top.
2. Import `ensureRecruiterWorkspace` from
   `@/features/hire/provision-recruiter`, `addToPipeline` from
   `@/repositories/talent-pipeline`, `PipelineStage` from
   `@prisma/client`, `logger` from `@/lib/logger`, `prisma` from
   `@/lib/db`.
3. Export `convergeApplicantToPipeline({ applicationId })`. Contract:
   returns nothing (fire-and-forget). Never throws. Every failure is a
   `logger.warn` — the applicant path already succeeded upstream.
4. Read the application + job in one query:
   `prisma.jobApplication.findUnique({ where: { id }, select: { id, userId, job: { select: { id, recruiterId } }, user: { select: { name: true } } } })`.
5. If `application === null` → log `warn` and return.
6. If `application.job.recruiterId === null` (admin-posted job) → log
   `info` and return. No recruiter pipeline to write to.
7. Resolve the recruiter workspace via
   `ensureRecruiterWorkspace(application.job.recruiterId)`.
   If it returns `null` (rare — the recruiter account is gone), log
   `warn` and return.
8. Call `addToPipeline({ userId: recruiterId, recruiterProfileId,
   organizationId }, { candidateUserId: application.userId, label:
   application.user?.name?.trim() || "Candidate", stage:
   PipelineStage.SOURCED })`.
9. On `result.ok === false`, `logger.warn` with the message.

### 5.2 Wire the hook — `src/app/actions/job-actions.ts`

1. Import the helper (dynamic `import()` to keep the client bundle path
   for `job-actions.ts` unchanged — the file is server-side but
   Next-critical, so lazy is safest).
2. After the successful `applyToPublishedJob` result, `await`
   `convergeApplicantToPipeline({ applicationId: res.data.id })` inside a
   `try/catch` that logs and swallows.
3. Do not change the return shape — the applicant response is unchanged.

### 5.3 Shape tests — `src/features/pipeline-convergence/converge-applicant.test.ts`

Follow the codebase source-scan convention (same as
`match-persistence.test.ts` and `talent-pipeline.test.ts`):

1. The helper file exists and exports `convergeApplicantToPipeline`.
2. The helper calls `addToPipeline` with `stage: PipelineStage.SOURCED`
   (grep the source for the exact enum reference — the test refuses a
   plain string).
3. The helper reads `job.recruiterId` and short-circuits when null (grep
   for the guard).
4. The helper wraps `addToPipeline` failures in `logger.warn`, never
   `throw` — grep for absence of `throw` in the file body.
5. `job-actions.ts` calls the helper after `res.ok` and inside a
   `try/catch` — grep both.
6. No file except `src/repositories/talent-pipeline.ts` writes
   `prisma.talentListItem.*` — reuse the T-240 isolation rule (the
   whole-`src/` walker), keep the exemption list narrow.
7. New npm script `test:t247-convergence`.

### 5.4 Admin-posted jobs — deliberate no-op

`Job.recruiterId = null` for admin-posted jobs. They never converge into
a recruiter pipeline; they belong to admin surfaces. Step 5.1 §6 makes
this an early `info` log, not a warning, so nothing lights up a
dashboard.

### 5.5 Retry / idempotency

`addToPipeline` is idempotent on `@@unique([talentListId, candidateUserId])`
(T-240 findUnique + create-then-P2002 recovery). A candidate who
withdraws + re-applies stays as one row on the recruiter's board — the
stage they last were at is preserved (T-240 addToPipeline never demotes).

## 6. Guardrails for Cursor (DO NOT)

- **DO NOT** touch `src/repositories/talent-pipeline.ts`. T-240 is the
  sole owner of that file. If a new capability is needed, raise it
  separately — don't fold it in silently.
- **DO NOT** let a pipeline-write failure fail the candidate apply. The
  application flow succeeds first, converge is a side effect. Wrap in
  try/catch, log, move on.
- **DO NOT** dispatch notifications from here — that's T-249's ticket.
  A `notification-service.dispatch` call is a scope violation for this
  branch.
- **DO NOT** change the `applyToJobAction` response shape or the
  service's `Result` type. Downstream forms/routes read those.
- **DO NOT** change any Prisma schema. Both `Job.recruiterId` and
  `JobApplication` are as they need to be.
- **DO NOT** add a `revalidatePath("/hire/pipeline")` from the apply
  action. That would run in the applicant's request, which is not the
  recruiter's cache scope. The recruiter's board revalidates on their
  own next visit (server-rendered dynamic route).
- **DO NOT** try to converge admin-posted jobs (`recruiterId === null`).
  They have no recruiter to belong to; treat as a clean skip.
- **DO NOT** create files outside `src/features/pipeline-convergence/`
  unless the plan lists them.

## 7. DB safety

No schema change → no migration.

Checkpoint before executing:
- `git status` clean on `feature/T-247-applicant-pipeline-convergence`.
- Record HEAD commit (`57497e9a`) in the PR description as the base.

## 8. Verification

Build + type gates:
- `npm run test:t240-pipeline` — the T-240 isolation guard must still be
  green after T-247 lands (the new helper reads via the repo, but must
  not write outside the repo).
- `npm run test:t247-convergence` — new suite, all green.
- `npx tsc --noEmit` — zero errors on T-247 files.
- `npm run build` — Next.js `Compiled successfully`.
- `npm run lint` — zero issues on T-247 files (191 pre-existing issues
  elsewhere are not this ticket's problem).

Manual test (Chromium + a candidate account):
1. Recruiter signs in on device A, opens `/hire/pipeline` → empty.
2. Recruiter creates + publishes a job at `/hire/jobs/new`.
3. Candidate signs in on a second profile, opens `/jobs`, clicks Apply on
   that job, submits.
4. Recruiter refreshes `/hire/pipeline` → the applicant appears in the
   **Sourced** column with their name (or "Candidate" fallback).
5. Recruiter uses the stage `<select>` to move the applicant to
   **Interviewing** — persists across refresh (T-240 acceptance still
   holds).
6. Candidate applies again to a *different* recruiter's job → they land on
   *that* recruiter's board and not the first one's.
7. Candidate applies to an admin-posted job (`recruiterId = null`) →
   nothing appears on any recruiter's board; the application still lands
   on the candidate's tracker (T-246 UX unchanged).
8. Recruiter deletes the applicant from the pipeline (T-240 trash icon)
   → row goes. Applicant re-applies the same job → they come back at
   SOURCED (idempotent re-add; T-240 addToPipeline handles the race).

Files that should have changed (exact list):
- `docs/plans/147-t247-applicant-pipeline-convergence.md` (this file)
- `src/features/pipeline-convergence/converge-applicant.ts` [new]
- `src/features/pipeline-convergence/converge-applicant.test.ts` [new]
- `src/app/actions/job-actions.ts` [edit — add hook + try/catch]
- `package.json` [edit — add `test:t247-convergence` script]

Evidence for the demo sheet:
- The PR link.
- `npm run test:t247-convergence` output.
- A short screen recording running through steps 1–5 above (recruiter
  board + candidate apply on split screen is ideal).

## 9. Commit message

```
feat(hire): T-247 applicants converge into the recruiter pipeline at SOURCED

When a candidate applies to a recruiter-posted job, the application also
lands on that recruiter's /hire/pipeline board at SOURCED. Same list,
same nine stages, same isolation as the Scout-sourced candidates T-240
already put there.

- src/features/pipeline-convergence/converge-applicant.ts: reads the
  application + job in one query, resolves the recruiter workspace via
  ensureRecruiterWorkspace, calls T-240's addToPipeline. Idempotent
  (re-applying = same row, same stage). Fail-open: a pipeline write
  failure logs and returns, the applicant's own flow already succeeded.
- src/app/actions/job-actions.ts fires the helper after
  applyToPublishedJob succeeds, wrapped in try/catch so a broken
  pipeline never breaks apply.
- Admin-posted jobs (Job.recruiterId is null) are skipped cleanly with
  an info log — no recruiter to attach to.
- Source-scan tests pin the shape: stage is PipelineStage.SOURCED, the
  admin-skip guard is there, no throw in the helper body, the action
  wraps in try/catch, and no code outside the T-240 repository writes
  prisma.talentListItem.

Plan: docs/plans/147-t247-applicant-pipeline-convergence.md.

T-249 (recruiter notifications on the same event) is deliberately not
in this PR — separate branch, next.
```
