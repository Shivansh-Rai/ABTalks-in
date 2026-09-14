# 141 — Snowflake Data & AI Engineering Cohort (Power BI clone)

> Fourth instance of the open-cohort shape shipped as plan 104 (Databricks),
> plan 110 (Data Solutions Architect) and plan 111 (Power BI). Same 078 spine,
> rolling IST unlock, GitHub verification, enrol-vs-dashboard screens. **Do not
> generalize the four into a shared kit** — copy the files and swap constants /
> copy / content.
>
> Implemented directly (Sohail waived the plan-only step for this task); this
> file is the record of what shipped.

## 1. Goal

Ship **Snowflake Data & AI Engineering** as a self-serve 15-day track at
`/program/snowflake`, built from the *15-Day Snowflake Data & AI Engineering
Training Program* doc: enrolment form, rolling per-learner day unlock in IST,
day pages with server-verified missions, modular dashboard. Open to anyone with a
completed `/register` profile. No join code, capacity, admin panel or entry exam.

## 2. Current behavior

Databricks, DS-Architect and Power BI are working 078-native tracks. Reused
**without editing them**: `src/repositories/learning.ts` (slug-generic readers),
`src/repositories/candidate.ts`, `src/features/program/verify-mission.ts`,
`src/features/program/parse-brief.ts`, and the `src/components/program/*` day and
module components that take `basePath`.

There was no content for this cohort — it was authored from the doc into
`prisma/content/snowflake-cohort/` in the same shape as `powerbi-cohort`:

| File | Used? |
|---|---|
| `modules.json` | yes — 6 modules, one per doc phase |
| `days.json` | yes — 15 days; **full `missionSpec` → `Activity.verificationSpec`** |
| `videos.json` | yes — 29 VIDEO activities with real `youtubeId`s from the doc (all 29 checked live via YouTube oEmbed on 2026-09-14) |
| concept-questions (75) / rubrics (4 milestones) / entry-questions (empty) / exercises (empty) | **no** — seeded-but-unread, same as the other tracks |

Curriculum facts:

- 15 days, 6 modules (1: days 1–3, 2: 4–6, 3: 7–9, 4: 10, 5: 11–13, 6: 14–15)
- Day 1 `DATA_ROOM` (10 pts, answers only, no `repoChecks` stored); days 2–13
  `SHIP_IT` (15 each); days 14–15 `SHIP_IT` + `isProjectDay` (25 + 30)
- **Max points = 245**
- Every brief has `## Mission:`, `### Build steps` and `### Submit your answers`
  (3 questions). Day 1 also has `### Your repo layout`.
- Every path in `repoChecks` is spelled out in that day's build steps. Content
  regexes use plain JS syntax (no `(?i)` inline flags, which `new RegExp` rejects)
  so they work if `SHIP_IT_CONTENT_CHECKS` is ever flipped.
- Build steps avoid `; ` sequences and mid-step `**bold**` lead-ins, which
  `formatBuildStepContent` would otherwise split into bullets through inline code.
- Doc SQL that would fail as written was corrected in the briefs: the stream
  MERGE filters the DELETE half of updates, child tasks are created with the root
  suspended, Snowpipe uses its own stage folder (bulk and Snowpipe load history
  are separate), external tables need an external stage, and
  `SYSTEM$CLUSTERING_INFORMATION` gets a column list for an unclustered table.

## 3. Files to touch

**New**

| Path | Note |
|---|---|
| `prisma/content/snowflake-cohort/*` | `[new]` README + 7 JSON files |
| `prisma/seed-snowflake.ts` | `[new]` seed program/version/modules/day+video activities/cohort |
| `public/snowflake-cohort/snowflake-hero.svg` | `[new]` original hero art (not the Snowflake logo) |
| `src/features/snowflake/{constants,progression,enroll,days,dashboard,missions}.ts` | `[new]` clones with `SNOWFLAKE_*` constants |
| `src/repositories/snowflake.ts` | `[new]` 078 reads/writes scoped to `act_snf_day_*` |
| `src/lib/validations/snowflake.ts` | `[new]` zod enrol + mission schemas, day max 15 |
| `src/app/actions/snowflake-actions.ts` | `[new]` two server actions |
| `src/app/program/snowflake/{layout,page}.tsx`, `day/[day]/page.tsx` | `[new]` flag gate, enrol vs dashboard, day page |
| `src/components/snowflake/snowflake-{enrol-hero,enroll-form,dashboard-view,stats-panel,mission-panel}.tsx` | `[new]` |
| `docs/plans/141-snowflake-cohort.md` | `[new]` this file |

**Edited**

| Path | Note |
|---|---|
| `src/lib/feature-flags.ts` | `[edit]` `isSnowflakeEnabled()` |
| `middleware.ts` | `[edit]` `/program/snowflake` in `protectedPaths` (no `@/lib/*` import) |
| `package.json` | `[edit]` `db:seed:snowflake` |
| `.env.example` | `[edit]` document `ENABLE_SNOWFLAKE` |
| `src/repositories/progress.ts` | `[edit]` hub heatmap counts `act_snf_day_*` attempts |
| `src/features/dashboard/get-hub-data.ts`, `get-site-search-items.ts`, `hub-search-index.ts` | `[edit]` `hasSnowflakeAccess` + Prep Kit search entry (cross-module: Shallika, approved) |
| `src/app/dashboard/page.tsx`, `src/components/dashboard-hub/roadmaps.tsx` | `[edit]` fifth Prep Kit card; grid classes unchanged, so it wraps to a new row at `xl` (cross-module: Shallika, approved) |
| `prisma/content/curriculum-skills.json`, `src/features/profile/profile.test.ts` | `[edit]` `snowflake` verified skills (12) + test track list (cross-module: Shivansh, approved) |
| `scripts/pr-module-labels.mjs` | `[edit]` Snowflake paths → `program` label |
| `docs/CHANGELOG.md` | `[edit]` one Pending-reconcile line |

Deliberately NOT touched: `src/components/not-found/not-found-view.tsx` (same
reason as plan 111 §3), other tracks' files, `verify-mission.ts`, the schema.

## 4. Server vs Client

Same split as the other tracks. Every `src/features/snowflake/*` file except
`constants.ts` starts with `import "server-only"`. Client components:
`snowflake-dashboard-view`, `snowflake-stats-panel`, `snowflake-mission-panel`,
`snowflake-enroll-form`. Nothing from `missionSpec` / `verificationSpec` crosses
to the client — only `shipItHints` (SHIP_IT days), `dataRoomQuestionCount` and
`parseBriefMd(briefMd).submitQuestions`. `basePath="/program/snowflake"` is a
string prop.

## 5. Steps (as executed)

1. Author content from the doc; validate with the real `parseBriefMd` (3
   questions = 3 answers per day, 245 points, contiguous modules, JS-valid
   regexes, every checked path named in its brief, no formatter bulleting,
   29 video ids matching the doc).
2. Copy the Power BI files with `POWERBI_`→`SNOWFLAKE_`, `PowerBi`→`Snowflake`,
   `act_pbi_`→`act_snf_`, `powerbi`→`snowflake`; set 15 days / 245 points /
   `plannedDurationDays: 15` / `sortOrder: 50`; rewrite hero copy.
3. Wiring edits from the table above.

## 6. Guardrails (DO NOT)

- DO NOT edit Databricks, DS-Architect or Power BI files, `verify-mission.ts`,
  `parse-brief.ts`, `SHIP_IT_CONTENT_CHECKS`, `prisma/schema.prisma`, or add a
  migration.
- DO NOT write Snowflake rows to `ProgramMember` / `ProgramCohort` /
  `ProgramModule` / `ProgramDay` / `ProgramMissionSubmission`, or call
  `dualWrite*` / `requireProgramMember()` / `resolveProgramMemberForUser()`.
- Activity ids are `act_snf_day_*` / `act_snf_vid_*` only.
- DO NOT hard-code `"Asia/Kolkata"` outside the seed timezone field — read
  `SNOWFLAKE_TZ`.
- DO NOT import `@/lib/*` into `middleware.ts`; DO NOT pass `missionSpec` to a
  client component; DO NOT create a shared open-cohort abstraction.

## 7. DB safety

No schema change. Seed only.

Seeded 2026-09-14 into the `.env.local` Neon branch `ep-young-shadow-amawetjy`
(not production; the seed refuses `ep-nameless-term-ams9a5e3` unless
`SEED_ALLOW_PRODUCTION=true`). Production is **not** seeded by this plan.

```bash
npm run db:seed:snowflake
npm run db:seed:curriculum-skills
```

Result, identical on a second run: `snowflake-open` ENROLLING / ROLLING /
Asia/Kolkata; 6 modules; 15 `act_snf_day_%`; 29 `act_snf_vid_%` (29 with a
`videoRef`); version `totalPoints` 245, `requiredActivityCount` 15; 12
`ProgramSkill` links for `snowflake`.

## 8. Verification

```bash
npx tsc --noEmit && npm run lint && npm run build && npm run test:profile
```

- `ENABLE_SNOWFLAKE` unset → `/program/snowflake` 404s and the Prep Kit card is
  hidden.
- Flag on, unenrolled + profile → enrol hero + locked module list + Register form.
- Flag on, enrolled → dashboard, Day 1 available, Days 2–15 locked; Day 1 passes
  on its 3 answers; Day 2 unlocks on the next IST calendar day.
- Prep Kit at 5 cards: one column on mobile, two at `sm`, three at `lg`, four per
  row at `xl` with the fifth wrapping. No horizontal scrollbar at any width.

## 9. Commit message

```
feat(snowflake): 078-native Snowflake Data & AI Engineering cohort at /program/snowflake

Clones the Power BI track onto a 15-day Snowflake cohort authored from the
training-program doc into prisma/content/snowflake-cohort (modules, days with
missionSpec, 29 videos, concept questions, rubrics), with rolling IST unlock,
GitHub verification, and enrol vs dashboard screens. Adds the Prep Kit card,
site search entry, heatmap counting and verified curriculum skills.
```
