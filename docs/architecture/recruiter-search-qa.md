# Recruiter Search QA — operating manual

Code: `src/features/search-qa/`, `src/repositories/search-audit.ts`,
`scripts/search-qa/`, `src/app/admin/search-health/page.tsx`. Plan: `docs/plans/147-recruiter-search-qa.md`.

This system answers one question continuously: **does recruiter search return
exactly the candidates it should, for every eligible candidate?** — and when it
does not, whose fault it is.

---

## 1. How recruiter search works (what is under test)

```
Scout chat · filter dialog · guest desk
  → hire-actions / hire-guest-actions            (auth, rate limit, Zod)
  → searchCandidates(spec, { limit: 20 })         features/hire/search-candidates.ts
      → enabledTracks()                           PROGRAM · CLAUDE* · CHALLENGE_60* · PROFILE · HACKATHON
      → loadTrack(slug)                           track-loaders → repositories/hire (visibility gate merged in)
      → mergeTrackLoads                           one card per person (PROGRAM > CLAUDE > CHALLENGE_60 > HACKATHON > PROFILE)
      → selectSearchResults                       score-candidate (pure, deterministic): ranks the WHOLE pool
          rankCandidates                          tier first (STRONG, PARTIAL, NONE), then score, then name/ref
          pickSearchMatches(limit 20)             hard filters + must-have AND gate + tier gate + padding
  → explainMatches (rationale text) → TalentRequestMatch + TalentSearchSession
```

\* `CLAUDE` / `CHALLENGE_60` exist only when `HIRE_CHALLENGE_POOL` is set.

**There is no search index.** No Elasticsearch/Meilisearch/FTS/vector store.
The "search document" is a `CandidateDossier` built per request from live
tables; `ENABLE_NEW_TALENT` decides whether it reads the 078 `CandidateProfile`
tables (production: ON) or the legacy `StudentProfile` / `ProgramMember`
mirrors. Persisted copies that can go stale: `TalentRequestMatch` rows and
`TalentSearchSession` snapshots.

### Source of truth

`User` + `CandidateVisibility` + `CandidateProfile` and children
(`CandidateSkill`→`Skill`, `CandidateEducation`, `CandidateExperience`,
`CandidatePreference`). Track membership: `ProgramMember`+`ProgramCohort`,
`Enrollment`+`Submission`, `HackathonParticipant`+`HackathonSubmission`.

---

## 2. Who is an eligible candidate

A candidate may appear only if **all** of:

1. `User.deletedAt` is null, `User.disabledAt` is null (and not anonymized — the audit also requires this);
2. a `CandidateVisibility` row exists with `searchableByRecruiters = true` and `withdrawnAt` null;
3. they belong to at least one searched, enabled track:

| Track | Rule |
|---|---|
| PROGRAM | `ProgramMember` ENROLLED/COMPLETED in a cohort that is published, or listed in `HIRE_OPEN_COHORT_IDS` (`all` = ENROLLING/ACTIVE) |
| CLAUDE | `HIRE_CHALLENGE_POOL` on; CLAUDE enrolment with submissions ≥ max(floor, stated days) |
| CHALLENGE_60 | same, SE / DS / AI enrolments |
| HACKATHON | participant whose team has a submission |
| PROFILE | `CandidateProfile.fullName` non-blank and ≥ 1 `claimedByCandidate` skill |

**Never appear:** deleted, disabled, anonymized, `searchableByRecruiters=false`,
withdrawn, **no visibility row** (fails closed — a product decision, below), and anyone outside
every enabled track. `openToWork` is **not** a discovery rule.

Open product decisions: usable profiles without a visibility row are hidden
(plan 117 expected them discoverable); RECRUITER/ADMIN accounts are not
excluded by any rule.

---

## 3. Filters and their semantics

Source of truth for the inventory: `filter-registry.ts`.

| Filter | Kind | Logic | Match | Unstated / null |
|---|---|---|---|---|
| Required skills (`mustHaveStack`) | match gate | **AND** | whole-word containment on skill names; single letters by equality; a part of a compound ("ML" in "AI/ML") by equality; the same catalog skill under an alias ("golang" = Go), including a compound part ("AI/ML" answers "Machine Learning"); "&" = "and" and plurals ("Data structures and algorithm" = "Data Structures & Algorithms"; no plural fold after s/j/u/i, so "NestJS" and "Express" are safe) | no skills never match |
| Work mode | hard filter | single | equal enum; FLEXIBLE either side matches | passes |
| Location (`locationCity`) | hard filter | ANY preferred city | same city after unambiguous renames/typos (Bangalore = Bengaluru), else substring either way (oracle: whole words); NCR cities never merged; "Any" = no city | no preference, no cities, or willing to relocate → passes |
| Engagement type | hard filter | ANY overlap | role type ∈ candidate opportunity types | empty list passes |
| Open to work only | hard filter | single | `openToWork = true` | **no preference row passes** |
| Budget ceiling (`salaryMax`) | hard filter | range | expected minimum ≤ budget | no expectation passes; 0/0 = not decided |
| Notice period | hard filter | range | notice ≤ days | unstated passes |
| Track | pool | **OR** | any named track | none named = all enabled |
| Minimum verified days | pool | range | challenge submissions ≥ max(flag, days) | ignored on non-day tracks |
| Result count | pool | cap | 1–25 cards, no padding | caller's limit |
| Experience, seniority, nice-to-have, evidence priority | **rank only** | — | never exclude | — |

Not recruiter filters today: graduation year, college, degree, branch, role
(`title` is unused), profile completion, verified skills/evidence, GitHub,
LeetCode/coding profiles, projects, assessments, certifications. Hackathon and
cohort exist only as tracks.

Sort: one — tier (STRONG, PARTIAL, NONE), then score desc, then name /
candidateRef asc. Saved match lists use the same order, with first-seen and
candidate id as tiebreaks. Pagination: none — the page is the top 20 (≤ 25) of
the whole ranked pool.

---

## 4. Normalization

`normalize.ts` defines what the oracles may assume. Every mapping is typed:

- **SAME** — case / spacing / punctuation folding.
- **RENAME** — an official or unambiguous spelling: Bangalore→Bengaluru, Gurgaon→Gurugram, golang→Go (via `skill-catalog.ts`), B.Tech→"B.E / B.Tech" (via `canonicalDegree`).
- **TYPO** — a misspelling that cannot mean anything else: banglore, hydrabad.
- **AMBIGUOUS** — never merged, reported as a product decision: Delhi NCR vs Noida/Gurugram/Ghaziabad, "Remote (India)" as a city, React vs React Native.

Symbols are never folded away: C, C++ and C# stay distinct.

### Adding a normalization rule

1. Confirm the two spellings can only mean one thing. If not, add it to the ambiguous set instead.
2. Skills: add the alias to `src/lib/skill-catalog.ts` (the product's own catalog) — search and the oracle both read it, so one edit changes both. Cities and work modes are deliberately defined twice, because the oracle must stay independent of the code under test: add the city to `CITY_ALIASES` in `src/features/hire/score-candidate.ts` (search) **and** `src/features/search-qa/normalize.ts` (oracle, with its kind); a work mode to `normalizeWorkMode` in the scorer **and** `WORK_MODE_BY_SQUASH` in `normalize.ts`.
3. Add an assertion to the `normalization` section of `search-qa.test.ts`.
4. Run `npm run test:recruiter-search` and `npm run audit:candidate-data` — the cluster should now show as SAFE / SAFE_TYPO.

The audit never rewrites stored values. Normalizing data is a separate, reviewed change.

---

## 5. How the testing works

### Layers

| Layer | Command | DB | When |
|---|---|---|---|
| Unit + golden + classifier self-tests | `npm run test:recruiter-search` | none | every PR touching search — `.github/workflows/recruiter-search-qa.yml` |
| Existing hire suites | `npm run test:hire-score`, `npm run test:visibility` | none | same |
| Live search audit | `npm run audit:recruiter-search -- --profile=production` | read-only | before a search release; nightly |
| Search document audit | `npm run audit:search-index -- --profile=production` | read-only | nightly |
| Candidate data + normalization | `npm run audit:candidate-data` | read-only | weekly |
| One candidate | `npm run audit:search-explain -- --user=<id> --skills=React --city=Pune` | read-only | support / debugging |
| Admin | `/admin/search-health` → Run health check | app DB, SELECT only | ad hoc |

Audit exit codes: `0` READY / READY WITH WARNINGS · `2` NOT READY · `1` the audit failed.

### Expected vs actual

- **Actual** — `probe.ts` loads the pool through the real `loadTrack` /
  `mergeTrackLoads`, and `evaluateSpec` runs the real `rankCandidates` and
  `pickSearchMatches` over the **full** ranking. Every audit re-runs a sample of
  specs through the real `searchCandidates()` and fails with
  `UNKNOWN / PROBE_DRIFT` if the pages differ, so the audit can never measure a
  pipeline production does not run.
- **Expected** — `canonical.ts` + the registry's `oracle` functions, over the
  canonical 078 rows, written from the documented rules. They never call the
  loaders, repositories or scorer.

Per case: expected count, actual count, TP, FP, FN, ambiguous, accuracy
(|E∩A| / |E∪A|), FP/FN ids, and each disagreement classified.

### Combinations

`combinations.ts`: singles with representative, boundary, sentinel and
zero-match values; multi-value (skills AND, tracks OR); every pair of
dimensions × two values; curated high-risk triples; a greedy strength-2
covering array (5+ filters); seeded random specs. Values come from the live
population. Rank-only fields are attached to cases to prove they never change
admission.

### Golden dataset

`golden.ts`: ~57 deterministic QA candidates (`qa001`…) plus four fault
injections, in memory only — nothing is seeded anywhere. `buildGoldenPool`
turns them into the documents the real loaders produce. Expectations in
`search-qa.test.ts` are written by hand.

### Known issues (strict expected failures)

`known-issues.ts` pins confirmed bugs. A pinned test that still fails prints
`◌` and does not fail CI; a pinned test that **passes** fails CI with "known
issue fixed — remove it". Readiness stays NOT READY while any pinned ERROR or
CRITICAL issue is observed.

As of 2026-09-17 the registry is **empty**: all eleven issues the first audit
found (QA-KI-001…011) are fixed and asserted by ordinary tests. The `knownBug`
harness stays in `search-qa.test.ts` for the next one.

---

## 6. Error classification

| Category | Fault | Search verdict | Typical cause |
|---|---|---|---|
| VISIBILITY_ERROR | search | FAIL (critical) | never-appear candidate loaded or resolvable |
| SEARCH_INDEX_MISSING | search | FAIL | eligible, no loader returned them |
| PAGINATION_ERROR | search | FAIL | pool cap truncation, rank-window loss, duplicate session ids |
| SEARCH_INDEX_STALE | search | FAIL | document ≠ canonical (legacy mirror read, split skill, NULLS-FIRST pick) |
| SEARCH_INDEX_DUPLICATE | search | FAIL | same person twice after dedupe |
| SEARCH_FILTER_ERROR | search | FAIL | filter logic disagrees with documented semantics |
| NORMALIZATION_ERROR | search | FAIL (warning) | equivalent spellings not matched |
| RANKING_ERROR | ranking | FAIL | order contradicts documented intent |
| SORT_ERROR | search | FAIL | missing / unstable tiebreak |
| PERMISSION_ERROR | search | FAIL | a ref resolves to the wrong gate |
| DATA_QUALITY_ERROR | **data** | **PASS** | the candidate's own data is wrong or incomplete |
| UNKNOWN | — | FAIL | unexplained; investigate |

`productDecision: true` findings are reported but never block readiness.

---

## 7. Reading a report

```
SEARCH COVERAGE      eligible vs loaded, missing / duplicates / stale / leaks, per-track caps
FILTER TESTS         one line per implemented filter, expected vs actual, pinned issues
CASE RESULTS         failing cases with FP / FN ids and a classified reason per group
COMBINATION TESTS    pass / known-issue / unexplained by kind
PAGINATION · SORT · PRIVACY · RANKING   named checks with PASS / FAIL / WARN / XFAIL / SKIPPED
SEARCH DOCUMENT CONSISTENCY   drift by cause, saved-match health
DATA QUALITY · NORMALIZATION  (candidate-data audit)
FINDINGS THAT FAIL RECRUITER SEARCH   deduplicated, most severe first
PRODUCT DECISIONS REQUIRED
OVERALL STATUS       READY | READY WITH WARNINGS | NOT READY + reasons
```

`--json=path` writes the full report, including every case.

---

## 8. Debugging

### A candidate appears who should not (false positive)

1. `npm run audit:search-explain -- --user=<id> --skills=... [--city=...]`.
2. Read `summary` and `gate`. A failing gate with the candidate loaded is a **VISIBILITY_ERROR** — stop and fix the loader query.
3. Read the filter table: `DISAGREE` rows carry the classification.
   - `SEARCH_INDEX_STALE` → compare `drift` (document vs canonical). Legacy mirror? `ENABLE_NEW_TALENT`. Split skill? QA-KI-004.
   - `DATA_QUALITY_ERROR` → the candidate's data explains it (pasted skill list, cohort skills never synced). Search is correct.
   - `SEARCH_FILTER_ERROR` → the matcher is looser than documented; write a golden test first.

### A candidate is missing (false negative)

1. Explain as above. `document.loaded = false` → coverage: which track should have loaded them, and was it `TRUNCATED` at its cap (PAGINATION_ERROR) or not loaded at all (SEARCH_INDEX_MISSING)?
2. Loaded but `excluded` → the summary names the hard-filter reason and, when the canonical profile disagrees, the category and known issue.
3. Admitted but not on the page → rank and page position are shown: beyond page 20 (no pagination).

### Data vs search vs index vs ranking

- The **document** agrees with the canonical profile and the decision is right → search PASS; if the data looks wrong it is a DATA_QUALITY_ERROR.
- The document **disagrees** with the canonical profile → INDEX (stale document).
- Document agrees, **decision** disagrees with documented semantics → SEARCH (filter / normalization).
- Candidate correctly admitted but **ordered** against documented intent → RANKING.

---

## 9. Adding a test when a new filter ships

1. Add a `FilterDef` to `FILTERS` in `filter-registry.ts`: `apply`, `oracle`, `service`, `diagnose`, `describe`, semantics and `implementedAt`. Remove any `NOT_IMPLEMENTED` placeholder for it.
2. Add its representative / boundary values to `buildCases` (a `dimensions` entry makes it part of the pairwise and covering-array runs automatically).
3. If it reads a new canonical field, add it to `CanonicalCandidate` and to `CANONICAL_SELECT` in `repositories/search-audit.ts`.
4. Add golden fixtures whose correct outcome is obvious, and hand-written `check()`s in `search-qa.test.ts`.
5. `npm run test:recruiter-search`, then `npm run audit:recruiter-search -- --profile=production`.

The admin page and explain mode pick the filter up with no change.

---

## 10. Scale and safety

- CLI audits force `default_transaction_read_only=on` on a direct connection and refuse to start if the session is not read-only. Dual-write is disabled for the process.
- Canonical reads stream in id-cursor batches (`--batch`, default 300, max 1000). Memory is one batch plus the search pool, which the service itself holds per request.
- Case evaluation is in memory over the already-loaded pool: 180+ cases cost milliseconds each. Expected sets are never materialized; only capped id samples (25) and counts are kept.
- Pool caps (600 per challenge/profile track, 200 hackathon, unordered) are reported as `TRUNCATED` — at larger populations they become coverage failures by design, not silently.
- Real `searchCandidates` calls are sequential and bounded (≈30 per full audit).
- No schema change, no migration, no writes.

## 11. Remaining gaps

- **Sync latency** is structurally zero (no index, no cache): documents are built per request. A mutation-based sync test (create / update / withdraw / delete a QA candidate and re-search) needs a non-production database and is not automated yet.
- **Recruiter authorization** (unauthorized / deleted / expired recruiter) needs a session; covered by `npm run test:demo1-security`, not by these audits.
- **Provenance** (§11 of the original brief): `Fact.provenance` on the dossier already records DECLARED / VERIFIED / DERIVED per field, and `SkillEvidence.sourceType` records evidence origin — but `SkillEvidence` has no live writer (CLAUDE.md). The safest incremental step is a writer for `SkillEvidence` from `ActivityEvaluation` / `AssessmentScore` (plan 112 P0-0), then an oracle rule that ranks VERIFIED skills above DECLARED ones. No schema change is required.
