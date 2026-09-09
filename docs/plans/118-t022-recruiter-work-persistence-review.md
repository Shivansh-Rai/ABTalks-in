# T-022 — Does saving a search save the recruiter's work?

**Review document for sign-off. Sections 1-7 and 9-10 are findings. Section 8 is PROPOSED
OPTIONS ONLY — nothing in it has been implemented, approved or scheduled.**

| | |
|---|---|
| Branch | `feat/talent-request-persistence` |
| Commit | `58d26b63f72abde706b4024c0de4856f3b54cb17` |
| PR | [#254](https://github.com/byteninjaa0/ABtalksapp/pull/254) — open, **DO NOT MERGE** |
| Every line reference below | verified against this commit, not copied from earlier reports |
| Production | read-only throughout; unchanged |

Evidence reports behind this document:
[114](114-t022-talent-search-persistence.md) ·
[114-A](114-A-t022-test-environment.md) ·
[115](115-talent-request-schema-drift-investigation.md) ·
[116](116-t022-two-browser-forensics.md) ·
[117](117-t022-control-test.md) ·
[119 (inclusion audit)](119-t022-real-candidate-inclusion-audit.md)

---

## 0. Decisions needed from Sohail — read this first

**Nothing in §8 starts until these are answered.** Each one changes what gets built, not
just how — §8 sets out the options each answer would select between.

| # | Decision | Options | Recommendation | Blocks |
|---|---|---|---|---|
| **1** | **Save for Later — device-local or persistent?** Today it is `localStorage` only and disappears on any other device. The component says that is deliberate; the recruiter is never told. | (a) keep device-local, add a UI disclosure · (b) persist it server-side | **No recommendation — this is a product call.** (a) is a small UI change; (b) needs a table and changes what the feature means. | §8B |
| **2** | **Which shortlist model survives?** `RecruiterShortlistItem` FKs `ProgramMember`, so it structurally cannot hold 3 of the 4 candidate tracks. `TalentList` / `TalentListItem` already exist, are org-scoped, keyed on `User.id`, and have **0 usages**. | (a) extend `RecruiterShortlistItem` · (b) move to `TalentList`/`TalentListItem` | **(b)** — (a) cannot represent three tracks at all. Cheapest now: production holds **0** `RecruiterShortlistItem` rows. | §8C |
| **3** | **`lastViewedAt` — single column or per-(recruiter, request)?** *(Q3 from [113-A](113-A-schema-review-sohail.md), still open)* | (a) single column on `TalentRequest` · (b) per-recruiter join table | **(a) is correct today** (one recruiter per request) and becomes wrong when org-wide projects land. **Not assumed either way.** (b) changes the migration in PR #254. | §8A, PR #254 |
| **4** | **Guest adoption — how should matches be recovered?** A search run before sign-in keeps its transcript and loses every result. | (a) re-run the match after adoption · (b) adopt the client's guest match payload | **(a)** — (b) means the browser supplies scores, which would have to be treated as untrusted and re-validated. | §8E |
| **5** | Should returning to `/hire` auto-resume the last search? | (a) surface recent searches on the landing panel · (b) also auto-resume the most recent `MATCHED` | (a) is uncontroversial; (b) is opinionated — a recruiter starting a genuinely new search must not be dropped into the old one. | §8D |

**Separate track — do not bundle with the above.** Decision 6 in §11 (is the recruiter pool
everyone who opts in, or everyone with verified evidence?) governs the candidate-inclusion
finding in §9. It is a different part of the pipeline and a different conversation.

---

## 1. Executive summary

**The question.** T-022 asked whether saving a search today actually saves a recruiter's
*work* — not whether a row survives, but whether what the recruiter did with the results
comes back.

**What we tested.** A recruiter journey run end to end in a real browser against a local
Postgres seeded from the repo's own fixtures, with the return leg performed in a separate
Chrome profile so `localStorage` could not fake persistence. Every UI observation was
checked against the database, and every claim traced to code at this commit. Production was
queried read-only for population data only.

**The answer: partly. Saving a search saves the *question*. It does not save most of the
work.**

- Criteria, matched candidates, and the Scout conversation come back.
- Which candidates the recruiter opened is never recorded at all.
- Save for Later is browser-local and disappears on any other device.
- The shortlist survives for one of four candidate tracks.
- A search run before sign-in keeps its transcript but loses its results entirely.

**(a) Investigation — COMPLETE.** Every item in the matrix is answered by observation plus
code, and the two candidate-dependent questions are settled deterministically from code.

**(b) Implementation gaps discovered — five**, listed in §7 and scoped in §8. The largest
is not any single feature: it is that T-040/T-044 build the *place* to keep match state and
nothing yet writes to it.

**(c) Intentionally NOT fixed here.** No code, schema, migration, seed, cleanup, commit or
push. The migration remains unapplied. The migration-filename collision is untouched. The
separate candidate-inclusion finding (§9) is explicitly out of scope.

---

## 2. Manual user journey — exactly as tested

Run on `localhost:3000` against `postgresql://…@localhost:5432/abtalks_t022`, this branch's
code, recruiter `recruiter@hire.abtalks.dev` (seeded `approved: true`).

**Browser A** — fresh Chrome profile, `localStorage` verified `[]` before sign-in.

| # | Step | Observed |
|---|---|---|
| 1 | Sign in (dev credentials) | `/dashboard`; session `role: RECRUITER` |
| 2 | Open `/hire`, choose role **Backend engineer** | request `cmtr6y4fp000b0eacxqb5xxz1` created |
| 3 | Answer Scout, run the search | status `MATCHED` |
| 4 | Record 3 candidates | `AB-6267` (70), `AB-9533` (58), `AB-9840` (54) |
| 5 | Open `AB-9840` via *View more details* | inspector rendered |
| 6 | *Add to Shortlist* on `AB-9840` | button → **In Shortlist**, header badge **Shortlist 2** |
| 7 | *Save for later* on `AB-9840` | header badge **Save for Later 1** |
| 8 | Send a chat message | `FORENSIC-T022 control message` |
| 9 | State before leaving | `localStorage` = `["abtalks-hire-evidence","abtalks-hire-star"]` |
| 10 | Sign out | session `null`; **`localStorage` survives sign-out** |

**Browser B** — a *different* Chrome profile with its own `--user-data-dir`,
`localStorage` verified `[]`, same account, same server.

| Check | Result |
|---|---|
| Candidates present, same order, same scores | **YES** — `AB-6267`, `AB-9533`, `AB-9840` / 70, 58, 54 |
| Chat control message visible | **YES** |
| Shortlist | header **Shortlist 2**; *In Shortlist* on both shortlisted candidates |
| Save for Later | badge shows **no count**; panel empty; `abtalks-hire-star` = `null` |
| Viewed state | regex `viewed\|seen\|new since\|unseen` over the page → `[]` |
| Landing on `/hire` | **"Not started"**, *"Ranked profiles appear here once you search"* |
| Route back to the search | only inside the `Requirement ▾` menu, under *"Pick up where you left off"* |
| After a refresh | identical on every line |

---

## 3. Persistence matrix

Legend — **✅ persists** across a fresh browser · **⚠️ partial** · **❌ cross-session
persistence missing** (the action itself works; its state is never saved).

| Item | Result | Where stored | Code / schema evidence (verified at `58d26b63`) | Root cause | Implementation needed? |
|---|---|---|---|---|---|
| Search criteria | ✅ VERIFIED | DB `TalentRequest` | [schema.prisma:1092](../../prisma/schema.prisma#L1092); read [hire/page.tsx:26](../../src/app/hire/page.tsx#L26) | keyed on `recruiterUserId` | No |
| Matched candidates | ✅ VERIFIED (current run) | DB `TalentRequestMatch` | [schema.prisma:1180](../../prisma/schema.prisma#L1180); write [hire-actions.ts:449](../../src/app/actions/hire-actions.ts#L449) | upsert on this branch | No — but see history caveat below |
| Viewed state | ❌ VERIFIED | nowhere | column selected at [load-request-matches.ts:85](../../src/features/hire/load-request-matches.ts#L85), returned at :225 — **no write anywhere** | opening a candidate triggers no action | **Yes — §8A** |
| Shortlist | ⚠️ VERIFIED | DB **or** localStorage, by track | [shortlist-button.tsx:58](../../src/components/talent/shortlist-button.tsx#L58) `useDb = Boolean(approved && programMemberId)` | `programMemberId` is `null` for 3 of 4 tracks | **Yes — §8C** |
| Save for Later | ❌ VERIFIED | localStorage `abtalks-hire-star` | [desk-shortlist.ts:4](../../src/components/hire/desk-shortlist.ts#L4), cap 40 at :89 | never merged at sign-in | **Yes — §8B** (product decision first) |
| Chat / messages | ✅ VERIFIED | DB `TalentRequestMessage` | [schema.prisma:1148](../../prisma/schema.prisma#L1148); write [hire-actions.ts:167](../../src/app/actions/hire-actions.ts#L167) | per-request rows | No |
| Search restoration / navigation | ⚠️ VERIFIED | DB, but nearly hidden | rendered at [scout-chat.tsx:877](../../src/components/hire/scout-chat.tsx#L877) *"Pick up where you left off"*, inside the `Requirement ▾` menu | `/hire` renders "Not started" | **Yes — §8D** |
| Guest-search adoption | ❌ VERIFIED | request + messages + cart persist; **matches do not** | [hire-actions.ts:664](../../src/app/actions/hire-actions.ts#L664); `createMany` at :713; **no `TalentRequestMatch` write in the whole function** | adoption never calls `runMatchAction` | **Yes — §8E** |

**History caveat on matched candidates.** Rows persist and are re-read, but they are a
snapshot of the *last run*, not an accumulated history. On this branch a re-run preserves
the row; on production (master) it deletes and recreates. See §6.

---

## 4. Code-level proof

### 4.1 Search criteria — ✅

`persist = recruiter.status === "approved"`
([hire/page.tsx:20](../../src/app/hire/page.tsx#L20)) gates whether anything is stored at
all; an unapproved recruiter's entire search lives in `localStorage`. For an approved
recruiter the row is written by `sendScoutMessageAction`
([hire-actions.ts:167](../../src/app/actions/hire-actions.ts#L167)) and re-read by
`talentRequest.findMany({ where: { recruiterUserId }, take: 8 })`
([hire/page.tsx:26](../../src/app/hire/page.tsx#L26)).

### 4.2 Matched candidates — ✅ for the current run

```
runMatchAction                                    hire-actions.ts:318
  searchCandidates(spec, { limit: 20 })           :363
  $transaction([ deleteMany(notIn kept), …upsert ])  :443–455
  talentRequest.update({ status })                :463
```

Verified end to end: a signed-in search wrote three rows at `12:02:41.729`, and Browser B
rendered them from the database with `localStorage` empty.

### 4.3 Viewed state — ❌

Opening a candidate renders `CandidateInspector` and calls nothing. Repo-wide at this
commit, `viewedAt`, `lastViewedAt`, `archivedAt` and `firstSeenAt` appear in exactly eight
places, all in `load-request-matches.ts`, and every one is either a `select: { … : true }`
or a return-object passthrough:

```
viewedAt      :85  select      :225 return
lastViewedAt  :68  select      :134 return
archivedAt    :69  select      :135 return
firstSeenAt   :84  select      :224 return
```

**No `data: { … }` write exists for any of them.** After Browser A opened a candidate,
`viewedAt` was `NULL` on all three rows and `decision` was `UNDECIDED`.

### 4.4 Shortlist — ⚠️

```
ShortlistButton                     components/talent/shortlist-button.tsx
  useDb = Boolean(approved && programMemberId)         :58
  ├─ true  → toggleShortlistAction  actions/talent-actions.ts:77
  │            → RecruiterShortlistItem  (@@unique[recruiterUserId, memberId])
  └─ false → toggleLocal()          :93  → localStorage "abtalks-hire-cart"
```

`programMemberId` is set only by the PROGRAM loader
([dossier.ts:297](../../src/features/hire/dossier.ts#L297)); the challenge and hackathon
loaders hardcode `null`
([challenge-dossier.ts:269](../../src/features/hire/challenge-dossier.ts#L269),
[hackathon-dossier.ts:53](../../src/features/hire/hackathon-dossier.ts#L53)). The DB branch
is therefore unreachable for CLAUDE, CHALLENGE_60 and HACKATHON — **by construction, not by
configuration**.

### 4.5 Save for Later — ❌

```
DeskShortlistButton → toggleDeskShortlist()   desk-shortlist.ts:83
                    → localStorage "abtalks-hire-star"  :4  (cap 40, :89)
                    → read readDeskShortlist()          :54
```

No server action; no table in the schema matches `saved`/`later`/`star`. At sign-in,
`MergeGuestCart` reads `readGuestCart()` ([merge-guest-cart.tsx:66](../../src/components/hire/merge-guest-cart.tsx#L66))
and never `readDeskShortlist()`.

### 4.6 Chat — ✅

`sendScoutMessageAction` writes the user message, calls the model, updates the request, then
writes the assistant message; `/hire/[requestId]` re-reads `request.messages` ordered by
`createdAt`. The control message was visible in Browser B with `localStorage` empty, and
again after a refresh.

### 4.7 Guest adoption — ❌ for matches

`adoptGuestScoutSessionAction` ([hire-actions.ts:664](../../src/app/actions/hire-actions.ts#L664)):

```ts
const row = await tx.talentRequest.create({
  data: { …, status: searched ? TalentRequestStatus.MATCHED : TalentRequestStatus.DRAFT, … },
});
await tx.talentRequestMessage.createMany({ data: messages.map(…) });   // :713
```

There is **no `talentRequestMatch` statement anywhere in the function**. Observable
signature in the data: both of the tester's own requests carry six messages sharing a single
`createdAt` (a `createMany`), `status = MATCHED`, and `matches = 0`, while a request created
through the live path carries three messages with three distinct timestamps and three match
rows.

---

## 5. Database model — used vs unused

| Model | Line | Used by the current recruiter search flow? | Notes |
|---|---|---|---|
| `TalentRequest` | [1092](../../prisma/schema.prisma#L1092) | **Yes** — created, updated, listed | The search itself. This is the object to extend. |
| `TalentRequestMessage` | [1148](../../prisma/schema.prisma#L1148) | **Yes** — written on every turn, replayed on open | Scout transcript |
| `TalentRequestMatch` | [1180](../../prisma/schema.prisma#L1180) | **Yes** — written by `runMatchAction`, read by `loadRequestMatches` | State columns exist on this branch; **nothing writes them** |
| `RecruiterShortlistItem` | [1041](../../prisma/schema.prisma#L1041) | **Partly** — only when `programMemberId` is set | `memberId` FKs `ProgramMember`, so it cannot represent 3 of 4 tracks; has no `requestId`, so it is not per-search |
| `TalentList` | [3022](../../prisma/schema.prisma#L3022) | **No — 0 usages** | Org-scoped, `isSharedWithOrg`, owner |
| `TalentListItem` | [3043](../../prisma/schema.prisma#L3043) | **No — 0 usages** | Has `PipelineStage` and a `candidateLabel` tombstone; keyed on `User.id` |
| `CandidateNote` | [3064](../../prisma/schema.prisma#L3064) | **No — 0 usages** | Org-scoped, many notes per candidate |
| `TalentMatchDecision` | [1166](../../prisma/schema.prisma#L1166) | enum exists; **no code assigns it** | added by T-040 |

`prisma.talentList`, `prisma.talentListItem` and `prisma.candidateNote` each return **0**
matches across `src/`. They are modelled, org-scoped, and never wired to a UI — which is
directly relevant to §8C, because the durable list T-022 shows is missing already exists in
the schema.

---

## 6. T-040 / T-044 — what it solves and what it does not

### Solves — VERIFIED

| Claim | Evidence |
|---|---|
| Stable `TalentRequestMatch` identity | `@@unique([requestId, candidateUserId])` at [schema.prisma:1212](../../prisma/schema.prisma#L1212) |
| Rerun preserves state | measured end to end: same row ids and identical `firstSeenAt` after a real UI re-run |
| Upsert instead of delete+recreate | [hire-actions.ts:449](../../src/app/actions/hire-actions.ts#L449); the `update` branch carries scoring fields only |
| `firstSeenAt` exists and survives a rerun | column present, default `now()` |
| `viewedAt` / `decision` columns exist | present with `@default(UNDECIDED)` |

### Does not solve — VERIFIED

| | |
|---|---|
| Writes `viewedAt` | **No** — opening a candidate wrote nothing (§4.3) |
| Writes `lastViewedAt` | **No** — nothing marks a request as visited |
| Writes `decision` | **No** — every row stays `UNDECIDED` |
| Persists guest-adopted matches | **No** — `adoptGuestScoutSessionAction` untouched |
| Persists Save for Later | **No** |
| Unifies the shortlist | **No** |
| Fixes search restoration / navigation | **No** |

**The distinction that matters for review: T-040/T-044 build the place to keep match state
and stop it being destroyed on re-run. Nothing yet puts anything in it.** Every "column
exists" row above is real; none of the "feature works" rows is yet true.

### Deployment status

**None of it is in production.** `20260905120000_talent_request_persistence` is recorded
**0 times** in production's `_prisma_migrations`, and none of the six columns, the enum, or
the unique index exists there. PR #254 is open and marked DO NOT MERGE.

No parallel `Project` model is proposed anywhere in this document. `TalentRequest` is the
recruiter's project object and should be extended.

---

## 7. Current gaps — each re-verified at this commit

1. **Viewed is not persisted** because opening a candidate has no corresponding write.
   `viewedAt` / `lastViewedAt` appear only as `select` and passthrough (§4.3). ✅ verified
2. **Save for Later is `localStorage`** (`abtalks-hire-star`, cap 40) and is never merged at
   sign-in. Lost in Browser B, `star = null`. ✅ verified
3. **Shortlist is flow-dependent and not unified** — DB for PROGRAM, `localStorage` for the
   other three tracks, because `programMemberId` is hardcoded `null` there. ✅ verified
4. **Search data persists but the return experience is incomplete** — `/hire` renders
   "Not started"; the only route back is *"Pick up where you left off"* inside the
   `Requirement ▾` menu ([scout-chat.tsx:877](../../src/components/hire/scout-chat.tsx#L877)).
   ✅ verified
5. **Guest adoption persists request, messages and cart, but not matches** — no
   `TalentRequestMatch` write exists in `adoptGuestScoutSessionAction`. ✅ verified

One more worth surfacing, not in the original list: **an unapproved recruiter persists
nothing at all** — `persist = recruiter.status === "approved"`. Their whole search lives in
`localStorage`.

---

## 8. Implementation scope — PROPOSED ONLY, NOT APPROVED, NOT EXECUTED

> **Status of this entire section: PROPOSED.**
>
> Nothing below has been implemented, approved, scheduled, or agreed. No code was written
> for any of it. These are **options put forward for review**, not a plan that has been
> accepted — and in particular **A (Viewed), B (Save for Later) and C (Shortlist) must not
> be started at all** until decisions 3, 1 and 2 in §0 are answered, because each of those
> answers changes what the work *is*, not merely how it is done.
>
> Where a recommendation appears below it is a **suggestion offered for challenge**. Where a
> decision is genuinely the product's to make — most of all §8B — no recommendation is
> given. Read every "would", "could" and "should" in this section as conditional on
> approval that has not yet been given.
>
> Effort labels are relative, not estimates. File lists are the *likely* blast radius from
> reading the current code, not a committed scope.

### A. Viewed persistence — PROPOSED · blocked on decision 3

- **Files:** `src/app/actions/hire-actions.ts` (new action), `src/components/hire/candidate-inspector.tsx` (call it on open), `src/features/hire/load-request-matches.ts` (already selects the fields), `src/components/hire/desk-match-card.tsx` (NEW badge).
- **Schema:** none — T-040 already adds `TalentRequestMatch.viewedAt` and `TalentRequest.lastViewedAt`. **Blocked on that migration.**
- **Backfill:** the T-040 migration already sets `lastViewedAt = now()` for existing rows, which is what stops every candidate reading as new on first load.
- **Action/API:** one server action, `markMatchViewed(requestId, candidateUserId)`; set `lastViewedAt` when a request page loads.
- **UI:** "New since your last visit" derived from `firstSeenAt > lastViewedAt`.
- **Tests:** extend `match-persistence.test.ts` to assert a writer exists; a viewed-state test.
- **Risks:** a write on every card open is chatty — debounce or write once per match. Setting `lastViewedAt` on load races with computing the badge from it; read the old value first, then update.
- **Depends on:** PR #254 merged and migrated, plus **decision 3** in §0 (single vs per-recruiter `lastViewedAt`).

### B. Save for Later persistence — PROPOSED · blocked on decision 1 (product call)

- **This is a product decision, not an engineering one, and it has not been made.** The component states it is device-local on purpose
  ([hire-saved-later.tsx:91](../../src/components/hire/hire-saved-later.tsx#L91)) and the
  panel's own copy says *"A private holding list on this device."* If that is still the
  intent, the correct change is a UI disclosure, not a table.
- **If it must persist:** either a new table, or `TalentListItem` with a distinct
  `PipelineStage` — preferable, since the model exists and is keyed on `User.id`.
- **Files:** `desk-shortlist.ts` (read/write behind an interface), `hire-saved-later.tsx`, `merge-guest-cart.tsx` (merge the star as well as the cart), a new action.
- **Backfill:** none possible — existing stars live in browsers we cannot read. Accept loss or merge opportunistically on next sign-in.
- **Risks:** the star's whole point is browsing without commitment; making it server-side changes the product's meaning. Cap 40 and cap 25 differ between the two lists.

### C. Shortlist unification — PROPOSED · blocked on decision 2

- **Largest item; do not bundle it with A. Not to be started before decision 2.**
- **Files:** `shortlist-button.tsx`, `talent-actions.ts`, `load-request-matches.ts`, `/talent/shortlist`, `merge-guest-cart.tsx`.
- **Schema:** move to `TalentList` / `TalentListItem`, which are already org-scoped, keyed on `User.id`, carry `PipelineStage` and a deletion tombstone. **Do not extend `RecruiterShortlistItem`** — its `memberId` FK to `ProgramMember` is precisely what excludes three tracks.
- **Data migration:** copy existing `RecruiterShortlistItem` rows (production currently holds **0**, so this is nearly free today and gets harder later).
- **Risks:** `/talent/shortlist` and `/talent/members/[id]` read the old table; both must move together. Notes live on `RecruiterShortlistItem.note` and would move to `CandidateNote`.
- **Depends on:** **decision 2** in §0 on org-scoping, which also settles decision 3.

### D. Search restoration UX — PROPOSED · shaped by decision 5

- **Files:** `src/app/hire/page.tsx`, `src/components/hire/scout-chat.tsx`.
- **Schema:** none, unless `TalentRequest.name` is surfaced (already added by T-040).
- **UI:** surface recent searches on the landing panel instead of only inside `Requirement ▾`; consider auto-resuming the most recent `MATCHED` request.
- **Risks:** auto-resume is opinionated — a recruiter starting a genuinely new search must not be dropped into the old one. Panel 2 currently reads "Ranked profiles appear here once you search", which becomes wrong if results are restored.
- **Cheapest item here, and the one that best matches what the tester actually experienced.**

### E. Guest-search match adoption — PROPOSED · shaped by decision 4

- **Files:** `src/app/actions/hire-actions.ts` (`adoptGuestScoutSessionAction`).
- **Two options.** (i) Re-run the match after adoption — one call, always consistent with current data, costs one search. (ii) Adopt the guest match payload — cheaper, but the client would be supplying scores, which must then be treated as untrusted and re-validated. **(i) is the safer design.**
- **Schema:** none.
- **Risks:** adoption currently runs inside `$transaction`; a match run is slow and must not be inside it. `requireApprovedRecruiter` already gates the action.
- **This is the gap that produced the original "my candidates vanished" report** and is independent of PR #254.

---

## 9. SEPARATE R3 ISSUE — candidate inclusion (not part of the above)

**Do not fold this into the persistence work.** It is a different question, on a different
part of the pipeline, and it needs a product decision before it can be scoped.

The production audit ([119 inclusion audit](119-t022-real-candidate-inclusion-audit.md))
found **835 genuine candidates** with three or more self-declared skills and zero ABTalks
activity, of which **zero** can be returned by recruiter search. Two independent causes:
search has three loaders rooted in `ProgramMember`, `Enrollment` and
`HackathonParticipant` — there is no loader rooted in `User` or `StudentProfile` — and
`searchableByRecruiters` is true for only 66 of 12,804 rows.

The PRD says evidence must affect **ranking**, not **eligibility**. The PROGRAM track
honours that ("the floor is a preference, not a wall"); the challenge track does not
(`submissions >= 10` is a hard filter).

**Required decision before scoping: is the recruiter pool everyone who opts in, or everyone
with verified evidence?** That is a business question, not a bug.

---

## 10. Migration and production safety

- **The T-040 migration has not been applied to production.**
  `20260905120000_talent_request_persistence` is recorded 0 times in production's
  `_prisma_migrations`; none of the six columns, the enum, or the unique index exists there.
- **Filename collision.** After the master sync, two migration folders share the prefix
  `20260905120000` — `_redemption_structured_address` (already applied to production) and
  `_talent_request_persistence`. Prisma orders by full folder name so this is not fatal, but
  it reads as a mistake. **Not fixed; flagged for a decision.**
- **P2022 risk.** This branch's generated client models `TalentRequest.name`,
  `lastViewedAt` and `archivedAt`. Any query returning a full record — any
  `create`/`update`/`upsert` without an explicit `select` — fails against a database lacking
  them. Reproduced deterministically on a replica of production's schema, including the
  failing statement at [hire-actions.ts:264](../../src/app/actions/hire-actions.ts#L264).
  `sendScoutMessageAction` has **no transaction**, so the request row and the recruiter's
  message are already committed when it throws, leaving an orphan `DRAFT`.
- **Production was not modified** during any part of this investigation.
- **Unresolved:** `DIRECT_URL` (`ep-proud-band-am3sduhv`) is a *different endpoint* from
  `DATABASE_URL` (`ep-young-shadow-amawetjy`) and is unreachable. `prisma migrate deploy`
  targets `DIRECT_URL`, so the migration would run against a database nobody has inspected.
  The clean duplicate-check result from `DATABASE_URL` does not transfer.

**Recommended deployment order — not executed:**

1. Resolve `DIRECT_URL`; re-run the duplicate pre-flight against the real target.
2. Rehearse the migration file on a Neon child branch — it has never been executed anywhere
   (the local DB was built with `db push`, not by applying it).
3. Decide the filename collision.
4. Apply the migration **before or with** the code. Code first means every recruiter hits
   P2022 on their first Scout message.
5. Merge PR #254.

---

## 11. Open decisions for Sohail

**Before persistence implementation — the five decisions are stated in full in [§0](#0-decisions-needed-from-sohail--read-this-first).**
In short: 1 Save for Later device-local or persistent · 2 which shortlist model survives ·
3 `lastViewedAt` single or per-recruiter · 4 guest-adoption strategy · 5 auto-resume on
`/hire`. **§8A, §8B and §8C must not begin before 3, 1 and 2 are answered.**

**For the separate candidate-inclusion issue (§9)**

| # | Decision |
|---|---|
| 6 | Is the recruiter pool everyone who opts in, or everyone with verified evidence? |
| 7 | If the former: should the challenge `submissions >= 10` filter become a ranking signal? |
| 8 | What is the intended default for `searchableByRecruiters`? Only 66 of 12,804 are true today. |

**Evidence gaps — not decisions, no sign-off needed**

- The non-PROGRAM shortlist branch has never been executed (no such candidate exists in any
  writable environment). Its behaviour is settled from code, not observation.
- Whether `DIRECT_URL` is a different Neon branch or another compute.
- Why `searchableByRecruiters` is false at that scale — effect measured, cause not traced.

---

## 12. Recommended next steps

Team rule: **Investigate → Plan → Review → Implement → Test → Manual check → Regression → Done.**

- **Investigate: COMPLETE.** T-022 is answered; §1–§7 are the evidence.
- **Plan: this document**, §8.
- **Review: pending Sohail.** Nothing in §8 should start before the §0 decisions.

Then implement as **separate scoped P1 tasks**, not one "fix persistence" ticket. Suggested
order, cheapest and least contentious first:

1. **§8D search restoration UX** — no schema, no migration, and it addresses what the
   tester actually hit.
2. **§8E guest match adoption** — self-contained, independent of PR #254, and it is the
   true cause of the original report.
3. **§8A viewed persistence** — needs PR #254 merged and migrated, plus **decision 3**.
4. **§8B Save for Later** — needs **decision 1**, which is a product call, not an engineering one.
5. **§8C shortlist unification** — largest; needs **decision 2**; cheapest to do now while
   `RecruiterShortlistItem` holds 0 production rows.

§9 candidate inclusion is tracked separately and starts with decision 6.

---

## 13. Final verdict

| Criteria | Current state | T-022 conclusion | Follow-up |
|---|---|---|---|
| Search criteria | DB, restored in full | **PASS** | — |
| Matched candidates | DB, current run only | **PASS** (with history caveat) | resolved by T-040/T-044 once deployed |
| Viewed state | no writer exists | **FAIL** | §8A |
| Shortlist | DB for PROGRAM, localStorage for 3 of 4 tracks | **PARTIAL** | §8C |
| Save for Later | localStorage only | **FAIL** | §8B — decision first |
| Chat / messages | DB, restored | **PASS** | — |
| Search restoration | persists, but hidden | **PARTIAL** | §8D |
| Guest-search adoption | request + messages + cart only | **FAIL** | §8E |
| T-040/T-044 columns | exist, nothing writes them | **PARTIAL** | §8A |
| Migration in production | not applied | **N/A** | §10 |
| Candidate inclusion (PRD) | 835 eligible, 0 returned | **FAIL** | §9 — separate issue |

**Overall: saving a search saves the recruiter's question, and roughly half of their work.
The investigation is complete; **no fix has been started, and none should begin before the
§0 decisions are answered.**

---

*No code, schema, database, migration, seed, cleanup, commit or push was changed in
producing this document. Production was read-only throughout.*
