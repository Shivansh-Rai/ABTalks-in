# 119 — T-229 + T-230: Contact unlock with cost shown first, and unlock safety

**Owner:** Zainab · **Tasks:** T-229 (wall 11 Sep, Demo 1) + T-230 (wall 11 Sep, Demo 1)
**Depends on:** T-228 ✅ (credit ledger), T-226 ✅ (workspace), T-148 (signed architecture), design **T-202**
**Blocks:** T-232, T-233, T-257 (Sohail), T-258 (Sohail), T-267
**Test cases:** TC-R-009, TC-R-010, TC-R-011 (T-229) · TC-R-012, TC-R-013 (T-230)

> One plan, two tickets, because they are one code path. T-229 is the visible
> behaviour; T-230 is the guarantee underneath it. They can still ship as two
> PRs — §11 says where the seam is.

---

## 1. Goal

A recruiter sees what an unlock costs *before* spending, pays $10 once, and the
candidate's protected contact details appear. Unlocking the same candidate again
is free. Under retry, concurrency or a replayed request the recruiter is charged
exactly once, and an unlock they cannot afford is refused server-side with no
ledger row.

## 2. Current behaviour

- **Access is already modelled and must not change.** `hasContactAccess()`
  derives access solely from `TalentEngagementRequest.status === "CONTACT_SHARED"`
  (`src/features/hire/contact-access.ts`). T-148 §6 requires this file stay
  byte-identical; `credits.test.ts` and `contact-payload.test.ts` both assert it.
- **`loadProtectedContact` / `loadProtectedContacts` already refuse before
  selecting `email`/`phone`.** Contact reveal needs no new reader — T-229 only
  has to make a `CONTACT_SHARED` row appear legitimately.
- **Today the only route to `CONTACT_SHARED` is admin approval.**
  `placeEngagementRequestAction` (`src/app/actions/hire-request-actions.ts:31`)
  creates a `SUBMITTED` engagement; an admin decides it later. The recruiter UI
  for that is `RequestIntroButton`, which renders "Request sent / With our team /
  Contact shared" from `existingStatus`.
- **The credit primitive exists and is proven.** `applyCreditChange(tx, input)`
  takes the caller's transaction, does a conditional decrement
  (`WHERE balance + amount >= 0`), and appends a ledger row whose
  `balanceBefore`/`balanceAfter` come from the same statement's post-image.
  `db:check:credit-ledger --prove` already demonstrates 10 concurrent $20 debits
  against $100 leaving exactly five winners, and 5 concurrent grants collapsing
  to one row.
- **The price is configured.** `credits.contact_unlock_cost_minor = 1000` ($10),
  matching the demo contract §5 and T-229's own row. A missing or invalid row
  resolves to the non-zero default; it can never resolve to free.
- **No balance is displayed anywhere yet.** Confirmed by inspection: nothing
  imports `getWorkspaceCredits`. T-229 is where the balance first reaches a
  screen.
- `entitlements.ts` still returns `NOT_IMPLEMENTED` and **stays that way** —
  wiring plan limits is T-231, tomorrow.

## 3. Decisions

| # | Decision | Ruling |
|---|---|---|
| **U-1** | What "unlock" writes | Debit + ledger row + `TalentEngagementRequest` at `CONTACT_SHARED` **in one transaction** (T-148 §4.4). Access stays derived from the engagement row; credits only decide whether one may be written. |
| **U-2** | Idempotency key | `unlock:<organizationId>:<candidateUserId>` — the namespace T-148 §4.2 reserved and T-228 deliberately left unused. |
| **U-3** | Repeat unlock is free | Checked **before** any credit work, via `hasContactAccess`. Returns `{ charged: false, cost: 0 }`. No ledger row, no second engagement. |
| **U-4** | Order of refusals | Already-unlocked → candidate still eligible → sufficient credits. A recruiter must never be told "buy more credits" when the real reason is the candidate is gone (T-148 §5). |
| **U-5** | Who resolves the workspace | `requireRecruiterWorkspace()` — session-derived `organizationId`, never from the payload. Eligibility still goes through `resolveEligibleCandidates`, which refuses `SAMPLE:` refs. |
| **U-6** | Transaction allowance | `{ maxWait: 20000, timeout: 20000 }`. Non-negotiable — Prisma's 5s default breaks under lock contention. This is why T-228 flagged it. |
| **U-7** | Cost preview is a read | A separate server function returns cost/balance/remaining. It **must not** be trusted on submit; the action re-reads and re-checks. The preview informs, the server decides. |

## 4. (A) Schema

**None.** `TalentEngagementRequest`, `CreditTransaction` and `PlatformConfig`
already carry everything. `CreditTransaction.candidateUserId` and `sourceId`
exist precisely for this.

One field question for review: an unlock-created engagement has
`decidedByAdminId: null` because no admin decided it. That is T-148 §4.4's
instruction and needs no column — but admin surfaces (T-266/T-267) should read
"released by credit" from `source`/ledger rather than inferring from a null.

## 5. (B) The unlock primitive

`src/features/hire/unlock-contact.ts` `[new]`, `server-only`.

```ts
export type UnlockRefusal =
  | "NOT_A_RECRUITER"
  | "CANDIDATE_UNAVAILABLE"
  | "INSUFFICIENT_CREDITS";

export type UnlockResult =
  | { ok: true; charged: boolean; costMinor: number; balanceMinor: number; engagementId: string }
  | { ok: false; reason: UnlockRefusal; message: string; balanceMinor: number };

export async function unlockContact(candidateRef: string): Promise<UnlockResult>;
export async function previewUnlock(candidateRef: string): Promise<UnlockPreview>;
```

`unlockContact` in order:

1. `requireRecruiterWorkspace()` → `organizationId`, `userId`.
2. `resolveEligibleCandidates([candidateRef])` → refuses `SAMPLE:` and anyone
   out of pool. Refusal is `CANDIDATE_UNAVAILABLE`, **before** any billing.
3. `hasContactAccess(userId, candidate.userId)` → if true, return
   `{ ok: true, charged: false, costMinor: 0 }`. **U-3.**
4. `getIntConfig(CONTACT_UNLOCK_COST_KEY)`.
5. One transaction, with U-6's allowance:
   - `applyCreditChange(tx, { amount: -cost, type: "UNLOCK_CONTACT", candidateUserId, sourceType: "TALENT_ENGAGEMENT_REQUEST", idempotencyKey: unlockKey(orgId, candidateUserId), reason: "Contact unlock" })`
   - `ok: false` → return `INSUFFICIENT_CREDITS`, transaction rolls back, **no
     engagement row, no ledger row**.
   - `duplicate: true` → a concurrent request already paid; do not charge again,
     fall through to resolve the engagement.
   - Upsert the engagement to `CONTACT_SHARED` with `decidedAt: new Date()`.
   - Update the ledger row's `sourceId` to the engagement id **only if it can be
     done in the same transaction without a second read** — otherwise carry the
     engagement id in `metadata`, which needs no follow-up write.
6. Return balance from the change result.

A P2002 escaping the transaction means a concurrent unlock won the race; the
action catches it, re-reads access and reports `charged: false`. Same shape as
`grantOnboardingCreditsAtomic`, including the `isUniqueViolation` helper that
recognises an unmapped SQLSTATE 23505 — **reuse it, do not rewrite the narrow
`P2002`-only check that T-228's proofs already caught once.**

## 6. (C) Server action

`src/app/actions/hire-unlock-actions.ts` `[new]` — `unlockContactAction`,
Zod-validated (`candidateRef` only; never an org id, never a cost), returning the
result envelope. Revalidates `/hire` and `/hire/requests`.

**Cost is never accepted from the client.** The dialog displays a number; the
server independently reads the config and charges that. A payload carrying a
price is a payload that can carry `0`.

## 7. (D) UI — cost shown first

`src/components/hire/unlock-contact-dialog.tsx` `[new]`, Client Component.

Opened from the existing candidate surfaces. Before confirmation it states, per
T-229's acceptance criteria:

- **this unlock costs** $10.00
- **your balance** $200.00
- **you will have left** $190.00

Three states beyond the default: already unlocked (free, no confirm step),
insufficient balance (refused, readable message, no confirm button), and
in-flight (button disabled — belt, not the guarantee; U-2 is the guarantee).

`RequestIntroButton` keeps working for the admin-introduction path; this is a
second, separate control. **Do not** repurpose the intro button — the two mean
different things and T-233/T-267 read them differently.

> **Design dependency.** T-202 (credits, unlock and plans screens, Shallika,
> dated 9 Sep) gates T-229, T-231, T-232 and T-233 per the UI-UX sheet.
> **Its real status is unknown** — the workbook's status columns are static
> snapshots (every row reads "Not Started" / "Not Approved", including tasks
> already shipped), so they say nothing about what is actually done. Ask
> Shallika directly before building the dialog. Until then, build against
> T-229's textual acceptance criteria — cost, balance, remaining, repeat-free
> and insufficient-balance states — and expect a visual pass. Do not invent a
> plans/limits surface; that is T-231.

## 8. (E) Transaction boundaries

| Step | Boundary |
|---|---|
| Preview | Reads only. No transaction. |
| Eligibility + already-unlocked | Reads, outside the transaction, before billing. |
| Debit + ledger + `CONTACT_SHARED` | **One** transaction, `{ maxWait: 20000, timeout: 20000 }`. T-148 §4.4. |
| Refusal | The transaction rolls back whole. No orphan spend, no unbilled reveal. |

## 9. (F) Files

**New:** `src/features/hire/unlock-contact.ts` · `src/app/actions/hire-unlock-actions.ts` ·
`src/components/hire/unlock-contact-dialog.tsx` · `src/lib/validations/hire-unlock.ts` ·
`src/features/hire/unlock-contact.test.ts`

**Edited:** the candidate surface that mounts the dialog (one file — decide which
during build, do not touch several) · `package.json` (`test:unlock`, `cross-env`
prefixed) · `docs/CHANGELOG.md`

**Must not change:** `contact-access.ts`, `entitlements.ts`, `repositories/credits.ts`
(consume it, do not extend it), `hire-request-actions.ts`.

## 10. (G) Tests

Pure + source assertions in `unlock-contact.test.ts`; the concurrency proofs
extend `prisma/scripts/check-credit-ledger.ts`, which already has the harness.

| # | Covers | Where |
|---|---|---|
| 1 | Cost, balance and remaining are computed correctly and remaining = balance − cost | pure |
| 2 | Unlock key is deterministic and org+candidate scoped | pure |
| 3 | Refusal order: candidate-unavailable is decided before insufficient-credits | source assertion |
| 4 | The action never reads a cost from its payload | source assertion |
| 5 | `contact-access.ts` still byte-identical; `entitlements.ts` still `NOT_IMPLEMENTED` | source assertion |
| 6 | First unlock charges exactly $10, writes one ledger row, engagement is `CONTACT_SHARED` | **DB** |
| 7 | Repeat unlock: free, no second ledger row, no second engagement (TC-R-011) | **DB** |
| 8 | Two concurrent unlocks, same pair → exactly one charge (TC-R-012) | **DB** |
| 9 | Retry of a completed unlock → no second charge (TC-R-012) | **DB** |
| 10 | Insufficient balance → refused, **no ledger row**, no engagement, balance untouched (TC-R-013) | **DB** |
| 11 | Reconciliation holds after every unlock in the suite | **DB** |
| 12 | Refused payload carries zero candidate PII (T-148 §5) | **DB** |

Plus the existing gates: `test:credits`, `test:recruiter-workspace`,
`test:work-email`, `test:registration-gate`, `test:demo1-security`, `tsc`, lint,
build.

> `test:demo1-security` uses a bare `NODE_OPTIONS=` and will fail on Windows —
> it needs `cross-env`. Flag to Sohail rather than editing his script silently.

## 11. (H) The T-229 / T-230 seam

If splitting into two PRs: **T-229** = §5 steps 1–5, §6, §7, tests 1–7.
**T-230** = tests 8–12 plus whatever they expose. Most of T-230's machinery is
already built and proven inside T-228 — the conditional decrement and the unique
index — so T-230 is largely *proving it at the unlock level* rather than new
code. Do not let that tempt you into skipping the proofs: T-228's DB run found
three defects that no unit test reached.

## 12. Risks

| # | Risk | Handling |
|---|---|---|
| R1 | Repeat-unlock check races a first unlock and double-charges | The unique index is the guarantee; `hasContactAccess` is only the fast path. Test 8. |
| R2 | Debit succeeds, engagement write fails → charged with no access | Same transaction. Test 10 asserts the rollback leaves nothing. |
| R3 | Narrow `P2002` catch reappears | Reuse `isUniqueViolation`; source assertion. |
| R4 | 5s transaction default reintroduced | U-6; source assertion on the options object. |
| R5 | Contact leaks before payment | Nothing new reads contact; `contact-payload.test.ts` guards the payloads. Sohail's T-257 covers it independently. |
| R6 | Cost trusted from the client | Test 4. |
| R7 | T-202's status is unknown and the dialog may need rework | Acceptance criteria are textual, not visual; build to them and expect a visual pass. Confirm with Shallika rather than reading the workbook's status columns, which are stale. |

## 13. Guardrails for Cursor (DO NOT)

- **DO NOT** modify `contact-access.ts` or `entitlements.ts`.
- **DO NOT** add a `contactVisible` flag, or any second source of access truth.
- **DO NOT** accept a cost, balance, organization id or user id from the client.
- **DO NOT** open a second transaction inside `unlockContact`.
- **DO NOT** rely on the UI to prevent a second charge (T-230's regression guard).
- **DO NOT** build plans/limits — that is T-231.
- **DO NOT** repurpose `RequestIntroButton` or change the admin introduction path.
- **DO NOT** let a refusal response carry candidate PII.
