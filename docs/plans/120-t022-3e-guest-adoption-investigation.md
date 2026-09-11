# 120 — T-022 §3E: preserve guest search after login — PHASE 1 INVESTIGATION

**No code written. No schema, migration, seed, production write, commit or push.**
Branch `feat/talent-request-persistence` @ `58d26b63`. Every reference below re-verified at
this commit.

---

## 1. Exact root cause

**Two facts, both verified, not inferred.**

**(a) `adoptGuestScoutSessionAction` contains zero `talentRequestMatch` statements.**
Scanned the whole function body ([hire-actions.ts:664](../../src/app/actions/hire-actions.ts#L664)
to its close): the string does not occur once. This is a fact about the current code, not a
possibility.

**(b) There is no channel to send them.** `adoptGuestScoutSessionSchema`
([validations/hire.ts:389](../../src/lib/validations/hire.ts#L389)) accepts exactly four
fields:

```ts
{ spec, summary?, searched?, messages[] }
```

No `matches`. The client never sends them and the server could not read them if it did.
Adding that channel is the security-sensitive part of any fix.

**Therefore:** candidates disappear after login because the adoption path was built to carry
the *conversation*, and match rows were never part of its contract.

---

## 2. Current data flow

### Two separate guest stores — this distinction drives everything

| Store | Key | Holds | Adopted at login? |
|---|---|---|---|
| Guest **session** | `abtalks-hire-guest-session` ([guest-session.ts:3](../../src/components/hire/guest-session.ts#L3)) | `spec`, `messages[]`, `summary`, `searched` | **YES** |
| Guest **matches** | `abtalks-hire-guest-matches` ([guest-matches-store.ts:5](../../src/components/hire/guest-matches-store.ts#L5)) | `tabs[]`, each with `matches: MatchCardData[]` | **NO — no channel exists** |

### Guest search runs on the server

`runGuestMatchAction` ([hire-guest-actions.ts:94](../../src/app/actions/hire-guest-actions.ts#L94)):

```ts
const search = await searchCandidates(parsed.data.spec, { limit: 20 });
…
return { matches: explained.matches.map(m => toPublicMatch(m, …)), overallGap, matchCount };
```

Its own doc comment: *"Rank the published, consented pool. Returns anonymised cards only.
**Nothing is written — a guest search is not demand.**"* It is rate-limited
(`rateLimit()`), and it calls **the same `searchCandidates(spec, { limit: 20 })`** that the
signed-in `runMatchAction` calls ([hire-actions.ts:363](../../src/app/actions/hire-actions.ts#L363)).

**This materially changes question B (match authority).** The scores in the browser were
computed by the server, under the same pool gates and the same visibility filter — the
client merely cached them. The risk is not that the numbers were invented; it is that a
client can *edit* what it cached before sending it back.

### At login

`MergeGuestCart` ([merge-guest-cart.tsx:40](../../src/components/hire/merge-guest-cart.tsx#L40)), in order:

```
readPendingDemand()  → recordSampleDemandAction
readGuestCart()      → mergeGuestCartAction(programIds)      :66, :70   ✅ works
done.current = true                                          :92        ← latched BEFORE adoption
readGuestSession()   → adoptGuestScoutSessionAction(…)       :94, :99   ⚠️ result ignored
readPendingCheckout()→ placeBulkEngagementRequestAction
```

`readDeskShortlist()` ([desk-shortlist.ts:54](../../src/components/hire/desk-shortlist.ts#L54),
key `abtalks-hire-star`, cap 40) is **never called here**. That is precisely why guest stars
vanish on login.

### The adoption itself

[hire-actions.ts:701](../../src/app/actions/hire-actions.ts#L701):

```ts
const created = await prisma.$transaction(async (tx) => {     // ← INTERACTIVE transaction
  const row = await tx.talentRequest.create({ data: { …, status: searched ? MATCHED : DRAFT, …specToDb(spec) } });
  await tx.talentRequestMessage.createMany({ data: messages.map(…) });
  return row;
});
```

---

## 3. What survives login, what does not

| Guest work | Survives? | Why |
|---|---|---|
| Search criteria | ✅ | `specToDb(spec)` written onto the new `TalentRequest` |
| Transcript | ✅ | `tx.talentRequestMessage.createMany(...)` |
| Cart (program candidates) | ✅ **already works — do not regress** | `readGuestCart()` → `mergeGuestCartAction` → `RecruiterShortlistItem` |
| **Matched candidates** | ❌ | no statement, and no schema field to carry them |
| **Save for Later (star)** | ❌ | `readDeskShortlist()` never called at login |

**Cart and star are different things.** The cart already transfers correctly and is out of
scope except as a regression risk. Only the star transfer is missing.

---

## 4. Approved vs unapproved recruiter — **STOP / DECISION NEEDED**

This is the item the task asked me to stop on. I am not deciding it.

**The behaviour, verified:**

- `MergeGuestCart` renders for `approved || pending`
  ([hire/layout.tsx:59](../../src/app/hire/layout.tsx#L59)), with a comment explaining that
  a pending recruiter registered *because* they wanted specific candidates.
- `adoptGuestScoutSessionAction` gates on `requireApprovedRecruiter()`
  ([hire-actions.ts:36](../../src/app/actions/hire-actions.ts#L36)), which returns
  `{ ok: false, message: "Recruiter access not approved yet." }` at
  [:56-57](../../src/app/actions/hire-actions.ts#L56) when `profile.approved` is false.
- The call site **ignores the result** — [merge-guest-cart.tsx:99](../../src/components/hire/merge-guest-cart.tsx#L99)
  is a bare `await`, with no `if (!res.ok)` branch, unlike the cart merge above it which
  handles failure and toasts.
- `done.current = true` is set at [:92](../../src/components/hire/merge-guest-cart.tsx#L92),
  **before** the adoption runs, so a failure is not retried on the next mount within that
  session.

**Consequence:** a recruiter who registers *in order to* act on the candidates they just
found — the exact journey in the product requirement — has their guest search silently
dropped. Nothing is persisted, nothing is said, and it is not retried.

**Mitigating fact:** the guest state is *not* destroyed. `clearGuestSession()` /
`clearGuestMatches()` run only in `resetDesk()`
([scout-chat.tsx:757-758](../../src/components/hire/scout-chat.tsx#L757)), and only when
there is no `requestId` — i.e. the "New search" button. So a pending recruiter's work is
still in the browser and could be adopted later, on approval, from the same device.

**Question for you (product, not engineering):** when an unapproved recruiter logs in,
should the guest search be

- **(a)** adopted immediately, with the persistence gate relaxed for adoption only;
- **(b)** held in the browser and adopted on approval, from the same device only;
- **(c)** left as today, but with an honest message instead of silence?

Each has a different blast radius. I have not assumed one.

---

## 5. Two implementation landmines found during the trace

**(a) The adoption runs inside an interactive `$transaction`
([hire-actions.ts:701](../../src/app/actions/hire-actions.ts#L701)).** A match run is slow —
`searchCandidates` plus `explainMatches`, which makes a model call. It must not sit inside
that transaction. Any plan has to say explicitly where the match work happens relative to
the transaction boundary, and what the state is if the transaction commits and the match
work then fails.

**(b) The local test DB must be built from *this branch's* schema.** This branch's generated
client models `TalentRequest.name`, `lastViewedAt` and `archivedAt`. Any
`create`/`update`/`upsert` without an explicit `select` returns the full record and fails
with **P2022** against a database lacking those columns — reproduced deterministically in
[115](115-talent-request-schema-drift-investigation.md). Use `prisma db push` from this
branch, never production's schema, or hours will go into a phantom bug.

---

## 6. Forensic signature for verification

Use this to confirm any future fix, rather than trusting the UI:

| | Adopted request (broken today) | Live-path request (working) |
|---|---|---|
| message timestamps | **several messages sharing one `createdAt`** (a `createMany`) | **distinct `createdAt` per message** |
| `status` | `MATCHED` | `MATCHED` |
| `TalentRequestMatch` rows | **0** | non-zero |

Observed in the local test DB: two adopted requests with `msgs=6, distinct_ts=1, matches=0`,
against a live-path request with `msgs=3, distinct_ts=3, matches=3`.

---

## 7. Proposed approach — for review, not agreed

**Preferred: re-derive server-side from the adopted spec; do not accept client match data.**

The spec is already adopted and is already the input `runGuestMatchAction` used. Re-running
`searchCandidates` with that spec keeps the server authoritative and needs **no schema
change and no new payload field** — the `adoptGuestScoutSessionSchema` stays closed.

**The honest trade-off, which is a product call:** a re-run is not guaranteed to reproduce
the guest's exact set. If the pool changed between the guest search and login, the recruiter
may see `A, B, C, D` where they saw `A, B, C`. Seconds apart this is very unlikely, but it
is not a guarantee, and the requirement is explicitly *preservation*, not *re-derivation*.

**Alternative considered — adopt the client's cached cards.** Reproduces the set exactly,
but the browser would be supplying `score`, `tier` and `evidence`, which then have to be
re-validated server-side against the pool before they can be stored — at which point most of
the cost of a re-run has been paid anyway, plus a new trusted-input surface and a schema
field. **Not recommended.**

**A middle option, if exactness matters:** re-run, then reconcile — persist the re-run
result, and if the guest's cached `candidateRef` list differs, tell the recruiter plainly
rather than silently showing a different set.

**I am not choosing between these.** The decision belongs with the product requirement.

Save for Later would be handled by calling `readDeskShortlist()` alongside `readGuestCart()`
at login and transferring through the **existing** mechanism only — no new server-side model,
which stays §3B.

---

## 8. Risks

- **Regression on the cart.** It works today; touching `MergeGuestCart` risks it.
- **Transaction boundary** — see §5(a).
- **Idempotency.** `adoptGuestScoutSessionAction` already de-duplicates by comparing the
  last message content against requests created in the past 15 minutes
  ([hire-actions.ts:680-696](../../src/app/actions/hire-actions.ts#L680)). Any match write
  must be idempotent too; on this branch the `@@unique([requestId, candidateUserId])` makes
  an upsert safe, **but that index is not in production yet**.
- **Cost.** A re-run on every guest login is an extra `searchCandidates` + model call.
- **Rate limiting.** The guest path is rate-limited; the adoption path is not.

---

## 9. Tests needed

- Manual: guest search → login → criteria, candidates, transcript, star all present.
- **Negative test:** afterwards start a genuinely new search with different criteria and
  confirm the old one is *not* restored. This work must not become a "last search" feature.
- Unapproved-recruiter path, once §4 is decided.
- Idempotency: run adoption twice, assert no duplicate request / messages / matches.
- DB verification using the §6 signature, not the UI.
- Regression: normal signed-in search; existing `test:match-persistence`, `test:visibility`,
  `test:hire-score`, `test:sample`, `test:virtual`.

---

## 10. Status

**Phase 1 complete. Stopping here as instructed.** No code written.

**Blocking on you:**
1. §4 — unapproved-recruiter behaviour (a / b / c).
2. §7 — re-run vs adopt-cached vs re-run-and-reconcile.

I will not start Phase 2 until both are answered.
