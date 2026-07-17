# 034 — B2B Program 11 — Voice interview on Azure OpenAI (adapter)

> Amends plan 030's implementation. Owner has Azure OpenAI keys and no first-party
> OpenAI account — switch the Realtime voice interview from `api.openai.com` to the
> owner's Azure OpenAI resource. The architecture (server mints ephemeral secret →
> browser WebRTC → transcript → Claude evaluation) is UNCHANGED. Only endpoints,
> auth headers, and naming change. Claude evaluation is untouched by this plan.

## 1. Goal
The `/program/interview` flow works against Azure OpenAI's Realtime API (WebRTC)
using the owner's Azure resource, keys, and a realtime model deployment.

## 2. Current behavior
`src/app/api/program/interview/session/route.ts` POSTs to
`https://api.openai.com/v1/realtime/client_secrets` with `Authorization: Bearer
$OPENAI_API_KEY`; `src/components/program/interview-client.tsx` exchanges SDP with
`https://api.openai.com/v1/realtime/calls?model=gpt-realtime` using the ephemeral
secret. (Verify exact current file paths/shapes before editing.)

## 3. Owner prerequisites (block on these — report if missing)
1. Azure OpenAI resource in a Realtime-supported region (East US 2 or Sweden Central
   at time of writing — verify in Azure docs).
2. A **deployment** of a realtime-capable model (`gpt-realtime` or
   `gpt-4o-realtime-preview`) created in the Azure AI Foundry portal; note the
   deployment name.

## 4. Files to touch
- `[edit] src/app/api/program/interview/session/route.ts` — mint the ephemeral key
  from Azure instead:
  - URL: `https://{AZURE_OPENAI_RESOURCE}.openai.azure.com/openai/realtimeapi/sessions?api-version={AZURE_OPENAI_API_VERSION}`
  - Headers: `api-key: {AZURE_OPENAI_KEY}` (NOT Bearer), `Content-Type: application/json`
  - Body: same session config as before, but `model` = `{AZURE_OPENAI_REALTIME_DEPLOYMENT}`
  - Response: read `client_secret.value` (+ expiry) — same contract to the client.
  - **Azure preview APIs drift**: if the request 404s/400s at build time, WebFetch the
    official "Azure OpenAI Realtime API via WebRTC" doc, adapt URL/api-version/body
    shape ONLY, and report what changed. Do not redesign the flow.
- `[edit] src/components/program/interview-client.tsx` — SDP exchange target becomes
  the Azure WebRTC regional endpoint:
  `https://{AZURE_REALTIME_REGION}.realtimeapi-preview.ai.azure.com/v1/realtimertc?model={deployment}`
  with `Authorization: Bearer <ephemeral secret>` and `Content-Type: application/sdp`.
  Pass the regional URL + deployment to the client as plain string props from the
  server (never the Azure key). Data-channel event names (transcription events,
  `session.update`) are the same OpenAI Realtime protocol — verify names against the
  doc if transcripts stop arriving, adapt names only.
- `[edit] docs/project-context.md` — env var table swap for the interview feature.

## 5. New env vars (replace `OPENAI_API_KEY`)
```
AZURE_OPENAI_KEY=...                      # server-only
AZURE_OPENAI_RESOURCE=<resource-name>     # e.g. abtalks-openai → {resource}.openai.azure.com
AZURE_OPENAI_REALTIME_DEPLOYMENT=<name>   # deployment name from Foundry portal
AZURE_OPENAI_API_VERSION=2025-04-01-preview   # verify current version in docs
AZURE_REALTIME_REGION=eastus2             # region of the WebRTC endpoint
```
Keep the code tolerant: if `OPENAI_API_KEY` is set and Azure vars are not, fall back
to the original first-party OpenAI path (a single `useAzure` boolean derived from
`AZURE_OPENAI_KEY` presence — no new abstraction files).

## 6. Guardrails for Cursor (DO NOT)
- Do NOT expose `AZURE_OPENAI_KEY` to the client — browser gets only the ephemeral
  secret and the regional WebRTC URL string.
- Do NOT change eligibility, transcript storage, evaluation (Claude), or admin
  monitor code — this plan is transport-only.
- Do NOT add the openai or azure SDKs — plain fetch, as before.
- Keep the OpenAI-direct code path working (fallback per §5).

## 7. DB safety
No schema or data changes.

## 8. Verification
- With Azure vars set (and `OPENAI_API_KEY` unset): full interview runs — AI speaks,
  responds, transcript accumulates, 15-min cap, evaluation scores written.
- Session-mint route rejects logged-out/ineligible callers exactly as before.
- Network tab: no `api.openai.com` calls; no `api-key` header visible from the browser.
- With Azure vars absent and `OPENAI_API_KEY` set: original path still works.
- Build + tsc clean; only §4 files changed.

## 9. Commit message
`feat(program): Azure OpenAI adapter for the realtime voice interview (transport-only, OpenAI-direct fallback kept)`
