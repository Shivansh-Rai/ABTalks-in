# Plan 119 — T-245 recruiter jobs (TC-R-015)

**Status:** implemented on `feature/T-245-recruiter-jobs` (2026-09-10). Local
commits only — no push, no PR (per ticket constraint).
**Test entry point:** `npm run test:recruiter-jobs` (13 tests, all green).

## 1. Goal
Let an approved recruiter own the full lifecycle of a job post — create as
DRAFT, publish, close, reopen — with ownership and visibility rules that hold
across the API, server actions, and page routes. Draft jobs must not be
discoverable by candidates via id enumeration, and closed jobs must refuse new
applications with a human-readable message.

## 2. Current behavior (pre-T-245)
- `Job` had only `isOpen: Boolean` and `createdByAdminId`. There was no
  DRAFT concept and no recruiter owner column — the only writers were
  `src/app/actions/admin-job-actions.ts` (admin-only).
- `getOpenJobs()` filtered `where: { isOpen: true }`; `getJobDetail()`
  returned the row regardless of open/closed and left the closed banner to
  the client component.
- `applyToJobAction` in `src/app/actions/job-actions.ts` refused only when
  `isOpen === false`, with the generic message "This role is closed."
- No test coverage for the job lifecycle.

## 3. Files to touch
- `prisma/schema.prisma` [edit] — add `JobStatus`, `JobWorkMode` enums;
  extend `Job` with `status`, `workMode`, `skills String[]`, `recruiterId`,
  `publishedAt`, `closedAt`; add User back-relation `jobsOwned`; rename the
  existing `Job.skills JobSkill[]` relation to `skillLinks` (no code
  consumers — verified with grep).
- `src/features/recruiter-jobs/lifecycle.ts` [new] — pure state machine
  (`nextStatus`, `lifecyclePatch`, `normalizeSkills`). No IO.
- `src/features/recruiter-jobs/service.ts` [new] — Prisma-injectable
  service: `createRecruiterJob`, `transitionJob`, `updateRecruiterJob`,
  `getJobForCandidate`, `assertApplyAllowed`, `CLOSED_JOB_MESSAGE`.
- `src/features/recruiter-jobs/prisma-store.ts` [new] — real `JobStore`
  adapter that wraps `prisma.job` with an explicit `select` clause.
- `src/app/actions/recruiter-job-actions.ts` [new] — server actions
  (`createRecruiterJobAction`, `updateRecruiterJobAction`,
  `publishRecruiterJobAction`, `closeRecruiterJobAction`,
  `reopenRecruiterJobAction`) gated by `requireApprovedRecruiterAction`.
  Maps service error codes to `{ok:false, status:403|404, message}`.
- `src/app/actions/job-actions.ts` [edit] — `applyToJobAction` now routes
  through `assertApplyAllowed` (single source of truth for the closed guard).
- `src/features/jobs/get-open-jobs.ts` [edit] — filter on
  `status = 'PUBLISHED'`; include `workMode` in the projection.
- `src/features/jobs/get-job-detail.ts` [edit] — return `null` for DRAFT
  so the page renders `notFound()`; add `status`, `skills`, `workMode`,
  `publishedAt`, `closedAt` to the projection.
- `src/app/actions/admin-job-actions.ts` [edit] — admin create sets
  `status: PUBLISHED` + `publishedAt`; admin toggle keeps
  `status`/`isOpen`/`publishedAt`/`closedAt` in sync.
- `src/features/recruiter-jobs/recruiter-jobs.test.ts` [new] — the TC-R-015
  suite plus lifecycle unit tests.
- `package.json` [edit] — register `test:recruiter-jobs` script.
- `docs/CHANGELOG.md` [edit] — reconcile entry.

## 4. Server vs Client
- All feature files (`lifecycle.ts`, `service.ts`, `prisma-store.ts`) are
  server-only modules (no `"use client"`, no React).
- Server Actions live in `src/app/actions/recruiter-job-actions.ts` — no
  new route handlers. Mutations reach the client via `useTransition` /
  form actions in the recruiter UI when that ticket lands.
- No Server → Client prop passing was changed. `ApplyJobButton`'s existing
  `isOpen` prop still works because `isOpen` is kept in sync with `status`.

## 5. Steps (as implemented)
1. **Schema.** Extend `Job` with the lifecycle fields. Default `status`
   to `PUBLISHED` so historical rows added before the column existed stay
   live and applyable after `db push`. `recruiterId` is nullable so legacy
   admin-created rows are valid. Rename `Job.skills` relation to
   `skillLinks` to free the `skills` field name for the new `String[]`
   column. `npx prisma format` + `npx prisma generate` (types
   regenerated; the Windows DLL rename step failed because another node
   process holds it — types are current, DLL refreshes on next clean run).
2. **Pure lifecycle.** `nextStatus` implements the three legal transitions
   (`publish: DRAFT|CLOSED → PUBLISHED`, `close: PUBLISHED → CLOSED`,
   `reopen: CLOSED → PUBLISHED`) and returns `null` for every other pair.
   `lifecyclePatch` derives the field patch (status, `isOpen`,
   `publishedAt` once, `closedAt` every close) so both the service and
   the tests share one authority. `normalizeSkills` trims, dedupes
   case-insensitively, and caps at 25 tags.
3. **Service.** `createRecruiterJob` writes `status: DRAFT`,
   `isOpen: false`, `recruiterId: actor.userId`. `loadOwned` (used by
   every mutation) returns `NOT_FOUND` for a missing row and `FORBIDDEN`
   when `row.recruiterId !== actor.userId` unless the actor is admin.
   `getJobForCandidate` returns `NOT_FOUND` for DRAFT rows — the code
   AND message are identical to the "row doesn't exist" branch so a
   caller cannot distinguish enumeration from a real 404. CLOSED rows
   stay visible so applicants with stale links see the closed banner.
   `assertApplyAllowed` layers the CLOSED guard on top of that, returning
   `CLOSED_JOB_MESSAGE = "This position is closed and no longer accepting applications"`.
4. **Prisma adapter.** `prismaJobStore()` returns a `JobStore` bound to
   the shared `prisma` client with an explicit `select` (CLAUDE.md rule:
   no full-record returns).
5. **Server Actions.** Zod-validated inputs, `requireApprovedRecruiterAction`
   gate, service call, `revalidatePath('/jobs')` + `/recruiter/jobs`.
   Error codes are mapped to `status: 403 | 404` on the result envelope so
   the caller can render the right UI.
6. **Candidate reads.** `getOpenJobs` and `getJobDetail` now key off
   `status`; the admin listing is untouched (it shows all rows). Apply
   flow delegates to `assertApplyAllowed`.
7. **Test suite.** `recruiter-jobs.test.ts` uses an in-memory `JobStore`
   that implements the same interface as `prismaJobStore`, so the
   acceptance suite runs without a database and is deterministic. Every
   TC-R-015 case (1 through 6) is a named test; plus pure-lifecycle unit
   tests and an admin-bypass case.

## 6. Guardrails observed
- **Result envelope everywhere.** Every action returns
  `{ok:true, data} | {ok:false, message, status?}`.
- **Zod at every boundary.** All action inputs are validated.
- **Prisma `select` always.** `prisma-store.ts` uses a shared `SELECT`
  constant; `admin-job-actions.ts` retains its narrow `select`.
- **Logging via `lib/logger`.** No `console.error` in production paths.
- **DRAFT-404 not 403.** Explicitly required by the ticket to avoid
  leaking draft existence via id enumeration; a dedicated test asserts
  the response is byte-identical to the "unknown id" case.
- **No new abstraction files for trivial logic.** The service is not
  wrapped in a repository per se — `prismaJobStore` is 20 lines and
  needed only because tests inject an in-memory equivalent.
- **Edge-safe middleware untouched.** No imports from `@/lib/*` were
  added to any file that reaches `middleware.ts`.
- **078 native.** New rows carry a plain cuid and use `ProgramEnrollment`-
  style ownership; no legacy shadow tables were touched.

## 7. DB safety
- Commit checkpoint: this plan lands after the recruiter-jobs commits
  on `feature/T-245-recruiter-jobs`.
- Neon push: **not run** — per CLAUDE.md I do not push migrations that
  touch shared state without explicit approval. Before deploying:
  1. Stop the local dev server so Prisma's DLL is not locked.
  2. `npx prisma generate`
  3. `npx prisma db push` (per the OTP-verification memory: never
     `migrate reset`).
- No backfill required. `status` defaults to `PUBLISHED`, so every
  existing row's status column materialises as `PUBLISHED` and existing
  live jobs remain visible and applyable. `isOpen` remains the fallback
  the `ApplyJobButton` reads; new lifecycle writes keep the two in sync.

## 8. Verification
- `npx prisma format` → OK.
- `npx prisma generate` → types regenerated
  (`JobStatus`, `JobWorkMode` present in `.prisma/client/index.d.ts`);
  DLL rename blocked by a running node process — cosmetic, retry after
  stopping dev server.
- `npx tsc --noEmit` → exit 0, zero errors.
- `npm run test:recruiter-jobs` → 13 passed, 0 failed:
  - `nextStatus: publish DRAFT → PUBLISHED`
  - `nextStatus: close PUBLISHED → CLOSED, else null`
  - `nextStatus: reopen CLOSED → PUBLISHED only`
  - `lifecyclePatch stamps publishedAt once and closedAt on every close`
  - `normalizeSkills trims, dedupes case-insensitively, drops empties`
  - `TC-R-015-1: recruiter creates a job → saved as DRAFT with recruiterId set`
  - `TC-R-015-2: candidate fetches a DRAFT by id → 404 (not 403, no existence leak)`
  - `TC-R-015-3: recruiter publishes → candidate fetch returns the job`
  - `TC-R-015-4: recruiter closes → candidate apply fails with readable closed message`
  - `TC-R-015-5: recruiter reopens → status flips to PUBLISHED and apply is allowed`
  - `TC-R-015-6: non-owning recruiter update/close is rejected 403`
  - `invalid transitions are rejected with CONFLICT (not silently ignored)`
  - `admin actor can transition any recruiter's job`

Manual localhost check after `db push`:
1. `npm run dev`, sign in as an approved recruiter (a `RecruiterProfile`
   row with `approved: true`).
2. Trigger the lifecycle through the actions (there is no recruiter UI
   yet — see §10). After `publish`, the new job appears on
   `/jobs`; after `close`, it disappears from the list but stays reachable
   at `/jobs/[id]` with the closed banner and refuses new apply attempts.
3. Attempt to open `/jobs/<draft-id>` while signed in as any candidate —
   Next renders the 404 page (never a redirect, never a 403).

Files that MUST have changed (matches diff on branch):
- `prisma/schema.prisma`
- `src/app/actions/admin-job-actions.ts`
- `src/app/actions/job-actions.ts`
- `src/app/actions/recruiter-job-actions.ts` (new)
- `src/features/jobs/get-job-detail.ts`
- `src/features/jobs/get-open-jobs.ts`
- `src/features/recruiter-jobs/lifecycle.ts` (new)
- `src/features/recruiter-jobs/service.ts` (new)
- `src/features/recruiter-jobs/prisma-store.ts` (new)
- `src/features/recruiter-jobs/recruiter-jobs.test.ts` (new)
- `package.json`, `docs/CHANGELOG.md`

## 9. Commit message
```
T-245: recruiter job lifecycle (TC-R-015) — DRAFT/PUBLISHED/CLOSED

Job model gains status (default PUBLISHED — historical rows stay live),
workMode, skills, recruiterId, publishedAt, closedAt. Business logic in
features/recruiter-jobs is Prisma-injectable; recruiter actions gate on
requireApprovedRecruiterAction and refuse non-owners with FORBIDDEN.
Candidates hitting a DRAFT get 404 (identical to unknown-id) so drafts
cannot be enumerated; apply on CLOSED returns the readable closed message.
Admin toggle keeps status/isOpen in sync. 13 acceptance tests passing;
tsc clean.
```

## 10. T-226 alignment (applied 2026-09-10)
T-226 delivered `requireRecruiterWorkspace()` as the single canonical
recruiter entry point (approved + `setupCompletedAt` + active
`OrganizationMember`). The first cut of T-245 gated on
`requireApprovedRecruiterAction()`, which is approved-only — a mid-wizard
recruiter (`approved=true, setupStep != COMPLETE`) could have created and
published jobs, contradicting the T-226 product contract *"recruiter
reaches a working workspace of their own"*.

Swapped every mutation in `src/app/actions/recruiter-job-actions.ts`
(`create/update/publish/close/reopen`) from
`requireApprovedRecruiterAction` → `requireRecruiterWorkspace()`. Two
consequences:

1. Mid-wizard recruiters now hit *"Finish setting up your workspace
   first."* on every job mutation — no jobs escape until setup is COMPLETE.
2. `Job.company` on create is stamped from `workspace.company` (the
   recruiter's registered profile), not from the client payload. The
   `updateRecruiterJobAction` payload's `company` field is dropped
   server-side. This prevents a recruiter posting under a different brand
   than their approved workspace, while still leaving `recruiterId` as
   the ownership FK (per T-226's per-user isolation model).

`Job.recruiterId` continues to point at `User.id` (not
`RecruiterProfile.id` and not `Organization.id`), matching every other
recruiter-scoped table T-226 kept in place (`RecruiterShortlistItem`,
`TalentRequest`, `TalentEngagementRequest`, `VirtualCandidateRequest`).
No `organizationId` on `Job` — T-226 explicitly retired shared-org data.

Verification after gate swap: `npx tsc --noEmit` exit 0;
`npm run test:recruiter-jobs` still 13/13 (the acceptance suite exercises
the service directly, which is unchanged — the gate swap is purely at
the action layer).

### 10a. T-226 full alignment (2026-09-10)

Extended the service with workspace-scoped reads so future recruiter UI
inherits T-226's per-user isolation by construction, not by discipline:

- `JobStore.listByRecruiter(recruiterId)` on both the abstract interface
  and the Prisma adapter; there is no unfiltered "list all jobs" on the
  recruiter path.
- `listRecruiterJobs(deps, actor)` filters strictly on
  `recruiterId === actor.userId` — the actor comes from
  `requireRecruiterWorkspace()`, never from the client.
- `getRecruiterJob(deps, actor, jobId)` returns `NOT_FOUND` (not
  `FORBIDDEN`) for a foreign row, matching the DRAFT-404 pattern so id
  enumeration cannot distinguish "someone else owns this" from "no such
  id" on the read side either.
- Two workspace-scoped server actions: `listMyJobsAction` and
  `getMyJobAction` — both go through `requireRecruiterWorkspace()`.

Three new T-226 alignment tests bring the suite to 16/16:
- `listRecruiterJobs returns only the caller's own jobs (same-domain independence)` — two recruiters with the **same company string** each list their own only.
- `getRecruiterJob returns NOT_FOUND (not FORBIDDEN) for a foreign row` — foreign id and unknown id give byte-identical responses.
- `recruiter B's list excludes A's DRAFT even after A publishes it` — publishing changes candidate visibility, not workspace ownership.

Also re-ran `npm run test:recruiter-workspace` — 17/17 (T-226's own
suite unaffected).

### 10b. Database in sync (2026-09-10)
`npx prisma db push` was run successfully on Neon by the ticket owner;
`prisma generate` regenerated the client. The schema is live: existing
rows all materialised as `status = 'PUBLISHED'` per the column default,
so no backfill was needed and every previously-live job stayed applyable.

## 11. Out of scope / follow-ups
- **No recruiter-facing UI** (no `/recruiter/jobs` list or `/recruiter/jobs/new`
  form). The ticket only required the model, lifecycle, guards, and tests
  — those pages are a natural next ticket.
- **No `db push` executed.** Awaits explicit approval before touching
  Neon; guidance is in §7.
- **Existing candidate list at `/jobs`** is unchanged visually; it now
  keys off `status = 'PUBLISHED'` instead of `isOpen = true`, but the two
  are kept in sync by every writer.
