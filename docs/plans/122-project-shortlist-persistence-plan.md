# 122 — PLAN A: project + shortlist persistence

**Status: DRAFT FOR REVIEW. Not signed, not approved, not started.**
Branch `feat/talent-request-persistence` @ `58d26b63`. Investigation only — no code, no
schema, no migration, no production write. Every reference verified at this commit.

> **No recruiter loses a saved candidate.**
>
> That is the acceptance bar for this plan, and §6 is how it is proved rather than
> asserted.

---

## 1. Current state

### 1.1 The project object

**`TalentRequest` ([schema.prisma:1092](../../prisma/schema.prisma#L1092)) is the recruiter's
project, and it stays.** No parallel `Project` model is proposed. It is created by
`sendScoutMessageAction` ([hire-actions.ts:167](../../src/app/actions/hire-actions.ts#L167))
and by `adoptGuestScoutSessionAction` ([:664](../../src/app/actions/hire-actions.ts#L664)),
listed by [hire/page.tsx:26](../../src/app/hire/page.tsx#L26), and read with its matches by
[load-request-matches.ts](../../src/features/hire/load-request-matches.ts).

Scoped **per recruiter**: `recruiterUserId`. Not org-scoped.

### 1.2 Every place a saved candidate can live today — there are five

| # | Store | Where | Scope | Production rows |
|---|---|---|---|---|
| 1 | `RecruiterShortlistItem` | [schema.prisma:1041](../../prisma/schema.prisma#L1041) | recruiter × **ProgramMember** | **0** |
| 2 | desk star ("Save for Later") | `localStorage abtalks-hire-star`, [desk-shortlist.ts:4](../../src/components/hire/desk-shortlist.ts#L4), cap 40 | device | n/a |
| 3 | cart (non-program) | `localStorage abtalks-hire-cart`, [guest-cart.ts:8](../../src/components/hire/guest-cart.ts#L8), cap 25 | device | n/a |
| 4 | `TalentRequestMatch` | [schema.prisma:1180](../../prisma/schema.prisma#L1180) | request × candidate | 40 |
| 5 | guest search cache | `localStorage abtalks-hire-guest-matches` | device, pre-auth | n/a |

### 1.3 Which one the recruiter desk actually uses — both, split by track

[shortlist-button.tsx:58](../../src/components/talent/shortlist-button.tsx#L58):

```ts
const useDb = Boolean(approved && programMemberId);
```

`programMemberId` is set only by the PROGRAM loader
([dossier.ts:297](../../src/features/hire/dossier.ts#L297)); the challenge and hackathon
loaders hardcode `null`
([challenge-dossier.ts:269](../../src/features/hire/challenge-dossier.ts#L269),
[hackathon-dossier.ts:53](../../src/features/hire/hackathon-dossier.ts#L53)).

**So the DB branch is unreachable for CLAUDE, CHALLENGE_60 and HACKATHON — by
construction, not by configuration.** Three of the four candidate tracks can only ever be
saved to `localStorage`.

### 1.4 Infrastructure that already exists and is unused

| Model | Line | `prisma.*` usages in `src/` | Production rows |
|---|---|---|---|
| `TalentList` | [3022](../../prisma/schema.prisma#L3022) | **0** | **0** |
| `TalentListItem` | [3043](../../prisma/schema.prisma#L3043) | **0** | **0** |
| `CandidateNote` | [3064](../../prisma/schema.prisma#L3064) | **0** | **0** |
| `Organization` | [2978](../../prisma/schema.prisma#L2978) | 1 (write only) | 4 |
| `OrganizationMember` | ~3000 | 1 (write only) | — |
| `RecruiterShortlistItem` | [1041](../../prisma/schema.prisma#L1041) | 12 | **0** |

`TalentListItem` is already keyed on `candidateUserId` (a `User`, not a membership),
already carries `PipelineStage` and a `candidateLabel` deletion tombstone, and is already
`@@unique([talentListId, candidateUserId])`. `Organization` and `OrganizationMember` are
written by [provision-recruiter.ts:39](../../src/features/hire/provision-recruiter.ts#L39)
and **never read by the hire flow**.

### 1.5 Read/write paths that would be touched

**Writes**
- [shortlist-button.tsx:97](../../src/components/talent/shortlist-button.tsx#L97) → `toggleShortlistAction` ([talent-actions.ts:77](../../src/app/actions/talent-actions.ts#L77))
- [shortlist-button.tsx:93](../../src/components/talent/shortlist-button.tsx#L93) → `toggleGuestCart` (localStorage)
- [talent-actions.ts:104](../../src/app/actions/talent-actions.ts#L104) `updateShortlistNoteAction`
- [talent-actions.ts:142](../../src/app/actions/talent-actions.ts#L142) `mergeGuestCartAction`
- [desk-shortlist.ts:83](../../src/components/hire/desk-shortlist.ts#L83) `toggleDeskShortlist`

**Reads**
- [load-request-matches.ts](../../src/features/hire/load-request-matches.ts) → `listProgramMemberLabels({ shortlistedByRecruiterUserId })` → `match.shortlisted`
- `/talent/shortlist`, `/talent/members/[id]` (the program portal)
- `/hire` layout cart count
- [hire-saved-later.tsx](../../src/components/hire/hire-saved-later.tsx) → `readDeskShortlist()`

---

## 2. Proposed state

**Extend, do not duplicate.**

| Concern | Today | Proposed |
|---|---|---|
| Project | `TalentRequest` | **unchanged** — it is already the project |
| Durable shortlist | `RecruiterShortlistItem` (ProgramMember FK) | **`TalentList` + `TalentListItem`** (`User` FK, org-scoped, `PipelineStage`) |
| Notes | `RecruiterShortlistItem.note`, one per (recruiter, member) | **`CandidateNote`** — org-scoped, many per candidate |
| Save for Later (star) | localStorage | **unchanged in this plan** — §9 |
| Per-match state | `TalentRequestMatch` | **unchanged** — PR #254 owns it |

**Why not extend `RecruiterShortlistItem`.** `memberId` is a required FK to `ProgramMember`
([schema.prisma:1048](../../prisma/schema.prisma#L1048)). Three of the four candidate tracks
have no `ProgramMember` row at all, so no column addition makes them representable. It also
has no `requestId`, so it can never be per-project. It is a dead end, and the plan does not
extend it.

**Scoping decision required (§10, decision 1):** `TalentList` is keyed on
`organizationId`. Recruiters are attached to organisations only by
`OrganizationMember`, which nothing reads. Either the hire flow starts resolving the
recruiter's organisation, or `TalentList.ownerRecruiterId` carries it per-recruiter with
`isSharedWithOrg = false`. **Not decided here.**

---

## 3. Migration design

### 3.1 Source → destination

| | |
|---|---|
| **Source** | `RecruiterShortlistItem(id, recruiterUserId, memberId, note, createdAt)` |
| **Destination** | `TalentListItem(talentListId, candidateUserId, candidateLabel, stage, addedByUserId, addedAt)` + `CandidateNote(organizationId, candidateUserId, authorUserId, body)` |

### 3.2 Row mapping

```
RecruiterShortlistItem                 TalentListItem
  recruiterUserId          ───────►      addedByUserId
  memberId → ProgramMember.userId ────►  candidateUserId     (resolve the membership to a person)
  (recruiter's default list)  ───────►   talentListId        (created per recruiter, see below)
  createdAt                ───────►      addedAt
  —                        ───────►      stage = SHORTLISTED (the model default)
  —                        ───────►      candidateLabel = the candidate's display name at migration time

  note (when not null)     ───────►    CandidateNote.body
  recruiterUserId          ───────►    CandidateNote.authorUserId
  memberId → ProgramMember.userId ──►  CandidateNote.candidateUserId
```

One `TalentList` per recruiter, `@@unique([organizationId, name])`, created idempotently
with a deterministic name (proposed: `"Shortlist"`), `ownerRecruiterId` = the recruiter's
`RecruiterProfile.id`, `isSharedWithOrg = false` until decision 1 says otherwise.

### 3.3 Duplicates

`TalentListItem` already has `@@unique([talentListId, candidateUserId])`. Two
`RecruiterShortlistItem` rows can collapse into one item when two `ProgramMember` rows
belong to the same `User` (the same person in two cohorts). **This is a real collapse, and
it must be counted, not hidden** — see the invariant in §4.

### 3.4 Detecting already-migrated rows

No new column. Migration is a set difference:

```sql
SELECT s.id
FROM "RecruiterShortlistItem" s
JOIN "ProgramMember" pm ON pm.id = s."memberId"
WHERE NOT EXISTS (
  SELECT 1 FROM "TalentListItem" i
  JOIN "TalentList" l ON l.id = i."talentListId"
  WHERE i."candidateUserId" = pm."userId"
    AND i."addedByUserId"   = s."recruiterUserId"
);
```

Empty result ⇒ fully migrated. This is what makes the script rerunnable.

### 3.5 Failure part-way, and rerun

Batched with `INSERT … ON CONFLICT DO NOTHING`, no transaction spanning the whole run —
a half-finished run leaves a correct partial state, and the §3.4 query names exactly what
is left. **Rerunning is safe by construction**, because every write is conflict-tolerant
and the source is never mutated.

---

## 4. Before / after counts

Derived from the schema, not invented. Run all three against the same database.

**Before**

```sql
-- B1  source rows
SELECT COUNT(*) FROM "RecruiterShortlistItem";
-- B2  distinct (recruiter, person) pairs — the true number of saved candidates
SELECT COUNT(*) FROM (
  SELECT DISTINCT s."recruiterUserId", pm."userId"
  FROM "RecruiterShortlistItem" s JOIN "ProgramMember" pm ON pm.id = s."memberId") t;
-- B3  notes to carry
SELECT COUNT(*) FROM "RecruiterShortlistItem" WHERE note IS NOT NULL;
```

**After**

```sql
-- A1  migrated items
SELECT COUNT(*) FROM "TalentListItem" i
JOIN "TalentList" l ON l.id = i."talentListId" WHERE l.name = 'Shortlist';
-- A2  notes carried
SELECT COUNT(*) FROM "CandidateNote";
-- A3  anything left behind (must be 0)  -- the §3.4 query, wrapped in COUNT(*)
```

**Invariant**

```
A1 == B2        every saved (recruiter, person) pair exists in the new model
A2 == B3        every note carried
A3 == 0         nothing left behind
B1 >= B2        the difference is the duplicate collapse of §3.3, and must be reported
```

**`B1 > B2` is not a failure, but it must never be silent.** If it is non-zero the run
prints each collapsed pair so a human can confirm it is the same person twice, and not a
mapping bug.

### Today's production numbers, read-only

```
RecruiterShortlistItem   0      (with a note: 0)
TalentList               0
TalentListItem           0
CandidateNote            0
Organization             4
```

**The source table is empty in production.** So today `B1 = B2 = B3 = 0`, the migration is
a no-op, and "no recruiter loses a saved candidate" is satisfied trivially. **That is an
argument for doing this now rather than later**: every day the DB shortlist is used, this
migration gets more expensive and more dangerous. The script must still be written and
proved, because the number will not stay zero.

---

## 5. Rollback

**The source table is never written to and never dropped by this plan.** Rollback is
therefore reading, not restoring:

1. Revert the reader change so the desk reads `RecruiterShortlistItem` again.
2. Leave `TalentList` / `TalentListItem` / `CandidateNote` rows in place — they are
   additive and invisible to the old readers.
3. No data restoration needed, because nothing was moved — only copied.

Dropping `RecruiterShortlistItem` is **explicitly out of scope** and must not happen in the
same release as the cutover. Proposed: two releases — copy + dual-read, then cutover, then
a separate decision about the old table.

---

## 6. How "no recruiter loses a saved candidate" is proved

Not asserted — checked, in this order:

1. **B2 before, A1 after, and `A1 == B2`.** Counts, on the same database, in the same run.
2. **A3 = 0** — the set-difference query returns nothing.
3. **Per-recruiter reconciliation**, not just a total:
   ```sql
   SELECT s."recruiterUserId", COUNT(DISTINCT pm."userId") AS before
   FROM "RecruiterShortlistItem" s JOIN "ProgramMember" pm ON pm.id = s."memberId"
   GROUP BY 1;
   ```
   compared row-for-row with the same grouping over `TalentListItem`. A total can match
   while one recruiter has lost items and another gained them; this cannot.
4. **A UI check per track** — one candidate from each of PROGRAM, CLAUDE, CHALLENGE_60 and
   HACKATHON shortlisted and still present after sign-out and sign-in from a *different
   browser profile*. `localStorage` survives sign-out, so a same-profile check proves
   nothing.
5. **The old table is still there**, so any disagreement is diagnosable rather than
   theoretical.

---

## 7. Idempotency

| Object | Guard |
|---|---|
| `TalentList` | `@@unique([organizationId, name])` + upsert |
| `TalentListItem` | `@@unique([talentListId, candidateUserId])` + `ON CONFLICT DO NOTHING` |
| `CandidateNote` | no unique constraint — **must be guarded in the script** by `(organizationId, candidateUserId, authorUserId, body)` existence check, or notes will duplicate on rerun |
| Source rows | never mutated |

**`CandidateNote` duplication on rerun is the one real idempotency hazard in this plan.**

---

## 8. Security

- `TalentListItem.candidateUserId` is a `User` id. Every read must keep applying
  `searchableUserWhere()` ([repositories/talent.ts:29](../../src/repositories/talent.ts#L29)),
  exactly as `loadRequestMatches` re-applies it at
  [:102](../../src/features/hire/load-request-matches.ts#L102). A saved list is a discovery
  surface, not an archive.
- Client-supplied candidate refs must continue to go through
  `resolveEligibleCandidates` ([pool-policy.ts:136](../../src/features/hire/pool-policy.ts#L136)).
- **Isolation, tested:** `loadRequestMatches(requestA, recruiterB)` returns `null` while
  `loadRequestMatches(requestA, recruiterA)` returns 2 matches. Per-recruiter isolation
  holds on the read path today.
- Moving to an org-scoped list **widens** visibility from one recruiter to a company.
  That is a product change, not a refactor — decision 1.

---

## 9. Explicitly out of scope

- Save for Later / the desk star (`abtalks-hire-star`) — separate task; it is device-local
  by design ([hire-saved-later.tsx:91](../../src/components/hire/hire-saved-later.tsx#L91)).
- `viewedAt` / `lastViewedAt` / `firstSeenAt` / `decision` — PR #254 and T-045.
- Dropping `RecruiterShortlistItem`.
- Any change to `TalentRequest` or `TalentRequestMatch`.
- Candidate inclusion / recruiter-pool eligibility — [119](119-t022-real-candidate-inclusion-audit.md).
- `/hire` navigation and search restoration.

---

## 10. Open decisions — Sohail

| # | Decision | Why it blocks |
|---|---|---|
| 1 | Is the shortlist **per recruiter** or **per organisation**? | `TalentList.organizationId` is required. Org-scoped means one recruiter's saves become visible to colleagues — a visibility change, not a refactor. Nothing currently reads `OrganizationMember`. |
| 2 | One list per recruiter, or named lists per project? | `TalentListItem` has no `requestId`. Per-project saving needs either that column or one list per request. |
| 3 | Do notes move to `CandidateNote` in the same task, or later? | Notes are only reachable from `/talent/members/[id]` today; moving them touches the program portal too. |
| 4 | Migrate now while the source is empty, or after the shortlist is in real use? | Now is free. Later is not. |

## 11. Dependencies and blockers

- **D-2 is unresolved** ([D-2 report](#), board `T-001`): no migration merges until a
  `migrate deploy` rehearsal on a Neon child branch is recorded. See §12 of the audit plan
  for the concrete blocker found.
- `DIRECT_URL` is unreachable and is a different endpoint from `DATABASE_URL`.
- This plan adds **no new tables** — `TalentList`, `TalentListItem` and `CandidateNote`
  already exist in production, so it may need **no migration at all**, only code. That
  should be confirmed against the target database before the plan is scheduled.

## 12. Acceptance criteria

1. All four candidate tracks can be shortlisted and all four persist across a fresh
   browser profile.
2. `A1 == B2`, `A2 == B3`, `A3 == 0`, and the per-recruiter reconciliation matches
   row-for-row.
3. The script is rerun immediately and the counts do not change.
4. `RecruiterShortlistItem` still holds every row it held before.
5. `searchableUserWhere()` is still applied on every read of a saved candidate.
6. Existing tests pass: `test:visibility`, `test:hire-score`, `test:sample`,
   `test:virtual`, `test:match-persistence`, `test:guest-adoption`.

**This plan is not signed. It requires Sohail's review and the four decisions in §10.**
