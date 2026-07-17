# 026 — B2B Program 03 — The Workbench: runners, CI-check harness, day shell

> Depends on 025. Read roadmap `023` v2 §6b (mission types) and §10 (experience bar).
> This plan builds the interactive infrastructure; plan 027 wires missions onto it.

## 1. Goal
The signature interactive surface of the program: an in-browser Workbench with real
code execution (Python via Pyodide, SQL via sql.js, JS via sandboxed Worker, YAML
validation), a CI-style check harness that renders verification results as animated
✓/✗ check lines, the day-page shell (mission brief pane + workbench pane), and the
curriculum page. Plus the server-side Anthropic client (needed by 027's PROMPT_FORGE).

## 2. Current behavior
After 025: members enrolled, `highestUnlockedDay = 1`. `ProgramDay/Module` tables exist
(seeded with placeholder content until the content phase). No day UI, no runners.

## 3. Files to touch
**Runners (client utils — real execution, zero server cost)**
- `[new] src/components/program/workbench/runners/python-runner.ts` — lazy singleton
  Pyodide from official CDN (dynamic script inject). `run(code): Promise<{stdout, stderr}>`.
  Main-thread with busy state in v1 (comment the tradeoff).
- `[new] src/components/program/workbench/runners/sql-runner.ts` — lazy sql.js (WASM);
  `run(sql, setupSql?)` → in-memory DB, returns `{ columns, rows }` + ASCII-table string.
- `[new] src/components/program/workbench/runners/js-runner.ts` — blob Worker, captured
  `console.log`, hard `terminate()` at 5 s. Never main-thread eval.
- `[new] src/components/program/workbench/runners/yaml-runner.ts` — `js-yaml` parse →
  structure dump or error. (`js-yaml` + `@types/js-yaml`: the ONLY new deps.)

**Workbench UI (client)**
- `[new] src/components/program/workbench/workbench.tsx` — orchestrator: three-pane
  layout (brief | editor | console/checks), responsive (stacked on mobile with sticky
  pane tabs), monospace `<textarea>` editor with tab-key + Ctrl/Cmd+Enter run (NO
  Monaco/CodeMirror), Run / Reset buttons, terminal-styled output pane. Props: plain
  JSON (`language`, `starterCode`, `assets`, `visibleChecks` labels) + render-prop-free
  callbacks via internal state only.
- `[new] src/components/program/workbench/check-list.tsx` — the CI check panel:
  renders `{check, passed, detail}[]` as staggered-animated lines (framer-motion,
  150 ms stagger, ✓ emerald / ✗ rose, expandable detail row). States: idle, running
  (spinner per line), verdict. Respect `prefers-reduced-motion`.
- `[new] src/components/program/workbench/asset-viewer.tsx` — renders `assetsJson`
  entries: CSV preview table (first 20 rows), code/file blocks with copy button,
  markdown spec blocks.

**Day shell + curriculum (server pages)**
- `[new] src/features/program/days.ts` — `getDayShell(memberId, dayNumber)`: day row
  WITHOUT `missionSpec` (explicit `select` — roadmap §9.8), member's day state
  (LOCKED/AVAILABLE/PASSED/SKIPPED derived from submissions + highestUnlockedDay;
  full gating logic arrives in 027 — here a `getMemberDayStates(memberId)` returning
  the list for curriculum), videos for the day.
- `[new] src/app/program/(app)/day/[day]/page.tsx` — Server; validate 1..30 + unlocked
  else redirect `/program/curriculum`; renders: mission header (type badge, points,
  estimated time, module color), `briefMd` via react-markdown, objectives/tools chips,
  the day's 2 videos (lite-embed pattern: thumbnail → click → iframe), and the
  Workbench pane with a **placeholder mission panel** ("mission engine arrives in 027" —
  Run works, Submit disabled with a "coming online" state).
- `[new] src/app/program/(app)/curriculum/page.tsx` — Server; the campaign map: 4
  module sections (color-coded) → 30 day cards with state icons (lock / available
  pulse / passed check / skipped), mission-type badges, connecting path line
  (CSS, subtle). Locked days show title + type only.
- `[new] src/lib/anthropic.ts` — server-only Claude client (moved here from old plan
  029 spec): `askClaudeJson<T>({system, user, maxTokens})` via plain `fetch` to
  `/v1/messages` (headers `x-api-key`, `anthropic-version: 2023-06-01`), model
  `PROGRAM_ANTHROPIC_MODEL ?? "claude-sonnet-5"`, parses first JSON object, try/catch
  + logger, no retries, `server-only` import. (Unused until 027 — that is fine.)
- `[edit] docs/project-context.md` — workbench shipped (+ js-yaml dep, CDN runtimes).

## 4. Server vs Client
| File | Type | Notes |
|---|---|---|
| `day/[day]/page.tsx`, `curriculum/page.tsx` | Server | pass ONLY client-safe fields; `missionSpec` never selected |
| workbench components + runners | Client | all execution client-side; runtimes lazy-loaded on first Run, never in initial bundle |
| `days.ts`, `anthropic.ts` | server | explicit `select` excluding missionSpec |

## 5. Steps
1. Add `js-yaml`. 2. Runners (each self-contained, ~40–80 lines, shared shape
   `run(code, setup?) → {output, error?}` — no abstraction layer file).
3. `check-list.tsx` → `asset-viewer.tsx` → `workbench.tsx`.
4. `days.ts` + curriculum page. 5. Day page with placeholder mission panel.
6. `anthropic.ts`. 7. Verify (§8), context doc, commit.

## 6. Guardrails for Cursor (DO NOT)
- Do NOT add Monaco/CodeMirror or any editor dep — styled textarea only.
- Do NOT execute user code server-side or `eval` on the main thread.
- Do NOT select or serialize `missionSpec` anywhere in this plan — grep the diff for
  `missionSpec` before finishing; it may appear ONLY in the Prisma schema and (from
  027 on) server-side verification code.
- Do NOT block page load on Pyodide (~7 MB) — lazy per language, loading state, mobile
  size warning before first Python load.
- Do NOT build submission/scoring/gating — that is 027. Submit stays disabled.
- Do NOT touch student challenge components; the lite-YouTube embed is written fresh in
  `src/components/program/` (pattern-reference `components/challenge/day-page.tsx` only).
- Animations: framer-motion only, 150–250 ms, respect `prefers-reduced-motion`.

## 7. DB safety
No schema change. Content seed (placeholder days) upserts program tables only.

## 8. Verification
- `/program/curriculum`: campaign map renders 4 modules × days with states; locked days
  leak nothing beyond title/type.
- Day 1 page: brief renders, assets preview, videos embed on click; Python `print` runs
  after lazy load; SQL returns a table; JS infinite loop killed at 5 s (page alive);
  YAML error shown cleanly. Ctrl/Cmd+Enter runs.
- Check-list component demo state animates ✓/✗ correctly; reduced-motion disables stagger.
- Mobile 390px: panes stack with tabs; Python shows size warning.
- View-source/network tab on the day page: `missionSpec` absent from all payloads.
- Build + tsc clean; only §3 files changed.

## 9. Commit message
`feat(program): interactive Workbench — in-browser runners, CI-style check harness, day shell + curriculum map`
