# 114 — T-148: Contact Unlock & Credit Ledger Plan

> ⛔ **STOP — DO NOT WRITE PRODUCT CODE OR PRISMA MIGRATIONS.**
> Written plan and architectural contract for T-148 (P0, HIGH RISK — money path and candidate contact privacy).
> Reviewed and approved by Sohail **before any product code or migration is written**.
> Unblocks Wave 1 build tasks: T-030 (unlock build), T-032 / T-033 (R2 limits & entitlements), T-095 (org admin credits view), T-105 (purchase/topup), T-128 (cost preview).

**Owner:** Zainab · **Task:** T-148 (Tue 08 Sep) · Stream: `G0 Decisions & Foundations`  
**Due:** 2026-09-08 · **Requirement:** #66  
**Investigated & Designed:** 2026-09-08, branch `T-003` / `T-148`  
**Technical Reviewer:** Sohail  
**Status:** **APPROVED & SIGNED BY SOHAIL (2026-09-08)**

---

## 1. Decisions Status & Configuration Baseline

| # | Decision | Status | Architectural Ruling & Business Values |
|---|---|---|---|
| **D-16** | Is contact unlock a plan allowance or a money-shaped credit balance? | **DECIDED** | **CREDIT LEDGER.** Append-only double-entry ledger (`CreditTransaction`) with cached, versioned account summary (`CreditAccount`). Follows proven precedent of `PointsAccount` + `PointsTransaction` (`schema.prisma:2867-2906`). Avoids bare counter column (Risk R17). |
| **D-17** | Where do starting credit amount and unlock cost live? | **DECIDED** | **DATABASE CONFIGURATION, AUDITED.** Stored as DATA in `PlatformConfig` / `PlanLimit` (D-3). Editable without code deployments. Initial seed values: **100 credits on registration**, **10 credits per unlock**. |
| **D-5** | How does a recruiter earn the right to see contact details? | **DECIDED** | **PLAN CREDIT (INSTANT).** Spend credits → write `TalentEngagementRequest` at `CONTACT_SHARED` → reveal contact. Replaces admin approval gate for contact release. |
| **D-8** | Candidate privacy copy vs discoverability default | **STAGED (T-016)** | Candidate switches (`showEmail`, `showPhone`, `showResume`) are strictly honoured. Never override a candidate's switch. |

---

## 2. Why a Ledger, Not a Counter (Mitigating Risk R17)

If R2 were to ship a bare `creditBalance Int` column on `Organization`:
1. **Audit Blindness:** When an admin or recruiter asks "Who spent these credits?", no row exists to answer.
2. **Double-Spend & Overdrafts:** Network retries or rapid clicks would cause multiple debits.
3. **Downstream Blockers:**
   - **T-095 (Company Admin Usage View):** Needs a transaction table showing which team member unlocked which candidate, when, and at what cost.
   - **T-105 (Credit Purchase/Topup):** Needs clear ledger entries for credit grants and payment receipts.
   - **T-128 (Cost Preview & Balance Display):** Relies on deterministic ledger calculation and reservation.

---

## 3. Database Ledger Model (`prisma/schema.prisma`)

```prisma
/// Cached credit balance per organisation with optimistic locking.
/// Ground truth is SUM(CreditTransaction.amount) WHERE organizationId = orgId.
model CreditAccount {
  id             String    @id @default(cuid())
  organizationId String    @unique
  balance        Int       @default(0)
  lifetimeEarned Int       @default(0)
  lifetimeSpent  Int       @default(0)
  version        Int       @default(0)
  reconciledAt   DateTime?
  updatedAt      DateTime  @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)

  @@index([balance(sort: Desc)])
}

/// Append-only financial-grade credit ledger.
model CreditTransaction {
  id              String                @id @default(cuid())
  organizationId  String
  recruiterUserId String
  candidateUserId String?
  amount          Int                   /// Negative for debits/spend, positive for grants/purchases
  type            CreditTransactionType /// GRANT_ONBOARDING | PURCHASE | UNLOCK_CONTACT | ADMIN_ADJUSTMENT | REFUND
  sourceType      String                /// e.g. "TALENT_ENGAGEMENT_REQUEST", "ORGANIZATION"
  sourceId        String?               /// e.g. engagementId
  idempotencyKey  String                @unique /// Deterministic deduplication key
  reason          String?
  metadata        Json?
  createdAt       DateTime              @default(now())

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  recruiter    User         @relation("RecruiterCreditTransactions", fields: [recruiterUserId], references: [id], onDelete: Restrict)
  candidate    User?        @relation("CandidateCreditTransactions", fields: [candidateUserId], references: [id], onDelete: Restrict)

  @@index([organizationId, createdAt(sort: Desc)])
  @@index([recruiterUserId, createdAt(sort: Desc)])
  @@index([candidateUserId])
  @@index([createdAt(sort: Desc)])
}

enum CreditTransactionType {
  GRANT_ONBOARDING
  PURCHASE
  UNLOCK_CONTACT
  ADMIN_ADJUSTMENT
  REFUND
}
```

---

## 4. The Approved Four Core Architecture Elements & Proofs

### 4.1 Approved Item 1: Ledger Shape
- `CreditAccount`: Cached account summary with version column for optimistic locking.
- `CreditTransaction`: Immutable, append-only history of every credit grant and debit.
- True balance ground truth: `SUM(CreditTransaction.amount) WHERE organizationId = :orgId`.

---

### 4.2 Approved Item 2: Idempotency & Double-Charge Prevention

```
Recruiter has 10 credits
       ↓
Unlock candidate
       ↓
Debit 10
       ↓
Ledger entry created
       ↓
Network/request retries
       ↓
Same idempotency key
       ↓
NO second debit
```

- **Format:** `unlock:<organizationId>:<candidateUserId>`
- **Database Unique Constraint:** `@unique` index on `CreditTransaction.idempotencyKey`.
- **Pre-check:** `hasContactAccess(recruiterUserId, candidateUserId)` checks if access already exists (`status === "CONTACT_SHARED"`). If true, returns immediately with `cost: 0` and `charged: false`. Zero credits debited, zero ledger entries added.
- **Retry Safety:** A duplicate request with the same idempotency key hits the unique index, triggering rollback and safely returning existing access without a second charge.

---

### 4.3 Approved Item 3: Concurrency & Overspending Prevention

```
50 credits
       ↓
10 simultaneous unlock attempts
       ↓
Atomic balance >= 10 check
       ↓
5 succeed = 50 credits spent
5 fail = insufficient credits
       ↓
Balance can never go below 0
```

- **Mechanism:** `debit_strict` atomic conditional decrement (`src/repositories/points.ts:284-291` & `428-440`):
  ```sql
  UPDATE "CreditAccount"
  SET "balance" = "balance" - 10,
      "lifetimeSpent" = "lifetimeSpent" + 10,
      "version" = "version" + 1,
      "reconciledAt" = NOW()
  WHERE "organizationId" = :orgId
    AND "balance" >= 10;
  ```
- **PostgreSQL Row-Lock Serialization:**
  - 10 simultaneous requests against 50 credits queue on the `CreditAccount` row lock.
  - Requests 1 through 5 evaluate `balance >= 10` as TRUE, decrement balance by 10 each, and update `count = 1`.
  - At Request 6, `balance = 0`. The predicate `0 >= 10` evaluates to FALSE. `count = 0`.
  - Requests 6 through 10 match 0 rows (`count = 0`), rolling back safely and returning `{ ok: false, reason: "INSUFFICIENT_CREDITS", remaining: 0 }`.
  - **Result:** Exactly 5 succeed, exactly 5 fail. Overdraft is impossible.

---

### 4.4 Approved Item 4: Unlock Transaction Boundary

All steps of an unlock commit inside a single atomic database transaction (`prisma.$transaction`):
1. **Debit Credit:** Execute atomic conditional decrement (`WHERE balance >= 10`). If `count === 0`, abort with `INSUFFICIENT_CREDITS`.
2. **Create Ledger Transaction:** Insert `CreditTransaction` row with deterministic `idempotencyKey` and candidate attribution.
3. **Grant Access:** Upsert `TalentEngagementRequest` for `(recruiterUserId, candidateUserId)` with `status: "CONTACT_SHARED"`, `decidedAt: new Date()`, `decidedByAdminId: null` (released by credit).
4. **Commit Boundary:** All three actions commit atomically. If any step fails (insufficient credits, unique key conflict, DB failure), **everything rolls back**. No orphan spends, no unbilled reveals.

---

## 5. Security & Isolation Checklist

- [x] **Server-side enforcement:** Credit check and access verification are server-only (`import "server-only"`). Browser cannot spoof balance or bypass cost.
- [x] **Tenant Isolation:** Every credit operation resolves `organizationId` from active `OrganizationMember` server session. A recruiter from Org A cannot spend or inspect Org B's credits.
- [x] **Privacy Leak Prevention:** On refused requests (`INSUFFICIENT_CREDITS`), raw response contains **zero** candidate PII (no phone, no email, no resume URL).
- [x] **Candidate Consent & Visibility:** Candidate must pass `searchableUserWhere()` before credits are checked. If a candidate withdrew, request fails with `CANDIDATE_UNAVAILABLE` before billing.

---

## 6. Regression Check Verification

> **Rule:** `hasContactAccess()` in `src/features/hire/contact-access.ts` must remain **100% UNCHANGED**.

```typescript
export async function hasContactAccess(
  recruiterUserId: string,
  candidateUserId: string,
): Promise<boolean> {
  const shared = await prisma.talentEngagementRequest.findFirst({
    where: {
      recruiterUserId,
      candidateUserId,
      status: "CONTACT_SHARED",
    },
    select: { id: true },
  });
  return shared !== null;
}
```
Access continues to be derived solely from `TalentEngagementRequest.status === "CONTACT_SHARED"`. Commercial gates only determine whether a new `CONTACT_SHARED` row can be written.

---

## 7. Downstream Task Map

- **T-030 (Contact Unlock Build):** Implements the server action using `debit_strict` and `idempotencyKey`.
- **T-032 (Plan Limits as Data):** Seeds the database configuration for `CONTACT_UNLOCK` limit (100 starting credits, 10 cost).
- **T-033 (Server-Side Entitlement Check):** Implements `checkPlanLimit` against `CreditAccount.balance`.
- **T-095 (Company Admin Usage View):** Queries `CreditTransaction` to display who spent credits, on whom, and when.
- **T-128 (Recruiter Cost Preview):** Queries `CreditAccount.balance` and displays cost before spend.

---

## 8. Sign-off & Approval

- **Author:** Zainab (Developer)
- **Technical Reviewer:** Sohail (Architect & Tech Lead)
- **Status:** **APPROVED & SIGNED**
- **Approved Items:**
  1. Ledger shape (`CreditAccount` + `CreditTransaction`)
  2. Idempotency & double-charge prevention (`unlock:<organizationId>:<candidateUserId>`)
  3. Concurrency / overspending prevention (`UPDATE ... WHERE balance >= cost`)
  4. Unlock transaction boundary (debit + ledger + `CONTACT_SHARED` atomic commit)
  5. D-17 Database Configuration (100 free initial credits / 10 credits per unlock)
- **Date:** 2026-09-08
