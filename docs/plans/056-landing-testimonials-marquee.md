# 056 — Landing page testimonials carousel

> **Status: implemented, with a deliberate change of approach.**
> This plan originally specified a CSS auto-scrolling marquee, which was built
> and then replaced: paragraph-length testimonials are unreadable while moving,
> and on touch there is no hover to pause them. Shipped instead is a **manual
> swipe carousel** — same one-row band, moves only on user input.
>
> Differences from §6 below, which is otherwise accurate:
> - `testimonials-marquee.tsx` → `testimonials-carousel.tsx`, exporting
>   `TestimonialsCarousel`. Still a Server Component; data array and card
>   unchanged.
> - New `testimonials-scroller.tsx` **[client]** — the scroll container, desktop
>   arrow buttons, and end-of-rail disabled state. Cards are passed through as
>   `children`, so they stay Server Components and no data crosses the boundary.
> - Cards gained `snap-start`; the duplicated `aria-hidden` track is gone (9
>   cards rendered, not 18).
> - `globals.css`: no `@keyframes marquee-x`, no `--animate-marquee-x`, no
>   `.marquee-mask` and no second reduced-motion block. Only a `.no-scrollbar`
>   utility was added. The motion guardrails in §7 still hold.

## 1. Goal

Add a testimonials section to the abtalks.in landing page (`/`), placed at the
bottom of the page above the global footer, with cards that auto-scroll
horizontally in a seamless loop. Social proof from the 9 builders who completed
the 60-Day Claude Challenge, rendered as **real HTML text** (not the baked-text
design images) so it stays readable on phones, which is where most of our
traffic is.

## 2. Current behavior

- `/` is `src/app/page.tsx` → redirects signed-in users, otherwise renders
  `<LandingHub claudeEnabled={...} />`.
- `src/components/landing/landing-hub.tsx` is a **Server Component**. Its
  `<main>` sections, in order: hero → track cards grid → stats strip → "How
  ABTalks works" → WhatsApp community CTA. That WhatsApp CTA is currently the
  last section.
- The `<footer>` inside `landing-hub.tsx` (lines ~245–260) is **commented out**.
  The real footer is the global `<AppFooter />` rendered by
  `src/app/layout.tsx` after `<MainShell>`. So "above the footer" = after the
  WhatsApp CTA section, still inside `<main>`.
- No testimonial component, no marquee/carousel utility, and no
  `public/testimonials/` directory exists today.
- Tailwind v4 — there is **no `tailwind.config.*`**. Animations are declared in
  `src/app/globals.css` inside `@theme inline` as `--animate-<name>` plus a
  matching `@keyframes` block (see the existing `--animate-heatmap-cell` /
  `@keyframes heatmap-cell` pair at lines ~59 and ~81).
- `globals.css` line ~353 has a global `@media (prefers-reduced-motion: reduce)`
  block that forces `animation-duration: 0.01ms !important` on everything. The
  marquee needs an explicit override (step 3.3) — do not rely on that block
  producing a sensible result.

## 3. Files to touch

| File | Action | Note |
|---|---|---|
| `public/testimonials/*.webp` | `[new]` | 9 square headshot crops, supplied by Anil — see §4 for exact filenames. Not created by Cursor. |
| `src/components/landing/testimonials-marquee.tsx` | `[new]` | Server Component: `TESTIMONIALS` data array + `<TestimonialsMarquee />` + local `TestimonialCard`. |
| `src/components/landing/landing-hub.tsx` | `[edit]` | Import and render `<TestimonialsMarquee />` after the WhatsApp CTA `</section>`, before `</main>`. |
| `src/app/globals.css` | `[edit]` | Add `--animate-marquee-x` to `@theme inline`, the `@keyframes marquee-x` block, and the reduced-motion override. |

**No other files change.** No schema change, no migration, no new npm
dependency, no `next.config.ts` change (local `/public` images need no remote
patterns).

## 4. Assets (prerequisite — Anil supplies before Cursor starts)

Crop a square headshot out of each of the 9 design cards. Target **256×256**,
`.webp`, face centred, under ~25 KB each. Exact paths the code will reference:

```
public/testimonials/samridhi-gupta.webp
public/testimonials/vivek.webp
public/testimonials/lakshay.webp
public/testimonials/rida-khan.webp
public/testimonials/devpal-singh-anand.webp
public/testimonials/nandika-sharma.webp
public/testimonials/komal-goswami.webp
public/testimonials/yashaswani-singh.webp
public/testimonials/divya.webp
```

If an asset is missing at build time the page still builds — Next only fails on
missing local images at request time — so **verify all 9 render** before
merging.

## 5. Server vs Client

| Component | Boundary | Notes |
|---|---|---|
| `HomePage` (`src/app/page.tsx`) | Server | Unchanged. |
| `LandingHub` | **Server** | Stays a Server Component. Only gains one import + one JSX element. |
| `TestimonialsMarquee` | **Server** | No `"use client"`. The loop is pure CSS animation and hover-pause is pure CSS (`group-hover:[animation-play-state:paused]`). No hooks, no framer-motion, no IntersectionObserver. |
| `TestimonialCard` (local, same file) | **Server** | Plain props: `name: string`, `org: string \| null`, `photo: string`, `quote: string`. |

**Server→Client prop passing: none.** Nothing crosses the boundary — no
functions, no icon components, no class instances are passed anywhere. The
quote mark is inline SVG/text, not a lucide component passed as a prop.

## 6. Steps

### 6.1 `src/components/landing/testimonials-marquee.tsx` `[new]`

Create the file. No `"use client"` directive.

**Imports:** `Image` from `next/image`, `cn` from `@/lib/utils`. Nothing else.

**Data — copy this array verbatim.** These quotes are condensed from the design
cards; do not rewrite, expand, or "improve" them, and do not invent extra
entries.

```ts
type Testimonial = {
  name: string;
  org: string | null;
  photo: string;
  quote: string;
};

const TESTIMONIALS: Testimonial[] = [
  {
    name: "Samridhi Gupta",
    org: "Axis Institute of Technology and Management, Kanpur",
    photo: "/testimonials/samridhi-gupta.webp",
    quote:
      "The 60-Day Claude Challenge reshaped how I approach both AI and discipline. I learned prompt engineering from the ground up — but the real transformation was consistency. Sixty days later, I don't just write better prompts, I finish what I start.",
  },
  {
    name: "Vivek",
    org: "IT Leader · 20+ years of industry experience",
    photo: "/testimonials/vivek.webp",
    quote:
      "I wasn't looking for another certificate — I was looking for a new way of thinking. With over 20 years in IT leadership, stepping into Generative AI made me feel like a beginner again, and honestly that was the best part. The challenge may have ended, but my AI journey has just begun.",
  },
  {
    name: "Lakshay",
    org: null,
    photo: "/testimonials/lakshay.webp",
    quote:
      "60 days ago, I used AI mainly for everyday questions. Today I use it to build complete projects, craft professional resumes, automate workflows, and solve real-world problems. It completely changed the way I think about and use AI.",
  },
  {
    name: "Rida Khan",
    org: "AI Enthusiast",
    photo: "/testimonials/rida-khan.webp",
    quote:
      "I joined with curiosity, but also with doubts about whether I could stay consistent for all 60 days. To my surprise, I did it. This wasn't just a 60-day challenge — it was a journey that taught me consistency can turn uncertainty into achievement.",
  },
  {
    name: "Devpal Singh Anand",
    org: null,
    photo: "/testimonials/devpal-singh-anand.webp",
    quote:
      "From exploring AI concepts to building production-ready projects, every challenge strengthened my technical skills and encouraged me to think like an engineer. Today AI isn't just something I learn — it's a tool I use to solve meaningful problems.",
  },
  {
    name: "Nandika Sharma",
    org: "IMS Noida",
    photo: "/testimonials/nandika-sharma.webp",
    quote:
      "More than just creating projects, I learned the art of prompt engineering — how to give clear instructions and solve complex problems step by step. ABTalks didn't just teach me AI, it empowered me to build the future with it.",
  },
  {
    name: "Komal Goswami",
    org: "MPGI Kanpur",
    photo: "/testimonials/komal-goswami.webp",
    quote:
      "Joining the ABTalks 60-Day Claude AI Challenge transformed my AI journey. I mastered prompt engineering, learned to build smarter with AI, and gained the confidence to solve real-world problems.",
  },
  {
    name: "Yashaswani Singh",
    org: "AI Enthusiast",
    photo: "/testimonials/yashaswani-singh.webp",
    quote:
      "What started as curiosity about AI soon became a daily habit of learning, building, and improving. More than technical skills, I gained a growth mindset — the confidence to embrace new technologies and keep learning every day.",
  },
  {
    name: "Divya",
    org: "Aspiring Software Developer",
    photo: "/testimonials/divya.webp",
    quote:
      "I gained hands-on experience in prompt engineering, AI tools, automation, Git & GitHub, and building real-world AI-powered projects. Every challenge encouraged me to think critically, build with confidence, and continuously improve.",
  },
];
```

**`TestimonialCard`** — local function component in the same file, not exported,
no separate file:

- Root: `<figure>` with
  `"flex h-full w-[300px] shrink-0 flex-col rounded-2xl border border-border/60 bg-card/60 p-6 shadow-card backdrop-blur-md sm:w-[360px]"`.
  Matches the existing card idiom in `landing-hub.tsx` (stats strip / steps
  grid). **Keep it border-and-surface only — no glow, no gradient ring, no
  drop-shadow beyond the existing `shadow-card` token.**
- Decorative quote glyph at the top: a `<span aria-hidden>` containing `”` with
  `"font-display text-4xl leading-none text-primary/40"`.
- `<blockquote className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">`
  wrapping `{quote}`.
- `<figcaption className="mt-5 flex items-center gap-3 border-t border-border/60 pt-4">`
  containing:
  - `<Image src={photo} alt="" width={44} height={44} loading="lazy" className="h-11 w-11 shrink-0 rounded-full object-cover" />`
    — `alt=""` because the name is adjacent text; do not duplicate it.
  - a `<div className="min-w-0">` with the name in
    `"truncate font-display text-sm font-bold text-foreground"` and, when `org`
    is non-null, the org in `"truncate text-xs text-muted-foreground"`.
    Render the org line conditionally with `{org ? <p …>{org}</p> : null}` —
    **not** `{org && …}`.

**`TestimonialsMarquee`** — the exported component:

```
<section aria-label="What our builders say" className="relative overflow-hidden pb-20 md:pb-24">
  <div className="mx-auto max-w-7xl px-5 md:px-8">
    <div className="text-center">
      <h2 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
        What our builders say
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">
        Real stories from students and professionals who finished the 60-Day Claude Challenge.
      </p>
    </div>
  </div>

  <div className="marquee-mask group relative mt-10 flex overflow-hidden">
    {[0, 1].map((copy) => (
      <div
        key={copy}
        aria-hidden={copy === 1}
        className="flex shrink-0 animate-marquee-x items-stretch gap-5 pr-5 group-hover:[animation-play-state:paused]"
      >
        {TESTIMONIALS.map((t) => (
          <TestimonialCard key={`${copy}-${t.name}`} {...t} />
        ))}
      </div>
    ))}
  </div>
</section>
```

Notes the executor must respect:

- **Exactly two copies** of the list, rendered by the same `map`. The animation
  translates by `-50%`, so two identical tracks are what makes the loop seamless
  — three copies or a different translate distance will visibly jump.
- The second copy is `aria-hidden` so screen readers read each quote once.
- `pr-5` on each track supplies the gap *between* the two tracks; without it the
  last and first cards touch at the seam.
- The section wrapper is deliberately **not** width-clamped — the marquee runs
  edge to edge. Only the heading block sits inside `max-w-7xl`.

### 6.2 `src/components/landing/landing-hub.tsx` `[edit]`

1. Add the import next to the existing `TrackCard` import:
   `import { TestimonialsMarquee } from "./testimonials-marquee";`
2. Insert `<TestimonialsMarquee />` immediately **after** the closing `</section>`
   of the WhatsApp community CTA (currently line ~242) and **before** `</main>`
   (line ~243).

Nothing else in this file changes. In particular: leave the commented-out
`<footer>` block at lines ~245–260 exactly as it is — do not uncomment it, do
not delete it.

### 6.3 `src/app/globals.css` `[edit]`

Three additions, each following the file's existing conventions:

1. Inside `@theme inline`, directly under the existing
   `--animate-heatmap-cell:` line:

```css
--animate-marquee-x: marquee-x 60s linear infinite;
```

2. Directly under the existing `@keyframes heatmap-cell { … }` block:

```css
@keyframes marquee-x {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}
```

3. After the existing global `@media (prefers-reduced-motion: reduce)` block
   (~line 353), add the mask utility and the reduced-motion override. The
   override is **required**: the global block forces
   `animation-duration: 0.01ms !important`, which makes the marquee finish
   instantly instead of degrading gracefully. Users who ask for reduced motion
   get a normal horizontal scroller instead.

```css
.marquee-mask {
  mask-image: linear-gradient(
    to right,
    transparent,
    black 4rem,
    black calc(100% - 4rem),
    transparent
  );
}

@media (prefers-reduced-motion: reduce) {
  .marquee-mask {
    overflow-x: auto;
    scroll-snap-type: x mandatory;
  }
  .marquee-mask > * {
    animation: none !important;
  }
  /* One static copy is enough once it no longer loops. */
  .marquee-mask > [aria-hidden="true"] {
    display: none;
  }
}
```

Do not add `-webkit-mask-image` — the project's browser targets handle the
unprefixed property, and the surrounding CSS uses no `-webkit-` prefixes.

## 7. Guardrails for Cursor (DO NOT)

- **DO NOT** add `"use client"` to `testimonials-marquee.tsx` or to
  `landing-hub.tsx`. This section needs zero client JavaScript. If you find
  yourself reaching for `useState`, `useEffect`, `useRef`, or an
  `IntersectionObserver`, stop — the design is wrong, not the constraint.
- **DO NOT** install or import a marquee/carousel library
  (`react-fast-marquee`, `embla-carousel`, `swiper`, `keen-slider`). No new
  dependency, no `package.json` change.
- **DO NOT** use `framer-motion` here. `MotionProvider` exists for other
  surfaces; this is CSS-only.
- **DO NOT** create a `tailwind.config.ts` to hold the keyframes. This project is
  Tailwind v4 — the animation belongs in `globals.css` under `@theme inline`, as
  specified in step 6.3.
- **DO NOT** create extra files: no `testimonials.ts` data module, no
  `testimonial-card.tsx`, no `marquee.tsx` primitive. The data array and the card
  live in the one new file listed in §3.
- **DO NOT** touch `src/components/ui/*`, `src/components/shared/app-footer.tsx`,
  or `src/app/layout.tsx`.
- **DO NOT** uncomment or modify the dead `<footer>` block in `landing-hub.tsx`.
- **DO NOT** use `<Button asChild>` or `<Button render={<Link>}>` anywhere —
  Base UI button semantics. (No buttons are needed here at all.)
- **DO NOT** add glows, animated gradient borders, or `blur-3xl` halos to the
  cards. Border + surface only.
- **DO NOT** hardcode hex colours or `text-white` / `bg-black`. Use the theme
  tokens (`text-foreground`, `text-muted-foreground`, `bg-card/60`,
  `border-border/60`, `text-primary`) so the section works in both light and dark
  themes. The source design cards are orange-on-black; the landing page is not —
  do not import that palette.
- **DO NOT** paste the original card PNGs into `public/` or render them. The
  agreed approach is re-typeset HTML text plus a headshot crop.
- **DO NOT** edit, shorten, or embellish the quote strings in §6.1. They are
  attributed to real people.
- **DO NOT** touch `prisma/schema.prisma`, run a migration, or run a seed. This
  change is presentational and has no database component.
- If the build contradicts something in this plan, trust the build error and
  report it — do not work around it by adding a client component.

## 8. Verification

**Build / typecheck (both must pass clean):**

```
npx tsc --noEmit
npm run build
```

**Manual, signed out, at `/`:**

1. Section appears below the green WhatsApp CTA and above the global footer.
2. Cards scroll right-to-left continuously and **loop with no visible jump or
   gap** at the seam. Watch for at least two full cycles (~2 min at 60s).
3. Hovering the strip pauses it; moving off resumes it.
4. All 9 headshots load — no broken images, no 404s in the Network tab for
   `/testimonials/*.webp`.
5. Quote text is fully readable at **360 px width** (DevTools mobile), no
   horizontal overflow on `<body>`, no clipped text.
6. Toggle light/dark with the header theme switch — text stays legible and the
   card borders are visible in both.
7. DevTools → Rendering → "Emulate prefers-reduced-motion: reduce": the strip
   stops animating and becomes a manually swipeable horizontal scroller showing
   9 cards (not 18).
8. Screen-reader check (or inspect the a11y tree): each quote appears once, not
   twice.

**Exactly these files should show as changed:**

```
public/testimonials/   (9 new .webp files)
src/components/landing/testimonials-marquee.tsx   (new)
src/components/landing/landing-hub.tsx            (2-line diff: 1 import, 1 element)
src/app/globals.css                               (3 additions)
```

Anything else in `git status` means something went wrong — stop and report.

## 9. Commit message

```
feat(landing): add auto-scrolling testimonials marquee above footer

Nine 60-Day Claude Challenge testimonials rendered as themed HTML cards
in a CSS-only infinite marquee. Server Component, no client JS and no new
dependency; pauses on hover and degrades to a horizontal scroller under
prefers-reduced-motion.
```
