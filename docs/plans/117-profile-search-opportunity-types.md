# 117 — Profile-derived discoverability + opportunity-type search filter

## 1. Goal

Make a registered candidate searchable from a usable profile alone — no toggle,
no cohort, no challenge, no evidence — and let recruiters filter candidates on
the five engagement types the candidate already selects on `/profile`.

## 2. Current behavior

### Task 1 — why a profile-only candidate is invisible today

The discovery gate itself is already correct. `searchableUserWhere()`
(`src/repositories/talent.ts`) is `deletedAt: null` + `visibility.is
{ searchableByRecruiters: true, withdrawnAt: null }`, `searchableByRecruiters`
defaults `true`, and `ensureCandidateVisibility` in
`src/repositories/dual-write.ts` creates the row. `openToWork` is deliberately
not part of it (plan 113, asserted in `visibility.test.ts`).

The problem is one layer up: **the pool has no profile-only path.**
`searchCandidates` builds its pool from `enabledTracks()` and `loadTrack()`, and
`track-loaders.ts` has exactly four loaders — `PROGRAM` (a `ProgramMember` in an
open cohort), `CLAUDE` / `CHALLENGE_60` (an `Enrollment` with ≥ `minDays`
submissions), `HACKATHON` (a `HackathonParticipant` whose team has a
submission). A candidate who registered and filled in `/profile` matches none of
these queries, so the gate never gets a chance to let them through.

The evidence floor is **already not an eligibility gate** on this path, and this
plan must keep it that way. Every call site:

| Call site | What it does today | Change |
| --- | --- | --- |
| `pool-policy.ts` `MIN_EARNED_MISSIONS` / `clearsEvidenceFloor` | Pure predicate | none |
| `track-loaders.ts:111` (`loadProgram`) | Counts `belowEvidenceFloor`; **keeps** below-floor members in `members` | none |
| `pool-facts.ts:106` | Computes `withEvidence` for a **stat only**; `eligible` counts everyone | none |
| `search-candidates.ts` | Reports `belowEvidenceFloor` as a number; never filters on it | none |
| `pool-policy.ts` `resolveEligibleCandidates` | Filters on `flag.minDays` (challenge submissions), not the floor | none — but the new `PROFILE` source must be resolvable here |

So Task 1 is additive: a fifth track whose eligibility is profile state.

### Task 2 — why opportunity types cannot be filtered

The candidate side is **already complete**: `OpportunityType` has all five
values (`INTERNSHIP`, `FULL_TIME`, `PART_TIME`, `CONTRACT`, `FREELANCE`),
`preferences-section.tsx` renders every one via `PwCheckGroup`,
`preferencesSchema` accepts them, and `savePreferences` writes
`CandidatePreference.opportunityTypes`.

Nothing reads it. `listCandidateAvailability`
(`src/repositories/candidate.ts:377`) selects eight preference columns and
`opportunityTypes` is not among them, so it never reaches
`AvailabilitySnapshot`, `evaluateHardFilters`, or any recruiter surface.

Separately, the recruiter-side vocabulary is wrong: `spec.employmentType` is a
single value and its parser
(`scout-conversation.ts:175`, `:402`) knows only
`FULL_TIME | CONTRACT | INTERNSHIP | PART_TIME` — **`FREELANCE` is missing**, so
a recruiter asking for freelancers is silently ignored.

## 3. Files to touch

**Task 1**

- `prisma/schema.prisma` `[edit]` — add `PROFILE` to `enum TalentCandidateSource`.
- `prisma/migrations/20260910130000_talent_source_profile/migration.sql` `[new]` — `ALTER TYPE … ADD VALUE 'PROFILE'`.
- `src/features/hire/candidate-ref.ts` `[edit]` — allow `PROFILE` as a `CandidateSource`.
- `src/features/hire/track-registry.ts` `[edit]` — `PROFILE` descriptor, lowest `dedupePriority`.
- `src/repositories/hire.ts` `[new fn]` — `listProfileCandidates()`: the usable-profile query, merged with `searchableUserWhere()`.
- `src/features/hire/profile-dossier.ts` `[new]` — `buildProfileDossierSet()`, modelled on `hackathon-dossier.ts`.
- `src/features/hire/track-loaders.ts` `[edit]` — `loadProfile()` + `case "PROFILE"`.
- `src/features/hire/pool-policy.ts` `[edit]` — resolve `PROFILE` refs in `resolveEligibleCandidates`.

**Task 2**

- `src/repositories/candidate.ts` `[edit]` — select `opportunityTypes`; add to `CandidateAvailabilityView`.
- `src/repositories/types.ts` `[edit]` — `CandidateAvailabilityView.opportunityTypes`.
- `src/features/hire/types.ts` `[edit]` — `AvailabilitySnapshot.opportunityTypes`.
- `src/features/hire/dossier.ts`, `challenge-dossier.ts`, `hackathon-dossier.ts`, `profile-dossier.ts` `[edit]` — carry it through each snapshot build.
- `src/features/hire/score-candidate.ts` `[edit]` — engagement-type overlap hard filter.
- `src/features/hire/scout-conversation.ts` `[edit]` — add `FREELANCE` to both parsers.
- `src/features/hire/scout-tools.ts` `[edit]` — document/accept `FREELANCE`.

**Tests**

- `src/features/hire/visibility.test.ts` `[edit]` — usable-profile definition, zero-evidence regression, payload audit, engagement overlap.

## 4. Server vs Client

Everything here is **server-only**. `profile-dossier.ts`, `track-loaders.ts`,
`repositories/*` all carry `import "server-only"`.

`track-registry.ts` is deliberately **pure** (no Prisma, no `server-only`) —
`pool-brief.ts` imports it and is reachable from the client through
`guest-matches-store`. The `PROFILE` descriptor must stay data-only; its loader
lives in `track-loaders.ts`.

No Server→Client prop passing changes. `MatchCardData` is unchanged by this plan
(see §5 decision 5), so no new value crosses the boundary.

## 5. Decisions

**1. "Usable profile" =** `searchableUserWhere()` (searchable + not withdrawn +
not deleted) **AND ≥1 claimed skill** (`CandidateSkill.claimedByCandidate =
true`) **AND a non-blank `fullName`**.

No opt-in toggle. Not `openToWork`. Not completeness score — completeness is a
UX number that explicitly "gates nothing" (`completeness.ts`), and binding
discovery to it would make a scoring tweak silently change who is findable.
The skill floor is not an evidence floor: it is what makes the row *matchable*
at all, since every search is stack-matching. A candidate with zero skills can
never match a requirement, so including them is noise, not reach.

**2. Evidence floor:** unchanged and still non-excluding. Audited every call
site in §2 — none of them filters the pool. The new track passes
`belowEvidenceFloor: 0` and never consults `clearsEvidenceFloor`. A test asserts
a zero-evidence profile candidate survives ranking.

**3. Membership:** challenge/cohort membership stays required for the four
existing tracks; profile-only candidates enter through the **new `PROFILE`
track** rather than being back-filled into an existing one. This keeps each
track's evidence contract honest — a profile candidate has no missions, and
faking them into `PROGRAM` would corrupt both scoring and the cards.

**4. Task 2 semantics:** `spec.employmentType` stays a single value (it is what
the *role* is), and the candidate side is the multi-value list. The filter is
**ANY overlap**: exclude only when the recruiter named a type AND the candidate
stated a non-empty list AND that list does not contain the type. An empty list
means *unstated*, which never excludes — the same convention `availability ==
null` already uses. `FREELANCE` is added to the recruiter vocabulary.

**5. Payload audit.** `toPublicMatch` is the only mapper to the browser, and
`pickPublicEvidence` is an explicit whitelist. Allowed: name, role label, role
family, skills, mission/clean-pass/commit counts, project scores, years,
working languages, cohort day, certificate flag, quiz average, education level,
work mode, `githubConnected` / `linkedinConnected` **booleans**, interview
sub-scores, indicative salary band, `openToWork`. Never present: phone, email,
`resumeUrl`, `linkedinUrl`, `githubUsername`, `company`, `userId`,
`expectedSalary*`. **This plan adds no field to the card** — the acceptance
criteria only need the filter to work server-side, and leaving the payload
untouched keeps the audit trivially true.

## 6. Guardrails for Cursor (DO NOT)

- **DO NOT** put any contact field (phone, email, resume/LinkedIn/GitHub URL) into a dossier, `ScoreableMember`, or `MatchCardData`. Links are booleans.
- **DO NOT** make `openToWork` a discovery condition. It is a badge and an optional filter (plan 113). `searchableUserWhere` must never reference it.
- **DO NOT** turn evidence into an eligibility condition anywhere. `clearsEvidenceFloor` may rank or count; it may not filter.
- **DO NOT** add a second visibility clause. The gate is `searchableUserWhere()` merged in `repositories/hire.ts`; do not re-implement it per track.
- **DO NOT** import Prisma or `server-only` into `track-registry.ts` — it reaches the client bundle.
- **DO NOT** rename the four legacy track slugs; they are persisted in localStorage carts and match rows.
- **DO NOT** apply the migration. Additive enum value only; run it on a Neon child branch first.
- **DO NOT** exclude a candidate whose `opportunityTypes` is empty.

## 7. DB safety

One additive change: `ALTER TYPE "TalentCandidateSource" ADD VALUE 'PROFILE'`.
Additive, zero-downtime, no backfill, no data rewritten. Task 2 needs **zero**
schema change — the enum and the array column already exist.

Commit checkpoint before running; snapshot a Neon child branch; note the commit
hash; then `npx prisma migrate deploy` against the branch before production.

## 8. Verification

`npx tsc --noEmit`, `npx eslint`, and:

- `npm run test:hire-visibility` (extended): gate shape unchanged; gate has no `openToWork`; usable-profile predicate requires a claimed skill; **zero-evidence profile candidate is not hard-filtered**; engagement overlap includes/excludes correctly and never excludes on an empty list; payload whitelist contains no contact key.
- `npm run test:hire-score` — existing hard-filter suite still green.

Manual:

1. Fresh account → register → `/profile` → add one skill → save. Recruiter search returns them with no toggle touched and no cohort/challenge activity.
2. Same candidate, no skills → not returned (and adding a skill makes them appear).
3. Candidate ticks Internship + Freelance → recruiter asks for freelancers → candidate returned; asks for full-time → candidate excluded.
4. Candidate ticks nothing → returned for every engagement type.
5. Inspect a match card payload in the network tab: no phone, email or URL.

Changed files should be exactly those in §3.

## 9. Commit message

```
feat(hire): profile-derived discoverability + opportunity-type filter

A registered candidate with a usable profile — searchable, not withdrawn,
at least one claimed skill — is now returned by recruiter search with no
toggle and no cohort, challenge or hackathon activity, through a new
PROFILE track rather than by faking evidence into an existing one.

Candidate opportunity types (all five) now reach recruiter search as an
ANY-overlap hard filter, and FREELANCE is added to the recruiter
vocabulary that previously dropped it silently. Evidence still ranks and
never excludes; the match payload is unchanged and carries no contact
field.
```
