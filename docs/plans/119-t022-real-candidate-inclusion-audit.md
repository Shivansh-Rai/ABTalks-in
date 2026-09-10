# 119 — T-022 real-candidate inclusion audit

**Read-only production investigation.** No INSERT / UPDATE / DELETE, no seed, no migration,
no schema or code change, no commit, no push. No candidate created or modified. Nothing was
shortlisted, viewed, or messaged in production. Every production statement was a `SELECT`.

---

## A. Environment
      
| | |
|---|---|
| Branch | `feat/talent-request-persistence` |
| Commit | `58d26b63f72abde706b4024c0de4856f3b54cb17` |
| git status | clean except untracked `docs/plans/106-…`, `116-…`, `117-…` |
| `DATABASE_URL` | `postgresql://***@ep-young-shadow-amawetjy-pooler…/neondb` — production, read-only |
| `DIRECT_URL` | `postgresql://***@ep-proud-band-am3sduhv…/neondb` — different endpoint, not contacted |
| `NODE_ENV` | unset (development) |
| App running locally | yes, `localhost:3000` on the local test DB — **not used for this audit** |
| **Production writes** | **NONE** |

---

## B. Real candidate population (production, `SELECT` only)

```
users (not deleted)                                12,805
with a CandidateVisibility row                     12,804
searchable (searchableByRecruiters, not withdrawn)     66
```

```
StudentProfile rows                                 2,960
  with >= 3 self-declared skills                    1,317
    and 0 submissions                                 946
    and 0 hackathon entries                           837
    and 0 program membership   << the PRD case        835
      and searchable by recruiters                      0
```

**835 genuine production candidates match the PRD case exactly** — three or more
self-declared skills, no submissions, no hackathon, no cohort. **Zero of them are visible
to recruiter search.**

Zero-activity profiles by declared-skill count (they are not fringe):

```
10 skills → 56 users   9 → 32   8 → 38   7 → 61   6 → 93   5 → 141
```

Where the 66 searchable users actually live:

```
ProgramMember in an open cohort   64
>= 10 challenge submissions       25
hackathon participant             33
in NONE of the three               1   ← searchable, and still unreachable
```

---

## C. Search eligibility

| Candidate condition | Appears? | Why |
|---|---|---|
| 3+ skills **with** activity, searchable, in a loader root | **YES** | reached by one of the three loaders; evidence then only ranks |
| 3+ skills, **zero** activity | **NO** | two independent exclusions — see §D |
| QA fixture (Scout Strong/Narrow/Consistent) | **YES**, locally | `ProgramMember` rows in a cohort, `CandidateVisibility.searchableByRecruiters = true`, `missionsPassed = 0` |

The fixtures pass **because they are program members**, not because they have evidence —
all three show `0 of 31 missions passed` and still rank. That is the correct behaviour for
the evidence floor, and it is exactly why the fixtures hid the real problem: they satisfy
the structural gate that real zero-activity candidates fail.

---

## D. Eligibility vs ranking

**What determines inclusion.** Two gates, each sufficient on its own to exclude:

1. **Structural — which table a candidate is loaded from.** Search has exactly three
   loaders, rooted in three tables:

   | Track | Root query | Requirement |
   |---|---|---|
   | PROGRAM | `prisma.programMember` | member of an **open cohort**, `status ∈ {ENROLLED, COMPLETED}` |
   | CLAUDE / CHALLENGE_60 | `prisma.enrollment` | challenge enrolment **and ≥ 10 submissions** |
   | HACKATHON | `prisma.hackathonParticipant` | a hackathon entry |

   **No loader starts from `User`, `StudentProfile` or `CandidateProfile`.** A candidate who
   is none of those three things has no entry point into search at all — regardless of
   skills, visibility, or anything else.

2. **Visibility.** `searchableUserWhere()` is applied inside every loader query
   ([repositories/hire.ts:362, 378, 535, 552, 681, 696, 710](../../src/repositories/hire.ts#L362)),
   not merely on read-back. It requires a `CandidateVisibility` row with
   `searchableByRecruiters = true` and `withdrawnAt IS NULL`. Only 66 of 12,804 rows qualify,
   and **none of the 835 PRD-case candidates does**.

**What determines ranking.** Evidence — missions passed, clean passes, commit days, project
scores, interview scores — feeds `score-candidate.ts` and orders the results. For the
PROGRAM track the evidence floor is explicitly **not** an exclusion:

> *"The floor is a preference, not a wall. As a hard exclusion it emptied the board … Below-floor people rank below the rest and say why on the card."*
> — [track-loaders.ts:106-110](../../src/features/hire/track-loaders.ts#L106)

and the code matches the comment: `members: dossiers.map(...)` maps **all** dossiers, while
`aboveFloor` is used only to compute the `belowEvidenceFloor` count for Scout's narrative.

**Does ABTalks activity affect eligibility?** **Yes — in two places.**

- **CLAUDE / CHALLENGE_60:** activity is a hard filter.
  ```ts
  const eligible = enrollments.filter((e) => e._count.submissions >= opts.minDays);
  ```
  [challenge-dossier.ts:201-203](../../src/features/hire/challenge-dossier.ts#L201). With
  `HIRE_CHALLENGE_POOL=10` in production, `minDays = 10`. A candidate with 9 submissions is
  removed **before** scoring. The loader's own comment confirms the intent:
  *"Their floor is applied in the query that loads them, so everyone who arrives has already cleared it"*
  ([track-loaders.ts:191](../../src/features/hire/track-loaders.ts#L191)).
- **All tracks:** having *any* activity at all is the precondition for being loaded, because
  the three root tables are activity/affiliation records.

**Does lack of activity merely lower ranking?** Only *within* the PROGRAM track, for someone
who is already a cohort member. For everyone else, lack of activity is disqualifying.

---

## E. Exact code evidence

| # | File · function · line | Condition | Kind |
|---|---|---|---|
| 1 | [pool-policy.ts:96](../../src/features/hire/pool-policy.ts#L96) `memberEligibilityWhere` | `cohortId IN (open) AND status IN ('ENROLLED','COMPLETED')` | **eligibility** |
| 2 | [pool-policy.ts:62](../../src/features/hire/pool-policy.ts#L62) `resolvePoolCohorts` | cohort must be in `HIRE_OPEN_COHORT_IDS` or published | **eligibility** |
| 3 | [challenge-dossier.ts:201](../../src/features/hire/challenge-dossier.ts#L201) `buildChallengeDossierSet` | `e._count.submissions >= opts.minDays` (10 in production) | **eligibility** ⚠️ |
| 4 | [track-loaders.ts:172](../../src/features/hire/track-loaders.ts#L172) `loadChallenge` | `if (!flag.enabled) return emptyLoad(slug)` — whole track off unless `HIRE_CHALLENGE_POOL` set | **eligibility** |
| 5 | [repositories/hire.ts:362](../../src/repositories/hire.ts#L362), :378, :535, :552 | `user: searchableUserWhere()` | **eligibility** |
| 6 | [repositories/talent.ts:29](../../src/repositories/talent.ts#L29) `searchableUserWhere` | `deletedAt: null, visibility.is.{searchableByRecruiters: true, withdrawnAt: null}` | **eligibility** |
| 7 | [repositories/hire.ts:358](../../src/repositories/hire.ts#L358) `listChallengeCandidates` | root table `prisma.enrollment` | **eligibility (structural)** |
| 8 | [repositories/hire.ts:532](../../src/repositories/hire.ts#L532) `listHackathonCandidates` | root table `prisma.hackathonParticipant` | **eligibility (structural)** |
| 9 | [dossier.ts:297](../../src/features/hire/dossier.ts#L297) `buildDossierSet` | root table `ProgramMember` | **eligibility (structural)** |
| 10 | [track-loaders.ts:112](../../src/features/hire/track-loaders.ts#L112) `clearsEvidenceFloor` filter | counts only; `members` maps all dossiers | **ranking** ✅ |
| 11 | `score-candidate.ts` | missions, clean passes, commit days, projects, interview | **ranking** ✅ |
| 12 | [hire-actions.ts:363](../../src/app/actions/hire-actions.ts#L363) | `searchCandidates(spec, { limit: 20 })` | **ranking/cap** |

### Pipeline (§2), signed-in recruiter

```
ScoutChat (/hire)                       app/hire/page.tsx
  → sendScoutMessageAction              actions/hire-actions.ts:167
  → runMatchAction                      :318
    → searchCandidates(spec,{limit:20}) features/hire/search-candidates.ts
      → loadTracks()                    features/hire/track-loaders.ts:295-300
          loadProgram   → buildDossierSet(memberEligibilityWhere(openCohortIds))
          loadChallenge → buildChallengeDossierSet({minDays, domains, limit})
          loadHackathon → buildHackathonDossierSet()
        (every root query carries user: searchableUserWhere())
      → scoreCandidate(...) → rank
    → explainMatches(...)
    → $transaction([deleteMany(notIn), upsert…])   :443-455  → TalentRequestMatch
  → loadRequestMatches                  features/hire/load-request-matches.ts
      → re-applies filterSearchableUserIds  :102
  → UI cards
```

---

## F. Final product verdict

> *"Whenever a recruiter searches, genuine candidates with 3 self-declared skills and zero ABTalks activity can still appear."*

# **FAIL**

Two independent, provable exclusions, either of which is fatal on its own:

1. **Structural.** Search has three loaders and all three are rooted in
   activity/affiliation tables — `ProgramMember`, `Enrollment`, `HackathonParticipant`.
   There is no code path that loads a candidate from `User` or `StudentProfile`. A
   candidate with skills and no ABTalks history is **not addressable by the search at all**.
   Skills are read from the profile *after* a candidate has been loaded; they are never a
   way in.

2. **Visibility.** `searchableUserWhere()` runs inside every loader query. Only 66 of
   12,804 candidate rows satisfy it, and **0 of the 835 PRD-case candidates** do.

**Concrete proof that the structural gate is the deeper one.** Production contains exactly
one user who is *searchable* and yet in none of the three roots:

```
userId cmt7d9dbv0000jm044k0chmrc
  searchable: true   withdrawnAt: null
  enrollments 0 · submissions 0 · hackathons 0 · program memberships 0
```

This user has passed the visibility gate and still cannot be returned by any search,
because no loader queries a table they appear in. Fixing visibility alone would not make
the PRD case pass.

**Additionally**, for the CLAUDE / CHALLENGE_60 track, activity is an *explicit* eligibility
filter (`submissions >= 10`), which independently contradicts the requirement that evidence
must affect ranking only.

**The one place the requirement is honoured** is the PROGRAM track's evidence floor, which
the code deliberately treats as ranking rather than exclusion. That is the pattern the
other tracks do not follow.

### Why the fixtures hid this

Scout Strong / Narrow / Consistent all report `0 of 31 missions passed` and still appear —
so a fixture test looks like proof that zero activity is fine. It is not. They appear
because they are `ProgramMember` rows in a cohort with `searchableByRecruiters = true`.
They satisfy the structural gate that every real zero-activity candidate fails. **The
fixtures were concealing exactly this problem**, which is what §8 of the brief asked to
rule out.

---

## G. T-022 status

# **COMPLETE**

This audit closes the last evidence gap. T-022 asked what a recruiter's work is and whether
it survives; the accumulated answer is now backed by code, production `SELECT`s, and
fresh-browser observation:

- persistence matrix — [117](117-t022-control-test.md), verified two-browser
- guest-adoption root cause — [126](126-t022-two-browser-forensics.md)
- schema drift / P2022 — [115](115-talent-request-schema-drift-investigation.md)
- **inclusion / eligibility — this report**

Two items were carried as "unproven" in 117 and are now resolved or reclassified:

- The **non-PROGRAM shortlist branch** is still unexecuted, but its behaviour is settled
  from code (`programMemberId` is hardcoded `null` for three tracks), and it is an
  implementation question rather than a T-022 evidence gap.
- **No note UI on the desk** is a finding, not a missing test.

Remaining genuinely unproven, and neither blocks T-022:

- whether `DIRECT_URL` is a different Neon branch;
- whether the 835 PRD-case candidates are non-searchable by policy or by a backfill
  default — the *cause* of `searchableByRecruiters = false` at that scale was not traced,
  only its effect.

---

## H. What must NOT be implemented under T-022

Everything below is R3 implementation, not investigation. **None of it was done here.**

- A candidate loader rooted in `User` / `CandidateProfile` so unaffiliated candidates are
  addressable at all.
- Turning the challenge `submissions >= minDays` filter from eligibility into ranking.
- Any change to `searchableByRecruiters` defaults or a backfill of the 835.
- Writers for `viewedAt` / `lastViewedAt` / `decision` (T-045).
- Persisting matches in `adoptGuestScoutSessionAction`.
- Save for Later persistence.
- Unifying the shortlist across tracks.
- Surfacing the resume affordance on `/hire`.
- A note surface on the desk.
- Repairing `seed-hire-fixtures.ts` so it creates `CandidateVisibility` rows.
- The migration timestamp collision, the stale seed guards, and the missing
  `prisma/cleanup.ts` guard.

**Decisions needed before any of it is sized:** is the recruiter pool intended to be
*everyone who opts in*, or *everyone with verified evidence*? The PRD says the former; the
code implements the latter in three places. That is a product decision, not a bug fix, and
it should be settled before the loader work is scoped.

---

## Reproduction notes

All production access was `SELECT` / `COUNT` / `information_schema`. No candidate was
created, modified, contacted, shortlisted or viewed. Counts were taken with IDs only; no
names or emails were read except where already established in earlier reports. The local
test DB was not modified by this audit.
