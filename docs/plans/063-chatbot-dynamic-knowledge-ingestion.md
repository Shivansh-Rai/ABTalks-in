# 063 — Chatbot Dynamic Knowledge Ingestion (Audit + Architecture Plan)

**This is audit-and-design only, per explicit instruction. No implementation in
this pass.** Every file below is `[new]`/`[edit]` for a *future* execution
plan, not touched here.

## 1. Goal

Stop the chatbot's knowledge from depending primarily on hand-written
markdown summaries (`knowledge/processed/*.md`) that get stale the moment the
live app changes. Replace it with a pipeline that reads the application's own
real public-facing content — page copy, data modules, and the one live
Supabase table involved — and turns that directly into chunks/embeddings,
automatically, as part of every build. A developer who edits a public page's
copy should never need to also remember to update a chatbot markdown file.

## 2. Current behavior — and what the audit found wrong with it

`knowledge/processed/*.md` was built by reading external PDFs and manually
spot-checking a handful of live pages once (dated "checked 2026-08-10"), then
hand-transcribing summaries into markdown, corrected across
`docs/plans/039-...md` and `061-...md`. It was never built by reading this
app's actual source. Two concrete, confirmed conflicts prove this out:

- **`claude-challenge-curriculum.md` is likely wrong.** It describes a
  literal Day 1–60 table ("Day 1: Claude Setup," "Day 8: Health Analyzer")
  sourced from a retired scrape file. The *live* `/claude-signup` page
  (`src/components/claude/slides/claude-roadmap-slide.tsx:5-34`) describes a
  totally different 4-phase structure: Foundations & Productivity (days
  1–15), Business Domains + Data (days 16–35), Build+Deploy+Automate (days
  36–55), Career Branding & Capstone (days 56–60). These cannot both be
  right.
- **`/hackathon` no longer has any public content.** `src/app/hackathon/page.tsx`
  is now an unconditional `redirect("/hackathon/dashboard")`, which itself
  redirects anonymous visitors to `/login`. `events.md`/`vicodathon.md`
  describe hackathon rules and timelines as if there's a public page to have
  sourced them from; there isn't one anymore.
- **The live homepage's actual positioning differs from the KB's framing.**
  `/` currently renders `ModernistLanding` (`src/components/landing/modernist/landing-page.tsx`),
  an "evidence-based hiring" pitch aimed at recruiters/companies, including
  an explicit revenue-model FAQ: *"Does it cost anything to join a cohort?"
  → "Taking part is free for candidates. Companies pay us when they hire."*
  None of the hand-written KB mentions this business model. The KB's
  "build-in-public community" framing isn't false, but it isn't what the
  current homepage actually leads with either.
- One piece **is** independently confirmed correct: the 8-phase/31-day AI
  Cohort table added to `ai-cohort.md` in plan 061 matches `src/data/roadmap.ts`'s
  `ROADMAP_PHASES` exactly (same phase names, same day ranges). Not
  everything is wrong — but there's no way to know which parts are right
  without an ingestion pipeline that stays in sync automatically.

## 3. Audit: every public content source found

Two independent read-only audits were run against the actual route source,
cross-checked against `middleware.ts`'s `protectedPaths` list (the
authoritative public/protected boundary — root `middleware.ts`, not
`src/middleware.ts`) and in-page `auth()`/`requireProgramMember()` calls.

### 3a. Confirmed PUBLIC — safe to ingest

| # | Source | Consuming route(s) | Kind | What it is |
|---|---|---|---|---|
| 1 | `src/components/landing/modernist/landing-page.tsx` (+ `landing-nav.tsx`, `consent-card.tsx`) — inline `STATS`, `CANDIDATE_ITEMS`, `COMPANY_ITEMS`, `STEPS`, `EVIDENCE`, `PROGRAMS`, `FAQS`, 2 testimonial quotes | `/` (`src/app/page.tsx` renders `ModernistLanding` for signed-out visitors) | Hardcoded consts in JSX | Homepage: hero, stats (10k people, 100+ companies, 0 profiles shared without consent), 3-step model, evidence grid, 3 program cards, 2 testimonials, 4 FAQs incl. the pricing/revenue-model answer |
| 2 | `src/app/challenges/page.tsx` inline `FAQ_ITEMS`, `DAY_STEPS`, community-rules copy; `src/components/challenges/domain-picker.tsx` inline `DOMAINS` | `/challenges` | Hardcoded consts | 60-Day Challenge overview: 3 domain blurbs, 4-step "how a day works," community conduct rules (permanent ban / 60-day ban), 4 FAQs |
| 3 | `src/components/claude/slides/*.tsx` (`claude-welcome-slide`, `claude-why-slide`, `claude-audience-slide`, `claude-roadmap-slide`, `claude-cta-slide`) | `/claude-signup` | Hardcoded consts per slide | 5-slide onboarding: tagline, stats, 6-role audience matrix, **4-phase/60-day roadmap (conflicts with existing `claude-challenge-curriculum.md`)**, challenge rules, WhatsApp CTA |
| 4 | `src/components/workshop/events-data.ts` (`EVENTS` array) | `/ai-workshop`, `/ai-workshop/events` | Exported data module (already the right shape) | 4 events: title/date/time/host/location/description each, including a "48-Hour AI Hackathon" entry — the only public mention of the hackathon left anywhere |
| 5 | `src/components/workshop/TopicsSection.tsx` (`TOPICS`), `CommunityStats.tsx` (`STATS`) | `/ai-workshop` | Hardcoded consts | 8-topic curriculum list (Figma/Cursor/MCP content — note: page hero currently says "Enhance LinkedIn & AI Mock Interview Workshop," inconsistent with this topics list; flag as a live-site inconsistency, not something to resolve by guessing which is current), 3 community stats |
| 6 | Supabase `workshop_config` via `getWorkshopConfig()` (`src/lib/workshop-supabase.ts:28-41`) | `/ai-workshop` | Live DB read (Supabase) | `zoomLink`, `whatsappLink`, `webinarDate`, `webinarTime`, `webinarTargetUtc` only — confirmed, nothing else |
| 7 | `src/components/talent-hunt/hero.tsx`, `program-at-a-glance.tsx`, `what-you-will-build.tsx`, `who-this-is-for.tsx` | `/ai-cohort-register`, `/ai-cohort-india` (same components, `country` prop) | Hardcoded consts | "30-day intensive cohort" — hero, 6 stats, 4-module/16-bullet curriculum, 5 audience segments. **Different shape from `/program`'s 31-day/8-phase cohort** — see conflict note below |
| 8 | `src/components/program/landing/program-landing.tsx` inline copy; `src/data/roadmap.ts` (`ROADMAP_PHASES`, `HOW_IT_WORKS_STEPS`) | `/program` (landing only — gated by `ENABLE_PROGRAM` env flag returning `notFound()`, but NOT gated by login/membership) | Data module + hardcoded consts | Hero, requirements, prerequisites, 8-phase/31-day roadmap table, 4-step "how it works" — **this is marketing copy only, distinct from the protected `prisma/content/program/*.json` real curriculum data** |
| 9 | `src/data/chatbot-menu.ts` (`SUPPORT_EMAIL`, category labels) | Root layout, all pages | Data module | Chatbot's own UI labels — useful as the canonical support-email source, not really "content" to chunk |

### 3b. Confirmed NOT public (do not ingest)

| Source | Why excluded |
|---|---|
| `prisma/content/program/*.json` (days/modules/exercises/rubrics/videos/questions) | Backs `/program/day/[day]`, `/program/curriculum`, `/program/videos` — **all gated by `requireProgramMember()`, confirmed by direct read**, not just the `ENABLE_PROGRAM` flag. This is real member-only curriculum, distinct from item 8 above. |
| `prisma/content/problems.json`, `quizzes.json` | Backs `/challenge/[day]`, `/quiz/[quizId]` — both session-gated |
| `marketplace.json` / `MarketplaceItem` | Backs `/marketplace` — session-gated |
| `Job` / `JobApplication` | Backs `/jobs` — session-gated |
| `HackathonEvent.problemStatement` | Backs `/hackathon/dashboard` only — session-gated |
| `src/components/landing/testimonials-carousel.tsx` (`TESTIMONIALS`) | **Dead code.** Only consumer is `landing-hub.tsx`, which nothing imports — `/` actually renders `ModernistLanding`. Not a live source; don't ingest, don't treat as current. |

### 3c. Public but must NOT be ingested — personal/sensitive data, not site content

| Source | Note |
|---|---|
| `/verify/[certificateId]` | Genuinely public, no auth. Per-person certificate data (name, cert ID, days completed, streak). This is about one individual, not ABTalks-the-product — out of scope for a general knowledge base regardless of reachability. |
| `/r/[token]` | Genuinely public via secret token. Per-candidate recruiter assessment — **and, per the security finding above, currently also exposes compensation/logistics fields that shouldn't be public at all.** Absolutely exclude from ingestion; this is the clearest example of why the extraction allowlist (§5) must be explicit, not a crawl. |
| `/students/[id]` | Docs call this "public, basic info only," but the current code requires login (`page.tsx:42-45`) — not actually reachable by an unauthenticated visitor. Moot for this audit, but the docs should be corrected separately. |
| `public/hackathon/candidates.json`, `curriculum.json`, `technical-spec.md` | **Boundary gap, not intentional public content.** The only page that links to these (`/hackathon/submission`) is protected, but the static files themselves live under `public/` and are directly fetchable by URL — `middleware.ts`'s `protectedPaths` only matches page routes, not these raw asset paths. Recommend fixing the boundary (move these under a protected route or an authenticated API) as a separate small fix; do not ingest them into the chatbot regardless, since they were never intended to be public content. |

### 3d. Existing chatbot KB files — redundant vs. still needed once ingestion exists

| File | Disposition |
|---|---|
| `abtalks.md`, `programs.md`, `faq.md` | Largely superseded by `/` and per-program landing pages — but the *framing* conflicts (evidence-based-hiring vs. build-in-public) need a human decision, not a silent merge. `faq.md` should shrink to what it already claims to be: an index pointing at generated content, not prose. |
| `coding-challenge.md` | Superseded by `/challenges` — the live page has more (community rules, FAQ) than the hand-written file. |
| `claude-challenge.md` + `claude-challenge-curriculum.md` | **Likely wrong**, per §2. Should be rebuilt from `/claude-signup`'s actual slide content once this pipeline exists — not patched further by hand. |
| `ai-cohort.md` | Partially validated (roadmap table matches `src/data/roadmap.ts`) — the `/program` page's "Requirements"/"Prerequisites" copy is more complete than what's hand-written; worth pulling in verbatim once ingestion exists. |
| `workshops.md` | Needs reconciling against the live `/ai-workshop` hero/topics mismatch noted in 3a row 5 — don't silently pick one. |
| `events.md`, `vicodathon.md` | No public hackathon page exists anymore to verify against — these become effectively unverifiable until/unless the hackathon gets a public landing page again. Flag as stale, keep with an explicit "last verified against a page that no longer exists publicly" note rather than deleting outright. |
| `community.md` | Validated — `/challenges`' community-rules section matches. |
| `testimonials.md` | Names are real, but note: `/`'s current 2 testimonials (unnamed "Hiring lead" / "Cohort graduate") are a *different* set from the named roster in `testimonials.md`. Both may be legitimate for different audiences — don't merge them into one list. |
| `socials-and-contact.md`, `anil-bajpai.md` | Not contradicted by anything the audit found (social links are typically footer content, out of scope of the page-body audit; founder bio isn't duplicated in page components). Lowest risk — can likely stay manually maintained as a small supplementary layer. |
| `website.md` | Needs a rewrite regardless — must reflect that `/hackathon` no longer has content, and should stop being hand-maintained once route/content extraction is automatic. |

## 4. Proposed architecture

```
allowlisted source files/modules (§5)
        │  (build-time import, not HTTP crawl)
        ▼
extraction step  →  normalized knowledge docs (title, body, sourceRoute, contentHash)
        │
        ▼
knowledge/generated/*.md   (auto-generated, not hand-edited — replaces most of knowledge/processed/*.md)
        │
        ▼
chunking (existing scripts/chunk-markdown.ts, unchanged)
        │
        ▼
incremental embedding (only chunks whose contentHash changed get re-embedded — §7)
        │
        ▼
src/data/kb-embeddings.json  (same file route.ts already reads — no route.ts retrieval changes needed)
```

Two knowledge tiers going forward:
- **`knowledge/generated/`** — machine-produced from real app content. Always
  wins on conflict with the other tier. Never hand-edited; edits belong in
  the source component/data-module instead.
- **`knowledge/processed/`** — shrinks to a small supplementary layer for
  facts genuinely absent from any page (social links, founder bio, and
  anything the audit in §3d flags as "not contradicted, low risk"). Must not
  restate anything §3a already covers, to avoid exactly the
  duplication/drift problem this plan exists to fix.

## 5. The allowlist — the core safety mechanism (answers "how to prevent private content from entering the corpus")

The extraction step must **never crawl or auto-discover** source files. It
reads from a single, explicit, checked-in allowlist (e.g.
`scripts/knowledge-sources.ts`) naming exactly the modules/consts in §3a —
nothing else. Every new source requires a deliberate addition to this list by
a developer, the same discipline `knowledge/metadata/sources.json` already
uses for the hand-written tier.

To stop that allowlist from silently going stale (e.g. a route in it later
gets an auth gate added, or vice versa), the extraction step should also run
an automated check per allowlisted route: confirm it does **not** appear in
`middleware.ts`'s `protectedPaths` and that its `page.tsx` contains no
`auth()`/`redirect("/login"...)`/`requireProgramMember()`/`requireAdmin()`/
`requireRecruiter()` call. If a previously-public route in the allowlist
fails this check, the build should **fail loudly**, not silently keep
ingesting what just became protected content. This is the direct lesson from
finding the `/r/[token]` compensation leak during this audit — a `select`
that quietly grew scope. The same discipline applies here: fail closed, not
open.

Where a source is DB-backed (`workshop_config`), the extraction step must
call the *same* narrow read function the page itself calls
(`getWorkshopConfig()`) rather than writing a new query — never a fresh
`select *`-style read that could pull in fields the page doesn't render.

## 6. Files to touch (future execution plan — not built now)

- `scripts/knowledge-sources.ts` `[new]` — the allowlist: source id → module
  path/export name → target `knowledge/generated/*.md` file → expected
  public route(s) for the auth-drift check in §5.
- `scripts/extract-public-content.ts` `[new]` — build-time script: imports
  each allowlisted module (or, for the one Supabase source, calls
  `getWorkshopConfig()`), runs the auth-drift check, normalizes content into
  markdown, writes `knowledge/generated/*.md`, and records a content hash per
  source in `knowledge/generated/.manifest.json`.
- `knowledge/generated/` `[new dir]` — auto-generated markdown, one file per
  allowlisted source, matching the shape `chunk-markdown.ts` already expects.
- `scripts/generate-kb-embeddings.ts` `[edit]` — read from both
  `knowledge/generated/*.md` and the shrunk `knowledge/processed/*.md`;
  compare each chunk's content hash against `kb-embeddings.json`'s existing
  entries and only re-embed chunks whose source hash changed (§7); everything
  else copies its existing embedding forward unchanged.
- `knowledge/processed/*.md` `[edit/delete, per §3d]` — trimmed down to the
  genuine supplementary layer; redundant files rebuilt or removed once their
  generated equivalent exists.
- `package.json` `[edit]` — insert the extraction+embedding step into the
  existing `build` script chain: `... && node scripts/extract-public-content.ts
  && node scripts/generate-kb-embeddings.ts && next build` (exact command
  syntax TBD in the execution plan) — this is what makes it automatic on
  Vercel with no manual step (§8), since Vercel just runs `npm run build`.
- Possibly: move a handful of content consts that currently live inline
  inside page/component JSX (`/` FAQS, `/challenges` FAQ_ITEMS/DAY_STEPS)
  into their own exported data modules, matching the pattern already used by
  `src/data/roadmap.ts` and `src/components/workshop/events-data.ts`. Not
  strictly required (the extraction script could parse inline consts
  instead), but a typed import is far less fragile than parsing JSX, and it's
  a pattern this codebase already uses elsewhere — worth deciding explicitly
  in the execution plan rather than defaulting into AST-scraping.

## 7. Incremental regeneration (answers "only when relevant content changes")

`knowledge/generated/.manifest.json` stores `{ sourceId: { contentHash,
chunkIds[] } }`. On each build, `extract-public-content.ts` recomputes each
source's hash from its freshly-imported content. `generate-kb-embeddings.ts`
then only calls the local embedding model for chunks belonging to a
changed-hash source; unchanged sources' chunks keep their previous embedding
vectors verbatim (copied from the existing `kb-embeddings.json`, not
recomputed). This keeps most deploys (which touch no chatbot-relevant
content) fast, and avoids paying embedding-model cost on every single build.

## 8. Running automatically on Vercel with no manual step

Because the pipeline is just two more `node` script calls inserted into the
existing `npm run build` chain (§6), Vercel's normal build step — which this
project already relies on for `prisma migrate deploy` / `prisma generate` —
runs it automatically on every deploy. No separate cron, no manual
"regenerate embeddings" step, no new Vercel configuration beyond what
already exists. This also sidesteps the still-open, separate risk flagged in
`docs/plans/062-...md` about `@xenova/transformers` at **request time** in
`/api/chat` — embedding generation for the corpus happens at **build time**,
in Vercel's full Node build container, not in the constrained serverless
function runtime. That's meaningfully safer, but it does not resolve 062's
open question about the *query-time* embedding call inside `route.ts` at
request time — that still needs its own validation, separately.

## 9. Guardrails for whoever executes this (DO NOT)

- Do not let the extraction step crawl `src/app/` looking for content — it
  reads only from the explicit allowlist in §5, nothing auto-discovered.
- Do not write new Prisma/Supabase queries inside the extraction script for
  DB-backed sources — call the existing page-level read function only.
- Do not merge `testimonials.md`'s named roster with `/`'s two unnamed
  testimonials into one list — they're different content for different
  surfaces.
- Do not resolve the `abtalks.md` vs. `/`'s evidence-based-hiring framing
  conflict by picking one silently — that's a positioning decision, not a
  data-sync problem.
- Do not rebuild `claude-challenge-curriculum.md` from the old monolith
  source again — rebuild it from `/claude-signup`'s actual slide content once
  this pipeline exists.
- Do not ingest `public/hackathon/*.json`, `/verify/[certificateId]`, or
  `/r/[token]` under any circumstance, per §3b/§3c.
- Do not skip the auth-drift check in §5 "to save build time" — it's the
  single guardrail preventing a future protected-route change from silently
  leaking into the chatbot corpus.

## 10. Verification (for the eventual execution plan)

- `scripts/extract-public-content.ts` run manually once, diffed against the
  current `knowledge/processed/*.md` content — confirm the generated
  Claude Challenge curriculum now matches `/claude-signup`'s actual 4-phase
  structure, not the old Day-1–60 table.
- Confirm `knowledge/generated/` contains no trace of any §3b/§3c source.
- Confirm the auth-drift check actually fails the build when tested against
  a deliberately-broken allowlist entry (point it at a protected route,
  confirm build fails, not warns).
- Confirm an unrelated code change (e.g. a CSS tweak) does not cause any
  chunk's embedding vector to change — proves the hash-based incremental
  regeneration is working, not silently re-embedding everything every time.
- `npm run build` succeeds locally end-to-end with the new steps inserted.

## 11. Commit message (for the eventual execution PR — not this pass)

```
Audit public content sources and design dynamic knowledge ingestion pipeline for the chatbot

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```
