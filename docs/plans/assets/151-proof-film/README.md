# Proof Film — plan 151 concept demo

A concept film of the gamified candidate journey proposed in
[`docs/plans/151-gamification-engine.md`](../../151-gamification-engine.md).
**Sample data only.** Nothing here is product code or reads the database.

It follows one student, Aarav, from the First Steps quest through a verified
mission, XP, a badge, weekly streaks, the monthly hackathon, a Builder level-up
and results, to the recruiter view that shows evidence instead of points.

## Files

| File | What it is |
|---|---|
| `film.html` | Self-contained interactive page. Tabs switch between the three cuts; play/pause, scrubber, chapter jumps. Built output; do not edit by hand. |
| `abtalks-proof-film-mobile.mp4` | 1920×1080, 30 fps, 1:07, with sound. Phone app, captions, proof ledger. |
| `abtalks-proof-film-web.mp4` | 1920×1080, 30 fps, 1:07, with sound. Desktop web app in a browser window (v2 shell). |
| `abtalks-proof-film-instagram.mp4` | 1080×1920, 30 fps, 0:55, with sound. Vertical cut for Reels; holds play at 2×. |
| `sound-main.m4a`, `sound-instagram.m4a` | The soundtracks on their own (music + effects, −15 LUFS). Main is shared by the mobile and web cuts. |
| `sound.mjs` | Synthesizes the music bed and sound effects, synced to the film's events, and muxes them into the MP4s. |
| `parts/styles.css` | All styles. Tokens copied from Design System v2 (`src/app/globals.css`). |
| `parts/shared.html` | Markup partials shared by the cuts (captions, phone, ledger, recruiter view, outro…). |
| `parts/stages.html` | The three compositions: `mobile`, `web`, `ig`. |
| `parts/engine.js` | Timeline engine and player. Every frame is a pure function of time. |
| `parts/shell.html` | Page wrapper. |
| `build.mjs` | Assembles `parts/` into `film.html` (logo read from `public/abt-logo2.png`). |
| `record.mjs` | Renders `film.html` to MP4 with headless Brave/Chrome + ffmpeg. |

## Rebuild

Order matters: render the silent video, add the sound, then rebuild the page
(which embeds the soundtracks).

```bash
node docs/plans/assets/151-proof-film/record.mjs all
```

```bash
node docs/plans/assets/151-proof-film/sound.mjs
```

```bash
node docs/plans/assets/151-proof-film/build.mjs
```

`record.mjs` also takes `mobile`, `web`, `ig`, or `sheet` (nine-frame contact
sheets written to the system temp folder). It needs ffmpeg on `PATH` and Brave
or Chrome; set `BROWSER=/path/to/binary` for anything else. Frames are written
to the temp folder and deleted after encoding.

## Sound

There is no voice-over. `sound.mjs` builds everything in code, so there is
nothing to license or download:

- **Music**: 100 BPM in D major (D–A–Bm–G). A soft pad and plucked arpeggio
  open the film, a light beat enters with the First Steps quest, drums drop out
  for "seven weeks later" and the level-up riser, and the full groove lands on
  the Builder impact before resolving on the outro.
- **Effects**, synced to the same seconds as the animation: the app's own
  `public/sounds/click.mp3` for taps and clicks, key clicks while typing, soft
  ticks for terminal lines and list rows, a rising chime per automated check,
  a sparkle when XP lands, a bell chord for the badge, a riser + impact +
  sparkle for the level-up, and whooshes on scene changes.

Event times live in the `EVENTS` list at the top of `sound.mjs`. If you move an
animation in `parts/`, move its event there too. The Instagram cut reads the
`data-holds` list from `parts/stages.html`, so its sounds follow the sped-up
holds automatically. Re-running replaces the audio track; it never stacks, and
the video always sets the length.

## Editing the film

- **Timing** lives in `data-*` attributes, all in source seconds (0–67):
  `data-win="start,end"` fades an element in and out, `data-on` / `data-now`
  toggle classes, `data-type` types text, `data-count` / `data-bar` animate
  numbers, `data-grow` adds a ledger row, `data-texts` swaps text.
- **XP, levels and gate copy** are in `engine.js` (`LEVELS`, `xpAt`, `gateAt`),
  shared by all cuts. **XP chips and clicks** are `CHIPS` and `CLICKS`, which
  target `data-anchor` names that every stage defines.
- **Instagram pacing** is the `data-holds` list on the `ig` stage: each
  `start,end` range plays at 2×.

## Before sharing outside the team

"ViCoDathon 3", its dates, team names, scores and XP values are placeholders
(XP follows plan 151's provisional §6 numbers). The "Concept demo · sample
data" tag stays in every frame; remove it only for a version built from real
product screens.
