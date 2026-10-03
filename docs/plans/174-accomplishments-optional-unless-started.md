# 174 — Accomplishments optional unless a certificate is started

## 1. Goal

A candidate with no certifications must be able to reach a complete profile
(100%). Starting a certification still requires full details (name, issuer,
issue year, credential link). Awards stay optional garnish and never hold the
score when there are no cert rows.

## 2. Current behavior

In `src/features/profile/completeness.ts`, `accomplishmentsScore` (weight 5%):

- Empty certs + blank awards → `earnedTenths: 0`, `complete: false`,
  `missing: ["A certification …", "Awards or honours"]` → score capped at 95%.
- A started cert without issuer/year/URL → unfinished hint (keep this).
- Awards alone → `complete: true` but only 1% earned.

UI in `src/components/profile/accomplishments-section.tsx` already marks Name,
Issuer, Issued, Credential URL as required. Blank form rows are filtered on
save (`isBlankRow`), so an untouched section stores `certifications: []`.

## 3. Files to touch

| File | | Note |
|---|---|---|
| `docs/plans/174-accomplishments-optional-unless-started.md` | `[new]` | This plan |
| `src/features/profile/completeness.ts` | `[edit]` | Early-return full credit when `certs.length === 0`; tighten cert-present branch |
| `src/features/profile/build-review.ts` | `[edit]` | Soften Accomplishments `emptyHint` to optional wording |
| `src/features/profile/profile.test.ts` | `[edit]` | Retarget empty / awards-only / blank-profile / 100% path assertions |

Deliberately not touched: accomplishments form UI (asterisks already correct),
Zod schema, Prisma, dashboard wiring, notification paths.

## 4. Server vs Client

| Piece | Boundary | Note |
|---|---|---|
| `accomplishmentsScore` / `computeCompleteness` | pure | No React. |
| `buildProfileReview` | pure | `emptyHint` string only. |
| Profile / dashboard pages | Server → Client | No new props; completeness output shape unchanged. |

## 5. Steps

### 5.1 `accomplishmentsScore` in `completeness.ts`

1. Early-return when `certs.length === 0`:
   ```ts
   return {
     earnedTenths: 50,
     complete: true,
     hint: null,
     missing: [],
   };
   ```
2. When certs exist: keep field weights; `complete: certRequired` (drop
   `|| awarded`); `missing` lists blank cert fields and optional Awards when
   blank; unfinished-cert hint unchanged.
3. Comment: empty = full credit; started cert must be finished.

### 5.2 Review card copy in `build-review.ts`

4. Soften Accomplishments `emptyHint` to optional language.

### 5.3 Tests in `profile.test.ts`

5. `awardsOnly` → section earned **5**, still complete.
6. Empty certs/awards on full profile → score **100** (was 95).
7. Blank profile: accomplishments `missing.length === 0` and `fraction === 1`.
8. Keep unfinished-cert and full-cert+awards assertions.

## 6. Guardrails for Cursor (DO NOT)

- **DO NOT** change `WEIGHT_TENTHS` or other sections’ weights.
- **DO NOT** hard-require issuer/URL in Zod on save.
- **DO NOT** touch notification paths, Prisma, or recruiter-view.
- **DO NOT** mark Awards as required in the form.
- **DO NOT** report done without `npx tsc --noEmit` and `npm run test:profile`.

## 7. DB safety

Not applicable. Read-time scoring only.

## 8. Verification

```bash
npx tsc --noEmit && npm run test:profile
```

Manual: no certs/awards → Accomplishments ticks, score can hit 100. Started
cert with only a name → incomplete and names issuer / year / credential link.

## 9. Commit message

```
Plan 174 — treat empty Accomplishments as complete

No certifications awards the full 5% so the profile is not held at 95%.
A started certification still requires name, issuer, issue year, and
credential link; awards remain optional.
```

## 10. Ownership

Contributor work in Shivansh’s Candidate profile module. No schema/auth impact.
Shivansh sign-off before merge.
