# 117 — T-022 final control test

**Investigation only.** No code, schema, migration, seed, cleanup, deletion, commit or
push. Production read-only. All writes went to the local test DB `abtalks_t022`, target
verified before each command.

---

## 1. Environment

| | |
|---|---|
| branch | `feat/talent-request-persistence` |
| commit | `58d26b63f72abde706b4024c0de4856f3b54cb17` |
| git status | clean except untracked `docs/plans/106-hire-search-correctness.md` |
| `DATABASE_URL` (`.env.local`) | `postgresql://***@ep-young-shadow-amawetjy-pooler…/neondb` — PRODUCTION, read-only |
| test DB used | `postgresql://***@localhost:5432/abtalks_t022` |
| `NODE_ENV` | unset (development) |
| app under test | `next dev` on `localhost:3000`, pid 50916, serving this branch |
| **production modified?** | **NO** — `3 requests / 15 messages / 40 matches / 0 shortlist / 12,805 users`, unchanged before and after |

---

## 2. Finding a real candidate — BLOCKED

**The primary experiment as specified cannot be run. There is no ordinary candidate in the
local test database, and creating one is forbidden by the brief.**

Every user in `abtalks_t022`:

```
cmtqvucjb0  strong@hire.abtalks.dev       Scout Strong      STUDENT    visibility ✓ searchable ✓
cmtqvuckr0  narrow@hire.abtalks.dev       Scout Narrow      STUDENT    visibility ✓ searchable ✓
cmtqvucl00  consistent@hire.abtalks.dev   Scout Consistent  STUDENT    visibility ✓ searchable ✓
cmtqvuclc0  recruiter@hire.abtalks.dev    Hire Recruiter    RECRUITER  —
cmtqy82d30  shashankmishra00026@gmail.com shanky            RECRUITER  —
```

```
ProgramMember 3 · StudentProfile 0 · CandidateProfile 0 · HackathonParticipant 0
```

Three candidates, all QA fixtures, all PROGRAM. The only database holding ordinary
candidates is production, which is read-only and cannot be searched against.

**What was done instead.** Two questions the brief wanted a real candidate for can be
settled deterministically from code, and were:

### 2a. Does the candidate change whether a match persists? **No.**

The only candidate-dependent gate on persistence is `persistableSource`
([track-loaders.ts:49](../../src/features/hire/track-loaders.ts#L49)):

```ts
const hit = (Object.values(TalentCandidateSource) as string[]).includes(slug);
return hit ? (slug as TalentCandidateSource) : null;
```

`enum TalentCandidateSource { PROGRAM CHALLENGE_60 CLAUDE HACKATHON }`
(`schema.prisma:3217`) contains all four tracks, so the function returns non-null for every
one. **Match persistence is candidate-agnostic.** The fixture result generalises.

### 2b. Does the candidate change which shortlist branch runs? **Yes — decisively.**

`useDb = Boolean(approved && programMemberId)`
([shortlist-button.tsx:58](../../src/components/talent/shortlist-button.tsx#L58)), and
`programMemberId` is set by the track loader:

| Track | `programMemberId` | Source | `useDb` |
|---|---|---|---|
| PROGRAM | `m.id` | [dossier.ts:297](../../src/features/hire/dossier.ts#L297) | **true → DB** |
| CLAUDE | `null` | [challenge-dossier.ts:269](../../src/features/hire/challenge-dossier.ts#L269) | **false → localStorage** |
| CHALLENGE_60 | `null` | same loader | **false → localStorage** |
| HACKATHON | `null` | [hackathon-dossier.ts:53](../../src/features/hire/hackathon-dossier.ts#L53) | **false → localStorage** |

**The shortlist result does NOT generalise.** For three of the four tracks the DB branch is
unreachable by construction — `programMemberId` is hardcoded `null`, so `useDb` can never
be true. This is proven from code, and would have been proven by a real non-PROGRAM
candidate had one existed.

Because of 2a and 2b, the control test below was run with the fixtures, and every result
is labelled with whether it generalises.

---

## 3. Proving this was a normal search, not guest state

The previous test's candidates came from guest state. This one did not.

```
UI /hire (signed in)  →  sendScoutMessageAction  →  runMatchAction
                       →  $transaction([deleteMany(notIn), upsert…])
                       →  TalentRequestMatch rows
```

Evidence, for request `cmtr6y4fp000b0eacxqb5xxz1`:

| Signal | This test | The previous (guest) test |
|---|---|---|
| `localStorage` at sign-in | `[]` | held `abtalks-hire-guest-matches` |
| `abtalks-hire-guest-matches` present | **false** | true |
| messages / distinct timestamps | **3 / 3** | 6 / **1** |
| `matches` rows | **3** | **0** |
| `updatedAt` vs `createdAt` | 12:02:41 vs 12:02:34 (differs) | identical |

Three distinct message timestamps mean three separate writes through the live path. One
timestamp for six messages means a single `createMany` — the adoption path. This request
went through the normal flow.

---

## 4-5. Two-browser test and database verification

**Browser A** — fresh profile D, `localStorage []` at start, signed in as
`recruiter@hire.abtalks.dev`, search run, candidate `AB-9840` (Scout Consistent) opened,
shortlisted, saved for later, and one chat message sent.

**Browser B** — fresh profile E, own `--user-data-dir`, `localStorage []` verified before
sign-in, same account, same request opened, then refreshed.

### Database after Browser A (read-only)

```
TalentRequest   cmtr6y4fp000b0eacxqb5xxz1  "Backend engineer"  MATCHED
                created 12:02:34.355   updated 12:05:56.319   mustHaveStack {}

TalentRequestMatch
  cmtr6ya4n000h  cmtqvucjb0  70  firstSeenAt 12:02:41.729  viewedAt NULL  UNDECIDED
  cmtr6ya4o000j  cmtqvuckr0  58  firstSeenAt 12:02:41.729  viewedAt NULL  UNDECIDED
  cmtr6ya4o000l  cmtqvucl00  54  firstSeenAt 12:02:41.729  viewedAt NULL  UNDECIDED

TalentRequestMessage  (6 rows, all distinct timestamps)
  cmtr72fft000  user  "FORENSIC-T022 control message"   12:05:55.242
  cmtr72ga8001  assistant "Got it. How can I help you…"  12:05:56.337

RecruiterShortlistItem
  cmtr72bxg000  recruiter@hire.abtalks.dev → Scout Consistent  12:05:50.693

Save for Later — no DB row. No table in the schema matches saved/later/star.
                 localStorage "abtalks-hire-star" holds the whole card:
                 [{"candidateRef":"PROGRAM:cmtqvucl1001f0e44fsszznhg","displayName":"Scout Consistent",…}]
```

### Browser B result

| Check | Result |
|---|---|
| candidates present | `AB-6267, AB-9533, AB-9840` — **same three** |
| same order | yes |
| same scores | `70, 58, 54` — yes |
| chat control message visible | **YES** |
| shortlist | header **Shortlist 2**; per-card *In Shortlist* on both shortlisted candidates |
| Save for Later | header badge **has no count**; `abtalks-hire-star` = `null` |
| viewed state | regex `viewed\|seen\|new since\|unseen` → `[]` |
| `localStorage` | `["abtalks-hire-evidence"]` only |
| after refresh | identical on every line |

---

## 6. Does normal recruiter search persist matches? **YES**

Proven, not inferred. A signed-in search created three `TalentRequestMatch` rows at
`12:02:41.729`, and Browser B rendered them from the database with `localStorage` empty.

Write path:

```
runMatchAction                        hire-actions.ts:318
  searchCandidates(spec, {limit:20})  :363
  persistable = filter(persistableSource)  :381
  $transaction([                      :443
    deleteMany({ candidateUserId: { notIn: kept } }),
    ...rows.map(upsert({ where: requestId_candidateUserId, create, update: scoring }))
  ])                                  :449-455
  talentRequest.update({ status })    :463
```

The earlier "matches don't persist" observation was **not** a property of search. It was a
property of the **guest-adoption** path, which never calls `runMatchAction`.

---

## 7. Rerun — end to end through the UI

The same search was re-run from the request page (the `Search` button), and the rows
compared before and after:

```
BEFORE                         AFTER
cmtr6ya4n000h0eac5xmk6bio  →   cmtr6ya4n000h0eac5xmk6bio
cmtr6ya4o000j0eac6e7wg6sa  →   cmtr6ya4o000j0eac6e7wg6sa
cmtr6ya4o000l0eac6oapkcos  →   cmtr6ya4o000l0eac6oapkcos
firstSeenAt 12:02:41.729   →   firstSeenAt 12:02:41.729

row IDs: IDENTICAL — rows preserved (UPSERT)
```

**This branch: UPSERT.** Master: `deleteMany` (all) + `createMany`
(`hire-actions.ts:378`/`:403` on `99f79b07`), which would have produced new row ids and a
new `createdAt`.

This is the first end-to-end execution of T-044 through the real action rather than a
DB-level script.

---

## 8. Viewed

Browser A opened `AB-9840` through *View more details*; the inspector rendered.

Database immediately afterwards: `viewedAt` **NULL** on all three rows, `decision`
`UNDECIDED`. Browser B: no marker of any kind.

No write exists. `viewedAt` appears in `src/` only as a `select` at
[load-request-matches.ts:85](../../src/features/hire/load-request-matches.ts#L85) and a
passthrough at :225. Repo-wide, **`viewedAt`, `lastViewedAt`, `archivedAt` and
`firstSeenAt` are never assigned anywhere**; `firstSeenAt` is populated only by its column
default. No `localStorage` or `sessionStorage` key records viewing either.

---

## 9. Shortlist

```
ShortlistButton  → useDb = Boolean(approved && programMemberId)     :58
  true  → toggleShortlistAction  (talent-actions.ts:77)
        → toggleShortlist(userId, memberId)
        → RecruiterShortlistItem (@@unique[recruiterUserId, memberId])
        → read via listProgramMemberLabels({shortlistedByRecruiterUserId})
        → UI "In Shortlist"
  false → toggleGuestCart()      :93  → localStorage "abtalks-hire-cart" (cap 25)
```

The tested candidate took the **PROGRAM DB branch** — as every candidate in this database
must, since all three are `ProgramMember` rows. Scoped **per recruiter × program member**;
not per organization, **not per TalentRequest**, and keyed on a `ProgramMember` id rather
than a `User` id.

**The previous shortlist result does not generalise**, for the reason proven in §2b: for
CLAUDE / CHALLENGE_60 / HACKATHON, `programMemberId` is hardcoded `null`, so `useDb` is
always false and the write goes to `localStorage`. That branch remains **untested** because
no such candidate exists locally.

---

## 10. Save for Later

```
DeskShortlistButton → toggleDeskShortlist()  desk-shortlist.ts:83
                    → localStorage "abtalks-hire-star" (cap 40)  :4, :89
                    → read readDeskShortlist()  :54  → HireSavedLater panel + header count
```

- **Write location:** `localStorage` only. No server action; no table in the schema matches
  `saved`/`later`/`star`.
- **Read location:** the same key, so Browser B finds nothing.
- **Cross-browser:** lost. `star = null` in Browser B, header count absent.
- **Not merged at sign-in.** `MergeGuestCart`
  ([merge-guest-cart.tsx:68](../../src/components/hire/merge-guest-cart.tsx#L68)) reads
  `readGuestCart()` (`abtalks-hire-cart`) only. `readDeskShortlist()` is never called there.

**Intent — evidence beyond the code comment.** The comment at
[hire-saved-later.tsx:91](../../src/components/hire/hire-saved-later.tsx#L91) says it is
device-local on purpose. Three independent signals agree: no table was ever modelled for
it; the merge routine deliberately handles the cart and not the star; and the panel's own
UI copy says *"A private holding list on this device."* Taken together this is a **product
decision, not an oversight** — but it is a decision the R3 brief has not been checked
against, and the header badge gives the recruiter no warning before the list disappears.

---

## 11. Chat

```
A: textarea → sendScoutMessageAction  :167
     :243 talentRequestMessage.create (user)     ← "FORENSIC-T022 control message" 12:05:55.242
     :254 runScoutTurn (Groq)
     :264 talentRequest.update
     :283 talentRequestMessage.create (assistant) 12:05:56.337
B: /hire/[requestId] → loadRequestMatches / request.messages ordered by createdAt → rendered
```

Browser B, `localStorage []`: the control message **is visible**, and remains visible after
a refresh. Chat persists for an ordinary signed-in search exactly as it did for the fixture
test.

---

## 12. Guest adoption — what it does and does not adopt

[`adoptGuestScoutSessionAction`](../../src/app/actions/hire-actions.ts#L664):

```ts
const created = await prisma.$transaction(async (tx) => {
  const row = await tx.talentRequest.create({
    data: { recruiterUserId: userId,
            status: searched ? TalentRequestStatus.MATCHED : TalentRequestStatus.DRAFT,
            ...dbFields, extra: dbFields.extra ?? Prisma.JsonNull },
    select: { id: true },
  });
  await tx.talentRequestMessage.createMany({ data: messages.map(...) });
  return row;
});
```

| Adopted | Not adopted |
|---|---|
| `TalentRequest` + criteria | **`TalentRequestMatch` — no write of any kind** |
| all messages, one `createMany` | the guest match list (`abtalks-hire-guest-matches`) |
| the cart, separately, by `mergeGuestCartAction` before this call | the star (`abtalks-hire-star`) |

**Why three candidates before logout and zero matches after login:**

```
guest runs Scout            → results held in localStorage abtalks-hire-guest-matches
                              (UI renders from that store — 3 candidates visible)
guest signs in              → MergeGuestCart:
                                readGuestCart()    → mergeGuestCartAction  → 1 shortlist row
                                readGuestSession() → adoptGuestScoutSessionAction
                                                     → TalentRequest (status MATCHED)
                                                     → 6 messages, one createMany
                                                     → NO match rows
new browser                 → localStorage empty
                              → guest match store gone
                              → DB has 0 matches
                              → "No matches yet", while the stored assistant line still
                                 reads "Found 3 candidate(s)"
```

Both of the user's requests show the signature exactly: `msgs=6`, one distinct timestamp,
`matches=0`, `updatedAt == createdAt`.

---

## 13. Final comparison

| Feature | QA fixture candidate | Real candidate | Cross-browser | DB persisted? | Root cause |
|---|---|---|---|---|---|
| Search criteria | survives | *untestable — none exists locally*; path is candidate-agnostic | survives | YES | `TalentRequest` keyed on `recruiterUserId` |
| Search result / match | 3 rows written and re-read | *untestable*; **generalises** — `persistableSource` accepts all four tracks | survives | YES | `runMatchAction` upsert |
| Viewed | no write | *untestable*; **generalises** — no writer exists at all | lost | NO | no code assigns `viewedAt` |
| Shortlist | DB row, survived | *untestable*; **does NOT generalise** — non-PROGRAM is `localStorage` by construction | survives (PROGRAM only) | YES for PROGRAM | `useDb = approved && programMemberId` |
| Save for Later | lost | *untestable*; **generalises** — no DB path exists for any track | lost | NO | `localStorage abtalks-hire-star`, never merged |
| Chat | visible in Browser B | *untestable*; **generalises** — messages are per-request, not per-candidate | survives | YES | `TalentRequestMessage` |

**Fixture and real candidate behave identically for everything except shortlist**, and the
difference there is proven from code rather than assumed: `programMemberId` is `null` for
three of the four tracks, so the DB branch cannot execute for them.

---

## 14. T-022 final verdict

### CONFIRMED (code + DB + fresh-browser evidence)

- A normal signed-in search **does** create `TalentRequestMatch` rows.
- On this branch a re-run **upserts**: identical row ids and `firstSeenAt` after a real UI
  re-run.
- Chat persists and is re-read in a fresh browser.
- The DB shortlist persists across browsers for PROGRAM candidates.
- Save for Later is `localStorage` only and is never merged at sign-in.
- Viewed state has no writer anywhere in `src/`.
- `adoptGuestScoutSessionAction` writes no match rows.

### PERSISTED (survives a fresh browser)

Search criteria · matched candidates · chat · shortlist (PROGRAM)

### NOT PERSISTED

Viewed state · Save for Later · search name (no field) · matches created via guest adoption

### FIXTURE / TEST ARTIFACT

- Scout Strong / Narrow / Consistent — `db:seed:hire`, local only; production has zero.
- The earlier "candidates vanished" observation — guest state, not a search failure.
- `firstSeenAt 13:03:34` on the oldest rows — the column's default at `db push` time.

### STILL UNPROVEN

- The **non-PROGRAM shortlist branch** (CLAUDE / CHALLENGE_60 / HACKATHON) has never been
  executed. Its behaviour is derived from code, not observed.
- Whether `DIRECT_URL` is a different Neon branch.
- Whether the user's guest session began signed-out or pre-approval.

**Verdict: PARTIAL.** Everything the brief asked about is now answered for PROGRAM
candidates with direct evidence, and the two candidate-dependent questions are settled from
code. It is not COMPLETE because no ordinary candidate exists in any writable environment,
so the non-PROGRAM shortlist path remains untested, and the desk still has no note UI.

---

## 15. T-040 / T-044 — model versus feature

| Claim | Status |
|---|---|
| stable `TalentRequestMatch` identity | **SOLVED** — `@@unique([requestId, candidateUserId])` present and used by the upsert |
| rerun preservation | **SOLVED** — measured end to end in §7 |
| `firstSeenAt` exists and survives a rerun | **SOLVED** |
| `viewedAt` / `decision` columns exist | **SOLVED** |

**What it does NOT do — the distinction that matters:**

| Does the feature actually write/read it? | |
|---|---|
| writes `viewedAt` | **NO** — no assignment anywhere; opening a candidate wrote nothing (§8) |
| writes `lastViewedAt` | **NO** — never assigned; nothing marks a request as visited |
| writes `decision` | **NO** — no UI sets it; every row stays `UNDECIDED` |
| persists guest-adopted matches | **NO** — `adoptGuestScoutSessionAction` unchanged (§12) |
| persists Save for Later | **NO** — untouched |
| unifies the shortlist | **NO** — the PROGRAM/localStorage split is untouched |
| restores the search / fixes navigation | **NO** — `/hire` still opens on "Not started" |

**T-040/T-044 build the place to keep match state and stop it being destroyed on re-run.
Nothing yet puts anything in it.** Every "column exists" above is real; every "feature
works" below it is not yet true. Wiring the writers is separate work (T-045 and beyond) and
is not in this PR.

---

## Reproduction notes

- Production: `SELECT` only; counts identical before and after.
- Local writes: one `TalentRequest` (`cmtr6y4fp000b0eacxqb5xxz1`) with 3 matches and 6
  messages, one `RecruiterShortlistItem` (Scout Consistent), created by the control test.
  Plus the earlier scratch row `cmtr674tn00010euc78fajbkp`. **Nothing was deleted or
  updated.**
- Browsers: Chrome `--headless=new`, separate `--user-data-dir` per role, `localStorage`
  verified `[]` before each sign-in.
- The user's `next dev` on port 3000 was used read/write for the test and left running.
