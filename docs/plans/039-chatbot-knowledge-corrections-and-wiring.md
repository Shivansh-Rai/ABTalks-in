# 039 — Chatbot Knowledge Corrections + Continued Implementation

## 1. Goal

Correct verified errors/gaps in the `knowledge/` base (checked against live
abtalks.in and the official guidelines PDF already in `public/documents/`),
fix malformed metadata JSON, and continue the chatbot build — the components
in `src/components/chatbot/` are currently static, unwired presentational
shells with no retrieval, no grounding, and no enforcement of the Core Rule
defined in `src/components/chatbot/implementation.md`.

## 2. Current behavior

- `knowledge/processed/*.md` (11 files) hold facts for the 25 planned
  knowledge areas from `implementation.md`. The original source documents
  (Master Fact Sheet PDF/DOCX, Overview PPTX, AI Tools Workshop doc, Figma×Cursor
  PDF, ViCodathon notice + influencer brief) are **not** in this repo — only
  `public/documents/ABTalks-60-Day-Challenge-Guidelines.pdf` exists, and it was
  never incorporated into the knowledge base.
- Five files have a leftover placeholder stub duplicated after the real
  content (`# X` + "This file contains processed X knowledge."):
  `abtalks.md`, `community.md`, `programs.md`, `faq.md`, `events.md`.
- `vicodathon.md` is nothing but that stub — no real content at all, despite
  `implementation.md` naming ViCodathon rules/submission/judging as areas 13-15.
- `knowledge/metadata/facts.json` and `knowledge/metadata/sources.json` each
  contain **two concatenated top-level JSON values** in one file (e.g.
  `{"facts": []}\n{"facts": []}`) — this is invalid JSON and will throw on
  `JSON.parse`. `sources.json` also only lists 2 of the 8 planned sources.
- `ChatBubble.tsx`, `ChatPanel.tsx`, `SuggestedQuestions.tsx` are pure
  presentational components driven entirely by props. Nothing populates those
  props: there is no server action, no retrieval logic, no LLM call, and no
  code path that enforces "if the knowledge base can't support an answer,
  fall back to the support email" — that rule currently exists only as prose
  in `implementation.md`.
- No existing `src/features/chatbot/` or `src/app/actions/chatbot-actions.ts`
  — confirmed by search, this is greenfield.

## 3. Verified findings (cross-checked against abtalks.in live site + the PDF)

**A. Confirmed correct, no action needed:** 10,000+ community members, 500+
projects, 100+ hiring partners, current Instagram `@abtalksonai`, AI Cohort
(31 days / 8 phases / 2–4 hrs/day / free / Ollama+Groq+Chroma), 60-Day Coding
Challenge tracks (SE/DS/AI), Claude Challenge launch (June 1, 60 days), and
Vibe Code Hackathon/ViCodathon having no live page today (supports the
existing "historical" status).

**B. Missing official social channels** — `socials-and-contact.md` omits
Discord (`discord.gg/j4Q8tvDj6`) and X/Twitter (`@abtalksonai`,
`x.com/abtalksonai`), both live in the site footer today. Add both.
Do **not** hardcode the WhatsApp invite URL
(`chat.whatsapp.com/LSru1BgvifpEB4OMZsaZEi`) as a permanent fact — invite
links rotate; if it's included at all, phrase it as "join via the link on the
website" rather than a fixed URL that will go stale.

**C. Major content gap — Claude Challenge rules.** `claude-challenge.md` is
missing nearly everything in `public/documents/ABTalks-60-Day-Challenge-Guidelines.pdf`,
which is a live, authoritative, already-in-repo source that was never read
into the knowledge base:
- One dedicated GitHub repo, organized `Day1/ … Day60/`
- Each LinkedIn post must cover: what was built, key learnings, a
  screenshot/demo
- Every post must tag all three: `@AnilBajpai @ABTalksOnAI @Anthropic`
- A day only counts when **all three** are done: GitHub push + LinkedIn post
  + all required tags present — miss one and the day may not count
- Progress tracked on a streak heatmap; missing a day doesn't remove you from
  the challenge, it just breaks the streak
- Consistency factors into certificates, goodies, community recognition, and
  special opportunities

This is exactly the kind of specific, high-stakes procedural question a
support assistant will get asked ("do I need to tag anyone in my posts?")
and right now has zero grounding for it — highest-priority fix.

**D. `vicodathon.md` is empty.** Merge in the ViCodathon facts that already
exist (correctly) in `events.md` (48-hour event, free, public GitHub repo +
live URL + AI-usage log required, historical/completed) so the dedicated file
isn't blank. The original ViCodathon Official Event Notice + Influencer Brief
aren't in this repo — if richer rules/judging detail exists only in those
external docs, they need to be located and supplied; don't invent detail to
fill the gap.

**E. Unresolved ambiguity — do not guess.** `abtalks.md` and `programs.md`
name a 5th core program, "Free AI Bootcamp" (1 hr, free, Google Meet,
recurring). `workshops.md` separately describes the "AI Tools Workshop" with
nearly identical shape (1 hr, free, Google Meet, beginner-friendly).
`implementation.md`'s 25-area list names only "AI Tools Workshop" (area
#10) — "Free AI Bootcamp" doesn't appear anywhere in the plan. These may be
the same offering under two names, or genuinely distinct programs. Neither
has a live linked page today, so it can't be checked against the site. Flag
to you / re-check the original Master Fact Sheet before Cursor touches this —
merging or un-merging them incorrectly would violate the plan's explicit "do
not merge distinct workshops" rule in the other direction.

**F. Unverifiable, not necessarily wrong.** `community.md`'s "20+ countries
represented across cohorts" doesn't appear anywhere on the live site. It may
be sourced from the Master Fact Sheet PDF (not in this repo) and is
plausible, but treat it as unconfirmed rather than re-verified.

**H. Wrong date on Figma × Cursor workshop — confirmed via `abtalks.in/ai-workshop/events`.**
`workshops.md` currently says the Figma × Cursor workshop is **August 21,
2026, 6:00 PM IST**. The live events page lists four separate, individually
dated cards (re-verified twice for consistency):

| Card | Date/time |
|---|---|
| FREE AI Bootcamp — Live Workshop | Jul 18, 2026, 4:00 PM IST |
| Figma × Cursor — AI-Powered UI/UX Workshop | **Aug 1, 2026, 6:00 PM IST** |
| 48-Hour AI Hackathon | Aug 7, 2026, starts 8:00 PM IST |
| Enhance LinkedIn & AI Mock Interview | Aug 21, 2026, 6:00 PM IST |

Figma × Cursor is actually **Aug 1**, not Aug 21 — `workshops.md` appears to
have mis-attributed the "Enhance LinkedIn & AI Mock Interview" date to the
Figma × Cursor workshop (both existing knowledge files currently list them
with the identical Aug 21 / 6 PM slot, which the live site shows is only
true for the LinkedIn/interview event). Fix the Figma × Cursor date to Aug 1.

**I. "Enhance LinkedIn & AI Mock Interview" is its own event, not a bullet
under workshops.** Both `workshops.md` and `events.md` currently mention it
only as a line under "Upcoming events page" / "Current site timing," as if
it were a restatement of the Figma × Cursor listing. It's a fourth, distinct
offering with its own name and needs its own short fact entry (name, Aug 21
2026 6 PM IST, Zoom, free) — likely under `events.md`, since it isn't named
in `implementation.md`'s workshop areas (#10, #11) and doesn't fit either
existing workshop.

**J. A newer hackathon edition exists — "48-Hour AI Hackathon," Aug 7,
2026.** This wasn't in any processed knowledge file. Format (48 hours, free,
team-based) matches the generic "Vibe Code Hackathon" description already in
`programs.md`/`events.md`, so this is most likely the latest live iteration
of that same recurring hackathon program rather than a third distinct
hackathon — but that's an inference, not confirmed by an explicit "formerly
ViCodathon" statement on the site. Add it to `events.md` as a dated
iteration; don't silently merge its specifics into `vicodathon.md`, which
is explicitly the 2026 ViCodathon fact base per `implementation.md` source 7.

**K. Date-status correction — the site's own "Coming soon" labels are stale
and must not be trusted over the actual dates.** Relative to today
(2026-08-10), three of the four events above have already happened — Free AI
Bootcamp (Jul 18), Figma × Cursor (Aug 1), and the 48-Hour AI Hackathon
(Aug 7) — even though the live site still badges them "Coming soon" /
"Accepting registrations." Only "Enhance LinkedIn & AI Mock Interview"
(Aug 21) is genuinely upcoming. This is exactly the historical-vs-upcoming
judgment `implementation.md` section 3 already calls for — derive status
from comparing the date to the project date, never from the site's displayed
status text.

**L. Best-evidence read on item E (Free AI Bootcamp vs AI Tools Workshop) —
still not certain, confirm before relying on it.** The live "FREE AI
Bootcamp — Live Workshop" event description ("Master ChatGPT, Claude &
Gemini in one hands-on live hour — prompt engineering, real workflows")
matches `workshops.md`'s "AI Tools Workshop" description (comparing AI
models, prompt engineering, AI tools, workflow automation) closely enough
that they read as the same recurring 1-hour/free/live workshop, marketed
under two names in different materials — not two separate programs. A
second extraction pass on `/ai-workshop` contradicted this (claimed they're
distinct and separately conflated dates), but that pass also mis-stated the
Figma × Cursor date, so it's less reliable than the repeated, consistent
events-page read. Treat "same workshop, two names" as the working
hypothesis, but still confirm against the original Master Fact Sheet before
Cursor merges the two entries — don't let Cursor merge them off this
evidence alone.

**G. Structural/mechanical fixes:**
- Strip the duplicated placeholder stub from `abtalks.md`, `community.md`,
  `programs.md`, `faq.md`, `events.md`.
- Fix `facts.json` and `sources.json` — collapse each into one valid JSON
  object (currently two concatenated objects each — invalid JSON, breaks
  `JSON.parse`).
- Add the missing sources to `sources.json`: `fact-sheet-docx`,
  `fact-sheet-pdf`, `ai-tools-workshop-overview`, `figma-cursor-workshop-pdf`,
  `vicodathon-event-notice`, `vicodathon-influencer-brief`, plus a new entry
  for `public/documents/ABTalks-60-Day-Challenge-Guidelines.pdf` (status:
  authoritative, scope: `["claude-challenge"]`).

## 4. Files to touch

**Knowledge corrections:**
- `knowledge/processed/socials-and-contact.md` `[edit]` — add Discord + X/Twitter (item B)
- `knowledge/processed/claude-challenge.md` `[edit]` — add full guidelines-PDF content (item C)
- `knowledge/processed/vicodathon.md` `[edit]` — populate from events.md content (item D); do not fold the new 48-Hour AI Hackathon (item J) into this file
- `knowledge/processed/workshops.md` `[edit]` — fix Figma × Cursor date Aug 21 → Aug 1, 2026 (item H); hold on merging "Free AI Bootcamp" into "AI Tools Workshop" pending confirmation (item E/L)
- `knowledge/processed/abtalks.md` `[edit]` — dedupe stub; hold on "Free AI Bootcamp" pending item E
- `knowledge/processed/community.md` `[edit]` — dedupe stub
- `knowledge/processed/programs.md` `[edit]` — dedupe stub; hold on "Free AI Bootcamp" pending item E
- `knowledge/processed/faq.md` `[edit]` — dedupe stub
- `knowledge/processed/events.md` `[edit]` — dedupe stub; add "Enhance LinkedIn & AI Mock Interview" as its own fact entry (item I); add "48-Hour AI Hackathon," Aug 7 2026, as a new dated iteration of the Vibe Code Hackathon (item J); mark Free AI Bootcamp / Figma × Cursor / 48-Hour AI Hackathon as historical relative to 2026-08-10, keep only the Aug 21 LinkedIn/interview event as upcoming (item K)
- `knowledge/metadata/facts.json` `[edit]` — fix invalid JSON, begin populating versioned facts (e.g. record the 10,000 vs 2,400 community-figure supersession and the `@abtalksonai` vs `@abtalks_official` Instagram supersession as structured entries, not just prose)
- `knowledge/metadata/sources.json` `[edit]` — fix invalid JSON, add missing sources

**Implementation (new, per project layout — business logic in `src/features/<domain>/`, mutations/queries via Server Actions):**
- `src/features/chatbot/get-knowledge-base.ts` `[new]` — reads `knowledge/processed/*.md` + `knowledge/metadata/sources.json` server-side, returns structured chunks tagged with source id/status (historical/current/unknown)
- `src/features/chatbot/retrieve-context.ts` `[new]` — keyword-based section retrieval over the chunks (no vector DB — 11 short files don't need one); returns matched chunks or none
- `src/features/chatbot/ask-assistant.ts` `[new]` — if retrieval returns nothing confident, short-circuits to the fixed fallback message **without calling the LLM**; otherwise builds a system prompt containing the Core Rule verbatim from `implementation.md` + only the retrieved chunks, calls Claude via `ANTHROPIC_API_KEY` (already an env var planned in the B2B program work), returns the answer
- `src/app/actions/chatbot-actions.ts` `[new]` — `askAssistantAction(question)`, Zod-validated input, calls `ask-assistant.ts`, returns `{ ok: true, data: { answer } } | { ok: false, message }`, logs retrieval-misses and LLM errors via `lib/logger.ts`
- `src/components/chatbot/ChatWidget.tsx` `[new]` — `"use client"`; the actual stateful floating container implementation.md describes (open/closed state, message list, calls the server action, renders `SuggestedQuestions` on empty state and `ChatBubble` per message)
- `src/components/chatbot/ChatLauncher.tsx` `[new]` — `"use client"`; the floating corner launcher button. **Naming note:** `ChatBubble.tsx` already exists but renders a single chat *message* bubble (`isUser` prop), not a floating launcher — despite the name suggesting otherwise. Keep `ChatBubble.tsx` as-is for messages; don't repurpose it for the launcher role, that's a separate component.
- `src/components/chatbot/ChatPanel.tsx` `[edit]` — wire real message state instead of accepting a static `messages` prop only; keep it a dumb rendering component, let `ChatWidget.tsx` own state
- Root layout (e.g. `src/app/layout.tsx`) `[edit]` — mount `<ChatWidget />` once, site-wide (Server Component layout importing a client component is fine here — no functions/icons/class instances are passed as props)

## 5. Server vs Client

- `get-knowledge-base.ts`, `retrieve-context.ts`, `ask-assistant.ts`,
  `chatbot-actions.ts` — server-only. `ANTHROPIC_API_KEY` must never be read
  in a client component or leaked to the browser.
- `ChatWidget.tsx`, `ChatLauncher.tsx`, `ChatPanel.tsx`, `ChatBubble.tsx`,
  `SuggestedQuestions.tsx` — all Client Components (need `useState` for
  open/close + message list + input).
- Root layout stays a Server Component; it only imports the client
  `ChatWidget`, no prop-passing hazards.
- v1 is non-streaming (plain Server Action call/response) to match this
  codebase's "Server Actions over API routes" convention. If streaming
  responses are wanted later, that's a deliberate exception requiring a
  Route Handler — call it out explicitly if you want that, don't let Cursor
  default into it.

## 6. Steps

1. Fix `knowledge/metadata/facts.json` and `sources.json` (item G) — single
   valid JSON object each, add missing sources.
2. Dedupe the 5 stub-duplicated knowledge files (item G).
3. Add Discord + X/Twitter to `socials-and-contact.md`, with the WhatsApp
   caveat (item B).
4. Rewrite `claude-challenge.md` using the guidelines PDF content (item C) —
   highest-value correction, do this before wiring retrieval so the first
   real answers are accurate.
5. Populate `vicodathon.md` from `events.md`'s existing ViCodathon summary
   (item D).
6. Fix the Figma × Cursor date in `workshops.md` (Aug 21 → Aug 1, item H),
   add "Enhance LinkedIn & AI Mock Interview" as its own entry and the new
   "48-Hour AI Hackathon" iteration to `events.md` (items I, J), and mark
   the three now-past events historical relative to 2026-08-10 (item K).
7. Surface items E/L (Free AI Bootcamp vs AI Tools Workshop) to the user for
   a decision before editing `abtalks.md` / `programs.md` further — do not
   guess which way to resolve it, even though item L's evidence leans
   "same workshop, two names."
8. Build `src/features/chatbot/get-knowledge-base.ts` and
   `retrieve-context.ts`.
9. Build `src/features/chatbot/ask-assistant.ts` with the hard-fallback
   short-circuit as the first branch, not an LLM-side instruction to police
   itself.
10. Build `src/app/actions/chatbot-actions.ts` (Zod input, Result envelope,
    logger on misses/errors).
11. Build `ChatWidget.tsx` + `ChatLauncher.tsx`, wire `ChatPanel.tsx` to real
    state, mount in root layout.

## 7. Guardrails for Cursor (DO NOT)

- Do not invent facts not present in `knowledge/processed/*.md` — if
  retrieval doesn't find a confident match, return the fixed fallback
  message pointing to `team@abtalks.in`. Never let the LLM fill gaps from
  general knowledge.
- Do not resolve item E (Free AI Bootcamp vs AI Tools Workshop) by guessing —
  stop and ask.
- Do not hardcode the WhatsApp invite URL as a permanent fact.
- Do not add a vector DB, embeddings pipeline, or any new external
  dependency for retrieval — 11 short markdown files need keyword/section
  matching, not infrastructure.
- Do not read `ANTHROPIC_API_KEY` (or call the Anthropic SDK) from any
  client component.
- Do not repurpose `ChatBubble.tsx` as the floating launcher — it's the
  message-bubble component; the launcher is a new, separate component.
- Follow existing conventions: Result envelope, Zod at the action boundary,
  `lib/logger.ts` (never `console.error`), no new abstraction files beyond
  what's listed above.

## 8. DB safety

Not applicable — no schema or migration changes in this plan.

## 9. Verification

- `JSON.parse` both metadata files successfully (sanity check the fix).
- No duplicate `# Heading` blocks remain in the 5 corrected files.
- Manually ask the assistant: the Claude Challenge tagging rule, the current
  Instagram handle, "when is the Figma × Cursor workshop" (should answer
  Aug 1, 2026 and note it's already past, not present it as upcoming), "what
  events are coming up" (should surface only the Aug 21 LinkedIn/interview
  event as upcoming), and one clearly out-of-scope question (e.g. "what's
  ABTalks' revenue?") — confirm the dated ones ground correctly with the
  right historical/upcoming status and the last one returns the
  support-email fallback, not a guess.
- `npm run build` / typecheck passes.
- Confirm exactly which files changed against the list in section 4.

## 10. Commit message

```
Correct chatbot knowledge base against live site + guidelines PDF; wire retrieval and fallback

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```
