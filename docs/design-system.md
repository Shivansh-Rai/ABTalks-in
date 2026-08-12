# ABTalks design system — Modernist

The single source of truth for how ABTalks looks. Derived from the marketing
landing page and promoted to the app's base language: every screen (challenge
dashboard, program, hackathon, talent portal, admin) uses these tokens and these
patterns. Repo home: `docs/design-system.md`.

---

## 1. The idea in one paragraph

Flat, architectural, and set entirely in Archivo. A near-mono purple on a warm
off-white ground, a visible modular grid, **zero corner radius anywhere**, and
strong 2px rules doing the organising. Nothing floats and nothing is decorated:
alignment and the strength of the dividers carry the layout. Purple is spent
sparingly — the primary action, small emphasis, and one full-field poster moment
per page. Photography prints black and white.

The product reason for this look: ABTalks sells *evidence over impression*. The
interface should read like a record, not a brochure.

---

## 2. Tokens

Paste `globals.theme.css` into `src/app/globals.css` (Tailwind v4, CSS-first).
Never hard-code a hex, a font name, or a radius that a token already carries.

### Color

| Role | Value | Use |
| --- | --- | --- |
| `--color-bg` | `#f3f2f2` | Page ground |
| `--color-surface` | `#eae9e9` | Raised/inset panels |
| `--color-text` | `#201e1d` | All body ink |
| `--color-accent` | `#7c5cff` | Primary action, display figures, the poster field |
| `--color-divider` | `#201e1d` @ 40% | Every rule and border |

Ramps run 100–900 for `neutral` and `accent`, generated in OKLCH on one
lightness scale (`--color-accent-700: #4f2fc0`, `--color-neutral-300: #d7d3d3`,
etc. — full list in `globals.theme.css`). Light steps 100–300 for tinted fills
and hovers, 500 as the base, 700–900 for text on tints and pressed states.
Prefer a ramp step over an ad-hoc `color-mix()`.

**Contrast rule that bites often:** `--color-accent` on the ground measures about
3.8:1 — fine for large text, icons and interface chrome, *not* for paragraph
copy. Any accent-colored text at 13–16px uses `--color-accent-700`.

`--color-accent-2-*` exists only so both sets resolve. This is a mono palette;
treat accent-2 as accent.

### Type

Archivo for everything. Headings at weight 800, body at 400.

| Level | Size / line-height | Tracking |
| --- | --- | --- |
| Display (hero) | `clamp(40px, 5.8vw, 78px)` / 1.06 | `-0.02em`, `margin-left: -0.058em` |
| Page heading (h2) | `clamp(28px, 3.4vw, 40px)` / 1.1 | `-0.015em` |
| Section heading (h3) | 24px / 28px | `-0.01em` |
| Card title | 20px / 26px | `-0.01em` |
| Body | 16px / 28px | — |
| Secondary body | 15.5px / 28px, ink at 78% | — |
| Kicker / label | 13px / 14px, uppercase, `0.08em` | accent-700 or ink at 70% |
| Display figure | `clamp(34px, 3.4vw, 48px)`, accent | `-0.03em`, `margin-left: -0.045em` |

The negative left margins are optical alignment for Archivo 800 caps — keep them
on display type so the left edge lines up with body copy below it.

### Space, radius, elevation

`--space-1: 4px` … `--space-8: 32px`. Vertical rhythm on the marketing surface is
a 28px leading unit; app screens may use the space scale directly.
`--radius-sm/md/lg` are all **0px** and stay 0. Elevation is
`--shadow-sm/md/lg`; prefer a 2px border to a shadow.

---

## 3. Layout laws

1. **Everything flush left** — headings, copy, and labels inside wide buttons.
   Never center a button label or hero copy.
2. **The grid shows** — equal-width cells, strong horizontal rhythm. Section
   seams are a solid 2px `--color-divider` rule, never a hairline and never
   replaced by whitespace alone.
3. **Cell grids are drawn with the gap** — a `display:grid; gap:2px;
   background: var(--color-divider)` container with `background: var(--color-bg)`
   cells produces the ruled lattice used for card rows. Do not use borders per
   card and do not use shadows.
4. **Page shell** — `max-width: 1200px`, gutter `clamp(20px, 5vw, 72px)`.
5. **Ground texture** — the body carries a fixed 96px modular grid at ~4% ink.
   It is part of the identity; leave it visible behind sections and let opaque
   cells sit on top of it.
6. **One red field per page** — the closing poster band. Elsewhere red is a mark.

---

## 4. Component contracts

The app is shadcn (`base-nova`, Base UI) — do **not** fork the primitives in
`src/components/ui/`. Retheme through tokens; the mapping in
`globals.theme.css` makes `Button`, `Card`, `Input`, `Badge`, `Table`, `Dialog`
inherit the look automatically.

- **Button** — primary is a solid accent fill with paper label; secondary is a
  2px ink outline on transparent; ghost is label + rule only. Square corners.
  Label flush left. Hover moves one ramp step (`--color-accent-600`), pressed one
  further. Keep the existing repo rule: `buttonVariants` on `<Link>`, never
  `<Button asChild>`.
- **Card** — a 2px `--color-divider` border, `--color-bg` or
  `--color-neutral-100` fill, 24–28px padding, no radius, no shadow. Kicker
  (uppercase 13px) above title.
- **Tag / Badge** — small caps label, accent tint (`--color-accent-200` fill,
  `--color-accent-800` ink) or 2px outline.
- **Input / field** — 2px border, square, label above in the kicker style;
  focus is `outline: 2px solid var(--color-accent); outline-offset: 2px`.
- **Table** — themed header row, 2px rule under the header, 1px
  `--color-neutral-300` between rows.
- **Stat** — accent figure at display size over an uppercase 13px label.
- **Icons** — Lucide only (already the repo's `iconLibrary`), 1.5–2px stroke,
  ink or accent, never decorative.

### Interaction states

Themed, never browser defaults. Every interactive element gets a hover tint and
a pressed state from the accent ramp; keyboard focus is always
`:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px }`.
Disabled drops to 45% opacity. `::selection` is an accent tint.

---

## 5. Patterns this product needs

- **Bridge figure** — three cells (candidates | ABTalks | companies) with 2px
  connector rules and solid triangle arrowheads; the center cell is the accent
  field. `align-items: stretch` so all three share a top and bottom edge.
- **Consent card** — the pattern that carries the privacy promise: evidence rows
  visible, identity rows withheld, and an explicit action that only the candidate
  can grant. Any surface that exposes candidate data reuses this shape and this
  vocabulary ("hidden until approved", "released by candidate").
- **Numbered rows** — `01 / 02 / 03` in Archivo 800 at 15px, a title column, and
  a copy column, separated by 2px rules. Used for any ordered explanation.
- **Program cards** — tag, title, description, and a cadence line pinned to the
  bottom (`margin-top: auto`), laid out in a 2px-gap lattice.
- **FAQ** — native `<details>`, 2px rules top and bottom, no chevron chrome.

---

## 6. Copy voice

Warm, plain, and specific. Short declarative sentences. Name the thing the user
gets, then the condition. No hype adjectives, no exclamation marks, no emoji.
Numbers are stated only when they are real. Privacy language is always active
voice with the candidate as the subject: "you decide who sees it", never
"data may be shared".

---

## 7. Do / Don't

**Do:** let the rules and the grid organise the page · keep display type tight
and flush left · spend red on one action per view · state consent in plain words
wherever candidate data appears · use Lucide icons at interface sizes.

**Don't:** round any corner · center headings or button labels · soften a 2px
rule to 1px · add gradients, glass, or drop shadows for decoration · tint
photographs · introduce a second accent hue · use `--color-accent` for
paragraph-size text · add a font.

---

## Documented deviations (plan 058 §8)

Modernist is light-only. Two track surfaces stay **deliberately dark** until each
is redesigned to light Modernist (option 1) or a designed dark variant ships
(option 3). Until then they are sanctioned exceptions (option 2):

| Track | Scope | How it stays dark |
| --- | --- | --- |
| `/marketplace` | `MainShell` + `body.marketplace-page` + marketplace components | Near-black ground (`ink-900` / `#030712`); not rethemed in Phases B–D |
| `/hackathon` | `MainShell` + hackathon components | `bg-black` shell; not rethemed in Phases B–D |
| `/` (logged-out) | `LandingHub` + `src/components/landing/hub/*` | Figma rounded marketing landing (plan 061); ignore zero-radius lattice on this page only |

Do not flatten these by swapping global tokens. When either track is next
touched, redesign it to light Modernist or document a designed dark kit.

### Also flagged (no mono-ramp home)

- Recruiter report gold/navy (`#d99c2c`, `#b9831f`, `#1e3a5f`, `#16293f`, `#fbf6e9`) on `/r/[token]` and `recruiter-pdf.tsx` — print-brand palette, not accent/ink.
- Multi-hue status colors on program (greens/reds/ambers/blues for pass/fail/warn) — need semantic tokens, not accent steps.
- Domain colors in `globals.css` (`--color-domains-*`) — intentional four-domain differentiation.
