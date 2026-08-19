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

Do not flatten these by swapping global tokens. When either track is next
touched, redesign it to light Modernist or document a designed dark kit.

### Also flagged (no mono-ramp home)

- Recruiter report gold/navy (`#d99c2c`, `#b9831f`, `#1e3a5f`, `#16293f`, `#fbf6e9`) on `/r/[token]` and `recruiter-pdf.tsx` — print-brand palette, not accent/ink.
- Multi-hue status colors on program (greens/reds/ambers/blues for pass/fail/warn) — need semantic tokens, not accent steps.
- Domain colors in `globals.css` (`--color-domains-*`) — intentional four-domain differentiation.
# ABTalks design system

Canonical living spec for **new** UI. Originating plan: [docs/plans/071-the-new-design-context.md](plans/071-the-new-design-context.md).

This **supersedes** the purple/modernist design system (plans 057/058, #7C5CFF, zero-radius) and the pre-modernist landing-hub look as the target for new work.

**Freeze:** do not restyle existing screens, tokens, or components to match this spec unless explicitly asked. Existing pages keep their current look.

**Fonts:** do not invent a family. Use what is already loaded in src/app/layout.tsx and/or the current ABTalks Figma file. Do not add a new font family without design approval.

---

## 1. Design Principles

The website should feel:

* Editorial
* Modern
* Human
* Confident
* Slightly playful
* Evidence-driven
* Clean rather than overly futuristic

The system should avoid unnecessary variations in font sizes, spacing, radii, shadows, and component dimensions.

Use a **constrained token system** throughout the website.

---

## 2. Color System

| Token                  | Color     | Usage                        |
| ---------------------- | --------- | ---------------------------- |
| Primary / Orange       | `#E05226` | CTAs, highlights, labels     |
| Primary / Orange Dark  | `#C9411C` | Hover / active               |
| Primary / Orange Light | `#FFECE3` | Light backgrounds            |
| Background / Cream     | `#FBF9F7` | Main page                    |
| Background / Peach     | `#FFF1E9` | Contact / secondary sections |
| Black                  | `#111111` | Main headings                |
| Dark Gray              | `#353535` | Secondary headings           |
| Body Gray              | `#4B4B4B` | Paragraphs                   |
| Muted Gray             | `#8F8F8F` | Supporting information       |
| Border                 | `#E0E0E0` | Inputs / cards               |
| White                  | `#FFFFFF` | Cards / forms                |

### Semantic Tokens

```css
--color-primary: #E05226;
--color-primary-hover: #C9411C;
--color-primary-light: #FFECE3;
--color-background: #FBF9F7;
--color-background-alt: #FFF1E9;
--color-text-primary: #111111;
--color-text-secondary: #4B4B4B;
--color-text-muted: #8F8F8F;
--color-border: #E0E0E0;
--color-white: #FFFFFF;
```

> **Important:** Do not introduce additional shades of orange. Use the established orange and its semantic variants.

---

## 3. Font System

### Font Family

Website font: The uploaded design-system document does not specify the actual font family used in the ABTalks website.

Therefore, the font family should be taken directly from the existing ABTalks Figma file / website implementation and used consistently across all components.

Do not introduce a new font family without design approval.

### Font Weights

| Weight   | Value | Usage                                      |
| -------- | ----: | ------------------------------------------ |
| Regular  |   400 | Paragraphs, body copy, inputs, FAQ answers |
| Medium   |   500 | Navigation, secondary buttons, labels      |
| Semibold |   600 | Buttons, card titles, FAQ questions        |
| Bold     |   700 | H1, H2, H3, major emphasis                 |

The system intentionally uses only four weights to maintain consistency.

---

## 4. Typography System

This is the core ABTalks type scale.

| Element            | Font Size | Line Height | Weight |
| ------------------ | --------: | ----------: | -----: |
| H1 / Display       |      64px |        70px |    700 |
| H2 / Section Title |      40px |        48px |    700 |
| H3                 |      24px |        30px |    600 |
| H4                 |      20px |        26px |    600 |
| Paragraph          |      17px |        28px |    400 |
| Body Small         |      14px |        21px |    400 |
| Caption            |      12px |        16px |    400 |
| Section Label      |      13px |        18px |    600 |
| Button             |      16px |        20px |    600 |
| Form Label         |      14px |        20px |    500 |
| Input              |      16px |        24px |    400 |
| FAQ Question       |      18px |        27px |    600 |
| FAQ Answer         |      16px |        25px |    400 |

### Core Hierarchy

```text
H1 — 64px
↓
H2 — 40px
↓
H3 — 24px
↓
Body — 17px
```

Section titles should remain clearly smaller than the H1 so that the hierarchy is immediately recognizable.

---

## 5. Heading Hierarchy

### H1 — Hero Heading

**64px / 70px / 700**

Used for the primary hero statement.

Example:

> Evidence-based hiring.

#### Mobile

**40px / 44px / 700**

### H2 — Section Title

**40px / 48px / 700**

Used for major sections such as:

* The Bridge
* What people are saying?
* Frequently Asked Questions
* Major content sections

#### Mobile

**32px / 36px / 700**

### H3 — Subsection / Card Heading

**24px / 30px / 600**

Used for:

* Card titles
* Subsection titles
* Feature headings

#### Mobile

**22px / 28px / 600**

### H4

**20px / 26px / 600**

Used for:

* Smaller cards
* Form section titles
* Supporting component headings

---

## 6. Section Labels

Section labels include:

* THE BRIDGE
* HOW IT WORKS
* KEEP THE THREE
* CONTACT US

These act as eyebrow labels, not headings.

| Property       | Value     |
| -------------- | --------- |
| Font size      | 13px      |
| Line height    | 18px      |
| Weight         | 600       |
| Case           | UPPERCASE |
| Letter spacing | 0.03em    |
| Color          | `#E05226` |

### Spacing

Section label → H2:

**12px**

The label should never compete visually with the H2.

---

## 7. Paragraph System

### Standard Paragraph

**17px / 28px / 400**

This is the default paragraph style throughout the website.

### Hero Paragraph

**17px / 28px / 400**

Use the same paragraph size rather than introducing another body size.

### Card Description

**14px / 21px / 400**

### Supporting Text

**14px / 21px / 400**

### Caption / Metadata

**12px / 16px / 400**

Use 12px only for:

* Metadata
* Timestamps
* Legal information
* Very small supporting labels

The original source emphasizes avoiding unnecessarily small supporting text.

---

## 8. Spacing System

Use a **4px base spacing system**.

### Approved Spacing Tokens

```text
4px
8px
12px
16px
20px
24px
32px
40px
48px
64px
80px
96px
120px
```

No arbitrary spacing values should be introduced unless there is a specific layout requirement.

---

## 9. Component Spacing

| Relationship               | Spacing |
| -------------------------- | ------: |
| Section label → Heading    |    12px |
| Heading → Paragraph        |    16px |
| Paragraph → CTA            |    24px |
| Card internal padding      |    24px |
| Small card padding         |    20px |
| Large feature card padding |    32px |

### Standard Visual Rhythm

```text
Section Label
↓ 12px
H2
↓ 16px
Paragraph
↓ 24px
CTA
```

---

## 10. Section Spacing

### Desktop

| Relationship                    | Spacing |
| ------------------------------- | ------: |
| Major section → major section   |    96px |
| Related subsection → subsection |    64px |

### Mobile

| Relationship                  | Spacing |
| ----------------------------- | ------: |
| Major section → major section |    64px |
| Subsection → subsection       |    40px |

Avoid creating large empty spaces simply because the Figma canvas has additional whitespace.

---

## 11. Container System

### Desktop

* Maximum width: **1280px**
* Horizontal padding: **40px**

### Tablet

* Horizontal padding: **32px**

### Mobile

* Horizontal padding: **20px**

### Final Container Rule

```text
Desktop → 1280px max / 40px padding
Tablet → 32px padding
Mobile → 20px padding
```

---

## 12. Grid System

### Desktop

* 12 columns
* 24px gutter
* 40px outer margin

### Tablet

* 8 columns
* 24px gutter
* 32px outer margin

### Mobile

* 4 columns
* 16px gutter
* 20px outer margin

This grid should be used consistently for sections such as:

* Keep the Three
* Worth Your Time
* Contact Us
* Feature/card layouts

---

## 13. Button System

Use three button sizes.

| Variant   | Height | Horizontal Padding | Font Size | Weight | Radius |
| --------- | -----: | -----------------: | --------: | -----: | -----: |
| Small     |   36px |               16px |      14px |    600 |    8px |
| Default   |   44px |               20px |      16px |    600 |    8px |
| Large CTA |   48px |               24px |      16px |    600 |    8px |

### Recommended Usage

#### Small — 36px

* Compact cards
* Secondary actions
* Dense UI

#### Default — 44px

* Navbar
* Standard actions
* Forms

#### Large — 48px

* Hero CTA
* Major conversion CTA
* Footer CTA

### Button Icon Spacing

Icon → text:

**8px**

---

## 14. Button States

### Default

* Background: `#E05226`
* Text: `#FFFFFF`

### Hover

* Background: `#C9411C`
* Text: `#FFFFFF`

### Active

* Background: `#A93617`
* Text: `#FFFFFF`

### Disabled

* Background: `#E0E0E0`
* Text: `#8F8F8F`

### Focus

* Border/focus ring: `#E05226`
* Focus ring width: `2px`
* Focus ring offset: `4px`

> Do not rely on color alone to communicate interaction states.

---

## 15. Navigation

| Property            |           Desktop |            Mobile |
| ------------------- | ----------------: | ----------------: |
| Navbar height       |              68px |              64px |
| Navigation text     | 14px / 20px / 500 | 14px / 20px / 500 |
| Navigation item gap |              24px |              20px |
| CTA height          |              40px |              40px |
| Horizontal padding  |              40px |              20px |

The navbar should remain compact and unobtrusive.

---

## 16. Card System

### Standard Card

* Padding: 24px
* Radius: 12px
* Border: `1px solid #E0E0E0`
* Background: `#FFFFFF`

### Small Card

* Padding: 20px
* Radius: 12px
* Border: `1px solid #E0E0E0`
* Background: `#FFFFFF`

### Large Card

* Padding: 32px
* Radius: 16px
* Border: `1px solid #E0E0E0`
* Background: `#FFFFFF`

---

## 17. Border Radius System

Use only these values:

| Radius | Usage                    |
| -----: | ------------------------ |
|    4px | Tiny elements            |
|    8px | Buttons, inputs          |
|   12px | Cards                    |
|   16px | Large cards / containers |
|   24px | Special large surfaces   |

This keeps the interface visually consistent.

---

## 18. Shadow System

### Small Card

```css
box-shadow: 0 2px 8px rgba(0,0,0,0.06);
```

### Elevated Card

```css
box-shadow: 0 8px 24px rgba(0,0,0,0.08);
```

### Floating Element

```css
box-shadow: 0 12px 32px rgba(0,0,0,0.10);
```

### Principle

**Soft + wide > dark + sharp**

---

## 19. Form System

### Form Label

* Font: 14px
* Line height: 20px
* Weight: 500

### Label → Input

**8px**

### Input

* Height: 48px
* Font: 16px
* Line height: 24px
* Horizontal padding: 16px
* Radius: 8px
* Border: 1px
* Background: `#FFFFFF`

### Input → Next Field

**16px**

### Form Group → Form Group

**24px**

### Textarea

* Minimum height: 120px
* Padding: 16px
* Font: 16px / 24px
* Radius: 8px

---

## 20. Input States

### Default

* Background: `#FFFFFF`
* Border: `#E0E0E0`

### Hover

Use a darker border.

### Focus

* Border: `#E05226`
* Focus ring: `2px #E05226`
* Offset: 4px

### Error

Use a dedicated error color and display an error message directly below the input.

### Success

Use a dedicated success state.

---

## 21. FAQ System

### FAQ Question

* Font: 18px
* Line height: 27px
* Weight: 600

### FAQ Answer

* Font: 16px
* Line height: 25px
* Weight: 400

### FAQ Item

* Minimum height: 56px
* Padding: 16px 20px
* Radius: 12px

### Expand Icon

* Size: 20px
* Question → icon: 12px
* FAQ item → next FAQ item: 8px

The FAQ should visually read as one grouped component, rather than a collection of unrelated cards.

---

## 22. Testimonial Cards

| Element        | Specification     |
| -------------- | ----------------- |
| Quote          | 16px / 25px / 400 |
| Person name    | 14px / 20px / 600 |
| Role / company | 13px / 18px / 400 |
| Avatar         | 40px              |
| Card padding   | 24px              |
| Radius         | 12px              |

---

## 23. Challenge Cards

For cards such as:

* 60 DAY CODING CHALLENGE
* ABTALKS VCODATHON
* 31 DAYS AI COHORT

Use:

| Element        | Specification     |
| -------------- | ----------------- |
| Category label | 12px / 16px / 600 |
| Card title     | 16px / 22px / 600 |
| Description    | 14px / 20px / 400 |
| Card padding   | 20px              |
| Radius         | 12px              |

Small typography is acceptable here because these are compact cards.

---

## 24. Hero Section

### Desktop

| Element            | Size              |
| ------------------ | ----------------- |
| Eyebrow            | 14px / 20px       |
| H1                 | 64px / 70px / 700 |
| Description        | 17px / 28px / 400 |
| Primary CTA        | 48px              |
| Secondary CTA text | 16px / 20px       |

### Mobile

| Element            | Size              |
| ------------------ | ----------------- |
| Eyebrow            | 13px / 18px       |
| H1                 | 40px / 44px / 700 |
| Description        | 16px / 25px / 400 |
| Primary CTA        | 48px              |
| Secondary CTA text | 16px / 20px       |

---

## 25. Statistics Strip

For statistics such as:

```text
10K+
100+
15+
```

### Number

**32px / 36px / 700**

### Description

**12px / 18px / 400**

The number should be the primary visual focus.

---

## 26. Footer

### Footer Heading

* 12px / 16px / 600
* Uppercase

### Footer Link

* 14px / 20px / 400

### Legal / Copyright

* 12px / 18px / 400

The footer can be visually smaller than the rest of the website, but should remain readable.

---

## 27. Responsive Typography

| Element      | Desktop     | Mobile      |
| ------------ | ----------- | ----------- |
| H1           | 64px / 70px | 40px / 44px |
| H2           | 40px / 48px | 32px / 36px |
| H3           | 24px / 30px | 22px / 28px |
| Paragraph    | 17px / 28px | 16px / 25px |
| Small        | 14px / 21px | 14px / 21px |
| Button       | 16px / 20px | 16px / 20px |
| FAQ question | 18px / 27px | 16px / 24px |

---

## 28. Responsive Spacing

| Element           | Desktop | Tablet | Mobile |
| ----------------- | ------: | -----: | -----: |
| Page padding      |    40px |   32px |   20px |
| Major section gap |    96px |   80px |   64px |
| Content gap       |    32px |   24px |   20px |
| Card padding      |    24px |   24px |   20px |

---

## 29. Icon System

| Icon Type             | Size |
| --------------------- | ---: |
| Small icon            | 16px |
| UI icon               | 20px |
| Feature icon          | 24px |
| Large decorative icon | 32px |

Use one consistent icon family across the website.

Do not mix:

* Outlined and filled icon styles
* Different stroke weights
* Different visual families

---

## 30. Accessibility

### Minimum body text

**16px**

### Minimum touch target

**44 × 44px**

Even when the visible icon is only 20px, its clickable area should be:

**44 × 44px**

### Paragraph Width

Target approximately:

**65 characters per line**

Avoid allowing long body copy to stretch across the full 1280px container.

---

## 31. Final Developer Token Sheet

### Typography

| Element       | Specification |
| ------------- | ------------- |
| H1            | 64 / 70 / 700 |
| H2            | 40 / 48 / 700 |
| H3            | 24 / 30 / 600 |
| H4            | 20 / 26 / 600 |
| Paragraph     | 17 / 28 / 400 |
| Body Small    | 14 / 21 / 400 |
| Caption       | 12 / 16 / 400 |
| Section Label | 13 / 18 / 600 |
| Button        | 16 / 20 / 600 |
| Form Label    | 14 / 20 / 500 |
| Input         | 16 / 24 / 400 |
| FAQ Question  | 18 / 27 / 600 |
| FAQ Answer    | 16 / 25 / 400 |

### Spacing

```text
4
8
12
16
20
24
32
40
48
64
80
96
120
```

### Buttons

```text
Small       36px
Default     44px
Large CTA   48px
```

### Inputs

```text
Default     48px
Textarea    120px minimum
```

### Radius

```text
Tiny          4px
Button/Input  8px
Card          12px
Large Card    16px
Large Surface 24px
```

### Layout

```text
Desktop max-width   1280px
Desktop padding     40px
Tablet padding      32px
Mobile padding      20px

Desktop grid        12 columns
Tablet grid         8 columns
Mobile grid         4 columns

Desktop gutter      24px
Tablet gutter       24px
Mobile gutter       16px
```

### Core Colors

```text
Primary          #E05226
Primary Hover    #C9411C
Primary Light    #FFECE3
Background       #FBF9F7
Background Alt   #FFF1E9
Text Primary     #111111
Text Secondary   #4B4B4B
Text Muted       #8F8F8F
Border           #E0E0E0
White            #FFFFFF
```

This version is internally consistent with the original **64 / 40 / 24 / 17 hierarchy**, rather than replacing the typography choices with a different scale.
