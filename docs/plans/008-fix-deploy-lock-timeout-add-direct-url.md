# 008 — Fix Vercel deploy P1002 advisory-lock timeout (add `directUrl` for Prisma + Neon)

## 1. Goal
Make Vercel deploys reliable by routing Prisma migrations through Neon's
**direct** (non-pooled) endpoint instead of the PgBouncer-style `-pooler`
endpoint. Keep the runtime Prisma Client on the pooled URL for connection
efficiency. Also document a one-time runbook to clear the currently-stuck
advisory lock if it's still held when this fix ships.

This is an **infrastructure** fix, not a feature change. It is not specific
to plan 005 or plan 007 — every deploy is vulnerable until this is in place.

## 2. Current behavior

### Symptom (reported, second occurrence)
Vercel build fails during `prisma migrate deploy` with:
```
Datasource "db": PostgreSQL database "neondb" at
  "ep-young-shadow-amawetjy-pooler.c-5.us-east-1.aws.neon.tech"
12 migrations found in prisma/migrations
Error: P1002
The database server was reached but timed out.
Context: Timed out trying to acquire a postgres advisory lock
  (SELECT pg_advisory_lock(72707369)). Timeout: 10000ms.
```
First occurrence was on the plan-005 rollout. User rolled back to
`dfb8e3f8`, deploy succeeded (lock had naturally cleared). Plan-007 rollout
hit the same error. Pattern: intermittent, not tied to any specific code
change.

### Why it's happening — root cause
1. **`prisma/schema.prisma:5-8` has only `url = env("DATABASE_URL")`**:
   ```
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
   There is **no `directUrl`**. So every Prisma operation — including
   `migrate deploy` during Vercel builds — uses whatever `DATABASE_URL`
   resolves to.
2. **`DATABASE_URL` is Neon's pooled endpoint** (hostname contains
   `-pooler`, port 5432, default mode = transaction pooling). PgBouncer in
   transaction mode hands out backend connections per query/transaction and
   does NOT preserve session state across queries. Postgres advisory locks
   are session-scoped — when the pooler returns the backend to its pool,
   the lock's bound to a session that the next caller can't see, and the
   lock can be held by a "ghost" session for an unpredictable window.
3. **`package.json:7` build script** runs `prisma migrate deploy` on every
   Vercel build:
   ```
   "build": "cross-env NODE_ENV=production prisma migrate deploy &&
            cross-env NODE_ENV=production prisma generate &&
            cross-env NODE_ENV=production next build"
   ```
   So every deploy touches the lock through the pooler. Most builds win the
   race; occasionally one finds the lock held and dies at the 10s timeout.

This is the canonical Prisma+Neon failure mode. Prisma's docs call it out
explicitly: <https://www.prisma.io/docs/orm/overview/databases/neon#how-to-use-prisma-orm-with-neon> — migrations must use a direct, non-pooled connection.

### What is NOT the cause
- Plan 005 (mobile UI polish) had no schema change.
- Plan 007 (synergy flat scoring + referral) had no schema change.
- The 12 existing migrations are unchanged and have all been previously
  applied — `migrate deploy` should be a no-op. It's the advisory-lock
  *acquisition* that's failing, not any migration's SQL.

## 3. Files to touch

| Path | Status | Note |
|---|---|---|
| `prisma/schema.prisma` | [edit] | Add `directUrl = env("DIRECT_URL")` to the `datasource db` block. Two-line change. |
| **Vercel env var: `DIRECT_URL`** | [new — operator action, not a file] | Set on Vercel project settings, all environments (Production, Preview, Development). Value: Neon's direct (non-pooled) connection string for the same `neondb`. See §5 Step 2 for exactly how to obtain it. |
| `.env` (local, not committed) | [edit — user only] | Add `DIRECT_URL=...` for local `prisma migrate dev` to work. Same value as Vercel. |
| `.env.example` if it exists | [edit, optional] | Mirror the new var so future contributors know it's required. |
| `package.json` | (no edit) | Build script stays the same. Once `directUrl` is configured, `prisma migrate deploy` uses it automatically. |
| All `src/` and other application code | (no edit) | This is a config-only fix. |
| Existing migrations under `prisma/migrations/` | (no edit) | Untouched. |

## 4. Server vs Client
Not applicable — this is a build-time configuration change. No runtime
component boundaries are crossed. The Prisma Client at runtime continues to
use `DATABASE_URL` (pooled) exactly as it does today.

## 5. Steps

### Step 1 — Update `prisma/schema.prisma`
Change lines 5-8 from:
```
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```
to:
```
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```
Notes:
- The extra space alignment (`provider` / `url` / `directUrl`) keeps the
  block visually consistent. Prisma doesn't care, but it's the convention
  in this file.
- **Do NOT** rename `DATABASE_URL` or change its value. The runtime client
  must keep using the pooled URL for connection efficiency.

### Step 2 — Obtain the direct URL from Neon
On the Neon dashboard for the `neondb` project:
1. Open the project → **Connection Details**.
2. There is a toggle / dropdown for **Pooled / Direct** (or
   **Connection pooler: enabled/disabled**). Switch to **Direct
   connection** (or **disable pooling**).
3. Copy the connection string. The hostname is the SAME compute endpoint
   minus the `-pooler` suffix:
   - Pooled (current `DATABASE_URL`):
     `postgres://...@ep-young-shadow-amawetjy-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require`
   - Direct (new `DIRECT_URL`):
     `postgres://...@ep-young-shadow-amawetjy.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require`
4. Both URLs point at the same database — only the hostname differs.
5. Both should keep `sslmode=require`. Do NOT remove SSL.
6. Use the same credentials (the `...@` portion is identical).

If the Neon dashboard does not expose a one-click direct URL, the safe
manual derivation is: take the current pooled `DATABASE_URL` and remove the
literal substring `-pooler` from the hostname. That is the entire change.

### Step 3 — Set `DIRECT_URL` on Vercel
On Vercel project settings → **Settings → Environment Variables**:
1. Add a new variable: `DIRECT_URL`.
2. Value: the direct URL from Step 2.
3. Apply to **Production**, **Preview**, and **Development** environments.
4. Save.
5. Trigger a new deploy after saving (Vercel does NOT auto-redeploy on
   env-var change).

### Step 4 — Update local `.env`
Add `DIRECT_URL=...` to the local `.env` file (same value as Vercel). This
is needed for `prisma migrate dev`, `prisma migrate status`, and any local
schema work. `.env` is gitignored; this is a per-developer step.

If `.env.example` exists in the repo, also add a `DIRECT_URL=` line with no
value as a documentation hint.

### Step 5 — Runbook: clear the currently-stuck advisory lock (one-time)
This is a one-time operator action, separate from the code fix. Do this
**before** triggering the post-fix deploy if the failed deploy was recent
(< 10 minutes ago) and the lock might still be held.

In the Neon SQL editor, on the `neondb` database, **using the DIRECT URL
connection** (Neon SQL editor uses a direct compute connection by default):

1. Inspect the lock:
   ```sql
   SELECT pid, locktype, classid, objid, mode, granted
   FROM pg_locks
   WHERE locktype = 'advisory' AND objid = 72707369;
   ```
   - **No rows**: the lock is already gone. Skip to Step 6.
   - **One row with `granted = true`**: a backend is holding it. Note the `pid`.

2. If a `pid` is held, identify whose session it is (sanity check — confirm
   it's an idle Prisma migration session, not your own SQL editor):
   ```sql
   SELECT pid, usename, application_name, state, query_start, state_change
   FROM pg_stat_activity
   WHERE pid = <pid-from-step-1>;
   ```
   Expected: `application_name` something like `prisma`, `state = 'idle'`
   or `'idle in transaction'`, `query_start` from your last failed deploy.

3. Terminate that session:
   ```sql
   SELECT pg_terminate_backend(<pid>);
   ```
   Returns `t` (true) on success. Re-run the query in step 1 — should now
   return zero rows.

**Safety:** `pg_terminate_backend` only kills the named session. It does
NOT drop data, does NOT roll back committed transactions, does NOT affect
other connections. The killed session is a stuck Prisma migrate process —
killing it is the entire point.

**Do NOT** run `pg_advisory_unlock(72707369)` from the SQL editor — that
only unlocks locks held by *your current session*. The stuck lock belongs
to a different session and that call will silently return `false`.

### Step 6 — Verify locally before pushing
With the schema change committed and `.env` updated:
```
npx prisma migrate status
```
- Expected output: "Database schema is up to date!" — confirms `DIRECT_URL`
  is being used and the connection works.
- If it errors with `Environment variable not found: DIRECT_URL`, the
  `.env` change in Step 4 didn't land.
- If it errors with a connection refused / DNS lookup failure, the URL in
  `DIRECT_URL` is malformed.

**Do NOT** run `prisma migrate deploy` locally against production — that's
the Vercel build's job. `migrate status` is a read-only check.

### Step 7 — Deploy
Commit the schema change and push. Watch the Vercel build logs for the
`prisma migrate deploy` step. Expected:
```
Datasource "db": PostgreSQL database "neondb" at
  "ep-young-shadow-amawetjy.c-5.us-east-1.aws.neon.tech"
12 migrations found in prisma/migrations
No pending migrations to apply.
```
Note the hostname **without** `-pooler` — that's the proof the directUrl is
being honored.

## 6. Guardrails for Cursor (DO NOT)
- **DO NOT** change `DATABASE_URL` itself. The runtime Prisma Client MUST
  keep using the pooled URL. The point of `directUrl` is that migrations
  use the direct endpoint while the runtime uses the pooled endpoint —
  best of both worlds.
- **DO NOT** swap the pooled URL out for the direct URL in `DATABASE_URL`.
  Production runtime traffic against a direct (unpooled) Neon endpoint
  exhausts connections quickly under load. Free-tier compute has a low
  connection cap; the pool exists to multiplex.
- **DO NOT** remove `prisma migrate deploy` from the `build` script as a
  "fix." The point is to keep automatic migrations on deploy — they're just
  on the right URL now.
- **DO NOT** add a `--skip-generate` flag or otherwise change the build
  pipeline's command sequence. `migrate deploy && generate && next build`
  stays.
- **DO NOT** add `?pgbouncer=true` or `?connection_limit=1` or any other
  query-string hack to `DATABASE_URL`. The clean fix is `directUrl`; any
  query-string workaround is a half-measure that papers over the issue.
- **DO NOT** lock the Prisma version differently or attempt to bypass the
  advisory-lock acquisition. The lock exists for a reason (serializing
  concurrent migrations across deploys). It just needs a session-stable
  connection, which the direct URL provides.
- **DO NOT** modify any of the 12 files under `prisma/migrations/`. None
  of them are the problem.
- **DO NOT** create a new migration as part of this change. There is no
  schema change. The only `schema.prisma` edit is adding `directUrl`, which
  Prisma does NOT consider a schema change for migration purposes —
  `migrate status` will still report "up to date" after the edit.
- **DO NOT** run `pg_advisory_unlock_all()` or any blanket lock-release
  function on the Neon database. Always target the specific `pid` from
  `pg_stat_activity`.
- **DO NOT** commit the `.env` file. `.env.example` (if it exists) gets the
  empty `DIRECT_URL=` line; `.env` stays gitignored.

## 7. DB safety
Schema is **not** modified by Prisma terms (the datasource block doesn't
count toward migration drift). No data is touched. No migration is
generated.

The one operator action that mutates DB state is `pg_terminate_backend()`
in Step 5, which only ends a stuck Prisma-migrate session — it cannot
corrupt data or roll back committed work. If the user is uncomfortable
running it manually, the alternative is to wait ~10–30 minutes for Neon's
own idle-connection reaper to clear the session, then redeploy.

No Neon branch snapshot is required for this change.

## 8. Verification

### Pre-flight
- `git diff prisma/schema.prisma` shows ONLY the addition of the
  `directUrl` line. No other changes.
- `npx prisma format` on the schema is a no-op (block already formatted).
- `npx prisma migrate status` against the local `.env` (now with
  `DIRECT_URL`) reports "Database schema is up to date!"
- `npx prisma generate` succeeds locally.
- `npm run build` succeeds locally end-to-end. The local migrate-deploy
  call goes through `DIRECT_URL` — confirm by watching the printed
  hostname in the build log.

### Deploy verification
- After Step 7, the Vercel build log shows the **non-pooler** hostname for
  the migrate step.
- The build reaches `next build` (the migration step succeeds).
- The deploy goes live.
- The runtime app still works: open `/dashboard` while logged in, confirm
  data loads. (Runtime uses the pooled URL, which is unchanged.)

### Regression matrix
| Scenario | Expected |
|---|---|
| Fresh deploy with no pending migrations | `migrate deploy` reports "No pending migrations to apply" and exits cleanly. No advisory-lock timeout. |
| Deploy that does have a new migration (future change) | `migrate deploy` acquires the lock on the direct connection, runs the migration, releases the lock, exits. |
| Two preview deploys triggered in rapid succession (e.g., two pushes within seconds) | One acquires the lock, the other waits up to 10s, then proceeds when released. Both succeed. (This is the intended Prisma behavior; the fix makes the lock acquisition reliable.) |
| Local `prisma migrate dev` for a future schema change | Uses `DIRECT_URL`. Works. |
| Runtime queries from `/dashboard`, `/profile`, etc. | Continue using `DATABASE_URL` (pooled). No change. |
| Neon compute suspended (free tier inactivity) | First connection wakes it; might add ~1–2s to deploy. Still well within Prisma's lock timeout (10s) plus retry. |

### Files that should have changed
- `prisma/schema.prisma` (one block, two new chars on the `provider` line
  for alignment, one new `directUrl` line)
- `.env.example` (optional, if it exists)

**Off-repo changes** (operator actions, not in git):
- Vercel env var `DIRECT_URL` added in all environments
- Local `.env` adds `DIRECT_URL`
- (Conditional) Neon SQL editor used to clear stuck lock

Nothing else in the repo should change. If `git diff --name-only` shows
changes to `src/`, `package.json`, or any migration file, STOP and review.

## 9. Commit message

```
fix(prisma): add directUrl for Neon to stop migrate-deploy lock timeouts

Vercel deploys intermittently failed with `Error: P1002` —
`pg_advisory_lock(72707369)` timing out after 10s. Root cause: every
Prisma operation including `migrate deploy` was going through Neon's
`-pooler` endpoint (PgBouncer in transaction mode), which doesn't preserve
session state and makes Postgres advisory locks unreliable across deploys.

Add `directUrl = env("DIRECT_URL")` to the datasource block so migrations
use a direct, non-pooled compute connection while runtime Prisma Client
keeps using DATABASE_URL (pooled). Standard Prisma+Neon pattern per
https://www.prisma.io/docs/orm/overview/databases/neon.

Operator follow-up (not in this commit):
- Set DIRECT_URL on Vercel (Production + Preview + Development) to the
  non-pooler form of the existing DATABASE_URL.
- If the lock is still stuck at deploy time, terminate the holding pid
  via pg_stat_activity + pg_terminate_backend from the Neon SQL editor.

No schema change. No application code change. The 12 existing migrations
are not modified.
```
