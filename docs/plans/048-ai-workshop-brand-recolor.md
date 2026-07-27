# 048 — AI Workshop: recolor to ABTalks brand (indigo → violet)

## 1. Goal
Replace the AI Workshop pages' off-brand warm palette (orange `#ff7a1a` → pink
`#ff4d94` → purple, on a purple-black `#08060d` background) with the ABTalks
brand palette (indigo `#6366f1` → violet `#8b5cf6`, on the app's dark navy).
**Colors only** — no copy, layout, spacing, animation, component, or data
changes anywhere.

## 2. Current behavior
`/ai-workshop` and `/ai-workshop/events` are standalone dark landing pages that
opt out of the app's theme tokens entirely: every color is a hardcoded hex or
`rgba()` in inline `style={{}}` props across 14 files. There is no shared token
—`#ff4d94` alone appears 16 times, `#ff7a1a` 14 times. Nothing here reads
`--primary` or any variable from `globals.css`, so the pages look unrelated to
the rest of the product.

Semantic colors already in use and **correct**: success green `#4ade80` /
`rgba(74,222,128,*)`, error red `rgba(248,113,113,*)`, and the white-alpha
scaffolding (`rgba(255,255,255,0.0X)`) used for glass surfaces and borders.

## 3. Files to touch

> **Implemented 2026-07-27** on branch `feature/ai-workshop-15Aug`.
> Two deviations from the original draft, both applied:
> 1. `globals.css` is **not touched** — the shared app stylesheet stays frozen.
>    The `.wk-root` token block lives in each page's own `<style>` block instead
>    (duplicated across the two routes; that duplication is the accepted cost).
> 2. `events-data.ts` **is** touched — it carries two `accent` hex values that
>    the initial `.tsx`-only scan missed. Colors changed, event data untouched.

| File | | Note |
|---|---|---|
| `src/app/ai-workshop/page.tsx` | `[edit]` | `.wk-root` token block in `<style>`; recolor bg, orbs, particles, hero gradient, CTA keyframes |
| `src/app/ai-workshop/events/page.tsx` | `[edit]` | Own copy of the token block; recolor bg, orbs, header, CTA |
| `src/components/workshop/events-data.ts` | `[edit]` | Two `accent` hex values only — no data change |
| `src/components/workshop/Header.tsx` | `[edit]` | Nav bar bg, live pill, CTA |
| `src/components/workshop/RegistrationForm.tsx` | `[edit]` | Confetti array, inputs, focus ring, submit button, success overlay |
| `src/components/workshop/TopicsSection.tsx` | `[edit]` | 8 topic accents + section header + bullet colors |
| `src/components/workshop/CommunityStats.tsx` | `[edit]` | 3 stat accents, divider, eyebrow, CTA |
| `src/components/workshop/CountdownTimer.tsx` | `[edit]` | Digit gradient, card glow |
| `src/components/workshop/CursorGlow.tsx` | `[edit]` | Glow radial + trail dots |
| `src/components/workshop/UpcomingEvents.tsx` | `[edit]` | Card surfaces, arrows, CTA |
| `src/components/workshop/EventsTimeline.tsx` | `[edit]` | White-alpha only — verify, likely near-zero diff |
| `src/components/workshop/ComingSoonCard.tsx` | `[edit]` | Card tint + CTA |
| `src/components/workshop/ScrollToTop.tsx` | `[edit]` | CTA gradient |
| `src/components/workshop/SocialProof.tsx` | `[edit]` | Live dot is green — verify only, likely no diff |
| `src/components/workshop/WorkshopLogo.tsx` | `[edit]` | Logo glow |

No new files. No file deletions. `AutoScrollToForm.tsx` has no colors — **do not
touch it**.

## 4. Server vs Client
- `src/app/ai-workshop/page.tsx` — **Server** (async, reads `getWorkshopConfig`)
- `src/app/ai-workshop/events/page.tsx` — **Server**
- `Header.tsx`, `ComingSoonCard.tsx`, `WorkshopLogo.tsx` — **Server**
- All others (`"use client"` at line 1) — **Client**

No Server→Client prop passing changes. This plan passes **no new props of any
kind** across the boundary — all theming flows through inherited CSS custom
properties, which cross the boundary as plain DOM cascade, not as props. Every
`"use client"` directive stays exactly where it is; do not add or remove one.

## 5. Steps

### Step 1 — the `.wk-root` token block

`globals.css` is **read-only reference material** here — take the brand values
from it (`--primary: 239 84% 67%` = `#6366f1`, `--color-domains-ai: #8b5cf6`,
dark `--background: 224 71% 4%`) but do not edit it. Instead, place this block
inside the existing `<style>` tag in **each** of the two page files, since they
are separate routes and neither wraps the other:

```css
/* ---- AI Workshop landing pages: scoped brand palette ---- */
.wk-root {
  --wk-bg: #050a17;
  --wk-surface: #0b1120;
  --wk-text: #f5f6fa;
  --wk-text-dim: #c7cbda;

  --wk-a1: #6366f1;        /* indigo — primary accent */
  --wk-a1-rgb: 99, 102, 241;
  --wk-a1-light: #818cf8;
  --wk-a1-light-rgb: 129, 140, 248;
  --wk-a1-deep: #4f46e5;

  --wk-a2: #8b5cf6;        /* violet — secondary accent */
  --wk-a2-rgb: 139, 92, 246;
  --wk-a3: #a855f7;        /* purple */
  --wk-a3-light: #c084fc;
  --wk-a4: #a78bfa;        /* soft violet */

  --wk-grad: linear-gradient(135deg, var(--wk-a1) 0%, var(--wk-a2) 100%);
}
```

The `-rgb` triples exist so existing `rgba(r,g,b,alpha)` calls become
`rgba(var(--wk-a1-rgb), alpha)` **keeping their current alpha value unchanged**.

### Step 2 — Apply `wk-root` to both page wrappers

In `src/app/ai-workshop/page.tsx`, the outer `<div className="relative min-h-screen">`
(line 30) becomes `className="wk-root relative min-h-screen"`, and its inline
`background: "#08060d"` → `"var(--wk-bg)"`, `color: "#f4f2f7"` → `"var(--wk-text)"`.

Do the same for the outer wrapper in `src/app/ai-workshop/events/page.tsx`
(line ~16). Both pages need the class — they are separate routes and neither
wraps the other.

### Step 3 — Global find/replace mapping (apply across all 15 files)

This is a **mechanical value substitution**. Where the value sits in an inline
`style` object, use the `var()` form. Where it sits inside a `<style>` string
literal or a Tailwind arbitrary class, `var()` also works.

**Solid hex:**

| Old | New | Where |
|---|---|---|
| `#08060d` | `var(--wk-bg)` | page backgrounds |
| `#16121d` | `var(--wk-surface)` | RegistrationForm select/option bg |
| `#f4f2f7` | `var(--wk-text)` | body + input text |
| `#cfc8d8` | `var(--wk-text-dim)` | countdown digit gradient end |
| `#ff7a1a` | `var(--wk-a1)` | CTA gradient start, particles |
| `#ff9a3c` | `var(--wk-a1-light)` | eyebrows, live pill, hero gradient start |
| `#ffb020` | `var(--wk-a1-light)` | topic accent 2 (see Step 4) |
| `#ff4d94` | `var(--wk-a2)` | CTA gradient end, dots, required-asterisk |
| `#a855f7` | `var(--wk-a3)` | **value unchanged**, still switch to the var |
| `#f472b6` | `var(--wk-a3-light)` | topic accent 8 |
| `#2dd4bf` | `var(--wk-a1-light)` / `var(--wk-a3-light)` | see Steps 4 & 5 — differs per site |
| `#6366f1` | `var(--wk-a1)` | already on-brand; switch to the var |
| `#a5b4fc` | `var(--wk-a1-light)` | UpcomingEvents badge text |
| `#ffffff` / `#fff` | leave as-is | neutral |

**Alpha (`rgba`) — keep every alpha value exactly as it is today:**

| Old channel triple | New |
|---|---|
| `rgba(255,122,26, A)` | `rgba(var(--wk-a1-rgb), A)` |
| `rgba(255,154,60, A)` | `rgba(var(--wk-a1-light-rgb), A)` |
| `rgba(255,77,148, A)` | `rgba(var(--wk-a2-rgb), A)` |
| `rgba(99,102,241, A)` | `rgba(var(--wk-a1-rgb), A)` |
| `rgba(10,7,16, A)` | `rgba(5,10,23, A)` — header/nav blur bg |
| `rgba(20,16,27, A)` | `rgba(11,17,32, A)` — raised card/overlay bg |
| `rgba(255,255,255, A)` | **unchanged** |
| `rgba(74,222,128, A)` | **unchanged** — success green |
| `rgba(248,113,113, A)` | **unchanged** — error red |
| `rgba(0,0,0, A)` | **unchanged** |

`rgba(var(--wk-a1-rgb), 0.28)` is valid CSS (the var expands to `99, 102, 241`).
If any single site refuses to parse, fall back to the literal `rgba(99,102,241,0.28)`
at that one site rather than restructuring the rule.

### Step 4 — `TopicsSection.tsx` topic accents (lines 5–54)

Replace the eight `accent` values **in this exact order**. This preserves the
current visual rhythm of "each card is a different color" while keeping every
hue inside the indigo→violet family:

| # | Topic | Old | New |
|---|---|---|---|
| 1 | ChatGPT vs Claude vs Gemini | `#ff7a1a` | `#6366f1` |
| 2 | Which AI Model Should You Use? | `#ffb020` | `#818cf8` |
| 3 | Prompt Engineering | `#ff4d94` | `#8b5cf6` |
| 4 | AI Tools for Students | `#a855f7` | `#a855f7` *(unchanged)* |
| 5 | AI Tools for Professionals | `#6366f1` | `#7c3aed` |
| 6 | AI Workflow Automation | `#ff9a3c` | `#4f46e5` |
| 7 | Live Practical Use Cases | `#2dd4bf` | `#c084fc` |
| 8 | Q&A Session | `#f472b6` | `#a78bfa` |

Use **literal hex** in this array, not `var()` — these values are read in JS and
interpolated into template strings (e.g. `boxShadow: \`0 0 8px ${accent}\``),
where a CSS variable name would not resolve. Same rule for the accent arrays in
Step 5. Slot 5 moves off `#6366f1` deliberately so it doesn't collide with the
new slot 1.

Also in this file: lines ~114–116 (section eyebrow) and lines ~140–142 (bullet
accents) follow the Step 3 mapping. For line ~140's `#2dd4bf` → `#c084fc`,
line ~141's `#6366f1` → `#6366f1` (unchanged), line ~142's `#ff7a1a` → `#8b5cf6`.

### Step 5 — Other JS color arrays (literal hex, not `var()`)

`CommunityStats.tsx` lines 6–8 — `STATS[].accent`:
`#ff7a1a` → `#6366f1`, `#a855f7` → `#a855f7` (unchanged), `#2dd4bf` → `#818cf8`.

`RegistrationForm.tsx` line 5 — `CONFETTI_COLORS`:
```ts
const CONFETTI_COLORS = ["#6366f1", "#8b5cf6", "#a855f7", "#c084fc", "#818cf8", "#4f46e5"];
```
Array length stays 6 so the modulo cycle in `buildConfetti()` is unaffected.

`page.tsx` lines 155–163 — the particle array `c` values:
`#ff7a1a` → `#6366f1`, `#ff4d94` → `#8b5cf6`, `#a855f7` → `#a855f7`,
`#ff9a3c` → `#818cf8`, `#6366f1` → `#4f46e5`, `#ffffff` → `#ffffff`.
Keep all `l`/`t`/`s`/`d`/`delay` values byte-identical — positions and timing
must not shift.

### Step 6 — `page.tsx` `<style>` block and hero

- `hero-cta-glow` keyframes (lines 70–73): `rgba(255,77,148,…)` →
  `rgba(var(--wk-a2-rgb),…)`, `rgba(255,122,26,0.35)` →
  `rgba(var(--wk-a1-rgb),0.35)`. **Keep every blur radius, spread, offset, and
  alpha exactly as-is** — this is a hue change, not an intensity change.
- `hero-cta-shine` and the white `linear-gradient(105deg, …)` sweep: unchanged.
- Hero headline gradient (line 215): `linear-gradient(120deg, #ff9a3c 0%, #ff4d94 55%, #a855f7 100%)`
  → `linear-gradient(120deg, var(--wk-a1-light) 0%, var(--wk-a2) 55%, var(--wk-a3) 100%)`.
- Hero CTA background (line 266) → `var(--wk-grad)`.
- Aurora orbs (lines 107, 120, 133) per the Step 3 rgba mapping. The third orb
  is already `rgba(99,102,241,0.16)` — switch it to the var, value unchanged.
- Final-CTA top hairline (line 341) → `rgba(var(--wk-a1-rgb),0.7)` and
  `rgba(var(--wk-a2-rgb),0.7)`.

### Step 7 — Tailwind arbitrary color classes (3 sites)

| File | Line | Old | New |
|---|---|---|---|
| `page.tsx` | 201 | `bg-[#ff4d94]` | `bg-[var(--wk-a2)]` |
| `CommunityStats.tsx` | 76 | `text-[#ff9a3c]` | `text-[var(--wk-a1-light)]` |
| `RegistrationForm.tsx` | 440 | `text-[#ff4d94]` | `text-[var(--wk-a2)]` |

Tailwind v4 supports `bg-[var(--x)]` arbitrary values. If any of these three
fails to compile, replace that one with an inline `style` prop instead of
changing the surrounding markup.

### Step 8 — Verify the two low-color files

`EventsTimeline.tsx` and `SocialProof.tsx` contain only white-alpha, green, and
`#fff`. Read them, confirm no warm hex slipped through, and leave them
unchanged if so. **An empty diff for these two files is the expected and correct
outcome** — do not invent changes to make them look edited.

## 6. Guardrails for Cursor (DO NOT)

- **DO NOT** change any text, heading, label, price, date, emoji, icon, link, or
  `events-data.ts` entry. Copy and data are frozen.
- **DO NOT** change layout, spacing, padding, margin, border-radius, font-size,
  font-weight, `max-w-*`, or any non-color Tailwind class.
- **DO NOT** change animation names, durations, delays, easings, keyframe
  percentages, blur radii, shadow offsets/spreads, or any alpha value. Hue only.
- **DO NOT** edit `src/app/globals.css` at all — not `:root`, not `.dark`, not
  `@theme inline`, not an append at the end. It is reference only. Nothing
  outside the two workshop routes may change appearance.
- **DO NOT** change the success green (`#4ade80`, `rgba(74,222,128,*)`) or the
  error red (`rgba(248,113,113,*)`). They are semantic, not brand.
- **DO NOT** change white-alpha values (`rgba(255,255,255,0.0X)`) — that
  scaffolding is hue-neutral and already correct.
- **DO NOT** add `var()` inside JS string arrays (`TOPICS`, `STATS`,
  `CONFETTI_COLORS`, the particle array). Those are interpolated into template
  literals in JS and need literal hex.
- **DO NOT** create a `workshop-theme.ts`, a `colors.ts`, a `<ThemeProvider>`, or
  any other new file. The `.wk-root` block in `globals.css` is the only new
  abstraction. No file in the "Files to touch" table is `[new]`.
- **DO NOT** refactor inline `style={{}}` props into Tailwind classes, or the
  reverse, while recoloring. Keep the existing structure.
- **DO NOT** add or remove a `"use client"` directive, convert a Server
  Component to Client, or add props to any component.
- **DO NOT** touch `src/app/api/ai-workshop/register/route.ts`,
  `src/lib/workshop-supabase.ts`, or anything under `src/components/ui/`.
- **DO NOT** touch `middleware.ts`, `auth.config.ts`, or `auth.ts` — these pages
  are public and unauthenticated; no `requireRole`/`requireAdmin` anywhere.
- **DO NOT** run `prisma migrate`, `db push`, or any seed/deploy command. This
  change has zero DB surface.

## 7. DB safety
Not applicable — presentation only. No schema, migration, or seed change.

## 8. Verification

Build/typecheck:
```
npx tsc --noEmit
npm run build
```
Both must pass clean. This is a color-value change, so a type error means
something structural was altered — revert and re-do that file.

Manual (`npm run dev`, dark and normal system theme):
1. `/ai-workshop` — background is dark navy, not purple-black. Hero headline
   gradient runs indigo → violet → purple. No orange or pink pixel anywhere.
2. Hero CTA — the breathing glow and shine sweep still animate at the same
   tempo, now indigo/violet.
3. Countdown timer digits, cursor glow trail, and floating particles are all in
   the new family.
4. Curriculum cards — all 8 accents distinct, no two cards visually identical.
5. Submit the registration form — **confetti fires and is indigo/violet**, and
   the success overlay's green checkmark is **still green**.
6. Trigger a validation error — the error red is **still red**.
7. `/ai-workshop/events` — recolored to match; timeline and cards intact.
8. Mobile width (≤400px) — nothing reflowed vs. before.
9. Visit `/dashboard` and `/` — **completely unchanged**. This is the check that
   the `globals.css` append leaked nothing.

Exactly these 13 files appear in `git diff --name-only`. `EventsTimeline.tsx`
and `SocialProof.tsx` are correctly absent — Step 8 confirmed they hold only
white-alpha and green:

```
src/app/ai-workshop/page.tsx
src/app/ai-workshop/events/page.tsx
src/components/workshop/{Header,RegistrationForm,TopicsSection,CommunityStats,
  CountdownTimer,CursorGlow,UpcomingEvents,ComingSoonCard,ScrollToTop,
  WorkshopLogo}.tsx
src/components/workshop/events-data.ts
```

`src/app/globals.css` must **not** appear.

Anything else in the diff — especially `prisma/`, `src/lib/`, `middleware.ts`,
or `src/components/ui/` — means the scope was exceeded. Revert those.

Finally, confirm zero warm colors survive:
```
grep -rnE "#ff[0-9a-f]{4}|#f472b6|#2dd4bf|#ffb020|255, ?(122|154|77)," src/components/workshop/ src/app/ai-workshop/
```
Expected output: nothing.

## 8b. Addendum — emoji → lucide icons (implemented same pass)

Follow-on request: replace emojis with real icons, keeping "a very few" as
emoji. Uses `lucide-react` (already a dependency at 1.11.0, used in 93 other
component files — the house convention). No new dependency.

**Kept as emoji (2, both purely decorative):**
- `ComingSoonCard.tsx` — ✨ (drives the `.wk-soon-emoji` scale animation)
- `RegistrationForm.tsx` — 🎟️ on the "Free Registration" badge

**Converted (22 sites):**

| Source | Emoji | Icon |
|---|---|---|
| `TopicsSection` TOPICS ×8 | 🤖 💡 ✍️ 🎓 💼 ⚡ 🛠️ 💬 | `Bot` `Lightbulb` `PenLine` `GraduationCap` `Briefcase` `Zap` `Wrench` `MessagesSquare` |
| `TopicsSection` eyebrow + info row | ⚡ ⏱️ 📍 💰 | `Zap` `Clock` `MapPin` `Tag` |
| `page.tsx` hero + trust chips | 📅 🕒 ⏱️ 📍 💰 🎯 | `Calendar` `Clock` `Clock` `MapPin` `Tag` `Target` |
| `Header` / `UpcomingEvents` | 🗓️ | `CalendarDays` |
| `EventsTimeline` | 📍 🗂️ | `MapPin` `CalendarX2` |
| `events-data.ts` | 🎓 🤖 | `GraduationCap` `Bot` |

**Convention applied:** the field is renamed `icon: string` → `Icon: LucideIcon`
so it renders as `<topic.Icon />`. Icons inherit the item's `accent` color,
`size` 12–30 to match the text they replaced, `strokeWidth` 1.75 (2.25 on small
uppercase eyebrows).

**Boundary safety:** `events-data.ts` now holds component references. Both its
importers (`EventsTimeline`, `UpcomingEvents`) are Client Components, so nothing
crosses the Server→Client boundary. A comment on the interface records this
constraint. `page.tsx` and `Header.tsx` are Server Components that render lucide
icons *inline* — icons are never passed as props, which is what the CLAUDE.md
guardrail forbids.

## 9. Commit message
```
style(ai-workshop): recolor landing pages to ABTalks brand palette

Replace the off-brand orange/pink palette with the brand indigo (#6366f1)
to violet (#8b5cf6) ramp on the app's dark navy background. Colors are now
driven by a scoped .wk-root custom-property block in globals.css instead of
~120 hardcoded hex/rgba literals, so future recolors are a single edit.

Copy, layout, animation timing, and all shadow/alpha intensities are
unchanged. Semantic success-green and error-red are preserved.
```
