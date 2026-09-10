# T-022 — Talent Search Persistence Investigation

**Status:** investigation only. No code changed, no schema touched, no migration created, no production data modified.
**Code under investigation:** `master` @ `99f79b07`
**Production data:** read-only queries, 2026-09-07

---

## 1. Product Test

**The product test was NOT performed. It is blocked, and I am not going to report
guesses as observations.**

The journey you specified (sign in → run a search → shortlist → note → sign out →
sign back in) writes to the database. There is exactly one database reachable from
this repo, and it is production:

| Signal | Value |
|---|---|
| `User` | 12,805 rows |
| seeded `@abtalks.dev` test users | **0** |
| `Submission` | 15,645 |
| `RecruiterProfile` | 2 |
| latest `_prisma_migrations` entry | applied 2026-09-05 07:46 |

`.env.local` defines only `DATABASE_URL` and `DIRECT_URL`, both Neon, both this same
`neondb`. There is no staging, seed, or local database configured.

Running the journey would create, in production: a `User` + `RecruiterProfile` (an
*approved* one — see §3, searches are not saved otherwise), one `TalentRequest`, seven
or so `TalentRequestMessage` rows, and 20 `TalentRequestMatch` rows. Sign-in itself is
free — sessions are JWT ([auth.config.ts:76](../../src/auth.config.ts#L76)), so no
`Session` row is written — but everything after it is not.

That collides directly with your own instruction: *"DO NOT change production data."*
I did not resolve that collision on my own.

**What I substituted, and how it is labelled.** Instead of inferring product behaviour
from code, I read the *existing production rows* for the three real searches that
recruiters have already run. That is observed system state, not a code reading, and it
is marked as such throughout. It answers most of what the journey would have answered.
It cannot answer anything about live UI rendering — those cells say so.

### Production state of every real search (read-only)

```
request cmtlha4o "Full Stack Developer" [ACTIVE]
  created 2026-09-03T12:05:13Z   updated 12:05:13Z
  matches=0  messages=1

request cmtlhafi "Backend engineer" [MATCHED]
  created 2026-09-03T12:05:27Z   updated 12:06:27Z
  matches=20 messages=7
  match createdAt range: 12:06:26.440Z .. 12:06:26.440Z      ← min == max

request cmtmisiq "AI engineer" [MATCHED]
  created 2026-09-04T05:35:17Z   updated 05:36:08Z
  matches=20 messages=7
  match createdAt range: 05:36:07.127Z .. 05:36:07.127Z      ← min == max
```

```
RecruiterShortlistItem   0 rows      (0 with a note)
TalentList               0 rows
TalentListItem           0 rows
CandidateNote            0 rows
```

Two things fall straight out of that, before any code is read:

1. **Every match row of a search carries an identical `createdAt` to the millisecond.**
   Twenty rows, one timestamp, written ~1 minute after the request. That is a single
   bulk insert, not an accumulated history.
2. **`RecruiterShortlistItem` has never held a single row in production.** Not one
   shortlist, not one note. The DB-backed shortlist has never been exercised by a real
   recruiter.

---

## 2. Persistence Matrix

| Recruiter work | Survives return? | Exact proof | Verdict |
|---|---|---|---|
| Criteria | **Yes**, if the recruiter is approved | 20 scalar columns on `TalentRequest` ([schema.prisma:1092-1130](../../prisma/schema.prisma#L1092)); re-read by [hire/page.tsx:26](../../src/app/hire/page.tsx#L26) and [load-request-matches.ts:38](../../src/features/hire/load-request-matches.ts#L38). Production holds 3 such rows. | **PERSISTED** (approved only) |
| Matched candidates | **Rows yes, history no** | `TalentRequestMatch` rows exist and are re-read, but [hire-actions.ts:378](../../src/app/actions/hire-actions.ts#L378) deletes every row for the request and [:403](../../src/app/actions/hire-actions.ts#L403) recreates them each run. Production confirms: min `createdAt` == max `createdAt` on all 20 rows of both matched searches. | **PARTIAL** |
| Viewed candidates | **No** | No column, no key, no call. `TalentRequestMatch` ([schema.prisma:1180-1210](../../prisma/schema.prisma#L1180)) has no viewed field; a repo-wide grep for `viewedAt`/`lastViewed`/`markViewed`/`hasViewed`/`seenAt` returns only `reviewedAt` (admin recruiter approval) and workshop analytics. | **NOT PERSISTED** |
| Shortlist | **No, for the recruiter desk** | The desk star is `localStorage` key `abtalks-hire-star` ([desk-shortlist.ts:4](../../src/components/hire/desk-shortlist.ts#L4), cap 40 at [:89](../../src/components/hire/desk-shortlist.ts#L89)). The cart falls back to `localStorage` key `abtalks-hire-cart` unless the candidate is a program member ([shortlist-button.tsx:58](../../src/components/talent/shortlist-button.tsx#L58)). Production: `RecruiterShortlistItem` = **0 rows**. | **NOT PERSISTED** |
| Notes | **No, from the recruiter desk** | `RecruiterShortlistItem.note` ([schema.prisma:1045](../../prisma/schema.prisma#L1045)) exists and `updateShortlistNoteAction` ([talent-actions.ts:106](../../src/app/actions/talent-actions.ts#L106)) writes it, but the only UI that calls it is `/talent/members/[id]` ([page.tsx:112](../../src/app/talent/members/[id]/page.tsx#L112)) — a different portal. No `/hire` surface renders a note field. Production: 0 notes. | **NOT PERSISTED** |
| Search identity / name | **No** | `TalentRequest` has `title` (the role) but no `name`. Two searches for the same role are indistinguishable in the recent list, which shows `title`+`status`+`date` only ([hire/page.tsx:46-51](../../src/app/hire/page.tsx#L46)). | **NOT PERSISTED** |

**Cells I could not fill without the product test:** whether each of these is *visibly*
absent in the UI on return, and the exact wording/state the recruiter sees. The verdicts
above rest on storage and call-path evidence plus production rows, not on rendering.

---

## 3. Code Evidence

### 3.1 Criteria — PERSISTED (approved recruiters only)

- **File:** [src/app/hire/page.tsx:20](../../src/app/hire/page.tsx#L20)
- **Field:** `TalentRequest.*` — 20 scalar columns, `schema.prisma:1092`
- **Gate:** `const persist = recruiter.status === "approved";`
- **Read on return:** [hire/page.tsx:26](../../src/app/hire/page.tsx#L26) —
  `talentRequest.findMany({ where: { recruiterUserId }, take: 8 })`
- **Sign-out/sign-in:** row is keyed on `recruiterUserId` and survives. JWT sessions, so
  sign-in writes nothing.
- **The exception that matters:** an unapproved or pending recruiter gets `persist =
  false`. Their entire search lives in `localStorage`/`sessionStorage` under
  `abtalks-hire-guest-matches` ([guest-matches-store.ts:5](../../src/components/hire/guest-matches-store.ts#L5),
  written to both stores at [:125-126](../../src/components/hire/guest-matches-store.ts#L125)).
  Nothing reaches the database at all.

### 3.2 Matched candidates — PARTIAL

- **File:** [src/app/actions/hire-actions.ts](../../src/app/actions/hire-actions.ts)
- **Table:** `TalentRequestMatch`, `schema.prisma:1180`
- **The write, verbatim:**
  - `:363` `searchCandidates(spec, { limit: 20 })` — hard cap of 20
  - `:378` `prisma.talentRequestMatch.deleteMany({ where: { requestId: req.id } })`
  - `:403` `prisma.talentRequestMatch.createMany({ ... })`
- **The read:** [load-request-matches.ts:44-58](../../src/features/hire/load-request-matches.ts#L44)
  selects `candidateUserId, programMemberId, source, score, tier, scoreBreakdown,
  rationale, gaps, availabilityUnknown, evidence` — scoring only, no state.
- **Sign-out/sign-in:** the rows are still there, so a returning recruiter sees 20
  candidates. But `createdAt` means "last run", not "first seen", and there is no
  identity to carry state on: no unique key on `(requestId, candidateUserId)`.
- **Production proof:** all 20 rows of `cmtlhafi` share `createdAt`
  `2026-09-03T12:06:26.440Z`; same pattern on `cmtmisiq`. A history would show spread.

### 3.3 Viewed state — NOT PERSISTED

- **File:** none. There is no implementation.
- **Storage key:** none.
- **Nearest thing that exists:** `abtalks-hire-requested`
  ([desk-requested.ts:4](../../src/components/hire/desk-requested.ts#L4)), written by
  [request-intro-button.tsx:89](../../src/components/hire/request-intro-button.tsx#L89)
  and [hire-talent-pod.tsx:199](../../src/components/hire/hire-talent-pod.tsx#L199).
  Its own doc comment says *"on this device"*. It records "I asked for an intro", which
  is not "I looked at this candidate", and it is `localStorage`.
- **Sign-out/sign-in:** nothing to survive.

### 3.4 Shortlist — NOT PERSISTED (for the recruiter desk)

There are **two** shortlist mechanisms, rendered on the same card:

| | Star | Cart |
|---|---|---|
| Component | `DeskShortlistButton` | `ShortlistButton` |
| Both imported by | [desk-match-card.tsx:5-6](../../src/components/hire/desk-match-card.tsx#L5), [candidate-inspector.tsx:14,19](../../src/components/hire/candidate-inspector.tsx#L14) | same |
| Rendered at | `desk-match-card.tsx:316` | `desk-match-card.tsx:360` |
| Storage | `localStorage` `abtalks-hire-star`, cap 40 | DB **or** `localStorage` `abtalks-hire-cart`, cap 25 |
| Backing | [desk-shortlist.ts](../../src/components/hire/desk-shortlist.ts) | [talent-actions.ts:77](../../src/app/actions/talent-actions.ts#L77) → `RecruiterShortlistItem` |

The cart's branch is [shortlist-button.tsx:58](../../src/components/talent/shortlist-button.tsx#L58):

```ts
const useDb = Boolean(approved && programMemberId);
```

`programMemberId` is set only for PROGRAM-source candidates. The other three tracks —
CLAUDE, CHALLENGE_60, HACKATHON — take `toggleLocal()` at `:91` and land in
`localStorage`. And `RecruiterShortlistItem.memberId` is an FK to `ProgramMember`
(`schema.prisma:1048`), so it structurally cannot hold them.

The star is device-local by design, and says so:
[hire-saved-later.tsx:91-95](../../src/components/hire/hire-saved-later.tsx#L91) —
*"Storage is desk-shortlist.ts (localStorage) … It stays device-local on purpose."*

- **Sign-out/sign-in:** `MergeGuestCart` ([hire/layout.tsx:59](../../src/app/hire/layout.tsx#L59))
  copies the guest *cart* into the DB on sign-in — for program members only, capped at
  25 ([talent-actions.ts:127](../../src/app/actions/talent-actions.ts#L127)). Nothing
  merges the star. Sign-out does not clear `localStorage`, so on the **same device and
  browser** the star appears to survive; on any other device it is gone.
- **Production proof:** `RecruiterShortlistItem` = 0 rows. In production this DB path
  has never once been taken.

### 3.5 Notes — NOT PERSISTED (from the desk)

- **File:** [src/components/talent/shortlist-note-form.tsx](../../src/components/talent/shortlist-note-form.tsx)
- **Field:** `RecruiterShortlistItem.note`, `schema.prisma:1045`
- **Action:** `updateShortlistNoteAction` ([talent-actions.ts:106](../../src/app/actions/talent-actions.ts#L106))
- **Only caller:** [/talent/members/[id]/page.tsx:112](../../src/app/talent/members/[id]/page.tsx#L112).
  Grep for `ShortlistNoteForm` across `src/` returns that one page and the component's
  own definition. Nothing under `/hire` renders it.
- **Consequence:** a note is reachable only by leaving the desk for the `/talent`
  portal, and only for a program member who is already shortlisted. It is not attached
  to a search — one note per (recruiter, member), globally.
- **Sign-out/sign-in:** a note that was written would survive. Production has none.

### 3.6 Every client storage key in this flow

| Key | File | What it holds |
|---|---|---|
| `abtalks-hire-star` | [desk-shortlist.ts:4](../../src/components/hire/desk-shortlist.ts#L4) | desk "saved for later", cap 40 |
| `abtalks-hire-cart` | [guest-cart.ts:8](../../src/components/hire/guest-cart.ts#L8) | cart for non-program candidates, cap 25 |
| `abtalks-hire-requested` | [desk-requested.ts:4](../../src/components/hire/desk-requested.ts#L4) | intro already asked for |
| `abtalks-hire-guest-matches` | [guest-matches-store.ts:5](../../src/components/hire/guest-matches-store.ts#L5) | the entire search + results, unapproved recruiters |
| `abtalks-hire-evidence` | [evidence-cache.ts:5](../../src/components/hire/evidence-cache.ts#L5) | match snapshots for the evidence page |
| guest session, pending demand, pending checkout | `guest-session.ts`, `pending-demand.ts`, `pending-checkout.ts` | pre-auth handoff |

---

## 4. Search vs Project

**`TalentRequest` today is a saved SEARCH. It is not a persistent recruiter project or
workspace.**

The test is not whether a row survives — it does — but whether the recruiter's *work*
survives. What a returning approved recruiter gets back:

- **The question they asked.** All 20 criteria columns, plus the Scout conversation
  (`TalentRequestMessage`, 7 rows on both matched searches).
- **A list of 20 candidates**, which is the *answer as of the last run*, not a record of
  what they did with it.

What does not come back:

- **Which candidates they opened** — never recorded anywhere.
- **Who they shortlisted** — device-local for the desk star and for three of four
  candidate tracks; production has zero DB shortlist rows.
- **What they thought** — the note UI is not on the desk, and no note is attached to a
  search.
- **Which search this was** — no name; the recent list shows role title, status, date.
- **What changed since last time** — impossible by construction. `deleteMany` +
  `createMany` means there is no "last time" to compare against, and no unique key on
  `(requestId, candidateUserId)` to hang state on even if there were.

A project is a place where work accumulates. Here the criteria accumulate and nothing
else does. Every re-run resets the answer and the recruiter starts their reading over.

---

## 5. Existing Systems

Extend these. Do not build parallel ones.

| System | Location | State | How it should be used |
|---|---|---|---|
| `TalentRequest` | `schema.prisma:1092` | live, 3 production rows | **This is the project.** Extend it. Do not create a `Project` model. |
| `TalentRequestMatch` | `schema.prisma:1180` | live, 40 production rows | The per-(search, candidate) row already exists — it is the natural home for viewed/decision state, once it has a stable identity. |
| `TalentRequestMessage` | `schema.prisma:1148` | live, 15 production rows | Scout conversation already persists per request. |
| `TalentList` / `TalentListItem` | `schema.prisma:3022`, `:3043` | **0 usages in `src/`, 0 production rows** | Org-scoped list with `PipelineStage` and a candidate-deletion tombstone. Already the right shape for a durable shortlist. Built and never wired up. |
| `CandidateNote` | `schema.prisma:3064` | **0 usages in `src/`, 0 production rows** | Org-scoped, keyed on `candidateUserId`, multiple notes per candidate. Strictly better than `RecruiterShortlistItem.note`. Built and never wired up. |
| `RecruiterShortlistItem` | `schema.prisma:1041` | **0 production rows** | FK'd to `ProgramMember`, so it can only ever hold one of four tracks, and it has no `requestId`. A dead end — do not extend it. |
| `desk-shortlist` / `guest-cart` | `src/components/hire/` | live, device-local | Keep as the pre-auth and "still thinking" layer. The durable list is a separate concern. |

The headline: **`TalentList` + `TalentListItem` + `CandidateNote` are already in the
schema, already org-scoped, and have zero rows and zero callers.** The durable shortlist
and notes that R3 needs are largely built. They were never connected to a UI.

---

## 6. Gaps

Only what the evidence above proves.

1. **A match run destroys its own history.** `hire-actions.ts:378` + `:403`. Proven in
   production by the identical `createdAt` across all 20 rows of both matched searches.
2. **`TalentRequestMatch` has no stable identity.** No unique key on
   `(requestId, candidateUserId)` (on `99f79b07`, `schema.prisma:1168-1169` — only two
   non-unique indexes; this PR is what adds the unique key). Nothing can be attached to a match across runs.
3. **Viewed state does not exist.** No column, no key, no code path.
4. **The desk shortlist is device-local.** `localStorage`, cap 40, never merged on
   sign-in. Zero DB rows in production.
5. **The DB shortlist can only hold one track of four.** `RecruiterShortlistItem.memberId`
   → `ProgramMember`. It is also not scoped to a search.
6. **Notes are unreachable from the desk.** The only caller is `/talent/members/[id]`.
7. **Searches have no name.** Two searches for the same role are indistinguishable.
8. **Unapproved recruiters persist nothing.** `hire/page.tsx:20`. The whole search lives
   in `localStorage`.
9. **Matches are capped at 20 and reset per run** (`hire-actions.ts:363`). Any metric
   counting them understates and changes on re-run.
10. **`TalentList` / `TalentListItem` / `CandidateNote` are dead schema** — 0 callers,
    0 rows.

---

## 7. Impact on R3

- **The R3 unit of work already exists.** `TalentRequest` is the project. Adding a
  `Project` model would fork the recruiter's world in two and orphan the 3 live rows,
  the 15 Scout messages, and the 40 matches. Extend.
- **Nothing per-candidate can be built until gap 2 is closed.** Viewed state, decisions,
  "new since your last visit" — every one of them needs a row that survives a re-run,
  which needs the unique key and an upsert. That is the gating dependency for the rest
  of R3, not a detail.
- **The durable shortlist is a wiring job, not a design job.** `TalentList` /
  `TalentListItem` (with `PipelineStage`) and `CandidateNote` are already modelled and
  org-scoped. R3 should connect them, not design them again — and should not extend
  `RecruiterShortlistItem`, which cannot represent three of the four tracks.
- **`localStorage` will keep looking like persistence during testing.** Sign-out does not
  clear it, so on one device the star survives and a manual test can read as a pass.
  Any acceptance test for R3 must cross devices or clear site data.
- **Approval gating is a real scope item.** A pending recruiter's search never reaches
  the database. If R3 promises persistence, it has to say what happens before approval.

---

## 8. Recommendation for Next Step

**Do the product test properly, on a database that is not production.**

That is the smallest next step, and it is the one thing this report could not do. Two
ways, either is fine:

- a Neon **child branch** of production, with `DATABASE_URL`/`DIRECT_URL` pointed at it
  for the run; or
- explicit written approval to run the journey against production, accepting the rows it
  creates.

The journey then runs as you specified, with one addition that matters given gap 4:
**do the return leg in a different browser profile, or clear site data first.** Otherwise
`localStorage` will make the shortlist look persistent when it is not.

**After that, the smallest implementation step is gap 2 and nothing else:** give
`TalentRequestMatch` a unique `(requestId, candidateUserId)` key and change the match run
from delete/recreate to upsert. It changes no recruiter-visible behaviour on its own,
and every other R3 item — viewed state, decisions, new-since-last-visit — is blocked on
it. Design of the shortlist/notes wiring should wait until the product test says what a
recruiter actually loses.

---

## Confirms / contradicts the earlier audit

`docs/plans/113-talent-request-persistence-audit.md` (2026-09-05) covered the same
ground. Against current `master` @ `99f79b07`:

**Confirmed**

- `TalentRequest` is a saved search, not a project.
- `runMatchAction` delete/recreate is the root cause (`:378`, `:403`).
- Criteria persist; viewed state does not exist.
- `TalentList` / `TalentListItem` / `CandidateNote` exist with zero usages — and I can
  now add zero production rows.
- Matches capped at 20 and reset per run.

**Contradicted / materially incomplete**

1. **Shortlist.** 113 recorded shortlist as *"persists, but global to the recruiter,
   cohort-only"* and pointed at `RecruiterShortlistItem`. That is not what the recruiter
   desk uses. The desk star is `localStorage` (`abtalks-hire-star`), and the cart falls
   back to `localStorage` for every non-program candidate
   ([shortlist-button.tsx:58](../../src/components/talent/shortlist-button.tsx#L58)).
   `RecruiterShortlistItem` has **0 production rows** — the DB path has never been
   taken. The correct verdict is **NOT PERSISTED**, not "persists with caveats".
2. **Notes.** 113 marked notes the same way. The note UI exists only at
   `/talent/members/[id]`, not on the recruiter desk, so a desk recruiter cannot write
   one at all. 0 production rows.
3. **Approval gating went unmentioned.** `persist = recruiter.status === "approved"`
   ([hire/page.tsx:20](../../src/app/hire/page.tsx#L20)). For an unapproved recruiter
   *nothing* persists — the search itself included. That is a bigger persistence hole
   than anything 113 listed.
4. **The `localStorage` layer went unmentioned entirely.** Six keys carry recruiter
   state. 113 read the database and stopped there, which is exactly how the shortlist
   verdict came out wrong.

113's schema proposal is not invalidated by any of this — its diagnosis of the match
table holds. But its persistence matrix overstated shortlist and notes, and its verdict
on those two rows should be replaced by §2 above.

---

## Evidence index

Every file opened for this report:

| File | Lines used |
|---|---|
| `prisma/schema.prisma` | 1041-1051, 1092-1130, 1131-1143, 1150-1170, 2977-3035 |
| `src/app/actions/hire-actions.ts` | 363, 378, 403 |
| `src/app/actions/talent-actions.ts` | 77-100, 106-127 |
| `src/features/hire/load-request-matches.ts` | 38-60 |
| `src/app/hire/page.tsx` | 14-53 |
| `src/app/hire/requests/page.tsx` | 34-69 |
| `src/app/hire/[requestId]/page.tsx` | 94-125 |
| `src/app/hire/layout.tsx` | 59 |
| `src/components/talent/shortlist-button.tsx` | 17-106 |
| `src/components/hire/desk-match-card.tsx` | 7-8, 235-270 |
| `src/components/hire/desk-shortlist.ts` | whole file (92 lines) |
| `src/components/hire/desk-requested.ts` | whole file (35 lines) |
| `src/components/hire/guest-cart.ts` | 8, 141-168 |
| `src/components/hire/guest-matches-store.ts` | 5, 109-156 |
| `src/components/hire/evidence-cache.ts` | 5 |
| `src/components/hire/hire-saved-later.tsx` | 85-100 |
| `src/components/hire/request-intro-button.tsx` | 89 |
| `src/components/hire/hire-talent-pod.tsx` | 14, 199 |
| `src/app/talent/members/[id]/page.tsx` | 10-11, 112 |
| `src/auth.config.ts` | 76 |

Production queries were `SELECT`/`count`/`aggregate` only. Nothing was inserted,
updated, deleted or migrated.

---

# Product Test — Local Environment

**Performed 2026-09-07 against `master` @ `99f79b07`.** The journey was executed in a
real browser driven over the Chrome DevTools Protocol. Production was never connected to
by the application.

> **Which master this was, and how to read the line numbers.**
>
> `99f79b07` predates PR #257 (recruiter desk UI pass), which merged to master later the
> same day as `51357cc4`. Every screen described below is therefore the pre-#257 desk.
> #257 changed presentation only — `hire-scout.css` and seven components — and touched
> **none** of the files these verdicts rest on: `desk-shortlist.ts`, `guest-cart.ts`,
> `talent-actions.ts`, `hire-actions.ts`, `load-request-matches.ts`, `hire/page.tsx` and
> `schema.prisma` are all unchanged by it, and the storage keys `abtalks-hire-star` /
> `abtalks-hire-cart` are identical. The persistence findings stand as written; only the
> rendering they were observed through has since moved.
>
> File and line references have been refreshed to this branch's tree so the links resolve
> for a reviewer — **except** the delete/recreate citations in §3.2
> (`hire-actions.ts:378` / `:403`), which deliberately point at `99f79b07`. That code is
> exactly what this PR removes; there is no line on this branch to point at.

## Environment

| | |
|---|---|
| Database | local PostgreSQL 16.14, `localhost:5432/abtalks_t022` |
| Created by | `createdb abtalks_t022` — new, empty (0 tables) before the test |
| Schema | `prisma db push` from `master`'s `prisma/schema.prisma` |
| Env file | `.env.test.local` (gitignored). **`.env.local` was never edited.** |
| Seed | `npm run db:seed:hire` |
| Auth | `ENABLE_DEV_AUTH=true`, dev credentials provider |
| App | `next dev -p 3111` with `.env.test.local` exported into the shell |

### Why this was safe

The target was checked against both Neon endpoints before every write-capable command:

```
target: host=localhost:5432 db=abtalks_t022
  not ep-young-shadow-amawetjy-pooler  ✓
  not ep-proud-band-am3sduhv           ✓
  not neon.tech                        ✓
```

Shell-exported vars beat every `.env` file in Next.js precedence, so `.env.local` could
not win even though the dev server reports loading it.

**Proof the running app was on the local database, not production:** the fixture recruiter
exists in one place only.

```
PRODUCTION: @hire.abtalks.dev users here: 0
LOCAL TEST: @hire.abtalks.dev users here: 4
```

Sign-in as `recruiter@hire.abtalks.dev` succeeded and returned
`{"user":{"name":"Hire Recruiter","email":"recruiter@hire.abtalks.dev","role":"RECRUITER"}}`.
That session is only possible against the local database.

### Two deviations, both recorded

**1. The fixture needed a visibility row.** As predicted in `114-A`, `seed-hire-fixtures.ts`
creates no `CandidateVisibility` row, and `searchableUserWhere()` requires one to exist.
Verified in the local DB after seeding — `has_visibility_row = f` for all three candidates.

Production was checked read-only first to establish which side was wrong:

```
CandidateVisibility rows in production: 12804   (of 12805 users)
  searchable=true: 66
```

Real candidates carry this row; the fixture is stale. One row per seeded candidate was
inserted **into the local test database only**, with `searchableByRecruiters = true`, to
make the environment faithful to production. No application code, schema or production
data was touched. Without it the search returns zero and no persistence question can be
asked at all.

**2. The test ran on `master`, not the checked-out branch.** The working tree was on
`feat/talent-request-persistence`, whose un-merged T-040 code selects `name`,
`firstSeenAt`, `viewedAt` and `decision`. The first attempt crashed with
`Unknown field 'name' for select statement on model 'TalentRequest'`. T-022 is a question
about shipped behaviour, so the tree was moved to `master`, the local DB re-pushed from
`master`'s schema (confirmed: 0 of the three T-040 columns present), the aborted request
deleted, and the journey restarted from scratch.

## Exact Journey

1. Signed in at `/login` as `recruiter@hire.abtalks.dev` / `test`. (The Sign in button is
   disabled until the Terms checkbox is ticked.) Landed on `/dashboard`.
2. Opened `/hire`, clicked the role chip **Backend engineer**, then answered Scout until
   it searched.
3. Search ran. Request created: `cmtqw89dt00010e9xej8ym26h`, title `Backend engineer`,
   status `MATCHED`, `mustHaveStack = {}`.
4. **3 candidates returned:** `AB-6267` (70, PARTIAL), `AB-9533` (58, PARTIAL),
   `AB-9840` (54, PARTIAL). Scout reported *"Found 3 candidate(s); 3 are partial.
   Searched 3 opted-in candidate(s)."*
5. **Viewed** `AB-6267` via **View more details** — the inspector opened.
6. **Shortlisted** `AB-6267` via **Add to Shortlist** → button became **In Shortlist**,
   header badge **Shortlist 1**.
7. Also clicked **Save for later** on `AB-6267` → header badge **Save for Later 1**.
8. **Note: no UI exists.** The only `textarea` on the entire desk is Scout's
   `"Type your answer, or ask me anything..."`. Zero occurrences of the word "note".
9. State before leaving — DB: 1 request, 3 matches (all `createdAt` = `07:02:38.146`),
   1 `RecruiterShortlistItem` with `note = NULL`. localStorage:
   `["abtalks-hire-evidence","abtalks-hire-star"]`, the star holding `AB-6267`.
10. Signed out. Session `null`. **localStorage survived the sign-out** —
    `["abtalks-hire-evidence","abtalks-hire-star"]` still present.
11. Switched to a **separate Chrome profile** (`profileB`, its own `--user-data-dir`),
    confirmed `localStorage` was `[]` at start, and signed back in as the same recruiter.
12. Returned to `/hire`.

## Persistence Matrix

| Recruiter work | Before leaving | After return (clean profile) | Verdict |
|---|---|---|---|
| Search criteria | `Backend engineer`, request `cmtqw89dt…`, status MATCHED | Restored in full — chat history and criteria | **PERSISTED IN DB** |
| Matched candidates | AB-6267 (70), AB-9533 (58), AB-9840 (54) | Same 3, same scores, same order | **PERSISTED IN DB** |
| Viewed candidate | AB-6267 opened via *View more details* | **No marker of any kind.** Regex for `viewed\|seen\|new since\|unseen` across the whole page: `[]`. AB-6267 is indistinguishable from the two never opened. | **NOT PERSISTED** |
| Shortlist | *In Shortlist*, header badge **Shortlist 1** | **Survived** — AB-6267 still reads *In Shortlist*, badge still **1** | **PERSISTED IN DB** |
| Save for Later | header badge **Save for Later 1**, star in localStorage | **Lost.** Badge gone, panel empty (0 AB refs), `abtalks-hire-star` = `null` | **localStorage ONLY** |
| Candidate note | — | — | **UNAVAILABLE — no UI on the recruiter desk** |
| Search identity / name | Shown as `Backend engineer` (= `title`) | Same. No user-supplied name exists | **NOT PERSISTED** (no field) |
| Route back to the search | — | Present, but **only inside the `Requirement ▾` dropdown**, under a heading *"PICK UP WHERE YOU LEFT OFF"* → `Backend engineer / MATCHED · 2026-09-07`. `/hire` itself renders **"Not started"** and *"Ranked profiles appear here once you search."* The only `/hire/*` link on the page is `Open requests`. | **PERSISTED but nearly hidden** |

## Code Correlation

Observations first, code second. Each row explains the behaviour actually seen.

### Criteria — PERSISTED
- **File:** [src/app/hire/page.tsx:20](../../src/app/hire/page.tsx#L20), [:26](../../src/app/hire/page.tsx#L26)
- **Table/field:** `TalentRequest`, 20 scalar columns (`schema.prisma:1092`)
- **Read path:** `talentRequest.findMany({ where: { recruiterUserId }, take: 8 })` → passed
  to `ScoutChat` as `recent`, rendered as *"PICK UP WHERE YOU LEFT OFF"*
- **Why observed:** the row is keyed on `recruiterUserId` and the gate
  `persist = recruiter.status === "approved"` was satisfied — the fixture recruiter is
  seeded `approved: true` ([seed-hire-fixtures.ts:222](../../prisma/seed-hire-fixtures.ts#L222)).

### Matched candidates — PERSISTED, history not
- **File:** [src/app/actions/hire-actions.ts:378](../../src/app/actions/hire-actions.ts#L378), [:403](../../src/app/actions/hire-actions.ts#L403)
- **Table:** `TalentRequestMatch` (`schema.prisma:1180`)
- **Why observed:** rows are written by one `createMany`, so they survive and re-render.
  **Local DB confirms the mechanism directly: 3 rows, `count(distinct createdAt) = 1`.**
  The same signature seen in production (20 rows, one timestamp) is reproduced here from
  a single clean run — it is the write shape, not an artefact of production history.

### Viewed state — NOT PERSISTED
- **File:** none exists.
- **Why observed:** `TalentRequestMatch` has no viewed column, and no code writes one.
  Nothing recorded the inspector opening, so nothing could be shown on return.

### Shortlist — PERSISTED IN DB, *for this candidate*
- **File:** [src/components/talent/shortlist-button.tsx:58](../../src/components/talent/shortlist-button.tsx#L58) → [talent-actions.ts:77](../../src/app/actions/talent-actions.ts#L77)
- **Table:** `RecruiterShortlistItem` (`schema.prisma:1041`), FK `memberId` → `ProgramMember`
- **Why observed:** `const useDb = Boolean(approved && programMemberId)` was **true** — the
  seeded candidates are PROGRAM members and the recruiter is approved. Local DB after the
  test: 1 row, `memberId = cmtqvucjg…`, `note = NULL`.
- **The limit this test could not exercise:** all three fixtures are PROGRAM. For
  CLAUDE / CHALLENGE_60 / HACKATHON candidates `programMemberId` is null, `useDb` is
  false, and the same button writes to `localStorage` instead
  ([:93](../../src/components/talent/shortlist-button.tsx#L93)). `RecruiterShortlistItem.memberId`
  is an FK to `ProgramMember`, so it structurally cannot hold them.

### Save for Later — localStorage ONLY
- **File:** [src/components/hire/desk-shortlist.ts:4](../../src/components/hire/desk-shortlist.ts#L4) (`abtalks-hire-star`, cap 40 at [:89](../../src/components/hire/desk-shortlist.ts#L89))
- **Why observed:** never written to the database and never merged on sign-in —
  `MergeGuestCart` ([hire/layout.tsx:59](../../src/app/hire/layout.tsx#L59)) merges the
  *cart*, not the star. The component says so itself:
  *"It stays device-local on purpose"* ([hire-saved-later.tsx:91](../../src/components/hire/hire-saved-later.tsx#L91)).
- **This is the trap `114-A` warned about, now demonstrated:** the star survived sign-out
  in profile A and vanished in profile B. A same-profile test would have reported it as
  persistent.

### Note — UNAVAILABLE
- **File:** [src/components/talent/shortlist-note-form.tsx](../../src/components/talent/shortlist-note-form.tsx), rendered only at [/talent/members/[id]/page.tsx:112](../../src/app/talent/members/[id]/page.tsx#L112)
- **Why observed:** no `/hire` surface imports it. Step 7 of the journey could not be
  performed because the action does not exist on the desk.

## Verification of the previous finding

> *"TalentRequest is a saved SEARCH, not a persistent PROJECT."*

**Confirmed by the product test, with one correction.**

What came back: the question, the conversation, and the answer — criteria, Scout history,
3 ranked candidates, and the DB-backed shortlist flag on the one program candidate.

What did not: which candidate had been opened (no record exists), the Save-for-Later list
(device-local, gone), any note (no UI), and any name for the search beyond the role title.
There is no "what changed since last time" — the local DB reproduced the single-timestamp
bulk insert from one clean run, so there is no prior state to diff against.

**The correction:** `114` said the recent list is surfaced on `/hire`. It is, but it is
buried inside a dropdown labelled `Requirement ▾` under *"PICK UP WHERE YOU LEFT OFF"*,
while the page body says **"Not started"** and *"Ranked profiles appear here once you
search."* A returning recruiter is shown an empty desk. The work is in the database and
the door back to it is not where the eye lands.

**Corrections to `113`, now confirmed by product observation rather than code reading:**
`113` recorded shortlist and notes as persisting. Notes cannot be written from the desk at
all. Shortlist splits: DB for program members (observed surviving), `localStorage` for the
other three tracks (not exercisable with the current fixtures). Save for Later — which
`113` did not mention — is purely device-local and was observed being lost.

## Final T-022 Verdict

**PARTIAL.**

The journey was completed end to end and every required item has a written answer backed
by code and by observed database state. Two required items could not be answered as
specified, and neither can be fixed inside P1:

1. **Candidate note — the action does not exist.** Step 7 is not implementable on the
   recruiter desk. This is a finding, not a gap in the test.
2. **Shortlist was exercised for PROGRAM candidates only.** All three fixtures are
   program members, so the DB branch was tested and the `localStorage` branch — which
   covers three of the four candidate tracks — was not. The verdict "shortlist persists"
   is proven **only** for program members.

Also recorded: the fixture required a `CandidateVisibility` row that
`seed-hire-fixtures.ts` does not create. Repairing that seed is a code change and was not
made.

**Not done, deliberately:** no `TalentRequestMatch` upsert, no context-save work, no
notification work, no schema change, no migration, no production write, no fix to
anything discovered.
