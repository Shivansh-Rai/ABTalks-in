# 036 — AI Cohort migration: 31-day healthcare chatbot curriculum, launch runbook

> **LAUNCH IS TOMORROW.** This plan migrates the implemented B2B program
> (feature/b2b) to the new "AI Cohort" — a 31-day, 8-phase cumulative project
> (enterprise healthcare coverage chatbot, built locally in VS Code, verified via
> git artifacts + AI review). Owner decisions locked: audience = students/freshers;
> Streamlit frontend; checkpoints at Days 10/20/27/31; laptop ≥8 GB RAM entry
> requirement; plagiarism risk accepted; in-browser Workbench/Arena/JupyterLite
> DROPPED; name = **AI Cohort**; engine (gating, scoring, skip tokens, commits,
> recruiter portal) unchanged.
>
> Sections tagged **[LAUNCH]** must be done tonight. **[WEEK-1]** can land while
> the cohort runs (members are gated — they can't outrun content).
> Content JSONs are authored by the architect (Claude), NEVER by Cursor.

## 0. [LAUNCH] Branch reconciliation — the code lives on `feature/b2b`
Master has 28 unrelated commits (sidebar, challenge content, UI fixes) since the
branches diverged; production deploys from master. Schema is untouched on master
(verified) — conflicts will be UI-level.
1. `git checkout feature/b2b && git merge master`. Expected conflict zones:
   root `middleware.ts`, `src/app/login/page.tsx`, admin sidebar/nav components
   (master redesigned the sidebar; b2b added a "Program" nav item), shared layout/
   footer components, `package.json`. Resolution rule: keep master's UI work AND
   the b2b additions — b2b's changes are additive (extra protected paths, extra
   nav links, extra redirect exception). Never drop the login-page `/program` /
   `/talent` redirect exception or the middleware path entries.
2. `npx tsc --noEmit` + `npm run build` must pass on the merged branch.
3. After §1–§6 below are done and verified locally, open PR `feature/b2b → master`
   and merge — Vercel deploys master.

## 1. [LAUNCH] Drop the in-browser execution surfaces (owner decision)
- Delete `public/lab/**`, `.jupyterlite.doit.db`, `docs/plans/035-b2b-program-12-project-lab.md`,
  and any `notebook-lab` / launcher components created for plan 035.
- Remove the Arena: `src/app/program/(app)/arena/`, `program-arena-actions.ts`,
  arena nav item, `/program/arena` from `middleware.ts` protectedPaths.
- Day-page panels: DATA_ROOM renders brief + answer form only (no code editor);
  SHIP_IT renders brief + repo instructions + "Verify my repo" (no editor).
  Remove now-unused workbench editor/runner components (`runners/*`, editor pane)
  — keep `check-list.tsx` (CI verdict rendering is still the signature UI).
- CODE_SPRINT/PROMPT_FORGE code paths stay (unused by content; do not delete the
  verify functions).

## 2. [LAUNCH] 31 days, 8 phases, 1020 points
- Add `PROGRAM_TOTAL_DAYS = 31` in the program constants/feature module; grep and
  replace every hardcoded `30` day-bound (unlock clamp, day param validation 1..30,
  "Day X/30" copy, commit-points cap → `31 × 5 = 155`). New max total = **1020**
  (372 missions + 93 concept + 155 commits + 400 checkpoints); update any "/1000" copy.
- Phases: content seeds **8 `ProgramModule` rows** (Phase 0 Env/Tooling d1–3;
  1 Data d4–6; 2 Embeddings/Vector d7–10; 3 LLM/Prompting/Fine-tune d11–15;
  4 App Build d16–20; 5 Agentic+MCP d21–24; 6 Governance/Eval d25–27;
  7 Docker/K8s/Prod d28–31). Grep UI for 4-module assumptions (fixed color arrays,
  grids, "M1–M4" copy) and make them data-driven from the seeded modules.
- Checkpoints (BOSS_BUILD) move to days **10, 20, 27, 31** via content
  `isProjectDay`. Checkpoint index (1–4 → `ProgramProject.moduleNumber`) must come
  from `missionSpec.checkpointNumber`, not from a phase/day formula — inspect the
  implemented BOSS_BUILD verify + grading rubric lookup and adjust to read it.

## 3. [LAUNCH] Branding + audience copy — "AI Cohort"
- Routes stay `/program` and `/talent` (do NOT rename routes the night before
  launch; display name only). Note for owner: `/ai-cohort-register` (talent-hunt
  funnel) is a different, existing product — verify no copy cross-links confuse them.
- Landing page rewrite: name **AI Cohort**; audience students & recent grads; the
  promise: "build and deploy a production-grade enterprise AI chatbot in 31 days —
  RAG, agents, MCP, guardrails, Docker, Kubernetes — and get in front of
  recruiters"; 8-phase overview; **requirements box**: laptop with ≥8 GB RAM,
  ~2–4 hrs/day, GitHub account, everything else free (Ollama/Groq/Chroma — no paid
  keys needed); how-it-works (apply → assessment → 31 days → interview → recruiter
  visibility). Program shell header/metadata → "AI Cohort".
- Apply form: add required attestation checkbox — "I have a laptop with at least
  8 GB RAM available for this program" (Zod `literal(true)`; NOT persisted — no
  schema change).

## 4. [LAUNCH] Entry assessment stays, content lightens
No code change: sections remain APTITUDE + TECHNICAL; the re-seeded bank makes
TECHNICAL = basic programming logic (variables, loops, simple SQL/JSON reading)
instead of deep engineering. Thresholds unchanged (≥12/20 total AND ≥5/10 technical).

## 5. [LAUNCH] Content seed — pack A only (architect delivers the JSONs)
Cursor's job here is ONLY to run `npm run db:seed:program` after the architect
commits pack A, and to verify counts. Pack A = `modules.json` (8 phases),
`entry-questions.json` (new bank), `days.json` days 1–3 complete (briefs from the
owner's program doc, missionSpecs, per-day videos), `concept-questions.json` days
1–3. Day-type mapping for packs A–C: days 1–2 **DATA_ROOM** (factual setup answers,
e.g. "what port does Ollama serve on?"); day 3 onward mostly **SHIP_IT** (repo
artifact checks: `chatbot.py`, FastAPI `main.py` + `/health`, `coverage.db` or
`structured_queries.md`, `knowledge_base.jsonl`, `Dockerfile`, k8s manifests…);
days 10/20/27/31 **BOSS_BUILD**. Frontend checks target **Streamlit** (`app.py`),
per owner. Old 4-module content rows get clean-replaced by the seed's upserts.

## 6. [LAUNCH] Deploy + cohort ops (owner + Cursor together)
1. Vercel env vars set on production: `ENABLE_PROGRAM=true`, `CRON_SECRET`
   (strong random), `GITHUB_API_TOKEN`. (`ANTHROPIC_API_KEY` needed before the
   first checkpoint grading ~Day 10 and for AI Mentor — not launch-blocking but
   AI features must degrade gracefully without it; verify no crashes.)
2. Merge PR → confirm Vercel build green, cron registered.
3. Admin → `/admin/program`: create cohort **"AI Cohort — Batch 1"**, startsAt =
   launch day, endsAt = startsAt + 38 days (31 + 1 week grace), capacity per
   owner, status ENROLLING.
4. Smoke test in production with a real Google account: apply (checkbox enforced)
   → assessment → enroll → Day 1 visible, Day 2 locked; recruiter register →
   pending; student platform (`/dashboard`, `/challenge`) unchanged.

## 7. [WEEK-1] While the cohort runs
- Content pack B (days 4–10 + checkpoint-1 rubric) seeded by cohort-day 3; pack C
  (days 11–31 + remaining rubrics + interview instructions rewritten around the
  healthcare build) by end of week 1. Seeding is upsert-safe mid-cohort.
- Voice interview: unchanged mechanically (034 Azure adapter still pending, owner
  has ~30 days before anyone reaches it).
- `docs/project-context.md`: update the program section (AI Cohort, 31 days,
  students, git-artifact verification, dropped surfaces).

## 8. Guardrails for Cursor (DO NOT)
- NO schema migrations tonight — everything above fits the existing models.
- Do NOT rename `/program`/`/talent` routes or touch the student challenge,
  synergy, marketplace, jobs, or `src/features/recruiter/`.
- Do NOT author or edit content JSONs — architect only.
- Do NOT delete `verify-mission` type handlers (only UI surfaces listed in §1).
- Do NOT weaken action-level guards while merging (middleware paths, login
  exception, requireProgramMember/requireRecruiter, missionSpec server-only rule).
- If the merge produces a conflict you're unsure about, STOP and show both sides —
  do not guess the night before launch.

## 9. Verification (tonight, in order)
1. Merged branch: `npx tsc --noEmit` + `npm run build` clean.
2. `/program` shows AI Cohort branding + requirements box; apply blocks without
   the RAM checkbox; entry assessment serves the new bank.
3. Seeded: 8 phases on curriculum page; Day 1 (DATA_ROOM) answerable and passes →
   Day 2 unlocks; Day 3 SHIP_IT verifies against a real test repo; day 31 page
   reachable with `highestUnlockedDay=31` set in DB; totals render /1020.
4. `/program/arena` → 404; no editor pane anywhere; `public/lab` gone from the
   built output.
5. Student platform regression pass; flag-off → all program routes 404.

## 10. Commit message
`feat(program): AI Cohort — 31-day healthcare chatbot curriculum, students audience, git-artifact verification, drop in-browser lab surfaces`
