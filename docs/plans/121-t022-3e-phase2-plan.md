# 121 — T-022 §3E Phase 2: implementation plan (NOT APPROVED, NOT STARTED)

**No code written.** Branch `feat/talent-request-persistence` @ `58d26b63`. Phase 1:
[120](120-t022-3e-guest-adoption-investigation.md). Every symbol below re-verified at this
commit.

**Headline: the two hardest problems are already solved in the codebase.** A purpose-built
validator for client-supplied candidate refs exists, and the explainer has a deterministic
non-model path. Neither needs inventing, and neither needs new persistent state.

---

## 0. Answers to the thirteen questions

| # | Question | Answer | Confidence |
|---|---|---|---|
| 1 | Where does the guest candidate identity list exist at adoption time? | `localStorage`/`sessionStorage` key `abtalks-hire-guest-matches`, as `tabs[].matches[]` of `MatchCardData`, each carrying `candidateRef` ([guest-matches-store.ts:5](../../src/components/hire/guest-matches-store.ts#L5)) | **VERIFIED** |
| 2 | Can we obtain it without trusting arbitrary client data? | **No — and we do not need to.** It only exists in the browser. It is trusted as a *hint*, never as authority (see Q4) | **VERIFIED** |
| 3 | Can we cryptographically/session-bind it? | Possible, **but unnecessary and out of scope** — see §5.1 | **VERIFIED reasoning** |
| 4 | If we accept candidate IDs, how do we prove they came from the guest search? | **We do not prove provenance. We re-derive entitlement.** `resolveEligibleCandidates(refs)` ([pool-policy.ts:136](../../src/features/hire/pool-policy.ts#L136)) exists for exactly this and is already the gate on the engagement path | **VERIFIED** |
| 5 | Can existing visibility/eligibility functions validate each ID? | **Yes.** `resolveProgramRefs` (:673), `resolveChallengeRefs` (:687), `resolveHackathonRefs` (:702) — all three apply `searchableUserWhere()`; challenge refs are re-tested against the evidence floor | **VERIFIED** |
| 6 | Can scoring be recomputed for an explicit subset? | **Not directly** — `searchCandidates(spec, opts?: { limit?: number })` has no subset option. **Run the full search, then intersect** — §4.2 | **VERIFIED** |
| 7 | Would recomputation preserve the same scoring semantics? | **Yes, identically** — the intersect approach calls the same `searchCandidates` the guest search called ([hire-guest-actions.ts:94](../../src/app/actions/hire-guest-actions.ts#L94)) | **VERIFIED** |
| 8 | Candidate visible to the guest, not visible at adoption? | Dropped. `resolveEligibleCandidates` drops rather than errors — *"a shortlist placed the moment a cohort closes is a race, not an attack"* | **VERIFIED** |
| 9 | Candidate deleted/disabled? | Same — `searchableUserWhere()` requires `deletedAt: null` and a live visibility row | **VERIFIED** |
| 10 | 20 guest candidates, some now invalid? | Persist the survivors; report the count skipped. Never silently substitute others | **PROPOSED** |
| 11 | Without Prisma schema changes? | **Yes.** `rationale` is `String?`, `gaps` has `@default([])`, and the Zod change is allowed | **VERIFIED** |
| 12 | Idempotent? | On this branch yes — `@@unique([requestId, candidateUserId])` (schema:1212) makes upsert safe. **On production that index does not exist yet** — §8 | **VERIFIED, with caveat** |
| 13 | Coexists with T-040/T-044? | Yes, and it depends on nothing from PR #254 except that index for the cheap idempotency route | **VERIFIED** |

### Two additional questions this plan must answer

| # | Question | Answer |
|---|---|---|
| 14 | **How is rank/order preserved?** The guest saw AB-6267 (70), AB-9533 (58), AB-9840 (54) **in that order**. | The intersect approach re-ranks through the same scorer, so relative order is preserved unless a score genuinely changed. Order is **not** stored; it is `orderBy: { score: "desc" }` at read time ([load-request-matches.ts](../../src/features/hire/load-request-matches.ts)). §4.3 |
| 15 | **Does `explainMatches` re-run at adoption?** It makes a model call. | **No.** `explainMatches` ([:161](../../src/features/hire/explain-matches.ts#L161)) is a thin wrapper: it computes `explainMatchesDeterministic(...)` first ([:36](../../src/features/hire/explain-matches.ts#L36), exported) and only calls Groq to *upgrade* the prose. `gaps` come from the scorer ([score-candidate.ts:448](../../src/features/hire/score-candidate.ts#L448)), not the model. Adoption calls the deterministic function — **no model call, deterministic, fast**. §4.4 |

---

## 1. Current flow — where state lives at each step

```
GUEST
  types criteria         → sendGuestScoutMessageAction   (server, writes nothing)
                           localStorage abtalks-hire-guest-session  { spec, messages, summary, searched }
  runs search            → runGuestMatchAction           (server: searchCandidates + explainMatches)
                           "Nothing is written — a guest search is not demand."
                           localStorage abtalks-hire-guest-matches  { tabs[].matches[] }
  stars a candidate      → localStorage abtalks-hire-star          (desk-shortlist.ts)
  adds to cart           → localStorage abtalks-hire-cart          (guest-cart.ts)
  clicks Request         → login required

LOGIN  → MergeGuestCart (hire/layout.tsx:59, renders for approved || pending)
  readPendingDemand()  → recordSampleDemandAction
  readGuestCart()      → mergeGuestCartAction        ✅ works  → RecruiterShortlistItem
  done.current = true                                ⚠️ latched BEFORE adoption
  readGuestSession()   → adoptGuestScoutSessionAction ⚠️ result ignored
        $transaction(async tx => { talentRequest.create; talentRequestMessage.createMany })
        ❌ no TalentRequestMatch write, and no schema field to carry one
  readDeskShortlist()  → NEVER CALLED                 ❌ stars lost
  readPendingCheckout()→ placeBulkEngagementRequestAction
```

---

## 2. Approved recruiter flow — proposed

```
adoptGuestScoutSessionAction(spec, summary, searched, messages, candidateRefs[])
  1. requireApprovedRecruiter()                          unchanged
  2. dedupe check (existing, last-message within 15 min) unchanged
  3. $transaction:  talentRequest.create + message.createMany     ← FAST ONLY
  4. COMMIT
  5. outside the transaction, only if searched && candidateRefs.length:
       resolveEligibleCandidates(candidateRefs)          ← drops anything not entitled
       searchCandidates(spec, { limit: ADOPTION_LIMIT })
       intersect on candidateRef
       explainMatchesDeterministic(...)                  ← no model call
       upsert TalentRequestMatch rows
  6. set status: matches > 0 ? MATCHED : ACTIVE          ← never MATCHED with 0 matches
  7. return { requestId, adopted, skipped }
```

---

## 3. Unapproved recruiter flow — decision (b) + (c)

**No change to `requireApprovedRecruiter()`. No new approval workflow.**

- Adoption still returns `{ ok: false, message: "Recruiter access not approved yet." }`.
- The call site **stops ignoring that result**: it does not latch, and it tells the
  recruiter honestly — *"Your search is saved on this device and will be added to your
  account once your recruiter access is approved."*
- Guest state is left intact. This already holds: `clearGuestSession()` runs only from
  `resetDesk()` ([scout-chat.tsx:757](../../src/components/hire/scout-chat.tsx#L757)).
- **Retry point.** `MergeGuestCart` mounts on every `/hire` visit for `approved || pending`.
  Once approval lands, the recruiter's next visit **on the same device** adopts
  automatically. No new mechanism.

**Architecture dependency to state plainly, not to solve here:** approval typically arrives
hours later, often in another session or on another device. On a different device the guest
state is gone and nothing can recover it. That is inherent to browser-held state and is the
honest limit of (b)+(c). Flagged, not invented around.

---

## 4. Match preservation design

### 4.1 What the client sends

`candidateRefs: string[]` — **identity only**. Not score, tier, evidence, rationale, gaps,
visibility or order. Zod-capped (≤ 20, matching the guest search's own `limit: 20`).

### 4.2 Preserve, don't broaden — how A/B/C stay A/B/C

```ts
entitled = resolveEligibleCandidates(candidateRefs)     // server-authoritative filter
fresh    = searchCandidates(spec, { limit: ADOPTION_LIMIT })
keep     = fresh.matches.filter(m => entitled.has(m.candidateRef))
```

The intersection is what satisfies Decision 2: a plain re-run would return `A, B, C, D`;
intersecting keeps `A, B, C`. `D` is never persisted, because it was not the recruiter's
work.

**`ADOPTION_LIMIT` must exceed 20.** The guest search used `limit: 20`; if the pool shifted
and A now ranks 22nd, a limit-20 adoption run would silently drop a candidate the recruiter
saw. Proposed: `limit: 100` (the value `search-candidates.ts` already uses internally at
:111). **Open for review.**

**Candidate entitled but absent from the fresh run** (fell below the cap entirely, or the
pool moved): treated as skipped and reported, not fabricated. See §4.5.

### 4.3 Rank and order

Order is not a stored column — matches are read `orderBy: { score: "desc" }`. Because §4.2
scores through the same `searchCandidates` the guest search used, relative order is
preserved unless a score genuinely changed. **The plan does not attempt to freeze the
guest's exact ordering**; doing so would mean storing a rank column, which is a schema
change and out of scope. Worth confirming that is acceptable.

### 4.4 Explanations — no model call at adoption

`explainMatchesDeterministic(matches, nearMisses, spec, context)` is exported at
[:36](../../src/features/hire/explain-matches.ts#L36) and is what `explainMatches` computes
first; Groq only upgrades the prose. `gaps` come from the scorer. Adoption uses the
deterministic function:

- no model call → fast, deterministic, no cost, no rate-limit exposure
- the recruiter may see slightly plainer rationale text than the guest saw
- `rationale` is `String?` — persisting without it is also legal if even that is unwanted

**Decision needed:** deterministic rationale (recommended) or no rationale at all.

### 4.5 Partial preservation must be visible

If 20 refs arrive and 18 survive, the recruiter is told: *"18 of the 20 candidates you saw
are still available."* Never silently show fewer, and never top up with substitutes.

---

## 5. Security model

### 5.1 Why cryptographic binding is not proposed

Binding would prove *"this list came from a real guest search."* It would need a signed
token, and a key plus replay protection — i.e. **new persistent state**, which this task
forbids.

It is also unnecessary. The property that matters is not provenance but **entitlement**:
could this recruiter legitimately have been shown this candidate? `resolveEligibleCandidates`
answers exactly that, and its own doc comment states the threat model:

> *"A ref is a name, not a capability: it arrives from the client, and anything the search
> would not have shown must not become an engagement request just because someone can
> construct the string."*

A forged ref is dropped by the same gate that guards the engagement path. Forging one buys
nothing an ordinary signed-in search would not already return.

**Answer: binding is possible but not necessary. Not proposed.**

### 5.2 What the browser cannot forge

| Field | Source |
|---|---|
| eligibility | `resolveEligibleCandidates` + track floors |
| visibility | `searchableUserWhere()` inside all three resolvers (:673, :687, :702) |
| score / tier / breakdown | recomputed by `searchCandidates` |
| rationale / gaps | `explainMatchesDeterministic` / the scorer |
| ranking | `orderBy: { score: "desc" }` at read time |
| **ownership** | `requireApprovedRecruiter()` → `recruiterUserId = session.user.id`. One recruiter cannot adopt another's guest state: the refs carry no ownership and the request is created against the caller |

---

## 6. Failure handling, retry, transaction boundary

**Inside the transaction:** `talentRequest.create` + `talentRequestMessage.createMany` only.
Fast, and unchanged from today.

**Outside it:** `resolveEligibleCandidates`, `searchCandidates`, deterministic explain, and
the match upserts. Slow work never enters the interactive transaction at
[hire-actions.ts:701](../../src/app/actions/hire-actions.ts#L701).

**If the transaction commits and the match step fails**, today's poison state would be
`MATCHED` with `matches = 0` — exactly the signature Phase 1 found. Two guards:

1. **Set status from the outcome, not the intent.** `status = matches > 0 ? MATCHED : ACTIVE`.
   `MATCHED + 0` becomes structurally unreachable.
2. **Make retry natural.** The existing 15-minute dedupe returns the *same* `requestId` on a
   repeat, so a second attempt re-runs only the match step against the existing request.

**The latch.** `done.current = true` moves to *after* a successful adoption. On failure the
next mount retries. Cart-merge failure handling above it is untouched.

---

## 7. Save for Later transfer

**Root cause:** `MergeGuestCart` calls `readGuestCart()`
([:66](../../src/components/hire/merge-guest-cart.tsx#L66)) and never `readDeskShortlist()`
([desk-shortlist.ts:54](../../src/components/hire/desk-shortlist.ts#L54), key
`abtalks-hire-star`, cap 40).

**Cart and star are separate systems. Cart merge works today and must not regress.**

**Proposed, minimal:** the star is *already* per-device by design and stays that way. On
login, read the star list and ensure it survives the transition intact — no server model, no
§3B. Because `localStorage` is per-origin and sign-in does not clear it, the star normally
survives already **on the same device**; the loss Phase 1 observed was cross-browser, which
§3B owns.

**This needs your steer.** Two readings of "must not simply disappear on login":

- **(i)** guarantee it survives *on the same device* — verify and add a test; likely a
  no-op fix.
- **(ii)** move starred candidates into the cart at login so they become server-side —
  changes product meaning (the star is deliberately non-committal) and edges into §3B.

**Recommendation: (i).** (ii) makes the star a commitment, which is the opposite of what it
is for.

---

## 8. Idempotency

| Object | Guard |
|---|---|
| `TalentRequest` | existing 15-min last-message dedupe ([hire-actions.ts:680-696](../../src/app/actions/hire-actions.ts#L680)) |
| `TalentRequestMessage` | covered by the same dedupe — a matched request returns early |
| `TalentRequestMatch` | `upsert` on `@@unique([requestId, candidateUserId])` (schema:1212) |
| Cart transfer | `mergeGuestCartAction` already reports `mergedIds` and the client removes only those |
| Star transfer | set-based; re-running is a no-op |

⚠️ **Caveat: the unique index is not in production.** It ships with PR #254. Until that
migration is applied, the upsert route is unavailable in production and this work would
need a `deleteMany({ requestId }) + createMany` inside a single transaction instead —
acceptable because adoption writes a fresh request. **This is the one place §3E touches
PR #254, and it is a sequencing question, not a code dependency.**

---

## 9. Files and symbols to change

| File | Symbol | Change |
|---|---|---|
| [src/lib/validations/hire.ts](../../src/lib/validations/hire.ts) | `adoptGuestScoutSessionSchema` (:389) | add `candidateRefs: z.array(z.string()).max(20).optional()` — **Zod only, allowed** |
| [src/app/actions/hire-actions.ts](../../src/app/actions/hire-actions.ts) | `adoptGuestScoutSessionAction` (:664) | keep the transaction fast; add the post-commit match step; status from outcome; return `{ requestId, adopted, skipped }` |
| [src/components/hire/merge-guest-cart.tsx](../../src/components/hire/merge-guest-cart.tsx) | `MergeGuestCart` (:40) | read guest match refs; pass them; handle the result; move the latch; honest message for unapproved; **do not touch the cart branch** |
| [src/components/hire/guest-matches-store.ts](../../src/components/hire/guest-matches-store.ts) | new small reader | return `candidateRef[]` for the active tab |

**Not changed:** `runGuestMatchAction`, `runMatchAction`, `searchCandidates`,
`resolveEligibleCandidates`, `explain-matches.ts`, `desk-shortlist.ts`, `guest-cart.ts`,
`prisma/schema.prisma`, any migration.

---

## 10. Test plan

**Environment first:** build the local test DB from **this branch's** schema with
`prisma db push`, never from production's. This branch's client models `TalentRequest.name`,
`lastViewedAt` and `archivedAt`; any full-record write against a DB lacking them fails with
**P2022**, and hours will go into a phantom bug ([115](115-talent-request-schema-drift-investigation.md)).

| Test | Assertion |
|---|---|
| **Primary** | guest search → A/B/C → Request → login → **the same A/B/C**, with `TalentRequestMatch` rows for exactly those `candidateUserId`s |
| **Negative — not a "last search"** | afterwards start `Data Scientist + Mumbai`; the Backend/Delhi search must **not** reopen |
| **Save for Later** | guest stars A → login → A still starred |
| **Transcript regression** | guest chat → login → transcript intact, timestamps as today |
| **Cart regression** | guest cart → login → `RecruiterShortlistItem` written as today |
| **Approved recruiter** | adoption succeeds; status `MATCHED`; matches > 0 |
| **Unapproved recruiter** | nothing persisted; guest state intact; honest message; **no silent failure**; retry works after approval on the same device |
| **Repeated adoption** | run twice → one `TalentRequest`, no duplicate messages, no duplicate matches |
| **Candidate invalidation** | flip a candidate's `searchableByRecruiters` to false in the **local** DB before login → that candidate is absent afterwards and counted as skipped |
| **Forgery** | invoke the action directly with a fabricated `candidateRef` and with one belonging to a non-searchable user → both dropped, nothing persisted |
| **Cross-recruiter** | recruiter X's refs adopted while signed in as Y → request belongs to Y; only refs Y is entitled to survive |
| **Signed-in regression** | normal signed-in search unchanged; `test:match-persistence`, `test:visibility`, `test:hire-score`, `test:sample`, `test:virtual` all pass |

**DB verification uses the Phase 1 forensic signature, not the UI:**

| | Adopted (broken today) | Adopted (fixed) | Live path |
|---|---|---|---|
| message timestamps | several sharing one `createdAt` | unchanged — still one `createMany` | distinct per message |
| `status` | `MATCHED` | `MATCHED` **only if** matches > 0 | `MATCHED` |
| match rows | **0** | **non-zero** | non-zero |

---

## 11. Status

| | |
|---|---|
| **Decided by you** | approval gate (b)+(c) · preserve the guest set, no silent broadening · identity-only from the client · no schema change · latch/error bug in scope |
| **Verified by me** | Q1-13 above · `resolveEligibleCandidates` exists and gates all three tracks on visibility · `explainMatchesDeterministic` is exported and model-free · `rationale` nullable · `searchCandidates` has no subset option · the unique index is absent from production |
| **Still uncertain — needs your answer** | 1. `ADOPTION_LIMIT` value (proposed 100) · 2. exact ordering not frozen (§4.3) · 3. deterministic rationale or none (§4.4) · 4. Save for Later (i) or (ii) (§7) · 5. the production unique-index sequencing (§8) |
| **Named, not solved** | approval arriving on a different device leaves the guest state unrecoverable (§3) |

**Phase 2 complete. No code written. Stopping for your review — I will not start Phase 3
until the five items above are answered.**
