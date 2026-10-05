# 181 — Pipeline stage rail: stop the chevrons cutting their own labels

## 1. Goal
The `/hire/pipeline` stage rail clips its own text: the leading letters of the
longest labels disappear into the chevron's left notch (`SHORTLISTED` renders as
`HORTLISTED`, `INTERVIEWING` as `TERVIEWING`) and the count badge is swallowed by
the right arrow. Make every step wide enough for its own label and count, so no
glyph is ever drawn under the clip-path.

## 2. Current behavior
`.hire-pipe-step` (src/app/hire/hire-scout.css:12679) is `flex: 1 1 0` with
`min-width: 96px`, `white-space: nowrap`, `justify-content: center`, and
`padding: 0 6px 0 20px`, under a `clip-path` whose notch (left) and arrow (right)
each eat 18px at the vertical mid-line — exactly where the text sits.

Two separate failures fall out of that:

- **Overflow.** `Interviewing` + a count needs ~125px of content; `Shortlisted`
  + a count needs ~123px. At nine steps the box is ~114px on a 1440px screen and
  96px once the rail scrolls, so the content overflows. A centred flex line that
  overflows spills on *both* sides, so the first letter lands in the notch and
  the badge lands in the arrow, where `clip-path` erases them. Nothing truncates
  with an ellipsis — the letters are simply cut in half.
- **Padding that ignores the clip.** Even for a step whose content *does* fit
  (`Rejected 2`), the 6px right padding is less than the 18px arrow, so the
  badge is drawn over the cut-away triangle and shows as a sliced pill.

Measured in a standalone harness against the live rule set (nine real labels,
1050px rail): `Shortlisted` content 123px in a 114px box, `Interviewing` 125px in
114px — both clipped. Confirms the screenshot.

## 3. Files to touch
- `src/app/hire/hire-scout.css` `[edit]` — `.hire-pipe-step`,
  `.hire-pipe-step:first-child`, `.hire-pipe-step__n`. CSS only.

No TSX changes: `pipeline-board.tsx` already renders the label and count as two
spans and needs no new markup.

## 4. Server vs Client
Nothing changes. `PipelineBoard` stays a Client Component (`"use client"`, it
owns the selected-stage state); `src/app/hire/pipeline/page.tsx` stays a Server
Component. No props cross the boundary in this change.

## 5. Steps
1. `.hire-pipe-step`: replace `min-width: 96px` with `min-width: max-content` so
   a step can never be squeezed below its own label + count. Keep `flex: 1 1 0`
   so the steps still share any spare width evenly when nine of them fit.
2. `.hire-pipe-step`: change `padding: 0 6px 0 20px` to `padding: 0 24px` — the
   notch and the arrow are both 18px deep at mid-height, so 24px clears each
   with 6px of breathing room, and the label sits visually centred again.
3. `.hire-pipe-step:first-child`: keep its flat left edge, set `padding-left:
   14px` (no notch to clear, but it should not hug the edge).
4. `.hire-pipe-step__n`: add `flex: none` so the count pill cannot be shrunk by
   the flex line.
5. Rewrite the stale `min-width: 96px` comment to say what now drives the width
   (the longest label) and that the rail scrolls when nine of them do not fit —
   which `.hire-pipe-rail`'s `overflow-x: auto` already handles.

## 6. Guardrails for Cursor (DO NOT)
- DO NOT touch `pipeline-board.tsx`, `stage-labels.ts`, `pipeline-card.tsx` or
  any pipeline action/repository. This is a CSS-only fix.
- DO NOT shorten or abbreviate the stage labels to make them fit.
- DO NOT add `overflow: hidden` / `text-overflow: ellipsis` to the step — the
  `clip-path` already crops, and an ellipsis would hide the same information
  the bug hides.
- DO NOT change the chevron geometry (the 18px notch/arrow polygon), the fills,
  the 44px height or the 4px rail gap — the shape is the agreed design.
- DO NOT remove `.hire-pipe-rail`'s `overflow-x: auto`; scrolling is the
  intended fallback at narrow widths.
- DO NOT add a new CSS file or a wrapper component for three declarations.

## 7. DB safety
Not applicable — no schema or data change.

## 8. Verification
- `npm run build` passes (CSS is compiled through the app's global imports).
- Sign in as a recruiter, open `/hire/pipeline` with candidates spread across
  stages, and confirm: `SHORTLISTED` shows its leading `S`, `INTERVIEWING` shows
  its leading `IN`, and every count pill sits clear of the right arrow.
- Narrow the window to ~900px: the rail scrolls horizontally and no label is
  cut mid-letter at any width.
- Click through stages: the active-step bar still spans the chevron's bottom
  edge and the panel below still filters.
- Exactly one file should show in `git diff`:
  `src/app/hire/hire-scout.css`.

## 9. Commit message
```
fix(hire): stop the pipeline stage rail clipping its own labels

The chevrons were flex: 1 1 0 with min-width: 96px, so SHORTLISTED and
INTERVIEWING overflowed their boxes; a centred overflow spills both ways,
which put the first letter under the 18px clip-path notch and the count
badge under the 18px arrow. Size each step to its content and pad past the
clip on both sides; the rail already scrolls when nine will not fit.
```
