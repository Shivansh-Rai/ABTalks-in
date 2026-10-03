# 170 — Hire filter dialog: experience range slider + visual pass

> **Ownership:** `/src/components/hire/` and `/src/app/hire/` are owned by
> **@zainabshujat** (CODEOWNERS lines 27, 42). The visual pass also touches
> **Shallika's** design-system remit. This plan is written by Sohail (candidate
> search / search ranking) and must be approved by Zainab before execution.

## 1. Goal
Replace the Experience dropdown in the hire filter dialog with a
Flipkart-style dual-handle range slider, **remove the Budget Ceiling control
entirely**, and give the dialog a visual pass (chip quick-picks, grouped
sections, sticky footer) so it stops reading as a stack of bare native selects.

## 2. Current behavior
`HireFilterDialog` (`src/components/hire/hire-filter-dialog.tsx`, 524 lines)
renders one flat `<form>` of native inputs:

- **Target Role** — text `input` + `datalist` of `POPULAR_ROLES`.
- **Must-Have Skills** — tag input + a "Suggested:" row of `+ Skill` buttons.
- **Location** — text `input` + `datalist` of `POPULAR_LOCATIONS`.
- **Experience Level** — single `<select>` over six fixed `EXPERIENCE_OPTIONS`
  bands; a synthetic `custom` option appears when the spec's min/max (set by
  the Scout chat) match no band. An arbitrary band is not expressible.
- **Work mode / Employment type** — two `<select>`s in a 2-up grid.
- **Budget Ceiling** — `<select>` over nine `BUDGET_OPTIONS` maxima. **Being removed.**
- **Open to work** — bare checkbox.

Known defects in this area, both resolved here:

- **D1 — unstyled suggestions.** `hire-filter-suggestions`,
  `hire-filter-suggestions__label`, `hire-filter-suggestions__list`,
  `hire-filter-sugg-btn` and `hire-filter-input-group` have **no CSS at all**
  in `hire-scout.css` (verified by grep). That is why the suggested skills
  render as the run-on line `+ React+ Next.js+ TypeScript…`.
- **D2 — stale salary floor.** `mergeFilterDraft` spreads `...current` and
  overwrites only `salaryMax`. A chat-set `salaryMin` of 12L plus a dialog pick
  of "Up to ₹10 LPA" produced an invisible, impossible `min 12L / max 10L`.
  Dropping the budget control fixes this by construction: the dialog stops
  writing either salary bound, so whatever the chat set passes through intact.

## 3. Files to touch
| File | Mode | Note |
|---|---|---|
| `src/components/hire/hire-filter-dialog.tsx` | `[edit]` | experience slider, chip pickers, section grouping, budget removal |
| `src/app/hire/hire-scout.css` | `[edit]` | new `hire-filter-*` rules in the existing block (~line 11750), incl. the missing D1 rules |

No new files. No schema change. No server-side change — `JobSpec` already
supports every value this dialog will produce.

## 4. Server vs Client
- `HireFilterDialog` — **Client** (`"use client"` already present). Stays client.
- `scout-chat.tsx` — **Client**, the only consumer. Its props to this dialog
  (`open`, `onOpenChange`, `spec`, `pending`, `onApply`) are **unchanged**.
- No Server→Client prop passing is added or altered; no server component is touched.

## 5. Steps

### 5.1 Remove the budget control
1. Delete the `BUDGET_OPTIONS` constant and the whole Budget Ceiling `<label>`
   block from the form. Grep first to confirm nothing else imports it.
2. Remove `salaryMaxLpa` from `HireFilterDraft`, from `EMPTY_DRAFT`, and from
   `specToFilterDraft`.
3. In `mergeFilterDraft`, delete the `lpaRaw` / `lpa` / `salaryMax` lines and
   the `salaryMax` key from the returned object. `...current` then carries both
   `salaryMin` and `salaryMax` through untouched — this is the D2 fix.
4. Delete `rupeesToLpa`, now unused (strict TS / lint will flag it otherwise).
5. **Keep** `isUnsetSalary` — `filterSummary` still uses it to count a
   chat-set budget into the `+N` chip, and that must keep working.
6. **Consequence to state in the PR:** budget becomes chat-only. A recruiter
   sets it by telling Scout ("10–20 LPA"), and `scout-conversation.ts` already
   parses that into `salaryMin`/`salaryMax`. The filter bar still shows it in
   the `+N` count, so it is not invisible — it is just not editable here.

### 5.2 Experience slider
7. Replace the Experience `<select>` with a dual-range control: two
   `<input type="range" min={0} max={15} step={1}>` overlaid on one track, plus
   a fill div between the handles. `15` is the display ceiling and maps to the
   schema's `50` sentinel on the way out (`maxExperience >= 15 → 50`), so
   "15+ yrs" keeps meaning "no upper bound" and `isSentinelYears` keeps working.
8. Clamp on input: derive `lo = Math.min(a,b)` / `hi = Math.max(a,b)` for
   display rather than fighting the DOM order of the two inputs.
9. Live readout above the track: `"2 – 6 yrs"`, `"15+ yrs"` at the ceiling,
   `"Any experience"` when the band spans the full 0–15 range.
10. Keep `EXPERIENCE_OPTIONS` as **preset chips under the slider** (Fresher /
    Junior / Mid / Senior / Lead). A chip sets both handles; dragging clears its
    pressed state. The old select goes, and with it the `currentExpPreset` /
    `"custom"` escape hatch — an arbitrary band is now directly expressible.
11. Each range input needs its own `aria-label` ("Minimum years", "Maximum
    years"); the readout is `aria-live="polite"`.

### 5.3 Visual structure
12. Group the form into labelled sections separated by hairlines, in this
    order: Role → Skills → Experience → Location → Work mode → Employment type
    → Open to work.
13. Convert Work mode and Employment type from `<select>`s to pressed-state
    chip rows (`aria-pressed`), with "Not set" relabelled **"Any"** as the first
    chip. `WORK_MODE_OPTIONS` / `EMPLOYMENT_OPTIONS` values are unchanged — only
    the control changes.
14. Keep the role and location `datalist` inputs, and add a row of quick-pick
    chips under each (first 4–5 of `POPULAR_ROLES` / `POPULAR_LOCATIONS`).
15. Replace the bare `openToWork` checkbox with a labelled switch row carrying a
    one-line description. Keep native semantics — a real checkbox or a
    `role="switch"` button, not a styled div.
16. Header gains an active-filter count pill derived from the existing
    `filterSummary` logic. Footer (`hire-filter-actions`) becomes sticky at the
    bottom of the scroll area: "Reset all" (ghost) left, "Apply filters"
    (primary) right.

### 5.4 `hire-scout.css`
17. Add the **missing D1 rules**: `.hire-filter-suggestions` (flex, wrap, 8px
    gap, 10px top margin), `__label` (12px, `#8a9496`), `__list` (flex wrap),
    and `.hire-filter-sugg-btn` as a pill (1px `#e3e8ea`, radius 999px,
    6px/12px padding, hover → `#03535f` border + `#f0f6f7` fill).
18. Add `.hire-filter-range` (track, fill, two overlaid thumbs) using the
    existing palette: track `#e6ebec`, fill and thumb border `#03535f`, thumb
    white, 18px. Style **both** `::-webkit-slider-thumb` and
    `::-moz-range-thumb`, and zero out `::-webkit-slider-runnable-track` /
    `::-moz-range-track` so no default track paints over the custom one. The
    inputs are `pointer-events: none` with `pointer-events: auto` restored on
    the thumbs, so the lower handle stays grabbable where the two overlap.
19. Add `.hire-filter-pill` (shared by preset / work-mode / employment /
    quick-pick chips) with an `[aria-pressed="true"]` filled state.
20. Add `.hire-filter-section` hairline grouping and `.hire-filter-switch`.
21. Keep every surviving selector name (`hire-filter-field`,
    `hire-filter-chip`, `hire-filter-actions`, …) so `scout-chat.tsx` and the
    filter **bar** (`hire-filter-bar*`, a different component) are untouched.
22. Respect the existing `@media (max-width: 640px)` block: slider full-width,
    chip rows wrap, footer stays sticky.

## 6. Guardrails for Cursor (DO NOT)
- **DO NOT** touch anything under the locked notification paths, or any file
  outside the two listed in §3. In particular, do not "tidy" `scout-chat.tsx`.
- **DO NOT** reintroduce a budget input anywhere in this dialog, and do not
  "helpfully" move it to the filter bar instead. Budget is chat-only after this.
- **DO NOT** delete `salaryMin` / `salaryMax` from `JobSpec`, strip them in
  `mergeFilterDraft`, or set them to `null` — removing the *control* must not
  remove the *data*. `...current` passes them through; leave it that way.
- **DO NOT** change `JobSpec`, `src/lib/validations/hire.ts`, the Prisma schema,
  or any server action. This is presentation over an existing model.
- **DO NOT** change search, ranking or scoring behaviour
  (`features/hire/score-candidate.ts`, `scout-conversation.ts`).
- **DO NOT** add a slider dependency (rc-slider, radix-slider, …). Two native
  `<input type="range">` elements, styled. The hire surface ships its own CSS
  file; `src/components/ui/` is off limits.
- **DO NOT** add a new abstraction file for the range control — inline it in
  the dialog.
- **DO NOT** swap the Dialog wrapper or `showCloseButton`.
- **DO NOT** drop the sentinel semantics: `0–50 years` means "unset" and must
  round-trip through the slider.
- **DO NOT** use `console.*`, and **DO NOT** leave `any` in the new handlers —
  the range `onChange` is `React.ChangeEvent<HTMLInputElement>`.

## 7. DB safety
Not applicable — no schema, migration or data change.

## 8. Verification
- `npx tsc --noEmit` clean; `npm run build` succeeds.
- The hire tests must pass **unedited** — especially
  `src/features/hire/scout-agent.test.ts` and `hire-brief.test.ts`, which assert
  `salaryMin` / `salaryMax` round-trips. No test file may be modified.
- Browser loop on `/hire` (dev server via `preview_start`, not `npm run dev`):
  1. Brief Scout with "AI engineers in Noida, 10–20 LPA", open **Edit filters**,
     change the role, Apply — the 10–20 LPA budget must **survive** untouched
     (check the filter bar `+N` chip and the applied spec).
  2. Drag experience to 3–7, Apply, reopen — handles still read 3–7.
  3. Pick the "Fresher" chip, Apply, reopen — 0–1.
  4. Drag the max handle to 15+, Apply — the spec's `maxExperience` is the `50`
     sentinel and the readout says "15+ yrs", not "15 yrs".
  5. Reset all → every filter blank, no chips pressed, and the chat-set budget
     is cleared or preserved per whatever Reset does today — confirm and state
     which, do not change it silently.
  6. Keyboard: Tab to each handle, arrows move it, the readout announces.
  7. 375px width — no horizontal scroll, footer reachable.
- Exactly two files changed: `hire-filter-dialog.tsx`, `hire-scout.css`.

## 9. Commit message
```
feat(hire): experience range slider and visual pass for the filter dialog

Experience becomes a dual-handle range slider instead of six fixed
dropdown bands, so recruiters can express an arbitrary band. Work mode,
employment type, role and location gain chip quick-picks; the dialog is
grouped into sections with a sticky footer.

Drops the budget ceiling dropdown — budget is set through Scout, which
already parses ranges. The dialog no longer writes either salary bound,
which also fixes a chat-set salaryMin surviving into an inverted band.

Also fixes the suggested-skills row, which had no CSS and rendered as a
run-on line.
```
