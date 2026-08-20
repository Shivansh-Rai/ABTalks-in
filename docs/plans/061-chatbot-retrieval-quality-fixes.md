# 061 — Chatbot Retrieval Quality Fixes

## 1. Goal

Fix four concrete defects in the ABTalks Help Assistant (Gemini-backed, `/api/chat`)
that make it feel broken or thin today: greetings dead-end into the "not found"
fallback, the system prompt's sitemap points at routes that don't exist, the
retrieval corpus is polluted with a non-knowledge planning document, and a large
amount of genuinely useful, already-written ABTalks knowledge sits in a stale,
unverified monolith file instead of the maintained per-topic knowledge base.

**Scope note:** this is a knowledge-quality and correctness pass only — step 1
of a larger sequence (knowledge cleanup → semantic retrieval → conversation
context → session/UI polish → evaluation). The BM25-stays-as-is guardrail in
§6 applies to *this plan only*: it means "don't reach for a new dependency to
fix a knowledge-organization problem," not "BM25 is the permanent retrieval
architecture." A follow-up plan will replace/augment it with the semantic
retrieval pipeline that already exists but is unwired — see
`scripts/generate-kb-embeddings.ts` / `src/data/kb-embeddings.json`
(`@xenova/transformers`, already an installed dependency, zero API cost) —
`route.ts` currently ignores this asset entirely and does its own from-scratch
lexical BM25 instead.

## 2. Current behavior

- `src/app/api/chat/route.ts` builds a BM25 index over every `.md` file in
  `knowledge/processed/` on first request, retrieves the top-scoring chunks for
  the user's message, and either answers via Gemini grounded in those chunks or
  returns a fixed fallback (`FALLBACK_MESSAGE`) when nothing scores above `0.1`.
- **Bug — greetings dead-end.** `tokenize()` only keeps tokens, and BM25 only
  scores a chunk if it contains that literal token. Nothing in
  `knowledge/processed/*.md` contains the word "hello," so `"hi"` / `"hello"` /
  `"thanks"` / `"bye"` always score `0` across every chunk, which trips the
  `topChunks.length === 0` branch and returns the "couldn't find a direct
  answer... team@abtalks.in" fallback for ordinary small talk, without Gemini
  ever being called. Confirmed live (user screenshot): both "hi" and "hello"
  return the fallback verbatim.
- **Bug — stale sitemap.** `SYSTEM_PROMPT` (route.ts:134) hardcodes: `Home (/),
  Hackathons (/hackathons), Evidence (/evidence), Privacy (/privacy), Sign In
  (/login)`. None of `/hackathons` or `/evidence` exist. Real public routes
  (`docs/project-context.md` §7) include `/challenges`, `/claude-signup`,
  `/ai-cohort-register`, `/ai-cohort-india`, `/hackathon`, `/ai-workshop`,
  `/ai-workshop/events`, `/program`, `/talent`, `/jobs`,
  `/verify/[certificateId]`. Any answer that names a page is likely pointing
  the user at a 404.
- **Corpus pollution.** `knowledge/processed/implementation.md` (1045 lines) is
  the *original build plan* for this chatbot — "Do NOT start by building the
  vector database," checklists, a superset of
  `src/components/chatbot/implementation.md` (127 lines, the canonical copy of
  this plan). It is not ABTalks knowledge, but `route.ts` chunks and indexes it
  like every other file in the directory, so it can be retrieved as "context"
  for a real user question.
- **Duplication with an unindexed goldmine.** `knowledge/processed/*.md` (11
  topic files) is the maintained, date-verified, cross-referenced knowledge
  base described in `docs/plans/039-chatbot-knowledge-corrections-and-wiring.md`
  — small, careful, and correctly distinguishes historical vs. current facts
  via `knowledge/metadata/facts.json`. Sitting alongside it,
  `knowledge/processed/abtalks-chatbot-kb.md` (573 lines) is an older,
  unverified single-file knowledge dump that both **duplicates** what the topic
  files already cover (community numbers, program summaries) *and* contains
  **substantial unique content the topic files are missing entirely**: the
  full 60-day Claude Challenge curriculum table, the capstone deep-dive
  (days 51–60), a graduate skills matrix, a real testimonial roster, and
  audience-segmented FAQs (students / recruiters / professionals / investors).
  Both files get chunked into the same BM25 index today, so real answers
  compete with redundant or contradictory restatements, and the unique content
  is retrievable but ungoverned — it still has a hardcoded WhatsApp invite URL
  (`socials-and-contact.md` explicitly forbids this because invite links
  rotate), an unverified hackathon timeline/registration-status claim, and a
  sitemap of its own that's also wrong (missing `/ai-workshop`, `/talent`,
  `/jobs`; doesn't note `/program` is a gated track).

## 3. Files to touch

**Retrieval / prompt fix:**
- `src/app/api/chat/route.ts` `[edit]` — add a small-talk short-circuit before
  the BM25 gate; replace the hardcoded sitemap line with accurate routes.

**Corpus cleanup:**
- `knowledge/processed/implementation.md` `[deleted]` — meta/planning content,
  not ABTalks knowledge; already tracked at
  `src/components/chatbot/implementation.md`, which is outside the indexed
  directory and stays untouched.
- `knowledge/processed/abtalks-chatbot-kb.md` `[deleted]` — retired after its
  unique content is merged into the topic files below (do this last).

**New topic files (content sourced from the retired monolith):**
- `knowledge/processed/claude-challenge-curriculum.md` `[new]` — full 60-day
  curriculum table, structure-at-a-glance groupings, the days 51–60 capstone
  deep-dive, and the graduate skills matrix.
- `knowledge/processed/testimonials.md` `[new]` — the real testimonial roster
  (name, affiliation, quote-theme), with the "only quote these names, never
  invent new ones" rule carried over verbatim.
- `knowledge/processed/audience-faqs.md` `[new]` — the four audience-segmented
  FAQ sets (students, recruiters, professionals, investors), cleaned per
  guardrails below.

**Edits to existing topic files (folding in genuinely missing facts):**
- `knowledge/processed/community.md` `[edit]` — add the community-conduct
  sanctions table (foul language/harassment → permanent ban; plagiarism/misuse
  → 60-day challenge ban).
- `knowledge/processed/ai-cohort.md` `[edit]` — add the 8-phase/31-day table
  and the 4-stage cohort flow (Apply → 31 days of missions → AI interview →
  recruiter visibility).
- `knowledge/processed/vicodathon.md` `[edit]` — add the Breeth sponsorship
  detail (Breeth Pro free for participants, MCP server, "Best use of Breeth"
  track) and the last edition's timeline table, explicitly marked as
  unverified/sourced only from the retired scrape, per guardrails below.
- `knowledge/processed/anil-bajpai.md` `[edit]` — add Sarthak Gupta (Founding
  Member) and the auth-page founder attribution line ("Built by Anil Bajpai's
  ABTalks community").
- `knowledge/processed/website.md` `[edit]` — replace the vague section list
  with the accurate current route list (same routes as the `route.ts` sitemap
  fix), each with a one-line description.
- `knowledge/processed/faq.md` `[edit]` — add index entries pointing to the
  three new files (curriculum, testimonials, audience FAQs), consistent with
  its existing "index, not source of truth" design.

**Metadata:**
- `knowledge/metadata/sources.json` `[edit]` — add one source entry for the
  retired `abtalks-chatbot-kb.md` scrape (id e.g. `chatbot-kb-site-scrape`,
  status `supporting`, note it as the provenance for the newly merged content
  and that it has not been independently re-verified against the live site).

## 4. Server vs Client

Everything in this plan is server-only: a Route Handler and markdown/JSON
knowledge files read at request time in `src/app/api/chat/route.ts`. No
component in `src/components/chatbot/` changes — `ChatWidget.tsx`,
`ChatBubble.tsx`, `ChatLauncher.tsx`, `chatbot-matcher.ts`, and
`chatbot-menu.ts` are out of scope for this plan.

**Design conformance:** N/A — no UI or component changes in this plan.

## 5. Steps

1. In `route.ts`, add a curated small-talk regex and short-circuit it *before*
   `searchQuery`/BM25 runs (see guardrails for the exact behavior).
2. In `route.ts`, replace the `SYSTEM_PROMPT` sitemap line with the accurate
   route list from `docs/project-context.md` §7 (public + auth-gated entry
   points relevant to a support conversation only — not `/admin/*`).
3. Delete `knowledge/processed/implementation.md`.
4. Read `knowledge/processed/abtalks-chatbot-kb.md` fully (already done during
   planning — see §2) and, section by section, merge its unique content into
   the new/edited files listed in §3, applying the guardrails in §6 to every
   merged fact (no silent overwrite of already-corrected facts, no hardcoded
   WhatsApp URL, mark unverified claims as unverified).
5. Update `faq.md`'s index with entries for the three new files.
6. Update `sources.json` with the retired-monolith provenance entry.
7. Delete `knowledge/processed/abtalks-chatbot-kb.md`.
8. Run `npm run build` / `npx tsc --noEmit`.

## 6. Guardrails for Cursor (DO NOT)

- The small-talk short-circuit must use a **curated, explicit regex** (e.g.
  greetings, thanks, farewells, "ok") — do not widen it to "any short
  message," or it will start swallowing real short factual questions (e.g.
  "AI cohort?"). It returns a fixed friendly reply and **does not call
  Gemini** — same latency/cost profile as today's no-match fallback, just a
  correct one for non-factual turns.
- Do not weaken or remove the existing `score > 0.1` fallback gate for actual
  factual questions. A genuinely out-of-scope question (e.g. "what's ABTalks'
  revenue?") must still hit `FALLBACK_MESSAGE` — the small-talk fix is a
  separate, earlier branch, not a replacement for the fallback.
- When merging content from `abtalks-chatbot-kb.md`: **the topic files and
  `facts.json` are the authority whenever the two disagree** (dates, event
  status, community-size figures, Instagram handle). The monolith predates
  the corrections in `docs/plans/039-...md` — e.g. it has no
  Figma×Cursor date correction and no "Enhance LinkedIn & AI Mock Interview"
  event. Never let a merge silently reintroduce a superseded fact.
- Do not carry forward the hardcoded WhatsApp invite URL
  (`chat.whatsapp.com/LSru1BgvifpEB4OMZsaZEi`) into any merged file — rephrase
  as "the WhatsApp link on the official website," matching the existing rule
  in `socials-and-contact.md`.
- The Breeth sponsorship detail and hackathon timeline table
  (registration/kickoff/submission/winners dates) going into `vicodathon.md`
  must inherit the file's existing "historical/completed" status and get an
  explicit note that it's sourced only from the retired site-scrape file and
  hasn't been independently re-verified — same epistemic pattern already used
  for the "20+ countries" claim in `community.md`.
- Do not fold the monolith's "Bot Behavior Guardrails" / "Brand Voice Guide"
  sections into a `knowledge/processed/*.md` file — those are instructions for
  how the assistant should *behave*, not retrievable ABTalks facts. If
  anything from them is worth keeping (e.g. "don't promise placement/income
  outcomes," "don't recommend paid tools mid-curriculum"), add it as a short
  line in `SYSTEM_PROMPT` in `route.ts`, and only if not already implied by
  the existing Core Rule.
- Do not invent or smooth over gaps while merging — if a claim in the monolith
  can't be reconciled with the topic-file system's discipline (e.g. the
  unverifiable "Winners announced Fri 14 Aug" date), keep it but mark it
  unverified rather than dropping it silently or asserting it as fact.
- Do not touch `src/components/chatbot/*`, `src/lib/chatbot-matcher.ts`, or
  `src/data/chatbot-menu.ts` — out of scope.
- Do not add a vector DB or new dependency — this stays plain BM25 over
  markdown, per the existing design in `docs/plans/039-...md`.

## 7. DB safety

Not applicable — no schema, migration, or seed changes.

## 8. Verification

- `npm run build` and `npx tsc --noEmit` pass.
- Manually test in the chat widget (`npm run dev`):
  - "hi" and "hello" → a friendly canned reply, not the KB fallback.
  - "what's ABTalks' revenue?" (genuinely out of scope) → still returns
    `FALLBACK_MESSAGE` pointing to `team@abtalks.in` — confirms the small-talk
    fix didn't swallow real fallback behavior.
  - "where do I sign up for the AI Cohort?" → answer references
    `/ai-cohort-register` or `/ai-cohort-india`, not `/login` or `/hackathons`.
  - "what happens if someone uses foul language in the community?" → surfaces
    the permanent-ban rule now in `community.md`.
  - "what do I build on day 8 of the Claude Challenge?" → answer comes from
    `claude-challenge-curriculum.md`.
  - Ask for a testimonial → only names from `testimonials.md` are used, never
    invented ones.
- Confirm `knowledge/processed/implementation.md` and
  `knowledge/processed/abtalks-chatbot-kb.md` no longer exist, and no
  remaining file in `knowledge/processed/` contains non-ABTalks meta content.
- Confirm exactly the files listed in §3 changed — nothing in
  `src/components/chatbot/` or the client matcher/menu files.

## 9. Commit message

```
Fix chatbot greeting dead-end, stale sitemap, and knowledge base pollution/duplication

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```
