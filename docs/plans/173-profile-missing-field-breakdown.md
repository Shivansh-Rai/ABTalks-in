# 173 — Tell the candidate exactly which profile fields are missing

## 1. Goal

`/profile` and `/dashboard` both show a profile-strength percentage (e.g. 80%)
but neither can tell the candidate which fields account for the shortfall. Make
`computeCompleteness` emit the concrete list of unearned fields per section, and
surface that list on the profile report card and in the dashboard score donut so
the number is always explainable.

## 2. Current behavior

- `src/features/profile/completeness.ts` scores nine sections in tenths of a
  percent. Each `SectionStatus` carries `complete`, `weight`, `fraction` and a
  single hard-coded `hint` string ("Add a headline, location, and contact
  details") that is the same whichever field is actually blank.
- `/profile` renders `ProfileReviewCard` (`src/components/profile/profile-review.tsx`).
  Its **"Still missing"** strip and **"Complete your profile"** chips are driven
  by `card.filled`, which is `blocks.length > 0` — i.e. *does this card have any
  data at all*. A section with partial data (basic info missing gender + state,
  education missing field of study, a project with no repo link) is `filled`, so
  it disappears from both lists while still holding the score down. This is the
  reported bug: the score says 80% and the page lists nothing missing.
- The wizard's `step.complete` flags come from `SectionStatus.complete`, so the
  per-step tick marks are right; they just never say *which* field is short, and
  sections that are `complete` but still have unearned extras (experience
  description, education grade, project live URL) show a tick at 80%.
- `/dashboard` → `GetHiredPanel` → `ScoreDonut` already breaks the score down per
  section with "+N% left", and puts `s.hint` in a `title=` attribute — invisible
  on touch and to screen readers, and generic anyway.
- `src/components/profile/profile-strength.tsx` imports `ProfileCompleteness` and
  renders per-section hints, but **nothing renders it** — it is dead code. Out of
  scope here; flagged separately.

## 3. Files to touch

| File | | Note |
|---|---|---|
| `src/features/profile/completeness.ts` | `[edit]` | Add `missing: string[]` to `SectionStatus`; every scorer returns the concrete unearned field labels. |
| `src/features/profile/build-review.ts` | `[edit]` | New **optional** `sections` input; add `sectionKey`, `missing`, `remaining` to `ReviewCard`. |
| `src/components/profile/profile-review.tsx` | `[edit]` | Gap list driven by `remaining > 0`, not `filled`; render the field names and the points left. |
| `src/components/profile/profile-wizard.css` | `[edit]` | Styles for the new missing-field lines and chip badges. |
| `src/components/dashboard-hub/stages/score-donut.tsx` | `[edit]` | Replace the `title=` tooltip with a visible missing-field panel for the active section. |
| `src/components/dashboard-hub/stages/get-hired-panel.tsx` | `[edit]` | Pass the "up next" section through unchanged; no behaviour change beyond prop wiring if needed. |
| `src/components/dashboard-hub/stages/stage-switcher.tsx` | `[edit]` | `ProfileTile` sub-line shows the top missing field instead of the constant "finish it now". |
| `src/app/dashboard/page.tsx` | `[edit]` | Pass `profileNext` (derived from `stageData.profile.sections`) to `StageSwitcher`. |
| `src/features/profile/profile.test.ts` | `[edit]` | New suite: `missing` is non-empty exactly when `fraction < 1`, empty at 100%, and names the right fields. |

Deliberately **not** touched:

- `src/features/resume/resume.test.ts` (Zainab) — the new `build-review` input is
  optional precisely so this file keeps compiling untouched.
- `src/components/profile/recruiter-view/**` (Zainab) — the recruiter view has
  its own plan-155 fix buttons; unchanged.
- `src/components/profile/profile-strength.tsx` — dead code; left as is.
- Prisma schema, repositories, any notification path.

## 4. Server vs Client

| Component | Boundary | Note |
|---|---|---|
| `computeCompleteness` / `buildProfileReview` | pure, server-called | No React. Output is plain JSON — strings, numbers, booleans only. |
| `src/app/profile/page.tsx` | **Server** | Already computes completeness; passes `review` (plain data) into the wizard. |
| `ProfileWizard` → `ProfileReviewCard` | **Client** | Receives `ProfileReview` only. `missing: string[]` and `remaining: number` are serializable; **no functions, icons or class instances cross the boundary** — the existing `onOpen(stepIndex)` callback stays client-side inside the wizard. |
| `src/app/dashboard/page.tsx` | **Server** | Already holds `stageData.profile.sections`; derives `profileNext` as a plain string. |
| `ScoreDonut`, `StageSwitcher` | **Client** | Already `"use client"`. New props are strings/arrays. |

## 5. Steps

### 5.1 `src/features/profile/completeness.ts`

1. Extend the exported type:
   ```ts
   export type SectionStatus = {
     …
     /** Concrete fields still unearned, most valuable first. Empty at 100%. */
     missing: string[];
   };
   ```
   and add `missing: string[]` to the internal `SectionScore` type.
2. Keep `hint` exactly as it is — the donut and any other reader still fall back
   to it. **Do not change the `complete` predicate of any section**; the wizard's
   tick marks and `firstIncomplete` depend on it and the existing test suite
   pins the numbers.
3. `missing` lists every field whose tenths were **not** earned, in descending
   weight order, with candidate-facing labels:
   - `basicScore` — `"Headline"` (5%), `"Full name"` (4%), `"Phone number"` (3%),
     `"About you"` (3%), `"Current city"`, `"State"`, `"Country"`, `"Gender"`
     (2% each). Persona is defaulted and never missing.
   - `experienceScore` —
     - no rows and not `hasNoWorkExperience`:
       `["A role, internship or freelance entry — or tick “I have no work experience yet”"]`
     - rows present, gate unmet: the unmet required labels of row 0 —
       `"Company name"`, `"Role title"`, `"Employment type"`, `"Job location"`,
       `"Start date"`, `"End date (or mark it your current role)"` — followed by
       `"Role description"` when blank.
     - gate met: `["Role description"]` when the description is blank, else `[]`.
   - `educationScore` — same shape: `"Institution name"`, `"Degree"`,
     `"Field of study"`, `"Start year"`,
     `"Graduation year (or mark it ongoing)"`, then the extras
     `"Score type (CGPA or percentage)"`, `"Score"`, `"Course description"`.
     No rows → `["Your college or school"]`.
   - `projectScore` — `"Project description"`, `"Project name"`,
     `"Tech stack"`, `"Repository link"`, `"Live demo link"`, filtered to the
     blanks. No rows → `["A project — name, description, tech stack and links"]`.
   - `skillsScore` — `[]` at ≥3, else
     `` [`${3 - unique} more skill${unique === 2 ? "" : "s"}`] `` (and
     `["At least three skills"]` when `unique === 0`).
   - `accomplishmentsScore` — when a certification row exists, the unfilled ones
     of `"Certification name"`, `"Certification issuer"`, `"Issue year"`,
     `"Credential link"`; when none, the single item
     `"A certification — name, issuer, issue year and credential link"`. Append
     `"Awards or honours"` when `awards` is blank.
   - `resumeScore` — `["A resume upload or resume link"]` when absent.
   - `linksScore` — the blanks of `"LinkedIn profile"`, `"GitHub username"`,
     `"Portfolio or website"`.
   - `preferencesScore` — the blanks of `"Preferred roles"`,
     `"Preferred locations"`.
4. In `section()`, set `missing: scored.missing` and add the invariant comment:
   `missing` is empty **iff** `earnedTenths === weightTenths`. For the gated
   sections this holds because a gate zeroes the whole section and the list then
   carries every one of its fields.
5. No new file, no helper module — the label lists live inline in the scorer that
   owns them.

### 5.2 `src/features/profile/build-review.ts`

6. Import `type SectionKey, type SectionStatus` from `completeness`.
7. Add to `ReviewCard`:
   ```ts
   /** The completeness section this card maps to; null for earned-only cards. */
   sectionKey: SectionKey | null;
   /** Field labels still unearned in that section. Empty when nothing is. */
   missing: string[];
   /** Percent of the overall score this card can still add. 0 when done. */
   remaining: number;
   ```
8. Add one **optional** parameter `sections?: readonly SectionStatus[]` to
   `buildProfileReview`. Optional on purpose: `src/features/resume/resume.test.ts`
   calls this function and must keep compiling without an edit. When it is
   absent every card gets `missing: []`, `remaining: 0` and the page behaves
   exactly as today.
9. `card()` takes a new `sectionKey` option; look the section up in a
   `Map<SectionKey, SectionStatus>` built from `sections` and derive
   `remaining = Math.round(weight * (1 - fraction) * 10) / 10`.
10. Wire the keys: `basic`, `experience`, `education`, `projects`, `skills`,
    `accomplishments`, `resume`, `links`, `preferences`. The **Mock Interview**
    card passes `sectionKey: null` and keeps `noGap: true` — it is earned, not
    entered, and is outside the score (pinned by an existing test).
11. Do not change `score`, `preview`, `filled`, `emptyHint` or `blocks`. Nothing
    about the existing card bodies moves.

### 5.3 `src/components/profile/profile-review.tsx`

12. Replace the gap selection:
    ```ts
    // A card is a gap when it still holds score back — not merely when it is
    // empty. A part-filled section (basic info without a gender, a project with
    // no repo link) used to vanish from this list while keeping the score under
    // 100, which is what made the percentage unexplainable.
    const gapCards = review.cards.filter((c) => !c.noGap && c.remaining > 0);
    ```
    Keep the `filled` / `empty` split for the desktop list ordering as is.
13. **"Still missing" strip** (desktop): replace `gaps.join(" · ")` with one line
    per gap card — `<b>{card.title}</b> — {card.missing.join(", ")}` plus a
    `+{card.remaining}%` badge. Cap each card at the first 3 field labels and
    append `+N more` so the strip cannot grow unbounded; the per-card body below
    carries the full list.
14. **"Complete your profile" chips** (mobile): keep the chips, append the points
    to each label — `{card.title} +{card.remaining}%` — and keep
    `onOpen(card.stepIndex)` so a tap still opens the right wizard step.
    The sub-line counts `gapCards.length` as before, now with the corrected set.
15. **Per-card body**: in `Card`, when `card.missing.length > 0`, render after
    the blocks:
    ```tsx
    <p className="pw-rv-tofinish">
      <span className="pw-rv-tofinish-k">To finish (+{card.remaining}%)</span>
      {card.missing.join(" · ")}
    </p>
    ```
    This is the piece that answers the bug for part-filled sections: the card
    shows its saved data *and* what is still short.
16. A card with `filled === false` keeps showing `emptyHint`; the new line sits
    under it, so an empty card gets both the invitation and the field list.

### 5.4 `src/components/profile/profile-wizard.css`

17. Add `.pw-rv-tofinish` (small, muted, warm left border), `.pw-rv-tofinish-k`
    (uppercase key like `.pw-rv-gaps-k`), `.pw-rv-gap-row` /
    `.pw-rv-gap-pts` for the multi-line strip, and `.pw-rv-complete-chip-pts`
    for the chip badge. Reuse the existing tokens (`--pw-font-display`,
    `--pw-warning`, `#fff6eb`, `#4b4b4b`) — no new colour variables.
18. Inside the existing mobile `@media` block at ~line 3235, leave
    `.pw-rv-gaps { display: none }` as is (the mobile CTA replaces it) and
    confirm `.pw-rv-tofinish` survives into the mobile card rows.

### 5.5 Dashboard

19. `score-donut.tsx` — drop `title={…}` from the legend button (a tooltip is not
    an answer on a phone) and render a visible detail panel under the legend for
    the active section, falling back to `nextKey` when nothing is hovered:
    `label`, `+N% left`, and `missing.join(" · ")`. Keep the existing slice /
    callout animation untouched; add the panel below the `<ul>`.
    Add an `sr-only` list of `label — missing` so the breakdown is reachable
    without a pointer.
20. `get-hired-panel.tsx` — `ScoreBreakdown` already computes `next`; no logic
    change, just pass through whatever `ScoreDonut`'s new signature needs.
21. `stage-switcher.tsx` — `ProfileTile` takes an optional
    `next: string | null`; its truncated sub-line shows `next` when present,
    else the existing `"finish it now"`. `StageSwitcher` gains
    `profileNext?: string | null` and forwards it.
22. `src/app/dashboard/page.tsx` — derive it next to the existing call, server-side:
    ```ts
    const profileNext =
      stageData.profile.sections
        .filter((s) => s.missing.length > 0)
        .sort((a, b) => b.weight * (1 - b.fraction) - a.weight * (1 - a.fraction))[0]
        ?.missing[0] ?? null;
    ```
    and pass `profileNext={profileNext}`.

### 5.6 Tests

23. In `src/features/profile/profile.test.ts`, add one suite,
    `"every unearned field is named in missing"`:
    - blank profile → every section has `missing.length > 0`; `basic.missing`
      contains `"Headline"` and `"Phone number"`.
    - the existing fully-complete fixture (the one asserting `score === 100`) →
      every section has `missing.length === 0`.
    - the invariant, over a handful of fixtures: `fraction === 1` **iff**
      `missing.length === 0`.
    - `completeness({ experience: [completeExperience({ title: "" })] })` →
      `experience.missing` contains `"Role title"`.
    - a complete experience row with no description → `missing` is exactly
      `["Role description"]` while `complete === true` (the gap that used to be
      invisible).
    - source assertion, matching the file's existing style:
      `profile-review.tsx` selects gaps on `remaining > 0` and no longer on
      `!c.filled` for the gap list.

## 6. Guardrails for Cursor (DO NOT)

- **DO NOT** touch anything under `src/features/notification/**`,
  `src/features/recruiter-notifications/**`, `src/app/actions/notification-*`,
  or any other locked notification path. Nothing in this plan needs them.
- **DO NOT** change the `complete` predicate, the weights, or the
  `WEIGHT_TENTHS` table in `completeness.ts`. The score itself is not being
  re-tuned; only the explanation is new. The existing numeric assertions in
  `profile.test.ts` must pass unchanged.
- **DO NOT** make the new `sections` parameter of `buildProfileReview`
  required. `src/features/resume/resume.test.ts` is another owner's file and
  must not be edited.
- **DO NOT** let completeness read visibility, OTP or evidence state — a source
  assertion in `profile.test.ts` enforces this and the module docblock says why.
- **DO NOT** add a new file. Labels belong inline in the scorer that owns them;
  there is no `missing-labels.ts`.
- **DO NOT** pass functions, icons or class instances from
  `src/app/profile/page.tsx` or `src/app/dashboard/page.tsx` into the client
  components. New props are strings, numbers and string arrays only.
- **DO NOT** add `requireRole` / `requireAdmin` anywhere; no public surface is
  in this change set.
- **DO NOT** import `@/lib/*` into anything on the middleware path. No file in
  this plan is on it — if that changes, stop.
- **DO NOT** use `console.*`; `lib/logger.ts` only (no new logging is expected).
- **DO NOT** restyle the report card, the donut or the dashboard tiles beyond
  the new lines listed in §5.4 and §5.5. Shallika owns visual direction.
- **DO NOT** touch `src/components/profile/profile-strength.tsx`,
  `src/components/profile/recruiter-view/**`, Prisma schema, or any repository.
- **DO NOT** report done without `npx tsc --noEmit`, `npm run test:profile` and
  `npm run build` all passing.

## 7. DB safety

Not applicable. No schema change, no migration, no seed, no write path. Every
number here is computed at read time from `CandidateDetail`.

## 8. Verification

Typecheck and tests:

```bash
npx tsc --noEmit && npm run test:profile && npm run test:resume && npm run build
```

Manual, as a candidate with a part-filled profile:

1. `/profile` — the hero shows e.g. 80%. The **Still missing** strip now names
   fields, not just section titles, and the total of its `+N%` badges accounts
   for the whole 20% shortfall.
2. Open a section that *has* data but is not at full weight (e.g. Basic
   Information with no gender). Its card shows its saved values **and** a
   "To finish (+2%) · Gender" line. Before this change that card was silent.
3. Click a chip / the card's Edit — the correct wizard step opens (`stepIndex`
   mapping is unchanged).
4. Fill the named field, save. The score rises by exactly the badge amount and
   that field leaves every list.
5. At 100% the strip, the chips and all the "To finish" lines disappear, and the
   wizard's Profile Complete pill still fires.
6. `/dashboard` — the "Complete profile" tile's sub-line names the single most
   valuable missing field. In **What makes up your score**, hover or tap a
   legend row: the panel under the legend names that section's missing fields.
   Check on a phone viewport, where the old `title=` tooltip gave nothing.
7. Mock Interview never appears in any gap list.

Exactly these files should show in `git diff --name-only`:

```
docs/plans/173-profile-missing-field-breakdown.md
src/app/dashboard/page.tsx
src/components/dashboard-hub/stages/get-hired-panel.tsx
src/components/dashboard-hub/stages/score-donut.tsx
src/components/dashboard-hub/stages/stage-switcher.tsx
src/components/profile/profile-review.tsx
src/components/profile/profile-wizard.css
src/features/profile/build-review.ts
src/features/profile/completeness.ts
src/features/profile/profile.test.ts
```

## 9. Commit message

```
Plan 173 — name the missing profile fields behind the strength score

computeCompleteness now emits the concrete unearned fields per section, and
both surfaces that show the percentage explain it: the profile report card
lists the fields (and the points) still outstanding per section, including for
part-filled sections that the old `filled`-based gap list dropped, and the
dashboard donut shows that breakdown visibly instead of in a title attribute.

No weights, no `complete` predicates and no write paths change.
```

## 10. Ownership

Cross-module. `src/features/profile/**` and `src/components/profile/**` sit in
**Shivansh's** Candidate profile domain; the dashboard surfaces are shared.
Neither path is listed in `.github/CODEOWNERS` today, so nothing is
GitHub-enforced — but per the repo CLAUDE.md this needs Shivansh's sign-off
before merge. No security, auth or authorization surface is touched.

---

## 11. Implementation notes (after the fact)

Deviations from §5, all small:

- **`get-hired-panel.tsx` was not touched.** `ScoreDonut`'s signature did not
  change — the new panel is derived inside the component from `sections` and
  `nextKey`, both of which it already had. One fewer file than planned.
- **A mobile-only gap line was added** (`.pw-rv-gapline` in `CardHead`). §5.4
  assumed the per-card "To finish" line would reach phones; it does not —
  `.pw-rv-card-body` is `display: none` under the mobile media query, so the
  phone layout would have shown the points short and never the fields. The gap
  line lives in the card head, where the compact row can show it.
- **Rounding.** The headline score rounds `earnedTenths / 10` to an integer
  while each section's remaining is exact to a tenth, so the per-section badges
  can sum to up to 0.5% more than `100 − score` (e.g. 70% shown, 30.5% of
  badges). Each badge is individually truthful and the score is unchanged; this
  is left as is rather than re-tuning a score this plan explicitly does not
  touch.

Two tests fail on `npm run test:profile` / `npm run test:resume`, **both
pre-existing on master** (verified by stashing this branch):

- `Mock Interview is marked optional rather than unfinished` — the mock wizard
  step is commented out in `src/app/profile/page.tsx`, so the assertion has
  nothing to read.
- `the existing résumé link keeps working` — in `src/features/resume`.
