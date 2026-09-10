# 117 — T-228: Credits foundation and append-only ledger

**Owner:** Zainab · **Task:** T-228 · **Branch:** `T-228` · **Written:** 2026-09-10
**Depends on:** T-148 (docs/plans/114, APPROVED & SIGNED) and T-226 (branch `T-226`, merged later)
**Blocks:** T-229 / T-230 (contact unlock), T-095, T-105, T-128

> ✅ **Branch order — resolved 2026-09-10.** `T-226` (commit `04c3df0`, PR #275)
> has been merged into `T-228` locally, so `recruiter-setup-actions.ts`,
> `requireRecruiterWorkspace()` and the `setupStep` migration are present.
> T-226 is **consumed, never re-implemented**: this task adds no second workspace
> resolver, no second provisioning routine and no copy of the setup wizard.

---

## 1. Goal

Give every recruiter a money-shaped credit balance backed by an append-only
ledger, with the starting grant and the contact-unlock price stored as runtime
database configuration rather than environment variables. Build only the
foundation — no unlock, no spend UI — plus one directly related performance fix
to `completeRecruiterSetupAction`.

## 2. Current behavior

- **No credit anything exists.** `grep CreditAccount|CreditTransaction|creditBalance`
  over `prisma/schema.prisma` and `src/` returns nothing. T-148 is a written,
  signed architecture only (docs/plans/114 + `ARCHITECTURE.md` on branch `T-148`).
- **No runtime configuration mechanism exists.** Every tunable in the repo is
  `process.env` — `src/lib/feature-flags.ts`, `src/features/hire/match-config.ts`
  (`intFromEnv`), `pool-policy.ts`. There is no key/value settings table and no
  admin settings surface. Requirement 8 is therefore satisfied by *creating* the
  mechanism T-148 D-17 already named (`PlatformConfig`), not by inventing a
  competing one.
- **The proven precedent is `PointsAccount` + `PointsTransaction`**
  (`prisma/schema.prisma:2948-2984`, writer `src/repositories/points.ts`): unique
  `idempotencyKey`, conditional `updateMany` decrement (`debit_strict`,
  points.ts:427-441), duplicate pre-check returning `duplicate: true`
  (points.ts:369-381). The credit ledger copies this shape deliberately.
- **Recruiter workspace (T-226):** one recruiter = one `Organization` = one
  `OrganizationMember`, slug `<company>-<last8 of userId>`
  (`recruiterWorkspaceSlug`). `requireRecruiterWorkspace()` in
  `src/features/recruiter-workspace/workspace.ts` resolves `organizationId` from
  the session and is the only sanctioned way to get it.
- **`completeRecruiterSetupAction`** does: 1 read (`recruiterProfile.findUnique`),
  then an **interactive** `prisma.$transaction(async tx => …)` containing
  `recruiterProfile.update` + `provisionRecruiterIdentity(tx, …)`, which itself
  runs `organization.upsert` → `organizationMember.upsert` →
  `userRoleAssignment.findFirst` → conditional `create`. That is BEGIN + 4–5
  statements + COMMIT held open across the wire: ~7 Neon round trips, ~8.6s.
  `approveRecruiterAction` already carries the warning comment about exactly this
  (`src/app/actions/admin-recruiter-actions.ts:52-58`).
- `src/features/hire/entitlements.ts` is a fail-closed stub returning
  `NOT_IMPLEMENTED`. **T-228 does not touch it** — wiring it is T-033/T-229.
- `hasContactAccess()` in `src/features/hire/contact-access.ts` must remain
  100% unchanged (T-148 §6). T-228 does not touch it.

---

## 3. Decisions this plan makes

| # | Decision | Ruling |
|---|---|---|
| **C-1** | Unit of `amount` | **Integer minor units (USD cents).** `20000 = $200.00`. No floats on a money path. Documented on the field; the display currency is a config row. |
| **C-2** | Who owns a balance | **`Organization`** — T-148 D-16 keys on `organizationId`, and under T-226 one `Organization` *is* one recruiter. This satisfies "a recruiter has credits" without contradicting the signed design. |
| **C-3** | Source of truth | **The ledger.** `CreditTransaction` is authoritative; `CreditAccount.balance` is a cached projection whose only job is the row lock and the conditional decrement. Public reads derive from the ledger (§6.3). This is T-148/ARCHITECTURE.md §1 pillar 2 verbatim ("stored balances are cached projections … never authoritative counters") and T-228 requirement 4. |
| **C-4** | Where the grant happens | **Deterministically, on both workspace-creation paths** (§7). There is exactly one place a recruiter workspace comes into existence — `provisionRecruiterIdentity` — and both callers (`completeRecruiterSetupAction` and `approveRecruiterAction`) route through it. The grant is issued there, so **no credit read ever creates money**. |
| **C-4b** | Legacy recruiters | Workspaces that existed *before* this ships are granted by an explicit, admin-run backfill script, not by a lazy write on a read path. `ensureOnboardingGrant()` as a read-path safety net is **dropped** — investigated, found unnecessary (§7.3). |
| **C-5** | Grant transaction placement | On the **approval** path the grant is inside `provisionRecruiterIdentity`, i.e. inside that action's existing transaction. On the **setup** path it runs in its **own** atomic transaction immediately after the batched setup commit — the batch is what makes setup fast, and a batched `$transaction([…])` cannot host a statement whose input depends on a read. Both call the same primitive; both are database-idempotent. |
| **C-6** | Admin editing surface | **Out of scope for T-228.** Configuration is a database row; editing it is a row edit. An admin screen is a separate task. Requirement 5 asks for "not env vars", not for a UI. |
| **C-7** | Unlock price | **Not a product decision this task is allowed to make.** T-228 does not specify one. The seed carries an explicitly-labelled placeholder and the code, the seed output and this plan all say so. Nothing consumes it yet — T-229 does. |

### The two numbers, stated plainly

| Key | Value | Standing |
|---|---|---|
| `credits.starting_grant_minor` | **`20000`** = $200.00 | **Product-specified (T-228).** Current *default*, not a constant: changing it to $100 is a one-row edit with no deployment, and only future initialisations are affected. |
| `credits.contact_unlock_cost_minor` | `1000` = $10.00 | **PLACEHOLDER — NOT A PRODUCT DECISION.** T-228 specifies no unlock price and T-148's 100/10 example is explicitly not to be used to infer one. A config row must hold *something*, and the one thing it must never hold is `0`. The value is labelled `PLACEHOLDER — set by product before T-229 ships` in the registry, in the seed's console output and in the row's own `description` column. |

Nothing reads the unlock price in T-228. It exists so that T-229 finds a
configured, non-zero, non-free price rather than inventing one.

> **Reviewed 2026-09-10.** Starting credits **confirmed at $200.00**; `20000`
> stays as the seeded runtime value. The unlock cost stays at `1000` **as a
> labelled placeholder only — it is not an approved product decision.**
> **T-229 must not treat it as final until product confirms the price.** That is
> a gate on T-229, not a note.

---

## 4. (A) Proposed schema changes

All additive. No existing column is altered, no data is rewritten.

```prisma
/// Runtime, admin-editable platform configuration. Data, not deployment
/// (T-148 D-17). Read through src/lib/platform-config.ts, never directly —
/// that file owns the key registry, the types, the bounds and the fallbacks.
model PlatformConfig {
  key             String   @id
  intValue        Int?
  stringValue     String?
  description     String?
  updatedByUserId String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

enum CreditTransactionType {
  GRANT_ONBOARDING
  PURCHASE
  UNLOCK_CONTACT
  ADMIN_ADJUSTMENT
  REFUND
}

/// Cached credit projection per workspace, with optimistic locking.
/// NOT the source of truth — see CreditTransaction. This row exists so a debit
/// can be a single conditional UPDATE that serialises concurrent spenders on
/// one row lock. Ground truth is SUM(CreditTransaction.amount).
model CreditAccount {
  id             String    @id @default(cuid())
  organizationId String    @unique
  /// USD minor units (cents).
  balance        Int       @default(0)
  lifetimeEarned Int       @default(0)
  lifetimeSpent  Int       @default(0)
  version        Int       @default(0)
  reconciledAt   DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)

  @@index([balance(sort: Desc)])
}

/// Append-only, financial-grade credit ledger. Rows are never updated and
/// never deleted; a mistake is corrected with a compensating ADMIN_ADJUSTMENT
/// or REFUND row, so the history stays true.
model CreditTransaction {
  /// Total order over the ledger. createdAt can tie; this cannot, so "the
  /// current balance" has exactly one answer.
  seq             BigInt                @unique @default(autoincrement())
  id              String                @id @default(cuid())
  organizationId  String
  /// Who the movement belongs to. Under T-226 this is the workspace's only
  /// recruiter; it is stored rather than joined so history survives a
  /// membership change.
  recruiterUserId String
  candidateUserId String?
  /// Signed, USD minor units. Negative = spend, positive = grant/purchase.
  amount          Int
  type            CreditTransactionType
  /// Balance immediately before and after this movement, written from the same
  /// statement that moved it. balanceAfter - balanceBefore == amount, always.
  balanceBefore   Int
  balanceAfter    Int
  sourceType      String
  sourceId        String?
  /// Deterministic. "grant:onboarding:<orgId>", "unlock:<orgId>:<candidateId>".
  idempotencyKey  String                @unique
  /// Required. Every credit movement says why it happened, in words.
  reason          String
  /// Who performed it when that is not the recruiter (admin adjustments).
  createdByUserId String?
  metadata        Json?
  createdAt       DateTime              @default(now())

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  recruiter    User         @relation("RecruiterCreditTransactions", fields: [recruiterUserId], references: [id], onDelete: Restrict)
  candidate    User?        @relation("CandidateCreditTransactions", fields: [candidateUserId], references: [id], onDelete: Restrict)

  @@index([organizationId, seq(sort: Desc)])
  @@index([recruiterUserId, createdAt(sort: Desc)])
  @@index([candidateUserId])
  @@index([type, createdAt(sort: Desc)])
}
```

Back-relations added to `Organization` (`creditAccount CreditAccount?`,
`creditTransactions CreditTransaction[]`) and to `User`
(`recruiterCreditTransactions`, `candidateCreditTransactions`).

### Deviations from T-148 §3, and why

| Change | Why |
|---|---|
| `+ balanceBefore`, `+ balanceAfter` | T-228 requirement 3 names both. They also make the ledger self-verifying and make an O(1) balance read possible without consulting the cache. |
| `+ seq` | An append-only ledger needs a total order. Without it "latest row" is ambiguous when two rows share a millisecond. |
| `reason String?` → `reason String` | T-228 requirement 3 lists reason as part of every row. Strengthened, not reshaped. |
| `+ createdByUserId` | `ADMIN_ADJUSTMENT` is already in T-148's enum; an adjustment with no actor is not auditable. Mirrors `PointsTransaction.createdByUserId`. |
| `+ createdAt` on `CreditAccount` | Trivial; every other model in the schema has one. |

`onDelete: Restrict` on both organization relations is deliberate: a workspace
that has ever moved money cannot be deleted out from under its ledger. This
means `prisma/cleanup.ts` gains credit rows to its teardown order (§9.2).

---

## 5. (B) Runtime settings design

**`src/lib/platform-config.ts`** — `import "server-only"`.

- A frozen registry is the single source of key names, kinds, bounds, defaults
  and descriptions:

  ```ts
  export const PLATFORM_CONFIG_KEYS = {
    "credits.starting_grant_minor":      { kind: "int", default: 20000, min: 0, max: 10_000_000 },
    "credits.contact_unlock_cost_minor": { kind: "int", default:  2000, min: 0, max:  1_000_000 },
    "credits.currency":                  { kind: "string", default: "USD" },
  } as const;
  export type PlatformConfigKey = keyof typeof PLATFORM_CONFIG_KEYS;
  ```

  A union key type means a typo is a compile error, exactly as
  `entitlements.ts` argues for `PlanLimitKey`.
- `getIntConfig(key)` / `getStringConfig(key)`: read the row, validate with Zod
  against the registry bounds, return the value. **Fallback rule:** a missing
  row, a null column, or an out-of-range value falls back to the registry
  default and logs via `logger.warn`. It never falls back to `0` — a
  configuration outage must not make contact unlocks free.
- Memoised per request with React `cache()`; a change lands on the next request.
  No process-lifetime cache — the point of the table is that an edit takes
  effect without a deploy.
- Seeded by `prisma/seed-platform-config.ts` (`npm run db:seed:platform-config`),
  which **upserts with `update: {}`** so re-running never overwrites a value an
  admin has changed.
- `src/lib/validations/platform-config.ts` holds the Zod schemas, matching the
  repo's convention that validation lives under `lib/validations/`.

---

## 6. (C) Ledger write / read architecture

### 6.1 One writer

`src/repositories/credits.ts` (`import "server-only"`) is the only file that
inserts a `CreditTransaction` or updates a `CreditAccount`. Product code never
touches either model. This mirrors `src/repositories/points.ts`.

```ts
type CreditChangeInput = {
  organizationId: string;
  recruiterUserId: string;
  candidateUserId?: string | null;
  /** Signed minor units. Positive credits, negative debits. */
  amount: number;
  type: CreditTransactionType;
  sourceType: string;
  sourceId?: string | null;
  idempotencyKey: string;
  reason: string;
  createdByUserId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

type CreditChangeResult =
  | { ok: true; balance: number; appliedAmount: number; duplicate: boolean }
  | { ok: false; reason: "INSUFFICIENT_CREDITS"; balance: number };

export async function applyCreditChange(
  tx: Prisma.TransactionClient,
  input: CreditChangeInput,
): Promise<CreditChangeResult>;
```

### 6.2 The movement itself

The account row and the ledger row must agree, so both are written by **one SQL
statement** whose `RETURNING` supplies `balanceAfter`:

```sql
WITH dup AS (
  SELECT 1 FROM "CreditTransaction" WHERE "idempotencyKey" = $key
),
moved AS (
  UPDATE "CreditAccount"
     SET "balance"        = "balance" + $amount,
         "lifetimeEarned" = "lifetimeEarned" + GREATEST($amount, 0),
         "lifetimeSpent"  = "lifetimeSpent"  + GREATEST(-$amount, 0),
         "version"        = "version" + 1,
         "reconciledAt"   = NOW(),
         "updatedAt"      = NOW()
   WHERE "organizationId" = $org
     AND NOT EXISTS (SELECT 1 FROM dup)
     AND "balance" + $amount >= 0
  RETURNING "balance"
)
INSERT INTO "CreditTransaction" (…, "amount", "balanceBefore", "balanceAfter", …)
SELECT …, $amount, moved."balance" - $amount, moved."balance", …
  FROM moved
RETURNING "balanceAfter";
```

- **Atomic** — one statement, one row lock on `CreditAccount`.
- **Overdraft-proof** — `"balance" + $amount >= 0` is T-148 §4.3's conditional
  decrement. Ten concurrent $20 unlocks against $100 leave exactly five winners.
- **Idempotent** — the `dup` CTE covers the sequential retry; the unique index on
  `idempotencyKey` covers the concurrent one. `P2002` is caught and mapped to
  `{ ok: true, duplicate: true }`, never surfaced as an error.
- **Consistent by construction** — `balanceBefore`/`balanceAfter` come from the
  same statement's post-image, so drift between cache and ledger has no window
  in which to occur.
- Zero rows returned means *either* duplicate *or* insufficient; the caller
  disambiguates with one extra read, on the unhappy path only.
- `applyCreditChange` upserts a missing `CreditAccount` row first (one extra
  round trip, only when absent) so the statement above always matches a row.

### 6.3 Reads derive from the ledger

```ts
/** O(1), and it reads the ledger, not the cache. */
export async function getCreditBalance(organizationId: string): Promise<number>;
//  SELECT "balanceAfter" FROM "CreditTransaction"
//   WHERE "organizationId" = $1 ORDER BY "seq" DESC LIMIT 1   -- 0 if none

/** The slow, unarguable one. Used by reconciliation, not by product code. */
export async function sumLedgerBalance(organizationId: string): Promise<number>;

export async function listCreditTransactions(
  organizationId: string,
  opts?: { limit?: number; beforeSeq?: bigint },
): Promise<CreditLedgerEntry[]>;

/** Compares SUM(amount) vs latest balanceAfter vs CreditAccount.balance. */
export async function reconcileCreditAccount(organizationId: string): Promise<ReconcileReport>;
```

`CreditAccount.balance` is read by nothing outside `credits.ts` and by nothing
at all on a product read path. A source-assertion test enforces that (§10).

### 6.4 The workspace-scoped façade

`src/features/hire/credits.ts` — what product code actually calls. It takes no
ids, for the reason `requireRecruiterWorkspace` takes none:

```ts
export async function getWorkspaceCredits(): Promise<
  | { ok: true; data: { balanceMinor: number; currency: string; unlockCostMinor: number } }
  | { ok: false; message: string }
>;
export async function contactUnlockCostMinor(): Promise<number>;
```

`getWorkspaceCredits()` is a pure read — it never grants (§7.3). Everything is
`server-only`; nothing in T-228 is a Client Component.

---

## 7. (D) Initialization and idempotency

### 7.1 Investigation: can the normal creation path do this deterministically?

Yes. Every recruiter `Organization` in this codebase is created in exactly one
function — `provisionRecruiterIdentity` in
`src/features/hire/provision-recruiter.ts` — reached from exactly two callers:

| Caller | When | Path |
|---|---|---|
| `completeRecruiterSetupAction` | A recruiter finishes the T-226 setup wizard | The normal path |
| `approveRecruiterAction` | An admin approves an application | The legacy/admin path |

There is no third writer of `Organization`, and nothing else mints an
`OrganizationMember` for a recruiter. So the grant can be, and is, issued
deterministically at workspace creation on both paths. **No credit read creates
money.**

### 7.2 The mechanism

- **Key:** `grant:onboarding:<organizationId>`, `@unique` on
  `CreditTransaction.idempotencyKey`. Exactly-once is enforced by a database
  constraint, not by an application check — two concurrent grants both attempt
  the insert, one wins, the loser's `P2002` is mapped to
  `{ ok: true, duplicate: true }`. One ledger row, always.
- **Amount:** read from `credits.starting_grant_minor` at grant time and frozen
  into the row. `metadata` records `{ configKey, configValue }`, so raising or
  lowering the grant later never rewrites what anybody was already given, and
  the next recruiter to initialise picks up the new value with no deployment.
- **Approval path:** the grant is issued inside `provisionRecruiterIdentity`,
  which already runs in `approveRecruiterAction`'s transaction. That action's own
  code is **not modified**.
- **Setup path:** `completeRecruiterSetupAction` uses `recruiterIdentityWrites`
  (the batched form, §9.3), which deliberately excludes the grant — a batched
  `$transaction([…])` cannot contain a statement whose parameters depend on a
  read. It therefore calls `grantOnboardingCredits` in its own transaction
  immediately after the batch commits. A failure there is logged, the recruiter
  still has a workspace, and re-running completion or the backfill grants it.

### 7.3 Why there is no lazy `ensureOnboardingGrant()` on reads

The plan originally proposed healing legacy recruiters by granting on the first
credit read. That is dropped. A read that silently creates money is a surprising
thing to leave in a financial path: it makes "how much does this recruiter have"
a mutation, it puts a write in a Server Component render, and it would be the
one grant site not tied to workspace creation. The population it existed for —
workspaces provisioned by `approveRecruiterAction` before this ships — is finite,
known, and better served by an explicit, auditable, admin-run script.

`getWorkspaceCredits()` therefore returns `$0.00` for a pre-existing workspace
until the backfill runs. **Running the backfill is a required deploy step**, not
an optional one (§12).

### 7.4 Backfill

`prisma/scripts/backfill-credit-grants.ts` (`npm run db:backfill:credit-grants`)
lists every `Organization` with an active recruiter member and no
`GRANT_ONBOARDING` row. **Dry-run by default**; `--apply` writes. It reuses
`grantOnboardingCredits`, so running it twice, or racing it against a live
setup completion, still yields exactly one grant per workspace.

## 8. (E) Transaction boundaries

| Operation | Boundary |
|---|---|
| Onboarding grant | One `prisma.$transaction` wrapping one `applyCreditChange` — itself one SQL statement (plus a first-time account upsert). Atomic. |
| Any future spend (T-229) | One transaction: conditional debit + ledger insert (this statement) **+** the `TalentEngagementRequest` upsert, per T-148 §4.4. `applyCreditChange` takes a `tx`, so T-229 composes into its own boundary rather than opening a second one. |
| Recruiter setup writes | One **batched** `prisma.$transaction([…])` — §9.3. |
| Setup writes ↔ grant | Deliberately **separate** boundaries (C-5). The grant is idempotent and self-healing; the setup is not, and must not be held open waiting on it. |
| Config reads | Outside every transaction. The value used is captured into the ledger row. |

Interactive `$transaction(async tx => …)` is used **only** where a genuine
read-then-write dependency exists, and never on the setup path again.

---

## 9. (F) Files to touch

### 9.1 New

| Path | Note |
|---|---|
| `prisma/migrations/<ts>_credit_ledger_and_platform_config/migration.sql` `[new]` | Three tables + one enum, additive. Generated with `--create-only` and read before it runs. |
| `src/lib/platform-config.ts` `[new]` | Key registry + typed accessors + fallbacks. `server-only`. |
| `src/lib/validations/platform-config.ts` `[new]` | Zod schemas for the registry kinds. |
| `src/repositories/credits.ts` `[new]` | The only credit writer + the ledger-derived reads. `server-only`. |
| `src/features/hire/credits.ts` `[new]` | Workspace-scoped façade. `server-only`. |
| `src/lib/credits-format.ts` `[new]` | `formatCreditsMinor`. Its own file because the façade is `server-only` and a balance is exactly what a Client Component renders. |
| `prisma/seed-platform-config.ts` `[new]` | Upsert-with-`update:{}` seed of the three keys. |
| `prisma/scripts/check-credit-ledger.ts` `[new]` | Read-only reconciliation across all workspaces. |
| `prisma/scripts/backfill-credit-grants.ts` `[new]` | Dry-run by default, `--apply` to write. |
| `src/features/hire/credits.test.ts` `[new]` | Pure + source-assertion suite (§10). |

### 9.2 Edited

| Path | Change |
|---|---|
| `prisma/schema.prisma` `[edit]` | The models in §4 + back-relations on `Organization` and `User`. |
| `src/repositories/index.ts` `[edit]` | Export `getCreditBalance`, `applyCreditChange`, `listCreditTransactions`, `sumLedgerBalance`, `reconcileCreditAccount`. |
| `src/features/hire/provision-recruiter.ts` `[edit]` | **Add** `recruiterIdentityWrites(...)` returning the identity writes as an array for the batched form, **and** the onboarding grant at the end of `provisionRecruiterIdentity` — the one place a workspace is created, so the one place it is funded. `approveRecruiterAction` is not modified and picks the grant up for free. |
| `src/app/actions/recruiter-setup-actions.ts` `[edit]` | The perf retrofit, §9.3, plus the grant call. Nothing else in the file changes. |
| `prisma/cleanup.ts` `[edit]` | Delete `CreditTransaction` then `CreditAccount` before `Organization`; `onDelete: Restrict` makes this mandatory or `db:cleanup:*` breaks. |
| `package.json` `[edit]` | `db:seed:platform-config`, `db:check:credit-ledger`, `db:backfill:credit-grants`, `test:credits`. **Every `NODE_OPTIONS=` script is prefixed with `cross-env`** — a bare one fails on Windows. |
| `docs/CHANGELOG.md` `[edit]` | One dated line under `## Pending reconcile`. |

**Server vs Client:** every file above is server-side (Server Action, repository,
lib, script, seed). No Client Component is added or edited, so there is no
Server→Client prop boundary to check in this task.

### 9.3 The `completeRecruiterSetupAction` retrofit

The five setup writes are *not* independent as written — `organizationMember`
and `userRoleAssignment` both need the organization's id, and the `findFirst`
for a live role assignment is a read. They become batchable by moving both
reads out in front and precomputing the id:

1. **RT1** — existing `recruiterProfile.findUnique` (fullName, company).
2. **RT2** — one batched **read**:
   `prisma.$transaction([ organization.findUnique({ where: { slug } }), userRoleAssignment.findFirst({ … revokedAt: null }) ])`.
3. `const organizationId = existingOrg?.id ?? "org_" + userId` — deterministic,
   no new dependency, and consistent with the repo's id-prefix convention in
   `src/repositories/ids.ts`. The `upsert` still keys on `slug`, so the
   precomputed id is used only when creating.
4. **RT3** — one batched **write**, `prisma.$transaction([…])`:
   `recruiterProfile.update` + `recruiterIdentityWrites(...)` (org upsert with
   the precomputed id, member upsert, role-assignment create only when RT2 found
   none). Array form: one round trip, still one transaction, still atomic.
5. **RT4** — the onboarding grant, in its own transaction; failure is logged and
   healed on the next credit read.

~7 round trips → 3 for setup + 1 for the grant. **Nothing else about the setup
flow changes**: no revalidate is added (the comment explaining its absence
stays), and the step schemas, the guards and `resolveSetupSubject` are untouched.

**Race:** if another request creates the organization between RT2 and RT3, the
member upsert's FK fails and the whole batch rolls back — the action returns its
existing "Could not finish setup. Try again." and a retry succeeds. It errors
rather than corrupting, which is the correct trade for a flow one person runs
once.

---

## 10. (G) Tests

Two suites, both in the plain-tsx style this repo uses (there is no test
framework):

- **`src/features/hire/credits.test.ts`** — `npm run test:credits`. Pure logic,
  configuration behaviour and source assertions. No database.
- **`prisma/scripts/check-credit-ledger.ts`** — `npm run db:check:credit-ledger`.
  The concurrency and reconciliation proofs, against a **dev Neon branch only**,
  refusing to run against the production host the way `points.ts` guards
  `PRODUCTION_NEON_HOST_ID`.

| # | Requirement it covers | Where |
|---|---|---|
| 1 | $200 initial credit | `credits.test.ts` — the registry default is `20000`, and `20000` formats as `$200.00`. |
| 2 | Changing runtime starting-credit config affects future initialisation, no deployment | `credits.test.ts` — the accessor resolves the row's value over the default, and the grant reads the config at grant time rather than from a constant (source assertion). Proven end-to-end in §13 step 5. |
| 3 | Initial grant is idempotent | `check-credit-ledger.ts` — grant twice sequentially → one row. |
| 4 | Concurrent grants create exactly one row | `check-credit-ledger.ts` — 5 parallel grants → one row, balance $200. |
| 5 | Positive movement arithmetic | `credits.test.ts` + DB. |
| 6 | Negative movement arithmetic | `credits.test.ts` + DB. |
| 7 | `balanceBefore` / `balanceAfter` correctness | Both: the chain invariant `after - before === amount`, and each row's `before` equals the previous row's `after`. |
| 8 | Ledger-derived balance | DB — `getCreditBalance` (latest `balanceAfter`) equals `SUM(amount)`. |
| 9 | `CreditAccount` projection reconciliation | DB — `CreditAccount.balance === SUM(CreditTransaction.amount)` after **every** mutation in the suite, not only at the end. |
| 10 | Concurrent debits cannot overspend | DB — 10 parallel $20 debits against $100 → exactly 5 succeed, 5 `INSUFFICIENT_CREDITS`, final balance $0, 5 debit rows. |
| 11 | Insufficient balance at the foundation | DB — a debit larger than the balance returns `INSUFFICIENT_CREDITS`, writes no ledger row and leaves the balance untouched. |
| 12 | Deterministic idempotency keys | `credits.test.ts` — `grant:onboarding:<org>` is stable and org-scoped; the `unlock:` namespace is reserved and unused. |
| 13 | Missing/invalid price fails closed, never free | `credits.test.ts` — missing row, null column, `0`, negative, over-max and non-numeric all resolve to the non-zero default. |
| 14 | Exactly one writer | `credits.test.ts` source assertion — `creditTransaction` is written in one file only. |
| 15 | No mutable stored balance is the source of truth | `credits.test.ts` source assertions — no balance column on `Organization`/`RecruiterProfile`/`User`; `CreditAccount.balance` is read nowhere outside `repositories/credits.ts`; `getCreditBalance` reads `CreditTransaction`. |
| 16 | No interactive `$transaction` in `completeRecruiterSetupAction` | `credits.test.ts` source assertion. |
| 17 | T-226 isolation and T-225 work-email unaffected | The existing suites, unmodified: `npm run test:recruiter-workspace`, `npm run test:work-email`, `npm run test:registration-gate`. Plus source assertions that `hasContactAccess` and `entitlements.ts` are byte-identical. |

## 11. (H) Risks and edge cases

| # | Risk | Handling |
|---|---|---|
| R1 | **$200 vs T-148's "100 credits".** Unit and price ambiguity on a money path. | C-1 fixes the unit as cents; the unlock price is flagged for Sohail before merge and is a one-row edit after. |
| R2 | Cache/ledger drift. | Both written by one statement (§6.2); `db:check:credit-ledger` proves it; `reconciledAt`/`version` carry the audit. |
| R3 | Raw SQL bypasses Prisma's types. | Confined to one function in one file, parameterised (`$queryRaw` tagged template — never string interpolation), covered by tests 11–13. |
| R4 | ~~Lazy grant writes on a read path.~~ | **Removed by design** (§7.3). No read creates money. The cost is that legacy workspaces read `$0.00` until the backfill runs, which is why the backfill is a required deploy step. |
| R5 | Retrofit duplicates provisioning logic in two shapes. | `recruiterIdentityWrites` is the single definition of the writes; `provisionRecruiterIdentity` calls the same intent. Source assertion that the workspace slug is built in exactly one place. |
| R6 | Precomputed org id vs a concurrent creator. | Batch rolls back; existing error message; retry succeeds (§9.3). |
| R7 | `onDelete: Restrict` blocks `db:cleanup:*`. | `prisma/cleanup.ts` updated in the same change; verified by running `db:cleanup:test` on a dev branch. |
| R8 | A `PlatformConfig` row edited to a nonsense value takes effect immediately. | Zod bounds in the registry; out-of-range falls back to the default and logs. |
| R9 | Migration against production. | Purely additive (three CREATE TABLEs, one CREATE TYPE), no locks on hot tables. Still follows §12. |
| R10 | Someone later "optimises" reads onto `CreditAccount.balance`. | Test 7 fails the moment they do. |
| R11 | T-226 not yet merged. | Blocking note at the top; do not start until it is. |
| R12 | Plan 078 freeze. | Nothing here touches legacy tables, `SkillEvidence`, points, or any `ENABLE_NEW_*` flag. These are new, 078-native tables with plain cuids — what CLAUDE.md prescribes for new surfaces. |
| R13 | `BigInt` `seq` crossing a JSON boundary. | It never leaves the server as a raw BigInt; `listCreditTransactions` returns it as a string cursor. |

---

## 12. DB safety

Schema changes, so before any migration runs:

1. Commit the code checkpoint; record the commit hash in this file.
2. Take a **Neon branch snapshot** of production and note the branch name.
3. `npx prisma migrate dev --create-only --name credit_ledger_and_platform_config`,
   read the generated SQL, then `npx prisma migrate dev` against the dev branch.
4. `npx prisma generate`.
5. `npm run db:seed:platform-config` (dev branch first).
6. `npm run db:check:credit-ledger` — expected to report zero workspaces, cleanly.
7. Production `migrate deploy`, `db:seed:platform-config` and
   `db:backfill:credit-grants --apply` (in that order — the backfill reads the
   config) are **a separate, explicitly approved step**, not part of this task.
   The backfill is **required**, not optional: without it every recruiter whose
   workspace predates this change reads `$0.00` (§7.3).

---

## 13. Verification

- `npx prisma generate` succeeds; `npm run lint` and `npx tsc --noEmit` clean.
- `npm run build` passes.
- `npm run test:credits` — all green.
- Manual, on a dev branch with T-226 merged:
  1. Register a recruiter → run the setup wizard → complete it.
  2. **Time the completion.** Expect well under 2s where it was ~8.6s. Record
     the measured number in `docs/CHANGELOG.md`.
  3. `SELECT * FROM "CreditTransaction"` → exactly one row: `GRANT_ONBOARDING`,
     `amount = 20000`, `balanceBefore = 0`, `balanceAfter = 20000`, `reason` set,
     `idempotencyKey = grant:onboarding:<org>`.
  4. Re-run the completion action → still exactly one ledger row.
  5. Edit `PlatformConfig` `credits.starting_grant_minor` to `50000`, register a
     second recruiter → the second grant is 50000, the first is untouched.
  6. `npm run db:check:credit-ledger` → reconciled, no drift.
  7. `/hire`, `/talent/login`, admin approve/reject still behave exactly as before.
- **Changed files must be exactly** those listed in §9 — nothing else.

### What was *not* verified

**The setup wizard was never clicked through in a browser.** Registration
requires an email OTP and the dev bypass lives in `.env.local`, which this task
was not permitted to touch, so no run of the wizard was observed and no
"Workspace ready" screen was seen. Do not describe this task as browser-verified.

What *is* verified in that area, and what it is worth:

- `npm run build` compiles `/talent/setup`.
- T-226's own regression suite still passes in full, including "finishing setup
  does not bounce off its own guard" — T-226's browser verification stands for
  the T-226 work and is not re-litigated here.
- `credits.test.ts` asserts that `completeRecruiterSetupAction` contains no
  `revalidatePath` call and no `next/cache` import, which is the precise cause of
  the flash bug T-226 fixed.
- The provisioning path that funds a workspace was exercised against the dev
  database directly, which covers the grant but not the wizard around it.

That is source-level and build-level assurance. It is not an observation of the
screen, and the difference is the point.

---

## 14. Guardrails for Cursor (DO NOT)

- **DO NOT** implement contact unlock, spend, purchase, top-up, or any UI.
  T-228 stops at the foundation (requirement 9). The debit *primitive* is built
  and tested; no product code calls it.
- **DO NOT** present the seeded unlock price as a product decision, or infer one
  from T-148's 100/10 example. It is a labelled placeholder (C-7).
- **DO NOT** re-implement, wrap or fork anything from T-226 — consume
  `requireRecruiterWorkspace()` and `provisionRecruiterIdentity` as they are.
- **DO NOT** grant credits from a read path.
- **DO NOT** modify `src/features/hire/contact-access.ts` (T-148 §6, must stay
  100% unchanged) or `src/features/hire/entitlements.ts` (still `NOT_IMPLEMENTED`).
- **DO NOT** modify `approveRecruiterAction`, `rejectRecruiterAction`,
  `saveRecruiterSetupStepAction`, the registration flow, or the login flow
  (requirement 10).
- **DO NOT** add a balance column to `Organization`, `RecruiterProfile` or
  `User`. That is Risk R17.
- **DO NOT** read `CreditAccount.balance` from anywhere outside
  `src/repositories/credits.ts`.
- **DO NOT** insert a `CreditTransaction` from anywhere outside that file.
- **DO NOT** put the starting grant or the unlock cost in `process.env`,
  `feature-flags.ts`, or a constant a deploy would be needed to change.
- **DO NOT** let a missing or invalid config row resolve the unlock cost to 0.
- **DO NOT** re-introduce interactive `$transaction(async tx => …)` in
  `recruiter-setup-actions.ts`.
- **DO NOT** add `revalidatePath` to `completeRecruiterSetupAction` — the
  comment in that file explains what it broke last time.
- **DO NOT** touch `middleware.ts`, `auth.config.ts`, or anything on the edge
  import path.
- **DO NOT** run migrations, seeds, backfills, or cleanup against production, and
  do not edit `.env.local`.
- **DO NOT** use `console.error`; use `lib/logger.ts`. No `any`. Zod at every
  boundary. `select` on every Prisma query.
- **DO NOT** create files beyond §9.

---

## 15. (I) What T-148 constrains

1. **Model names and shape are signed off** — `CreditAccount`,
   `CreditTransaction`, `CreditTransactionType` with those five members. Do not
   rename them; T-095/T-105/T-128 are written against these names.
2. **Balances are org-scoped, not recruiter-scoped.** T-228 says "a recruiter";
   T-226 makes those the same thing (C-2).
3. **The stored balance must be a cached projection, never the counter.**
   T-148 §2 / ARCHITECTURE.md §1 pillar 2 — the same rule as T-228 requirement 4,
   which is why keeping `CreditAccount` does not violate it.
4. **`unlock:<organizationId>:<candidateUserId>` is reserved** as T-229's
   idempotency key. T-228 uses `grant:onboarding:<organizationId>` and must not
   consume the unlock namespace.
5. **The debit mechanism is fixed:** conditional decrement guarded by
   `WHERE balance >= cost` (T-148 §4.3), not read-then-write.
6. **The unlock transaction boundary is fixed** (T-148 §4.4: debit + ledger +
   `CONTACT_SHARED` in one commit). `applyCreditChange` must therefore accept a
   caller-supplied `tx` — a function that opens its own transaction would make
   §4.4 impossible to honour.
7. **`hasContactAccess()` stays 100% unchanged** and access stays derived from
   `TalentEngagementRequest.status === "CONTACT_SHARED"`. Credits gate whether a
   `CONTACT_SHARED` row may be written; they are never themselves the access check.
8. **`entitlements.ts` must keep failing closed** until T-033. T-228 does not
   wire `checkPlanLimit` to the balance.
9. **D-17 names `PlatformConfig` / `PlanLimit`** as the home for these numbers,
   which is why §5 builds `PlatformConfig` rather than a differently-named table.
10. **D-17's seeded values (100 / 10) conflict with T-228's $200.** Resolved by
    C-1 + the open question in §3; the ledger design does not depend on which
    numbers win.

---

## 16. What running the proofs changed

`npm run db:check:credit-ledger -- --prove` was written expecting to confirm the
design. It failed instead, three times, and each failure was worth the run.

1. **The unique-violation catch was too narrow.** `grantOnboardingCreditsAtomic`
   matched only `P2002` on a `PrismaClientKnownRequestError`. A transaction that
   has already issued a `$queryRaw` — which every credit movement does — can
   surface the driver's own error instead, as a `PrismaClientUnknownRequestError`
   carrying SQLSTATE 23505. Five concurrent grants therefore threw where they
   should have reported `duplicate: true`. Now both shapes are recognised, and a
   collision on the *account* row (as opposed to the ledger key) is retried
   rather than misreported as a duplicate, bounded at three attempts.

2. **Prisma's 5s interactive-transaction default is too short for this path.**
   Every waiting transaction pays for the lock holder's whole network round trip,
   so ten concurrent debits walked straight through the ceiling and threw instead
   of being refused. Credit movements now run with
   `{ maxWait: 20000, timeout: 20000 }` — the allowance `points.ts` already
   uses — and `applyCreditChange`'s doc comment tells T-229 to pass the same.
   **This is a constraint on T-229, not an implementation detail.**

3. **A "one statement" optimisation was silently wrong.** Folding the account
   upsert into the movement as `INSERT … SELECT … WHERE amount >= 0 ON CONFLICT
   DO UPDATE` produces no candidate row for a debit, so `ON CONFLICT` never
   fires and *every debit is refused*. Reverted, with a comment saying why, so
   the next person to spot the "redundant" upsert does not re-introduce it.

None of the three is reachable by a type checker or a unit test. The script is
also now self-cleaning: a crashed run used to leave scratch rows that the
reconcile pass reported as drift in real data.

---

## 16. Commit message

```
feat(credits): append-only credit ledger and runtime platform config (T-228)

Add CreditAccount + CreditTransaction and a PlatformConfig settings table so
the starting grant and the contact-unlock price are data, not a deployment.
Balance is derived from the ledger; the account row is a cached projection
used only to serialise and bound a movement. The onboarding grant is written
exactly once per workspace, enforced by a unique idempotency key.

Retrofits completeRecruiterSetupAction onto the batched $transaction form,
which is the same fix approveRecruiterAction already carries: ~7 Neon round
trips down to 3.

No contact unlock, no spend path — T-229/T-230 consume this.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
