# Plan 120 — T-246 candidate jobs (TC-C-007, TC-C-008)

**Status:** implemented on `feature/T-246-candidate-jobs` (2026-09-10). Local
commits only — no push, no PR (per ticket constraint).
**Test entry point:** `npm run test:candidate-jobs`.

## 1. Outcome
Candidates can browse published jobs, filter them, apply exactly once per
job, and see the applications they submitted persist across sign-out and
device changes. The single-apply rule is enforced at the **database engine
level** by a unique constraint; a UI-only guard is explicitly rejected as
insufficient.

The ticket sits directly on top of T-245 (plan 119). The `Job` schema,
lifecycle enum (`DRAFT / PUBLISHED / CLOSED`), recruiter ownership column,
and `assertApplyAllowed` gate from T-245 are reused verbatim — nothing in
that surface is rebuilt.

## 2. What must be true
- `getOpenJobs()` / candidate search returns **only** `status = 'PUBLISHED'`
  rows. DRAFT and CLOSED are excluded from the listing.
- Candidate detail view of a DRAFT stays 404 (T-245 rule); CLOSED stays
  visible so a stale link still explains why apply is refused.
- The apply mutation:
  1. Requires an authenticated candidate session (returns readable error
     otherwise).
  2. Reads the job through the shared `assertApplyAllowed` service so the
     T-245 CLOSED banner copy is the single source of truth.
  3. Writes `JobApplication { jobId, userId, status: 'APPLIED' }` in a
     single insert; a P2002 unique-constraint violation is caught and
     mapped to `{ ok:false, status:409, message: DUPLICATE_APPLICATION_MESSAGE }`.
  4. Returns the created application id on success.
- A candidate-scoped query returns every application the caller made,
  newest first, joined with the job title / company / status — enough to
  render the tracking list.
- The `@@unique([userId, jobId])` composite index is present on
  `JobApplication`. (The ticket wrote `@@unique([candidateId, jobId])` —
  same constraint semantically; the column is already named `userId` and
  renaming it would ripple through `get-job-applicants`, `get-job-detail`,
  and existing shipped code. The plan keeps the current name; a comment
  in the schema records the alias.)

## 3. Non-goals
- No candidate-facing filter UI beyond the existing `/jobs` list — the
  service exposes filters, but the page redesign is a separate ticket.
  The tests cover the filter behaviour at the service level.
- No status-transition workflow for the recruiter (moving an application
  from `APPLIED → REVIEWING → ACCEPTED / REJECTED`). The status column
  and enum are laid down now so future work only touches the mutation
  layer, but T-246 does not ship a recruiter-facing status transition.
- No `resumeUrl` upload flow. The column is added as nullable text so the
  future upload flow can populate it without a follow-up migration; the
  apply mutation ignores it for now.
- No notification / email side-effects; T-248 owns that.

## 4. Architecture
Feature module lives at `src/features/candidate-jobs/` and mirrors the
T-245 shape:

- `lifecycle.ts` — the Application status enum and the pure duplicate /
  closed detection helpers (readable message constants). Pure module, no
  IO, no Prisma imports.
- `service.ts` — Prisma-injectable service with two stores:
  - `JobStore` (reused shape from T-245, imported so the two features
    stay type-compatible).
  - `ApplicationStore` — a minimal Prisma-shaped surface with
    `create`, `findByCandidateAndJob`, `listByCandidate`, and
    `listPublishedJobsFiltered`. The in-memory implementation used by
    the test suite enforces the composite unique constraint by throwing
    an error whose `code` is `"P2002"` — matching the production Prisma
    error surface so the caller's error handling is exercised by the
    same code path that runs in production.
- `prisma-store.ts` — the real `ApplicationStore` backed by
  `prisma.jobApplication` and `prisma.job` with explicit `select`.
- `candidate-jobs.test.ts` — TC-C-007 and TC-C-008 acceptance suite,
  executed with `npx tsx` like every other test file in the repo.

The apply mutation continues to live at
`src/app/actions/job-actions.ts` — it now delegates to
`applyToPublishedJob(deps, actor, input)` in the new service so that:
- The closed-job check reuses T-245's `assertApplyAllowed` under the hood.
- The duplicate-application detection lives in one place, and the tests
  can hit it without touching Postgres.
- The tracking list has an explicit `listMyApplications(deps, actor)` the
  server action wraps.

## 5. Data model
`prisma/schema.prisma` (see step 1 in §7):

```prisma
/// T-246 candidate application status. Default APPLIED; recruiter workflow
/// for the remaining transitions ships in a later ticket.
enum JobApplicationStatus {
  APPLIED
  REVIEWING
  ACCEPTED
  REJECTED
}

model JobApplication {
  id          String               @id @default(cuid())
  jobId       String
  userId      String                                     // candidateId (User.id)
  status      JobApplicationStatus @default(APPLIED)
  resumeUrl   String?
  coverLetter String?
  note        String?
  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt
  job         Job  @relation(fields: [jobId], references: [id], onDelete: Cascade)
  user        User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, jobId])                              // single-apply guard
  @@index([userId, createdAt(sort: Desc)])               // tracking-list query
  @@index([jobId])
}
```

Notes:
- The existing `@@unique([jobId, userId])` is replaced with
  `@@unique([userId, jobId])`. The composite is the same in Postgres;
  reordering matches the tracking-list query (candidate-first). The
  `jobId_userId` composite key name changes to `userId_jobId`, so
  `get-job-detail.ts` needs the argument renamed at the same time.
- `updatedAt` did not exist on the previous shape. Every historical row
  is backfilled to the migration timestamp by Prisma's `@updatedAt`
  default-on-create behaviour; no explicit backfill script is required.
- `resumeUrl` / `coverLetter` are nullable so historical rows remain
  valid. Both are text-only in this ticket; upload UX is out of scope.

## 6. Guardrails observed
- **Result envelope everywhere.** Every service function returns
  `{ ok:true, data } | { ok:false, message, code?, status? }`.
- **Zod at every boundary.** The apply action and the tracking action
  both validate their inputs with Zod.
- **Prisma `select` always.** No `findMany({ where })` returns full
  records; every query lists its fields.
- **Multi-step writes wrapped in transactions.** The mutation is single
  write, so no transaction is required; the duplicate guard is the
  server-side unique constraint, not a read-then-write race.
- **Logging via `lib/logger`.** No `console.error` on production paths.
- **Edge-safe middleware untouched.** Nothing in this feature reaches
  `middleware.ts` — the mutation is a Server Action, the reads are
  server-only.
- **Server Components by default.** No new `"use client"` files. The
  existing `apply-job-button` stays unchanged.
- **078 native.** No touch to legacy shadow tables. The `User` FK is
  the same one T-245 uses (`User.id`), consistent with how every other
  recruiter/candidate-scoped table in T-226 works.
- **Reuse over rebuild.** No duplicate CLOSED-guard logic — the
  candidate apply path calls `assertApplyAllowed` from
  `features/recruiter-jobs/service.ts`. No parallel Job schema.

## 7. Steps (as implemented)
1. **Schema.** Add `JobApplicationStatus`. Extend `JobApplication` with
   `status`, `resumeUrl`, `coverLetter`, `updatedAt`. Replace the
   `@@unique([jobId, userId])` composite with `@@unique([userId, jobId])`
   and add the `[userId, createdAt(sort: Desc)]` index. Rename
   `get-job-detail.ts`'s composite-key access from `jobId_userId` to
   `userId_jobId` at the same time so the type-check stays clean.
2. **Feature module.**
   - `lifecycle.ts` — export `Result<T>`,
     `DUPLICATE_APPLICATION_MESSAGE`, plus a tiny helper
     `isPrismaUniqueViolation(err)` that centralises the P2002 check.
   - `service.ts` — define `ApplicationRow`, `ApplicationStore`,
     `JobFilterInput`, `browsePublishedJobs`,
     `applyToPublishedJob` (calls into T-245's `assertApplyAllowed`,
     writes the row, translates P2002 to the 409 envelope), and
     `listMyApplications`.
   - `prisma-store.ts` — the real `ApplicationStore` backed by Prisma
     with explicit `select`.
3. **Rewire the existing apply action.**
   `src/app/actions/job-actions.ts` calls `applyToPublishedJob` and
   propagates the returned message + status. Legacy string
   `"You've already applied to this role."` is replaced by the new
   `DUPLICATE_APPLICATION_MESSAGE`.
4. **Server Action for tracking.**
   Add `listMyApplicationsAction()` in the same file. Zod-validates
   nothing (no input); Auth-gates the session; delegates to
   `listMyApplications`.
5. **Test suite.** `candidate-jobs.test.ts` uses an in-memory
   `ApplicationStore` that enforces the composite unique constraint by
   throwing an object with `code: "P2002"` — the same signal Prisma
   surfaces. Every TC-C-007 and TC-C-008 case is a named test.
6. **package.json.** Register `test:candidate-jobs`.
7. **CHANGELOG.** Add a Pending reconcile line.

## 8. TC-C-007 / TC-C-008 test spec
`src/features/candidate-jobs/candidate-jobs.test.ts` asserts:

**Pure lifecycle**
- `DUPLICATE_APPLICATION_MESSAGE` is the ticket-mandated copy.
- `isPrismaUniqueViolation` matches P2002 and only P2002.

**TC-C-007 — single-apply server-side guard**
- 007-1: candidate applies to a PUBLISHED job → `{ok:true}`, the row
  exists with `status: 'APPLIED'`.
- 007-2: same candidate re-applies → `{ok:false, status:409,
  message: DUPLICATE_APPLICATION_MESSAGE}` and no second row is written.
- 007-3: candidate applies to a CLOSED job → `{ok:false,
  message: CLOSED_JOB_MESSAGE}` (the T-245 constant) and no row exists.
- 007-4: candidate applies to a DRAFT job → `{ok:false,
  message: "Job not found"}` (byte-identical to unknown-id — this
  guarantees T-245's enumeration guard extends through the apply path).
- 007-5: two different candidates both apply to the same PUBLISHED job
  → both succeed. (The unique constraint is per candidate, not per job.)

**TC-C-008 — tracking & multi-device persistence**
- 008-1: after two applies, the candidate's tracking list returns both
  rows, newest first, each in `APPLIED` status.
- 008-2: a fresh session for the same candidate (a second call to
  `listMyApplications` with a new actor object carrying the same
  `userId` — the moral equivalent of a re-login on another device)
  returns the same rows, unchanged. Persistence is a property of the
  store, not the session.
- 008-3: `browsePublishedJobs` strictly excludes DRAFT and CLOSED. A
  seeded store with one of each returns only the PUBLISHED row.
- 008-4: `browsePublishedJobs` with location / workMode /
  opportunityType / skills filters returns the intersecting rows and
  never leaks DRAFT / CLOSED into the result.
- 008-5: a candidate's tracking list is scoped to that candidate —
  candidate B's list must not contain candidate A's applications, even
  when they applied to the same job.

## 9. Decision records
- **Reuse `JobApplication` model instead of introducing a new
  `Application` model.** The ticket text says "Add/extend the
  Application model"; the existing `JobApplication` is exactly that
  model under an older name, with the composite unique key already in
  place. Renaming it would ripple through three already-shipped code
  paths (`get-job-detail`, `get-job-applicants`, `job-actions`) with
  zero product benefit. Extend, do not rename.
- **Composite unique is `[userId, jobId]`, not `[candidateId, jobId]`.**
  Same Postgres constraint semantically. The ticket copy uses
  "candidateId" as the conceptual field name; a doc comment in the
  schema records the alias so future readers do not misread it.
- **Status default is `APPLIED`, not nullable.** The Postgres default is
  what enforces the ticket's requirement that a new application is
  always `APPLIED`; a nullable status would let a bad writer bypass it.
- **CLOSED job apply attempts go through `assertApplyAllowed` from
  T-245.** Duplicating the CLOSED check would create a divergence risk
  the moment the readable copy changes. Same file, same constant.
- **DRAFT job apply attempts return "Job not found", not "closed".**
  T-245 requires DRAFT to be indistinguishable from an unknown id; the
  apply path inherits that rule for free by calling
  `getJobForCandidate` first.
- **P2002 mapping lives in the service, not the action.** So a future
  API route or programmatic caller that skips the action layer still
  gets the correct 409 envelope. Actions become thin serializers.
- **In-memory `ApplicationStore` enforces the unique constraint by
  throwing a P2002-shaped error.** This gives the test suite an honest
  end-to-end assertion of the mapping without requiring Postgres.
- **Do not use `Prisma.PrismaClientKnownRequestError` `instanceof`
  check.** The check is done by shape (`typeof err === "object" && err
  && "code" in err && err.code === "P2002"`) so the pure `lifecycle.ts`
  module stays free of any Prisma import — necessary for the tests to
  import it without pulling the client into the test process.

## 10. Verification
- `npx prisma format` — must exit 0.
- `npx prisma generate` — regenerates types with `JobApplicationStatus`
  and the extended `JobApplication` shape.
- `npx tsc --noEmit` — must exit 0.
- `npm run test:candidate-jobs` — every test above passes.
- `npm run test:recruiter-jobs` — must still pass (T-245 not touched).

## 11. DB safety
- Commit checkpoint: this plan is committed before any Neon push.
- `npx prisma db push` is **not run** by this session — following
  CLAUDE.md's rule against touching shared state without explicit
  approval. When approved:
  1. Stop the local dev server (Prisma DLL lock on Windows).
  2. `npx prisma generate`
  3. `npx prisma db push`
- Historical `JobApplication` rows: `status` materialises as
  `'APPLIED'` per the column default; `resumeUrl` and `coverLetter` are
  nullable and populate as `NULL`; `updatedAt` seeds to now on migrate.
  The composite-unique swap is a rename of the constraint pair; Prisma
  drops the old `(jobId, userId)` and creates `(userId, jobId)` — no
  data loss because the same pair remains unique either way.

## 12. Commit message
```
T-246: candidate jobs — browse, filter, apply once, track (TC-C-007/008)

Extend JobApplication with status/resumeUrl/coverLetter/updatedAt and a
composite unique on [userId, jobId] so the single-apply guard is enforced
by Postgres, not the UI. New src/features/candidate-jobs service wraps
T-245's assertApplyAllowed for the CLOSED guard, maps Prisma P2002 to a
409 with a readable duplicate message, and exposes a candidate-scoped
tracking list. Acceptance suite covers TC-C-007 (single-apply, closed,
draft, cross-candidate independence) and TC-C-008 (tracking, session
persistence, browse filtering). tsc clean; no push, no PR.
```
