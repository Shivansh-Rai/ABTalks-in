# 130 — Remove Gender “Prefer not to say”

## Goal

Stop implying gender can be opted out of while completeness still requires a value. The empty placeholder becomes a neutral **Select**; Gender is marked required like other completeness-gated fields.

## Current behavior

- `basic-info-section.tsx` renders `<option value="">Prefer not to say</option>`.
- `completeness.ts` needs `detail.gender !== null` for Basic `complete`.
- Schema comment on `CandidateGender`: nullable = not stated, not a fourth enum value. Zod still allows null on save.

## Decision

- Replace “Prefer not to say” with **Select** (`value=""`).
- Mark the Gender field `required` (red `*`).
- Do not change schema, Zod nullability, or completeness weights.

## Files to touch

- `src/components/profile/basic-info-section.tsx` `[edit]`
- `docs/plans/130-remove-gender-prefer-not-to-say.md` `[new]`

## Guardrails

- Do not add a fourth gender enum value.
- Do not change `completeness.ts` or Prisma.
- Do not require gender in Zod in this pass.

## Verification

- Gender dropdown shows **Select**, then Male / Female / Transgender.
- Red `*` on Gender.
- Leaving Select and saving still allowed; Basic stays incomplete until a gender is chosen.

## Commit message

`Profile: drop Prefer not to say on gender; mark field required`
