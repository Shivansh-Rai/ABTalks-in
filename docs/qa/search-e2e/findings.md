# Recruiter search — end-to-end test findings

Date: 2026-10-07 · Tester: Claude (senior test engineer pass) · Requested by: Sohail
Database: `ep-young-shadow-amawetjy` (production-volume, 13,590 users), read-only
session (`default_transaction_read_only=on`) asserted before every query.

**STATUS: all findings below are FIXED as of 2026-10-07.** Outcomes are recorded
inline under each one, with the measurement that proves it. Two findings were
corrected during the fix pass — see §"Corrections" at the end; the corrections
are the honest record, not a softening.

Scope: **does a correctly-written recruiter query produce the right answers?**
Layers exercised: real Gemini brief parse → real `searchCandidates` → ranked list.
Baseline suites first: `npm run test:recruiter-search` = 81 passed, 0 failed.

Evidence for every claim below is a measurement taken in this session, not a
reading of the code. Where a number is distorted by the test environment, that
is stated inline rather than left to be discovered later.

---

## 0. The data ceiling (context for everything else)

Over the **13,176 searchable** candidates:

| Field search depends on | Candidates with it |
|---|---|
| Any skill row | 2,577 (19.6%) |
| `CandidatePreference` row (any) | **42 (0.3%)** |
| `CandidateProfile.locationCity` | 333 (2.9%) |
| `headline` | 267 (2.4%) |
| `expectedSalaryMax` | **0** |
| `SkillEvidence` rows | **0** |
| `CandidateSkill.evidenceScore > 0` | **0** |
| `CandidateSkill.verified = true` | **0** |
| `Skill.aliases` populated | **0 of 1,235** |

Consequence: skill, role and free-text queries are testable; location, work mode,
notice period and budget are not, because `scoreCandidate` only binds those
filters when the candidate HAS the field (unknown is correctly not a mismatch)
and almost nobody does. A test asserting them would score 100% on a filter that
never ran, so the query set tags those cases `unbindable` and never scores them.

---

## P0 — ship-blocking

### P0-1 · Ranking collapses to alphabetical order for most of the pool

**What happens.** The sort is `tier → score desc → fullName`
(`src/features/hire/score-candidate.ts:805`). The name tiebreak is sound; the
defect is how often it decides, because scores saturate.

Measured over 16 queries:

| Query | Pool | Distinct scores in top 20 | Top-20 track mix |
|---|---|---|---|
| Q07 `python + sql` | 2,105 | 11 | CLAUDE 9 · PROGRAM 5 · CHALLENGE 2 · PROFILE 4 |
| Q10 `data analyst` | 2,320 | 14 | CLAUDE 13 · PROGRAM 5 · CHALLENGE 2 |
| Q03 `docker` | 733 | **2** | PROFILE 19 · PROGRAM 1 |
| Q08 `aws + docker + kubernetes` | 815 | **1** | **PROFILE 20** |
| Q15 `pytorch / tensorflow` | 670 | **1** | **PROFILE 20** |
| Q16 `snowflake + dbt` | 677 | **1** | **PROFILE 20** |

Q08: all 20 results score **exactly 85**, all PARTIAL, and the list is strictly
alphabetical — verified `names == sorted(names)`. Out of 815 eligible people the
recruiter receives the 20 whose names sort first; the leading cards were six
consecutive surnames starting "Aa" through "An". It is also actively wrong, not
merely arbitrary: **ranks 7 and 8 do not hold AWS at all**, while
a candidate whose claimed skills are `Devops, AWS, Git, Docker, Terraform,
Python` — an obvious 3-of-3 match — sits at rank 10 purely because their name
starts with C. Once
scores tie, missing a must-have costs nothing in rank.

**Root cause.** The correlation with track is exact: every collapsed query
returns ~100% PROFILE-track candidates. All discriminating signal comes from
`missions` / `cleanPass` / `consistency`, which only CLAUDE / PROGRAM /
CHALLENGE_60 participants have. `reweight()` correctly drops the dimensions a
pool has no data for, and what is left — `stack`, `experience`, `role` — is flat
across survivors, because everyone who passed the must-have gate matched the
same skills and nobody has experience months. PROFILE is where the ~10,575
backfilled candidates live, so **the more specific the recruiter is, the more
arbitrary the answer becomes.** That inverts the product's premise.

**Solution.**
1. Give PROFILE-track candidates at least one real discriminating dimension.
   The cheapest honest ones already in the data: skill-count overlap beyond the
   must-haves (how much of the nice-to-have stack they hold), profile
   completeness (`headline`, `githubUsername`, `resumeUrl`, education present),
   and recency of profile update. None require new tables.
2. Make a partial must-have match cost rank. Today a 2-of-3 and a 3-of-3 can
   both score 85; the `stack` subscore must separate them before the tiebreak is
   ever consulted.
3. Replace the pure-alphabetical final tiebreak with a deterministic but
   non-biasing one (hash of `candidateRef`). Alphabetical order systematically
   advantages the same people on every query, which is a fairness problem as
   well as a relevance one.
4. Add a regression assertion: for any query returning ≥10 results, the top 20
   must contain ≥4 distinct scores, OR the search must declare itself
   unranked to the caller. Silent degeneracy is the thing that let this ship.

**Owner.** `score-candidate.ts` is under `/src/features/hire/` → `@zainabshujat`
per CODEOWNERS; "search ranking" is Sohail's per CLAUDE.md. See P3-1.

### P0-2 · Every recruiter search serializes ~380 database round trips

**What happens.** `listAiCohortMemberships`
(`src/repositories/program-state.ts:872`) awaits `hydrateAiCohortMembership`
inside a `for` loop:

```ts
for (const pe of pes) {
  const row = await hydrateAiCohortMembership(pe);   // ← sequential
  if (row) out.push(row);
}
```

Each call is one `candidateProfile.findUnique` with four nested relations
(education, experience, skills→skill) = **5 SQL round trips**, measured. × 76
`pe_pm_` enrollments sequentially = **380 serialized round trips**. The batched
`findMany({ where: { userId: { in: userIds } } })` returns identical data for
all 76 in **5 round trips** and the same ~3.1 s of in-database time — measured
side by side.

Because `searchCandidates` runs its five tracks in `Promise.all`, this one track
IS the whole search latency:

```
loadTrack(PROGRAM)       129231 ms   76 members   ← the entire search
loadTrack(CLAUDE)         43082 ms  321 members
loadTrack(CHALLENGE_60)   17458 ms   66 members
loadTrack(PROFILE)        12199 ms 2000 members
loadTrack(HACKATHON)       5114 ms  200 members
```

**Honest caveat.** The laptop→Neon round trip here is **775 ms**, so these
absolute seconds are badly inflated; production (Vercel, same region) is
single-digit ms and the user-visible cost is far smaller. The portable defect is
the 76× round-trip multiplier, which grows linearly as the AI Cohort grows.

**Solution.** Hoist the profile read out of the loop: one
`candidateProfile.findMany({ where: { userId: { in: pes.map(p => p.userId) } } })`
with the same `select`, build a `Map<userId, profile>`, and make
`hydrateAiCohortMembership` a pure function taking `(pe, profile)`. This is
exactly the shape `listProgramCandidates` already uses for `commitDays`,
`projects` and `interviews` on the next lines, so it is a consistency fix as much
as a performance one. Also move the loop AFTER the visibility filter in
`listProgramCandidates` — today it hydrates people it then discards.

### P0-3 · The query parser fails open; a failed parse returns 20 arbitrary people

**What happens.** `DEFAULT_TIMEOUT_MS = 4000` (`gemini-brief.ts:29`). Measured
production-shaped calls to `gemini-3.5-flash-lite`: **1331, 1452, 1580, 1597,
1822, 1869, 2457, 2776, 3983 ms** — one run landed 17 ms inside the abort.
Google also returned **`503 service is currently unavailable`** during this
session, and there is **no retry**. On failure the spec can reduce to `{}`, and
`searchCandidates({})` returned **20 results** — an unconstrained page of
whoever ranks highest, indistinguishable to the recruiter from a real answer.

Parse quality itself is good: **16 of 16** queries parsed correctly when the API
was healthy, all `provenance: gemini`, none over budget on those runs. The
failure mode is availability, not comprehension.

**Solution.**
1. Raise the timeout to ~8,000 ms and add one retry with jitter on `503` /
   `429` / timeout. A recruiter waiting 2 s longer for a correct parse is
   strictly better than one silently downgraded to keyword matching.
2. Make `searchCandidates` refuse an empty spec: return
   `{ ok: false, message }` rather than an unconstrained ranked page. An
   unconstrained search is never a legitimate answer to a typed query.
3. Surface the degradation in the UI when the deterministic fallback answered —
   the recruiter should know their sentence was read by keyword rules.

### P0-4 · `npm run audit:recruiter-search` has been dead since the 078 drop

**What happens.** It completes 183 cases then dies:
`relation "Enrollment" does not exist`, raised at
`src/repositories/search-audit.ts:457` inside `persistedResultHealth` —

```sql
SELECT COUNT(*) AS n FROM "Enrollment" e JOIN "Challenge" c ON c."id" = e."challengeId"
```

`Enrollment` is one of the tables plan 078 dropped. So the live audit relied on
as the search safety net does not run at all. The `| tail` in the npm script
also masked the non-zero exit, so it reported success.

**Solution.** Rewrite the `enrollmentDomainMismatch` check against the canonical
model (`ProgramEnrollment` with `pe_enr_*` ids joined to `Challenge`), or delete
the check if the invariant no longer exists post-078. Then add a CI smoke run of
`audit:recruiter-search --lite` so a dropped table breaks the build instead of
silently retiring a safety net. Remove the output-swallowing pipe.

---

## P1 — wrong answers, not blocking

### P1-1 · The city filter reads the wrong column — **WITHDRAWN, this was not a defect**

> **Retracted 2026-10-08.** The analysis below is wrong and the fix built on it
> was reverted. `CandidateProfile.locationCity` is the "City" field in Basic
> Info — where the candidate *is*. `CandidatePreference.preferredLocations` is
> where they want to *work*, and `willingToRelocate` sits on that same row.
> Using the former to exclude people from a search in another city reads a
> current address as a refusal to move, and because the relocation flag lives on
> the preference row those candidates do not have, there is no signal that says
> otherwise.
>
> The live audit caught it within one run: `CITY_MATCHER_DISAGREES`, 255-301
> candidates reported missing per city — including **301 for the nonexistent
> city the filter registry uses as a control**, which is as clear a signal as
> you get that the filter had started excluding people it knew nothing about.
> That is the same invariant the work-mode and engagement-type checks keep
> deliberately: an unstated field must never exclude anybody.
>
> So city filtering really does only work for the candidates who have stated a
> work-location preference (42 of 13,176), and the answer is more stated
> preferences — or making location a RANKING signal, where a profile-city match
> ranks higher and a mismatch never excludes. That is a new scoring dimension
> and a product decision, not a bug fix.
>
> Kept rather than deleted because the reasoning error is the useful part: two
> columns with similar names meant different things, and 333-vs-42 coverage made
> the wrong one look obviously right.

#### The original (incorrect) finding

`score-candidate.ts:504` gates on `avail.preferredCities`, sourced only from
`CandidatePreference.preferredLocations` (`repositories/candidate.ts:387`) —
**42 rows**. `CandidateProfile.locationCity` has **333**, and is read nowhere in
the search path, nor by the card's `locationLabel` (`to-public-match.ts:197`).
Verified: every `locationCity` reference under `features/hire/` is the
*recruiter's* requested city, never the candidate's own.

20 profiles say Bengaluru; a Bengaluru search cannot reach them.

**Solution.** Treat the candidate's location as
`preferredLocations ?? [locationCity]` — preference wins when stated, profile
city is the fallback. Extend `cityKey` to fold the live duplicates this data
actually contains: Bengaluru/Bangalore (20/12), Delhi/New Delhi (10/7),
Noida/Greater Noida (45/7), Gurugram/Gurgaon, and reject `"India"` (8 rows) as a
city the way `ANY_CITY` already rejects sentinels.

### P1-2 · A failed track load degrades the search silently

`loadTrack` catches its own Prisma errors, logs, and returns `emptyLoad(slug)`
(`track-loaders.ts:377-383`), so `searchCandidates` still answers `ok` with a
track missing from the pool. Observed live: during a sustained run, PROGRAM and
PROFILE both threw and the search **still returned results** from a partial pool.
A recruiter sees a plausible shorter list and no indication anything failed.

**Solution.** Have `TrackLoad` carry `failed: boolean`, propagate it through
`mergeTrackLoads`, and let `searchCandidates` report it in its result envelope so
the caller can say "searched 3 of 5 sources". Keep the graceful degradation —
just stop hiding it.

### P1-3 · Three ranking inputs are empty, not merely stale

`SkillEvidence`: **0 rows**. `evidenceScore > 0`: **0**. `verified = true`: **0**.
`Skill.aliases`: **0 of 1,235**. CLAUDE.md records evidence as "frozen at
backfill time"; on this host it was never populated at all. Plan 162 lists the
canonical alias dictionary as "Built" — it has no data.

This is the direct cause of P0-1, not a background data-quality issue.

**Solution.** Plan 112's P0-0 (a live `SkillEvidence` writer) is the real fix and
should be sequenced before any further ranking work. Separately, seed
`Skill.aliases` for at least the top 50 skills by holder count — the normaliser
and the GIN index already exist and are doing nothing. Note the pool filter
matches `Skill.name` only (`repositories/hire.ts:601`), so populating aliases
also requires extending that `where` to consult `aliases`.

---

## P2 — diagnosability

### P2-1 · Prisma errors are truncated below the point of usefulness

`track-loaders.ts:380` logs `String(error).slice(0, 240)`; `gemini-brief.ts`
uses `slice(0, 200)`. Prisma puts the `Code:` and `Message:` AFTER the invocation
site and the surrounding source excerpt, so both limits cut the error off before
the only diagnostic part. I could not determine the cause of four live failures
from the log and had to re-test against the database.

**Solution.** Log `error.code` and `error.message` as their own fields for
`PrismaClientKnownRequestError` rather than truncating `String(error)`. Keep the
redaction, raise nothing else.

---

## P3 — process

### P3-1 · CODEOWNERS and CLAUDE.md disagree about who owns search

CODEOWNERS routes `/src/features/hire/` and `/src/repositories/hire.ts` to
**@zainabshujat**. CLAUDE.md gives **Sohail** "Candidate search" and "Search
ranking". P0-1, P0-3 and P1-1 all land in her paths while being squarely his
stated domain, so every fix here needs a cross-module approval that the two
records define differently.

**Solution.** Reconcile the two documents before the fixes are assigned. Either
carve the ranking and pool-selection files out of the hire block into explicit
`@byteninjaa0` lines (`score-candidate.ts`, `search-candidates.ts`,
`track-loaders.ts`, `pool-brief.ts`), or amend CLAUDE.md to hand recruiter-search
internals to Zainab. The current state makes rule 6 unactionable.

---

## What was built to find this

| File | Purpose |
|---|---|
| `src/features/search-qa/query-set.ts` | 31 recruiter queries: single/multi-skill, role, alias, prose, non-brief, plus 2 `unbindable` that document inert constraints and are never scored |
| `src/features/search-qa/relevance.ts` | precision@10 gate, recall over labelled-relevant, Somers' D rank correlation. Unlabelled results are excluded, never counted wrong |
| `scripts/search-qa/e2e-queries.ts` | the CLI: live parse → real search → labelling sheet + scorecard. Read-only session asserted; parses cached; checkpoints every query; `--resume` |
| `.github/CODEOWNERS` | section 8, routing the search-QA surface to `@byteninjaa0` |

```
npm run qa:search:e2e -- --top=20            # run and write the sheet
npm run qa:search:e2e -- --resume            # continue an interrupted run
npm run qa:search:e2e -- --score             # re-score after labelling
```

No file under `src/features/hire/` was modified.

**Why rank correlation is in the scorecard.** precision@10 alone scores Q08 at
90% (18 of 20 hold all three skills) and calls it healthy. Somers' D is what
exposes an alphabetical list. P0-1 would not have been found by precision alone.


---

# Fix pass — 2026-10-07

Every finding above, in the order it was fixed. Verified by measurement against
the same database, not by inspection.

| # | Fix | Proof |
|---|---|---|
| P2-1 | `errorFields()` in `lib/observability/redact.ts`; search-path log sites use it instead of `String(error).slice(0, 240)`. Prisma's `code` is now its own field. | redaction suite 15 passed; log-leak scan clean over 1,645 files |
| P0-4 | Deleted the `Enrollment` check — the invariant is structurally impossible post-078 (`ProgramEnrollment` has no `domain`; the loader takes domains from the `CHALLENGE_DOMAINS` constant). | **the audit now runs to completion** and prints a full report (`OVERALL STATUS: NOT READY`, with real findings) |
| P0-2 | `listAiCohortMemberships` batches the profile read into one `findMany`; `hydrateAiCohortMembership` is now a pure function over `(pe, profile)`. | `loadTrack(PROGRAM)` **129,231 ms → 17,473 ms**, same 76 members. Every track now 6–19 SQL round trips, no N+1 anywhere. Whole-search p50 **130,462 ms → 22,730 ms** |
| P1-2 | `TrackLoad.failed`, `mergeTrackLoads().failedTracks`, surfaced as `failedTracks` on the search result. Degradation kept, silence removed. | typecheck + 82/0 search-qa |
| P0-3 | Budget 4,000 → 8,000 ms, one jittered retry, retryability decided where the status code is still in hand (so a 400 is not retried). `searchCandidates` now refuses an empty spec via `hasSearchCriteria` — one definition, shared with Scout's gate. | retry visible in the suite log (attempt 1 → 711 ms backoff → attempt 2); hire-brief 24/0, spoken-brief 138/0, scout 63/0 |
| P1-1 | The location check moved OUT of the `if (avail)` guard and falls back to `CandidateProfile.locationCity`. | constraint now binds for **281 candidates, up from 19**, and discriminates: Bengaluru 51 · Noida 63 · Chennai 23, with Bangalore folding to the same 51 |
| P1-3 | `skillSpellings()` expands each term through the existing `CANONICAL_SKILLS` catalog before the SQL query, so the pool and the scorer agree on what a skill is. `Skill.aliases` is consulted too. | `postgres` **5 → 147** candidates · `nodejs` **24 → 173** · `reactjs` **12 → 428** · `cpp` = `c++` = 588. **No database write was needed** |
| P0-1 | Three changes: (a) `reweight` zeroes the `experience` weight when no range is asked, exactly as it already did for `role` — it was a constant `0.7` taking 16.7% of the weight; (b) the tiebreak is now `evidence richness → stable hash of the ref`, never the name; (c) the result carries `rankedBy: "score" \| "evidence"` so a surface can say the score ranked nobody. | **alphabetical ordering eliminated in all four collapsed queries** (Q03, Q08, Q15, Q16: `True → False`). Ties now order by profile richness — Q08's top 12 run 43, 40, 42, 37, 37, 34… skills instead of five consecutive surnames beginning "Aa", "Ab", "Ab", "Am" |
| P3-1 | CODEOWNERS §7b carves the ranking and pool files out to `@byteninjaa0`, overriding the blanket `/src/features/hire/` line (later lines win). | the conflict that blocked this pass is recorded in the file |

## Also fixed, found by the now-working audit

| Severity | Finding | Fix |
|---|---|---|
| CRITICAL | 3 `@abtalks.dev` seed accounts were recruiter-searchable | `searchableUserWhere` excludes `TEST_EMAIL_DOMAINS`, now canonical in `repositories/talent.ts` and imported by the audit so the two cannot drift |
| ERROR | 2 RECRUITER accounts were in the candidate pool (`searchableUserWhere` had no role rule) | requires `role: "STUDENT"`. Measured first: the pool was 13,174 STUDENT + exactly those 2, no ADMIN, and the AI Cohort's professionals are STUDENT too (persona lives on `CandidateProfile.primaryPersona`), so nobody else is affected. Pool sizes fell by exactly 2–3 per query afterwards, as predicted |

## Corrections to the original findings

Both were my measurement errors, found while fixing:

1. **"Ranks 7 and 8 do not hold AWS at all."** Wrong. Both candidates claim
   **"AWS EC2"**, which `stackTokensMatch` correctly folds to `aws`. They are
   3-of-3. My check compared lowercase equality against a list I
   had truncated to 6 of 23 entries. The matcher was right and I was not — so
   P0-1 is purely "scores are flat", never "the wrong people rank higher".
2. **"Fold Bengaluru/Bangalore, Delhi/New Delhi, Gurgaon/Gurugram."** Already
   done — `CITY_ALIASES` in `score-candidate.ts` has covered these since
   QA-KI-009, and "Greater Noida" already matches a Noida search through the
   substring test. The only real P1-1 defect was the wrong column.

A third correction, to the fix rather than the finding: my first attempt at P1-1
put the `locationCity` fallback *inside* the `if (avail)` guard, where it could
never run for the 277 people who have a profile city and no preference row — i.e.
exactly the people it was written for. The probe caught it; the check now sits
outside the guard.

## Still open — deliberately not fixed here

- **`SkillEvidence` has no live writer** (plan 112 P0-0). Still 0 rows, so
  `evidenceScore` and `verified` are still 0 for everyone. This is a feature, not
  a bug fix, and it is what would give the ranker real signal over profile-only
  candidates rather than the tiebreak now carrying that load. P0-1's fix makes
  the degeneracy visible (`rankedBy: "evidence"`) instead of hiding it.
- **`CHALLENGE_POOL_CAP = 2000` hides eligible candidates.** The working audit
  reports 3,536 affected: "eligible via PROFILE but the track was loaded to its
  cap (PROFILE 2000/2000) — rows past the cap are never searched". Raising the cap
  is a latency/completeness trade-off and a product decision.
- **Top-20 with no page 2**: 2,300 of 2,320 candidates unreachable by an
  unfiltered search. The audit already labels this PRODUCT DECISION REQUIRED.
- **"Open to work only" includes 5,763 candidates who never stated availability.**
  Audit-labelled PRODUCT DECISION; changing it would exclude 99.7% of the pool.
- **23 candidates have a usable profile but no `CandidateVisibility` row.** Needs
  a backfill or their next profile save.
- **Two stale test assertions**, both in other owners' modules and neither a real
  defect: `every admin-*.ts action file calls requireAdmin` fails on
  `admin-resume-import-actions.ts`, which gates all 9 of its actions with
  `getAdminContext()` + `NOT_AUTHORISED` (verified individually) — the test pins a
  literal string, not the behaviour. And `assessment detail page 404s a foreign
  id`. Reported, not touched.
