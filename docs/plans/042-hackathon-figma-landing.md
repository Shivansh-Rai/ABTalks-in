# 042 — Hackathon landing Figma redesign

## 1. Goal
Implement the [Figma Landing Page](https://www.figma.com/design/WsqYYevAiHtqH50SOaoPlh/Abtalks?node-id=447-131) on `/hackathon` pixel-faithfully: black dark shell, top nav, image-backed hero + how-it-works/rules cards, and remaining sections with Figma typography, colors, and generous inter-section spacing.

## 2. Current behavior
`src/app/hackathon/page.tsx` stacks light-themed sections (`Hero` → `ThemeSection` → `HowItWorks` → `Timeline` → `Deliverables` → `Rules` → `Prizes` → `Faq` → `FinalCta`) with no marketing header. Copy/dates live in `hackathon-config.ts`. Register CTA → `/hackathon/register`. Root `AppFooter` / logged-in `BottomNav` still show on this route.

## 3. Decisions (locked)
- **Nav (as Figma):** ABTalks logo **left** → `/`; purple **Log In / Sign Up** button **right** → `/login`.
- **Dates:** use `HACKATHON` config labels (kickoff Fri 14 Aug). Ignore Figma hero text `08 Aug`.
- **Incomplete Figma frames** (`What you submit`, `Prizes`): keep existing `HACKATHON.deliverables` / prizes-or-announced-soon copy; restyle to dark Figma section chrome.
- **Drop** `ThemeSection` and `FinalCta` (absent from Figma).
- **How it works / Rules body:** Figma bakes copy into cropped images — export those crops; do not re-typeset card interiors.
- **Fonts:** page-scoped `Bitcount Prop Single` (hero title) + `IBM Plex Mono` (section titles) + Inter for body.

## 4. Files to touch
- `[new] docs/plans/042-hackathon-figma-landing.md` — this plan
- `[new] src/app/hackathon/layout.tsx` — dark microsite shell; load display/mono fonts
- `[new] src/components/hackathon/hackathon-header.tsx` — Server: logo left + Log In / Sign Up right
- `[new] public/hackathon/` — Figma exports
- `[edit] src/app/hackathon/page.tsx` — new section order; black page wrapper
- `[edit] src/components/hackathon/hero.tsx` — Figma hero
- `[edit] src/components/hackathon/how-it-works.tsx` — four exported image cards
- `[edit] src/components/hackathon/timeline.tsx` — numbered orbs + dashed line
- `[edit] src/components/hackathon/deliverables.tsx` — dark restyle
- `[edit] src/components/hackathon/rules.tsx` — four exported image cards
- `[edit] src/components/hackathon/prizes.tsx` — dark restyle
- `[edit] src/components/hackathon/faq.tsx` — dark accordion
- `[edit] src/components/shared/app-footer.tsx` — hide on `/hackathon`
- `[edit] src/components/shared/bottom-nav.tsx` — hide on `/hackathon`
- `[edit] src/components/hackathon/countdown.tsx` — dark styling for live countdown

## 5. Server vs Client
- **Server:** `layout.tsx`, `page.tsx`, `hackathon-header.tsx`, `hero.tsx`, `how-it-works`, `timeline`, `deliverables`, `rules`, `prizes`.
- **Client:** `faq.tsx`, `countdown.tsx`.
- Pass only serializable props across the boundary.

## 6. Steps
1. Download Figma assets into `public/hackathon/`.
2. Add `layout.tsx` + `hackathon-header.tsx`; hide footer/bottom-nav on `/hackathon`.
3. Rebuild all section components to match Figma.
4. Wire `page.tsx` (drop Theme/FinalCta imports).
5. Typecheck + build.

## 7. Guardrails for Cursor (DO NOT)
- Do not edit `middleware.ts`, Prisma, register actions, or Auth.js config.
- Do not wrap Links in `<Button asChild>`.
- Do not invent prize amounts; empty `prizes[]` stays “announced soon”.
- Do not change `/hackathon/register` UX in this pass.

## 8. Verification
- Manual: `/hackathon` — nav, hero, sections, FAQ, Register → register, Log In → `/login`.
- Logged-in: no bottom nav / app footer on `/hackathon`.
- `npx tsc --noEmit` and `npm run build` pass.

## 9. Commit message
`restyle hackathon landing to match Figma dark microsite`
