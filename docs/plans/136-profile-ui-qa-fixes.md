# 136 — Candidate `/profile` UI QA fixes

## 1. Goal

Close every finding in the QA pass on the profile wizard (12 major, 8 minor,
3 nits) without changing what the profile stores, what it scores, or who can
see it. The wizard keeps its `pw-*` clay design language; the fixes make it
behave the way the design already promises.

## 2. Current behavior (what each finding actually is)

| # | Root cause in the code |
|---|---|
| 2 | `Cancel` calls `closeSheet()` directly; Escape and the scrim call `requestClose()`, which raises the keep/discard/save pop. Cancel therefore drops edits silently. |
| 3 | `ProfileCard` is passed `activeIndex={index}`, and `index` survives the close, so one tab keeps `.pw-current` with no sheet open. |
| 4 | `profile-card.tsx` emits `pw-attention`; `profile-wizard.css` never defines it. |
| 5 | `.pw-menu-select-list` / `.pw-suggest-list` are `position: absolute` inside `.pw-section-body`, which is the scroll container — so they clip at its bottom edge. |
| 6 | `.pw-root.pw-sheet-open .pw-profile-card { z-index: 45 }` is unconditional, but under 1024px the card is in normal flow and the sheet is full width, so the card floats over the scrim. |
| 7 | `.pw-profile-card` is `position: sticky` with `overflow: hidden` and no `max-height`, so on short viewports its lower half (Profile performance) is unreachable. |
| 8 | `accomplishmentsScore` scores awards (10 tenths) but computes `complete` from `certRequired` alone, while the hint offers "a certification **or** an award". |
| 9 | Only `Full name`, `Gender` and (conditionally) `Phone` carry `*`, yet `computeCompleteness` also requires city, region, country, headline, about, and the first row of Experience / Education / Projects / Links / Preferences. |
| 10 | `resume-section.tsx` + `resume-strength.tsx` are shadcn/Tailwind inside an otherwise `pw-*` sheet. |
| 11 | The sheet sets no `role="dialog"`, no `aria-modal`, and no Tab containment. |
| 12 | `IdentityMedia` renders `AvatarEditor` only when `avatarUploadEnabled`; with the env var unset the control just vanishes. |
| 13 | `Open To Work` (title case) in the hero; report-card titles `Key skills` / `Your career preferences` vs wizard steps `Skills` / `Career Preferences`. |
| 14 | Mock Interview is a checklist step with an `attention` flag, but `completeness.ts` has no `mock` key, so it can never move Profile strength. |
| 15 | `PerfColumn` renders a chevron that has no action. |
| 16 | `body.pw-profile-page .abt-content-scroll` hides the scrollbar completely (an earlier explicit product request), leaving no scroll cue at all. |
| 17 | `@media (max-width: 820px) { .pw-complete-pill { display: none } }`. |
| 18 | `<span className="pw-req" aria-hidden>*</span>` — the only required signal, hidden from AT. |
| 19 | `label="Phone Number"`. |
| 20 / 23 | `.pw-rv-hero-copy h2` has no wrapping rule, so a long name pushes against `.pw-rv-add`. |
| 21 | `<h2 ref={headingRef} tabIndex={-1}>` is focused on open; no `:focus-visible` rule covers it. |
| 22 | `leave-dialog.tsx` has no importer; the live UI is `.pw-leave-pop` inside `profile-wizard.tsx`. |

## 3. Files to touch

All inside the Candidate profile module (Shivansh). No cross-module change.

- `src/components/profile/profile-wizard.tsx` `[edit]` — Cancel via `requestClose`, dialog semantics + focus trap + focus restore, `activeIndex` only while open, required-field legend, scroll-cue class.
- `src/components/profile/profile-card.tsx` `[edit]` — optional-step chip, attention marker, drop the dead chevron.
- `src/components/profile/wizard-fields.tsx` `[edit]` — anchored (portalled) menus for `PwMenuSelect` / `PwSuggest`; `pw-req` announced.
- `src/components/profile/profile-review.tsx` `[edit]` — "Open to work" casing.
- `src/components/profile/basic-info-section.tsx` `[edit]` — "Phone number", required marks.
- `src/components/profile/experience-section.tsx`, `education-section.tsx`, `projects-section.tsx`, `links-section.tsx`, `preferences-section.tsx`, `accomplishments-section.tsx` `[edit]` — required marks that match `completeness.ts`.
- `src/components/profile/resume-section.tsx` `[rewrite]` + `resume-strength.tsx` `[rewrite]` — `pw-*` markup.
- `src/components/profile/identity-media.tsx` `[edit]` — always render a photo control; disabled + explained when storage is unconfigured.
- `src/components/profile/avatar-editor.tsx` `[edit]` — `unavailable` prop.
- `src/components/profile/leave-dialog.tsx` `[delete]` — dead.
- `src/components/profile/profile-wizard.css` `[edit]` — `.pw-attention`, anchored-menu positioning, sticky card max-height, mobile stacking, compact complete pill, heading focus ring, name wrapping, scroll cue, résumé styles.
- `src/app/profile/page.tsx` `[edit]` — mark Mock Interview `optional`.
- `src/features/profile/completeness.ts` `[edit]` — accomplishments complete on certification **or** award.
- `src/features/profile/build-review.ts` `[edit]` — card titles match step titles.
- `src/features/profile/profile.test.ts` `[edit]` — assertions for the above.

## 4. Server vs Client

| File | Kind |
|---|---|
| `profile-wizard.tsx`, `profile-card.tsx`, `wizard-fields.tsx`, `profile-review.tsx`, section forms, `avatar-editor.tsx`, `identity-media.tsx`, `resume-section.tsx` | client |
| `resume-strength.tsx`, `mock-interviews-section.tsx` | server components rendered into the client sheet as `ReactNode` (unchanged) |
| `app/profile/page.tsx`, `completeness.ts`, `build-review.ts` | server |

No new value crosses the RSC boundary: `WizardStep.optional` is a boolean, and
the résumé rewrite only changes class names and markup. Menus portal to
`document.body` on the client, after mount, so SSR output is unchanged.

## 5. Steps

1. **Dirty-state parity (2)** — `Cancel` calls `requestClose`. The leave pop
   already handles keep / discard / save.
2. **Active tab (3)** — pass `activeIndex={open ? index : -1}`.
3. **`pw-attention` (4)** — amber dot + amber label using `--pw-warning`, plus
   sr-only "needs attention".
4. **Anchored menus (5)** — one `useAnchoredMenu` hook in `wizard-fields.tsx`:
   measures the trigger, renders the list through `createPortal` with
   `position: fixed`, flips above when the space below is short, clamps
   `max-height` to the free space, and repositions on scroll/resize (capture).
5. **Mobile stacking (6)** — wrap the `z-index: 45` rule in `min-width: 1025px`.
6. **Sticky card (7)** — `max-height: calc(100vh - 55px - 2 * pad)`,
   `overflow: hidden auto`, `overscroll-behavior: contain`; reset ≤1024px.
7. **Accomplishments (8)** — `complete = certRequired || filled(awards)`, hint
   reworded when a half-filled certification is the only thing left.
8. **Required marks (9, 18)** — `*` on exactly the fields `completeness.ts`
   requires, an sr-only "(required)" beside it, and one legend line in the
   sheet: "* Needed to complete this section."
9. **Résumé restyle (10)** — rebuild both résumé components on `pw-*` classes
   (`.pw-resume-*` added to the stylesheet). Same actions, same toasts, same
   server calls.
10. **Focus trap (11, 21)** — `role="dialog"`, `aria-modal="true"`,
    `aria-labelledby` the heading, Tab/Shift-Tab cycle inside the sheet, focus
    restored to the opener on close, visible focus ring on the heading.
11. **Avatar control (12)** — `AvatarEditor` takes `unavailable`; when set it
    renders disabled with a title explaining photo upload is not available.
12. **Copy (13, 19)** — "Open to work", "Phone number", card titles "Skills"
    and "Career Preferences".
13. **Optional mock (14)** — `WizardStep.optional`; Quick Links renders an
    "Optional" chip and never an attention state for it.
14. **Chevron (15)** — remove it and its separator dot.
15. **Scroll cue (16)** — keep the scrollbar invisible at rest (the product
    decision) but reserve a 6px gutter and paint the thumb while scrolling,
    via a `pw-scrolling` body class with an idle timer. No layout shift.
16. **Complete pill (17)** — compact icon-only pill ≤820px instead of hidden.
17. **Long names (20, 23)** — `overflow-wrap: anywhere` + `min-width: 0` on the
    hero copy; `.pw-rv-add` stays `flex: none`.
18. **Dead file (22)** — delete `leave-dialog.tsx`.
19. **Pinned Quick Links while a section is open (reported after the QA list)**
    — the sheet-open rule set `position: relative`, which cancels `position:
    sticky`: the card fell back into normal flow, drifted with the page and
    could scroll out of sight. It now only raises `z-index`, so it stays
    sticky and pinned. It also gets `overflow: hidden` while open, because
    with the page locked behind the sheet the card was the only thing a wheel
    could still move. Profile performance is hidden for the duration
    (`.pw-root.pw-sheet-open .pw-performance-section { display: none }`),
    which is both what was asked for and what keeps the pinned card short
    enough never to need a scrollbar.

## 6. Guardrails (DO NOT)

- **DO NOT** change what any section saves, or any Server Action signature.
- **DO NOT** change section weights in `completeness.ts`; only the
  accomplishments `complete` rule changes (8).
- **DO NOT** make any field block submission — `*` marks what completes a
  section, not what the form enforces (a standing product rule).
- **DO NOT** re-show the page scrollbar at rest; it was hidden deliberately.
- **DO NOT** touch `DashboardShell` or any shared component for the scroll cue
  — it stays scoped to the `body.pw-profile-page` class the wizard sets.
- **DO NOT** trap focus so the sheet cannot be closed: Escape must still work.
- **DO NOT** add a dependency for the menus; `createPortal` is enough.

## 7. DB safety

None. No schema, migration or seed change; no query changes.

## 8. Verification

- `npx tsc --noEmit`, `npx eslint` on every changed file, `npm run test:profile`,
  `npm run build`.
- New assertions in `profile.test.ts`: Cancel is not a silent discard, the
  sheet declares dialog semantics, `pw-attention` exists in the stylesheet,
  menus portal, the complete pill is not hidden at 820px, no `leave-dialog`
  file, copy strings, and card/step title parity.
- Manual: open a section, edit, press Cancel → the pop appears; close the sheet
  → no tab stays highlighted; open Month/Year at the bottom of Experience →
  the list flips above and stays on screen; 375px viewport → Quick Links sits
  under the scrim; 650px-tall viewport → Profile performance is reachable;
  Tab inside an open sheet never reaches the page behind it.

## 9. Commit message

```
fix(profile): close the /profile UI QA findings

Cancel now asks before dropping edits, the Quick Links tab clears when the
sheet closes, and the sheet is a real modal (dialog semantics, focus trap,
focus restore). Month/year and suggestion menus are portalled so they no
longer clip inside the scrolling sheet. Adds the missing pw-attention state,
keeps the sticky Quick Links card reachable on short viewports, puts the
mobile card under the scrim, and rebuilds the resume section in the wizard's
own clay styling. Marks the fields that completeness actually requires (and
announces them), completes Accomplishments on a certification or an award,
and clears the copy, chevron, pill, scroll-cue and dead-file findings.
```
