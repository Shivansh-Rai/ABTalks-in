# 145 — Inspector ABTalks Evidence: completions and wins only

## Goal

Scout inspector **ABTalks Evidence** lists only what the platform can attest as finished or placed: 50+ completed days on any 60-day challenge (AI / SE / DS / Claude), any non-mirror cohort marked complete (AI Cohort, Databricks, etc.), and ViCoDathon Winner / Runner Up / Second Runner Up / Top 5. In-progress enrollment, participation, and the current “Days shipped 0” search-track block go away.

## Why the screenshot is wrong today

The tab renders `match.evidence` for **one** search source. Claude cards always title the org “Claude challenge” and show `_count.submissions` as days shipped — including 0. Enrollment status is never sent to the client. Completions already live in `src/features/profile/get-verified-accomplishments.ts` for `/profile`; hire never calls it.

## Bars (recruiter / wins-only)

- **Challenges (all four domains):** `getChallengeProgressStats(enrollmentId).daysCompleted >= 50`. Same constant as today (`CHALLENGE_ELIGIBLE_DAYS = 50`). Claude is **not** certificate-gated on this path (the profile path stays certificate-gated for Claude).
- **Cohorts:** `ProgramEnrollment` with `COMPLETED` or `completedAt` set; exclude `legacy-ai` / `legacy-ds` / `legacy-se` / `legacy-claude` mirrors so a challenge is not listed twice. Real AI Cohort (`legacy-program-<id>`) and 078-native programs (databricks, etc.) stay.
- **Hackathon:** only if a placement credential exists (`winner` / `second` / `third` / `top5`). Labels stay **Winner / Runner Up / Second Runner Up / Top 5**. No “Participated”.
- **Not shown:** ACTIVE enrollment, days 1–49, waived cohort start days, SkillEvidence, contact.

`/profile` Accomplishments keep current defaults (Claude still certificate-gated; hackathon still allows participation). Recruiter view is the new mode.

## Files to touch

- `docs/plans/145-inspector-verified-evidence.md` `[new]` — this plan.
- `src/features/profile/get-verified-accomplishments.ts` `[edit]` — optional second argument `mode: "profile" | "wins-only"` (default `"profile"`). Wins-only: include `Domain.CLAUDE` in the 50-day loop; skip the Claude-certificate-only block; emit a hackathon row only when `best` placement is set. Same reads, still no writes.
- `src/app/actions/hire-view-actions.ts` `[edit]` — `loadInspectorTrackEvidenceAction`, copy of `loadInspectorWorkHistoryAction`: Zod `candidateRef` → SAMPLE/invalid/ineligible → `{ items: [] }` → `resolveEligibleCandidates` → `getVerifiedAccomplishments(userId, "wins-only")`. Map `occurredAt` to ISO string | null. No `getCandidateDetail`, no email/phone/URLs.
- `src/components/hire/candidate-inspector.tsx` `[edit]` — fetch that action in the existing on-open `Promise.all` (with work history + links). Evidence section lists items with existing `hire-profile__roles` markup: title, `outcomeLabel` as badge, `detail` as meta. Empty: “No completed tracks or placements recorded.” Keep est. compensation under the list (it already lives in this section). Stop using `match.source` / `missions` / `firstAttempt` / `commits` as the evidence body.
- `src/features/hire/contact-payload.test.ts` `[edit]` — action uses pool gate + `getVerifiedAccomplishments`; select has no contact; inspector evidence is fetched completions, not `track ??`.
- `src/features/profile/profile.test.ts` `[edit]` — wins-only: Claude in the 50-day path; hackathon row requires a placement variant; default export still used by `/profile`.
- `docs/CHANGELOG.md` `[edit]` — one Pending reconcile line.

## Server vs Client

- Derivation + action: server-only.
- Inspector: client; payload is `{ items: { key, title, detail, outcomeLabel, occurredAt }[] }`. No functions across the boundary.

## Steps

1. Add `mode: "profile" | "wins-only"` to `getVerifiedAccomplishments`. Default `"profile"` keeps `/profile` behaviour. Wins-only includes Claude in the 50-day enrollment loop, skips the certificate-only Claude block, and emits a hackathon row only when a placement variant is present.
2. Add `loadInspectorTrackEvidenceAction` in `hire-view-actions.ts`, same pool gate as work history.
3. Inspector: fetch on open with work history and links; render completions in the Evidence section; keep compensation under the list.
4. Tests + CHANGELOG one-liner.

## Guardrails for Cursor (DO NOT)

- Do not change `/profile` Accomplishments default behaviour.
- Do not call `getCandidateDetail` from hire.
- Do not require contact unlock for this list.
- Do not put evidence on `MatchCardData` or re-rank search.
- Do not restyle the inspector; reuse role-row markup.
- Do not edit `/hire/evidence` `EvidenceResumeBody` (Resume embed stays the match snapshot).
- Do not write `SkillEvidence` / `CandidateAchievement`.
- Do not treat challenge-mirror `ProgramEnrollment` as a cohort win.
- Do not show hackathon participation as evidence.
- Middleware / `auth.config.ts` untouched.

## DB safety

Read only. No migration, seed, or Neon write.

## Verification

`npx tsc --noEmit`. Hire contact-payload tests; profile tests covering wins-only vs profile mode.

Manual: Scout → candidate with 50+ Claude/AI/SE/DS days → Evidence shows that challenge as Completed with day count; in-progress Claude with 0 days → empty, not “Days shipped 0”; completed AI Cohort / Databricks → cohort name + Completed; Top 5 / Winner → placement badge only; Experience still jobs; email/phone stay locked.

## Commit message

```
fix(hire): show completed tracks and hackathon wins in ABTalks Evidence

Scout inspector Evidence was the search track’s live counts, so a Claude
card showed Days shipped 0. It now loads pool-gated completions (50+
challenge days, finished cohorts, ViCoDathon placements) only.
```
