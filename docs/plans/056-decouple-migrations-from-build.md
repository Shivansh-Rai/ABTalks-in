# 056 — Decouple database migrations from `npm run build`

> **STATUS: DONE (Aug 4, 2026).** Applied in this session at the user's
> instruction. Recorded here as the rationale + rollback reference.

## 1. Goal

`npm run build` ran `prisma migrate deploy` as its first step, so **any** local
build applied pending migrations straight to the production Neon database with
no prompt and no backup. Make `build` a pure compile that never opens a database
connection, and move migrations into a separate deploy-only script that Vercel
calls explicitly.

## 2. Current behavior (before this change)

`package.json:7`:

```json
"build": "cross-env NODE_ENV=production prisma migrate deploy && cross-env NODE_ENV=production prisma generate && cross-env NODE_ENV=production next build",
```

- `.env.local` `DATABASE_URL` points at Neon
  (`ep-young-shadow-amawetjy-pooler…/neondb`). There is **no separate local
  database** — local and production are the same instance.
- `prisma/migrations/` holds **25 migrations** + `migration_lock.toml`.
- `vercel.json` had no `buildCommand`, so Vercel used the default `npm run build`
  — which is how migrations reached production on each deploy.

### What would actually have happened if it ran

Worth being precise, because the risk is real but narrower than it sounds:

- `prisma migrate deploy` is **forward-only**. It never drops the database,
  never resets, never prompts. It is not `migrate dev` or `migrate reset`.
- It connects to `DATABASE_URL`, reads the `_prisma_migrations` table, and
  applies every migration folder not recorded there, in filename order.
- **Most likely outcome, today:** all 25 migrations are already applied to Neon,
  so it prints `No pending migrations to apply` and exits. A no-op.
- **The actual danger** is the day that is not true. Any migration authored
  locally but not yet applied would hit production the moment *anyone* — the
  user, Cursor, an agent, CI, a stray tab — typed `npm run build`. If that
  migration drops a column or table, the data is gone; there is no confirmation
  step and no automatic backup.
- A migration that fails midway is recorded as failed and **blocks all
  subsequent deploys** until resolved by hand with `prisma migrate resolve`.

So: not a live fire, but a loaded gun pointed at production that any routine
command could pull. That is what this change removes.

## 3. Files to touch

- `package.json` `[edit]` — split `build`; add `build:deploy`, `db:migrate:deploy`.
- `vercel.json` `[edit]` — pin `buildCommand` to `npm run build:deploy`.
- `docs/plans/056-decouple-migrations-from-build.md` `[new]` — this plan.

**Do not touch:** `prisma/schema.prisma`, any file under `prisma/migrations/`,
`.env.local`, seed/cleanup scripts, `src/`.

## 4. Server vs Client

Not applicable — build configuration only. No components, no rendering
semantics, no Server→Client prop passing.

## 5. Steps

### Step 1 — `package.json`

```json
"build": "cross-env NODE_ENV=production prisma generate && cross-env NODE_ENV=production next build",
"build:deploy": "cross-env NODE_ENV=production prisma migrate deploy && npm run build",
"db:migrate:deploy": "prisma migrate deploy",
```

`prisma generate` stays in `build` — it only reads `schema.prisma` and writes
the client into `node_modules`. **It does not connect to the database.**

`db:migrate:deploy` exists so migrations can be run deliberately, by name, when
that is actually the intent.

### Step 2 — `vercel.json`

```json
"buildCommand": "npm run build:deploy",
```

Without this, removing migrations from `build` would silently stop Vercel from
migrating on deploy, and the next schema change would ship code against an old
database. Vercel's behaviour is therefore **unchanged** by this plan — only
local `npm run build` becomes safe.

### Step 3 — verify

See §8. Do not run `npm run build:deploy` locally to test it; that is the exact
command this plan exists to keep away from the production database.

## 6. Guardrails for Cursor (DO NOT)

- DO NOT put `prisma migrate deploy`, `db push`, seed, or cleanup back into
  `build`, `postinstall`, `dev`, or any script that runs as a side effect.
- DO NOT run `npm run build:deploy` locally. It writes to production.
- DO NOT run `prisma migrate dev`, `migrate reset`, or `db push` against
  `DATABASE_URL` — it is the production Neon instance.
- DO NOT remove `buildCommand` from `vercel.json` — deploys would stop migrating.
- DO NOT remove `prisma generate` from `build`; Vercel needs a generated client
  and `generate` is DB-free.
- DO NOT edit `.env.local` or point it somewhere else as a "fix".
- DO NOT touch `prisma/migrations/` or `schema.prisma` — no schema change here.

## 7. DB safety

No schema, migration, or data change. This plan **removes** a database write
path; it does not add one. Nothing needs a Neon snapshot.

## 8. Verification

1. `git diff --stat` shows exactly `package.json`, `vercel.json`, and this plan.
2. `npm run build` — must complete **without** a `prisma migrate deploy` line in
   its output. Safe to run locally now; that is the entire point.
3. `npx tsc --noEmit` still passes.
4. On the next Vercel deploy, the build log must show `prisma migrate deploy`
   running before `next build`. **If it does not, migrations are not shipping** —
   check that Vercel's project settings do not have a dashboard-level Build
   Command overriding `vercel.json`.
5. `npm run db:migrate:deploy` should remain the only obvious way to migrate by
   hand, and should be run only when intended.

## 9. Follow-ups (not done here)

- Neon supports branching. A separate branch for local development would remove
  the shared-instance problem at its root, rather than defending against it one
  script at a time. Worth its own plan.
- `.env.local` currently makes production the default target for every local
  tool. Same root cause.

## 10. Commit message

```
fix(build): stop running prisma migrate deploy on every build

npm run build applied pending migrations to the production Neon database
as its first step, so any local build could alter production schema with
no prompt and no backup. build is now a pure compile; migrations moved to
build:deploy, which vercel.json calls explicitly so deploys are unchanged.
```
