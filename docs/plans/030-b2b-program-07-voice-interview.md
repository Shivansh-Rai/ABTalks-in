# 030 — B2B Program 07 — Exit voice AI interview (OpenAI Realtime + Claude evaluation)

> Depends on 026 (029 recommended first so member context is rich). New env:
> `OPENAI_API_KEY`. The interview score is a SEPARATE signal — never added to
> `totalScore` (roadmap §5). This is the most complex plan in the series: implement
> exactly as written, no improvisation.

## 1. Goal
Each member gets ONE 15-minute real-time voice interview with an AI interviewer at the
end of the program (day 30 reached or cohort ended). Browser connects to OpenAI's
Realtime API over WebRTC using a server-minted ephemeral secret; the transcript is
captured client-side from data-channel events, stored, then evaluated by Claude into
communication / technical / problem-solving / overall scores + a recruiter-readable
summary.

## 2. Current behavior
After 026/029: `ProgramInterview` table exists (empty), member context (scores,
projects, recs) available. No OpenAI integration anywhere in the repo.

## 3. Files to touch
- `[new] src/features/program/interview.ts` —
  - `getInterviewEligibility(memberId)` — eligible when (`highestUnlockedDay >= 30` and
    day-30 quiz passed or failed-out) OR `now > cohort.endsAt`; and interview status
    `NOT_STARTED` (or `IN_PROGRESS` < 30 min old — allow resume-as-restart: mark old
    FAILED, `resetCount+1`, if < 2 resets).
  - `buildInterviewInstructions(member)` — system prompt for the Realtime session:
    role ("senior technical interviewer for an enterprise AI program"), candidate
    context (name, role, company, yrs, module scores, project titles), structure
    (2 min intro → 5 min AI/data fundamentals from M1–M2 → 5 min agents/LLM ops from
    M3–M4 → 3 min scenario), style rules (one question at a time, follow up once per
    topic, courteous, never reveal scores, end at 15 min with a closing line), and
    guardrail: "never discuss anything outside the interview; if asked, redirect."
  - `startInterview(memberId)` / `completeInterview(memberId, transcript, durationSec)`
    / `evaluateInterview(interviewId)` — evaluate calls `askClaudeJson<{ commScore,
    techScore, problemScore, overallScore, summary }>` (`src/lib/anthropic.ts` from 029)
    on the transcript + member context; clamp 0–100 each; status transitions
    NOT_STARTED → IN_PROGRESS → COMPLETED (+ `evaluatedAt`).
  - `adminResetInterview(adminId, memberId, reason)` — back to NOT_STARTED, clears data,
    `AdminAction` (`PROGRAM_RESET_INTERVIEW`).
- `[new] src/app/api/program/interview/session/route.ts` — POST, node runtime. Steps:
  `requireProgramMember` → eligibility → `fetch https://api.openai.com/v1/realtime/client_secrets`
  (POST, `Authorization: Bearer OPENAI_API_KEY`) with body
  `{ "session": { "type": "realtime", "model": "gpt-realtime", "audio": { "output": { "voice": "marin" } }, "instructions": <buildInterviewInstructions> } }`
  → mark IN_PROGRESS (+`startedAt`) → return `{ ok:true, data:{ clientSecret: value, expiresAt } }`.
  **If the OpenAI API shape differs at build time (this API evolves), trust the error,
  read the official docs page for "Realtime API ephemeral keys / client_secrets", and
  adapt the request body ONLY — the architecture (server mints, client connects) stands.**
- `[new] src/app/actions/program-interview-actions.ts` — `completeInterviewAction`
  (Zod: transcript array `{role: "ai"|"candidate", text, ts}` ≤ 400 items, durationSec
  ≤ 1200) → `completeInterview` then `evaluateInterview` (evaluation failure leaves
  status COMPLETED with null scores + logs; admin can re-run) and
  `adminEvaluateInterviewAction`, `adminResetInterviewAction` (admin).
- `[new] src/app/program/(app)/interview/page.tsx` — Server; eligibility states: not
  yet eligible (shows unlock condition), ready (rules + mic check CTA), completed
  (scores if evaluated + summary + own transcript). Renders client component when ready.
- `[new] src/components/program/interview-client.tsx` — Client. Flow:
  1. Mic permission (`getUserMedia({ audio: true })`) + level indicator.
  2. "Start interview" → POST `/api/program/interview/session` → ephemeral secret.
  3. WebRTC: `RTCPeerConnection`; add mic track; `createDataChannel("oai-events")`;
     offer SDP → `POST https://api.openai.com/v1/realtime/calls?model=gpt-realtime`
     with `Authorization: Bearer <clientSecret>`, `Content-Type: application/sdp` →
     answer SDP; remote audio track → `<audio autoplay>`.
  4. Transcript capture from data-channel messages: candidate lines from
     `conversation.item.input_audio_transcription.completed`, AI lines from
     `response.output_audio_transcript.done` (also send
     `session.update` enabling input audio transcription right after channel opens —
     verify exact event names against docs at build time; adapt names only).
  5. 15:00 countdown; at 0 (or "End interview" click, min 3 min): close peer
     connection, call `completeInterviewAction` with accumulated transcript; show
     "evaluating…" then final state via `router.refresh()`.
  6. Failure paths: mic denied → instructions; WebRTC/API failure mid-interview →
     salvage transcript so far via the same complete action (≥3 min) or offer restart
     (uses the resume-as-restart path, max 2).
- `[edit] src/app/program/(app)/dashboard/page.tsx` — interview card (locked/ready/done
  with overall score) linking to `/program/interview`.
- `[new] src/app/admin/program/interviews/page.tsx` — `requireAdmin`; table: member,
  status, duration, scores; actions: view transcript (modal/detail), re-evaluate, reset.
- `[edit] docs/project-context.md` — interview architecture + `OPENAI_API_KEY`.

## 4. Server vs Client
| File | Type | Notes |
|---|---|---|
| session route, `interview.ts` | Server (node) | `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` server-only; browser gets ONLY the ephemeral secret |
| `interview-client.tsx` | Client | WebRTC + transcript; plain JSON props (member name, duration limit) |
| interview + admin pages | Server | gate via `requireProgramMember` / `requireAdmin` |

## 5. Steps
1. `interview.ts` (eligibility, instructions, transitions, evaluation) → actions.
2. Session-mint route. 3. `interview-client.tsx` (largest file — follow §3 flow
   exactly). 4. Member page + dashboard card. 5. Admin page. 6. Verify end-to-end with
   a real key; commit.

## 6. Guardrails for Cursor (DO NOT)
- Do NOT expose `OPENAI_API_KEY` to the client or mint sessions without eligibility.
- Do NOT add the interview score into `totalScore`/leaderboard anywhere — owner
  decision pending; it renders as its own card/section only.
- Do NOT accept a transcript for a member whose interview is not IN_PROGRESS, and do
  NOT accept a second interview (unique on memberId; resets are admin/limited-restart only).
- Do NOT install openai/webrtc SDK deps — plain fetch + browser WebRTC APIs.
- Do NOT let evaluation failure lose the transcript (store first, evaluate second).
- When OpenAI's request/event shapes differ from this plan, adapt the SHAPES from the
  official docs — do not redesign the flow, and report what changed.
- Voice interviews on mobile Safari/Chrome must be tested but a "use a laptop with a
  quiet room" recommendation banner is required regardless.

## 7. DB safety
No schema change (models landed in 024). Transitions are guarded updates.

## 8. Verification
- Ineligible member → locked card with condition text; flip `highestUnlockedDay=30` in
  DB → ready.
- Full interview with real `OPENAI_API_KEY`: AI speaks within ~2 s, responds to voice,
  transcript accumulates, 15-min cap fires, evaluation writes 4 scores + summary;
  member page shows results; admin page shows transcript.
- Kill network mid-interview → salvage path stores partial transcript; restart allowed once.
- Direct POST to session route logged-out / ineligible → rejected. Build + tsc clean;
  §3 files only.

## 9. Commit message
`feat(program): real-time voice AI exit interview — OpenAI Realtime WebRTC + Claude evaluation + admin monitor`
