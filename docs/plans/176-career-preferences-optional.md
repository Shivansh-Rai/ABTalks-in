# 176 — Career Preferences optional unless started

## 1. Goal

A candidate with no preferred roles and no preferred locations must be able to
reach a complete profile (100%). Starting either half still requires both roles
and locations. Open to work and the other preference fields stay non-scoring.

## 2. Current behavior

In `src/features/profile/completeness.ts`, `preferencesScore` (weight 3%):

- Empty roles + empty locations → `earnedTenths: 0`, `complete: false`,
  `missing: ["Preferred roles", "Preferred locations"]` → score capped at 97%.
- Roles alone → 1.5%, incomplete (keep this).
- Both → 3%, complete.

UI marks Preferred roles and Preferred locations as required.

## 3. Files to touch

| File | | Note |
|---|---|---|
| `docs/plans/176-career-preferences-optional.md` | `[new]` | This plan |
| `src/features/profile/completeness.ts` | `[edit]` | Early-return full credit when neither half is started |
| `src/features/profile/build-review.ts` | `[edit]` | Soften Career Preferences `emptyHint` to optional wording |
| `src/components/profile/preferences-section.tsx` | `[edit]` | Drop `required` from roles and locations |
| `src/features/profile/profile.test.ts` | `[edit]` | Retarget blank / optional / started-half assertions |
| `docs/CHANGELOG.md` | `[edit]` | One Pending reconcile rule line |

## 4. Steps

### 4.1 `preferencesScore`

1. When neither roles nor locations is filled, return full credit:
   `{ earnedTenths: 30, complete: true, hint: null, missing: [] }`.
2. When either is filled: keep current partial weights; `complete` only when both
   are filled; `missing` lists the blank half/halves; unfinished hint unchanged.

### 4.2 UI + review copy

3. Remove `required` from Preferred roles and Preferred locations.
4. Soften `emptyHint` to optional language (same spirit as Accomplishments).

### 4.3 Tests + CHANGELOG

5. Blank profile: preferences `missing: []`, `fraction === 1`; blank score
   includes optional prefs 3% (persona 2 + accomp 5 + prefs 3 = 10).
6. Roles-only still 1.5% and incomplete; both still 3% complete.
7. Open-to-work-only (no roles/locations) earns 3% via empty optional, not 0.
8. Full profile with empty preference reaches 100.
9. Drop roles/locations from the required-asterisk suite.
10. CHANGELOG: `2026-10-03 [rule] Plan 176: empty Career Preferences (no roles and no locations) awards full 3%; starting either half still requires both`

## 5. Guardrails (DO NOT)

- Do not change `WEIGHT_TENTHS` or other sections’ weights.
- Do not make Links / Resume optional in this plan.
- Do not touch notification paths, Prisma, or recruiter-view.
- Do not report done without `npx tsc --noEmit` and `npm run test:profile`.

## 6. Verification

```bash
npx tsc --noEmit && npm run test:profile
```

Manual: leave Career Preferences empty → section ticks, score can hit 100%; add
only roles → incomplete until locations filled; no asterisks on roles/locations.

## 7. Commit message

```
Plan 176 — treat empty Career Preferences as complete

No preferred roles and no preferred locations awards the full 3% so the
profile is not held incomplete. Starting either half still requires both.
```

## 8. Ownership

Contributor work in Shivansh’s Candidate profile module. Shivansh sign-off
before merge.
