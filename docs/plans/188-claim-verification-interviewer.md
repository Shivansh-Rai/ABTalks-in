# 188 — Claim-verification interviewer (human-like depth) + voice realism

**Status:** plan only. No code written.
**Owner paths:** `src/features/interview/**`, `src/components/interview/**`,
`src/app/api/interview/**` — all `@byteninjaa0` in `.github/CODEOWNERS`.
(Note: the CLAUDE.md ownership list still files "Mock Interviews" under Zainab.
CODEOWNERS is the enforced source and assigns these paths to me. Worth
reconciling one of the two, separately from this plan.)

---

## 1. Goal

Make the interviewer pursue a candidate's own **claims** the way a human does —
when someone says "I've contributed to open source", keep digging on that
specific claim through concrete verification checks until it is either
substantiated or visibly collapses — and report the verdict. Secondarily, close
the voice-latency gap and widen the on-screen presence so the room feels like a
conversation rather than a form with audio.

---

## 2. Current behavior

Read from source, 2026-10-10.

### The engine is organised around authored questions, not candidate claims

- `features/interview/platform/question-strategy.ts` builds questions from a
  frozen authored pack. `deepProbes` / `scaffoldProbes` are **authored per
  question**, written offline.
- `agent/depth.ts:decideLadderMove` escalates **only when the bank happens to
  carry a deeper rung** for that question (`activeQuestionView` looks up
  `question.deepProbes.find(p => p.level === depthLevel)`).
- `agent/types.ts:LLM_ACTIONS` deliberately excludes `ESCALATE` — the model
  reports what it saw, `depth.ts` decides what that earns. This invariant is
  correct and this plan keeps it.

**Consequence:** "I contributed to open source" is not a checklist item on any
authored question, so it has nowhere to live. `evidence.matchedEvidence` cannot
represent it, no authored rung exists for it, and the deepest the engine can go
is the single model-drafted probe at the end of `routeDecision` (the `STRONG`
branch, `policy.ts:480-497`). One probe, then `NEXT_QUESTION`.

### The follow-up budget cannot support a thread

`state.ts:87-90`:

```ts
export function followUpBudgetFor(question) {
  const requested = question?.maxFollowUps ?? MAX_FOLLOW_UPS_PER_QUESTION;
  return Math.max(0, Math.min(requested, MAX_FOLLOW_UPS_PER_QUESTION)); // = 2
}
```

Hard clamp at `MAX_FOLLOW_UPS_PER_QUESTION = 2` (`constants.ts:56`) — a pack
asking for more is silently clamped. Verifying a real-world claim takes 3–5
turns. The budget is also **per question** and resets at the question boundary,
so a thread can never be resumed.

### Memory forgets claims by construction

`memory.ts:buildInterviewMemory` emits one line per answered core question:
the **authored** evidence items matched, plus a 120-char quote. An unverifiable
assertion the candidate volunteered is not an authored item, so it survives only
as long as it happens to fall inside that 120-char quote or the 4-line
transcript window handed to the model (`llm/prompt.ts:buildAnalyzeUserMessage`).

### No verification state, so nothing can decide to stop — or to report

There is no `SUBSTANTIATED | COLLAPSED | UNRESOLVED` anywhere. The report
(`report.ts`, `report-assembly.ts`, `platform/report-assembly.ts`) has no
section that can say "claimed X, could not substantiate it", which is the single
most valuable output an interview like this produces.

### Voice is turn-based by deliberate design

`voice.ts` header states the position: Realtime was rejected because it "hands
the conversation to the model", bypassing the bank, the ladder and `policy.ts`.
The path today is: `MediaRecorder` → `POST /api/interview/stt` →
`submitInterviewAnswerAction` → graph (1 LLM call) → `POST /api/interview/tts` →
`<audio>` playback. Each hop is sequential and non-streamed, so there is a
multi-second dead gap after every answer, no barge-in, and no backchannel.

### Visuals already exist but are half-used

`components/ui/voice-powered-orb.tsx` is a WebGL orb driven by a level ref the
room already fills from its single analyser. `interview-room.tsx:1788` gates
`orbVisible` to the **candidate's turn only** — while the interviewer speaks,
the centre of the screen is empty. The orb already supports
`idle | speaking | listening | processing`; only two are used.

---

## 3. Files to touch

### Phase 1 — claim verification (the actual "be human" fix)

| Path | | Note |
|---|---|---|
| `src/features/interview/claims.ts` | `[new]` | Pure claim ledger: types, `registerClaims`, `rankClaims`, `resolveClaim`. No Prisma, no `server-only`. |
| `src/features/interview/verification.ts` | `[new]` | Pure. The authored-per-**claim-kind** check ladder + deterministic resolution rules. |
| `src/features/interview/constants.ts` | `[edit]` | Add `MAX_CLAIM_PROBES`, `MAX_CLAIM_PROBES_PER_INTERVIEW`, `MAX_CLAIM_RESUMPTIONS`, `CLAIM_SPECIFICITY_THRESHOLD`. Do **not** touch `MAX_FOLLOW_UPS_PER_QUESTION`. |
| `src/features/interview/types.ts` | `[edit]` | Add optional `claims?: ClaimLedger` and `pendingClaimId?: string \| null` to `InterviewState`. Optional = old persisted states stay readable. |
| `src/features/interview/agent/types.ts` | `[edit]` | Extend `interviewDecisionSchema` with `claims[]` and `specificitySignals`. Add `VERIFY_CLAIM` to `AGENT_ACTIONS` **only** — never to `LLM_ACTIONS`. |
| `src/features/interview/agent/llm/prompt.ts` | `[edit]` | Teach the model to *report* claims and specificity signals, and to phrase a supplied check. It still never chooses depth. |
| `src/features/interview/agent/policy.ts` | `[edit]` | New `VERIFY_CLAIM` branch in `routeDecision`, placed after the wrong/stuck guards and **before** `decideLadderMove`. |
| `src/features/interview/agent/nodes.ts` | `[edit]` | New `verifyClaim` node; `receiveAnswer` registers reported claims; `analyzeAnswer` passes the open claim + its next check into the prompt. |
| `src/features/interview/agent/graph.ts` | `[edit]` | Register `verifyClaim`, add the conditional edge from `routeResponse`. |
| `src/features/interview/state.ts` | `[edit]` | `advanceTurn` handles `VERIFY_CLAIM` (keeps the question on the floor, spends claim budget not follow-up budget) and carries `pendingClaimId` across a question boundary. |
| `src/features/interview/memory.ts` | `[edit]` | Emit a claim block: each claim, its state, which checks were asked and what came back. |
| `src/features/interview/report.ts` | `[edit]` | Compute a claims section from the ledger. Pure arithmetic, no model. |
| `src/features/interview/report-assembly.ts` | `[edit]` | Carry + validate the claims section. |
| `src/features/interview/platform/report-assembly.ts` | `[edit]` | Same, platform shape. |
| `src/features/interview/report-provider.ts` | `[edit]` | Narrative may cite claim ids; keep the existing "must cite real ids" filter. |
| `src/components/interview/cohort/report-view.tsx` | `[edit]` | Render "Claims and verification". Server Component. |
| `src/components/mock-interview/report-view.tsx` | `[edit]` | Same. |
| `src/features/interview/claims.test.ts` | `[new]` | Ledger + ranking. |
| `src/features/interview/verification.test.ts` | `[new]` | Resolution rules, every branch. |
| `scripts/verify-claim-verification.ts` | `[new]` | Scripted transcript: open-source claim, three dodges → `COLLAPSED`; same claim with specifics → `SUBSTANTIATED`. |

### Phase 2 — voice latency (no new transport)

| Path | | Note |
|---|---|---|
| `src/app/api/interview/tts/route.ts` | `[edit]` | Stream the audio body instead of buffering it. |
| `src/features/interview/voice.ts` | `[edit]` | Return a stream from `speakLine`; split the spoken line so the first sentence plays while the rest generates. |
| `src/components/interview/cohort/interview-room.tsx` | `[edit]` | Play streamed audio via MediaSource; fire STT on speech-end rather than on the button; a deterministic thinking cue while the graph runs. |
| `src/features/interview/room-lines.ts` | `[edit]` | Add the thinking-cue lines (authored, seeded — never model-written). |

### Phase 3 — visuals

| Path | | Note |
|---|---|---|
| `src/components/interview/cohort/interview-room.tsx` | `[edit]` | Orb visible on both turns; `speaking` driven by the TTS element's analyser; `processing` while the graph runs. |
| `src/components/interview/cohort/thread-indicator.tsx` | `[new]` | Client. Shows the claim currently being pursued. |
| `src/components/interview/cohort/transcript-rail.tsx` | `[new]` | Client. Live rolling transcript. |
| `src/components/interview/cohort/interview.css` | `[edit]` | Layout for the two new rails. |

---

## 4. Server vs Client

| Component | | Boundary note |
|---|---|---|
| `interview-room.tsx` | Client (`"use client"`, already) | Owns audio, analyser, turn machine. Receives only serialisable props. |
| `thread-indicator.tsx` | Client | Props: `{ claimText: string; checkLabel: string; probesSpent: number }` — strings and numbers only. **No icon components, no functions, no class instances.** |
| `transcript-rail.tsx` | Client | Props: `{ lines: { role: "interviewer" \| "candidate"; text: string }[] }`. Plain data. |
| `report-view.tsx` (both) | Server | Reads the stored report. The claims section must be plain JSON on the report document — not a class, not a Map. |
| `claims.ts`, `verification.ts` | Neither | Pure modules. No `server-only`, no Prisma, no `next/*`. Importable from a test and from a script. |
| `voice.ts` | Server only (`import "server-only"`, already) | Keep it. The stream must be returned as a `ReadableStream`, not a Node stream, so the route handler can pass it straight through. |

Nothing here is reachable from `middleware.ts`. No new `@/lib/*` import enters
the edge path.

---

## 5. Steps

### 5.1 `claims.ts` — the ledger

```ts
export type ClaimKind =
  | "EXPERIENCE"   // "I contributed to open source", "I led a team"
  | "OWNERSHIP"    // "I built the auth system"
  | "SCALE"        // "it handled a million requests a day"
  | "OUTCOME"      // "it cut latency by half"
  | "TECHNICAL";   // "we used a vector DB with HNSW"

export type ClaimVerificationState =
  | "UNVERIFIED" | "PROBING" | "SUBSTANTIATED" | "COLLAPSED" | "UNRESOLVED";

export type Claim = {
  id: string;                      // `claim:<n>`, assigned server-side, never by the model
  text: string;                    // the candidate's own words, verbatim, <= 240 chars
  kind: ClaimKind;
  state: ClaimVerificationState;
  firstSeenQuestionId: string;
  checksAsked: VerificationCheckId[];
  probesSpent: number;
  resumptions: number;
  specificHits: number;            // checks answered with concrete specifics
  genericHits: number;             // checks met with generality / can't-recall
  contradicted: boolean;
};

export type ClaimLedger = { claims: Claim[]; nextOrdinal: number };
```

1. `registerClaims(ledger, reported, questionId)` — append claims the model
   reported. **Dedupe** on normalised text (lowercase, strip punctuation,
   Jaccard over tokens >= 0.7) so the same claim restated does not become a
   second ledger row. Cap the ledger at 20 claims. Ids are assigned here, never
   accepted from the model.
2. `rankClaims(ledger)` — deterministic ordering of what is worth pursuing:
   - exclude anything not `UNVERIFIED | PROBING`
   - exclude `probesSpent >= MAX_CLAIM_PROBES`
   - sort by kind weight (`EXPERIENCE` 4, `OWNERSHIP` 4, `SCALE` 3, `OUTCOME` 3,
     `TECHNICAL` 2), then fewest `specificHits`, then ledger order
   - tie-break on ledger order so the same ledger always yields the same pick
3. `resolveClaim(claim, signals)` — pure, see 5.2.

### 5.2 `verification.ts` — the check ladder and the verdict

The ladder is authored **per claim kind**, not per question. That is what keeps
this comparable between candidates — every candidate claiming open-source work
faces the same four checks in the same order — while the *target* is their own
words. The model phrases the check against the claim text; it does not pick the
check.

```ts
export type VerificationCheckId =
  | "LOCATE" | "ARTIFACT" | "PROCESS" | "COUNTERFACTUAL" | "CROSS_CHECK";
```

`EXPERIENCE` ladder, which is the open-source case:

| Order | Check | What the model is told to ask for | Why it is hard to fake |
|---|---|---|---|
| 1 | `LOCATE` | which project, and what specifically they changed | a non-participant names nothing |
| 2 | `ARTIFACT` | where the change lives — PR, file, module, the review on it | requires having actually opened it |
| 3 | `PROCESS` | what the maintainer pushed back on, what CI caught, how long it took | the social texture of contributing cannot be guessed |
| 4 | `COUNTERFACTUAL` | what they would change now, what else in that repo they read | only someone who was inside the code has an opinion |
| 5 | `CROSS_CHECK` | fired only when `decision.evidence.flaggedIssues` includes `contradicts_earlier` |

`SCALE` / `OUTCOME` ladders instead run `LOCATE` → `ARTIFACT` (how it was
measured) → `COUNTERFACTUAL` (what it was before, what moved it).

`nextCheck(claim)` returns the first ladder entry not in `claim.checksAsked`,
or `null` when the ladder is exhausted.

**Resolution — deterministic, from signals the model reports, never from its
opinion.** The model returns `specificitySignals`:
`{ namedEntity, concreteNumber, toolOrFile, failureMode, firstPersonAction }`,
each a boolean about the answer it just read. `verification.ts` counts:

- an answer scoring `>= CLAIM_SPECIFICITY_THRESHOLD` (2 of 5) increments
  `specificHits`; below it increments `genericHits`
- `SUBSTANTIATED` when `specificHits >= 2` and not `contradicted`
- `COLLAPSED` when `genericHits >= 2`, or `contradicted` and `specificHits === 0`
- `UNRESOLVED` when `probesSpent >= MAX_CLAIM_PROBES`, or the ladder is
  exhausted, or the interview runs out of time
- otherwise stay `PROBING`

A `COLLAPSED` claim is a finding, **not** a penalty applied anywhere near the
score. It appears in the report as what it is: a claim the interview could not
substantiate. Scoring stays exactly as it is — no number in this plan changes
`scoring.ts`, `module-scoring.ts` or any weight.

### 5.3 Model contract (`agent/types.ts`, `llm/prompt.ts`)

Add to `interviewDecisionSchema`, every field defaulted and `.catch`-guarded in
the same spirit as `matchedEvidence`:

```ts
claims: z.array(z.object({
  text: z.string().max(240),
  kind: z.enum(CLAIM_KINDS),
})).max(4).catch([]).default([]),

specificitySignals: z.object({
  namedEntity:       z.boolean().default(false),
  concreteNumber:    z.boolean().default(false),
  toolOrFile:        z.boolean().default(false),
  failureMode:       z.boolean().default(false),
  firstPersonAction: z.boolean().default(false),
}).catch(DEFAULT_SIGNALS).default(DEFAULT_SIGNALS),
```

Prompt additions, in the existing voice of that file:

- A **Part 3** section: report any *checkable assertion about their own work* in
  `claims`, verbatim in their words, at most 4 per answer. Report it; do not
  pursue it, do not judge it.
- In the specificity block: these five booleans are about **what the answer
  contained**, not whether you believed it.
- A new input block `CLAIM UNDER VERIFICATION`, present only when the server
  supplies one, carrying the claim text and the next check with its intent. The
  model phrases **that** check in its own conversational words as
  `followUpQuestion`. It may not substitute a different question.
- A worked example, matching the file's existing style:

  > Candidate: "Yeah, I've contributed to a few open source projects."
  > Bad: "That's great. What technologies do you enjoy working with?"
  > Good: "Which project, and what was the change you made?"
  >
  > Candidate: "Mostly small fixes, documentation, that kind of thing."
  > Bad: "Nice, contributing to docs is really valuable."
  > Good: "Take one of them. Which repo was it, and what did you actually edit?"

- Explicit: never accuse, never say you doubt them, never say "I need proof".
  The move is always a smaller, more concrete question. If they say they do not
  remember, accept it in one word and ask the next check once.

### 5.4 Routing (`agent/policy.ts`)

In `routeDecision`, **after** the `noResponse` / `stuck` / `wantsRedirect` /
`wrong` guards and **before** `decideLadderMove`:

```
claim = rankClaims(state.claims)[0]
if claim and interviewClaimBudgetRemaining(state) > 0:
    check = nextCheck(claim)
    if check and speakable(decision.followUpQuestion) is non-empty:
        return { action: "VERIFY_CLAIM", claimId, checkId, probeText, rationale }
```

Ordering matters and is load-bearing:

- **after** `stuck` — someone who said "I don't know" must never be
  interrogated about a claim.
- **after** `wantsRedirect` — an off-topic turn is not a claim answer.
- **before** `decideLadderMove` — an open claim outranks a fresh authored rung,
  because that is the whole behaviour being bought. The authored ladder resumes
  the moment the claim resolves.
- If the model's drafted probe is empty, fall through to the existing ladder.
  No deterministic fallback text here: a canned verification probe asked to
  every candidate is exactly the questionnaire feel this plan removes.

### 5.5 Budgets (`constants.ts`, `state.ts`)

```ts
export const MAX_CLAIM_PROBES = 3;                 // per claim
export const MAX_CLAIM_PROBES_PER_INTERVIEW = 8;   // whole-interview ceiling
export const MAX_CLAIM_RESUMPTIONS = 1;            // per claim, across a question boundary
export const CLAIM_SPECIFICITY_THRESHOLD = 2;      // of 5 signals
```

`followUpBudgetFor` and `MAX_FOLLOW_UPS_PER_QUESTION` are **untouched**. Claim
probes are counted in their own fields on the ledger and against the interview
ceiling, so every existing budget test keeps passing and authored-question
comparability is unchanged.

`advanceTurn` gains a `VERIFY_CLAIM` case: the question stays on the floor,
`followUpsAsked` does **not** increment, `claim.probesSpent` does, and
`resolveClaim` runs on the next answer's signals.

**Resumption.** When a claim is still `PROBING` at a question boundary, carry
`pendingClaimId` forward. On the next turn, if it ranks first and
`resumptions < MAX_CLAIM_RESUMPTIONS`, the probe is prefixed by the existing
`bridge` mechanism ("Before we leave that — ..."), increments `resumptions`, and
is never resumed a second time. This is the one place a thread survives a
question boundary, and it is capped at once per claim so an interview cannot be
derailed.

### 5.6 Memory (`memory.ts`)

Append after the existing question lines:

```
CLAIMS THEY HAVE MADE AND WHERE EACH STANDS:
- claim:1 "I've contributed to a few open source projects" — EXPERIENCE,
  probing, asked: which project / where the change lives, answered in general
  terms both times
```

This is what makes the model stop re-asking a resolved claim and stop forgetting
an open one. It is assembled from the ledger with zero extra model calls, same
as today's memory, so latency and cost are unchanged. Keep the existing
`MAX_MEMORY_LINES` discipline: cap the claim block at 6 lines, most recent first,
and drop `SUBSTANTIATED` ones first since they need no further pursuit.

### 5.7 Report (`report.ts`, assembly, views)

New section, computed by pure arithmetic from the ledger:

```ts
claimsSection: {
  substantiated: ClaimSummary[];
  unsubstantiated: ClaimSummary[];   // COLLAPSED
  unresolved: ClaimSummary[];
}
// ClaimSummary = { id, text, kind, checksAsked: string[], probesSpent }
```

The narrative LLM call (`report-provider.ts`) may reference claim ids, under the
same filter that already forces it to cite real answered question ids —
`filterNarrative` must be extended to accept `claim:<n>` ids and to strip any it
cannot find in the ledger. The verdict words themselves ("could not
substantiate") come from the deterministic section, not from the model.

---

## 6. Guardrails for Cursor (DO NOT)

1. **DO NOT** add `ESCALATE` or `VERIFY_CLAIM` to `LLM_ACTIONS`. The model
   reports and phrases; it never chooses depth. `VERIFY_CLAIM` is produced by
   `routeDecision` alone.
2. **DO NOT** raise `MAX_FOLLOW_UPS_PER_QUESTION` or change
   `followUpBudgetFor`. Claim probes have their own counters for a reason.
3. **DO NOT** let a claim verdict touch any score. Nothing in `scoring.ts`,
   `module-scoring.ts`, `platform/scoring.ts` or any rubric weight changes.
   A collapsed claim is a reported finding.
4. **DO NOT** accept a claim id, verification state or probe count from the
   model or from the client. Ids are assigned in `claims.ts`; state lives in the
   server-held `state` JSON, which `GeneralInterview.state` already documents as
   never accepted from the client.
5. **DO NOT** add a deterministic canned verification probe. If the model
   drafted nothing usable, fall through to the existing ladder.
6. **DO NOT** write a claim-specific authored probe into a question pack. The
   ladder is per claim *kind*; that is what keeps candidates comparable.
7. **DO NOT** add a second LLM call per turn. Claims and signals ride on the
   existing `analyzeAnswer` response. One model call per turn is a hard
   constraint — the prompt budget is already charged against tokens-per-minute.
8. **DO NOT** create new abstraction files beyond `claims.ts`,
   `verification.ts`, `thread-indicator.tsx`, `transcript-rail.tsx` and the
   listed tests/script. Inline everything else.
9. **DO NOT** make any `InterviewState` field required. Every new field is
   optional and read with `?? `, because production rows predate this change.
10. **DO NOT** import `@/lib/*` into anything reachable from `middleware.ts`.
    Nothing here should be — verify, do not assume.
11. **DO NOT** touch `src/features/notification/**` or any locked notification
    path, even if a "claim collapsed" notification seems natural. It is not in
    scope.
12. **DO NOT** replace the turn-based voice transport in Phase 1 or 2.
    Realtime is Phase 3 and is a separate decision.
13. **DO NOT** pass functions, icon components or class instances from a Server
    Component into `thread-indicator.tsx` or `transcript-rail.tsx`.
14. **DO NOT** use `console.error`. `lib/logger.ts` only.
15. **DO NOT** return full Prisma records. Every query keeps its `select`.

---

## 7. DB safety

**No migration.** The ledger lives inside `GeneralInterview.state`, already a
`Json` column documented as the authoritative server-held runtime state, and
inside the stored report document. The new `InterviewState` fields are optional,
so every existing row deserialises unchanged and an interview in flight at
deploy time simply has an empty ledger.

Before starting: commit checkpoint, and record the commit hash in the PR. No
Neon branch snapshot is needed, since no schema or data is written by this
change — but if step 5.7 ends up needing a stored-report backfill, stop and
re-plan that as its own step with a snapshot.

---

## 8. Verification

**Automated**

```bash
npx tsc --noEmit
npm run build
npx vitest run src/features/interview
npx tsx scripts/verify-claim-verification.ts
npx tsx scripts/verify-interview-turntaking.ts
npx tsx scripts/verify-interview-adaptive.ts
npx tsx scripts/verify-interview-conversation.ts
```

The three existing `verify-interview-*` scripts must pass **unchanged** — that
is the proof the authored ladder, the budgets and turn-taking were not
disturbed.

**The scripted case that defines done** (`scripts/verify-claim-verification.ts`,
mock LLM provider so it is deterministic and free):

| Turn | Candidate says | Expected engine move |
|---|---|---|
| 1 | "I've contributed to a few open source projects." | registers `claim:1` EXPERIENCE; `VERIFY_CLAIM` / `LOCATE` |
| 2 | "Mostly small stuff, documentation and fixes." | 0 specificity signals → `genericHits` 1; `VERIFY_CLAIM` / `ARTIFACT` |
| 3 | "I don't really remember which repos." | `genericHits` 2 → `COLLAPSED`; moves on without comment |
| — | report | claim appears under `unsubstantiated`, with both checks listed |

And the honest mirror of it: "I fixed a timezone bug in the date parser in
`dateutil` — PR 1243, the maintainer made me add a DST test case" → 4 signals →
`specificHits` 1, `ARTIFACT` asked, a second concrete answer →
`SUBSTANTIATED`, and the engine returns to the authored ladder.

**Manual**

1. `/mock-interviews` → start a domain → in any answer, volunteer "I've
   contributed to open source" and then stay vague. Expect three increasingly
   concrete questions, no accusation, then a clean move on.
2. Repeat with specifics. Expect it to stop digging after two concrete answers
   and return to the pack.
3. Say "I don't know" immediately after making a claim. Expect **no**
   verification probe — the stuck guard must win.
4. Go off-topic right after a claim. Expect a redirect, not a probe.
5. Open the report. Claims section present, verdicts match the transcript.

**Exactly these files should have changed** — the Phase 1 table in §3 and
nothing else.

---

## 9. Commit message

```
feat(interview): pursue candidate claims to a verification verdict

The engine could only go deeper where a question pack happened to carry an
authored rung, so a volunteered claim like "I've contributed to open source"
got at most one model-drafted probe and then the next item on the list.

Adds a claim ledger on the interview state and an authored-per-claim-kind
verification ladder (locate, artifact, process, counterfactual). The model
reports claims and specificity signals; policy.ts decides which check comes
next and verification.ts decides when a claim is substantiated, collapsed or
left unresolved. One model call per turn, no score changes, no migration.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## 10. Phase 2 / 3 design notes (not executable yet)

### Phase 2 — latency, keeping the turn-based transport

The gap after every answer is four sequential hops. Measured targets:

| Change | Where | Saves |
|---|---|---|
| Fire STT on VAD speech-end, not on the submit button | `interview-room.tsx` + `turn-state.ts` | the candidate's own reaction time, ~500ms+ |
| Stream the TTS response body | `api/interview/tts/route.ts`, `voice.ts` | first audio at the first chunk instead of the last, often >1s |
| Speak only the first sentence from the first chunk, generate the rest while it plays | `voice.ts` split + room MediaSource | perceptually most of the remaining gap |
| An authored, seeded thinking cue ("mm, okay —") played the instant the answer uploads | `room-lines.ts` | covers the graph call itself |
| Keep-warm on the LLM provider | `llm/registry.ts` | cold-start spikes |

This is where most of the "feels like a machine" impression actually comes
from, and none of it requires giving the model the conversation.

### Phase 3 — realtime duplex, if we want true barge-in

The only way to have Pluto-grade turn feel **and** keep this an assessment is to
run a realtime model as a **speech transport only**:

- it transcribes and it speaks, with barge-in and overlap
- every line it speaks is **supplied by the server** — it is forbidden to
  generate a question, and a server-side guard drops any audio whose transcript
  does not match a line the server issued
- the assessment decision still runs through `submitAnswer` → graph → `policy.ts`

That contradicts the position written into `voice.ts`, deliberately and
narrowly: Realtime is rejected there as a *brain*, and this uses it only as a
*mouth and ears*. It is a real build (new session endpoint, ephemeral token
minting, a line-matching guard, a fallback to the turn-based path) and should be
its own plan behind a feature flag, not a step in this one.

### Phase 3 visuals

The orb already exists and already supports four modes; `interview-room.tsx`
uses two and hides it entirely while the interviewer talks, which is why the
room goes dead mid-question. Minimum worthwhile set:

- orb visible on **both** turns — `speaking` driven by an analyser on the TTS
  audio element, `listening` by the existing candidate analyser, `processing`
  while the graph runs
- a thread indicator naming what is being pursued, which is also the honest UI
  for the Phase 1 behaviour: the candidate can see the interview is on their
  open-source claim and not lost
- a live transcript rail, since reading the question back is the single most
  requested affordance in a voice interview
- a section spine showing pack progress

Design ownership for all of this is Shallika's (UI/UX, visual QA) — this plan
specifies behaviour and data, not appearance.
