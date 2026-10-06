# 169 — Admin role authority: one source of truth, revocation that sticks

> **Supersedes plan 127's admin-access section.** Plan 127 introduced
> `bootstrapAdminFromEnv(userId)` and carried the guardrail "DO NOT re-scope
> `bootstrapAdminFromEnv` back to a platform-wide count" (127 §Guardrails).
> That guardrail is now moot: the function is deleted outright, because *any*
> runtime grant from `ADMIN_EMAILS` is the defect. 127's reasoning — that an
> email added to env after the first admin should still get its assignment — is
> answered by `/admin/platform-admins` instead.

## 1. Goal

Make `UserRoleAssignment` the only authority on platform-admin access, so that
deleting a `User` row cannot resurrect admin, editing a row's `role` cannot be
mistaken for "never granted", and a revoke takes effect in the session instead
of only in the database.

## 2. Current behavior

Investigated 2026-10-01 against production (`ep-nameless-term-ams9a5e3`) after a
reproduction on `abtalks.in`. There are **two** authorities on admin access and
they disagree.

**Authority A — `ADMIN_EMAILS` (env).** `bootstrapAdminFromEnv`
(`src/lib/admin-auth.ts:56`) creates a live `GLOBAL`/`ADMIN` assignment for any
`User` whose email is in the list. It is meant to fire once per person; the
guard is a count of **that `userId`'s** ADMIN rows, including revoked ones:

```ts
const everGranted = await prisma.userRoleAssignment.count({
  where: { userId, role: ADMIN, scopeType: GLOBAL },
});
if (everGranted > 0) return false;
```

**Authority B — `UserRoleAssignment`.** `requireAdmin` / `getAdminContext` read
it; `grantPlatformAdminAction` / `revokePlatformAdminAction`
(`src/app/actions/admin-platform-actions.ts`) write it. Revocation is
`revokedAt`, never a change to `role`.

### Confirmed reproduction

`akasohail.khan011@gmail.com` (in Vercel's `ADMIN_EMAILS`; **not** in local
`.env*`, so this ran on production):

| time (UTC 2026-10-01) | row written |
|---|---|
| 06:31:10.037 | `User` `cmup5odlh…` — new id, `emailVerified` NULL, no password |
| 06:31:10.069 | `Account`, provider `google` |
| 06:31:11.769 | `UserRoleAssignment` `cmup5oexm…` GLOBAL, `grantedByUserId` NULL |
| 06:32:09.708 | `UserRoleAssignment` `cmup5pnmz…` GLOBAL **ADMIN**, `grantedByUserId` NULL |

No `CandidateProfile`. The `06:31:11` row was created by the bootstrap as
**ADMIN** and then edited to **CANDIDATE** in Prisma Studio (confirmed by the
operator); an `UPDATE` leaves `id` and `grantedAt` untouched, which is why its
cuid timestamp is the moment of first sign-in. 58 seconds later the next admin
request found no live ADMIN row, counted zero rows with `role = ADMIN`, and
minted a second one.

### The four defects

1. **Deleting a `User` row re-grants admin.** `UserRoleAssignment.userId` is
   `onDelete: Cascade` (`prisma/schema.prisma:2284`), so deleting the user
   destroys the very history the `everGranted` guard depends on. Re-signing in
   produces a new `userId` with no history, and env grants GLOBAL ADMIN again.
   The guard is keyed on the wrong identity: env lists **emails**, the memory is
   per **userId**. Only removing the address from `ADMIN_EMAILS` truly revokes.
2. **A read path performs a privilege-granting write.** `hasPlatformAdmin` is
   called by `requireAdmin` / `getAdminContext` on every admin page render and
   ~15 server actions, and it `create`s a role row, outside any transaction.
3. **Mutating `role` reads as "never granted".** `everGranted` filters
   `role = ADMIN`, so a row flipped to `CANDIDATE` is invisible to it and env
   re-grants. This is both observed symptoms: the duplicate CANDIDATE+ADMIN pair
   and "admin access is not revoked".
4. **The session's `isAdmin` is env-only and never expires.**
   `auth.config.ts:150-157` sets `token.isAdmin` purely from `ADMIN_EMAILS`;
   `UserRoleAssignment` is never consulted. `revokePlatformAdminAction` sets
   `revokedAt` but **not** `sessionInvalidatedAt`, so the JWT keeps asserting
   admin after a revoke.

   **Severity bound:** no authorization decision rests on this flag.
   `middleware.ts` gates `/admin` on "signed in" only, and the admin layout
   calls DB-checked `requireAdmin`. The ~30 consumers of `session.user.isAdmin`
   drive chrome and redirects. So defect 4 is wrong-UI and a dead end, not
   privilege escalation. Defect 1 **is** escalation: it writes a real DB role.

### Side effect: an admin with no profile cannot register

`/register` redirects to `/admin` on `session.user.isAdmin` **before** it
reaches the registration gate (`src/app/register/page.tsx:56`). With the address
in `ADMIN_EMAILS` that flag is true from the first JWT, so the re-created
account can never obtain a `CandidateProfile` through the UI: `/dashboard`
(`:52-56`) sends it to `/register`, which sends it to `/admin`, while `/profile`
renders the dead end "Complete your registration first"
(`src/app/profile/page.tsx:87`) — which is the message the operator saw.

### Also found

- **The partial unique index is in no migration.** `prisma/schema.prisma:2287`
  documents `role_assignment_active_unique` as hand-written SQL. It exists on
  both `ep-nameless-term-ams9a5e3` and `ep-young-shadow-amawetjy`, but the
  migration creates only three plain indexes, so any rebuilt environment loses
  it and the read-then-create races in `bootstrapAdminFromEnv`,
  `grantPlatformAdminAction` and `recruiterIdentityWrites` become unguarded.
- **`ENABLE_DEV_AUTH=true` in `.env.local` with `DATABASE_URL` on production.**
  `devAdminPasswordAllowed()` (`src/lib/email-auth.ts:118`) is true whenever
  `NODE_ENV !== "production"`, disabling the "admin accounts are Google-only"
  rule in `isGoogleOnlyAccount`. From `npm run dev` on that machine a password
  sign-in can open an admin account against live data. `.env.local` also carries
  a stray third `ENABLE_DEV_AUTH` line with a comment appended to its value.

## 3. Files to touch

| path | kind | note |
|---|---|---|
| `src/lib/admin-auth.ts` | `[edit]` | Delete `bootstrapAdminFromEnv`; `hasPlatformAdmin` becomes a pure read. Keep `isAdminEmail` (used by seeds). |
| `src/lib/admin-auth.test.ts` | `[edit]` | Drop bootstrap cases; assert `hasPlatformAdmin` performs no write. |
| `src/app/actions/admin-platform-actions.ts` | `[edit]` | Revoke also sets `sessionInvalidatedAt` + writes an `AdminAction`; grant writes an `AdminAction`. Wrap each in a transaction. |
| `src/auth.ts` | `[edit]` | Add a `jwt` callback override that sets `token.isAdmin` from `hasPlatformAdmin` at sign-in. |
| `src/auth.config.ts` | `[edit]` | Stop deriving `isAdmin` from `ADMIN_EMAILS`; preserve the existing value across refreshes. **Edge-safe — no `@/lib/*` import.** |
| `src/app/register/page.tsx` | `[edit]` | Only redirect admins away once they are registered. |
| `prisma/migrations/<new>/migration.sql` | `[new]` | Create `role_assignment_active_unique` with `IF NOT EXISTS`. |
| `prisma/schema.prisma` | `[edit]` | Update the comment at `:2287` to say the index is now in a migration. |
| `prisma/scripts/seed-admin.ts` | `[edit]` | Becomes the only `ADMIN_EMAILS` → grant path; make that explicit in its header. |
| `docs/project-context.md` | `[edit]` | §4/§18: record that admin access is `UserRoleAssignment` only. |

Not touched: `middleware.ts` (no admin logic in it), `src/features/notification/**`
(locked), any recruiter/hire or candidate-profile module.

## 4. Server vs Client

Every file above is server-only: `src/lib/*`, `src/auth*.ts`, a Server Action
file, and two Server Components (`register/page.tsx`, unchanged rendering).
`src/components/admin/platform-admins-panel.tsx` is the existing Client
Component and is **not** modified — its props stay `{ id, grantedAt, email,
name }`, all plain serialisable values.

No new Server→Client prop passing. No functions, icons or class instances cross
the boundary.

## 5. Steps

1. **`src/lib/admin-auth.ts`** — delete `bootstrapAdminFromEnv` entirely and
   reduce `hasPlatformAdmin` to the single `findFirst` it already starts with,
   returning `row !== null`. Keep the `isAdminEmail` export. Add a header note:
   `ADMIN_EMAILS` is consumed only by `prisma/scripts/seed-admin.ts`; runtime
   never grants.
   *Why removal and not an email-keyed guard:* the chicken-and-egg case the
   bootstrap existed for is gone — production holds 11 live GLOBAL ADMIN grants
   and a working grant/revoke UI. A runtime writer on a read path has no
   remaining job.
2. **`prisma/scripts/seed-admin.ts`** — document in its header that it is now
   the only path from `ADMIN_EMAILS` to a grant, and that adding an admin in a
   deployed environment is the `/admin/platform-admins` UI, not an env change.
3. **New migration** — `CREATE UNIQUE INDEX IF NOT EXISTS
   "role_assignment_active_unique" ON "UserRoleAssignment"("userId", role,
   "scopeType", COALESCE("scopeId", '')) WHERE "revokedAt" IS NULL;`
   `IF NOT EXISTS` because both live hosts already have it. Update the
   `prisma/schema.prisma:2287` comment to point at the migration.
4. **`src/app/actions/admin-platform-actions.ts`** —
   - `revokePlatformAdminAction`: wrap the last-admin count, the
     `revokedAt` update, a `user.update` setting `sessionInvalidatedAt: new
     Date()`, and an `AdminAction` row (`actionType: "PLATFORM_ADMIN_REVOKED"`,
     `previousState`/`newState`, `reason`) in one `prisma.$transaction`.
   - `grantPlatformAdminAction`: wrap the existence check, the `create`, and an
     `AdminAction` row (`"PLATFORM_ADMIN_GRANTED"`) in one transaction. Catch
     `P2002` from the new unique index and return the existing
     "already a Platform Admin" message, so the race is handled by the DB.
   - Keep both `select`-only, per project convention.
   - `AdminAction.actionType` is a plain `String` (`prisma/schema.prisma:587`),
     so no enum or schema change is needed. `actorUserId` is **non-null** —
     pass `admin.userId` from `requireAdmin()`; `adminUserId` and `targetUserId`
     are the nullable FK snapshots.
5. **`src/auth.config.ts`** — in the `jwt` callback, replace the
   `ADMIN_EMAILS` block with `token.isAdmin = token.isAdmin === true` so the
   value is preserved across refreshes and defaults to `false`. This file is in
   the Edge bundle: **no Prisma, no `@/lib/*`**.
6. **`src/auth.ts`** — add a `jwt` callback to the `callbacks` object (it
   currently only overrides `signIn` and `session`). Spread
   `authConfig.callbacks` first, then:
   - `await authConfig.callbacks.jwt({ token, user, ... })` to keep `authTime`
     and `id` handling in one place;
   - when `user` is present (i.e. a real sign-in), set
     `token.isAdmin = await hasPlatformAdmin(user.id)`.
   One query per sign-in, none per refresh. Combined with step 4's
   `sessionInvalidatedAt`, a revoke forces the next request to fail the
   `session` callback's `isJwtInvalidated` check and re-authenticate, so the
   stale `isAdmin` cannot survive a revoke.
   *Import note:* `admin-auth.ts` imports `@/auth`, so importing
   `hasPlatformAdmin` into `auth.ts` creates a cycle. Move `hasPlatformAdmin`
   into a new `src/lib/platform-role.ts` that imports only `@/lib/db` and
   `@prisma/client`, and have `admin-auth.ts` re-export it. Add this file to the
   table in §3 as `[new]`.
7. **`src/app/register/page.tsx`** — move the `isAdmin || role === "ADMIN"`
   redirect so it runs **after** `isCandidateRegistered`, and fire it only when
   `registered` is true. An admin with no `CandidateProfile` then gets the
   registration form instead of a dead end.
8. **`docs/project-context.md`** — note in §4/§18 that platform-admin access is
   `UserRoleAssignment` only, that `ADMIN_EMAILS` is seed-time, and that
   revocation sets `revokedAt` + `sessionInvalidatedAt` and never edits `role`.

## 6. Guardrails for Cursor (DO NOT)

- **DO NOT** import `@/lib/*` (especially `@/lib/db` or `@/lib/platform-role`)
  into `src/auth.config.ts` or `middleware.ts`. That blows the 1 MB Edge bundle.
  The DB lookup belongs in `src/auth.ts` only.
- **DO NOT** add `requireAdmin` / `requireRole` to `/login`, `/register`,
  `/api/auth/*` or the Auth.js handler. These are public surfaces.
- **DO NOT** "fix" revocation by changing `UserRoleAssignment.role`. Revocation
  is `revokedAt`. Nothing may branch on `role` to decide liveness.
- **DO NOT** reintroduce an env-derived admin check anywhere at runtime,
  including as a fallback when the DB query fails. A failed query is not admin.
- **DO NOT** write role rows from a read path, a page render, or a `GET` route.
- **DO NOT** touch `src/features/notification/**` or any locked notification
  path — out of scope here.
- **DO NOT** create new abstraction files beyond `src/lib/platform-role.ts`,
  which exists only to break the `auth.ts` ↔ `admin-auth.ts` import cycle.
- **DO NOT** drop or recreate the existing `role_assignment_active_unique`
  index; the migration must be `IF NOT EXISTS` only.
- **DO NOT** change `onDelete: Cascade` on `UserRoleAssignment.userId` in this
  plan. Deleting a privileged user should lose the grant; the bug was env
  re-granting, not the cascade.
- If a build error contradicts an assumption here (the cycle in step 6 is the
  likely one), trust the error and gather data rather than defending the
  structure.

## 7. DB safety

Schema change: one new index, additive, `IF NOT EXISTS`, no data rewrite. No
column added or dropped. `AdminAction` rows are inserts into an existing table.

1. Commit the code changes first; record the commit hash in this section.
2. Both live hosts (`ep-nameless-term-ams9a5e3`, `ep-young-shadow-amawetjy`)
   already have the index — confirm per host before applying, read-only:
   `SELECT indexname FROM pg_indexes WHERE tablename='UserRoleAssignment';`
   using `DIRECT_URL` plus `options=-c default_transaction_read_only=on`.
3. Take a Neon branch snapshot of the target host.
4. `npx prisma migrate deploy` (never `migrate dev` against a live host). The
   migration is expected to be a no-op on both; it exists so rebuilt
   environments get the index.
5. **Do not** run `prisma/scripts/migrate-2c-roles.ts` as part of this. It is a
   completed one-off and would grant roles from `ADMIN_EMAILS` again.

Data cleanup, separately and by hand after the code ships — the two rows on
`ep-nameless-term-ams9a5e3` for `akasohail.khan011@gmail.com`:
`cmup5oexm0001nh06bctnfgzx` (CANDIDATE, the mis-edited row) and
`cmup5pnmz0001ic04r16vexz5` (ADMIN, re-granted by the bootstrap). Decide
deliberately whether that account should hold admin, then use
`/admin/platform-admins` rather than Studio. Note the account still has no
`CandidateProfile`.

## 8. Verification

Build / typecheck:

```bash
npm run build && npx tsc --noEmit
```

The Edge bundle is the thing most likely to break — confirm the build does not
report `middleware.ts` over the size limit, and that `src/auth.config.ts` still
imports only `next-auth` and `next/server` transitively.

```bash
npx vitest run src/lib/admin-auth.test.ts src/features/hire/delete-recruiter-account.test.ts
```

Manual, against the sample DB (`DATABASE_SAMPLE_URL` →
`ep-proud-sky-ayl98f6m`), never a live host:

1. **Deleted admin no longer returns as admin.** Put a test address in
   `ADMIN_EMAILS`, seed it admin via `seed-admin.ts`, sign in, confirm `/admin`
   loads. Delete the `User` row. Sign in again. Expect: `/admin` redirects to
   `/dashboard`, no new `UserRoleAssignment` row exists, and the account is an
   ordinary unregistered candidate.
2. **Revoke sticks.** With two admins, revoke one from
   `/admin/platform-admins` while that admin has a live session in another
   browser. Expect: their next request signs them out (via
   `sessionInvalidatedAt`), and after re-authenticating the header shows no
   Admin entry and `/admin` redirects. An `AdminAction` row records the revoke.
3. **A mutated `role` does not re-grant.** Edit a live ADMIN row's `role` to
   `CANDIDATE` directly. Expect: no new ADMIN row appears on the next `/admin`
   request, and access is gone. (This is the original reproduction.)
4. **Last-admin guard intact.** With exactly one admin, revoke is refused.
5. **Admin with no profile can register.** For an `ADMIN_EMAILS` account with no
   `CandidateProfile`, `/register` renders the form rather than redirecting to
   `/admin`; after submitting, `/profile` loads instead of showing "Complete
   your registration first".
6. **No write on a read.** With query logging on, load `/admin` twice and
   confirm zero `INSERT INTO "UserRoleAssignment"`.

Files that should have changed, and nothing else: `src/lib/admin-auth.ts`,
`src/lib/platform-role.ts` (new), `src/lib/admin-auth.test.ts`, `src/auth.ts`,
`src/auth.config.ts`, `src/app/actions/admin-platform-actions.ts`,
`src/app/register/page.tsx`, `prisma/schema.prisma`,
`prisma/migrations/<new>/migration.sql`, `prisma/scripts/seed-admin.ts`,
`docs/project-context.md`.

## 9. Commit message

```
fix(auth): make UserRoleAssignment the only authority on admin access

Deleting a User row cascaded away its role assignments, which were also the
only record that ADMIN_EMAILS had already been honoured for that account. The
next sign-in therefore created a fresh userId with no history and
bootstrapAdminFromEnv re-granted GLOBAL ADMIN from env — on a read path, from a
page render. The same count also filtered on role = ADMIN, so a row edited to
CANDIDATE read as "never granted" and was re-granted too.

Removes the runtime bootstrap: ADMIN_EMAILS is now seed-time only, consumed by
prisma/scripts/seed-admin.ts, and hasPlatformAdmin is a pure read. token.isAdmin
is derived from the live grant at sign-in instead of from env, and revoking now
sets sessionInvalidatedAt so the JWT cannot keep asserting admin. Grant and
revoke are transactional, audited in AdminAction, and lean on the partial unique
index, which this adds to a migration — it existed only as hand-applied SQL.

Also lets an admin account with no CandidateProfile reach /register, which the
isAdmin redirect had made unreachable.
```

## Out of scope — track separately

- `ENABLE_DEV_AUTH=true` in `.env.local` while `DATABASE_URL` points at
  production, which disables the Google-only rule for admin accounts under
  `npm run dev`. Plus the stray third `ENABLE_DEV_AUTH` line whose value has a
  comment appended to it.
- `emailVerified` is NULL on accounts created through the Google adapter.
- No guard prevents deleting a privileged `User` row outside the app;
  `account-ops.ts:40` refuses it in-app, but Prisma Studio and raw SQL bypass
  that. Worth a periodic reconciliation check rather than a code change.
