# T-022 Test Environment Assessment

**Follow-up to** [`114-t022-talent-search-persistence.md`](114-t022-talent-search-persistence.md)
**Code:** `master` @ `99f79b07` · **Date:** 2026-09-07
**Nothing was written anywhere.** No schema change, no migration, no seed run, no test
data, no production write.

---

## 1. Reachable environments

| # | Environment | Classification |
|---|---|---|
| 1 | Neon `ep-young-shadow-amawetjy-pooler…/neondb` (`DATABASE_URL`) | **PRODUCTION** |
| 2 | Neon `ep-proud-band-am3sduhv…/neondb` (`DIRECT_URL`) | **UNKNOWN** — unreachable |
| 3 | **Local PostgreSQL 16.14 on `/tmp:5432`** | **SAFE** |
| 4 | Neon child branch | **UNKNOWN** — cannot be created from this machine |
| 5 | Vercel preview deployments | **UNKNOWN** — no access to verify |

**A safe environment exists.** A local PostgreSQL server is running and has no ABTalks
database on it. That is the answer to the blocker.

---

## 2. Evidence

### 1 — `DATABASE_URL` is production

- `.env.local`: `DATABASE_URL="postgresql://neondb_owner:***@ep-young-shadow-amawetjy-pooler.c-5.us-east-1.aws.neon.tech/neondb"`
- Read-only counts on it: `User` 12,805 · `Submission` 15,645 · `RecruiterProfile` 2 ·
  `TalentRequest` 3 · seeded `@abtalks.dev` test users **0**
- `_prisma_migrations` newest entry applied 2026-09-05 07:46

### 2 — `DIRECT_URL` is a different endpoint and unreachable

- `.env.local`: `DIRECT_URL="postgresql://neondb_owner:***@ep-proud-band-am3sduhv.c-5.us-east-1.aws.neon.tech/neondb"`
- Different endpoint id from `DATABASE_URL` (Neon normally pairs one id with a `-pooler`
  suffix). Every connection attempt returns `Can't reach database server`.
- Unresolved from the earlier PR #254 work. It is `prisma migrate deploy`'s target, so it
  cannot be assumed to be the same database as #1.

### 3 — Local PostgreSQL is running and empty of ABTalks

```
$ pg_isready
/tmp:5432 - accepting connections

$ psql -l
 eatnow      | eatnow
 local_shops | shashank
 postgres    | shashank
 template0   | shashank
 template1   | shashank
```

- PostgreSQL **16.14** (Homebrew), owner `shashank`, socket `/tmp:5432`
- `psql`, `createdb`, `pg_dump` all on `PATH`
- **No ABTalks database exists yet** — a new one is a `createdb` away and touches nothing
- The documented reason `prisma migrate deploy` is banned is production-specific:
  *"Production still carries a leftover migration folder `20260813000000_general_interview`
  … Because of it, `prisma migrate deploy` cannot be used on production"*
  ([project-context.md:939](../project-context.md)). A fresh local database has no such
  history, so that constraint does not apply to it.

### 4 — A Neon child branch cannot be created from here

| Tool / credential | Status |
|---|---|
| `neonctl` | NOT INSTALLED |
| `vercel` CLI | NOT INSTALLED |
| `NEON_*` / `VERCEL_*` in `.env.local` | none |
| Neon or Vercel MCP server | not authorized in this session |

The rule in [project-context.md:969](../project-context.md) — *"All Neon mutations must
target a production child branch"* — is documented, but the repo contains no script,
command, or documented procedure for creating one.

### 5 — Vercel preview cannot be verified

No Vercel CLI and no authorized Vercel MCP server, so the environment variables bound to
preview deployments cannot be read. A preview typically inherits the production
`DATABASE_URL` unless a preview-scoped override exists; whether one exists here is
**unknown and must not be assumed**.

### 6 — Sign-in is already solved

- `ENABLE_DEV_AUTH="true"` in `.env.local`, consumed at
  [auth.ts:69](../../src/auth.ts#L69) — a `dev-credentials` provider that matches
  `User.password` as plaintext ([auth.ts:86](../../src/auth.ts#L86)).
- The login page renders it when the flag is on ([login/page.tsx:103](../../src/app/login/page.tsx#L103)).
- No email, no OTP, no SMS needed for the journey.

### 7 — The fixtures for this exact test already exist

[`prisma/seed-hire-fixtures.ts`](../../prisma/seed-hire-fixtures.ts), wired as
`npm run db:seed:hire` ([package.json:52](../../package.json#L52)). Its own header:
*"Seed 3 program members with varied evidence for Scout scoring QA."*

- 3 program members with varied evidence → the "at least 3 matched candidates" the
  journey asks for
- An **approved** recruiter at [:210-227](../../prisma/seed-hire-fixtures.ts#L210):
  `recruiter@hire.abtalks.dev` / password `test`, `role: RECRUITER`,
  `approved: true`
- `approved: true` matters: `persist = recruiter.status === "approved"`
  ([hire/page.tsx:20](../../src/app/hire/page.tsx#L20)). An unapproved recruiter persists
  nothing, and the test would measure the wrong thing.

---

## 3. Safe path for the T-022 manual test

Local PostgreSQL, no Neon involvement, no production connection at any point.

1. **Create the database** — `createdb abtalks_t022`
2. **Point a scratch env at it**, e.g. `.env.test.local`, with `DATABASE_URL` and
   `DIRECT_URL` both set to `postgresql://shashank@localhost:5432/abtalks_t022`, and
   `AUTH_SECRET`, `ENABLE_DEV_AUTH=true` carried over. **Do not edit `.env.local`** —
   one forgotten revert and the next command is against production.
3. **Create the schema** — `prisma db push`, not `migrate deploy`. A fresh database needs
   no migration history, and `db push` sidesteps the leftover-migration problem entirely.
4. **Seed** — `npm run db:seed:hire`
5. **Run** — `npm run dev`, sign in at `/login` as `recruiter@hire.abtalks.dev` / `test`
6. **Perform the journey** — search, record criteria, record 3 candidates, open some,
   shortlist, note if reachable
7. **The return leg must use a different browser profile, or clear site data first.**
   This is not optional. Six `localStorage` keys carry recruiter state — `abtalks-hire-star`,
   `abtalks-hire-cart`, `abtalks-hire-requested`, `abtalks-hire-guest-matches`,
   `abtalks-hire-evidence`, plus the guest session. Sign-out does not clear them, so on
   the same profile the shortlist will look persistent when it is not, and the test will
   report a false pass.
8. **Inspect** — read the local DB directly alongside the UI, so "the UI does not show it"
   and "the database does not have it" stay distinguishable.

### One risk to verify at step 5, before drawing conclusions

The search gate is
[`searchableUserWhere()`](../../src/repositories/talent.ts#L29):

```ts
{ deletedAt: null, visibility: { is: { searchableByRecruiters: true, withdrawnAt: null } } }
```

`visibility: { is: … }` requires a `CandidateVisibility` **row to exist**.
`searchableByRecruiters` defaults to `true` ([schema.prisma:2103](../../prisma/schema.prisma#L2103)),
but a default only applies to a row that is created. `seed-hire-fixtures.ts` sets
`recruiterVisibilityConsentAt` ([:136](../../prisma/seed-hire-fixtures.ts#L136), [:146](../../prisma/seed-hire-fixtures.ts#L146))
and creates no visibility row.

**If the search returns zero candidates, this is why, and it is a stale fixture — not a
finding about persistence.** Confirm the seed produces matches before running the
journey. Repairing the fixture is a code change and therefore outside P1.

---

## 4. Blocker

**No blocker remains for running the test.** The local PostgreSQL path above needs no
new access, no credential, and no decision from anyone. It was available all along and
the earlier report missed it.

Two things still need a decision, neither of which blocks T-022:

1. **`DIRECT_URL` is unresolved.** It is a different Neon endpoint from `DATABASE_URL`,
   it is unreachable, and it is what `prisma migrate deploy` targets. PR #254 cannot be
   applied safely until someone with Neon access says which branch it is and re-runs the
   duplicate check there.
2. **Neon child-branch capability does not exist on this machine.** `project-context.md`
   mandates child branches for Neon mutations; nothing here can create one. If that
   workflow is expected to be usable, someone needs to provide `neonctl` plus an API key,
   or the documented rule stays unenforceable.

### Separate safety finding — not part of T-022, but it should not wait

**Every production guard in the seed scripts is stale and fails open.**

Five files hardcode the old endpoint id:

| File | Guard |
|---|---|
| [seed-hire-fixtures.ts:17](../../prisma/seed-hire-fixtures.ts#L17) | `["ep-nameless-term-ams9a5e3", ".main."]` |
| [seed-program-test-users.ts:33](../../prisma/seed-program-test-users.ts#L33) | same |
| [seed-databricks.ts:22](../../prisma/seed-databricks.ts#L22) | `"ep-nameless-term-ams9a5e3"` |
| [seed-ds-architect.ts:22](../../prisma/seed-ds-architect.ts#L22) | same |
| [seed-powerbi.ts:22](../../prisma/seed-powerbi.ts#L22) | same |

The current production host is `ep-young-shadow-amawetjy-pooler.c-5.us-east-1.aws.neon.tech`.
It matches **neither** pattern. Every one of these guards would let the seed run straight
into production today. `seed-program-test-users.ts` also checks `NODE_ENV === "production"`
([:150](../../prisma/seed-program-test-users.ts#L150)), which is false on a developer's
machine, so it does not help either.

Worse: [`prisma/cleanup.ts`](../../prisma/cleanup.ts) — behind
`npm run db:cleanup:test | :real | :all` — contains **no production guard at all**. No
host check, no `NODE_ENV` check.

Anyone who runs a seed or cleanup with the current `.env.local` writes to production, and
the code that is supposed to stop them will not. This is a small fix and a large blast
radius. It is a code change, so it is out of scope for P1 and is flagged, not made.

---

## 5. DO NOT IMPLEMENT

Nothing was implemented. No schema change, no migration, no code change, no test data,
no production write. All database access was `SELECT` / `count` / `aggregate`, plus
`pg_isready` and `psql -l` against the local server.

The single artefact of this investigation is this file.
