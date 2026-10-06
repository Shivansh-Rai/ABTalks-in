# 172 — A searched-for skill must survive the card's cut

Status: IMPLEMENTED (2026-10-01). Written alongside the change, as the record a
cross-module reviewer needs.

## 1. Goal

When a recruiter searches for a skill, every surface that names a subset of a
candidate's skills must name that one. Reported case: a search for "snowflake"
returned cards whose eight chips never said Snowflake, and a detail panel whose
summary sentence listed eight other skills.

## 2. Current behaviour (before this change)

The data was never wrong — `highlightSkills` is set from `spec.mustHaveStack`
(`hire-actions.ts:415,841`) and re-derived on reload
(`load-request-matches.ts:237`). Three surfaces simply did not read it:

- `desk-match-card.tsx:363` — `skills.slice(0, CARD_SKILLS)` on the raw stored
  order. CARD_SKILLS is 8; the reported candidate had 16 skills with Snowflake
  at position 12, so it sat behind "+7".
- `candidate-summary.ts:156` — `skillList` took the first N stored skills, so
  the card sentence read "lists Python, sql and Power BI" on a Snowflake search.
- `explain-matches.ts:310` — `buildRationale` built the stored rationale (what
  the detail panel prints) with no access to the spec, so its eight-skill
  sentence also missed the searched skill.
- `candidate-inspector.tsx:340` — the Skill Map printed every skill, in stored
  order, with no marking. Nothing was hidden, but a searched skill could be the
  twelfth of twenty-six chips. This is the "sometimes visible in the sidebar"
  half of the report.

Two surfaces already did it right (`match-card.tsx`, `buildCardPills`), each
with its own copy of the logic — and the copies had drifted: `buildCardPills`
used a bare `includes`, so "java" lit up "JavaScript".

## 3. Files touched

- `src/features/hire/skill-highlight.ts` [new] — `skillHighlighted` (word
  boundary) + `orderedSkills` (stable hoist). One implementation.
- `src/features/hire/skill-highlight.test.ts` [new] — 15 assertions; two of them
  reproduce the reported bug as a precondition.
- `src/components/hire/desk-match-card.tsx` [edit] — order before slicing; mark
  the hits. The shortlist snapshot keeps the candidate's own order.
- `src/components/hire/match-card.tsx` [edit] — local copies deleted, imports
  the shared helper. No behaviour change.
- `src/components/hire/hire-card-facts.tsx` [edit] — `buildCardPills` loses its
  loose `includes`. Behaviour change: "java" no longer matches "JavaScript".
- `src/components/hire/candidate-inspector.tsx` [edit] — Skill Map ordered and
  hits marked.
- `src/features/hire/candidate-summary.ts` [edit] — `SummaryInput.highlightSkills`,
  honoured by `skillList`; `summaryInputFromMatch` passes it through.
- `src/features/hire/explain-matches.ts` [edit] — threads `spec.mustHaveStack`
  into the stored rationale. `givenName: null` is untouched: this sentence is
  persisted and must stay identity-free.
- `src/app/hire/hire-scout.css` [edit] — `.desk-chip--hit`,
  `.hire-profile__chip--hit`, both with dark-mode rules, matching the existing
  `.desk-pill--hit` treatment.
- `package.json` [edit] — `test:skill-highlight`.

## 4. Server vs Client

`skill-highlight.ts` is a pure module with no `server-only`, deliberately: it is
imported by client components (`desk-match-card`, `match-card`,
`hire-card-facts`, `candidate-inspector`) and by server code (`explain-matches`
via `candidate-summary`). Only strings cross the boundary — no functions, icons
or class instances. No component changed its server/client designation.

## 5. Guardrails observed

- No new abstraction beyond the one file that removes three copies.
- No change to ranking, scoring, filtering or which candidates are returned —
  this is presentation order within an already-ranked result.
- No schema change, no migration, no DB write.
- The shortlist snapshot keeps the candidate's own skill order: it is a record
  of their stack, not of this search.
- Stored rationales stay identity-free.

## 6. Verification

Offline:
- `npx tsc --noEmit` — clean.
- `npm run test:skill-highlight` — 15 passed.
- `test:candidate-summary-ai` 25, `test:sample` 35, `test:hire-score` 30,
  `test:scout` 63, `test:recruiter-search` 80, `test:match-persistence` 5,
  `test:virtual` 28 — all passing.
- `eslint` on the touched files reports the same 7 pre-existing problems as on
  a clean checkout; none added.

In the browser (`/hire` guest path, `abtalks-plain-dev`), which is where this
bug was visible and where the suites cannot reach:
- "Data engineer with Snowflake" → 19 results. All 10 cards on page 1 lead with
  a tinted Snowflake chip; all 10 summaries name it.
- The 26-skill candidate's panel summary went from "lists Python, azure, C++,
  sql, MongoDB, FastAPI, Git and AWS" to "lists Snowflake, Python, azure, C++,
  sql, MongoDB, FastAPI and Git"; the Skill Map leads with a tinted Snowflake.
- "Data analyst skilled in DAX and Databricks" → both needles hoisted and
  marked out of a 26-skill list.
- No console errors.

## 7. Commit message

    fix(hire): show the searched-for skill on the card, not behind "+N"

    The desk result card drew eight chips from the candidate's stored skill
    order, so a recruiter searching "snowflake" could get a card whose chips
    never said Snowflake — it was sitting at position twelve. The card summary
    and the stored rationale picked their skills the same way.

    `highlightSkills` was already on the data; three surfaces just did not read
    it. Hoist matched skills before the cut, and mark them.

    One shared `skill-highlight` module replaces three copies of this logic.
    One of them had drifted to a bare substring match and lit up "JavaScript"
    for a recruiter who asked for "java"; it now uses the word-boundary rule
    the other two already had.
