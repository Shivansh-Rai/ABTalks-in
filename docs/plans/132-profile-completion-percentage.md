# 132 — Profile completion percentage (100% field-weighted)

**Owner:** Shivansh (candidate profile).
**Cross-module:** additive `CandidateProfile.hasNoWorkExperience` — Sohail review before a production Neon apply.

## 1. Goal

Replace the existing 125-point, row-count completeness scorer with a field-weighted 100% system: gated Experience/Education, first-entry-only, skills thresholds, and an explicit fresher skip. Keep it a Prisma-free pure function computed on the server from `CandidateDetail`, so the wizard ring, section ticks, and any future consumer share one number.

## 2. Current behavior

`computeCompleteness` in `src/features/profile/completeness.ts` is already the only scorer. Weights sum to 125 then cap at 100. Repeatable sections use `rowsRatio` (any saved row earns half the section). Resume is not scored. OTP verification changes the number between environments. The score is not stored and does not gate `/hire`.

## 3. Files to touch

- `src/features/profile/completeness.ts` [edit]
- `src/features/profile/profile.test.ts` [edit]
- `src/app/profile/page.tsx` [edit]
- `prisma/schema.prisma` [edit]
- `prisma/migrations/20260911220000_has_no_work_experience/migration.sql` [new]
- `src/repositories/candidate-detail.ts` [edit]
- `src/lib/validations/candidate-profile.ts` [edit]
- `src/app/actions/candidate-profile-actions.ts` [edit]
- `src/components/profile/experience-section.tsx` [edit]
- `docs/CHANGELOG.md` [edit]

## 4. Server vs Client

- `computeCompleteness` — server-called pure function. No functions cross the RSC boundary; the page passes `score` and per-step `complete` booleans.
- Experience checkbox — client form field, persisted on save.

## 5. Steps

See the implementation that follows this plan. Scoring rules are locked below.

## 6. Guardrails for Cursor (DO NOT)

- Do not put scoring in React components.
- Do not denormalize `profileCompletion` onto `CandidateProfile`.
- Do not import `isOtpVerificationRequired` into completeness.
- Do not score Verified Accomplishments, extra links, extra rows, `openToWork`, opportunity type, work mode, notice, or available-from.
- Do not backfill `hasNoWorkExperience`.
- Do not apply the migration to production unless explicitly authorized.
- Do not edit `CLAUDE.md` or `docs/project-context.md`.
- Keep middleware edge-safe (this work does not touch it).

## 7. DB safety

Additive boolean with `@default(false)`. Migration file only until a Neon child is targeted. No production write.

## 8. Weights (locked)

Internal accumulation in tenths of a percent, then `Math.min(100, Math.round(earnedTenths / 10))`.

- Basic 25: name 4, phone 3, I am a 2, city 2, state 2, country 2, gender 2, headline 5, about 3
- Experience 20: company 3, role 4, type 2, location 2, start 2, end/current 3, description 4
- Education 15: school 3, degree 3, field 3, start 2, end/current 2, score type 1, score 0.5, description 0.5
- Projects 15: name 3, description 4, tech stack 3, GitHub 3, live URL 2 — no gate; `[0]` only
- Skills 10: 0 → 0, 1–2 → 5, 3+ → 10
- Accomplishments 5: cert name 1, issuer 1, issued 1, expires 0, credential URL 1, awards 1
- Resume 3
- Links 4: LinkedIn 1.5, GitHub 1.5, portfolio 1
- Preferences 3: preferred roles 1.5, preferred locations 1.5

Experience/Education: if `[0]` is started and any required field is missing, that section contributes 0. Extra rows never add. `hasNoWorkExperience && experience.length === 0` awards the full Experience 20%. Rows win if both flag and rows exist.

## 9. Verification

`npm run test:profile` and `npx tsc --noEmit`. Manual: fresher checkbox +20; adding a role clears the flag and applies gating; refresh shows the same number.

## 10. Commit message

`feat(profile): field-weighted 100% completion with gated experience/education`
