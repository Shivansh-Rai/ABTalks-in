# 045 — Migrate Hackathon Data from Supabase to Neon (Prisma)

## 1. Goal

Move the hackathon tables (`hackathon_teams`, `hackathon_participants`,
`hackathon_event`) out of the isolated workshop Supabase into the main Neon/Prisma
database, linking each participant to their ABTalks `User` with a real foreign key.
Along the way: make registration writes atomic with `prisma.$transaction`, add an
`/admin/hackathon` view with CSV export, and move the problem statement into the admin
UI. **Live registration data must be migrated without loss.**

## 2. Why this is worth doing (the premise changed)

Plan `041` chose Supabase for explicit reasons: registration was **public / no-login**,
so it needed no Prisma migration and carried no identity. Cursor then made registration
**session-gated** — `/hackathon/register` requires auth and
`submitHackathonRegistrationAction` takes the email from the Google session
([hackathon-actions.ts:66](src/app/actions/hackathon-actions.ts:66)). That original
justification no longer holds, and the split now costs:

1. **Identity is split across two databases.** The `User` row is in Neon; the
   participant row is in Supabase, joined by an email *string* — no FK, no cascade, no
   join, no integrity.
2. **No transactions.** supabase-js has no transaction API, so the action hand-rolls a
   compensating delete for orphan teams
   ([hackathon-actions.ts:165](src/app/actions/hackathon-actions.ts:165)). `prisma.$transaction`
   makes team+leader creation genuinely atomic — a correctness fix, not tidiness.
3. **A cross-DB call on the hottest path.** Plan `044` put a Supabase round-trip into
   `/`, `/dashboard`, and `/login` for every profile-less user
   ([hackathon-supabase.ts:77](src/lib/hackathon-supabase.ts:77)). On Neon it folds into
   the Prisma queries those pages already run.
4. **Service-role key risk.** The RLS-bypassing key sits in a module one bad client
   import away from leaking. Prisma is structurally server-only.
5. **Neon branch snapshots** — the documented DB-safety workflow (CLAUDE.md §17,
   `docs/project-context.md` §17) — currently do not cover hackathon data at all.
6. **Admin tooling reuse:** `requireAdmin`, Prisma `select`, `lib/csv.ts`, and the
   existing admin nav all assume Prisma.

**Scope decision:** hackathon tables only. The workshop / AI-cohort Supabase tables
(`registrations`, `workshop_config`, `cohort_applications*`) stay put — they're
genuinely separate microsites with no tie to ABTalks identity. `@supabase/supabase-js`
remains a dependency and `src/lib/workshop-supabase.ts` is untouched.

## 3. Current state

- Plans 041–044 are all implemented and **registration is live**
  (`registrationOpen: true`, kickoff `2026-08-07T14:30:00Z`), with real registrations in
  Supabase. **This migration must preserve every row — and especially every
  `team_code`, because participants have already shared those codes with teammates.**
- Supabase shape today (from plan 041/042 DDL):
  - `hackathon_teams(id uuid, created_at, entry_type text SOLO|TEAM, team_name text, team_code text unique)`
  - `hackathon_participants(id uuid, created_at, team_id uuid FK, slot_index smallint 1..3, is_leader bool, full_name, email, phone, college, graduation_year smallint)`,
    `unique(team_id, slot_index)`, unique index on `lower(email)`
  - `hackathon_event(id smallint =1, problem_statement text, updated_at)`
- All reads/writes go through [src/lib/hackathon-supabase.ts](src/lib/hackathon-supabase.ts)
  (9 exported helpers) and [src/app/actions/hackathon-actions.ts](src/app/actions/hackathon-actions.ts).
- `User.email` is `String @unique` and **non-nullable**
  ([schema.prisma:225](prisma/schema.prisma:225)) — so backfilling `userId` from the
  participant email is a clean 1:1 join.

## 4. Files to touch

### Schema + migration

| Path | New/Edit | Note |
|---|---|---|
| `prisma/schema.prisma` | `[edit]` | Add `HackathonEntryType` enum + 3 models + `User.hackathonParticipant` back-relation. |
| `scripts/migrate-hackathon-to-neon.ts` | `[new]` | One-off, idempotent, abort-on-unmatched data migration. |
| `package.json` | `[edit]` | Add `"hackathon:migrate"` and `"hackathon:verify"` scripts. |

### Data layer (replaces the Supabase module)

| Path | New/Edit | Note |
|---|---|---|
| `src/features/hackathon/get-my-registration.ts` | `[new]` | `getMyRegistration(userId)`. |
| `src/features/hackathon/team-lookup.ts` | `[new]` | `getTeamByCode`, `isTeamNameTaken`, `getTeamLeader`. |
| `src/features/hackathon/registration-status.ts` | `[new]` | `isUserRegistered(userId)`, `hackathonRedirectForProfilelessUser(userId)`. |
| `src/features/hackathon/get-hackathon-event.ts` | `[new]` | `getHackathonEvent()`. |
| `src/features/hackathon/get-admin-data.ts` | `[new]` | Teams + participants + stats for the admin view. |
| `src/lib/hackathon-supabase.ts` | `[delete]` | **Only after** migration is verified. |

### Callers

| Path | New/Edit | Note |
|---|---|---|
| `src/app/actions/hackathon-actions.ts` | `[edit]` | Prisma + `$transaction`; drop compensating delete. |
| `src/app/hackathon/dashboard/page.tsx` | `[edit]` | Import from `@/features/hackathon`, pass `userId`. |
| `src/app/hackathon/register/page.tsx` | `[edit]` | Same. |
| `src/components/hackathon/hero.tsx` | `[edit]` | Same. |
| `src/app/page.tsx` | `[edit]` | `hackathonRedirectForProfilelessUser(session.user.id)`. |
| `src/app/dashboard/page.tsx` | `[edit]` | Same. |
| `src/app/login/page.tsx` | `[edit]` | Same. |

### Admin

| Path | New/Edit | Note |
|---|---|---|
| `src/app/admin/hackathon/page.tsx` | `[new]` | Stats, team list, CSV export, problem-statement editor. |
| `src/components/admin/hackathon-view.tsx` | `[new]` | **Client** — table + CSV download + editor form. |
| `src/app/actions/admin-hackathon-actions.ts` | `[new]` | `updateHackathonProblemStatementAction` (admin-gated + `AdminAction` audit row). |
| `src/app/admin/layout.tsx` | `[edit]` | Add the `/admin/hackathon` nav item. |
| `src/components/admin/admin-sidebar.tsx` | `[edit]` | Add `"hackathon"` to `IconName` **and** `iconMap`. |
| `src/components/admin/admin-mobile-nav.tsx` | `[edit]` | **Same edit again — second, separate icon map.** |

**Not touched:** `src/lib/workshop-supabase.ts`, `/ai-workshop`, `/ai-cohort-register`,
the admin cohort views, `middleware.ts`, `auth.ts` / `auth.config.ts`,
`src/components/ui/`.

## 5. Prisma schema

Add to `prisma/schema.prisma`:

```prisma
enum HackathonEntryType {
  SOLO
  TEAM
}

model HackathonTeam {
  id           String                 @id @default(cuid())
  entryType    HackathonEntryType
  teamName     String?
  teamCode     String                 @unique
  createdAt    DateTime               @default(now())
  participants HackathonParticipant[]

  @@index([createdAt(sort: Desc)])
}

model HackathonParticipant {
  id             String   @id @default(cuid())
  teamId         String
  userId         String   @unique
  slotIndex      Int
  isLeader       Boolean  @default(false)
  fullName       String
  email          String
  phone          String
  college        String
  graduationYear Int
  createdAt      DateTime @default(now())

  team HackathonTeam @relation(fields: [teamId], references: [id], onDelete: Cascade)
  user User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([teamId, slotIndex])
  @@index([teamId])
}

/// Singleton (id always 1) — event-wide config editable from /admin/hackathon.
model HackathonEvent {
  id               Int      @id @default(1)
  problemStatement String?
  updatedAt        DateTime @updatedAt
}
```

And on `model User`, add the back-relation:
```prisma
  hackathonParticipant HackathonParticipant?
```

**Design notes (deliberate, don't "simplify"):**
- `userId @unique` is now the duplicate-entry guard — FK-backed and strictly stronger
  than the old `lower(email)` unique index. It also gives cascade delete: removing a
  `User` cleanly removes their participation.
- `email` is **kept but non-unique** — a snapshot of what they registered with, needed
  for CSV export/contact without a join, and preserved from the migration. Note it can
  diverge from `User.email` if someone later switches Google accounts (plan 043); that
  is intended.
- `@@unique([teamId, slotIndex])` is carried over verbatim — it remains the concurrency
  guard that prevents a 4th member (see §7).

## 6. Migration mechanics (live data — order matters)

### Step 1 — Checkpoint

```
git add -A && git commit -m "checkpoint before hackathon Neon migration"
```
Note the commit hash. **Create a Neon branch snapshot** of the current database
(CLAUDE.md §17). Also export the Supabase tables to CSV from the Supabase UI as a second
backup.

### Step 2 — Schema migration (safe, additive, zero downtime)

Add the models above, then:
```
npx prisma migrate dev --name hackathon_tables
npx prisma generate
```
This only **creates** three empty tables and one enum. It touches no existing table and
is safe to deploy while the Supabase-backed site is still live.

### Step 3 — `scripts/migrate-hackathon-to-neon.ts` `[new]`

A one-off Node script (run with `tsx`, like `prisma/cleanup.ts`). Requirements:

1. Reads `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL`.
2. Fetches **all** rows from `hackathon_teams`, `hackathon_participants`,
   `hackathon_event` (no `.limit()` — page through if needed).
3. **Pre-flight resolve, before writing anything:** for every participant, look up
   `prisma.user.findUnique({ where: { email: p.email.toLowerCase() }, select: { id: true } })`.
   Build a `Map<supabaseParticipantId, userId>`.
   - **If ANY participant has no matching `User`: print every unmatched row
     (email + team code) and ABORT with a non-zero exit. Do not write partial data, do
     not skip rows silently.** (Expected count of unmatched: zero, since registration is
     session-gated — a non-zero count means something needs a human decision.)
4. **Also abort** if two participants resolve to the same `userId` (would violate
   `userId @unique`) — print both rows.
5. Writes inside a single `prisma.$transaction`:
   - Insert each team, **preserving `team_code` and `created_at` exactly** (new `id` is
     a fresh cuid; keep a `Map<oldTeamUuid, newTeamCuid>`).
   - Insert each participant with the mapped `teamId`, resolved `userId`, and original
     `slot_index`, `is_leader`, `full_name`, `email`, `phone`, `college`,
     `graduation_year`, `created_at`.
   - Upsert `HackathonEvent` id 1 with the Supabase `problem_statement`.
6. **Idempotent:** at start, if `prisma.hackathonTeam.count() > 0`, print the counts and
   exit 0 without writing (re-running must never duplicate).
7. Prints a summary: teams read/written, participants read/written, event migrated y/n.

**Team codes are the single most important thing to preserve** — participants have
already shared them with teammates. The script must never regenerate them.

### Step 4 — `scripts` in `package.json` `[edit]`

```json
"hackathon:migrate": "tsx scripts/migrate-hackathon-to-neon.ts",
"hackathon:verify":  "tsx scripts/migrate-hackathon-to-neon.ts --verify"
```
`--verify` performs read-only comparison only: row counts per table, and a set-diff of
`team_code` values and participant emails between Supabase and Neon. Exits non-zero on
any mismatch.

### Step 5 — Cutover sequence (short freeze, minutes)

Do **not** dual-write; at this scale a brief freeze is simpler and safer.

1. Set `registrationOpen: false` in
   [hackathon-config.ts](src/components/hackathon/hackathon-config.ts) → deploy.
   (The register page already renders a "Registration is closed" card and the action
   already refuses — [hackathon-actions.ts:68](src/app/actions/hackathon-actions.ts:68).)
2. Wait ~1 minute for in-flight requests to settle.
3. `npm run hackathon:migrate` against **production** `DATABASE_URL`.
4. `npm run hackathon:verify` — must exit 0 with matching counts.
5. Deploy the code switch (Steps 6–8 below) **with `registrationOpen: true` restored**.
6. Smoke-test on production: load `/hackathon/dashboard` as an existing registrant and
   confirm their team, code, and roster are identical to before.
7. **Leave the Supabase tables in place, untouched, for at least 7 days** as a rollback
   path. Drop them only after the event, in a separate change.

**Rollback:** if verification fails, revert to the checkpoint commit and redeploy — the
Supabase tables are still authoritative and untouched, since the migration only ever
*reads* from Supabase.

## 7. Code changes

### `src/features/hackathon/*` `[new]` — replaces `src/lib/hackathon-supabase.ts`

Port each helper to Prisma, keeping the **same return shapes** (`HackathonMember`,
`MyRegistration`, `HackathonTeamLookup`) so the existing components need no prop
changes. Follow repo conventions: always use `select`, never return full records.

- `getMyRegistration(userId: string)` — **now keyed by `userId`, not email.** One query
  with a nested `select` on `team.participants` (ordered by `slotIndex`) replaces the
  three sequential Supabase round-trips
  ([hackathon-supabase.ts:119-169](src/lib/hackathon-supabase.ts:119)). Member rows must
  select **only** `fullName, college, isLeader, slotIndex` — never `email`/`phone` (the
  privacy rule from plan 042 stands).
- `getTeamByCode(code)` — `findUnique({ where: { teamCode: code.toUpperCase() } })` with
  `_count.participants` for `spotsLeft`.
- `isTeamNameTaken(name)` — case-insensitive: `findFirst({ where: { teamName: { equals: name, mode: "insensitive" } } })`.
- `getTeamLeader(teamId)`, `getHackathonEvent()` — direct ports.
- `isUserRegistered(userId)` / `hackathonRedirectForProfilelessUser(userId)` — **signature
  changes from email to userId.** Keep the fail-open `try/catch → null` behavior exactly
  (plan 044 depends on it so a Neon hiccup never traps a new 60-day registrant).

### `src/app/actions/hackathon-actions.ts` `[edit]`

- Keep `auth()` gating, the Zod parse, `registrationOpen` check, and every user-facing
  message string **verbatim** — messages are already tested/known.
- Duplicate check becomes `isUserRegistered(session.user.id)`.
- **SOLO / TEAM_CREATE** — replace the create-then-compensating-delete with:
  ```ts
  await prisma.$transaction(async (tx) => {
    const team = await tx.hackathonTeam.create({ data: {...}, select: { id: true, teamCode: true } });
    await tx.hackathonParticipant.create({ data: { teamId: team.id, userId, slotIndex: 1, isLeader: true, ... } });
    return team;
  });
  ```
  Orphan teams are now structurally impossible. **Delete the compensating-delete block.**
- Team-code collision: catch Prisma `P2002` (unique violation) on `teamCode` and retry,
  max 5 attempts — same shape as today, but keyed on the Prisma error code instead of
  Postgres `23505`. Keep the `TEAM_CODE_ALPHABET` (no I/O/0/1) exactly as-is.
- **TEAM_JOIN** — keep the recompute-and-retry race handler, now catching `P2002` on
  `@@unique([teamId, slotIndex])`. Wrap the read-slot + insert in a `$transaction`.
  **Do not** replace the unique constraint with a count check; it is still the only
  thing preventing a 4th member.

### Caller updates

`page.tsx`, `dashboard/page.tsx`, `login/page.tsx` pass `session.user.id` instead of
`session.user.email`. `hackathon/dashboard/page.tsx`, `hackathon/register/page.tsx`, and
`hero.tsx` import from `@/features/hackathon/*` and pass `userId`. No component props or
UI change.

## 8. Admin view (`/admin/hackathon`)

- `page.tsx` — Server Component, `await requireAdmin()` first line. Loads
  `getAdminData()`: total teams, total participants, solo vs. team counts, teams with
  open spots, and the full roster.
- `hackathon-view.tsx` — Client. Table of teams (code, name, entry type, members
  `n/3`, created) expandable to members (name, email, phone, college, grad year — admin
  context, so contact details are appropriate here). "Export CSV" button using the
  existing `toCSV` + `downloadCSV` from [lib/csv.ts](src/lib/csv.ts).
- **Problem-statement editor**: textarea + save, calling
  `updateHackathonProblemStatementAction` in
  `src/app/actions/admin-hackathon-actions.ts`. That action must:
  `await requireAdmin()`, Zod-validate (`z.string().max(5000)`), `upsert` `HackathonEvent`
  id 1, write an `AdminAction` audit row (`actionType: "UPDATE_HACKATHON_PROBLEM"`) in the
  same `$transaction`, and `revalidatePath("/hackathon/dashboard")` so it appears
  immediately. Returns the standard result envelope.
- Nav: add `{ href: "/admin/hackathon", label: "Hackathon", icon: "hackathon" as const }`
  to [admin/layout.tsx:13](src/app/admin/layout.tsx:13), **and add `"hackathon"` to the
  `IconName` union + `iconMap` in BOTH
  [admin-sidebar.tsx:19](src/components/admin/admin-sidebar.tsx:19) AND
  [admin-mobile-nav.tsx:22](src/components/admin/admin-mobile-nav.tsx:22)** — they are two
  separate copies and missing either one breaks the build or the mobile nav. Suggested
  icon: `Code2` or `Trophy` from lucide-react.

## 9. Guardrails for Cursor (DO NOT)

- **DO NOT** delete `src/lib/hackathon-supabase.ts`, drop the Supabase tables, or remove
  `SUPABASE_SERVICE_ROLE_KEY` until `hackathon:verify` passes on production and the
  smoke test is done. The Supabase data is the rollback path.
- **DO NOT** let the migration script skip an unmatched participant. Unmatched ⇒ print
  and abort, non-zero exit. Losing a registrant is the worst possible outcome here.
- **DO NOT** regenerate `team_code` values during migration. Participants have already
  shared them.
- **DO NOT** touch `src/lib/workshop-supabase.ts`, `/ai-workshop`,
  `/ai-cohort-register`, or the admin cohort views. Supabase stays for those, and
  `@supabase/supabase-js` stays in `package.json`.
- **DO NOT** run `prisma migrate` / the data script without the Neon branch snapshot and
  commit checkpoint from §6 Step 1.
- **DO NOT** use `prisma db push` — use `prisma migrate dev` so a migration file is
  committed.
- **DO NOT** drop `@@unique([teamId, slotIndex])` or replace the retry logic with a plain
  count-then-insert. It is the only guard against a 4-person team.
- **DO NOT** select or expose teammates' `email`/`phone` in `getMyRegistration` — the
  participant-facing roster stays name + college + leader flag. (Admin view may show
  contact details.)
- **DO NOT** change any user-facing message string in `hackathon-actions.ts`.
- **DO NOT** forget the **second** icon map in `admin-mobile-nav.tsx`.
- **DO NOT** add `requireAdmin` to the public hackathon pages/actions — `/hackathon`,
  `/hackathon/register`, and the registration action keep their current gating.
- **DO NOT** return full Prisma records — always `select`. No `any`, no `console.*`
  (use `logger`).
- **DO NOT** import `@/features/hackathon/*` from `middleware.ts` (keep it edge-safe) or
  from any `"use client"` file.

## 10. Verification

**Build/typecheck:**
```
npx tsc --noEmit
npm run build
```

**Data integrity (the critical part):**
```
npm run hackathon:verify     # must exit 0
```
Then in the Neon SQL editor / Prisma Studio confirm:
- `HackathonTeam` count == Supabase `hackathon_teams` count.
- `HackathonParticipant` count == Supabase `hackathon_participants` count.
- Every `team_code` in Supabase exists in Neon (set-diff empty, **both directions**).
- Every participant has a non-null `userId` resolving to a real `User`.
- No team has more than 3 participants:
  `SELECT "teamId", COUNT(*) FROM "HackathonParticipant" GROUP BY 1 HAVING COUNT(*) > 3;`
  → zero rows.
- Exactly one leader per team:
  `SELECT "teamId", COUNT(*) FILTER (WHERE "isLeader") FROM "HackathonParticipant" GROUP BY 1 HAVING COUNT(*) FILTER (WHERE "isLeader") <> 1;`
  → zero rows.
- `HackathonEvent` has exactly one row (id 1) with the problem statement preserved.

**Greps:**
```
grep -rn "hackathon-supabase" src/                  # zero hits after cutover
grep -rn "SUPABASE_SERVICE_ROLE_KEY" src/           # zero hits after cutover
grep -rn "workshop-supabase" src/                   # UNCHANGED (workshop still uses it)
```

**Manual test script (production, post-cutover):**
1. **Existing registrant** (migrated): open `/hackathon/dashboard` → same team name,
   **same team code**, same roster, same spots-left as before the migration.
2. **New solo registration** → succeeds; dashboard shows "Your entry".
3. **New team create** → code issued; `HackathonTeam` + `HackathonParticipant` both
   exist (transaction worked).
4. **Join with that code** from a second account → roster 2/3.
5. **Fill to 3, then attempt a 4th** → "That team is already full."
6. **Duplicate registration** with an already-registered account → "You're already
   registered with this email."
7. **Taken team name** → "That team name is already taken. Pick another."
8. **Plan 044 routing still works:** a hackathon-only user hitting `/` and `/dashboard`
   is diverted to `/hackathon/dashboard`; a genuine new 60-day user still reaches
   `/register`.
9. **Admin:** `/admin/hackathon` lists all teams, CSV exports, and editing the problem
   statement immediately shows on a participant's dashboard (post-kickoff).
10. Non-admin hitting `/admin/hackathon` → redirected to `/dashboard`.

**Expected changed files** — the lists in §4, plus
`prisma/migrations/<timestamp>_hackathon_tables/`. Anything touching
`workshop-supabase.ts`, `/ai-workshop`, `/ai-cohort-register`, `middleware.ts`, or
`src/components/ui/` means Cursor went off-plan.

## 11. Commit message

```
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
```

## 12. Follow-ups (not in this plan)

- **Drop the Supabase hackathon tables** + remove `SUPABASE_SERVICE_ROLE_KEY` — separate
  change, ≥7 days after a verified cutover (ideally after the event).
- **Submission intake** (GitHub repo + live URL + PROMPTS.md) — still deferred from plan
  042, and now much easier to build on Prisma.
- Judging/scoring, and surfacing hackathon participation on the student profile (now a
  trivial join thanks to the FK).
