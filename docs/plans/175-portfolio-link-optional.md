# 175 — Portfolio link optional in Links

## 1. Goal

Portfolio URL must not be compulsory. A candidate with LinkedIn + GitHub and no
portfolio can tick Links complete and reach 100% profile strength. Portfolio
remains saveable and still counts if present, but never holds the score or the
required asterisk.

## 2. Current behavior

Portfolio lives in the **Links** wizard step
(`src/components/profile/links-section.tsx`), not Career Preferences. Career
Preferences only requires roles + locations.

Today:

- UI marks Portfolio `required` (asterisk + required-field test).
- `linksScore` in `src/features/profile/completeness.ts` needs all three:
  LinkedIn 1.5% + GitHub 1.5% + Portfolio 1% = 4%; `complete` only when
  `earnedTenths === 40`.
- Missing list includes `"Portfolio or website"`; hint says “Add LinkedIn,
  GitHub, and a portfolio”.
- Zod already allows empty portfolio (`nullableUrl`) — no schema change.

## 3. Files to touch

| File | | Note |
|---|---|---|
| `docs/plans/175-portfolio-link-optional.md` | `[new]` | This plan |
| `src/features/profile/completeness.ts` | `[edit]` | `linksScore`: LinkedIn + GitHub = full credit; portfolio optional |
| `src/components/profile/links-section.tsx` | `[edit]` | Remove Portfolio `required` |
| `src/features/profile/profile.test.ts` | `[edit]` | No-portfolio 100% path; drop Portfolio from required-asterisk list; missing never names portfolio |
| `docs/CHANGELOG.md` | `[edit]` | One Pending reconcile rule line |

Deliberately not touched: Career Preferences UI/schema, Zod links schema,
Prisma, resume module, recruiter-view, notification paths, `WEIGHT_TENTHS`.

## 4. Server vs Client

| Piece | Boundary | Note |
|---|---|---|
| `linksScore` / `computeCompleteness` | pure | No React. |
| `LinksSection` | Client | Drop `required` on Portfolio only. |

## 5. Steps

### 5.1 `linksScore` in `completeness.ts`

1. When LinkedIn and GitHub are filled, award the full Links 4% and treat the
   section as complete, whether or not portfolio is set. Portfolio alone still
   earns its 1% when present without the other two, but does not complete the
   section. Never list portfolio in `missing`.

```ts
function linksScore(detail: CandidateDetail): SectionScore {
  const hasLinkedin = filled(detail.linkedinUrl);
  const hasGithub = filled(detail.githubUsername);
  const hasPortfolio = filled(detail.portfolioUrl);

  let earnedTenths = 0;
  if (hasLinkedin) earnedTenths += 15;
  if (hasGithub) earnedTenths += 15;
  if (hasPortfolio) earnedTenths += 10;

  // LinkedIn + GitHub = full credit; portfolio is optional garnish.
  if (hasLinkedin && hasGithub) {
    return {
      earnedTenths: 40,
      complete: true,
      hint: null,
      missing: [],
    };
  }

  return {
    earnedTenths,
    complete: false,
    hint: "Add LinkedIn and GitHub",
    missing: [
      !hasLinkedin && "LinkedIn profile",
      !hasGithub && "GitHub username",
    ].filter((x): x is string => typeof x === "string"),
  };
}
```

### 5.2 Links UI

2. Drop `required` from the Portfolio `PwField` only. LinkedIn and GitHub stay
   required.

### 5.3 Tests in `profile.test.ts`

3. Keep portfolio-alone earns `1`.
4. Add: LinkedIn + GitHub, `portfolioUrl: null` → links earned `4`,
   `complete === true`, `missing: []`, full profile score `100`.
5. Required-asterisk suite: Links marked list becomes `["LinkedIn", "GitHub"]`
   only (drop Portfolio).
6. Missing-fields suite: blank links still names LinkedIn/GitHub; assert it does
   **not** include `"Portfolio or website"`.

### 5.4 CHANGELOG

7. Under `## Pending reconcile`:
   `2026-10-03 [rule] Plan 175: portfolio URL is optional in Links — LinkedIn + GitHub award full 4%; portfolio no longer blocks 100%`

## 6. Guardrails for Cursor (DO NOT)

- **DO NOT** change `WEIGHT_TENTHS` or other sections’ weights.
- **DO NOT** require portfolio in Zod on save.
- **DO NOT** make LinkedIn or GitHub optional.
- **DO NOT** touch notification paths, Prisma, or recruiter-view.
- **DO NOT** restyle the Links form beyond removing the Portfolio required flag.
- **DO NOT** report done without `npx tsc --noEmit` and `npm run test:profile`.

## 7. DB safety

Not applicable. Read-time scoring only; no schema or write-path change.

## 8. Verification

```bash
npx tsc --noEmit && npm run test:profile
```

Manual: Links with LinkedIn + GitHub, empty Portfolio → section ticks, score can
hit 100%; Portfolio field has no asterisk; filling portfolio still saves.

## 9. Commit message

```
Plan 175 — treat portfolio URL as optional in Links

LinkedIn + GitHub award the full Links 4% so the profile is not held
incomplete without a portfolio. Portfolio remains optional in the form
and no longer appears in missing.
```

## 10. Ownership

Contributor work in Shivansh’s Candidate profile module. No schema/auth impact.
Shivansh sign-off before merge.
