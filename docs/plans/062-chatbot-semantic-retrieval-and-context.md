# 062 — Chatbot Semantic Retrieval, Follow-Up Context, Answer Tuning

## 1. Goal

Phase 2 of the chatbot quality roadmap (phase 1 is
`docs/plans/061-chatbot-retrieval-quality-fixes.md`, knowledge cleanup — do
that first). Replace the exact-token BM25 retrieval in `/api/chat` with the
semantic embeddings pipeline that already exists in this repo but is unwired,
so paraphrased/casual questions ("what's that 60 day thing," "can second year
join") retrieve correctly. Make retrieval aware of the last few conversation
turns so a follow-up like "who can join?" resolves against whatever program
was just discussed. Tune the system prompt so answers are concise and
single-question-focused instead of exhaustive dumps, with graduated
confidence (strong / partial / none) instead of today's binary
answer-or-fallback gate.

**Blocking dependency:** requires 061 merged first — this plan regenerates
embeddings from the *cleaned* `knowledge/processed/` directory. Regenerating
against the current directory (which still includes `implementation.md` and
`abtalks-chatbot-kb.md`) would bake the pollution problem into the new
retrieval path instead of fixing it.

## 2. Current behavior

- `route.ts` builds a fresh in-memory BM25/TF-IDF index from
  `knowledge/processed/*.md` on every cold start and matches on literal
  token overlap only (see 061 §2 for the exact failure mode this causes).
- A **separate, already-built semantic retrieval pipeline exists and is
  never used**: `scripts/generate-kb-embeddings.ts` chunks the same
  directory and embeds every chunk with a local, free model
  (`@xenova/transformers`, `Xenova/all-MiniLM-L6-v2`, 384-dim, already an
  installed dependency — no API cost, no new dependency needed) into
  `src/data/kb-embeddings.json` (388 chunks, one static JSON file, no vector
  DB). It was generated once during initial build and never regenerated or
  read anywhere. `scripts/chunk-markdown.ts` is a *third*, more careful
  chunker (splits cleanly on H1/H2 only) built for `scripts/inspect-chunks.ts`
  — a chunk-quality dry-run tool — but `generate-kb-embeddings.ts` still uses
  its own cruder inline chunker (splits on H2–H4, different boundaries),
  so the embeddings and the inspector don't even agree on what a "chunk" is.
- Follow-up context today is a single hack: `searchQuery` concatenates only
  the immediately previous message plus the current one
  (`route.ts:154-158`) before tokenizing for BM25. It doesn't track *what
  topic* is active, so a 3rd or 4th follow-up in the same topic thread can
  lose the thread once the immediately-prior message isn't itself
  on-topic (e.g. after a "was that helpful" aside).
- `SYSTEM_PROMPT` currently instructs: "go into hyper detail... every step,
  requirement, and rule should be clearly listed and explained" — this
  produces long, exhaustive answers even for a single narrow question, which
  is the opposite of what's wanted.
- The knowledge-gate is binary: `score > 0.1` → answer from context,
  otherwise → fixed fallback. There's no middle tier for "some relevant
  context exists but doesn't fully answer this" (spec: strongly supported /
  partially supported / unsupported).

## 3. Open risk to validate before committing (do this first)

`@xenova/transformers` loads a real ONNX model at runtime. This app deploys
to Vercel serverless functions (no `vercel.json`, no `runtime`/`maxDuration`
override found in the codebase today — defaults apply). Loading a ~90 MB
model on a cold serverless invocation is a real latency/memory risk that
hasn't been tested in this environment.

**Step 0:** prototype loading the model and embedding one query inside a
Next.js Route Handler locally (`npm run dev`, then `vercel dev` if available)
and measure cold-start latency. If it's too slow/heavy for a serverless
function:
- **Fallback A:** call Gemini's embedding endpoint
  (`text-embedding-004` / `gemini-embedding-001` via the same REST pattern
  already used for `generateContent` in `route.ts`) instead of the local
  model — small per-request cost and latency, no cold-start model load, same
  `GEMINI_API_KEY` already configured.
- **Fallback B:** keep `@xenova/transformers` but only for the *offline*
  `generate-kb-embeddings.ts` script (embedding the ~380 KB chunks once,
  ahead of time, is cheap and has no latency constraint); embed the live user
  query with Fallback A's API call so nothing heavy loads inside the request
  path. This is likely the best default — offline corpus embedding stays
  free and local, only the tiny per-query embedding call goes over the
  network.

Report back which path works before continuing past step 0 — this changes
which files in §4 actually get touched.

## 4. Files to touch

- `scripts/chunk-markdown.ts` `[edit or reuse as-is]` — make this the single
  canonical chunker; used by both the embeddings generator and, if kept, any
  lexical fallback.
- `scripts/generate-kb-embeddings.ts` `[edit]` — switch to
  `chunk-markdown.ts`'s chunker (remove the duplicate inline one); re-run
  after 061 lands so `kb-embeddings.json` reflects the cleaned knowledge set
  (drops `implementation.md`, gains `claude-challenge-curriculum.md`,
  `testimonials.md`, `audience-faqs.md`, etc.).
- `src/data/kb-embeddings.json` `[regenerated]` — not hand-edited, produced
  by running the script above.
- `src/app/api/chat/route.ts` `[edit]`:
  - Replace the on-the-fly BM25 index with: load `kb-embeddings.json` once
    (module-scope cache, same pattern as today's `cachedKb`), embed the
    query per §3's chosen path, rank by cosine similarity.
  - Build the query embedding from a short rolling window (last 3–4
    messages, not just 2) so topic continuity survives an off-topic aside.
  - Add a confidence band instead of the binary gate: e.g. top score
    `> 0.55` → strong (answer normally), `0.35–0.55` → partial (answer only
    what's supported, explicitly say what isn't confirmed), `< 0.35` → none
    (fallback). Exact thresholds need tuning against real queries once
    semantic scores are visible — treat the numbers above as a starting
    point, not a spec.
  - Rewrite `SYSTEM_PROMPT`: concise, answers the asked question first, at
    most one natural follow-up suggestion at the end (not a menu dump),
    keep the Core Rule (context-only, no invented facts) and the
    fallback-message behavior, drop the "hyper detail / list every rule"
    instruction.
  - Keep the existing small-talk short-circuit from 061 as the first branch,
    unchanged — it must run before any embedding call, not after.

## 5. Server vs Client

Server-only — `route.ts` and the `scripts/` generator. No component in
`src/components/chatbot/` changes in this plan. (Session/UI gaps — e.g. no
delete-conversation control — are tracked separately; see roadmap note
below, not in scope here.)

**Design conformance:** N/A — no UI changes.

## 6. Steps

1. Do the §3 spike; confirm which embedding path (local model vs Gemini API)
   is used for live query-time embedding. Report back before continuing.
2. Consolidate chunking onto `chunk-markdown.ts`.
3. Update and re-run `generate-kb-embeddings.ts` against the *post-061*
   `knowledge/processed/`.
4. Rewire `route.ts` retrieval to cosine-similarity over
   `kb-embeddings.json`, with the widened rolling-window query.
5. Add the three-tier confidence band and update `SYSTEM_PROMPT` accordingly
   (strong/partial/none handling + concise-answer instruction).
6. Manually test the paraphrase set in §8 before calling this done.

## 7. Guardrails for Cursor (DO NOT)

- Do not skip the §3 spike and wire the local transformers model directly
  into the request path on faith — validate cold-start behavior first.
- Do not send the entire knowledge base to Gemini as a substitute for
  retrieval — the point is grounded, scoped context, not "give the model
  everything and hope."
- Do not remove the small-talk short-circuit from 061 or fold it into the
  new confidence bands — it stays a separate, earlier, zero-latency branch.
- Do not invent thresholds without testing — tune the confidence-band cutoffs
  against the actual query set in §8, don't ship the placeholder numbers
  unchecked.
- Do not touch `src/components/chatbot/*` UI files in this plan.
- Keep the Core Rule intact: even with semantic retrieval, the model answers
  only from retrieved context, never general knowledge.

## 8. Verification

- `npm run build` / `npx tsc --noEmit` pass.
- Paraphrase set (must retrieve correctly, per user request): "what is claude
  challenge," "tell me about that 60 day thing," "can second year join,"
  "what do i post on linkedin," "what accounts do i tag," "when is the next
  workshop," "was figma cursor already done," "how do i register," "where do
  i submit," "what happens after i register."
- Follow-up/topic-continuity set: ask about the Claude Challenge, then in
  sequence "who can join?", "how long is it?", "what do I submit?" — each
  must resolve against the Claude Challenge, not a generic/wrong program.
  Then "what about the AI Cohort?" followed by "how long is it?" — topic
  must switch and stay switched.
- Partial-confidence check: ask something adjacent to a documented fact but
  not fully covered — confirm the answer states what's known and flags what
  isn't, rather than either fabricating or blanket-refusing.
- Confirm answers are shorter/more direct than before on a single narrow
  question (no unsolicited multi-topic dumps).
- Confirm exactly which files changed against §4.

## 9. Commit message

```
Wire up semantic retrieval and multi-turn topic context for the ABTalks chatbot

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```
