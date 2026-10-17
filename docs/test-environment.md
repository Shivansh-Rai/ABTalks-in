# The test environment

A self-contained copy of the whole platform — all four tracks, the admin spine
and the hire desk — on a local throwaway database, with a seeded cast you can
be, scenarios you can apply, and candidate / recruiter / admin sessions all
signed in **at the same time in one browser**.

Plan: [`docs/plans/195-test-environment-and-suite.md`](plans/195-test-environment-and-suite.md).

---

## Why it exists

Two problems.

**One browser, one identity.** `auth.config.ts` declares a single session
cookie, `authjs.session-token.v2`, host-only with no `domain`. Candidate,
recruiter and admin all sign in to that one cookie, so signing in at `/hire`
used to evict the session at `/dashboard`. That is what "the cookies are getting
messed up" was — structural, not cache corruption.

**Nowhere safe to test.** `.env` and `.env.local` both point `DATABASE_URL` at a
Neon host with ~13k real users. There was no database on the machine you could
seed, mutate and wipe, and the 107 `test:*` scripts are all unit-level —
nothing drove the product.

The session fix needed **no authentication change at all**. Because the cookie
is host-only and every `*.localhost` name resolves to loopback, each host is an
independent cookie jar:

| Host | Who lives there |
| --- | --- |
| `localhost:3100` | candidates (arjun, priya, rohan, vikram, dhruv, anika, karan, meera) |
| `candidate.localhost:3100` | a second candidate jar (sneha, fresh) |
| `recruiter.localhost:3100` | recruiter, recruiter2 |
| `admin.localhost:3100` | admin |
| `program.localhost:3100` | the AI-cohort member |
| `hackathon.localhost:3100` | the hackathon participant |

Three tabs, three live sessions, and `src/auth.ts`, `src/auth.config.ts` and
`middleware.ts` are untouched.

---

## First run

```bash
npm run test:env:setup        # Postgres, role, database, 99 migrations
npm run test:env:bootstrap    # content + the cast (wipes and re-seeds)
npm run test:env:dev          # the server, on port 3100
```

Then open **http://localhost:3100/dev/test-console**, which lists every seeded
identity and signs you in as any of them.

`setup` is written for Homebrew Postgres on macOS. On Linux the equivalent is
your distribution's `postgresql` package plus:

```bash
sudo -u postgres psql -c "CREATE ROLE abtalks_test LOGIN PASSWORD 'abtalks_test' SUPERUSER"
sudo -u postgres createdb -O abtalks_test abtalks_test
psql "postgresql://abtalks_test:abtalks_test@localhost:5432/abtalks_test" -c 'CREATE EXTENSION IF NOT EXISTS pg_trgm'
DATABASE_URL=postgresql://abtalks_test:abtalks_test@localhost:5432/abtalks_test \
  DIRECT_URL=$DATABASE_URL npx prisma migrate deploy
```

### Port 3100, never 3000

`npm run dev` on 3000 talks to the **live** Neon database. The test environment
is always 3100, with its own build directory (`.next-test/`), so the two can run
side by side and can never be confused in a tab, a bookmark or a test's base URL.

---

## What is guaranteed to exist

Fifteen identities, defined once in `src/lib/test-env.ts` and created by
`scripts/test-env/bootstrap.ts`. Every one of them ends in `@abtalks.dev`,
which is not incidental: that suffix is what `db:cleanup:test` deletes by.

Passwords are `test`, except the admin, which is `admin`.

| Key | Track | Notes |
| --- | --- | --- |
| `arjun` `priya` `rohan` | challenge | day 7 — SE, DS and AI domains |
| `sneha` | challenge | day 7, in a **second** candidate jar |
| `vikram` `dhruv` `anika` | challenge | days 15, 20, 30 |
| `karan` | challenge | day 40 — inside the recruiter-discoverable range |
| `meera` | challenge | day 60, COMPLETED — certificates, talent visibility |
| `admin` | admin | holds a live `UserRoleAssignment` GLOBAL ADMIN grant |
| `recruiter` | recruiter | Test Hiring Co, $200 desk |
| `recruiter2` | recruiter | **a different organization** — the isolation counterparty |
| `program` | AI cohort | enrolled in the 31-day program |
| `hackathon` | hackathon | solo team |
| `fresh` | — | signed in with **no** `CandidateProfile`; lands on `/register` |

### Two things about the admin that will cost you an afternoon

**The grant, not the role.** `db:seed` sets `User.role = ADMIN` and writes no
`UserRoleAssignment`, and `hasPlatformAdmin` trusts only that row. The bootstrap
adds the grant explicitly. Liveness is `revokedAt IS NULL` — never edit `role`
to revoke.

**`ENABLE_DEV_AUTH=true` is load-bearing.** `isGoogleOnlyAccount` refuses a
password sign-in for anyone who is an admin, by `ADMIN_EMAILS`, by `User.role`
or by a live grant. That is a deliberate production property: admin accounts
come in through Google. Google is not configured here, so without that flag the
admin has no door at all and the entire admin half of the environment is
unreachable. The flag is itself gated on `NODE_ENV` not being production, so it
cannot weaken anything deployed.

A corollary: `admin-grant` makes its target an admin, which means that identity
can no longer sign in by password either. `admin-revoke` gives it its door back.

---

## Scenarios

```bash
npm run test:env:fixture -- --list
npm run test:env:fixture -- candidate-day --key=karan --day=45
npm run test:env:fixture -- recruiter-credits --dollars=350 recruiter-pipeline
npm run test:env:reset        # back to the baseline
```

Each fixture is **idempotent** (running it twice leaves what running it once
did) and **narrow** (it changes what its name says and nothing else), so they
compose. Several in one command are applied in order.

| Fixture | What it does |
| --- | --- |
| `candidate-day` | moves a challenge candidate to a day (1–60) |
| `candidate-broken-streak` | mid-challenge with a lapsed streak — the relaxation window |
| `recruiter-credits` | sets a desk's balance, in dollars |
| `recruiter-empty-desk` | $0 and no lists — the paywall and empty states |
| `recruiter-pipeline` | five of the cast spread across pipeline stages |
| `program-day` | moves the AI-cohort member's day and score (1–31) |
| `hackathon-submitted` / `hackathon-open` | with and without a team submission |
| `admin-grant` / `admin-revoke` | platform admin on and off |
| `clear-rate-limits` | drops every recorded rate-limit event |
| `unregister` | strips a `CandidateProfile` so the identity lands on `/register` |

### What `candidate-day` does not do

It moves the day anchor and the progress counters. It does **not** invent
`ActivityAttempt` rows. So the dashboard's track card reads "Day 45 of 60" from
the anchor while the grid beside it still says "7 active days of 60", which
counts real attempts.

That is deliberate: synthesising attempts means fabricating submissions,
evaluations and points, and then no assertion about evaluation or points means
anything. Use it for whatever keys off the day number — unlocking, streak
windows, certificate eligibility — and use the real submission flow when the
work itself is what you are testing.

### If you add a fixture

Write through `src/repositories/`, not around it. Two of these fixtures
originally wrote rows that were perfectly correct and completely invisible:

- `recruiter-credits` set `CreditAccount.balance`, which is a **cache**. The
  product reads `balanceAfter` off the newest `CreditTransaction`, so the desk
  kept showing $200 however many times the fixture wrote 35000. It now appends a
  real `ADMIN_ADJUSTMENT` through `applyCreditChange`.
- `recruiter-pipeline` created a list called "Test pipeline". `/hire/pipeline`
  reads exactly one list, the one named `__pipeline:<recruiterProfileId>`, so
  the board said "No one in your pipeline yet" with five rows in the database.
  It now uses `pipelineListName` from the repository.

Both were invisible to the CLI, which reported complete success, and both were
caught the first time a browser looked at the page. If a fixture matters, assert
it in `e2e/`.

---

## The route-by-role sweep

```bash
npm run test:env:dev                                  # terminal 1
npm run test:env:smoke                                # terminal 2
npm run test:env:smoke -- --update                    # accept the matrix
npm run test:env:smoke -- --only=/hire,/admin         # one slice
```

46 routes × 7 audiences. It records an outcome per cell, compares the whole
matrix to `scripts/test-env/smoke-baseline.json`, and fails on any difference
and on any 5xx. A difference is not automatically a bug — it is something to
look at and then accept with `--update`.

It does **not** assert authorization, and cannot. The gated surfaces here answer
`200` with a loading shell and decide what to show after hydration:

```
/dashboard         anonymous → 200, visible text "Loading"
/hire/pipeline     anonymous → 200, "Please sign in to continue."
/challenge/today   candidate → 307 → /challenge/8
```

A sweep that read 200 as "served the product" would report a dozen security
leaks that are not there. So authorization lives in `e2e/`, where a browser can
see the screen, and the sweep does breadth: seven audiences over every route in
seconds, catching the day something starts throwing or quietly redirects
somewhere new.

**Memory.** Every route is compiled on demand and Turbopack holds the results; a
full sweep has walked the dev server to ~13 GB and been OOM-killed partway
through. If that happens the sweep says so and suggests slices. Restart the
server between them; each slice compares and updates only its own rows.

---

## The browser suite

```bash
npm run test:env:e2e          # starts the dev server if it is not already up
npm run test:env:e2e:ui
```

`e2e/auth.setup.ts` signs in once per identity through the real `password`
provider and leaves a `storageState` in `e2e/.auth/`; each spec picks one with
`test.use({ storageState: stateFor("recruiter") })`. Nothing forges a JWT — if
the provider breaks, the setup fails and the specs are skipped rather than
passing on a hand-made session.

`e2e/specs/session-isolation.spec.ts` is the acceptance test for this whole
environment: one browser context holding candidate, recruiter and admin sessions
at once, each surviving reloads of the others. If the session cookie ever grows
a `domain` attribute, that spec is what tells you.

Chromium is launched with `--host-resolver-rules=MAP *.localhost 127.0.0.1`, so
the per-host specs work on a machine whose own resolver does not map
`*.localhost` to loopback (glibc does not; macOS does), and with
`--no-proxy-server`, because a container that sets `HTTPS_PROXY` usually exempts
`localhost` but not `*.localhost`.

The suite runs **serially, one worker**: these tests share one database, and in
parallel one spec's fixture would land in the middle of another's assertions.
Each mutating test undoes its own fixtures; `npm run test:env:reset` is the belt
and braces.

### Known broken, on purpose

`e2e/specs/admin-and-tracks.spec.ts` has one `test.fixme`:
`/program/ai-cohort/dashboard` crashes on load for **every** audience — enrolled
member, admin and anonymous alike — showing "This page couldn't load". The
browser console carries `Rendered more hooks than during the previous render`,
with a stack that bottoms out inside Next's own `Router` and no component of
this codebase on it. The sweep sees it as `shell` for all seven roles. It is
recorded rather than quietly skipped; turn the test back on with the fix.

---

## Safety

The environment is built so it cannot reach anything real.

- **Every script refuses a non-loopback database.** `scripts/test-env/guard.ts`
  runs before a Prisma client is constructed, and it is an allow-list of
  loopback hosts rather than a deny-list of the Neon hosts somebody remembered.
  There is deliberately **no override flag**. `playwright.config.ts` makes the
  same check, since every worker loads it.
- **The console is gated three ways** — `NODE_ENV` is not production,
  `ENABLE_TEST_CONSOLE=true`, and a loopback `DATABASE_URL`. The last is the one
  that matters: a flag can be mis-set in a Vercel dashboard, but a Neon
  connection string cannot be made to look like `127.0.0.1`.
- **No mail credentials, no model API keys.** `.env.test` carries neither, so a
  test run cannot email a real person or spend money on a real model call. Do
  not add `BREVO_API_KEY` to it.
- **`.env.test` is committed on purpose**, and holds no real credential: a
  loopback database with a throwaway password and a test-only `AUTH_SECRET`, so
  the environment is reproducible from a clone.

---

## When something is wrong

| Symptom | Cause |
| --- | --- |
| `REFUSING TO RUN — this is not the test database` | `DATABASE_URL` is set in your shell and winning over `.env.test`. Unset it. |
| Every `/api/auth/*` route 404s, pages are fine | A corrupted Turbopack cache, usually after a hard kill of the dev server. `rm -rf .next-test` and restart. |
| The console renders `notFound()` | One of its three gates. `testConsoleRefusal()` in `src/lib/test-env.ts` says which. |
| The admin cannot sign in | `ENABLE_DEV_AUTH=true` missing from `.env.test`, or the identity holds an admin grant (see above). |
| Sign-ins start failing after several runs | The password rate limits: 100 per IP, 10 per account. `npm run test:env:fixture -- clear-rate-limits`. The sweep and the suite both clear them first. |
| The sweep dies with "the dev server stopped answering" | Out of memory. Restart the server and use `--only` slices. |
| A fixture reports success and the screen does not change | It is writing somewhere the product does not read. See "If you add a fixture". |
| Pages on `*.localhost` arrive unstyled | That host is not in `ALLOWED_DEV_ORIGINS` in `.env.test`, so Next is refusing it `/_next/*`. |
