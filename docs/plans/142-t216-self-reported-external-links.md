# 142 — T-216 Self-reported external profile links

## Goal

As a candidate, add GitHub / LeetCode / CodeChef links; as a recruiter opening View Detail on `/hire`, see those links labelled **SELF-REPORTED**. Never sync platforms; never present them as verified.

## Current behavior

- Candidates save links via `links-section.tsx` → `saveLinksAction` → `saveLinks`.
  - GitHub → `CandidateProfile.githubUsername`
  - LeetCode / CodeChef → `CandidateLink` rows
- Hire search exposes only booleans `githubConnected` / `linkedinConnected`.
- Inspector Credentials stamped connected GitHub/LinkedIn as "Verified".

## Files to touch

- `docs/plans/142-t216-self-reported-external-links.md` `[new]`
- `src/lib/validations/candidate-profile.ts` `[edit]` — LeetCode/CodeChef host checks
- `src/features/hire/self-reported-links.ts` `[new]` — pure shaper
- `src/features/hire/self-reported-links.test.ts` `[new]`
- `src/repositories/candidate-detail.ts` `[edit]` — `listSelfReportedExternalLinks`
- `src/app/actions/hire-view-actions.ts` `[edit]` — `loadInspectorExternalLinksAction`
- `src/components/hire/candidate-inspector.tsx` `[edit]` — render + fix Verified mislabel
- `src/app/hire/hire-scout.css` `[edit]` — SELF-REPORTED badge
- `src/features/hire/visibility.test.ts` `[edit]` — contract notes
- `docs/CHANGELOG.md` `[edit]` — one Pending reconcile line

## Approach

Lazy-load declared links when the inspector opens (same pool gate as work history). Search cards stay boolean-only. Protected contact (email / phone / `linkedinUrl` / `resumeUrl`) stays unlock-gated.

## Guardrails (DO NOT)

- No GitHub OAuth, LeetCode API, or CodeChef API sync.
- No invented scores. No VERIFIED label on declared links.
- Do not put `linkedinUrl`, email, phone, or `resumeUrl` on the links action.
- Do not change ranking or evidence floor.
- Do not edit `CLAUDE.md` or `docs/project-context.md`.

## Verification

1. Candidate adds all three links; nonsense hosts refused.
2. Recruiter View Detail shows each as SELF-REPORTED, clickable, no score.
3. Links action payload has no protected contact fields.
4. Credentials no longer says Verified for GitHub/LinkedIn connected.
5. `npx tsc --noEmit` and self-reported / visibility tests pass.

## Commit message

`Hire: show self-reported GitHub, LeetCode, CodeChef links on View Detail (T-216)`
