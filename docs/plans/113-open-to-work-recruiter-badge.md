# Plan 113 — "Open to work" is visible to recruiters

> **Status: IMPLEMENTED in the working tree on `ab-dev`, not committed.**
> Written as a plan, then executed in the same session at the owner's request
> (one-off waiver of the architect-only rule in `CLAUDE.md`). `npx tsc --noEmit`
> and `npm run build` are clean; the four hire suites pass (100 assertions).
> Browser verification was **not** done — it needs an approved recruiter session
> and a candidate with the toggle on, against the production Neon branch. The
> manual checklist in §8 is still outstanding.
> One file was added beyond §4: `src/components/hire/guest-cart-view.tsx`, whose
> `toRow` dropped every field but three, so a signed-out recruiter's cart at
> `/talent/shortlist` would have shown no badge.

> **Nothing here changes the database.** `CandidatePreference.openToWork` already
> exists (`prisma/schema.prisma:2274`), is already written by `/profile`, and is
> already carried into `/hire` on `AvailabilitySnapshot`. This plan closes the
> last hop: making that boolean reach the recruiter's eye. No migration, no new
> model, no new column, no flag.
>
> Baseline: `ab-dev` @ `51357cc`.

## 1. Goal

When a candidate turns **Open to work** on in `/profile` → Career Preferences, a
recruiter sees an **"Open to work"** badge beside that candidate's name on every
recruiter-facing surface — Scout result cards, the candidate inspector, the
evidence resume, Saved for Later, the Shortlist pod, the cart, and the program
evidence profile. Turning it off removes the badge everywhere.

The badge is a *status signal only*. It never becomes a discovery gate, never
filters anybody out, and never carries a salary figure.

## 2. Current behavior

### Already wired — candidate side (do not rebuild any of this)

| Piece | Where |
| --- | --- |
| The toggle | `src/components/profile/preferences-section.tsx:63` (`PwTogglePanel` "Open to work") |
| Zod boundary | `preferencesSchema.openToWork` — `src/lib/validations/candidate-profile.ts:328` |
| Write path | `savePreferencesAction` → `savePreferences` — `src/repositories/candidate-detail.ts:766` → upserts `CandidatePreference` |
| Read back | `getCandidateDetail` selects `preference.openToWork` — `candidate-detail.ts:265`, `:349` |
| Candidate's own badge | `src/components/profile/profile-card.tsx:223` (`.pw-open-to-work`), fed from `src/app/profile/page.tsx:403` |
| Completeness | `src/features/profile/completeness.ts` already counts it |

`savePreferences` carries an explicit comment that `CandidateVisibility` is *not*
touched here. That stays true.

### Already wired — hire pipeline (built, plumbed, never displayed)

| Piece | Where |
| --- | --- |
| Batched read | `listCandidateAvailability` — `src/repositories/candidate.ts:371` (maps `CandidatePreference`) |
| Hire-side wrapper | `loadAvailabilityByUserId` — `src/features/hire/dossier.ts:121` (try/catch + logger, returns empty map on failure) |
| On the dossier | `AvailabilitySnapshot.openToWork` — `src/features/hire/types.ts:181`; set in `dossier.ts:346` (program) and `challenge-dossier.ts:338` (challenge) |
| Into scoring | `track-loaders.ts:156`, `:222`, `:266` pass `availability: d.availability` onto `ScoreableMember` |
| Explicit recruiter filter | `score-candidate.ts:275` (hard filter when `spec.extra.openToWork === true`) and `repositories/talent.ts:199` |

### The three actual gaps

1. **`toPublicMatch` drops it.** `src/features/hire/to-public-match.ts:202` maps
   `availabilityUnknown` and nothing else from availability, so `MatchCardData`
   has no field for it. The flag can be `true` in the database and be invisible
   on every card.
2. **Every recruiter surface only draws the negative.** `buildCardPills`
   (`hire-card-facts.tsx:189`), `match-card.tsx:392`, `candidate-inspector.tsx:243`
   and `evidence-resume.tsx:186` render "Availability unconfirmed" when there is
   no preference row, and nothing at all when `openToWork === true`.
3. **Hackathon candidates cannot have availability at all.**
   `hackathon-dossier.ts:88` hard-codes `availability: null`, so a hackathon
   candidate who sets the toggle is permanently "Availability unconfirmed" and
   could never show the badge.

## 3. Decisions locked (do not re-litigate)

| Question | Decision |
| --- | --- |
| Does `openToWork` affect who is discoverable? | **No.** Discovery stays `CandidateVisibility.searchableByRecruiters` via `searchableUserWhere()` (`repositories/talent.ts:29`). `searchable && !openToWork` is a normal state and must keep rendering a full card |
| Where does the card get the boolean? | `ScoredCandidate.openToWork`, derived in `scoreCandidate` from `member.availability?.openToWork === true` — the *same object* as `dossier.availability`, since `track-loaders.ts` sets `availability: d.availability`. Chosen over reading `dossier?.availability` inside `toPublicMatch` because it sits beside the existing `availabilityUnknown`, works when no dossier was assembled, and is testable from `scoreCandidate` with no dossier stub |
| Required or optional on `MatchCardData`? | **Required `openToWork: boolean`**, exactly like `availabilityUnknown`. Every card mapper is then forced by the compiler to state a value, which is how the fabricated cards get an explicit `false` |
| Fabricated cards (sample / locked preview / virtual) | **Explicit `openToWork: false`.** A generated card must never claim a person is looking |
| A pill in `buildCardPills`, or a badge beside the name? | **A badge beside the name only.** Every consumer of `buildCardPills` / `MatchPills` already prints a candidate heading (`desk-card__role`, `hire-pod__name`), so a pill would be a guaranteed duplicate *and* would spend one of the 4–5 capped pill slots that currently carry matched skills and the evidence headline |
| One badge component or per-surface markup? | **One** — `OpenToWorkBadge` in `hire-card-facts.tsx`, which already exists as the shared card-vocabulary module and already carries the "one builder so cards do not drift" comment |
| Tailwind or `hire-scout.css`? | **Tailwind utilities**, in the emerald language `match-card.tsx:305` already uses. `hire-scout.css` is loaded by `src/app/hire/layout.tsx` only, and two of the surfaces (`/talent/shortlist`, `/talent/members/[id]`) are outside it |
| Saved request pages: read the badge from the stored match blob? | **No — read it live.** `TalentRequestMatch.evidence` is a snapshot frozen at match time; a candidate who has since switched off would keep showing the badge forever. `loadRequestMatches` already re-applies searchability on read and already recomputes the compensation band rather than storing it — this follows the same rule |
| Does the badge get persisted into `TalentRequestMatch.evidence`? | **No.** `hire-actions.ts:421` keeps writing exactly what it writes today |
| Salary | Untouched. `toPublicMatch` still never emits `expectedSalary*`; the new call sites map **only** `openToWork` out of `CandidateAvailabilityView` |
| Candidate-side live toggle (badge updates only after server revalidate) | **Out of scope.** Noted in §10, not built here |
| `explain-matches.ts` payload | **Unchanged.** The LLM prompt surface is not widened for this |

## 4. Files to touch

### Shape — the boolean gets a home

| File | | Note |
| --- | --- | --- |
| `src/features/hire/types.ts` | `[edit]` | `openToWork: boolean` on `ScoredCandidate`, beside `availabilityUnknown` |
| `src/features/hire/score-candidate.ts` | `[edit]` | Derive it once; set on both return objects (hard-filtered and normal) |
| `src/features/hire/hackathon-dossier.ts` | `[edit]` | Load real availability instead of hard-coding `null` |
| `src/components/hire/match-card.tsx` | `[edit]` | `openToWork: boolean` on `MatchCardData` + badge in `RealMatchCard`'s header |
| `src/features/hire/to-public-match.ts` | `[edit]` | Pass it through |
| `src/features/hire/load-request-matches.ts` | `[edit]` | Live availability read for saved request matches — never from the frozen blob |
| `src/features/hire/sample-card.ts` | `[edit]` | `openToWork: false` |
| `src/features/hire/locked-preview.ts` | `[edit]` | `openToWork: false` |
| `src/features/hire/virtual-candidate.ts` | `[edit]` | `openToWork: false` |

### Storage DTOs — so the badge survives a reload

| File | | Note |
| --- | --- | --- |
| `src/components/hire/guest-cart.ts` | `[edit]` | `openToWork?: boolean` on `GuestCartItem`; set in `cartItemFromMatch`, parsed in `normalizeGuestCartItem` |
| `src/components/hire/desk-shortlist.ts` | `[edit]` | Same on `DeskShortlistItem` / `itemFromMatch` |
| `src/components/hire/shortlist-cart.tsx` | `[edit]` | `openToWork?: boolean` on `CartRow`; badge on the cart row |

### Server producers of `CartRow` / the program profile

| File | | Note |
| --- | --- | --- |
| `src/features/talent-pool/pool.ts` | `[edit]` | `openToWork: boolean` on `ShortlistRow` and on `TalentProfile`; one `listCandidateAvailability` call in `getShortlist` and one in `getTalentProfile` |
| `src/app/hire/layout.tsx` | `[edit]` | Pass `openToWork` onto `podRows` |
| `src/app/talent/shortlist/page.tsx` | `[edit]` | Pass `openToWork` onto `rows` |
| `src/app/talent/members/[id]/page.tsx` | `[edit]` | Badge beside the `AB-####` heading |

### UI

| File | | Note |
| --- | --- | --- |
| `src/components/hire/hire-card-facts.tsx` | `[edit]` | Export `OpenToWorkBadge` — the single implementation |
| `src/components/hire/desk-match-card.tsx` | `[edit]` | Badge beside `MaskedName` in `desk-card__role` |
| `src/components/hire/candidate-inspector.tsx` | `[edit]` | Badge beside `hire-detail__name` |
| `src/components/hire/evidence-resume.tsx` | `[edit]` | Badge beside `hire-sheet__name` |
| `src/components/hire/hire-saved-later.tsx` | `[edit]` | Carry through `savedToMatch`; badge beside `hire-pod__name` |
| `src/components/hire/hire-talent-pod.tsx` | `[edit]` | Carry through `cartRowToMatch` and the guest-cart→`CartRow` sync; badge beside `hire-pod__name` |

### Tests

| File | | Note |
| --- | --- | --- |
| `src/features/hire/score-candidate.test.ts` | `[edit]` | Derivation + `toPublicMatch` pass-through + "false is not a gate" |
| `src/features/hire/visibility.test.ts` | `[edit]` | Two new guards (see step 20) |
| `src/features/hire/sample-card.test.ts` | `[edit]` | Fabricated cards never claim `openToWork` |
| `src/features/hire/virtual-candidate.test.ts` | `[edit]` | Same for the virtual card |

**No other file may be created or edited.** In particular: no new component file,
no new helper module, no CSS file, no `prisma/` change.

## 5. Server vs Client

| Module | Kind | Note |
| --- | --- | --- |
| `types.ts`, `score-candidate.ts`, `to-public-match.ts`, `sample-card.ts`, `locked-preview.ts`, `virtual-candidate.ts` | pure TS, no directive | Unchanged status. `to-public-match.ts` keeps its **type-only** import of `MatchCardData` — do not turn it into a value import |
| `dossier.ts`, `hackathon-dossier.ts`, `load-request-matches.ts`, `talent-pool/pool.ts` | `server-only` | Already; keep it |
| `src/app/hire/layout.tsx`, `src/app/talent/shortlist/page.tsx`, `src/app/talent/members/[id]/page.tsx` | **Server Components** | They pass plain serialisable data down. `openToWork` is a boolean — safe across the boundary |
| `hire-card-facts.tsx` | no directive, consumed only by client components | Keep it that way. `OpenToWorkBadge` takes one optional boolean prop — **no function props, no icon instances, no class instances** |
| `desk-match-card.tsx`, `candidate-inspector.tsx`, `evidence-resume.tsx`, `hire-saved-later.tsx`, `hire-talent-pod.tsx`, `shortlist-cart.tsx`, `match-card.tsx` | `"use client"` | Already |

Nothing in this plan is imported by `middleware.ts` or `auth.config.ts`. The edge
bundle is not affected.

## 6. Steps

### A. The boolean reaches `MatchCardData`

**Step 1 — `src/features/hire/types.ts`.** On `ScoredCandidate`, directly under
`availabilityUnknown: boolean;`, add:

```ts
  /**
   * The candidate says they are actively looking (`CandidatePreference.openToWork`).
   *
   * A *status*, never a gate. Discoverability is `CandidateVisibility.
   * searchableByRecruiters` and lives only in `repositories/talent.ts` —
   * searchable-and-not-looking is a normal state and must keep ranking normally.
   * False when there is no preference row, which is also `availabilityUnknown`.
   */
  openToWork: boolean;
```

**Step 2 — `src/features/hire/score-candidate.ts`.** Beside the existing
`const availabilityUnknown = member.availability == null;` (line 376) add:

```ts
const openToWork = member.availability?.openToWork === true;
```

Add `openToWork,` to **both** returned objects — the hard-filtered early return
(~line 449, next to `availabilityUnknown`) and the normal return (~line 498).
Change nothing else in this file: no new gap string, no scoring weight, no hard
filter. The existing `extra.openToWork` hard filter at line 275 stays exactly as
it is.

**Step 3 — `src/components/hire/match-card.tsx`.** On `MatchCardData`, directly
under `availabilityUnknown: boolean;` (line 61):

```ts
  /**
   * The candidate has said they are open to work. Shown as a badge beside the
   * name. Never a filter, and never a reason to hide a card — see
   * `OpenToWorkBadge` in hire-card-facts.tsx.
   */
  openToWork: boolean;
```

This is deliberately **required**: the compiler now names every card mapper that
has to decide, which is how the fabricated cards below get their explicit `false`.

**Step 4 — `src/features/hire/to-public-match.ts`.** In the returned object, on
the line after `availabilityUnknown: match.availabilityUnknown,`:

```ts
    openToWork: match.openToWork === true,
```

Do not add anything else from `availability`. The salary comment block above
(lines 167–180) stays untouched and stays true.

**Step 5 — `src/features/hire/load-request-matches.ts`.** A saved requirement
page does not go through `toPublicMatch`; it rebuilds the card from the frozen
`TalentRequestMatch` row. Read the flag live instead:

- import `loadAvailabilityByUserId` from `@/features/hire/dossier` — it already
  wraps `listCandidateAvailability` in a try/catch that returns an empty map, so
  an unreadable preference table degrades to "no badge", never to a broken page
- add it as a fifth entry to the existing `Promise.all` (line 91), destructured
  as `availabilityByUser`, called with `candidateUserIds` — the list already
  filtered through `filterSearchableUserIds`
- in the returned object, beside `availabilityUnknown: m.availabilityUnknown,`:
  `openToWork: availabilityByUser.get(m.candidateUserId)?.openToWork === true,`

Live, not stored, for the same reason the compensation band on line 146 is
recomputed rather than read back: the stored blob is a snapshot from match time,
and a candidate who has since switched off would keep showing the badge forever.
Do not add `openToWork` to the `evidence` JSON written in `hire-actions.ts:421`.

**Step 6 — fabricated cards.** Add `openToWork: false,` beside the existing
`availabilityUnknown` line in each of:

- `src/features/hire/sample-card.ts` (~line 41)
- `src/features/hire/locked-preview.ts` (~line 127)
- `src/features/hire/virtual-candidate.ts` (~line 155)

In `locked-preview.ts` and `virtual-candidate.ts`, add a one-line comment: a
fabricated card never claims a person is looking.

### B. Hackathon candidates can have availability

**Step 7 — `src/features/hire/hackathon-dossier.ts`.** Import
`loadAvailabilityByUserId` from `@/features/hire/dossier` (the file already
imports `computeCoverage` from there). Before the `rows.map(...)`:

```ts
const availability = await loadAvailabilityByUserId(rows.map((r) => r.userId));
```

Replace `availability: null,` (line 88) with a snapshot built from
`availability.get(row.userId)`, mapped field-for-field the same way
`challenge-dossier.ts:338` does it, falling back to `null` when there is no row.

> **Side effect to expect and accept:** a hackathon candidate who *has* a
> preference row stops showing "Availability unconfirmed", because
> `availabilityUnknown` is `member.availability == null`. That is the correct
> reading — it was only unconfirmed because this file refused to look.

### C. The single badge

**Step 8 — `src/components/hire/hire-card-facts.tsx`.** Add, near
`MatchMetaTags`:

```tsx
/**
 * "Open to work", beside the candidate's name.
 *
 * One component, six call sites: the alternative is six copies of the same
 * conditional, which is exactly how the pill rows drifted before `buildCardPills`
 * pulled them together.
 *
 * It renders nothing unless the answer is a definite yes — `false` and a missing
 * value are the same thing here, and neither is a claim about the candidate.
 * Deliberately NOT part of `buildCardPills`: every surface that draws that row
 * also prints a name, so a pill would be a duplicate and would spend one of the
 * four or five slots that carry matched skills and the evidence headline.
 */
export function OpenToWorkBadge({ openToWork }: { openToWork?: boolean }) {
  if (openToWork !== true) return null;
  return (
    <span
      className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-900 dark:text-emerald-100"
      title="This candidate has told us they are actively looking. It does not change who can find them."
    >
      Open to work
    </span>
  );
}
```

The internal `null` return is the point: every call site is a bare
`<OpenToWorkBadge openToWork={match.openToWork} />` with no surrounding
conditional.

**Step 9 — `desk-match-card.tsx`.** In the real-card branch, inside the
`<p className="desk-card__role">` (line 280), after the name / `MaskedName` and
before the `Top match` chip. Import `OpenToWorkBadge` from `hire-card-facts`
alongside the existing `buildCardPills` import. Change nothing about the
`availability`-key pill filter at line 344.

**Step 10 — `candidate-inspector.tsx`.** After the closing `</h3>` of
`hire-detail__name` (line 149), wrapped so it sits on the same visual row —
`<OpenToWorkBadge openToWork={match.openToWork} />`. Import from
`hire-card-facts`, which this file already imports (`skillTint`, `trackLabel`).
Do **not** put it in the `desk-card__facts` row at line 217; that row is pills.

**Step 11 — `evidence-resume.tsx`.** Beside `<h1 className="hire-sheet__name">`
(line 153). Wrap the `h1` and the badge in a flex row if needed; do not restyle
the sheet.

**Step 12 — `match-card.tsx` (`RealMatchCard`).** In the header
`<div className="flex flex-wrap items-center gap-2">` (line 248), after the
track label and before the `Top match` chip. The existing
`availabilityUnknown` `<li>` at line 392 stays exactly as it is.

### D. The badge survives a reload and a sign-in

**Step 13 — `src/components/hire/guest-cart.ts`.** Add
`openToWork?: boolean;` to `GuestCartItem` (beside `availabilityUnknown`), set
`openToWork: match.openToWork,` in `cartItemFromMatch`, and in
`normalizeGuestCartItem` add `openToWork?: unknown;` to the `row` type plus
`openToWork: typeof row.openToWork === "boolean" ? row.openToWork : undefined,`
in the `extra` object — the same shape as `availabilityUnknown` beside it.
Optional here, not required: these rows are parsed back out of `localStorage`
and a cart written before this change has no such key.

**Step 14 — `src/components/hire/desk-shortlist.ts`.** Same three edits on
`DeskShortlistItem` / `itemFromMatch`.

**Step 15 — `src/components/hire/shortlist-cart.tsx`.** Add
`openToWork?: boolean;` to `CartRow`. In the row body, render
`<OpenToWorkBadge openToWork={r.openToWork} />` next to the name/`publicId`
(inside the `min-w-0 flex-1` div, on the same line as the name). Import from
`hire-card-facts`.

**Step 16 — `src/components/hire/hire-saved-later.tsx`.** In `savedToMatch`, add
`openToWork: row.openToWork ?? false,` beside `availabilityUnknown`. Render the
badge beside `<p className="hire-pod__name">` (line 198). Do **not** add it to
`MatchPills`.

**Step 17 — `src/components/hire/hire-talent-pod.tsx`.** Three edits:
- `cartRowToMatch`: `openToWork: row.openToWork ?? false,`
- the guest-cart→`CartRow` sync map in the `useEffect` (line 72): carry
  `openToWork: i.openToWork,`
- badge beside `<p className="hire-pod__name">` (line 293)

### E. Server-rendered surfaces

**Step 18 — `src/features/talent-pool/pool.ts`.** Import
`listCandidateAvailability` from `@/repositories/candidate`.

- `ShortlistRow`: add `openToWork: boolean;`. In `getShortlist`, after `shown`
  is computed, call
  `const availability = await listCandidateAvailability(shown.map((i) => i.member.userId));`
  and map `openToWork: availability.get(i.member.userId)?.openToWork === true`.
- `TalentProfile`: add `openToWork: boolean;`. In `getTalentProfile`, one call
  for `[member.userId]`, mapped the same way.

**Map `openToWork` and nothing else.** `CandidateAvailabilityView` also carries
`expectedSalaryMin` / `expectedSalaryMax`; those are admin-only and must not
enter `ShortlistRow`, `TalentProfile`, `CartRow` or any component prop.

**Step 19 — the three server pages.**
- `src/app/hire/layout.tsx`: add `openToWork: r.openToWork,` to the `podRows`
  map (line 32).
- `src/app/talent/shortlist/page.tsx`: add `openToWork: r.openToWork,` to the
  `rows` map (line 52).
- `src/app/talent/members/[id]/page.tsx`: render
  `<OpenToWorkBadge openToWork={profile.openToWork} />` inside the
  `flex flex-wrap items-baseline gap-2` header row (line 56), after the
  `candidatePublicId` `<h1>`.

### F. Tests

**Step 20 — `src/features/hire/visibility.test.ts`.** Keep every existing suite
byte-for-byte. Add two:

```ts
suite("the pool clause is still not openToWork either", () => {
  assert(
    !JSON.stringify(memberEligibilityWhere(["cohort_1"])).includes("openToWork"),
    "the pool clause must not filter on openToWork",
  );
});

suite("the open-to-work badge did not smuggle salary onto a card", () => {
  const src = readFileSync(
    join(process.cwd(), "src/features/hire/to-public-match.ts"),
    "utf8",
  );
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert(
    !code.includes("expectedSalary"),
    "the candidate's declared salary must never reach MatchCardData",
  );
});
```

**Step 21 — `src/features/hire/score-candidate.test.ts`.** Import
`toPublicMatch` from `@/features/hire/to-public-match` (its `MatchCardData`
import is type-only, so it loads under plain `tsx`). Add three blocks in the
existing bare-block style:

- availability with `openToWork: true` → `scored.openToWork === true`,
  `scored.availabilityUnknown === false`, `!scored.hardFiltered`, and
  `toPublicMatch(scored).openToWork === true`
- availability with `openToWork: false` → `scored.openToWork === false`,
  `!scored.hardFiltered` (the existing "openToWork false stays searchable" suite
  at line 171 already asserts the second half — extend rather than duplicate it),
  and `toPublicMatch(scored).openToWork === false`
- `availability: null` (the `baseMember` default) → `openToWork === false` **and**
  `availabilityUnknown === true`, so the two stay distinguishable

Leave the existing "explicit openToWork filter hard-filters" block (line 175)
untouched — that is the recruiter's opt-in filter and it must keep working.

**Step 22 — `sample-card.test.ts` / `virtual-candidate.test.ts`.** One suite each:
every card from `buildSampleCards` and `buildLockedPreviewCards`
(`sample-card.test.ts`), and from `virtualCandidateToCard`
(`virtual-candidate.test.ts`), has `openToWork === false`. Reason in the comment:
a fabricated card must never claim a real person is looking for a job.

## 7. DB safety

**Not applicable — this plan makes no schema or data change.**

- No migration, no `prisma/schema.prisma` edit, no seed, no backfill, no Neon
  branch needed.
- `CandidatePreference.openToWork` already exists with
  `@default(false)` and an `@@index([openToWork, availableFrom])`
  (`prisma/schema.prisma:2271–2293`). If a build error suggests the column is
  missing, **stop and report** — do not write a migration.
- No `ENABLE_NEW_*` / `ENABLE_DUAL_WRITE` flag is read or changed. The 078
  cutover state is untouched.
- All reads go through `src/repositories/` (`listCandidateAvailability`) or the
  existing `features/hire/dossier.ts` wrapper. No new `prisma.candidatePreference`
  call outside the repository layer.

## 8. Verification

### Build / typecheck

```bash
npm run build
```

The required `openToWork` on `MatchCardData` and `ScoredCandidate` is the design:
if the build names a card mapper that was missed, that mapper is a real surface
and needs a value. **Do not silence it with `?` or `as`.**

### Tests

```bash
npm run test:visibility
```

```bash
npm run test:hire-score
```

```bash
npm run test:sample
```

```bash
npm run test:virtual
```

All four must pass. `test:visibility` failing means the discovery gate moved —
that is a stop-and-report, not a test to update.

### Manual — the loop that motivated this

1. Sign in as a test candidate, `/profile` → Career Preferences → **Open to
   work** on → Save.
2. Reload `/profile`: the orange **Open To Work** tag is on the profile card
   (existing behaviour, must be unchanged).
3. As a recruiter, run a Scout search at `/hire` that returns that candidate.
   The result card shows **Open to work** beside the name.
4. Open the inspector ("View more details") — badge beside the name there too.
5. "Full evidence profile" → `/hire/evidence` — badge beside the heading.
6. Save for later, then open Saved for Later — badge on the row.
7. Move to Shortlist, open the pod and `/talent/shortlist` — badge on both.
8. Candidate turns the toggle **off** → recruiter reloads → **badge gone on every
   one of those surfaces**, and the candidate still appears in the search results
   with an unchanged score and rank.
9. A candidate with **no** `CandidatePreference` row: no badge, and
   "Availability unconfirmed" still shows exactly as it does today.
10. Open a saved requirement at `/hire/[requestId]/candidates` for a candidate
    who has since toggled off: no badge (this is the live-read check — a stale
    badge here means step 5 of the plan was skipped).
11. `/talent/members/[id]` for a program member with the toggle on: badge beside
    the `AB-####` heading.

### Files that should have changed

Exactly the 26 files in §4 and this plan document. If `git status` shows a new
component file, a CSS file, anything under `prisma/`, or an edit to
`explain-matches.ts` / `repositories/talent.ts` / `middleware.ts`, something went
wrong — revert it.

## 9. Guardrails for Cursor (DO NOT)

- **DO NOT** add `openToWork` to `searchableUserWhere()`, `visibleProgramMemberWhere()`,
  `memberEligibilityWhere()`, or any other visibility clause. Discovery is
  `CandidateVisibility.searchableByRecruiters` and nothing else.
- **DO NOT** hide, dim, deprioritise, sort down or hard-filter a candidate whose
  `openToWork` is `false`. Absence of the badge is the entire treatment.
- **DO NOT** wire the profile toggle to `CandidateVisibility` in any direction.
  The comments in `savePreferences` and `upsertCandidateAvailability` say so;
  they are the decision, not a leftover.
- **DO NOT** touch the explicit recruiter filter — `score-candidate.ts:275` and
  `repositories/talent.ts:199`. That is opt-in and already correct.
- **DO NOT** create a Prisma model, column, migration or seed. The column exists.
- **DO NOT** touch any `ENABLE_NEW_*` flag or dual-write config.
- **DO NOT** let `expectedSalaryMin` / `expectedSalaryMax` / `salaryCurrency` out
  of `CandidateAvailabilityView` into any card, row, prop or JSON blob.
  `listCandidateAvailability` returns them; map only `openToWork`.
- **DO NOT** add the badge to public non-recruiter pages — `/students/[id]`,
  `/r/[token]`, the landing site, the dashboard. Recruiter surfaces only.
- **DO NOT** create a new component/helper file for this. `OpenToWorkBadge` lives
  in `hire-card-facts.tsx`; the boolean needs no abstraction.
- **DO NOT** add a pill to `buildCardPills`, and do not change the existing
  `availability`-key filter in `desk-match-card.tsx:344`.
- **DO NOT** restyle the hire desk, the cards, the inspector or the resume sheet.
  One badge, existing spacing.
- **DO NOT** persist `openToWork` into `TalentRequestMatch.evidence` — a frozen
  copy goes stale and would show a badge for someone who has switched it off.
- **DO NOT** change `explain-matches.ts`, the Scout agent, its tools or the
  prompt. The LLM surface is not part of this.
- **DO NOT** add `requireRole` / `requireAdmin` to anything. No public surface in
  this plan changes its auth posture — `/hire` and `/hire/matches` stay public.
- **DO NOT** import `@/lib/*` into anything reachable from `middleware.ts`.
  Nothing here should be, but check if a build warning suggests otherwise.
- If a build error contradicts anything above, **trust the error, stop, and
  report** — do not improvise a schema or a cast.

## 10. Deliberately not in this plan

- **Live candidate-side toggle.** `/profile`'s own orange tag is fed from server
  props and updates on save + revalidate, not on the toggle click. Real, minor,
  and separate — folding it in here would mix a candidate-UX change into a
  recruiter-visibility change.
- Registration, dashboard and profile empty-state.
- `explain-matches` / Scout rationale wording.
- Any change to how `openToWork` is *written*.

## 11. Commit message

```
feat(hire): show "Open to work" to recruiters

Candidates could set Open to work in /profile → Career Preferences and it
reached CandidatePreference, the dossier and the scorer — but toPublicMatch
never put it on MatchCardData, so no recruiter surface could draw it. The flag
was true in the database and invisible on every card.

Carries openToWork from AvailabilitySnapshot through ScoredCandidate and
MatchCardData to one shared OpenToWorkBadge, rendered beside the candidate's
name on the Scout result card, the inspector, the evidence resume, Saved for
Later, the Shortlist pod, the cart and the program evidence profile. Saved
requirement pages read it live rather than from the frozen match blob, so a
candidate who switches off stops showing the badge everywhere. Hackathon
dossiers now load availability instead of hard-coding null, which is why a
hackathon candidate could never have shown it.

Not a discovery gate: searchableUserWhere() is untouched and still the only
answer to "may a recruiter find this person". Searchable-and-not-looking keeps
ranking normally and simply has no badge. Declared salary stays off every
recruiter surface — a test now asserts to-public-match.ts never names it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
