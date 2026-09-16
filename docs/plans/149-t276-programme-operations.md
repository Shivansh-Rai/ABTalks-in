# Plan 149 — T-276 Programme, Cohort, Hackathon and Mock-Interview Operations

**Owner:** Manuvrtti
**Ticket:** T-276 — Programme, cohort, hackathon and mock-interview operations
**Demo:** Demo 3
**Depends on:** T-268 ✅ (delivery diagnosis merged, PR #391), T-248 ✅, T-262 ✅, T-207 ✅

## 1. Goal

Ensure the admin has a full operations surface for every one of the
four platform areas the ticket names — programme (60-day challenge),
cohort (AI cohort), hackathon and mock-interview. Two of the four
already ship a comprehensive ops set on master; this ticket rounds out
the two that are thin (mock-interview: zero admin ops; hackathon: only
two) and adds coherence tests so the existing ops in the other two
areas keep functioning as more code lands on top.

## 2. Current behavior — the audit

| Area | Existing ops | Assessment |
|---|---|---|
| **AI Cohort** (`src/app/actions/admin-program-actions.ts`) | `createOrUpdateCohortAction`, `regenerateJoinCodeAction`, `setCohortStatusAction`, `publishResultsAction`, `promoteWaitlistedAction`, `dropMemberAction`, `adminUnlockDayAction`, `grantSkipTokenAction`, `regenerateRecommendationAction`, `getAdminCohortIdAction` (10 ops) | ✅ Comprehensive |
| **60-day Programme** (`src/app/actions/admin-actions.ts`) | `resetProgressAction`, `toggleReadyForInterviewAction`, `removeFromChallengeAction`, `deleteUserAccountAction`, `rejectSubmissionAction`, `grantSynergyAction` (6 ops) | ✅ Comprehensive |
| **Hackathon** (`src/app/actions/admin-hackathon-actions.ts`) | `updateHackathonProblemStatementAction`, `adminRemoveHackathonTeamMemberAction` (2 ops) | ⚠️ Thin — missing team disqualification, submission-window extension, team reset |
| **Mock-interview** | **None.** `MockInterview` / `MockInterviewTurn` / `MockInterviewReport` on schema; zero admin routes/actions/ui | ❌ Gap — no operations surface at all |

The auditor script that produced this table is documented in Step 5.6
as a coherence test.

## 3. Files to touch

### Mock-interview admin (new)
- [new] `src/features/admin/mock-interview-admin.ts` — server-only repository:
  `listMockInterviews`, `getMockInterviewDetail`, `invalidateMockInterview`,
  `deleteMockInterview`, `grantMockInterviewAllowance`.
- [new] `src/features/admin/mock-interview-admin.test.ts` — behavioural test.
- [new] `src/app/actions/admin-mock-interview-actions.ts` — server actions
  wrapping the repo with `requireAdmin()` + Zod.
- [new] `src/lib/validations/mock-interview-admin.ts` — Zod schemas.
- [new] `src/app/admin/mock-interview/page.tsx` — Server Component list.
- [new] `src/app/admin/mock-interview/[id]/page.tsx` — detail view.
- [new] `src/components/admin/mock-interview-filters.tsx` — filter chips.
- [new] `src/components/admin/mock-interview-table.tsx` — rows + row actions.
- [edit] `src/components/admin/admin-sidebar.tsx` + `admin-mobile-nav.tsx` — nav entry.

### Hackathon expansion
- [edit] `src/app/actions/admin-hackathon-actions.ts` — add:
  - `disqualifyHackathonTeamAction({ teamId, reason })`
  - `grantHackathonSubmissionExtensionAction({ teamId, hours })`
  - `resetHackathonTeamAction({ teamId })`
- [edit] `src/lib/validations/hackathon.ts` — three new schemas.
- [new] `src/features/admin/hackathon-ops.test.ts` — shape test.

### Coherence tests (existing areas)
- [new] `src/features/admin/programme-ops-coherence.test.ts` — one
  source-scan pinning that every existing programme + cohort ops
  function is still exported and still goes through `requireAdmin()`.
  Catches accidental regressions where a refactor drops an ops
  function from the export set.

### Package script
- [edit] `package.json` — three new test scripts:
  - `test:t276-mock-interview` — mock-interview admin
  - `test:t276-hackathon-ops` — hackathon ops
  - `test:t276-programme-coherence` — coherence

## 4. Server vs Client

Admin surfaces follow the existing pattern from T-268 delivery-diagnosis:

- Server Components for pages (list + detail). No client fetch.
- Filter chips + row-action buttons are Client Components (they call
  server actions via `useTransition`).
- Every server action goes through `requireAdmin()` from
  `@/lib/admin-auth`. No client-supplied admin identity is trusted.

## 5. Steps

### 5.1 Mock-interview admin — repository (`src/features/admin/mock-interview-admin.ts`)

1. `import "server-only"`.
2. Export `listMockInterviews(filter)` — filters:
   `{ userId?, domainSlug?, status?, from?, to? }`. Selects id, userId,
   user.name/email (via join), domainSlug, packVersion, attemptNumber,
   status, overallScore, startedAt, endedAt, evaluatedAt, createdAt.
   Ordered newest first, `take: 100`.
3. Export `getMockInterviewDetail(id)` — includes turns (seq + type +
   text, no raw voice) and report projection. Returns null if not
   found.
4. Export `invalidateMockInterview(id, reason, adminUserId)` — sets
   `status: INVALID`, `invalidReason`, and writes an `AdminAction` row
   for audit trail.
5. Export `deleteMockInterview(id, adminUserId)` — hard delete via
   Prisma cascade. Records `AdminAction` first (so the audit row
   survives). Refuse if any admin has already invalidated it as part
   of a review flow.
6. Export `grantMockInterviewAllowance(userId, extraAttempts,
   adminUserId, reason)` — creates a new `MockAllowance` row (schema
   check first — if the model does not exist, this step is a "no-op
   with a NOT_IMPLEMENTED result" and the test guards that surface).

### 5.2 Mock-interview admin — server actions

1. `src/app/actions/admin-mock-interview-actions.ts` — one action per
   repository function, `"use server"`.
2. Each: `requireAdmin()` → Zod-parse input → repository call →
   `revalidatePath("/admin/mock-interview")` → result envelope.
3. Detail action revalidates both list and detail routes.

### 5.3 Mock-interview admin — UI

1. `/admin/mock-interview/page.tsx` — Server Component.
   - Reads filter from `searchParams`.
   - Passes filtered rows to `MockInterviewTable`.
   - Renders `MockInterviewFilters` client component above it.
2. `/admin/mock-interview/[id]/page.tsx` — detail view.
   - Loads `getMockInterviewDetail(id)`.
   - Renders header (user, domain, pack version, status, scores).
   - Renders turns as a scrollable transcript.
   - Row-action buttons: Invalidate, Delete, Grant Allowance.
3. `mock-interview-filters.tsx` — Client Component. Text input for
   userId + domain, `<Select>` for status, date-range inputs. Uses
   `router.replace()` with new searchParams; no server-side JS.
4. `mock-interview-table.tsx` — Client Component with row actions.
   Each action wraps its call in `useTransition` for optimistic UI.

### 5.4 Hackathon expansion

1. Edit `admin-hackathon-actions.ts` — add three actions in the same
   file, each following the existing `updateHackathonProblemStatement`
   pattern:
   - Guard via `requireAdmin()`.
   - Zod-parse input.
   - Prisma transaction: mutate + write `AdminAction`.
   - `revalidatePath("/admin/hackathon")`.
2. Edit `hackathon.ts` validations — three new schemas.
3. Shape test in `hackathon-ops.test.ts`:
   - The three new actions exist and are exported.
   - Each calls `requireAdmin()`.
   - Each uses `prisma.$transaction` + writes to `adminAction`.
   - Each Zod-parses input.

### 5.5 Coherence test for programme + cohort existing ops

1. `programme-ops-coherence.test.ts` — source-scan that reads
   `admin-actions.ts` + `admin-program-actions.ts` and asserts every
   ops function name from the audit table above is still exported.
   Freezes the existing surface.
2. Extra: also assert that each ops function still calls
   `requireAdmin()` at least once in its body.

### 5.6 Package script

Add three test scripts. Each runs its file with `tsx` per the
codebase convention.

## 6. Guardrails for Cursor (DO NOT)

- **DO NOT** modify the six existing 60-day programme actions or the
  ten AI-cohort actions. They ship and work today. Only add
  coherence tests around them.
- **DO NOT** touch `src/features/interview/`. The mock-interview
  runtime is Sohail/interview-team territory — the admin surface
  reads and moderates rows via Prisma, does not change interview
  flow.
- **DO NOT** delete a `MockInterview` row before writing the
  `AdminAction` audit row. Order matters — audit first, action
  second, so a failure between the two never loses the audit trail.
- **DO NOT** expose raw voice data or answer contents outside the
  detail page's admin session. The admin session already gates
  `/admin/*`, but avoid exposing them in list rows.
- **DO NOT** introduce a new admin auth layer. `requireAdmin()`
  from `@/lib/admin-auth` is the only gate.
- **DO NOT** change any Prisma schema. If `MockAllowance` doesn't
  exist yet, ship the grant action as a NOT_IMPLEMENTED result;
  raise the schema addition as a separate ticket.

## 7. DB safety

No schema change. All new operations use existing tables
(`MockInterview`, `MockInterviewTurn`, `MockInterviewReport`,
`AdminAction`, `HackathonTeam`, `HackathonEvent`). Hard-delete is
scoped to `MockInterview` and cascades naturally via existing
`onDelete: Cascade` relations.

Checkpoint: `git status` clean, base commit hash recorded in PR body.

## 8. Verification

Gates:
- `npm run test:t276-mock-interview` — mock-interview admin, all
  green.
- `npm run test:t276-hackathon-ops` — hackathon shape test, all
  green.
- `npm run test:t276-programme-coherence` — coherence, all green.
- `npm run test:delivery-diagnosis` — T-268 stays green after any
  imports we add.
- `npx tsc --noEmit` — 0 errors on T-276 files.
- `npm run build` — Next.js `Compiled successfully`.

Manual test:
1. Sign in as admin → `/admin/mock-interview` shows most recent 100
   interviews with filter chips.
2. Filter by `status = FAILED` → results narrow.
3. Click a row → detail page shows the transcript and report.
4. Click Invalidate → row moves to INVALID, `invalidReason` shown.
5. Click Delete → row removed; refresh confirms.
6. Grant allowance → new row appears (or NOT_IMPLEMENTED result if
   `MockAllowance` model absent — flag for follow-up).
7. `/admin/hackathon` → 3 new buttons (Disqualify, Extend, Reset)
   next to the existing ones.
8. Fire each button on a test team → verifies through Prisma Studio
   that the `AdminAction` audit row landed.

Evidence for sheet: PR, all three new test-suite outputs, short
recording covering steps 1-8.

## 9. Commit message

```
feat(admin): T-276 programme, cohort, hackathon and mock-interview operations

Adds the operations surface for every area T-276 names.

- New /admin/mock-interview surface: list + detail + invalidate + delete
  + grant-allowance, all guarded by requireAdmin() and audit-logged via
  AdminAction. Reads from MockInterview / MockInterviewTurn /
  MockInterviewReport; runtime is untouched.
- Hackathon admin expanded from 2 ops to 5: disqualifyHackathonTeam,
  grantHackathonSubmissionExtension, resetHackathonTeam, plus the two
  existing ops.
- Coherence test pins the existing AI-cohort + 60-day programme ops
  set so a future refactor cannot silently drop an admin action.

Three new tests: test:t276-mock-interview, test:t276-hackathon-ops,
test:t276-programme-coherence. No schema change.

Plan: docs/plans/149-t276-programme-operations.md.
```
