# 116 — T-022 two-browser persistence forensics

**Investigation only.** No application code, schema, migration, seed, cleanup, commit or
push. Production was read-only throughout. Every write in this report went to the local
test database `abtalks_t022`, and each DB command's target was checked before it ran.

---

## A. Environment

| | |
|---|---|
| branch | `feat/talent-request-persistence` |
| commit | `58d26b63f72abde706b4024c0de4856f3b54cb17` |
| working tree | clean except untracked `docs/plans/106-hire-search-correctness.md` |
| `DATABASE_URL` (`.env.local`) | `postgresql://***@ep-young-shadow-amawetjy-pooler…/neondb` — **PRODUCTION** |
| `DIRECT_URL` (`.env.local`) | `postgresql://***@ep-proud-band-am3sduhv…/neondb` — different endpoint, unreachable |
| `DATABASE_URL` (`.env.test.local`) | `postgresql://***@localhost:5432/abtalks_t022` — local test |
| `NODE_ENV` | unset in shell (so `next dev` runs as development) |
| dev auth | `ENABLE_DEV_AUTH="true"`, `ENABLE_RECRUITER_AUTH=true`, `RECRUITER_OTP_DEV=true` |
| **production touched?** | **NO** — only `SELECT` / `information_schema` reads |

### What the running dev server is actually connected to

A `next dev` was already running on **port 3000** (pid 50916), started as bare `next dev`.
Bare `next dev` resolves env in Next's order — `process.env` > `.env.$NODE_ENV.local` >
`.env.local` > `.env.$NODE_ENV` > `.env`. **`.env.test.local` is not in that list**, so a
shell without exports would have landed on production.

It did not. Three independent checks:

1. **Production is unchanged** — 3 requests / 15 messages / 40 matches / 0 shortlist /
   12,805 users, identical to the last read. No row created during the two-browser test.
2. **The local test DB holds the test** — two new requests at `08:14:23` and `11:18:54`
   and a second `RecruiterShortlistItem`.
3. **Sign-in proof.** From a clean browser profile against `localhost:3000`, signing in as
   `shashankmishra00026@gmail.com` returned
   `{"id":"cmtqy82d300020eax3jfqmk55","role":"RECRUITER","isAdmin":true}` — an id that
   exists only in `abtalks_t022`. `lsof` on pid 50916 also shows no Neon peer, only local
   unix sockets.

**Conclusion: port 3000 is on the local test DB. The two-browser test was safe.**

### T-040/T-044 present in the working tree

`TalentRequest.name` / `lastViewedAt` / `archivedAt`, `TalentRequestMatch.firstSeenAt` /
`viewedAt` / `decision`, enum `TalentMatchDecision`,
`@@unique([requestId, candidateUserId])`, the T-044 upsert at
[hire-actions.ts:449](../../src/app/actions/hire-actions.ts#L449), and
`prisma/migrations/20260905120000_talent_request_persistence/` — all present.

---

## B. Suspicious Scout data

**Not suspicious. They are the repo's own hire QA fixtures, and they are only in the local
test database.**

| Name | Origin | Proof |
|---|---|---|
| Scout Strong | seed fixture | literal string, [seed-hire-fixtures.ts:73](../../prisma/seed-hire-fixtures.ts#L73) |
| Scout Narrow | seed fixture | [seed-hire-fixtures.ts:85](../../prisma/seed-hire-fixtures.ts#L85) |
| Scout Consistent | seed fixture | [seed-hire-fixtures.ts:97](../../prisma/seed-hire-fixtures.ts#L97) |

The file's own header: *"Seed 3 program members with varied evidence for Scout scoring
QA."* It is wired as `npm run db:seed:hire`
([package.json:52](../../package.json#L52)) and was run against `abtalks_t022` at
`06:51:42` on 2026-09-07.

Rows in the local test DB, from that run:

```
cmtqvucjb00010e44ict4hwlv  strong@hire.abtalks.dev      Scout Strong      STUDENT    06:51:42.455
cmtqvuckr000w0e445p86su4i  narrow@hire.abtalks.dev      Scout Narrow      STUDENT    06:51:42.507
cmtqvucl0001d0e44ymf125dw  consistent@hire.abtalks.dev  Scout Consistent  STUDENT    06:51:42.516
cmtqvuclc002c0e44srize8vj  recruiter@hire.abtalks.dev   Hire Recruiter    RECRUITER  06:51:42.528
cmtqy82d300020eax3jfqmk55  shashankmishra00026@gmail.com shanky           RECRUITER  07:58:21.687
```

**Production holds zero `@hire.abtalks.dev` users** (read-only count). They are not
hardcoded UI data, not a dev-auth fixture, and not localStorage: the names come from
`User.name` rows created by that seed script.

**The "3 unusual candidates" are exactly these three.** The searches returned three because
the fixture set *is* three.

---

## C. Two-browser results

Browser A was the user's own session; Browser B was a fresh Chrome profile
(`--user-data-dir` of its own, `localStorage` verified `[]` at start) signed into the same
recruiter account against the same server.

| Feature | Result | Persistent? | Why |
|---|---|---|---|
| Search criteria | Both searches present in `Requirement ▾` → *PICK UP WHERE YOU LEFT OFF*: "Full-stack engineer MATCHED · 2026-09-07", "Backend engineer MATCHED · 2026-09-07" | **YES — DB** | `TalentRequest` keyed on `recruiterUserId`; re-read by [hire/page.tsx:26](../../src/app/hire/page.tsx#L26) |
| Matched candidates | **Zero cards.** Panel reads *"No matches yet"*. `AB-` refs on page: `[]` | **NO — never written** | The user's two requests have `matches=0` in the DB. See §E1. |
| Viewed | No marker of any kind | **NO** | Nothing writes it anywhere. See §D. |
| Shortlist | Header badge **Shortlist 1** | **YES — DB** | `RecruiterShortlistItem` row created at `08:14:23.398` |
| Save for Later | Header badge **absent**, panel empty | **NO — localStorage only** | `abtalks-hire-star` is device-local and is never merged at sign-in |
| Chat | **Fully rendered** — all six messages including the "Search now" user bubble and the "Found 3 candidate(s)" summary | **YES — DB** | Loaded from `TalentRequestMessage` when the request is opened |

**The chat was never lost.** It is in the database and it renders. What is missing is the
route to it: `/hire` opens on *"Not started"* and the only way back is the
`Requirement ▾` dropdown.

---

## D. Exact persistence architecture

### Shortlist (the "cart" / *Add to Shortlist*)

```
ShortlistButton (components/talent/shortlist-button.tsx)
  ↓ const useDb = Boolean(approved && programMemberId)      :58
  ├─ true  → toggleShortlistAction (actions/talent-actions.ts:77)
  │            ↓ toggleShortlist(userId, memberId)
  │            ↓ DB RecruiterShortlistItem (recruiterUserId, memberId, note)
  │            ↑ read: loadRequestMatches → listProgramMemberLabels({shortlistedByRecruiterUserId})
  │            ↑ UI: match.shortlisted → "In Shortlist"
  └─ false → toggleGuestCart()  :93
               ↓ localStorage "abtalks-hire-cart"  (cap 25)
               ↑ read: guestCartHas(candidateRef)
```

- **A. Table:** `RecruiterShortlistItem` (`schema.prisma:1041`).
- **B. Scope:** `@@unique([recruiterUserId, memberId])` — per **recruiter × program member**.
  Not per organization, **not per TalentRequest**, and the candidate key is a
  `ProgramMember` id, not a `User` id.
- **C.** Yes, the desk uses it — but only on the `useDb` branch.
- **D.** Yes, there is another implementation: the desk **star**, below.
- **E.** Yes, `localStorage` is involved on the `false` branch.
- **F.** They are the **same table**. `RecruiterShortlistItem.memberId` is an FK to
  `ProgramMember`, so the recruiter desk and the program portal write the same rows —
  which is also why three of the four candidate tracks cannot use it at all.
- **G. Why one candidate appeared in Shortlist after Browser B login.** Not a Browser B
  effect. At Browser A's sign-in, `MergeGuestCart`
  ([merge-guest-cart.tsx:68](../../src/components/hire/merge-guest-cart.tsx#L68)) read the
  guest cart and called `mergeGuestCartAction`, writing
  `RecruiterShortlistItem(recruiter=shashankmishra00026@gmail.com, member=narrow@hire.abtalks.dev)`
  at `08:14:23.398`. It is a database row, so every later session sees it.

### Save for Later (the star)

```
DeskShortlistButton
  ↓ toggleDeskShortlist(item)      components/hire/desk-shortlist.ts:83
  ↓ localStorage "abtalks-hire-star"  JSON array, cap 40   :4, :89
  ↑ read: readDeskShortlist()      :54
  ↑ UI: HireSavedLater panel + header count
```

- **A/B.** Click writes to `localStorage` only. **No server action, no DB write.**
- **D.** Key `abtalks-hire-star`; value an array of `DeskShortlistItem`
  (`candidateRef`, `jobRole`, `displayName`, `skills`, `totalScore`, `source`, …) — the
  whole card is copied into the browser.
- **E/F.** Loaded from the same key. Browser B has a different profile, so the key is
  absent and the list is empty.
- **G. No server-side persistence exists that is simply not being read.** `MergeGuestCart`
  merges `readGuestCart()` (`abtalks-hire-cart`) only; `readDeskShortlist()` is never
  called there.
- **H. Intentional.** [hire-saved-later.tsx:91](../../src/components/hire/hire-saved-later.tsx#L91):
  *"Storage is `desk-shortlist.ts` (localStorage) … It stays device-local on purpose; the
  Shortlist is the thing that survives sign-in."* This is a **product decision, not a bug** —
  though the UI does not tell the recruiter that.

### Chat

```
Signed-in path:   sendScoutMessageAction (hire-actions.ts:167)
                    :224 talentRequest.create({select:{id}})
                    :243 talentRequestMessage.create   (user)
                    :254 runScoutTurn  (Groq)
                    :264 talentRequest.update          ← no select
                    :283 talentRequestMessage.create   (assistant)
Guest path:       MergeGuestCart → adoptGuestScoutSessionAction (:664)
                    tx.talentRequest.create({ status: searched ? MATCHED : DRAFT })
                    tx.talentRequestMessage.createMany(all messages at once)
Read:             /hire/[requestId] → request.messages, ordered by createdAt
```

### Viewed

```
open candidate → CandidateInspector renders → (nothing else)
```

No action, no fetch, no storage. `viewedAt` is **selected** at
[load-request-matches.ts:85](../../src/features/hire/load-request-matches.ts#L85) and
**returned** at :225, and never assigned anywhere in `src/`.

### Matches / search criteria

```
runMatchAction (:318) → searchCandidates(spec, {limit:20})
   → $transaction([ deleteMany(notIn kept), ...upsert per candidate ])   :443-455
   → read: loadRequestMatches → request.matches
```

---

## E. Root causes

### E1. Confirmed — the user's searches persisted **zero** matches

```
cmtqw89dt0  "Backend engineer"     07:02:31  msgs=3  matches=3   recruiter@hire.abtalks.dev
cmtqysol70  "Backend engineer"     08:14:23  msgs=6  matches=0   shashankmishra00026@gmail.com
cmtr5dz6j0  "Full-stack engineer"  11:18:54  msgs=6  matches=0   shashankmishra00026@gmail.com
```

Both of the user's requests have **all six messages sharing one timestamp**
(`08:14:23.626`, `11:18:54.833`) and `updatedAt == createdAt`. A real Scout conversation
does not look like that — the first request's three messages are `07:02:31.592`,
`07:02:34.865`, `07:02:38.181`.

One timestamp for a whole transcript means one bulk insert. That is
`adoptGuestScoutSessionAction`
([hire-actions.ts:664](../../src/app/actions/hire-actions.ts#L664)):

- `status: searched ? MATCHED : DRAFT` → explains `MATCHED`
- `tx.talentRequestMessage.createMany(...)` → explains the identical timestamps
- **it writes no `TalentRequestMatch` rows at all** → explains `matches=0`

So the searches were run **as a guest**, results lived in `localStorage`
(`abtalks-hire-guest-matches`), and on sign-in only the transcript and the cart were
adopted. The candidates the user saw were browser-local and never reached the database.
The stored assistant line *"Found 3 candidate(s)"* is just replayed text.

**This is a real gap:** the adoption path saves the conversation but discards the results
it describes.

### E2. Confirmed — Groq was rate-limited during the 11:18 run

Stored assistant message: *"I'm at capacity for a moment — give it a few seconds and send
that again. Nothing you've told me is lost."* An independent live call to
`openai/gpt-oss-120b` returned HTTP 200, so the key is valid; this was transient.

### E3. Confirmed — viewed state has no writer, on this branch too

`lastViewedAt`, `archivedAt`, `viewedAt`, `firstSeenAt`: **no assignment anywhere in
`src/`**. `firstSeenAt` is populated only by its column default. The three `decision`
matches in the repo are the interview agent and a hire-request enum, unrelated.

### E4. Expected behaviour — Save for Later is device-local by design

Documented in the component. See §D.

### E5. Expected behaviour — the chat is fine

Saved **and** loaded. The failure was navigational, not one of persistence.

### E6. Test/fixture artefacts

- Scout Strong / Narrow / Consistent — `db:seed:hire`, local only.
- `firstSeenAt = 13:03:34.202` on all three of the earliest match rows while their
  `createdAt` is `07:02:38.146`: the column was added by `prisma db push` after those rows
  existed, so they took the `DEFAULT CURRENT_TIMESTAMP` of the push. **Not evidence about
  match behaviour.** It is a live demonstration of why the migration carries a backfill.
- One scratch row, `FORENSIC-T022 rerun probe`
  (`cmtr674tn00010euc78fajbkp`), left in the local test DB by the §F experiment. Left in
  place because deletions were forbidden.

### E7. Unproven hypotheses — explicitly not concluded

- Whether `DIRECT_URL` is a different Neon **branch** or merely another compute. Still
  unreachable.
- Whether the non-PROGRAM shortlist branch behaves as read. All three fixtures are
  PROGRAM, so `useDb === false` was never executed.
- Whether the user's guest session began signed-out or pre-approval. The adoption path is
  proven; which of the two produced the guest state is not recorded anywhere.

### E8. Not reproduced here — P2022

Against `abtalks_t022` the current flow **cannot** hit it: the code expects six new fields
and the DB has all six. Against production it would, as proved in
[115](115-talent-request-schema-drift-investigation.md).

---

## F. Rerun behaviour — measured, not assumed

Run twice through the exact `$transaction([deleteMany(notIn), upsert])` shape of
[hire-actions.ts:443-455](../../src/app/actions/hire-actions.ts#L443), on a scratch request
in the local test DB, with a recruiter action in between:

```
RUN 1: {"id":"cmtr674v20","firstSeenAt":"2026-09-07T11:41:35.196Z","score":70,"decision":"UNDECIDED"}
       recruiter marks it viewed + SHORTLISTED
RUN 2: {"id":"cmtr674v20","firstSeenAt":"2026-09-07T11:41:35.196Z","score":81,
        "viewedAt":"2026-09-07T11:41:35.224Z","decision":"SHORTLISTED"}

SAME ROW ID kept:       true
firstSeenAt preserved:  true
viewedAt preserved:     true
decision preserved:     true
score refreshed:        true
```

**Answer to §8: (C) upserts them.** On this branch a rerun preserves the row and its
state and refreshes only the scoring. On master it is (B) delete + recreate.

So "matched candidates persist" must be read precisely:

- **current results are saved** — yes, when the run goes through `runMatchAction`
- **candidate history persists** — on this branch the *mechanism* now exists; on master it
  does not; and in the user's own test **neither**, because the guest-adoption path wrote
  no match rows at all

---

## G. Multiple / duplicate systems

| Concept | Implementation | Storage | Used by current `/hire`? | Used elsewhere? |
|---|---|---|---|---|
| Shortlist (program) | `talent-actions.ts:77` `toggleShortlistAction` | DB `RecruiterShortlistItem` | yes (`useDb` true) | `/talent/members/[id]`, `/talent/shortlist` |
| Shortlist (non-program) | `guest-cart.ts` | localStorage `abtalks-hire-cart`, cap 25 | yes (`useDb` false) | merged at sign-in for program ids only |
| Save for Later / star | `desk-shortlist.ts` | localStorage `abtalks-hire-star`, cap 40 | yes | never merged anywhere |
| Guest search + matches | `guest-matches-store.ts` | localStorage **and** sessionStorage | yes, pre-auth | adopted (messages only) at sign-in |
| Intro requested | `desk-requested.ts` | localStorage `abtalks-hire-requested` | yes | — |
| Evidence cache | `evidence-cache.ts` | localStorage `abtalks-hire-evidence` | yes | evidence page |
| Note (program) | `shortlist-note-form.tsx` | DB `RecruiterShortlistItem.note` | **no** | `/talent/members/[id]` only |
| Durable list | `TalentList` / `TalentListItem` | DB | **no — 0 usages** | none |
| Candidate note | `CandidateNote` | DB | **no — 0 usages** | none |
| Match state | `TalentRequestMatch` | DB | read yes, state never written | — |

**Two different systems serve one concept in three places:** shortlist (DB vs
localStorage, split by candidate track); saved-candidate (cart vs star, two lists with two
storages and two UI affordances); and notes (`RecruiterShortlistItem.note`, reachable only
from another portal, versus `CandidateNote`, built and never wired).

---

## H. T-022 verdict

**PARTIAL** — and for narrower reasons than before.

Now answered with observation plus DB evidence: criteria, matches, viewed, shortlist, Save
for Later, chat, search identity, and the route back.

Still not answerable:

1. **Candidate note** — no UI exists on the recruiter desk, so the action cannot be
   performed. A finding, not a gap in testing.
2. **The non-PROGRAM shortlist branch** — all fixtures are PROGRAM, so `useDb === false`
   (three of four candidate tracks) has still never been exercised.

---

## I. What T-040/T-044 actually fix

**Do fix**

- A rerun no longer destroys per-match state — measured in §F.
- `TalentRequestMatch` gains a stable identity, `@@unique([requestId, candidateUserId])`,
  so state can be attached to a match at all.
- The columns to hold viewed / first-seen / decision now exist.

**Do NOT fix — and each was observed in this test**

1. **Viewed state still does not work.** Nothing writes `viewedAt`. T-040 supplies the
   column; the recording is T-045.
2. **Save for Later still vanishes.** Untouched by this PR; it is localStorage by design.
3. **The guest-adoption path still discards matches.** `adoptGuestScoutSessionAction`
   writes no `TalentRequestMatch` rows, so a guest search that is adopted still lands with
   `matches=0`. **This is the single biggest cause of what the user observed, and this PR
   does not address it.**
4. **`/hire` still opens on "Not started"**, with the way back buried in a dropdown.
5. **Notes are still unreachable** from the desk.
6. **The shortlist is still split** across a DB table and localStorage by candidate track.

---

## J. Required next work — not implemented

**Needs manager / Sohail decision**
- Q3 from [113-A](113-A-schema-review-sohail.md): single `lastViewedAt` vs per-recruiter.
- Is Save for Later meant to stay device-local? If yes, the UI should say so; if no, it
  needs a table.
- Which shortlist survives: `RecruiterShortlistItem` (cannot hold 3 of 4 tracks) or the
  already-modelled `TalentList` / `TalentListItem`.

**Needs schema / migration**
- Resolve `DIRECT_URL` before any `migrate deploy`; re-run the duplicate pre-flight there.
- Rehearse the migration file itself — it has still never been executed anywhere; the
  local DB was built with `db push`.
- Decide on the `20260905120000` folder-name collision.

**Needs product implementation** (each a separate task)
- Write `viewedAt` when the inspector opens, and `lastViewedAt` on request load.
- Persist matches in `adoptGuestScoutSessionAction`, or re-run the match after adoption.
- Surface the resume affordance on `/hire` instead of only inside `Requirement ▾`.
- A note surface on the desk.

**Needs separate investigation**
- The non-PROGRAM shortlist branch, with fixtures for CLAUDE / CHALLENGE_60 / HACKATHON.
- Whether `TalentList` / `CandidateNote` were abandoned deliberately.
- The stale production guards in the seed scripts and the missing guard in
  `prisma/cleanup.ts` ([114-A](114-A-t022-test-environment.md)).

---

## Reproduction notes

- Production: `SELECT` / `information_schema` / `pg_indexes` / `_prisma_migrations` only.
- Local writes: one scratch `TalentRequest` + one `TalentRequestMatch`
  (`FORENSIC-T022 rerun probe`, `cmtr674tn00010euc78fajbkp`), created by the §F script,
  left in place.
- Browser B: Chrome `--headless=new` with its own `--user-data-dir`, `localStorage`
  verified `[]` before sign-in, against `localhost:3000`.
- Nothing was deleted, migrated, seeded, committed or pushed.
