# 024 — B2B Program 01 — Foundation: schema, flag, auth routing, shell, landing

> Read `023-b2b-program-00-roadmap.md` first. This plan creates the base everything
> else builds on. **No participant-facing logic yet** beyond the public landing page.

## 1. Goal
Land the full `Program*`/recruiter schema in one migration, add the `ENABLE_PROGRAM`
feature flag, make login/middleware aware of the new `/program` and `/talent`
namespaces, and ship the program shell (layout + nav + public landing at `/program`).

## 2. Current behavior
- No program models exist. `Role` enum = `STUDENT | ADMIN` ([schema.prisma:425](../../prisma/schema.prisma)).
- `middleware.ts` (repo root) protects a `protectedPaths` string allowlist via
  `startsWith`; everything else is public.
- `src/app/login/page.tsx` redirects any logged-in user *without* StudentProfile +
  Enrollment to `/register` — this would hijack program applicants and recruiters.
- `src/lib/feature-flags.ts` has the `isClaudeEnabled()` pattern to copy.
- No `prisma/content/program/` folder, no program seed script.

## 3. Files to touch
- `[edit] prisma/schema.prisma` — add `RECRUITER` to `Role`; add ALL enums + models
  exactly as specified in roadmap §4 (including the 4 new `User` relations).
- `[new] prisma/migrations/*` — via `npx prisma migrate dev --name b2b_program_foundation` (one migration).
- `[new] prisma/content/program/README.md` — one paragraph: "Content JSONs land here in
  the content phase (modules.json, days.json — mission briefs + server-only missionSpec,
  concept-questions.json, entry-questions.json, exercises.json — practice arena,
  videos.json, rubrics.json — loaded at grade time, not seeded). Authored by architect,
  seeded via `npm run db:seed:program`."
- `[new] prisma/seed-program.ts` — seed skeleton: reads the content JSON files if present,
  upserts `ProgramModule` (by `number`), `ProgramDay` (by `dayNumber`, incl. missionType/
  briefMd/assetsJson/missionSpec), `ProgramConceptQuestion` (clean-replace per day, like
  quiz questions in `seed-content.ts`), `ProgramEntryQuestion` (clean-replace all),
  `ProgramExercise` (by `slug`), `ProgramVideo` (clean-replace per day). Missing file →
  log + skip section (no throw).
- `[edit] package.json` — add script `"db:seed:program": "tsx prisma/seed-program.ts"`.
- `[edit] src/lib/feature-flags.ts` — add `isProgramEnabled(): boolean` reading `ENABLE_PROGRAM === "true"`.
- `[new] src/lib/program-auth.ts` — node-only helpers:
  - `getActiveCohort()` — newest cohort with status `ENROLLING | ACTIVE | COMPLETED`, `select` minimal fields.
  - `requireProgramMember()` — `auth()` session → `ProgramMember` for active cohort with
    status `ENROLLED | COMPLETED`; else `redirect("/program")`.
  - `requireRecruiter()` — session → `RecruiterProfile` where `approved: true`; else
    `redirect("/talent/pending")` (page ships in 031; simple placeholder here).
  - All DB-checked (JWT is stale for approval flips). Import `server-only` at top.
- `[edit] middleware.ts` — append to `protectedPaths`: `"/program/apply"`,
  `"/program/assessment"`, `"/program/dashboard"`, `"/program/day"`,
  `"/program/curriculum"`, `"/program/arena"`, `"/program/videos"`,
  `"/program/leaderboard"`, `"/program/interview"`, `"/talent"`. Strings ONLY — no imports.
- `[edit] src/app/login/page.tsx` — before the profile/enrollment branch: if the
  resolved `redirectTo` starts with `/program` or `/talent`, `redirect(redirectTo)`
  immediately for any logged-in user (see roadmap §9.2).
- `[new] src/app/program/layout.tsx` — Server Component. `notFound()` when
  `!isProgramEnabled()`. Renders children only (landing must stay bare).
- `[new] src/app/program/page.tsx` — Server Component, PUBLIC marketing landing:
  program name, 4-module curriculum overview (static copy from roadmap §1 topics:
  M1 Data & Knowledge Engineering — Kafka/VectorDB/Neo4j/RAG; M2 APIs & Microservices —
  FastAPI/GraphQL/gRPC/Docker/K8s; M3 LLM & Agentic Development — OpenAI/Anthropic/
  LangGraph/CrewAI; M4 MCP & Enterprise Adoption + capstone), "How it works" (apply →
  assessment → 30 days → AI interview → recruiter visibility), CTA `<Link>` (with
  `buttonVariants`) to `/program/apply`, secondary CTA "I'm a recruiter" → `/talent/register`.
  Reuse landing-page card/section styling from `src/components/landing/` as visual
  reference; new components live in `src/components/program/landing/`.
- `[new] src/app/program/(app)/layout.tsx` — Server Component shell for all authed
  program pages: calls `requireProgramMember()`, renders top nav (Dashboard, Curriculum,
  Arena, Videos, Leaderboard — plain `<Link>`s, active state by pathname via a
  small client nav component receiving only string props). Mobile: horizontal scroll nav.
- `[new] src/components/program/program-nav.tsx` — Client (`"use client"`), receives
  `items: {href,label}[]` (strings only) — no icons passed across the boundary.
- `[edit] src/components/shared/app-footer.tsx` (and bottom-nav component if it renders
  on arbitrary authed routes — verify) — return `null` on `/program/**` and `/talent/**`,
  mirroring the existing ai-cohort exclusions.
- `[edit] docs/project-context.md` — new section: B2B AI Mastery Program (foundation shipped).

## 4. Server vs Client
| File | Type | Boundary notes |
|---|---|---|
| All `src/app/program/*` pages/layouts | Server | Pass only strings/booleans down |
| `program-nav.tsx` | Client | string props only |
| `program-auth.ts`, `seed-program.ts` | Node-only | `server-only` import in program-auth |
| `middleware.ts` | Edge | strings appended, NOTHING else |

## 5. Steps
1. Schema: copy roadmap §4 into `prisma/schema.prisma` verbatim (adjust nothing).
   **DB safety first — see §7.** Run `npx prisma migrate dev --name b2b_program_foundation`,
   then `npx prisma generate`.
2. `feature-flags.ts`: add `isProgramEnabled()`.
3. `program-auth.ts` exactly as described in §3.
4. `middleware.ts` + `login/page.tsx` edits (§3). Login edit goes BEFORE the existing
   profile lookup so program users never hit the student register redirect.
5. Seed skeleton + content folder README + package.json script.
6. Landing page + layouts + nav; footer/bottom-nav exclusions.
7. Verify (§8), update `docs/project-context.md`, commit.

## 6. Guardrails for Cursor (DO NOT)
- Do NOT add `requireRole`/`requireProgramMember` to `/program` (landing) or `/login` —
  they are public. Only `(app)` group pages are member-gated.
- Do NOT import anything into `middleware.ts` — string literals only.
- Do NOT touch `src/features/recruiter/`, student challenge code, or `src/components/ui/`.
- Do NOT create any extra abstraction files beyond those listed in §3.
- Do NOT rename or reorder existing enum values; `RECRUITER` is appended.
- Do NOT seed any real content in this plan — skeleton only.
- If the migration errors, STOP and report — do not hand-edit migration SQL.

## 7. DB safety (schema change — mandatory)
1. `git add -A && git commit -m "checkpoint before b2b program foundation migration"` — note the hash.
2. Create a Neon branch snapshot named `pre-b2b-foundation`.
3. Only then run `npx prisma migrate dev --name b2b_program_foundation`.
4. Migration is purely additive (new enum value + new tables) — zero risk to existing rows.

## 8. Verification
- `npx tsc --noEmit` and `npm run build` pass.
- With `ENABLE_PROGRAM` unset: `/program` → 404. With `=true`: landing renders logged-out.
- Logged out, visit `/program/dashboard` → redirected to `/login?from=/program/dashboard`;
  after Google login → back to `/program/dashboard` → `requireProgramMember` redirects to
  `/program` (no member row yet). Crucially NOT to `/register`.
- A logged-in student visiting `/dashboard`, `/challenge/today`, `/mission` sees zero change.
- `npm run db:seed:program` runs and logs "skipped" for all missing content JSONs.
- Only files listed in §3 changed (`git status` check).

## 9. Commit message
`feat(program): B2B AI Mastery Program foundation — schema, flag, auth routing, shell + landing`
