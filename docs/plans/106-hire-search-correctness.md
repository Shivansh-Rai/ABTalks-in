# 106 — Hire search correctness: make the brief actually filter

## 1. Goal

`/hire` returns nearly the same people no matter what the recruiter asks for.
Asking for **13 years of Java** ranks a **0-year student first, as STRONG**, and
"give me only 4 + years" is read as "show me 4 candidates". This plan makes the
stated requirement bind the result set, makes a revised requirement replace the
old one, and makes the desk say out loud what it could not honour.

Scope is the deterministic engine — `pool-brief`, `spec-fields`,
`score-candidate`, `search-candidates`. **The LLM is out of scope on purpose.**
Every defect below reproduces with Groq switched off, which is exactly the
robustness the desk was missing during final testing.

## 2. Current behaviour — reproduced, not guessed

Everything here was run against the real code on `master` @ `69a0142`.

### 2a. The recruiter's actual session, replayed through the deterministic path

```
> "3 students from claude challenge and 2 from cohort challenge"
    poolSources=["PROGRAM","CLAUDE"]  resultLimit=3   minExp=-      ← the "2" is lost
> "i want a backend engineer with 2 years of experience in java"
    title=Backend engineer  stack=["java"]  minExp=2   resultLimit=3
> "give me only 4 + years of candidate"
    minExp=2  ← UNCHANGED          resultLimit=4  ← "4 years" became "4 candidates"
> "SAVP with 13 year of experience"
    title=Backend engineer  stack=["java"]  minExp=2  resultLimit=4  ← NOTHING changed
```

The last two turns changed no filter at all. That is why the same cards came
back, and why the count sat at four.

### 2b. Experience does not filter, and barely ranks

With the coverage the live desk reported (5 of 7 — no graded projects, no
interviews), `reweight` produces:

```
stack 33.3 | missions 26.7 | cleanPass 20 | consistency 13.3 | experience 6.7
query-dependent = 40.0      query-INDEPENDENT = 60.0
```

Sixty points of every score are identical for every search. `experienceScore` is
a soft slope worth **at most 6.7 points**, and `evaluateHardFilters` does not
mention experience at all. Ranking a five-person Java pool:

```
recruiter asks "13+ years java backend":
   89  STRONG  Aarav (student)   ( 0 yrs)     ← ranked first
   86  STRONG  Bhavya (student)  ( 0 yrs)
   85  STRONG  Chirag (student)  ( 1 yr )
   62  PARTIAL Devika           (13 yrs)     ← the person actually asked for
   60  PARTIAL Esha             ( 8 yrs)
```

The 2-year, 4-year and 13-year searches return the same five people in nearly
the same order.

### 2c. The pool itself (live DB, read-only)

| | count |
|---|---|
| `StudentProfile` with `yearsExperience >= 4` | **396** |
| …of those, consented to recruiter search | **3** |
| …of those, clearing the 10-day evidence floor | **1** |
| `ProgramMember` total / with `>= 4` yrs | **64 / 11** |
| Searchable challenge pool with **no** experience data at all | **28 of 30** |

The "Searched 64" in the transcript is the AI Cohort, alone. So even a perfect
filter can only surface ~12 experienced people today. **Step 6 is what stops
this plan from turning one wrong answer into an empty screen.**

## 3. Root causes

| # | Defect | File |
|---|---|---|
| RC1 | `parseResultLimit` matches `only/just/top/give me + N` with the noun optional, so "only 4 + years" and "only 5 years experience" become result caps | `pool-brief.ts:145` |
| RC2 | `applyObviousAnswers` is write-once (`if (next.X == null)`) — a stated requirement can never be revised | `spec-fields.ts:305` |
| RC3 | Experience is absent from `evaluateHardFilters` and worth ≤6.7 pts in the rubric | `score-candidate.ts:251,214` |
| RC4 | 60% of the score is query-independent, so ranking is a fixed leaderboard | `score-candidate.ts:13` |
| RC5 | `briefDelta` never mentions experience, so a dropped filter is silent | `spec-fields.ts:388` |
| RC6 | Each member is scored under **its own** `coverage` (different weight vectors) then sorted into one list — cross-track scores are not comparable | `score-candidate.ts:370` |
| RC7 | `maxExperience` has no deterministic writer at all — only the LLM can set it | `spec-fields.ts` |

## 4. Files to touch

| File | | Note |
|---|---|---|
| `src/features/hire/pool-brief.ts` | `[edit]` | RC1: guard the count regex against duration nouns |
| `src/features/hire/spec-fields.ts` | `[edit]` | RC2, RC5, RC7: revisable fields, experience ranges, delta reporting |
| `src/features/hire/score-candidate.ts` | `[edit]` | RC3, RC4, RC6: experience as a real dimension + comparable weights |
| `src/features/hire/search-candidates.ts` | `[edit]` | Step 6: relaxation ladder + `relaxed` in the result |
| `src/features/hire/types.ts` | `[edit]` | Add the `RelaxationNote` type |
| `src/features/hire/scout-agent.ts` | `[edit]` | Surface relaxation in the fallback line |
| `src/features/hire/spec-fields.test.ts` | `[new]` | Locks the replayed session end-to-end |
| `src/features/hire/score-candidate.test.ts` | `[edit]` | Adds the 13-year ranking case |

**No schema change. No migration. No new abstraction files.**

## 5. Server vs Client

Every file above is server-side or pure. `score-candidate.ts`,
`spec-fields.ts` and `pool-brief.ts` are **pure and must stay pure** —
`pool-brief` is reachable from the client through `guest-matches-store`, so
importing Prisma or `server-only` into it breaks the browser bundle.
`search-candidates.ts` keeps its `server-only`. No component boundary moves, so
no new Server→Client prop crosses.

## 6. Steps

### Step 1 — `pool-brief.ts`: a duration is not a count (RC1)

In `parseResultLimit`, add a shared negative lookahead so a number followed by a
duration noun is never a result cap. Apply it to **all three** branches
(`prefixed`, `counted`, `from`):

```ts
/** "only 4 + years" is a seniority filter, not a request for four people. */
const NOT_A_COUNT = String.raw`(?!\s*\+?\s*(?:years?|yrs?|months?|mos?|weeks?|days?)\b)`;
```

Insert `${NOT_A_COUNT}` immediately after `(${COUNT_TOKEN})` in each pattern.

Required results after the change:

| input | resultLimit |
|---|---|
| `give me only 4 + years of candidate` | `null` |
| `only 5 years experience` | `null` |
| `give me top 5 candidates` | `5` (unchanged) |
| `5 from cohort` | `5` (unchanged) |
| `3 students from claude challenge` | `3` (unchanged) |

### Step 2 — `spec-fields.ts`: let a recruiter change their mind (RC2, RC7)

Replace the write-once guards. A field is **overwritten when this message states
it**, and left alone when it does not. Do not clear a field just because the new
message is silent.

- `seniority`: drop `if (next.seniority == null)`. Assign whenever `firstHit`
  returns a value.
- `workMode`: same.
- `title`: assign whenever a role hint matches; keep the existing "only"
  handling below it unchanged.
- Experience: replace the single `minExperience` regex with a parser that
  handles all four shapes, and **always assigns when it matches**:

```ts
// "4+ years" → min 4, no max.  "2-5 years" → 2..5.
// "under 3 years" → max 3.     "13 year of experience" → min 13.
const RANGE = /\b(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\s*(?:\+)?\s*(?:years?|yrs?)\b/i;
const ATLEAST = /\b(?:at least|min(?:imum)?|over|more than|(\d{1,2})\s*\+)\s*(\d{1,2})?\s*(?:years?|yrs?)?\b/i;
const ATMOST = /\b(?:under|below|less than|at most|max(?:imum)?|up to)\s*(\d{1,2})\s*(?:years?|yrs?)\b/i;
const PLAIN = /\b(\d{1,2})\s*\+?\s*(?:years?|yrs?)\b/i;
```

Precedence: `RANGE` → `ATMOST` → `ATLEAST` → `PLAIN`. A bare `PLAIN` match sets
`minExperience` only (a recruiter saying "13 years" means at least 13).

Guardrail: the existing early return
`if (/\b(not|don't|dont|doesn't|except)\b/i.test(text)) return spec;` stays
exactly where it is — negation must still disable the whole extractor.

Guardrail: keep the `text.length > 400` bail-out. It is what stops a pasted job
description from being mined field by field.

### Step 3 — `spec-fields.ts`: report the experience delta (RC5)

In `briefDelta`, after the `workMode` block, add a bit when either experience
bound changed:

```ts
if (after.minExperience !== before.minExperience ||
    after.maxExperience !== before.maxExperience) {
  const lo = after.minExperience, hi = after.maxExperience;
  if (lo != null && hi != null) bits.push(`${lo}–${hi} yrs`);
  else if (lo != null) bits.push(`${lo}+ yrs`);
  else if (hi != null) bits.push(`under ${hi} yrs`);
}
```

After this, the SAVP turn reads `Noted: Savp · 13+ yrs.` instead of `Noted:`
nothing — which is the whole point: the recruiter can see it landed.

### Step 4 — `score-candidate.ts`: experience becomes a real filter (RC3)

Add a **soft-hard** experience rule alongside the existing must-have-stack
treatment. Do **not** add it to the `reasons` array — that hard-excludes and
would empty the board. Instead return it separately so `tierFor` can act:

1. In `evaluateHardFilters`, compute and return `experienceShortfall: number`
   — years below `effectiveExperienceBand(spec).min`, else `0`. `min == null`
   → `0`. Move `effectiveExperienceBand` above `evaluateHardFilters` so it is
   in scope.
2. Extend `tierFor(score, missingMust, missionsPassed, experienceShortfall)`:

```ts
// A recruiter who asked for 13 years must not be handed a first-year as
// STRONG. Short of the stated band is a gap, exactly like a missing must-have.
if (experienceShortfall > 0) {
  return score >= 40 ? "PARTIAL" : "NONE";
}
```

3. In `scoreCandidate`, push a gap when `experienceShortfall > 0`:
   `` `Below stated experience: ${member.yearsExperience} yrs vs ${min}+ required` ``
   and when the candidate has **no** experience on file
   (`member.yearsExperience === 0` and the band asked for more), push
   `"Experience not on file — confirm at outreach"`. Twenty-eight of the thirty
   searchable challenge candidates are in exactly that state, so this gap will
   be the common one and must read as *unknown*, not as *zero*.
4. In `pickSearchMatches`, treat the shortfall like a must-have miss: build the
   `shown` list from candidates clearing the band **first**, and only fall back
   to below-band people through the Step 6 ladder — never silently.

### Step 5 — `score-candidate.ts`: rebalance and make scores comparable (RC4, RC6)

**5a. Weights.** Change `BASE_WEIGHTS`:

```ts
stack: 25, missions: 18, cleanPass: 12, projects: 12,
consistency: 8, interview: 8, experience: 17,   // sums to 100
```

Under the live 5-of-7 coverage this yields roughly
`stack 35 | experience 24 | missions 25 | cleanPass 17 | consistency 11` —
**query-dependent weight rises from 40 to ~59**, so what the recruiter typed
finally outweighs the fixed leaderboard.

**5b. One weight vector per search.** In `scoreCandidate`, replace
`const coverage = member.coverage ?? searchCoverage;` with:

```ts
// Two vectors are two rubrics, and two rubrics cannot be sorted into one list.
// The member's own coverage still drives which dimensions REPORT null in the
// breakdown; the WEIGHTS come from the search so every card is on one scale.
const reportCoverage = member.coverage ?? searchCoverage;
const weights = reweight(spec.evidencePriority, searchCoverage);
```

Keep `reportCoverage` for the `breakdown()` nulls and the coverage-gated gap
messages. Use `searchCoverage` only for `weights` and `dimensionsUsed`.

**5c.** `experienceScore` keeps its slope for *within-band* ordering — a
14-year candidate should still edge a 13-year one for a 13+ ask. The hard part
of the filter is now `tierFor`, not the slope.

### Step 6 — `search-candidates.ts`: never return a silent empty screen

This is the step that keeps the fix from replacing wrong results with none.
After `pickSearchMatches`, if the list is shorter than `MIN_RESULTS`, relax in
this fixed order, recording each rung:

1. as stated
2. drop `maxExperience` (over-qualified people are shown)
3. halve `minExperience`, floored at 0
4. drop the experience band entirely
5. drop nice-to-have stack

Never relax `mustHaveStack`, and never relax consent, `cohortPublished` or
`status` — those are not preferences.

Add to the `ok: true` payload:

```ts
relaxed: { rung: string; note: string }[]   // [] when nothing was relaxed
```

`note` is recruiter-facing, e.g.
`"Only 1 candidate has 13+ years on file, so this list also shows 4+ years — each card says where it falls short."`

Add `RelaxationNote` to `types.ts` and thread it through `to-public-match.ts`
to the desk. The card gaps from Step 4 already carry the per-candidate truth.

### Step 7 — `scout-agent.ts`: say it in the offline path too

In `fallbackText`, when the search result carries `relaxed.length > 0`, append
the first `note`. The recruiter must learn the pool is thin from the desk, not
from a card that looks like a match and is not.

### Step 8 — tests

`spec-fields.test.ts` `[new]` — replay the four real turns and assert the table
in §2a now reads `minExp 2 → 4 → 13`, `resultLimit 3 → 3 → 3`.

`score-candidate.test.ts` `[edit]` — the §2b pool: assert that for `13+ years`
the 13-year candidate outranks every 0-year student, and that no 0-year
candidate is `STRONG`. Assert the 2-year and 13-year searches now return
**different** orderings.

Also assert `parseResultLimit("only 5 years experience") === null` and
`parseResultLimit("give me top 5 candidates") === 5`.

## 7. Guardrails for Cursor (DO NOT)

- **DO NOT** change `prisma/schema.prisma`, add a migration, or run any
  `db:*`, `migrate` or `seed` command. This plan is code-only.
- **DO NOT** make experience a hard filter in `evaluateHardFilters` `reasons`.
  That empties the board — 28 of 30 searchable challenge candidates have no
  experience on file. It is a tier demotion plus a gap, per Step 4.
- **DO NOT** import Prisma or `server-only` into `pool-brief.ts`,
  `spec-fields.ts`, `score-candidate.ts` or `track-registry.ts`. They are pure
  and reachable from the client bundle.
- **DO NOT** touch `middleware.ts`, `auth.config.ts` or anything on the edge
  import path. Nothing in this plan goes near auth.
- **DO NOT** create new files beyond the one test file listed in §4. Put the
  regex helpers next to their existing callers; no `experience-parser.ts`.
- **DO NOT** relax `mustHaveStack` or any consent/visibility gate in the Step 6
  ladder.
- **DO NOT** remove the `text.length > 400` or the negation early-return in
  `applyObviousAnswers`.
- **DO NOT** change `VIRTUAL_REF_PREFIX`, `encodeCandidateRef`, or any
  `candidateRef` wire format — guest carts in localStorage depend on them.
- **DO NOT** "fix" the low match counts by widening the evidence floor or by
  enabling `HIRE_PRO_PREVIEW`. A thin pool is a true fact and Step 6 states it.
- If a build error contradicts something in this plan, trust the error and
  gather data — do not defend the plan.

## 8. Verification

**Build:** `npx tsc --noEmit` and `npm run build` must both pass clean.

**Unit:** `npx tsx src/features/hire/score-candidate.test.ts` and the new
`spec-fields.test.ts` pass.

**Manual, on `/hire`, with Groq deliberately unset** (`GROQ_API_KEY=` empty) —
this is the path that failed in testing and it must now work alone:

1. "i want a backend engineer with 2 years of experience in java"
   → chip reads `2+ yrs`; cards are Java people.
2. "give me only 4 + years of candidate"
   → the requirement panel now reads **4+ yrs** (not "4 candidates"), and the
   result count is **not** capped at 4.
3. "SAVP with 13 year of experience"
   → the panel reads `13+ yrs`; the reply says `Noted: … 13+ yrs`; the
   ranking changes; no 0-year candidate appears as STRONG; if fewer than five
   clear the band, a relaxation note explains what was widened.
4. Repeat 1 and 3 back to back → the two result sets must differ.

**Exactly these files should have changed** — `pool-brief.ts`,
`spec-fields.ts`, `score-candidate.ts`, `search-candidates.ts`, `types.ts`,
`scout-agent.ts`, `to-public-match.ts`, `score-candidate.test.ts`, and the new
`spec-fields.test.ts`. Nothing under `prisma/`, nothing in `middleware.ts`.

## 9. Commit message

```
fix(hire): make the stated requirement actually filter the search

"only 4 + years" was parsed as a request for four candidates; a revised
experience band was dropped because applyObviousAnswers was write-once; and
experience was worth 6.7 of 100 points and never filtered, so asking for 13
years ranked a 0-year student first as STRONG. Sixty per cent of every score
was query-independent, which is why every search returned the same people.

Counts now ignore duration nouns, stated fields are revisable, experience is
17 points and demotes below-band candidates out of STRONG, and all cards in
one search are scored on one weight vector. When the band leaves too few
people the search relaxes in a fixed order and says so, on the card and in
the reply, rather than showing a short list with no explanation.
```
