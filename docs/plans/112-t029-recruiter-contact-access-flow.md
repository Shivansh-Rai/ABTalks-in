# 112 — T-029: How a recruiter earns the right to see contact details

> ⛔ **STOP — DO NOT IMPLEMENT.**
> P1 *Investigate* output for T-029 (P0, HIGH RISK — releases personal data).
> Sohail reviews and approves this document **before any code is written**, and
> approves again before production. The junior must not self-merge.

**Owner:** Zainab · **Task:** T-029 (Sat 5 – Mon 7 Sep) · board `112-A`
**Feeds:** T-030 (unlock build, 5 days), T-032, T-033, T-016
**Investigated:** 2026-09-05 → 2026-09-07, branch `T-029`
**Status:** decisions in §1 taken by Sohail 2026-09-07. **One blocker left: D-8.**

---

## 1. Decisions taken (Sohail, 7 Sep)

| # | Decision |
|---|---|
| D-5 | **Contact unlock is by plan credit, not admin approval.** Spend credits → write `TalentEngagementRequest` at `CONTACT_SHARED` → reveal. |
| 1.1 | **10 credits per unlock.** |
| 1.2 | **100 free credits, one-time**, on registration. Not recurring. More only by purchase. |
| 1.3 | **Shortlisting costs nothing.** |
| 1.4 | **No bulk unlock.** One candidate at a time, deliberately — the recruiter must choose. |
| 1.5 | **Permanent unlock.** Once opened, that candidate stays unlocked for that recruiter forever. Re-opening costs nothing. |
| 1.6 | **An unlock reveals email, phone and CV** (D-F). One click, all three. |
| 1.7 | **First name is shown to everyone, including anonymous visitors.** Full name only after unlock. |
| 1.8 | **Payments are "coming soon."** At zero credits the recruiter simply cannot unlock anyone else. |
| — | The admin gate is removed **only** for contact release. Every other admin gate stays. |

**Still open: D-8** (§8). Everything else in this document is settled.

## 2. The single access-deciding function

`hasContactAccess(recruiterUserId, candidateUserId)` in
[src/features/hire/contact-access.ts](src/features/hire/contact-access.ts), with
its batch twin `contactAccessFor`.

> Access exists **iff** a `TalentEngagementRequest` row exists for this
> (recruiter, candidate) pair with `status = CONTACT_SHARED`.

Three properties that must survive T-030:

- **Derived, never stored.** No `contactVisible` boolean. A second flag is
  something a bug or a backfill can leave switched on.
- **Keyed on `candidateUserId`**, the only key all four tracks share.
- Under D-5 the **writer** changes (credits, not `requireAdmin`); the **rule and
  the reader do not**.

### ⚠️ Finding 1 — it has zero callers

Verified 7 Sep: `hasContactAccess` and `contactAccessFor` are called **nowhere**
in `src/`. The rule is re-implemented at:

| Site | How it decides |
|---|---|
| [requests/page.tsx:145,173](src/app/hire/requests/page.tsx) | inline `e.status === "CONTACT_SHARED"` |
| [pool.ts:527](src/features/talent-pool/pool.ts) | its own `findMany({ status: "CONTACT_SHARED" })` |
| `getTalentProfile` (same file) | hard-codes `contactReleased: false` — never releases at all |

**First implementation step, before any credit code:** route all three through
the one function.

## 3. What exists today

- **No plan, credit, quota, entitlement or billing anywhere.** Confirms T-033's
  premise. The only limits are the OTP window
  ([otp.ts:106-110](src/features/recruiter-auth/otp.ts), DB-backed) and the guest
  Scout limiter ([hire-guest-actions.ts:18-33](src/app/actions/hire-guest-actions.ts),
  **in-memory `Map`** — resets on cold start, per-instance).
- **Contact release currently reveals name + email only.** Phone, LinkedIn,
  GitHub and resume are on no recruiter surface.
- Discovery gate: `searchableUserWhere()`
  ([talent.ts:31-33](src/repositories/talent.ts)), guarded by
  `npm run test:visibility`.

### ⚠️ Finding 2 — the fields being sold have candidate switches that nothing reads

```
prisma/schema.prisma:2019   showEmail   Boolean @default(false)
prisma/schema.prisma:2020   showPhone   Boolean @default(false)
prisma/schema.prisma:2021   showResume  Boolean @default(false)
prisma/schema.prisma:2027   /// Audit trail for consent, required under DPDP.
```

`showEmail` and `showPhone` appear **zero times** in `src/`. `showResume`
appears four times, all in [talent.ts](src/repositories/talent.ts) (95, 126, 294,
345), only ever collapsing to a `hasResume` boolean.

The pattern for honouring these switches **already works** for a different
field — [hire.ts:168](src/repositories/hire.ts):
`const interview = idn?.showInterviewResults ? r.interview : null;`
So §6's field gating is an existing pattern, not a new invention.

### ⚠️ Finding 3 — there is no recruiter path to a CV

[service.ts:346](src/features/resume/service.ts) exposes only
`getOwnResumeFilePath(userId)`; its sole non-test caller is
[route.ts:29](src/app/api/profile/resume/file/route.ts), passing
`session.user.id`. No id parameter exists anywhere in the chain, and
[resume.test.ts:1408](src/features/resume/resume.test.ts) asserts that shape.

**D-1.6 therefore requires new infrastructure**: a new route handler streaming
from private Vercel Blob, gated on `hasContactAccess` **and** `showResume`.
This is the largest single piece of work T-030 acquired.

### ⚠️ Finding 4 — phone contradicts the published policy

```
content/legal/privacy.md:62    optional phone (admin-only; not shown to recruiters)
content/legal/privacy.md:167   ... interview summary and scores (not full transcript; not phone)
```
Releasing phone is a decision Sohail has taken; the policy must change **in the
same release**, not after.

### ⚠️ Finding 5 — `/hire` is public and ships full names to anonymous visitors

[middleware.ts:143-149](middleware.ts) exempts `/hire`, `/hire/matches`,
`/talent`, `/talent/shortlist`. `runGuestMatchAction`
([hire-guest-actions.ts:94](src/app/actions/hire-guest-actions.ts)) has no auth
check at all, and calls `toPublicMatch`, which sets the **full name** at
[to-public-match.ts:187](src/features/hire/to-public-match.ts), rendered at
[desk-match-card.tsx:210](src/components/hire/desk-match-card.tsx).

D-1.7 resolves this: first name only, everywhere pre-unlock. See §7.

Related copy defect, five lines apart: the banner at
[candidates/page.tsx:59](src/app/hire/[requestId]/candidates/page.tsx) says
*"Candidates are shown by reference ID. Names and contact details stay hidden…"*
directly above `<MatchResults>` at line 64, which renders names from
[load-request-matches.ts:170](src/features/hire/load-request-matches.ts). Under
D-1.7 the banner becomes wrong in a new way and must be rewritten.

## 4. The non-negotiable constraint

From [locked-preview.ts](src/features/hire/locked-preview.ts):

> A commercial gate may only ever show a **subset** of what the privacy gate
> already permits. Paying cannot widen it.

An unlock can only ever turn a "yes" into a "no". It must not remove, weaken or
route around `assertPoolAccess`, `searchableUserWhere()`, or the
`CONTACT_SHARED` rule.

## 5. Today's flow (what T-030 replaces)

1. Register → `RecruiterProfile`; `approved` true only if the email matches a
   live `VerifiedRecruiterSeat`.
2. Shortlist → `RecruiterShortlistItem`.
3. Request intro → `TalentEngagementRequest` `SUBMITTED`. Reveals nothing.
4. **Admin decides** at `/admin/hire` → `CONTACT_SHARED`.
5. `/hire/requests` renders name + `mailto:`.

Step 4 is what D-5 removes.

## 6. Approved flow

**A. Click.** *Unlock contact — 10 credits* on one candidate. No bulk (D-1.4).

**B. Three answers, ANDed, in this order:**
1. `hasContactAccess` → already unlocked? Show it, **spend nothing** (D-1.5).
2. Candidate still passes `searchableUserWhere()` and the pool gate. Someone who
   has withdrawn is not unlockable at any price.
3. Credits available? (T-033's shared server-side check.)

Order matters. The credit check is **last**, so a refusal never reads as "buy
more" when the real reason is that the candidate said no.

**C. Spend and record, in one transaction.** Debit 10, write
`status = CONTACT_SHARED` with `decidedAt` and a "released by credit" marker
rather than `decidedByAdminId`, write the ledger row, write the audit row
(proposed `RecruiterContactReveal`: recruiter, candidateUserId, engagementId,
revealedAt, ledger txn id; `onDelete: Restrict` on the candidate, matching
`TalentEngagementRequest`). A failed reveal must never bill; a successful one
must never go unrecorded.

**D. Reveal — availability shown *before* the spend.** Email always. Phone and CV
**only if the candidate's own switch is on** (Finding 2). The card states what is
available before the recruiter commits:

> **Unlock contact — 10 credits** · email + CV available · phone not shared

This is the resolution of the conflict between D-1.6 and Finding 2: it never
overrides a candidate's switch, and it never spends a credit on air. Price stays
10 either way — the recruiter is buying the introduction, not a per-field menu.

**E. Zero credits.** "You've used your 100 credits" + how to get more. **No
fragment** of contact — no partial email, no blurred name, no initial. No status
change, and the candidate is not told: running out is a fact about the
recruiter's plan, not about the candidate. Payments are deferred (D-1.8), so the
zero state is a genuine wall plus an admin top-up path.

**F. Re-open is free.** Short-circuits at B1.

**G. What stays admin.** `DECLINED` / `CLOSED` and the ability to retract remain.
Only the *approval* step is gone.

### ⚠️ Finding 6 — the leak test

T-030's acceptance: *"network tab on the refused case — NO email, phone or CV
link anywhere in the response."* The existing pattern fails this if copied:
[requests/page.tsx:58](src/app/hire/requests/page.tsx) selects `candidate.email`
**unconditionally** and gates at render. Safe today only because it is a Server
Component. **Rule for T-030: gate the query, not the JSX.**

## 7. Name policy (D-1.7)

| Tier | Name |
|---|---|
| Anonymous or registered, pre-unlock | **First name + reference ID** |
| After unlock | Full name + email + phone + CV |

Implementation notes:

1. **Derive server-side.** The full name must not leave the server pre-unlock.
   Three sites set it today: [to-public-match.ts:187](src/features/hire/to-public-match.ts),
   [load-request-matches.ts:170](src/features/hire/load-request-matches.ts),
   `getShortlist` in [pool.ts](src/features/talent-pool/pool.ts). One helper, all
   three. Truncating in the client leaves the full name in the RSC payload.
2. **Bump the browser cache keys.** [desk-shortlist.ts](src/components/hire/desk-shortlist.ts)
   (`abtalks-hire-star`) and [evidence-cache.ts](src/components/hire/evidence-cache.ts)
   (`abtalks-hire-evidence`) already persist full names to `localStorage`.
   Changing the server does not clear what is on people's machines.
3. **Splitting rule.** First whitespace-delimited token. If it is ≤2 characters
   or ends in a period, treat as an initial and fall back to the reference ID —
   single-token names, "S. Priya" and surname-first entries are all common here.
4. **Keep the reference ID beside the name.** Two Priyas in one list are
   otherwise indistinguishable.
5. Rewrite the `/hire/[requestId]/candidates` banner (Finding 5).

## 8. D-8 — the one remaining blocker

> Published privacy copy says recruiter discoverability is OPT-IN while the
> column defaults TRUE — and contact is now a paid unlock.
> Options: correct the copy / change the default / require consent.
> Ruling so far: resolve BEFORE the visibility control or the paid unlock ships.

The code is worse than "the column defaults true".
[dual-write.ts:89-91](src/repositories/dual-write.ts) stamps, on row creation:

```
searchableByRecruiters: true,
consentSource: "platform_default",
consentedAt: new Date(),
```

(also at 121-123 and 132-134). So a candidate who was never asked carries a
`consentedAt` timestamp: the field that exists to prove consent records when a
migration ran. And the gate ([talent.ts:32](src/repositories/talent.ts)) never
reads consent at all.

**The population is separable.** The same file writes
`consentSource: "program_apply_migrated"` where a real opt-in existed, carried
from `ProgramMember.recruiterVisibilityConsentAt` (schema:760). **Run a read-only
`groupBy consentSource` before deciding — it sizes every option and nobody has
run it.**

- **Option A — correct the copy.** Publish that discoverability is automatic.
  Ships without touching the pool, but states in the privacy policy that
  candidates are made discoverable without being asked while ABTalks charges for
  their details, with `platform_default` as evidence the practice was known.
  **Not recommended.**
- **Option B — change the default.** Fixes new rows only. A component of C, not
  an option.
- **Option C — require consent.** Add the condition to `searchableUserWhere()`
  and re-ask everyone stamped `platform_default`. Honest; mechanically small.
  Cost is pool shrinkage days before launch.

**Recommended: C, staged.** Require a real consent source **at the paid unlock**
from day one — it is a new code path, nothing regresses, and it is where money
changes hands. Leave anonymous first-name discovery on today's behaviour while a
re-consent campaign runs, with the copy corrected meanwhile. Anonymous browsing
of a first name plus evidence is a materially weaker exposure than releasing a
phone number, and treating them identically forces a false choice between
shipping and being straight.

**T-016 is the vehicle.** It already builds the candidate visibility control and
already waits on D-8. Adding `showEmail` / `showPhone` / `showResume` to that
screen — with a plain line saying *"recruiters who unlock you will see these"* —
answers D-8 and makes Finding 2's switches real in one motion.

**If T-016 slips past the 19th:** ship the unlock delivering **email only**, with
phone and CV shown as "not shared by this candidate". Nothing is overridden, the
policy stays true, and fields light up as candidates opt in. Price unchanged.

## 9. Guardrails for T-030 (after approval)

- **DO NOT** add a `contactVisible` / `contactReleased` column or any second
  stored source of truth.
- **DO NOT** write `status === "CONTACT_SHARED"` in a new file. Call
  `hasContactAccess`, and route the three existing sites through it first.
- **DO NOT** merge the credit check into `hasContactAccess`. Privacy and commerce
  are two answers; one function returning "yes" for a paid reason is the failure
  mode this design exists to prevent.
- **DO NOT** consult credits before the access and visibility checks (§6 B).
- **DO NOT** `select` contact fields on a path that can refuse (Finding 6).
- **DO NOT** override a candidate's `showPhone` / `showResume` switch.
- **DO NOT** put the spend anywhere but a transaction — two tabs will otherwise
  both spend the last credits. Use the `debit_strict` conditional-decrement
  pattern from [points.ts:283](src/repositories/points.ts), and an
  `idempotencyKey` shaped `unlock:<recruiterId>:<candidateUserId>` so a retry is
  structurally free.
- **DO NOT** reuse `PointsAccount` / `PointsTransaction` — candidate-owned and
  mid-078. Recruiter credits are a separate table.
- **DO NOT** build bulk unlock (D-1.4). `placeBulkEngagementRequestAction` and
  the cart checkout become shortlist-only or are removed — scope this explicitly.
- Reach candidate data through `src/repositories/`. Follow the DB-safety step
  (commit checkpoint, Neon branch snapshot, note the hash) before any migration;
  `prisma migrate deploy` does not work on this database (T-002 / D-2).
- `npm run test:visibility` must still pass; extend its source scan so a reveal
  site that skips `hasContactAccess` fails the same way a missing visibility
  clause does.

## 10. Manual test (with Sohail)

Shortlist → unlock with credits (balance drops by exactly 10) → re-open the same
candidate (balance must not move) → unlock a candidate with `showPhone` off
(phone absent, no placeholder) → spend down to zero → attempt another unlock →
repeat with the browser bypassed → confirm a non-approved recruiter and a
withdrawn candidate stay invisible throughout. Then read the candidate-facing
wording against `content/legal/privacy.md` and fix Findings 4 and 5.

## 11. Done when

- Approved by Sohail, with D-8 resolved.
- `hasContactAccess` unchanged, and every reveal site calls it.
- Candidate-facing wording agreed and the privacy policy corrected in the same
  release.

## 12. Downstream

- **T-032** — one limit key is enough today: `CONTACT_UNLOCK`. Recruiter/seat
  scoped, not user scoped.
- **T-033 ("R2")** — its premise is confirmed: no server-side check exists
  anywhere. Build on `debit_strict`; a read-then-write will double-spend.
- **T-016** — carries D-8 and the three field switches (§8).
- **T-031** (design) — the zero state is a real wall plus an admin top-up, not a
  checkout (D-1.8).
