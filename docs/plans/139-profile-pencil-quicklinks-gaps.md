# 139 — Profile: hide pencil, fit Quick Links, yellow Still missing

## 1. Goal

Three desktop profile overview tweaks. No sheet, save, or completeness changes.

## 2. Current behavior

- Pencil: `AvatarEditor` is always mounted in `identity-media.tsx` (plan 136:
  never silently drop it).
- Quick Links: `.pw-profile-card` is sticky with
  `max-height: calc(100vh - 55px - var(--pw-ws-pad-top) * 2)` and
  `overflow: hidden auto`, so a 10-item list plus Profile performance scrolls
  inside the card on typical laptop heights.
- Still missing: `.pw-rv-gaps` is teal (`#eef6f6` / dashed `#a6d2d5`).
  `--pw-warning-soft` is already `#ffedb0`.

## 3. Files to touch

- `src/components/profile/profile-wizard.css` `[edit]`
- `src/features/profile/profile.test.ts` `[edit]` overflow assertion
- `docs/plans/139-profile-pencil-quicklinks-gaps.md` `[new]` this plan

## 4. Steps

1. Hide `.pw-avatar-edit` with `display: none` (temporary). Keep `AvatarEditor`
   in the JSX tree.
2. Compact Quick Links vertical rhythm and set `.pw-profile-card` overflow to
   `hidden` (keep `max-height`).
3. Restyle `.pw-rv-gaps` to `--pw-warning-soft` fill, `#e0c56a` dashed border,
   `--pw-warning` label.
4. Update the short-screen overflow assertion in `profile.test.ts`.

## 5. Guardrails (DO NOT)

- Do not remove `AvatarEditor` from JSX.
- Do not change desktop grid, sheet z-index, or mobile overview.
- Do not invent new brand oranges; use existing `--pw-warning` /
  `--pw-warning-soft`.
- No schema, auth, or completeness changes.

## 6. Verification

- Desktop: no pencil; Quick Links + performance fit without a card scrollbar;
  Still missing is yellow.
- Mobile: unchanged.
- `npx tsx src/features/profile/profile.test.ts`

## 7. Commit message (when asked)

`profile: hide avatar pencil, fit Quick Links, yellow still-missing`
