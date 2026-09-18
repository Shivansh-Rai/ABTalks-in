# 147 — Recruiter Search QA, Audit and Data Quality System

## 1. Goal

Give ABTalks a continuously runnable answer to *"does recruiter search return
exactly the candidates it should, for every eligible candidate?"* — and keep
search bugs, stale documents, bad candidate data, normalization gaps and ranking
choices apart, with candidate IDs for every discrepancy.

## 2. Current behavior (Phase 1 discovery, verified against code 2026-09-15)

### 2.1 How recruiter search works end to end

```
Recruiter UI (/hire desk, Scout chat, filter dialog, guest desk)
  → Server Actions  hire-actions.ts (runMatchAction, applyHireFiltersAction,
                    sendScoutMessageAction), hire-guest-actions.ts
  → features/hire/search-candidates.ts  searchCandidates(spec, {limit})
      → track-registry enabledTracks()        PROGRAM, CLAUDE*, CHALLENGE_60*,
                                              PROFILE, HACKATHON  (*HIRE_CHALLENGE_POOL)
      → track-loaders loadTrack(slug)         per-track dossier builders
          → repositories/hire.ts              Prisma reads, visibility gate merged in
      → mergeTrackLoads                       one card per userId, dedupePriority
      → score-candidate rankCandidates(limit 100)  pure, deterministic, no LLM
      → pickSearchMatches(limit 20)           must-have AND gate, tier gate, padding
  → explain-matches (Groq rationale text only) → TalentRequestMatch + TalentSearchSession
```

**There is no search index.** No Elasticsearch / Meilisearch / FTS / vector
store serves recruiter search. The "search document" is the per-track
`CandidateDossier` assembled *per request* from live tables. Its read source
depends on `ENABLE_NEW_TALENT` (production: ON since 2026-08-27):

| Flag | Identity / skills / education read from |
|---|---|
| ON  | `CandidateProfile`, `CandidateSkill`→`Skill`, `CandidateEducation`, `CandidateExperience` (078 canonical) |
| OFF | legacy mirrors `StudentProfile` / `ProgramMember` |

Two persisted copies behave like an index and can go stale:
`TalentRequestMatch` (re-gated for visibility on read, frozen evidence) and
`TalentSearchSession.resultCandidateIds/resultSnapshot`.

### 2.2 Source of truth

`User` + `CandidateVisibility` + `CandidateProfile` and its children
(`CandidateSkill`, `CandidateEducation`, `CandidateExperience`,
`CandidatePreference`) are canonical (CLAUDE.md: legacy tables are mirrors).
Track membership is canonical in `ProgramMember`+`ProgramCohort`,
`Enrollment`+`Submission`, `HackathonParticipant`+`HackathonSubmission`.

### 2.3 Eligibility (as implemented)

Gate (`searchableUserWhere`): `deletedAt IS NULL`, `disabledAt IS NULL`,
`CandidateVisibility.searchableByRecruiters = true`, `withdrawnAt IS NULL`.
Plus membership in at least one enabled track:

| Track | Rule |
|---|---|
| PROGRAM | ProgramMember ENROLLED/COMPLETED in a cohort that is published, or in `HIRE_OPEN_COHORT_IDS` (`all` = ENROLLING/ACTIVE) |
| CLAUDE / CHALLENGE_60 | `HIRE_CHALLENGE_POOL` set; Enrollment in domain with submissions ≥ max(flag minDays, stated days) |
| HACKATHON | participant whose team has a submission |
| PROFILE | `CandidateProfile.fullName` not `""` and ≥1 `claimedByCandidate` skill |

### 2.4 Filter inventory (as implemented)

Hard filters (`evaluateHardFilters`, exclude): openToWork (`extra.openToWork`),
salaryMax vs expectedSalaryMin, noticePeriodDays, employmentType (ANY overlap
with opportunityTypes, empty = unstated), workMode (FLEXIBLE wildcard),
locationCity vs preferredLocations (skipped when relocate / empty).
**All hard filters pass when the candidate has no `CandidatePreference` row.**

Match gate (`pickSearchMatches`): mustHaveStack — **AND** across tokens,
whole-word containment on skill names. Tier NONE only shown as padding.

Pool filters: track slugs (**OR**), geo → tracks, minEvidenceDays (challenge
only), resultLimit (hard cap ≤ 25).

Rank-only (never exclude): min/maxExperience, seniority, niceToHaveStack,
evidencePriority. Unused: `title`, `requiresDegree`, `openings`.

**Not a recruiter filter today:** graduation year, college, degree, branch,
current/target role, profile completion, verified skills, GitHub, LeetCode,
projects, assessments, evidence, certifications.

Sort: one — score desc, then name / candidateRef asc. Pagination: none —
top-N (default 20, cap 25) out of a 100-candidate rank window, from pools
capped at 600 (challenge, profile) and 200 (hackathon, unordered).

## 3. Gap analysis (Phase 2)

| Requirement | Today |
|---|---|
| Coverage audit | none (plan 119 was a one-off manual SQL audit) |
| Filter correctness vs canonical DB | none; `score-candidate.test.ts` tests pure functions on synthetic members |
| Combination / pairwise tests | none |
| Golden dataset | none (`seed-hire-fixtures.ts` seeds demo data, no assertions) |
| Data-quality audit | none |
| Normalization audit | `skill-catalog.ts` / `canonicalDegree` exist; not applied to search, not audited |
| Index consistency | `db:check:078:drift` covers legacy↔078 row drift, not search documents |
| Error classification | none |
| Explain mode | none (score breakdown persisted, no filter trace) |
| Pagination / sort tests | none |
| Privacy tests | `visibility.test.ts` — source scan + gate shape (good; kept) |
| Admin health page | none |

### Bugs found during discovery (evidence and proposed fixes in `src/features/search-qa/known-issues.ts`)

1. ~~Work-mode filter compares profile labels `Remote/Hybrid/On-site/Flexible` to enums with `!==`~~ — **FIXED 2026-09-16**: `normalizeWorkMode` folds both sides in `evaluateHardFilters`; an unparseable value now reads as unstated.
2. ~~"Not decided" salary (`salaryMin 0, salaryMax 0`) is treated as a ₹0 budget~~ — **FIXED 2026-09-16** (`effectiveBudget`).
3. ~~Skipped city (`locationCity "Any"`) is treated as a city named "any"~~ — **FIXED 2026-09-16** (`effectiveCity`).
4. ~~`splitSkills` breaks canonical skill names containing `/` or `&` ("AI/ML", "UI/UX", "CI/CD"), so they cannot match themselves~~ — **FIXED 2026-09-17**: catalog names and short compounds stay whole; `stackTokensMatch` matches a compound part exactly. Pastes split as before.
5. ~~`loadRecruiterIdentities` picks education `orderBy graduationYear desc` — Postgres puts NULLs first~~ — **FIXED 2026-09-16** (`nulls: "last"`, both call sites in `repositories/talent.ts`).
6. ~~Rank window of 100 is taken before the must-have gate~~ — **FIXED 2026-09-17** (QA-KI-006): `selectSearchResults` (score-candidate.ts) ranks the whole pool; `searchCandidates` and the QA probe both call it. Near misses are keyed by `candidateRef` (they were keyed by `programMemberId`, which dropped every non-cohort candidate from the gap report).
7. ~~`loadRequestMatches` renders `PROFILE` matches as `CLAUDE:` refs~~ — **FIXED 2026-09-17** (QA-KI-007): `savedMatchRef` validates against the track registry; saved lists order tier, score, first seen, candidate id.
8. ~~Profile-only candidates with only declared skills can outrank evidence-backed ones~~ — **FIXED 2026-09-17** (QA-KI-008): `rankCandidates` lists by tier (STRONG, PARTIAL, NONE), then score.
9. ~~Skill and city matching ignore the catalog's own aliases (golang/Go, reactjs/React, Bangalore/Bengaluru)~~ — **FIXED 2026-09-17** (QA-KI-009): `sameSkill` folds through `canonicalSkillName` (+ symbol-safe squash), `cityKey` folds unambiguous renames and typos; NCR cities are never merged.
10. ~~(Found 2026-09-17 after merging master) The admin "Recruiter search" panel counts any challenge submission and any `ProgramMember` row as a carrying track~~ — **FIXED 2026-09-17** (QA-KI-011): `get-candidate-discoverability.ts` probes the `HIRE_CHALLENGE_POOL` floor and `resolvePoolCohorts`; the full audit runs the real panel loader for every searchable candidate.
11. ~~Scout's stack parser misses "c++"~~ — **FIXED 2026-09-17** (QA-KI-010): explicit edges instead of `\b` in `pool-brief.ts`.

## 4. Files to touch

- `src/features/search-qa/types.ts` [new] — categories, severities, findings, readiness.
- `src/features/search-qa/canonical.ts` [new] — canonical snapshot type + eligibility oracle (independent of loaders).
- `src/features/search-qa/normalize.ts` [new] — safe normalizers (city, work mode, skill, degree), ambiguity sets, clustering.
- `src/features/search-qa/filter-registry.ts` [new] — every recruiter filter as data: semantics, spec mapping, oracle, stale probe, sample values.
- `src/features/search-qa/compare.ts` [new] — expected-vs-actual engine + classifier.
- `src/features/search-qa/combinations.ts` [new] — singles, pairwise, curated high-risk, seeded random specs.
- `src/features/search-qa/probe.ts` [new, server-only] — runs the real pipeline (loadTrack → mergeTrackLoads → rankCandidates → pickSearchMatches) at full depth + page.
- `src/features/search-qa/data-quality.ts` [new] — pure data-quality rules.
- `src/features/search-qa/index-consistency.ts` [new] — document vs canonical field diff.
- `src/features/search-qa/explain.ts` [new] — "why is/isn't candidate X in this search".
- `src/features/search-qa/audit.ts` [new, server-only] — orchestrates coverage, filters, combos, pagination, sort, privacy, perf, persisted results.
- `src/features/search-qa/report.ts` [new] — text report + readiness.
- `src/features/search-qa/known-issues.ts` [new] — strict xfail registry (a fixed bug fails the suite until removed).
- `src/features/search-qa/golden.ts` [new] — deterministic QA candidate dataset + offline pool builder.
- `src/features/search-qa/search-qa.test.ts` [new] — offline: unit, golden, engine self-tests, pagination, sort, privacy, text parsing.
- `src/repositories/search-audit.ts` [new, server-only] — batched read-only canonical reads.
- `src/app/admin/search-health/page.tsx` [new] — Server Component, `requireAdmin`.
- `scripts/search-qa/read-only-env.ts` [new] — forces a read-only DB session before Prisma loads.
- `scripts/search-qa/audit.ts` [new] — CLI for `audit:*`.
- `src/features/hire/search-candidates.ts` [edit] — export `CHALLENGE_POOL_CAP`, `MIN_RESULTS`, `RANK_WINDOW` (no behaviour change).
- `src/repositories/hire.ts` [edit] — export `HACKATHON_POOL_TAKE` as the existing default (no behaviour change).
- `src/features/search-qa/probe.ts`, `explain.ts` [new] — listed above; `index-consistency.ts` [new] — document vs canonical drift.
- `.github/workflows/recruiter-search-qa.yml` [new] — offline suite + hire-score + visibility on PRs touching search.
- `src/features/admin/admin-nav.ts` [edit] — "Search Health" item (reuses `search` icon).
- `package.json` [edit] — scripts.
- `docs/architecture/recruiter-search-qa.md` [new] — operating manual.
- `docs/CHANGELOG.md` [edit] — pending reconcile line.

## 5. Server vs Client

All new `src/features/search-qa` modules that touch Prisma carry
`import "server-only"`. `/admin/search-health` is a Server Component with
plain HTML forms; no client component, no Server→Client props.
Nothing is imported by `middleware.ts`.

## 6. Guardrails (DO NOT)

- DO NOT write to any database from an audit. CLI audits force
  `default_transaction_read_only=on` on a direct connection.
- DO NOT fix search behaviour in this change — failures are reported and
  pinned as strict known issues; fixes are separate, reviewed changes.
- DO NOT derive expected sets by calling the scorer; oracles are independent.
- DO NOT print email, phone or URLs in reports beyond a truncated offending value.
- DO NOT expose `/admin/search-health` without `requireAdmin`.
- DO NOT seed QA candidates into production (the golden set is in-memory).

## 7. DB safety

No schema change, no migration, no seed. Read-only.

## 8. Verification

`npx tsc --noEmit`; `npm run test:recruiter-search` (offline);
`npm run test:hire-score`, `npm run test:visibility` still green;
`npm run audit:recruiter-search -- --profile=production` against a read-only
session; open `/admin/search-health` as admin.

## 9. Commit message

```
feat(search-qa): recruiter search audit, golden regression and data-quality system
```
