# 139 — Inspector: Experience vs ABTalks Evidence

## 1. Goal

Stop treating Claude / Platform tracks as jobs on the recruiter Scout inspector.
Move verified track proof into an ABTalks Evidence section, and fill Experience
from `CandidateExperience` (what the candidate typed or what resume merge wrote).

## 2. Current behavior

The inspector fakes Experience from `match.source`: the org title is
`trackLongLabel` ("Claude challenge", "US cohort", "60-day challenge") and the
"roles" are days shipped, missions, commits, quizzes. Real jobs already live in
`CandidateExperience` and never reach the inspector. `/profile` is already
correct and is not changed.

## 3. Files to touch

- `docs/plans/139-inspector-experience-vs-evidence.md` `[new]` — this plan.
- `src/repositories/candidate-detail.ts` `[edit]` — `listPublicWorkHistory(userId)`.
- `src/app/actions/hire-view-actions.ts` `[edit]` — `loadInspectorWorkHistoryAction`.
- `src/components/hire/candidate-inspector.tsx` `[edit]` — split sections; fetch jobs on open.
- `src/features/hire/contact-payload.test.ts` `[edit]` — Experience is not the track; action has no contact select.
- `docs/CHANGELOG.md` `[edit]` — one Pending reconcile line.

## 4. Server vs Client

- `listPublicWorkHistory` — server-only repository.
- `loadInspectorWorkHistoryAction` — Server Action; returns `{ ok, data | message }`.
- `CandidateInspector` — client; fetches work history on open. No functions/icons across the boundary.

## 5. Steps

1. Add `listPublicWorkHistory`: `hasNoWorkExperience` + experience rows only. No phone, email, LinkedIn, GitHub, resume URL.
2. Add `loadInspectorWorkHistoryAction({ candidateRef })`: Zod → SAMPLE/invalid → empty → `resolveEligibleCandidates` → `listPublicWorkHistory`. Ineligible → empty, no leak.
3. Inspector: tab `ABTalks Evidence` after Experience. Experience renders fetched jobs. Evidence gets the current track timeline. Fetch on open, ignore a slow previous candidate.
4. Tests + CHANGELOG one-liner.

## 6. Guardrails for Cursor (DO NOT)

- DO NOT call `getCandidateDetail` from hire (it selects phone and URLs).
- DO NOT add `company` / employer onto `toPublicMatch`.
- DO NOT require contact unlock for work history.
- DO NOT write Experience from enrollments or dual-write `ProgramMember`.
- DO NOT restyle the inspector; only split sections and bind real rows.
- DO NOT edit `/profile` Experience or Accomplishments.
- DO NOT put work history on `MatchCardData`.
- DO NOT scrub CandidateExperience rows whose company happens to say "Claude".

## 7. DB safety

Read only. No migration, seed, or Neon write.

## 8. Verification

`npx tsc --noEmit`. Hire contact-payload tests. Source assertions: action uses
`resolveEligibleCandidates` + `listPublicWorkHistory`; select list has no
email/phone.

Manual: Scout → Claude candidate → Experience shows employers from profile/resume,
not "Claude challenge"; ABTalks Evidence shows days shipped. Same split for
US-cohort / 60-day. Empty Experience when no rows; email/phone stay locked.

## 9. Commit message

```
fix(hire): show real jobs in inspector Experience, tracks in ABTalks Evidence

The Scout inspector was using the Claude/Platform track as a fake employer.
Experience now loads CandidateExperience (typed or resume-merged) behind the
searchable-pool gate; verified track counts move to ABTalks Evidence.
```
