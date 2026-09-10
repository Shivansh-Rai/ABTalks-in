# 115 — TalentRequest schema drift / P2022 investigation

**Branch:** `feat/talent-request-persistence` @ `c2acf158` · **Date:** 2026-09-07
**Type:** P1 investigation. Read-only against production. No code changed, no migration applied.

---

# Executive Verdict

The schema mismatch is real and the P2022 root cause is confirmed by direct reproduction,
not inference. The feature branch's generated Prisma Client models `TalentRequest.name`,
`lastViewedAt` and `archivedAt`; production has none of them and has never recorded the
T-040 migration. Any Prisma query on this branch that returns a **full record** — that is,
any `create`/`update`/`upsert` without an explicit `select` — asks Postgres for those
columns and fails with `P2022`. `sendScoutMessageAction` contains exactly such a call at
[hire-actions.ts:264](../../src/app/actions/hire-actions.ts#L264), and because the action
uses **no transaction**, the request row and the recruiter's message are already committed
when it throws. That is precisely the debris seen in production: three `DRAFT` rows with
`title = ''` and `msgs = 1`. The recruiter-facing text *"Could not save message. Apply the
hire migration…"* is a generic catch-all; the "save" had in fact already succeeded, and
the migration advice pointed at the wrong database. **Nothing is wrong with production or
with master — the branch was simply run against a database that does not have its
migration.** Six further write paths on this branch carry the same latent fault.

---

# Production Schema

**Endpoint:** `host=ep-young-shadow-amawetjy-pooler.c-5.us-east-1.aws.neon.tech db=neondb`
(from `DATABASE_URL` in `.env.local`; credentials not printed). Verified read-only via
`information_schema` using raw SQL, so the stale generated client cannot influence the answer.

### `TalentRequest` — 24 columns

```
id, recruiterUserId, status, title, seniority, openings, mustHaveStack, niceToHaveStack,
evidencePriority, salaryMin, salaryMax, salaryCurrency, salaryPeriod, workMode,
locationCity, employmentType, noticePeriodDays, minExperience, maxExperience,
requiresDegree, extra, alertWhenAvailable, createdAt, updatedAt
```

| Field | Exists? | Evidence |
|---|---|---|
| `name` | **NO** | absent from the 24 columns above |
| `lastViewedAt` | **NO** | absent |
| `archivedAt` | **NO** | absent |

### `TalentRequestMatch` — 13 columns

```
id, requestId, candidateUserId, programMemberId, score, tier, scoreBreakdown, evidence,
rationale, gaps, availabilityUnknown, createdAt, source
```

| Field | Exists? | Evidence |
|---|---|---|
| `firstSeenAt` | **NO** | absent |
| `viewedAt` | **NO** | absent |
| `decision` | **NO** | absent |
| enum `TalentMatchDecision` | **NO** | `SELECT typname FROM pg_type` returns 0 rows |
| unique `(requestId, candidateUserId)` | **NO** | indexes are `_pkey`, `_requestId_score_idx`, `_candidateUserId_idx` only |

### Migration state

```
20260905160000_marketplace_item_sizes          finished 2026-09-05T11:43:44Z
20260905120000_redemption_structured_address   finished 2026-09-05T10:52:07Z
20260902190000_candidate_resume_merge_log      finished 2026-09-05T07:46:44Z
20260902160000_candidate_resume_enrichment     finished 2026-09-05T07:46:42Z
20260902120000_candidate_resume                finished 2026-09-05T07:46:40Z
20260829000000_mock_interview_platform         finished 2026-09-02T14:07:00Z
```

- `20260905120000_talent_request_persistence` recorded: **0 times**
- unfinished / rolled-back migrations: **none**

Production is internally consistent. It is simply older than this branch.

---

# Local / Test Schema

**Target:** `postgresql://***@localhost:5432/abtalks_t022` (from `.env.test.local`).
Local PostgreSQL 16.14. Confirmed not either Neon endpoint.

| Field | Exists? | Evidence |
|---|---|---|
| `TalentRequest.name` | **YES** | `text`, nullable |
| `TalentRequest.lastViewedAt` | **YES** | `timestamp without time zone`, nullable |
| `TalentRequest.archivedAt` | **YES** | `timestamp without time zone`, nullable |
| `TalentRequestMatch.firstSeenAt` | **YES** | `timestamp without time zone` |
| `TalentRequestMatch.viewedAt` | **YES** | `timestamp without time zone` |
| `TalentRequestMatch.decision` | **YES** | `USER-DEFINED` (the enum) |
| enum `TalentMatchDecision` | **YES** | present in `pg_type` |
| unique `(requestId, candidateUserId)` | **YES** | `TalentRequestMatch_requestId_candidateUserId_key` |

**Caveat that matters for the migration review:** this database was built with
`prisma db push`, not by applying `prisma/migrations/20260905120000_talent_request_persistence/migration.sql`.
`_prisma_migrations` does not exist here (0 rows in `information_schema.tables`). **The
migration SQL file itself has still never been executed anywhere.** `db push` proves the
*schema* is reachable; it does not rehearse the *migration*, including its backfill and
its unique-index creation.

A third database, `abtalks_t022_old`, was created locally for the reproduction below by
pushing **master's** `schema.prisma`. It has 24 `TalentRequest` columns and 0 T-040
columns — the same shape as production.

---

# P2022 Code Path

**File:** [src/app/actions/hire-actions.ts](../../src/app/actions/hire-actions.ts),
`sendScoutMessageAction`, declared at **:167**.

| Line | Statement | Returns | Safe against production? |
|---|---|---|---|
| **:224** | `prisma.talentRequest.create({ data, select: { id: true } })` | `{ id }` | **Yes** — explicit select |
| **:236** | `prisma.talentRequestMessage.findMany({ select: { role, content } })` | 2 fields | Yes |
| **:243** | `prisma.talentRequestMessage.create({ data })` | different model | Yes |
| **:254** | `runScoutTurn({...})` | LLM call | not a DB call |
| **:264** | `prisma.talentRequest.update({ where, data })` | **full `TalentRequest`** | **NO — throws P2022** |
| **:283** | `prisma.talentRequestMessage.create({ data })` | different model | never reached |

**Why the client expects `TalentRequest.name`.** `prisma generate` was last run on this
branch, whose `schema.prisma` declares the three new fields. With no `select`, Prisma's
default projection is the entire model, so the emitted statement is
`UPDATE "TalentRequest" SET … RETURNING id, …, "name", "lastViewedAt", "archivedAt"`.
Production has no such columns, so Postgres rejects it and Prisma surfaces
`P2022 { modelName: 'TalentRequest', column: 'TalentRequest.name' }`.

**Transaction boundaries: there are none.** `sendScoutMessageAction` contains no
`$transaction`. Statements at :224, :243, :264 and :283 are independent auto-committed
writes. When :264 throws, the request row (:224) and the recruiter's message (:243) are
**already committed and are not rolled back**.

**Where the error surfaces.** The throw is caught by the function-level `catch` at
**:308**, logged as `logger.error("[hire] sendScoutMessageAction", …)` at **:309**, and
replaced with the fixed string at **:313**:

> *"Could not save message. Apply the hire migration on your Neon branch if tables are missing."*

Both halves of that sentence mislead here. The message **was** saved. And the missing
migration is not on "your Neon branch" but on the production database the developer's
server was connected to.

### Reproduction (local replica, no production writes)

Ran the exact :224 → :243 → :264 sequence with this branch's client against
`abtalks_t022_old` (master schema, 24 columns):

```
STEP 1  create({select:{id}})            -> OK
STEP 2  message.findMany({select})       -> OK
STEP 3  message.create (user)            -> OK  <-- user message is COMMITTED here
STEP 4  talentRequest.update (no select) -> THREW P2022: TalentRequest.name
CONTROL update({select:{id}})            -> OK

row state after the failure: {"title":"","status":"DRAFT","msgs":1}
```

The residue is byte-for-byte the production symptom: `status = DRAFT`, `title = ''`,
`msgs = 1`. The control line shows the same `update` succeeds the moment an explicit
`select` is added — isolating the projection, not the write, as the fault.

---

# Cleanup Verification

Read-only. Nothing was restored.

| | Before | After | Expected |
|---|---|---|---|
| `TalentRequest` | 6 | **3** | 3 ✓ |
| `TalentRequestMessage` | 18 | **15** | 15 ✓ |
| `TalentRequestMatch` | 40 | **40** | unchanged ✓ |
| `User` | 12,805 | **12,805** | unchanged ✓ |
| `TalentRequest` with `title = ''` | 3 | **0** | 0 ✓ |
| `TalentEngagementRequest` | — | 2 | untouched |
| `RecruiterShortlistItem` | — | 0 | untouched |
| orphaned messages | — | **0** | 0 ✓ |

The three real searches are intact, with their message and match counts:

```
"Full Stack Developer"  ACTIVE   msgs=1  matches=0   created 2026-09-03
"Backend engineer"      MATCHED  msgs=7  matches=20  created 2026-09-03
"AI engineer"           MATCHED  msgs=7  matches=20  created 2026-09-04
```

Exactly 3 requests and 3 messages were removed: 6−3 and 18−15. No other row changed.
Backup present at `scratchpad/deleted-drafts-backup.json` (1,674 bytes), holding all three
requests (`DRAFT`, `title = ''`) and all three messages.

---

# Root Cause

**CONFIRMED**, each link supported by direct evidence rather than inference:

1. **Branch schema declares three new `TalentRequest` columns** — `prisma/schema.prisma`
   on `c2acf158`.
2. **`prisma generate` was last run on this branch**, so the client's default projection
   for `TalentRequest` includes `name`, `lastViewedAt`, `archivedAt`.
3. **Production has the old 24-column table** and 0 records of the T-040 migration —
   verified via `information_schema` and `_prisma_migrations`.
4. **A developer dev server was pointed at production.** `next dev` on port 3000 was
   launched without exporting `.env.test.local`, so Next loaded `.env.local` (production).
5. **`sendScoutMessageAction` reaches :264**, an `update` with no `select`, whose
   `RETURNING` clause names the missing columns.
6. **Postgres rejects it → `P2022`** — reproduced deterministically on a local replica of
   production's schema.
7. **No transaction**, so the request and the user message stay committed → three `DRAFT`
   rows with `title = ''`, `msgs = 1`.
8. **The catch at :308 masks it** with the fixed string at :313, which claims the save
   failed (it did not) and blames the wrong database.

Nothing in this chain is UNCERTAIN.

One point worth stating plainly: **this is not a production defect and not a master
defect.** Master's code and production's schema agree. The fault appears only when
branch code runs against a database that has not received the branch's migration.

---

# Other T-040 / T-044 Drift Risks

Scoped to TalentRequest / T-040 / T-044 only.

### Same class of fault — full-record return, would throw P2022 pre-migration

| Location | Call | Note |
|---|---|---|
| [hire-actions.ts:264](../../src/app/actions/hire-actions.ts#L264) | `talentRequest.update` | the confirmed one |
| [hire-actions.ts:463](../../src/app/actions/hire-actions.ts#L463) | `talentRequest.update` | sets status after a match run |
| [hire-actions.ts:600](../../src/app/actions/hire-actions.ts#L600) | `talentRequest.update` | |
| [run-hire-alerts.ts:112](../../src/features/hire/run-hire-alerts.ts#L112) | `talentRequest.update` | background alert job — fails without any UI to show it |
| [hire-actions.ts:449](../../src/app/actions/hire-actions.ts#L449) | `talentRequestMatch.upsert` | T-044. Also needs the unique key `requestId_candidateUserId`, which production does not have — this fails on the **argument** as well as the projection |

### Explicit T-040 field references — fail on the `select` itself

| Location | Fields |
|---|---|
| [load-request-matches.ts:68-69](../../src/features/hire/load-request-matches.ts#L68) | `lastViewedAt`, `archivedAt` (plus `name` at :65) |
| [load-request-matches.ts:84-86](../../src/features/hire/load-request-matches.ts#L84) | `firstSeenAt`, `viewedAt`, `decision` |

This is the crash already observed on 2026-09-07 when `/hire/[requestId]` rendered:
`Unknown field 'name' for select statement on model 'TalentRequest'`.

### Not at risk

- [hire-actions.ts:224](../../src/app/actions/hire-actions.ts#L224) — `create` with
  `select: { id: true }`
- [hire-actions.ts:548](../../src/app/actions/hire-actions.ts#L548) — `updateMany`, which
  returns only `{ count }` and never projects a record

### Separate finding — migration timestamp collision

This branch adds `prisma/migrations/20260905120000_talent_request_persistence/`.
Master carries `prisma/migrations/20260905120000_redemption_structured_address/`
(applied to production 2026-09-05 10:52). **Both use the prefix `20260905120000`.**

Since `upstream/master` was merged into this branch, the collision is no longer a
prediction — it exists in the branch tree now:

```
prisma/migrations/20260905120000_redemption_structured_address
prisma/migrations/20260905120000_talent_request_persistence
prisma/migrations/20260905160000_marketplace_item_sizes
```

Prisma orders by full folder name, so this is not fatal, but it makes ordering
non-obvious and reads as a mistake. The branch was originally cut from `e7026ec` and
therefore predated both `20260905120000_redemption_structured_address` and
`20260905160000_marketplace_item_sizes`; both arrived with the sync. Renaming the folder
to a later timestamp before merge is worth considering — flagged, not done.

---

# Safety Conclusion

- **Production was not modified during this investigation.** Every production statement was
  `SELECT` (raw SQL against `information_schema`, `pg_type`, `pg_indexes`,
  `_prisma_migrations`, and the talent tables).
- **No migration was applied.** `prisma migrate deploy` was not run. `prisma db push` was
  run **only** against `localhost:5432/abtalks_t022_old`, a local replica created for the
  reproduction, with the target asserted against both Neon endpoints beforehand.
- **No code was changed.** No file under `src/`, `prisma/schema.prisma`, or
  `prisma/migrations/` was touched. This report is the only artefact.
- **Master was not modified.** Local `master` is `99f79b07` and was never committed to.
  `upstream/master` has since advanced to `51357cc4` on its own (PRs #255, #256, #257) and
  was merged *into* this branch; nothing was pushed to master from here.
- `.env.local` was read but not edited.
- The reproduction wrote only to the local replica database.

---

# Recommended Next Step

Not implemented. Before this branch merges or its migration runs:

1. **Resolve `DIRECT_URL`.** It is a different Neon endpoint from `DATABASE_URL`
   (`ep-proud-band-am3sduhv` vs `ep-young-shadow-amawetjy`) and is unreachable.
   `prisma migrate deploy` targets `DIRECT_URL`, so the migration would be applied to a
   database nobody has inspected. The duplicate-pair pre-flight check must be re-run
   against the real migration target; the clean result from `DATABASE_URL` does not
   transfer.
2. **Rehearse the migration file itself**, not `db push`. The SQL — including the
   `lastViewedAt` backfill and the unique-index creation — has never executed anywhere.
   A Neon child branch is the documented place for this.
3. **Sohail's sign-off, especially Q3** (single `lastViewedAt` vs per-recruiter), which
   would change the schema and therefore the migration.
4. **Decide on the timestamp collision** before merge.
5. **Deploy order is not optional.** Because the failure mode is a full-record projection,
   the migration must land **before or with** the code. Code first means every recruiter
   hits P2022 on their first Scout message — and, with no transaction, leaves a committed
   orphan request behind each time.

Two hardening ideas surfaced but are explicitly **out of scope and not to be actioned
during a review freeze**: adding an explicit `select` to the five full-record writes, and
replacing the misleading catch text at :313. Both are code changes for a later task.

---

# INVESTIGATION STATUS

```
Schema mismatch:                    CONFIRMED
P2022 root cause:                   CONFIRMED
Cleanup integrity:                  CONFIRMED
Additional drift risks:             FOUND (6 write paths, 1 read path, 1 timestamp collision)
Code changes:                       NONE
Production writes during investigation: NONE
Migration applied:                  NO
```
