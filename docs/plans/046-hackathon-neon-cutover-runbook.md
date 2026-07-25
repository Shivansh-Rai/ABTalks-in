# 046 — Hackathon Neon Cutover: Production Runbook (SELF-CONTAINED)

> **Read this whole file before running anything.** It is standalone — you do not need
> plan 045 or any prior conversation. It supersedes the execution steps in
> `045-hackathon-supabase-to-neon.md` §6.
>
> **Steps are tagged `[HUMAN]` or `[CURSOR]`.** Do not run a `[HUMAN]` step yourself.
> **Every `GATE` must pass before continuing. If a gate fails, STOP and report — do not
> improvise a workaround.**

---

## 0. Verified state (checked read-only on 2026-07-25)

Production has been identified and the two riskiest unknowns are already cleared.

| Check | Result |
|---|---|
| Production `DATABASE_URL` host | `ep-nameless-term-ams9a5e3-pooler…` — **2,976 Users** ✅ |
| Production `DIRECT_URL` host | `ep-nameless-term-ams9a5e3…` (same id, non-pooled) ✅ |
| Email preflight (case-insensitive) | **40 / 40 matched · 0 unmatched · 0 ambiguous** ✅ |
| `hackathon_tables` on production | **NOT applied** — the tables do not exist on prod yet |
| Production hackathon rows | **none** (no split-brain on prod) |
| Pending migrations on prod | **exactly one:** `20260725080916_hackathon_tables` ✅ |

**Supabase source data (re-read at freeze time — it drifts):**
36 teams · 40 participants · 36 unique team codes · 28 solo + 8 team entries ·
0 teams over 3 members · 0 orphan participants.

**Still outstanding:** Neon production branch snapshot (Phase 2), the 20 uncommitted
files (Phase 1), `prisma migrate deploy` (Phase 3), and the script hardening (Phase 4).

### Two traps already hit once — do not re-introduce them

1. **`DIRECT_URL` vs `DATABASE_URL`.** `prisma/schema.prisma` sets
   `directUrl = env("DIRECT_URL")`, and **Prisma Migrate uses `directUrl`**. Earlier,
   `DATABASE_URL` was production while `DIRECT_URL` was still a stale database, so
   `migrate status` printed *"schema is up to date"* **about the wrong database** — a
   false all-clear that would have left production without the tables. Both are correct
   now; if you ever change one, change both.
2. **Env-file precedence is inverted between the script and the app.**
   `scripts/migrate-hackathon-to-neon.ts` calls `loadEnvFile(".env")` **then**
   `loadEnvFile(".env.local")` and only sets a key `if (process.env[key] === undefined)`,
   so **`.env` wins**. Next.js does the opposite — `.env.local` wins. Both files define
   `DATABASE_URL`. If they disagree, the migration script and the running app silently
   use different databases.

### Why the earlier attempt failed (for context — already fixed)

A first migrate attempt aborted with 36 of 39 participants unmatched. Cause: the
configured database was a **stale copy**, not production. It is not a data problem —
against real production, all 40 participants match. **Do not "fix" unmatched rows by
skipping them.**

---

## 1. Goal

Move live hackathon registrations from the isolated workshop Supabase into the main
Neon/Prisma database, and switch the app to the Prisma code path — **without losing or
splitting a single registration or team code**, and without ever deploying the Prisma
code while the Neon tables are empty.

## 2. Current behavior

- Production runs the **Supabase** code path (`src/lib/hackathon-supabase.ts`).
  Registration is **open** and growing (participants went 39 → 40 during investigation).
- The full Prisma cutover is **written but uncommitted**: 20 modified/untracked files on
  `master` at checkpoint commit `1c51f66`, including `prisma/schema.prisma`, the
  migration `20260725080916_hackathon_tables`, `src/features/hackathon/*`,
  `src/app/admin/hackathon/`, and `scripts/migrate-hackathon-to-neon.ts`.
- `hackathon_event` **does not exist in Supabase**. The script already treats it as
  optional; `HackathonEvent` will legitimately be **empty** after migration and the
  problem statement is set later via `/admin/hackathon`. This is expected, not a failure.
- `src/lib/hackathon-supabase.ts` is intentionally **kept** as the rollback path.

## 3. Files to touch

| Path | New/Edit | Note |
|---|---|---|
| `scripts/migrate-hackathon-to-neon.ts` | `[edit]` | Add `--preflight`; case-insensitive user matching; make the non-empty guard fail loudly. |
| `package.json` | `[edit]` | Add the `hackathon:preflight` script. |
| `src/components/hackathon/hackathon-config.ts` | `[edit]` | `registrationOpen` → `false` (freeze), later → `true` (reopen). Two separate commits. |

**No application code changes.** The cutover code is already written; this plan does not
modify it. Do **not** touch `src/lib/hackathon-supabase.ts`,
`src/lib/workshop-supabase.ts`, `/ai-workshop`, `/ai-cohort-register`, the admin cohort
views, `middleware.ts`, `auth.ts`, or `auth.config.ts`.

## 4. Server vs Client

Not applicable — this plan changes only a standalone Node script and one config
constant. Neither runs in the browser. The already-written cutover keeps its existing
boundaries: `src/features/hackathon/*` is server-only and must never be imported from a
`"use client"` file or from `middleware.ts` (which must stay edge-safe).

---

## 5. Steps

### Phase 1 — Preserve the uncommitted work `[CURSOR]`

The cutover is uncommitted on `master`. Move it to a branch so `master` can carry a
one-line freeze commit independently.

```bash
git status --short          # expect ~20 modified/untracked files
git checkout -b feature/hackathon-neon-cutover
git add -A
git commit -F- <<'MSG'
refactor(hackathon): migrate from Supabase to Neon/Prisma

Registration became session-gated, so hackathon records were keyed to a User that
lives in Neon while the rows lived in Supabase — no FK, no joins, no transactions,
and a cross-database lookup on the /, /dashboard and /login paths.

Adds HackathonTeam / HackathonParticipant / HackathonEvent models with a unique
userId FK (cascade delete) and preserves every existing row and team code via a
one-off, abort-on-unmatched migration script. Registration writes are now wrapped
in prisma.$transaction, removing the compensating-delete workaround for orphan
teams. Adds /admin/hackathon with CSV export and an admin problem-statement editor.

Workshop and AI-cohort tables remain on Supabase and are untouched.
MSG
git push -u origin feature/hackathon-neon-cutover   # non-prod branch — safe to push
git checkout master                                  # master now clean at 1c51f66
```

**GATE:** `git status` on `master` must be clean and `git log -1` must show `1c51f66`.

---

### Phase 2 — Neon production snapshot `[HUMAN — Cursor must stop and ask]`

**Cursor: do not attempt this. Print the instruction and wait for confirmation.**

In the Neon console, open the **`ep-nameless-term-ams9a5e3`** project and create a
**branch from the current state** of production. Record the branch name together with
commit `1c51f66`.

Also export `hackathon_teams` and `hackathon_participants` to CSV from the Supabase UI
as a second backup.

**GATE:** do not proceed until the human confirms the snapshot exists.

---

### Phase 3 — Apply the schema to production `[CURSOR]`

Additive and safe with the site live: it creates three empty tables and one enum, and
production still runs the Supabase code path, so nothing reads them yet.

```bash
# 1. Confirm Prisma targets PRODUCTION and review the pending list.
npx prisma migrate status
```

**GATE — all three must hold:**
- Printed host is `ep-nameless-term-ams9a5e3…` (**not** `ep-young-shadow-amawetjy…`).
- Exactly one migration is pending: `20260725080916_hackathon_tables`.
- If anything else is pending, or the host is wrong → **STOP and report.**

```bash
# 2. Apply. NEVER db push, NEVER migrate dev, NEVER migrate reset.
npx prisma migrate deploy

# 3. Confirm it landed.
npx prisma migrate status     # expect "Database schema is up to date!"
```

**GATE:** the hackathon tables must now exist on production and be **empty** (verified in
Phase 5's preflight).

---

### Phase 4 — Harden the migration script `[CURSOR]`

Three defects must be fixed before the script is trusted against production.

#### 4a. Fail loudly when Neon already has data

`migrate()` currently does this (around line 212):

```ts
const existingCount = await prisma.hackathonTeam.count();
if (existingCount > 0) {
  const pCount = await prisma.hackathonParticipant.count();
  const eCount = await prisma.hackathonEvent.count();
  console.log(`Neon already has hackathon data (...). Skipping write (idempotent).`);
  process.exit(0);          // ← DANGEROUS
}
```

A green `exit(0)` having written nothing is indistinguishable from success. If someone
then deploys the cutover, every registration is stranded in Supabase.

**Change it to print the existing team codes and `process.exit(1)`** with a message like
`ABORT: Neon already has N hackathon teams — refusing to migrate. Resolve manually.`

#### 4b. Match users case-insensitively

`User.email` is a plain unique Postgres column and is **case-sensitive**. The current
preflight lowercases the Supabase email and calls `findUnique`, so any `User` stored with
capitals is falsely reported unmatched and trips the abort:

```ts
const email = p.email.trim().toLowerCase();
const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
```

Replace with a case-insensitive lookup that treats **ambiguity as a hard error**:

```ts
const hits = await prisma.user.findMany({
  where: { email: { equals: p.email.trim(), mode: "insensitive" } },
  select: { id: true },
});
if (hits.length === 0) { /* push to unmatched, continue */ }
else if (hits.length > 1) { /* push to a new `ambiguous` list, continue */ }
else { /* hits[0].id — existing matched path */ }
```

Then, alongside the existing `unmatched` and `duplicateUserIds` aborts, **add an abort
for `ambiguous`** that prints the email and the number of matching users. Never guess.

#### 4c. Add a `--preflight` dry-run

Extract the "fetch Supabase rows + resolve every email → `User.id`" logic (currently
inline in `migrate()`, roughly lines 222–286) into a shared function used by **both**
`migrate()` and a new `preflight()`. `preflight()` must:

- Report: Supabase team/participant counts, matched count, unmatched, ambiguous,
  duplicate-userId, and the current Neon `HackathonTeam` / `HackathonParticipant` counts.
- **Write nothing.**
- Exit **0** only if unmatched = 0, ambiguous = 0, duplicates = 0, **and** the Neon
  hackathon tables are empty. Otherwise print the blocking reason and exit **1**.

Wire it up next to the existing `--verify` flag (`const verifyOnly = process.argv.includes("--verify")`,
around line 65):

```ts
const preflightOnly = process.argv.includes("--preflight");
```

and in `main()`: `if (verifyOnly) … else if (preflightOnly) … else migrate(…)`.

Add to `package.json` scripts, beside the existing `hackathon:migrate` / `hackathon:verify`:

```json
"hackathon:preflight": "tsx scripts/migrate-hackathon-to-neon.ts --preflight"
```

**Do not change** any other behavior: keep the pagination in `fetchAllRows`, keep
`hackathon_event` optional, keep `createdAt` and `team_code` preserved verbatim, and keep
the `$transaction` write.

Commit:

```bash
git add scripts/migrate-hackathon-to-neon.ts package.json
git commit -F- <<'MSG'
fix(hackathon): harden migration preflight

Adds a --preflight dry-run so unmatched participants are detected before
registration is frozen. Matches User emails case-insensitively (User.email is a
case-sensitive column, so a lowercased findUnique produced false unmatched) and
aborts on ambiguous matches. Replaces the silent exit-0 when Neon already has
teams with a loud non-zero failure — a no-op must never look like a successful
migration.
MSG
```

**GATE:** `npx tsc --noEmit` passes.

---

### Phase 5 — Preflight gate, BEFORE any freeze `[CURSOR]`

Deliberately ordered before the freeze: if this fails, registration is never interrupted.

```bash
npm run hackathon:preflight
```

**GATE — expected: `0 unmatched`, `0 ambiguous`, `0 duplicates`, Neon tables empty,
~40 participants / ~36 teams (counts may have drifted upward — that is fine).**

- **Exit 0 →** proceed to Phase 6.
- **Exit 1 → STOP. Report the output. Do NOT skip rows. Do NOT invent Users.**

  If there are unmatched participants, the options, in order of preference:
  1. **Preferred:** ask each unmatched person to Google sign-in at `abtalks.in` using the
     exact email they registered with. That creates the `User` + linked `Account`
     normally. Re-run preflight until it reports 0.
  2. **Do NOT create bare `User` rows.** Inserting a `User` with an email but no
     `Account` row means that when that person next signs in with Google, Auth.js v5
     rejects it with **`OAuthAccountNotLinked`** (its anti-account-takeover behavior),
     **locking them out of their own registration**. It only works with
     `allowDangerousEmailAccountLinking: true` on the Google provider, which changes
     sign-in for the entire platform and is a security decision for the owner. **Out of
     scope for this plan** — it needs its own plan and testing.
  3. If only a handful, contact them and re-register them after cutover.

---

### Phase 6 — Freeze, migrate, verify `[CURSOR runs; pushing to master is `[HUMAN]`-approved]`

This is the only window in which registration is closed. Keep it short — everything
risky was already cleared above.

```bash
# 1. Freeze. This is a ONE-LINE change on the CURRENT Supabase code path
#    (master is clean at 1c51f66; the cutover is safely on its branch).
#    Edit src/components/hackathon/hackathon-config.ts → registrationOpen: false
git add src/components/hackathon/hackathon-config.ts
git commit -m "chore(hackathon): freeze registration for Neon migration"
git push origin master        # ← [HUMAN] approval required: this deploys to production
```

Wait ~60 seconds, then confirm `/hackathon/register` shows **"Registration is closed"**.

```bash
# 2. Migrate production.
npm run hackathon:migrate

# 3. Verify — MUST exit 0.
npm run hackathon:verify
```

`hackathon:verify` checks team counts, participant counts, and the `team_code` set-diff
**in both directions**. An empty `HackathonEvent` is expected and OK.

**GATE:** if `hackathon:verify` does not exit 0 → **STOP and roll back** (§7).

---

### Phase 7 — Deploy the cutover `[CURSOR prepares; push is `[HUMAN]`-approved]`

Only once verify is green.

```bash
git checkout feature/hackathon-neon-cutover
git rebase master                    # picks up the freeze commit
# Edit src/components/hackathon/hackathon-config.ts → registrationOpen: true
git add src/components/hackathon/hackathon-config.ts
git commit -m "chore(hackathon): reopen registration after Neon cutover"

npx tsc --noEmit && npm run build    # must pass before deploying

git checkout master
git merge --no-ff feature/hackathon-neon-cutover
git push origin master               # ← [HUMAN] approval required: deploys the cutover
```

**Smoke-test on production immediately:**
1. An **existing migrated registrant** opens `/hackathon/dashboard` → **same team code**,
   same team name, same roster, same spots-left as before the migration.
2. A **new registration** succeeds and appears at `/admin/hackathon`.
3. A hackathon-only user hitting `/` and `/dashboard` is routed to
   `/hackathon/dashboard`; a genuine new 60-day user still reaches `/register`.

**GATE:** if the smoke test fails → roll back (§7).

---

### Phase 8 — Aftercare `[HUMAN]`

- **Leave the Supabase hackathon tables, `src/lib/hackathon-supabase.ts`, and
  `SUPABASE_SERVICE_ROLE_KEY` untouched for ≥7 days** (ideally until after the event).
  That is the rollback path. Removing them is a separate, later change.
- Set the problem statement via `/admin/hackathon` (not the Supabase table editor).

---

## 6. Guardrails for Cursor (DO NOT)

- **DO NOT** run `prisma db push`, `prisma migrate dev`, or `prisma migrate reset`
  against production. **`prisma migrate deploy` only.**
- **DO NOT** run any migrate/deploy step before the Phase 2 Neon snapshot is confirmed.
- **DO NOT** change `DATABASE_URL` without changing `DIRECT_URL` to the same endpoint id
  (non-pooled), in both `.env` and `.env.local` as applicable — the script and the app
  resolve env precedence in **opposite** directions.
- **DO NOT** print, echo, log, or commit any connection string, password, or API key.
  **Hosts only.**
- **DO NOT** treat a green exit from `hackathon:migrate` as success without
  `hackathon:verify` — and fix the silent `exit(0)` (Phase 4a) before running it.
- **DO NOT** skip, drop, or auto-create unmatched participants. Unmatched ⇒ print and
  stop. Bare `User` inserts cause `OAuthAccountNotLinked` lockouts.
- **DO NOT** deploy the Prisma cutover while the Neon hackathon tables are empty or
  `hackathon:verify` has failed.
- **DO NOT** dual-write to both databases.
- **DO NOT** regenerate `team_code` values, or alter `createdAt` — participants have
  already shared their codes.
- **DO NOT** delete `src/lib/hackathon-supabase.ts`, drop the Supabase hackathon tables,
  or remove `SUPABASE_SERVICE_ROLE_KEY` until verify + smoke pass and ≥7 days elapse.
- **DO NOT** touch `src/lib/workshop-supabase.ts`, `/ai-workshop`,
  `/ai-cohort-register`, or the admin cohort views.
- **DO NOT** change any user-facing hackathon error string.
- **DO NOT** push to `master` without explicit human approval — both `master` pushes in
  this plan deploy to production.
- **DO NOT** add `requireAdmin`/`requireRole` to the public hackathon pages or the
  registration action.

## 7. DB safety and rollback

**Before any write:** Neon production branch snapshot (Phase 2), commit `1c51f66`
recorded, and a Supabase CSV export.

**Why rollback is cheap:** the migration script only ever **reads** Supabase. The
Supabase tables remain authoritative and untouched throughout, and production keeps
running the Supabase code path until Phase 7.

**Rollback procedure:**
- *Verify failed (Phase 6):* set `registrationOpen: true` on `master`, push, redeploy.
  Production is back to the Supabase path with zero data loss. Investigate before
  retrying.
- *Cutover deployed but broken (Phase 7):* `git revert` the merge commit on `master` and
  push. The Supabase path returns. Any registrations captured in Neon during the window
  must be reconciled by hand before a second attempt.
- *Schema problem:* restore from the Neon branch snapshot.

## 8. Verification

**Before the freeze:**
- `npx prisma migrate status` prints host `ep-nameless-term-ams9a5e3…` and, after
  Phase 3, "up to date".
- `npm run hackathon:preflight` exits 0: 0 unmatched, 0 ambiguous, 0 duplicates, Neon
  tables empty.
- `npx tsc --noEmit` passes.

**After migrating:**
- `npm run hackathon:verify` exits 0.
- `HackathonTeam` count == Supabase `hackathon_teams` count (≈36).
- `HackathonParticipant` count == Supabase `hackathon_participants` count (≈40).
- Team-code set-diff empty **in both directions**.
- `SELECT "teamId", COUNT(*) FROM "HackathonParticipant" GROUP BY 1 HAVING COUNT(*) > 3;`
  → **0 rows**.
- `SELECT "teamId" FROM "HackathonParticipant" GROUP BY 1 HAVING COUNT(*) FILTER (WHERE "isLeader") <> 1;`
  → **0 rows**.
- Every participant has a `userId` resolving to a real `User`.
- `HackathonEvent` empty is **expected** (no `hackathon_event` table in Supabase).

**Before deploying the cutover:** `npx tsc --noEmit && npm run build` both pass.

**Expected changed files from this plan:** `scripts/migrate-hackathon-to-neon.ts`,
`package.json`, `src/components/hackathon/hackathon-config.ts` — plus the Phase 1 branch
commit carrying the pre-existing cutover work. Anything touching
`src/lib/workshop-supabase.ts`, `/ai-workshop`, `/ai-cohort-register`, `middleware.ts`,
or `src/components/ui/` means something went off-plan.

## 9. Commit messages

All four are reproduced inline at their step:
1. Phase 1 — `refactor(hackathon): migrate from Supabase to Neon/Prisma` (full body in Phase 1).
2. Phase 4 — `fix(hackathon): harden migration preflight` (full body in Phase 4).
3. Phase 6 — `chore(hackathon): freeze registration for Neon migration`.
4. Phase 7 — `chore(hackathon): reopen registration after Neon cutover`.

## 10. Timing note for the owner `[HUMAN]`

Kickoff is **2026-08-07**. Registration is live and growing, so every day widens the
dataset and the freeze window. Run Phases 1–7 in **one sitting**. If that is not possible
before **~2026-08-01**, stop: run the event on Supabase and migrate afterwards. A data
migration in the final week before the event is not worth the risk.
