# 145 — T-272 disable / restore / secure, T-270-minimum audit, T-277 runtime config, T-217 candidate hard-delete, T-282 regression

Display / product: Demo 3 account operations (TC-A-010), runtime config (TC-A-012), candidate self-delete (D-13 / T-217), pre-September journeys (TC-S-008).

**This plan is the implementation spec. Do not add files, features, or abstractions it does not list.**

Locked decisions from the assigning chat (2026-09-14):

| Decision | Locked value |
|---|---|
| This chat | Plan only. No code until a later request executes this file. |
| Scope | T-272 + T-270-minimum + T-277 + T-282 + candidate self-delete |
| T-217 | Sohail is an assigned **contributor**. Owner remains Shivansh. |
| Secure | Invalidate every JWT now. Password hash unchanged. Operator never sees or sets a password. |
| Disable targets | Any non-admin account (candidate, recruiter, leftover roles). Never self. Never another Platform Admin. |
| Disable side effects | Full freeze: refuse sign-in, kill sessions, hide from recruiter search, server-refuse stale cookies. |
| Self-delete | Candidates only. True wipe of **that candidate's** data. Recruiter self-delete is out of scope. |
| Operator UI | Existing `/admin/students/[id]` and `/admin/recruiters` chrome. No new admin section routes. Shallika restyles later (T-207). |
| Config UI | Existing `/admin` overview page. |

---

## 0. Ownership (pre-implementation check)

TASK: T-272 / T-270-minimum / T-277 / T-282 / T-217 (contributor)

MODULE: Platform Admin, auth, audit, runtime config (Sohail). Candidate profile danger-zone (Shivansh). Mock-interview allowance consumption (Shivansh). Recruiter directory row actions (Zainab).

PRIMARY OWNER: Sohail for T-272, T-270, T-277, T-282. Shivansh for T-217. Sohail is an assigned contributor on T-217.

MY ROLE: PRIMARY OWNER on Sohail tickets; CONTRIBUTOR on T-217 and on the mock-interview start gate required for T-277 to be demoable.

CROSS-MODULE CHANGE: YES — assigned in this request.

DATABASE IMPACT: SCHEMA (one migration) + WRITE.

SECURITY OR AUTH IMPACT: YES.

---

## 1. Goal

An operator can disable, restore, and secure any non-admin account with a mandatory reason and an audit row. A disabled account is refused at sign-in by the Node `auth()` callbacks, existing JWTs die immediately, recruiter search hides them, and they cannot act. Secure signs them out of every device without anyone seeing or setting a password. A candidate can delete their own account and have **their** data removed from ABTalks the same request. Starting credits, unlock cost, free mock allowance, and mock point cost are rows an operator edits without a deploy. The seven pre-September journeys still compile and still have their server entry points.

## 2. Current behavior

- **Disable / restore / secure do not exist.** `User` has `deletedAt` / `anonymizedAt` only.
- **Plan 119 admin soft-delete is live:** `anonymizeUser` scrubs PII, stamps `deletedAt`, refuses sign-in, **keeps** certificates / points / credentials, and **cannot be restored** (email rewritten to `deleted+{id}@deleted.local`). Trigger: red **Delete user account** on `/admin/students/[id]`. Leave this button alone. T-272 is the reversible operator path. Do not call `anonymizeUser` from disable / restore / secure / self-delete.
- **Auth is JWT** (`auth.config.ts` `session.strategy: "jwt"`). `Session` table rows are not the live session. `auth.ts` already refuses `deletedAt` in recruiter OTP `authorize`, dev `authorize`, `signIn`, and `session`. Edge `auth.config.ts` / `middleware.ts` cannot import Prisma.
- **T-270 is not built.** `AdminAction` is who / what / required `targetUserId` / optional `reason` / `metadata`. No `entityType`, no `entityId`, no before/after. Target FK is `onDelete: Cascade`, so deleting a user **deletes the audit of what happened to them**. Actor FK is also Cascade, so a candidate who is the actor of their own self-delete would wipe that row too. Plan 123 drafted the additive columns; it is unsigned. This plan **signs** those columns and additionally snapshots the actor as a non-FK string so a hard-delete cannot erase the record.
- **T-277 is half-built.** `PlatformConfig` + `src/lib/platform-config.ts` already serve `credits.starting_grant_minor` (default 20000) and `credits.contact_unlock_cost_minor` (default 1000). There is **no write helper and no admin UI**. Mock interviews have **no** allowance or point-cost keys. `startAttempt` currently treats retakes as free (`src/features/interview/platform/service.ts`).
- **T-217 is not built.** No candidate-facing delete control on `/profile`. D-13 still requires immediate self-delete.
- **Hard `User` delete is blocked today** by Restrict FKs: `Certificate`, `SynergyEvent`, `Credential`, `PointsTransaction`, `CandidateAchievement`, `CreditTransaction.candidateUserId`, `CreditTransaction.recruiterUserId`, `AssessmentReport`, `TalentEngagementRequest.candidateUserId`.
- **Recruiter admin** is a list at `/admin/recruiters` (`AdminRecruitersPanel` is a Server Component, no per-row actions, `userId` is not passed to the client). T-266 recruiter detail does not exist.
- **Search gate** is `searchableUserWhere()` in `src/repositories/talent.ts`: `deletedAt: null` plus visibility. Disabled users would still appear.

## 3. Files to touch

### Schema / seed

- [`prisma/schema.prisma`](prisma/schema.prisma) **[edit]** — User disable + session fields; AdminAction T-270 columns; FK behaviour for candidate wipe; `PointsSourceType.MOCK_INTERVIEW`.
- [`prisma/migrations/20260915090000_t272_account_ops_audit/migration.sql`](prisma/migrations/20260915090000_t272_account_ops_audit/migration.sql) **[new]** — the SQL for those schema changes plus the actorUserId backfill.
- [`prisma/seed-platform-config.ts`](prisma/seed-platform-config.ts) **[edit]** — upsert the two mock keys.

### T-270 minimum

- [`src/features/admin/audit.ts`](src/features/admin/audit.ts) **[new]** — `writeAudit(tx, input)` only. No other audit helper.
- [`src/features/admin/audit.test.ts`](src/features/admin/audit.test.ts) **[new]**
- [`src/features/admin/get-admin-actions-feed.ts`](src/features/admin/get-admin-actions-feed.ts) **[edit]** — null-safe target; search by `q` on actionType / entityId / reason / actorUserId.
- [`src/app/admin/actions/page.tsx`](src/app/admin/actions/page.tsx) **[edit]** — search box query param `q`; do not 404 when `targetUserId` is null.
- [`src/components/admin/admin-actions-filters.tsx`](src/components/admin/admin-actions-filters.tsx) **[edit]** — keep existing type/admin filters; add a text input that sets `q`.

### T-272 account ops

- [`src/features/admin/account-ops.ts`](src/features/admin/account-ops.ts) **[new]** — `disableAccount` / `restoreAccount` / `secureAccount` (transactional, reason required).
- [`src/lib/account-status.ts`](src/lib/account-status.ts) **[new]** — `isAccountFrozen(user)` pure helper + `ACCOUNT_DISABLED_MESSAGE` constant. No Prisma.
- [`src/app/actions/admin-account-actions.ts`](src/app/actions/admin-account-actions.ts) **[new]** — three Server Actions, `requireAdmin`, Zod.
- [`src/components/admin/account-ops-dialog.tsx`](src/components/admin/account-ops-dialog.tsx) **[new]** — one client dialog used for disable, restore, and secure. Reason textarea. **No password field, anywhere.**
- [`src/components/admin/student-action-panel.tsx`](src/components/admin/student-action-panel.tsx) **[edit]** — mount the three actions; pass `disabledAt`.
- [`src/app/admin/students/[id]/page.tsx`](src/app/admin/students/[id]/page.tsx) **[edit]** — pass `disabledAt` / `disabledReason`; banner when frozen; mount ops on the hackathon branch too.
- [`src/features/admin/get-student-detail.ts`](src/features/admin/get-student-detail.ts) **[edit]** — select `disabledAt`, `disabledReason`. Still `notFound` on `deletedAt`. **Do not select `password`.**
- [`src/features/talent-pool/recruiter-registration.ts`](src/features/talent-pool/recruiter-registration.ts) **[edit]** — add `userId` and `disabledAt` to `RecruiterDirectoryRow`.
- [`src/components/talent/admin-recruiters-panel.tsx`](src/components/talent/admin-recruiters-panel.tsx) **[edit]** — render `AccountOpsDialog` per row. This file becomes a client component **or** (preferred) stays a Server Component and maps a new client child `RecruiterAccountOps` defined in `account-ops-dialog.tsx`.
- [`src/auth.ts`](src/auth.ts) **[edit]** — refuse `disabledAt` the same way as `deletedAt`; refuse JWT when `token.iat` is older than `sessionInvalidatedAt`.
- [`src/repositories/talent.ts`](src/repositories/talent.ts) **[edit]** — `searchableUserWhere` adds `disabledAt: null`.
- [`src/features/interview/platform/provider.ts`](src/features/interview/platform/provider.ts) **[edit]** — `deletedAt: null` AND `disabledAt: null`.
- [`src/features/admin/account-ops.test.ts`](src/features/admin/account-ops.test.ts) **[new]**

### T-277 config

- [`src/lib/platform-config.ts`](src/lib/platform-config.ts) **[edit]** — register mock keys; add `writeIntConfig`.
- [`src/app/actions/admin-config-actions.ts`](src/app/actions/admin-config-actions.ts) **[new]**
- [`src/components/admin/platform-config-panel.tsx`](src/components/admin/platform-config-panel.tsx) **[new]** — client editor, four int fields, reason required.
- [`src/app/admin/page.tsx`](src/app/admin/page.tsx) **[edit]** — mount the panel below the existing stats. Load current values on the server and pass numbers only.
- [`src/features/interview/platform/service.ts`](src/features/interview/platform/service.ts) **[edit]** — consume free allowance + point cost in `startAttempt`; refund on technical failure.
- [`src/app/mock-interviews/page.tsx`](src/app/mock-interviews/page.tsx) **[edit]** — signed-in header line: `N free mock interviews remaining` (server-computed).
- [`src/lib/platform-config.test.ts`](src/lib/platform-config.test.ts) **[new]**
- [`src/features/interview/platform/mock-allowance.test.ts`](src/features/interview/platform/mock-allowance.test.ts) **[new]**

### T-217 candidate wipe

- [`src/features/profile/delete-own-account.ts`](src/features/profile/delete-own-account.ts) **[new]** — `deleteOwnCandidateAccount(tx, { userId })`.
- [`src/app/actions/candidate-account-actions.ts`](src/app/actions/candidate-account-actions.ts) **[new]** — `deleteOwnAccountAction`.
- [`src/components/profile/delete-own-account-dialog.tsx`](src/components/profile/delete-own-account-dialog.tsx) **[new]**
- [`src/app/profile/page.tsx`](src/app/profile/page.tsx) **[edit]** — mount the dialog in a "Delete account" block after the wizard, signed-in candidate only. No redesign of the wizard.
- [`src/features/profile/delete-own-account.test.ts`](src/features/profile/delete-own-account.test.ts) **[new]**

### T-282

- [`src/features/admin/pre-september-regression.test.ts`](src/features/admin/pre-september-regression.test.ts) **[new]**
- [`package.json`](package.json) **[edit]** — four npm scripts listed in §8.

### Docs

- [`docs/CHANGELOG.md`](docs/CHANGELOG.md) **[edit]** — one pending-reconcile line.

**Do not edit** `CLAUDE.md`, `docs/project-context.md`, `middleware.ts`, `auth.config.ts`, `src/components/ui/**`, or plan 119's `anonymize-user.ts`.

## 4. Server vs Client

| Piece | Kind |
|---|---|
| `audit.ts`, `account-ops.ts`, `delete-own-account.ts`, `platform-config.ts` `writeIntConfig`, `account-status.ts` | Server only (`server-only` on all except `account-status.ts`, which is pure). |
| All `src/app/actions/*` listed above | Server Actions. |
| `account-ops-dialog.tsx`, `platform-config-panel.tsx`, `delete-own-account-dialog.tsx`, `admin-actions-filters.tsx` | Client. |
| `/admin/students/[id]/page.tsx`, `/admin/recruiters/page.tsx`, `/admin/page.tsx`, `/admin/actions/page.tsx`, `/profile/page.tsx`, `/mock-interviews/page.tsx` | Server. Pass serializable props only (ids, names, ISO strings, numbers, booleans). No functions, no icons, no class instances. |

`auth.config.ts` and `middleware.ts` stay edge-safe: **no Prisma, no `@/lib/*`, no new imports.**

## 5. Schema (one migration)

Neon: create a **child branch from production** and run this migration only on that child (or local). Never against the default/production branch unless the user explicitly authorizes that production write in the same request.

### 5.1 `User`

```prisma
disabledAt            DateTime?
disabledReason        String?
disabledByUserId      String?
sessionInvalidatedAt  DateTime?
```

No index required beyond the existing `deletedAt` index. Add `@@index([disabledAt])`.

### 5.2 `AdminAction` (T-270 minimum — signs plan 123, plus actor snapshot)

```prisma
model AdminAction {
  id              String   @id @default(cuid())
  actorUserId     String
  adminUserId     String?
  targetUserId    String?
  entityType      String?
  entityId        String?
  previousState   Json?
  newState        Json?
  organizationId  String?
  actionType      String
  metadata        Json?
  reason          String?
  createdAt       DateTime @default(now())

  admin  User? @relation("AdminActor",  fields: [adminUserId],  references: [id], onDelete: SetNull)
  target User? @relation("AdminTarget", fields: [targetUserId], references: [id], onDelete: SetNull)

  @@index([targetUserId])
  @@index([createdAt])
  @@index([entityType, entityId, createdAt(sort: Desc)])
  @@index([actorUserId, createdAt(sort: Desc)])
}
```

SQL order:

1. Add nullable columns `entityType`, `entityId`, `previousState`, `newState`, `organizationId`, `actorUserId`.
2. `UPDATE "AdminAction" SET "actorUserId" = "adminUserId" WHERE "actorUserId" IS NULL`.
3. `ALTER COLUMN "actorUserId" SET NOT NULL`.
4. Drop NOT NULL on `targetUserId` and `adminUserId`.
5. Drop both User FKs; re-add them `ON DELETE SET NULL`.
6. Create the new indexes.

Existing 29 `adminAction.create` call sites keep compiling: they still pass `adminUserId` + `targetUserId` + `actionType`. They do **not** need to pass `actorUserId` until they switch to `writeAudit`. Prisma will require `actorUserId` after generate — **this is the one incompatibility**. Handle it by keeping a thin wrapper used **only by the 29 old call sites is out of scope**; instead, add a Prisma `middleware`? **No. Do not add Prisma middleware.**

**Required compatibility fix:** after `actorUserId` is NOT NULL, the 29 raw `adminAction.create` calls will fail typecheck. This plan therefore **does** edit those 29 sites in one mechanical way only: each `data: { adminUserId, ...}` also sets `actorUserId: adminUserId` (or the local variable already used). No other field changes. No new helper adoption at those 29 sites except that one extra key. That is the acceptance bar from plan 123, adjusted for the actor snapshot this wipe requires.

If a create uses a spread, add `actorUserId` next to `adminUserId`.

### 5.3 Candidate wipe FKs (signed: true hard-delete of **candidate-owned** rows)

Change **only** these. Do not touch `CreditTransaction.recruiterUserId`.

| Relation | Today | After | Why |
|---|---|---|---|
| `Certificate.user` | Restrict | Cascade | Candidate-owned public credential. Wipe removes `/verify/[id]` for them. |
| `Credential.user` | Restrict | Cascade | Same. |
| `SynergyEvent.user` | Restrict | Cascade | Their points history. |
| `PointsTransaction.user` | Restrict | Cascade | Their SP ledger. |
| `CandidateAchievement.user` | Restrict | Cascade | Their achievements. |
| `AssessmentReport.candidate` | Restrict | Cascade | Their assessment reports. |
| `CreditTransaction.candidate` | Restrict | **SetNull** (`candidateUserId` already optional) | Recruiter financial history must survive. Amount, recruiter, org, reason stay. |
| `TalentEngagementRequest.candidate` | Restrict | **SetNull** — make `candidateUserId` optional | Recruiter ticket survives; `candidatePublicId` already denormalised. |
| `AdminAction` actor/target | Cascade | SetNull | Audit survives the wipe. |

Everything else that already Cascades from `User` (profile, applications, outreach as candidate, assignments, sessions, accounts, …) stays Cascade. `TalentListItem.candidateUserId` is already SetNull.

`PointsSourceType` add `MOCK_INTERVIEW`.

## 6. Steps

### Phase A — T-270-minimum `writeAudit`

`src/features/admin/audit.ts`:

```ts
export type AuditInput = {
  actorUserId: string;
  adminUserId?: string | null;
  targetUserId?: string | null;
  entityType: string;
  entityId: string;
  actionType: string;
  reason: string;
  previousState?: Prisma.InputJsonValue | null;
  newState?: Prisma.InputJsonValue | null;
  metadata?: Prisma.InputJsonValue | null;
  organizationId?: string | null;
};

export async function writeAudit(tx: Prisma.TransactionClient, input: AuditInput): Promise<void>
```

Rules:

- `reason` is required at the TypeScript level. Callers Zod-trim to 8–500 chars before calling.
- Always persist `actorUserId` (no FK).
- `adminUserId` defaults to `actorUserId` when the actor is an admin; for self-delete it is `null`.
- Never `update` or `delete` AdminAction. No function in this file except `writeAudit`.
- `previousState` / `newState` must not contain `password`, `passwordHash`, `sessionToken`, or resume bytes. A source-scan test pins `writeAudit` and the three account-ops files do not mention `password`.

Action type strings (plain strings, not a Prisma enum):

- `ACCOUNT_DISABLE`
- `ACCOUNT_RESTORE`
- `ACCOUNT_SECURE`
- `ACCOUNT_SELF_DELETE`
- `PLATFORM_CONFIG_UPDATE`

Feed: `/admin/actions?q=` filters `OR` on `actionType contains q` (insensitive), `entityId equals q`, `reason contains q`, `actorUserId equals q`. When `target` is null, render `entityType entityId` as the subject text; do not link to `/admin/students/[missing]`.

### Phase B — Auth freeze (T-272, used by disable and by wipe)

`src/lib/account-status.ts` (pure):

```ts
export const ACCOUNT_DISABLED_MESSAGE =
  "This account has been disabled. Contact ABTalks support.";

export function isJwtInvalidated(
  tokenIat: number | undefined,
  sessionInvalidatedAt: Date | null | undefined,
): boolean {
  if (!sessionInvalidatedAt) return false;
  const iat = tokenIat ?? 0;
  return iat < Math.floor(sessionInvalidatedAt.getTime() / 1000);
}
```

`src/auth.ts` (Node only):

1. Recruiter OTP `authorize` and dev `authorize`: `select` also `disabledAt`; if `disabledAt` return `null` (same as `deletedAt`).
2. `signIn` callback: if `deletedAt` or `disabledAt`, return `false`.
3. `session` callback: load `{ deletedAt, disabledAt, sessionInvalidatedAt }`. If deleted, disabled, or `isJwtInvalidated(token.iat, sessionInvalidatedAt)`, return `{ ...session, user: undefined as never }` — same kick already used for `deletedAt`.

Do **not** put those queries in `auth.config.ts`.

Because `auth()` is what Server Actions and RSC pages use, a stripped session is the full freeze. `requireRecruiterWorkspace` already fails closed on missing `userId`. `requireAdmin` already redirects on missing session. Do not edit every action file.

`searchableUserWhere`: add `disabledAt: null`. Disabled candidates must **remain visible on `/admin/students`** so they can be restored — `get-students.ts` keeps showing them (filter `deletedAt` only, not `disabledAt`).

### Phase C — Operator disable / restore / secure

`account-ops.ts` runs inside `writeClient().$transaction`. Shared guards before write:

1. Target exists.
2. `targetUserId !== actorUserId`.
3. `hasPlatformAdmin(targetUserId)` is false (query `userRoleAssignment` in the same tx).
4. `deletedAt` is null (deleted accounts are not restorable via T-272; that is plan 119).

**disable**

- If already `disabledAt`, return typed error `"Account is already disabled"`.
- Set `disabledAt = now`, `disabledReason = reason`, `disabledByUserId = actor`, `sessionInvalidatedAt = now`.
- `writeAudit` with `previousState: { disabledAt: null }`, `newState: { disabledAt: iso }`, reason, `entityType: "User"`.
- Do **not** touch `password`, `email`, `deletedAt`, credits, jobs, or enrollments.

**restore**

- If `disabledAt` is null, `"Account is not disabled"`.
- Clear `disabledAt`, `disabledReason`, `disabledByUserId`. Leave `sessionInvalidatedAt` as-is (old JWTs stay dead; a fresh sign-in issues a new `iat`).
- Audit before/after.

**secure**

- Set `sessionInvalidatedAt = now` only.
- Audit `{ sessionInvalidatedAt: previousIso | null }` → `{ sessionInvalidatedAt: nowIso }`.
- Do not read or write `password`.

Actions in `admin-account-actions.ts`:

- Zod: `{ targetUserId: z.string().min(1), reason: z.string().trim().min(8).max(500) }`.
- `requireAdmin()`.
- `revalidatePath` `/admin/students`, `/admin/students/${id}`, `/admin/recruiters`, `/admin/actions`.
- Result envelope `{ ok: true } | { ok: false, message }`.

UI (`account-ops-dialog.tsx`):

- Three triggers on student detail: **Disable account**, **Restore account** (disabled unless `disabledAt`), **Secure account**.
- Same three on each recruiter row.
- Each opens a dialog: title, one-sentence description, required reason textarea, Confirm / Cancel.
- Secure description **must** say: they will be signed out of every device; they can sign in again with the same password; you cannot see or set a password.
- Source-scan test: this file, `student-action-panel.tsx`, `admin-recruiters-panel.tsx`, and `admin-account-actions.ts` contain no `type="password"` and no `password` key in any payload.

Do not remove the plan 119 **Delete user account** control.

### Phase D — T-277 runtime config

Registry additions in `PLATFORM_CONFIG_KEYS` (int):

| Key | Default | Min | Max | Meaning |
|---|---|---|---|---|
| `credits.starting_grant_minor` | already 20000 | — | — | unchanged |
| `credits.contact_unlock_cost_minor` | already 1000 | — | — | unchanged |
| `mock.free_allowance` | 3 | 0 | 100 | D-11 first N completed mocks are free |
| `mock.point_cost` | 50 | 0 | 1_000_000 | Synergy Points charged on completed-count >= allowance. `0` means paid attempts are still free (fail closed on missing row is the default 50, not 0 — a missing row must not make paid mocks free). |

`writeIntConfig({ key, intValue, actorUserId, reason })`:

1. Key must be in `PLATFORM_CONFIG_KEYS` and `kind: "int"`.
2. Zod against that key's min/max.
3. Read current row (or default).
4. Upsert `PlatformConfig`.
5. `writeAudit` `PLATFORM_CONFIG_UPDATE`, `entityType: "PlatformConfig"`, `entityId: key`, previous/new int, reason. `targetUserId` null. `adminUserId` = actor.

Admin panel on `/admin`: four number inputs, current values as server props, shared reason field, Save. No free-text key. No password.

**Mock consumption** (contributor edit in Shivansh's interview service — required or T-277 is a dead row):

In `startAttempt`, after the domain gate, before creating the attempt:

1. `completed = countCompletedAttempts(userId)` across all domains (not per slug). Completed means the existing "completed" status the catalogue already counts.
2. `allowance = getIntConfig("mock.free_allowance")`, `cost = getIntConfig("mock.point_cost")`.
3. If `completed >= allowance` and `cost > 0`: inside the same `writeClient().$transaction` that creates the attempt, `applyPointsChange(tx, { amount: -cost, mode: "debit_strict", sourceType: MOCK_INTERVIEW, idempotencyKey: `mock-interview:charge:${attemptId}`, ... })`. If `{ ok: false, reason: "insufficient" }`, do not create the attempt; return `{ ok: false, message: "Not enough Synergy Points for another mock interview." }`.
4. Attempt id: create the MockInterview row first in the tx, then debit with that id in the key. If debit fails, the tx rolls back and no attempt exists.

Refund: in the existing technical-failure / `closeAttemptWithoutScoring` path that is **not** user abandon, if a `PointsTransaction` with that idempotency key exists, `applyPointsChange` credit `+cost` with `idempotencyKey: mock-interview:refund:${attemptId}`. User-initiated abandon does **not** refund (they used a slot). D-11 "failed technical attempt consumes nothing" = provider/infra failure only. If the current close path does not distinguish those, add a boolean `technicalFailure` argument to `closeAttemptWithoutScoring` and pass `true` only from the catch that already logs provider errors. Do not invent a new scoring rule.

Signed-in catalogue page: one sentence under the hero, `You have {max(allowance - completed, 0)} free mock interviews remaining.` Numbers from the server. No new client state.

### Phase E — T-217 candidate hard-delete

`deleteOwnCandidateAccount` is candidate-only:

Guards:

1. Caller `userId` is the target. No admin parameter.
2. Not a Platform Admin.
3. No `RecruiterProfile` for this user (`findFirst`). If present, `{ ok: false, message: "Recruiter accounts cannot be deleted from this screen." }`.
4. Not already `deletedAt`.

Order inside one transaction:

1. `writeAudit` **first**, while the row exists: `actionType: ACCOUNT_SELF_DELETE`, `actorUserId: userId`, `adminUserId: null`, `targetUserId: userId`, `entityType: "User"`, `entityId: userId`, `reason: "Candidate requested account deletion"`, `previousState: { emailDomain: email.split("@")[1] ?? null, role, hadPassword: Boolean(password) }` — **never the email local-part, never the password**.
2. `CreditTransaction.updateMany({ where: { candidateUserId: userId }, data: { candidateUserId: null } })` (in case the SetNull schema is not enough for a running tx).
3. `TalentEngagementRequest.updateMany` set `candidateUserId: null`.
4. `tx.user.delete({ where: { id: userId } })`. Cascades now remove candidate-owned rows.

Do not call `anonymizeUser`. Do not `prisma.user.delete` outside this function. Do not wipe other users.

Action: `deleteOwnAccountAction({ confirm: "DELETE" })`. Zod `z.literal("DELETE")`. `auth()` for the user id. After success, `signOut({ redirectTo: "/" })` from next-auth (or return `{ ok: true }` and the client calls `signIn`? **Client:** on `{ ok: true }`, `window.location.assign("/api/auth/signout?callbackUrl=/")` so the JWT cookie dies). Do not leave a session cookie for a missing user.

UI on `/profile`: a compact danger block **below** the wizard, not inside a step. Trigger **Delete my account**. Modal: this removes your data from ABTalks and cannot be undone; type `DELETE`; Delete / Cancel. Shallika may restyle later (T-208). Do not invent a new profile IA.

After wipe: original email is free (row is gone), so a later signup with the same email creates a **new** user id. Recruiter unlock ledgers that pointed at the old id keep their amount with `candidateUserId = null`.

### Phase F — T-282 seven pre-September journeys

The workbook's TC-S-008 list is not in the markdown task index. This plan **locks** the seven journeys that existed before the September hire portal. If the xlsx list differs, stop and report — do not silently swap them.

| # | Journey | Pin |
|---|---|---|
| 1 | Candidate sign-in | `src/auth.ts` still exports `handlers, auth, signIn, signOut`; `src/app/login` still exists. |
| 2 | 60-day challenge submit | `src/app/actions/submission-actions.ts` (or the current submit Server Action path) still exists and still writes a `Submission`. |
| 3 | Weekly quiz | `src/app/actions/quiz-actions.ts` still exports `submitQuizAction`. |
| 4 | Program / AI cohort dashboard | `src/app/program/ai-cohort/page.tsx` still a Server Component. |
| 5 | Hackathon dashboard | `src/app/hackathon/(app)/dashboard/page.tsx` still a Server Component. |
| 6 | Public certificate verify | `src/app/verify/[certificateId]/page.tsx` (or current verify route) still public, still no `requireAdmin`. |
| 7 | Mock interview catalogue + start | `startMockInterviewAction` still in `mock-interview-actions.ts`; `/mock-interviews` still readable signed-out. |

The test is a **source-scan** (same style as `admin-auth.test.ts`): files exist, middleware.ts still has no `@/lib/` import, `auth.config.ts` still has no Prisma. It does **not** hit a live database.

Also run: `npm run test:demo1-security`, `npm run test:visibility`, `npm run test:credits`, `npm run test:078-points-writes`, `npx tsc --noEmit`, `npm run build`.

## 7. Guardrails for Cursor (DO NOT)

- Do NOT import `@/lib/*` or Prisma into `middleware.ts` or `auth.config.ts`.
- Do NOT add a password input, a "set password" action, or select `User.password` in any admin or profile payload.
- Do NOT call `anonymizeUser` from disable / restore / secure / self-delete.
- Do NOT hard-delete a recruiter, a Platform Admin, or the acting operator.
- Do NOT change `CreditTransaction.recruiterUserId` Restrict, and do NOT delete recruiter ledger rows when a candidate wipes.
- Do NOT add a parallel `AuditLog` table. Extend `AdminAction`.
- Do NOT add Prisma client middleware, a new `/admin/config` route, or a new `/admin/accounts` route.
- Do NOT restyle the profile wizard or the admin shell.
- Do NOT put `requireRole` on `/login`, `/api/auth/*`, or `/verify/*`.
- Do NOT implement T-271 View As, T-269 credit correction, or T-266 recruiter detail.
- Do NOT skip the Neon child-branch rule for the migration.
- When a build error contradicts this plan, stop and report the exact error — do not improvise.

## 8. Verification

### Automated

Add to `package.json`:

- `test:audit` → `tsx src/features/admin/audit.test.ts`
- `test:account-ops` → `tsx src/features/admin/account-ops.test.ts`
- `test:platform-config-write` → `tsx src/lib/platform-config.test.ts`
- `test:self-delete` → `tsx src/features/profile/delete-own-account.test.ts`
- `test:mock-allowance` → `tsx src/features/interview/platform/mock-allowance.test.ts`
- `test:pre-september` → `tsx src/features/admin/pre-september-regression.test.ts`

Tests are source-scan plus pure-function tests (`isJwtInvalidated`, `resolveIntConfig` for the new keys). Do not require a live Neon URL in CI.

Minimum assertions:

- disable / restore / secure / config / self-delete call `writeAudit` with `reason`, `previousState`, `newState` (self-delete previousState is the email-domain snapshot).
- account-ops + dialogs contain no `password`.
- `searchableUserWhere` includes `disabledAt: null`.
- `auth.ts` session callback reads `disabledAt` and `sessionInvalidatedAt`.
- `writeIntConfig` rejects unknown keys and out-of-range ints.
- `delete-own-account.ts` uses `tx.user.delete`, does not import `anonymizeUser`, nulls `CreditTransaction.candidateUserId`.
- middleware.ts has no `@/lib/` import.
- `isJwtInvalidated(100, new Date(100_000 * 1000))` is false; `isJwtInvalidated(99, new Date(100_000 * 1000))` is true.

Then `npx tsc --noEmit` and `npm run build`.

### Manual (TC-A-010 / TC-A-012 / D-13)

On a Neon **child** with the migration applied:

1. As Platform Admin, open a candidate on `/admin/students/[id]`. Disable with reason `Harassment report 14 Sep`. Sign out. Sign in as that candidate — refused. Admin list still shows them. Recruiter search does not. Restore with reason `Appeal accepted`. Sign-in works.
2. Secure that account with reason `Stolen laptop`. Their other browser session dies on next navigation. They sign in again with the **same** password. No admin screen showed a password.
3. Repeat disable / restore / secure on a recruiter row on `/admin/recruiters`. Confirm `/hire` actions fail while disabled.
4. Confirm you cannot disable yourself or another Platform Admin.
5. On `/admin`, change unlock cost; perform an unlock as a recruiter and confirm the new cost. Change starting grant; a **new** recruiter gets the new amount; an existing balance is untouched.
6. As a candidate, complete / mock-count past the allowance and confirm a 4th start debits SP (or refuses if balance is short). Header shows remaining free count.
7. As a candidate, Delete my account, type `DELETE`. User row gone. Sign-in with that email fails until they register again. Recruiter credit ledger rows for prior unlocks still exist with null candidate id. `/admin/actions` still shows `ACCOUNT_SELF_DELETE` with null target link and the entity id.

Evidence: PR, `test:account-ops` / `test:audit` / `test:self-delete` / `test:pre-september` output, short browser recording of steps 1–2 and 7.

## 9. DB safety

1. `git status` clean enough to know the working tree.
2. Create a Neon child from production. Put the child connection string in local env. Prove `DATABASE_URL` host is not the production default before `prisma migrate deploy`.
3. Apply `20260915090000_t272_account_ops_audit`.
4. `npx prisma generate`.
5. Rehearse disable / restore / self-delete on the child. Self-delete is irreversible on that row.

Rollback of the migration: drop the new User columns; restore AdminAction FKs to NOT NULL / Cascade only if no row has null admin/target (self-delete rehearsal will have nulls — at that point rollback is "restore the child from the pre-migration snapshot", not a reverse SQL of NOT NULL).

## 10. CHANGELOG

One line under `## Pending reconcile`:

`2026-09-15 [schema|rule] T-272/T-270/T-277/T-217: User disable+sessionInvalidatedAt; AdminAction actor snapshot + nullable FKs SetNull; candidate-owned Restrict→Cascade and credit/engagement candidate FKs SetNull; runtime mock allowance/cost; candidate hard-delete. Operator never sees a password.`

## 11. Commit message (when a later request asks to implement and commit)

```
Add disable/restore/secure, audited config, and candidate self-delete.

Operators can freeze any non-admin account without touching passwords,
runtime credit/mock numbers edit without a deploy, and a candidate can
wipe their own rows while recruiter ledgers and the audit entry survive.
```

## 12. Files that should have changed when done

Every path in §3, plus `package.json` scripts, plus the migration folder. Nothing else.

---

## Cross-module report (for the implementation PR)

PRIMARY MODULE: Platform Admin / auth / audit.

PRIMARY OWNER: Sohail.

CROSS-MODULE CHANGES:

- Shivansh — `/profile` danger zone + `delete-own-account.ts`; mock `startAttempt` allowance/debit. Review before merge.
- Zainab — `/admin/recruiters` row actions (`userId` on directory row). Review before merge.
- Shallika — functional admin/profile controls in existing chrome; T-207 / T-208 restyle later.

DATABASE CHANGES: one migration, as §5.

SECURITY / AUTH IMPACT: YES — sign-in, JWT invalidation, search hide, hard-delete.

FOLLOW-UP: T-266 recruiter detail page can later host the same ops; T-222 can own richer mock-allowance UX; T-208 can restyle candidate delete; T-271 View As is not this plan.
