# 124 — Database restore drill (T-260)

**Performed 2026-09-09. Production was read-only throughout — `pg_dump` only.**

> **⚠️ READ THIS FIRST — what this drill did and did not prove.**
>
> This restore was performed from **a dump taken at drill time**, not from a scheduled
> backup. It proves that *a* dump of production can be restored and verified. It does
> **not** prove that any backup pipeline works, because §1 found that no backup pipeline
> exists. Do not read this document as "our backups are verified".

---

## 1. What we actually have — investigated before starting

**There is no stored backup artifact and no backup pipeline in this repository.**

| Searched for | Result |
|---|---|
| `pg_dump` / `pg_restore` / "backup" in `package.json`, `scripts/`, `prisma/scripts/`, `.github/` | **none found** |
| a backup runbook in `docs/` | **none found** |
| any `*.dump` / `*.sql.gz` / `*backup*.sql` on disk | **none found** |
| `neonctl` / Vercel CLI / `NEON_*` credentials | **not installed / not present** |

The only backup mechanism mentioned anywhere is
[project-context.md:971](../project-context.md) — *"Create a Neon branch as a snapshot"* —
and the Neon control plane is unreachable from this machine, so it could neither be used
nor verified.

**Finding: the team's backup story is Neon's platform-level snapshotting, which nobody on
this machine can invoke, inspect or restore from.** That is the gap this drill exposes and
does not close.

---

## 2. The blocker found before any data moved

The first attempt failed immediately:

```
pg_dump: error: aborting because of server version mismatch
pg_dump: detail: server version: 17.11 (32e7196); pg_dump version: 16.14 (Homebrew)
```

**Production runs PostgreSQL 17.11. The `pg_dump` on `PATH` was 16.14 and refuses to dump
a newer server.** In a real incident this is the first command anyone would run, and it
would have failed.

The fix needed no installation — `postgresql@17` was already present via Homebrew but
keg-only, so its binaries were not on `PATH`:

```
/usr/local/opt/postgresql@17/bin/pg_dump   →  17.11   ✅ matches production
```

**Action for the team: the restore runbook must pin the client version, and the machine
that performs a restore must have PG17 binaries on `PATH`.**

---

## 3. Measured durations

| Step | Duration | Notes |
|---|---|---|
| Start PG17 target instance | ~10 s | `initdb` + `pg_ctl start` |
| **Backup — `pg_dump` from production** | **421 s (7 min 1 s)** | exit 0, 24 MB custom-format |
| **Restore — `pg_restore -j 4`** | **4 s** | exit 0 |
| Verification | ~30 s | |
| `prisma migrate status` | 2 s | |
| **Total, dump to verified** | **≈ 8 minutes** | |

**The network dump is 99% of the cost.** Restoring 24 MB to local disk took four seconds;
pulling it out of Neon took seven minutes at roughly 0.06 MB/s.

### Context — do not quote the total as an RTO

| | |
|---|---|
| Machine | local laptop, macOS, PostgreSQL 17.11 (Homebrew) |
| Network | ordinary broadband to Neon `us-east-1`, over the **pooler** endpoint |
| Data | 197 MB on-disk production database, 123 tables, 24 MB compressed dump |
| Not measured | restoring **into** Neon (only into local disk); a larger database; a contended network; the direct (non-pooler) endpoint, which was unreachable |

A real incident would very likely be slower: bigger data, restore over the network rather
than to local disk, and a person under pressure reading a runbook for the first time.
**Treat ≈8 minutes as a floor, not an RTO.**

> **The 4-second restore is the most misleading number in this document.**
>
> It is 4 seconds because the data went onto a local SSD. **In a real recovery you would not
> restore to a local Postgres — you would restore into Neon or a new managed instance, over
> the network.** The restore time measured here is therefore *not* the restore time of an
> actual recovery, and the real one will be materially longer.
>
> Do not put "restore: 4 seconds" on a slide. The only honest reading of this drill is that
> **pulling 24 MB out of Neon took 7 minutes**, and that the restore leg has not yet been
> measured against a realistic target.

---

## 4. Verification — what was checked

`exit 0` was not treated as proof. Every one of these was compared.

### 4.1 Restore output

```
restore.log   0 lines · 0 errors · 0 warnings · 0 fatal
dump-err.log  0 lines
```

### 4.2 Row counts — production vs restored copy

| | Production | Restored | |
|---|---|---|---|
| `User` | 12,806 | 12,806 | ✅ |
| `Submission` | 15,645 | 15,645 | ✅ |
| `AdminAction` | 281 | 281 | ✅ |
| `TalentRequest` | 3 | 3 | ✅ |
| `TalentRequestMatch` | 40 | 40 | ✅ |
| `HackathonParticipant` | 8,293 | 8,293 | ✅ |
| `Enrollment` | 3,188 | 3,188 | ✅ |
| `CandidateVisibility` | 12,804 | 12,804 | ✅ |

### 4.3 Schema objects — the part row counts miss

| | Production | Restored | |
|---|---|---|---|
| tables | 123 | 123 | ✅ |
| indexes | 400 | 400 | ✅ |
| foreign keys | 148 | 148 | ✅ |
| all constraints | 272 | 272 | ✅ |
| enum types | 68 | 68 | ✅ |
| **extensions** | `pg_trgm, plpgsql` | `pg_trgm, plpgsql` | ✅ |
| sequences | 0 | 0 | ✅ |

**Extensions matter** — `pg_trgm` is a common silent omission, and a restore that drops it
leaves fuzzy search broken with no error.

**Sequences are 0 by design**, not by omission: Prisma uses `cuid()` text primary keys, so
the classic "restored database, sequences not advanced, next insert collides" bug does not
apply here. That was verified rather than assumed:

### 4.4 Writability / primary-key test

```sql
BEGIN;
INSERT INTO "User" (id,email,role,"createdAt","updatedAt") VALUES (…);   -- INSERT 0 1
SELECT COUNT(*) FROM "User";                                             -- 12807
ROLLBACK;
```

Insert succeeded, no PK collision, and the transaction was rolled back so the copy is
unchanged.

### 4.5 Representative application queries

Run against the restored copy, matching the figures independently measured against
production:

| Query | Result |
|---|---|
| recruiter-search visibility gate — `User ⋈ CandidateVisibility` | **66** searchable candidates |
| challenge pool — `Enrollment ⋈ Submission`, `HAVING COUNT >= 10` | **337** |
| `TalentRequest` with match and message counts (3-way) | `Full Stack Developer 0/1` · `Backend engineer 20/7` · `AI engineer 20/7` |

---

## 5. The repeatable procedure

Copy-pasteable. **No connection string appears anywhere below** — export it first and never
paste it into a document, a ticket, or a chat.

```bash
# ── 0. Prerequisites ────────────────────────────────────────────────────────
#    PostgreSQL 17 client binaries must be on PATH. Production is 17.11 and
#    pg_dump refuses to dump a newer server than itself.
export P17=/usr/local/opt/postgresql@17/bin
"$P17/pg_dump" --version          # must report 17.x
export DATABASE_URL='...'         # production URL — never write it down

# ── 1. Working directory, OUTSIDE any git repository ────────────────────────
export DRILL=~/restore-drill-$(date +%Y%m%d)
mkdir -p "$DRILL" && cd "$DRILL"

# ── 2. Start an isolated PG17 target (port 5433 — 5432 may be in use) ───────
export SOCK=/tmp/pgd17 && mkdir -p $SOCK
"$P17/initdb" -D "$DRILL/pgdata17" -U "$USER" --encoding=UTF8 --locale=en_US.UTF-8
"$P17/pg_ctl" -D "$DRILL/pgdata17" -o "-p 5433 -k $SOCK" -l "$DRILL/pg17.log" start

# ── 3. Backup — READ ONLY on production ─────────────────────────────────────
#    -Fc  custom format: compressed, and pg_restore can parallelise it
#    Takes an ACCESS SHARE lock. Do NOT run during a migration deploy.
date +%s > dump.start
"$P17/pg_dump" "$DATABASE_URL" -Fc --no-owner --no-privileges \
  -f "$DRILL/prod.dump" 2>&1 | tee "$DRILL/dump.log"
date +%s > dump.end
echo "dump seconds: $(( $(cat dump.end) - $(cat dump.start) ))"

# ── 4. Restore ──────────────────────────────────────────────────────────────
"$P17/createdb" -h $SOCK -p 5433 -U "$USER" restored_prod
date +%s > restore.start
"$P17/pg_restore" -h $SOCK -p 5433 -U "$USER" -d restored_prod -j 4 \
  --no-owner --no-privileges "$DRILL/prod.dump" 2>&1 | tee "$DRILL/restore.log"
date +%s > restore.end
echo "restore seconds: $(( $(cat restore.end) - $(cat restore.start) ))"

# ── 5. Read the log even if the exit code was 0 ─────────────────────────────
wc -l < "$DRILL/restore.log"
grep -ci error   "$DRILL/restore.log"
grep -ci warning "$DRILL/restore.log"

# ── 6. Verify — run this block against BOTH databases and diff the output ───
"$P17/psql" -h $SOCK -p 5433 -U "$USER" -d restored_prod -X -t -A <<'SQL'
SELECT 'users='       ||COUNT(*) FROM "User";
SELECT 'submissions=' ||COUNT(*) FROM "Submission";
SELECT 'tables='      ||COUNT(*) FROM information_schema.tables WHERE table_schema='public';
SELECT 'indexes='     ||COUNT(*) FROM pg_indexes WHERE schemaname='public';
SELECT 'fkeys='       ||COUNT(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
                        WHERE n.nspname='public' AND c.contype='f';
SELECT 'extensions='  ||string_agg(extname,',' ORDER BY extname) FROM pg_extension;
SELECT 'sequences='   ||COUNT(*) FROM information_schema.sequences WHERE sequence_schema='public';
SQL

# ── 7. Writability test — insert and roll back ──────────────────────────────
"$P17/psql" -h $SOCK -p 5433 -U "$USER" -d restored_prod -c \
  'BEGIN; INSERT INTO "User" (id,email,role,"createdAt","updatedAt")
   VALUES (:''t'',:''e'',''STUDENT'',now(),now()); ROLLBACK;' \
  -v t=drill_test_pk -v e=drill@restore.test

# ── 8. Tear down and clean up ───────────────────────────────────────────────
"$P17/pg_ctl" -D "$DRILL/pgdata17" stop
#    The dump and the data directory contain REAL USER DATA — 12,806 people.
#    Delete both once the drill is recorded. Never commit them.
rm -rf "$DRILL"
```

### Data-handling rules for this drill

1. **The dump is production personal data.** 12,806 users with emails. Keep it outside any
   git repository — this drill used a path outside the repo, and `.gitignore` already
   covers `*.dump` patterns only incidentally, so do not rely on it.
2. **Never paste the connection string** into the procedure, a ticket, a screenshot or a
   chat. Use `$DATABASE_URL`.
3. **Delete the dump and the restored data directory** as soon as the drill is recorded
   (step 8). This drill's artefacts are under
   `scratchpad/restore-drill/` and are pending deletion — see §7.
4. `pg_dump` is read-only but takes an **ACCESS SHARE** lock. **Do not run it while a
   migration is deploying.**

---

## 6. Separate finding — `prisma migrate status` on the restored copy (D-2)

Kept separate because the deliverable is the restore, not this.

```
51 migrations found in prisma/migrations
Your local migration history and the migrations table from your database are different:
The last common migration is: 20260905120000_redemption_structured_address

The migration have not yet been applied:
  20260905120000_talent_request_persistence

The migration from the database are not found locally in prisma/migrations:
  20260908190000_event_scoped_hackathon
```

Two separate causes, and only one is a real problem:

1. `talent_request_persistence` is **ours**, unapplied by design (PR #254, not merged).
2. `20260908190000_event_scoped_hackathon` **is in production but not on this branch** —
   it exists on `upstream/master`, which this branch is **20 commits behind**. Expected
   branch drift, not database drift.

**But this drill did not clear D-2.** A separate check of `_prisma_migrations` checksums
against the repo found **6 migrations whose files changed after they were applied** —
`20260604043632_add_synergy_and_optional_submission_proofs`,
`20260604052219_add_synergy_and_optional_proof_urls`,
`20260604053901_add_jobs_and_applications`, `20260902120000_candidate_resume`,
`20260902160000_candidate_resume_enrichment`, `20260902190000_candidate_resume_merge_log`.
`prisma migrate deploy` rejects a modified migration, so **D-2's rehearsal still has to
face those six.** `migrate status` reports history divergence first and never reaches them.

---

## 7. What this drill leaves open

| # | Item |
|---|---|
| 1 | **No backup pipeline exists.** This restored a drill-time dump. A scheduled, stored, offsite backup is not in the repository and was not tested. |
| 2 | **Neon's own snapshot/branch restore was never exercised** — no `neonctl`, no API key. That is the mechanism `project-context.md:971` actually relies on. |
| 3 | **Restore was to local disk, not into Neon.** Restoring *into* a Neon branch is untimed and unproven. |
| 4 | **D-2 is not closed** — see §6. |
| 5 | **The drill artefacts still exist** at `scratchpad/restore-drill/` (24 MB dump + a full PG17 data directory, both containing real user data) and must be deleted. |
| 6 | The `DIRECT_URL` endpoint remains unreachable, so the dump used the pooler. Neon documents the direct endpoint as preferable for dumps; whether it is faster here is **unmeasured**. |
| 7 | **The full recovery path is untested.** Restoring is step one of: dump → new Neon database → connection-string swap → app restart → Prisma migration state reconciled → smoke test. Only step one was performed. |
| 8 | **RPO is unknown.** This drill measured something like an RTO. Nobody has established Neon's point-in-time-recovery retention window — 1 day, 7, 30? If a corruption is five days old and retention is 24 hours, restore speed is irrelevant. **This is a one-click answer in the Neon console and matters more than the 8 minutes above.** |
| 9 | **Access is a single point of failure.** This machine has no `neonctl` and no Neon API key. Who can reach the Neon console during an incident, and how many people? If the answer is one person, and they are on leave, having a backup and not having one are the same thing. **UNKNOWN — not answerable from the repository.** |
| 10 | **"Anyone on the team can repeat it" is not yet proven.** Only the author has run this procedure. The cheapest validation is to have a second person follow it cold while the author watches and fixes whatever they trip on. |

---

## 8. Summary

| | |
|---|---|
| Restore performed | **yes** — production → isolated PG17 instance |
| Verified | **yes** — 8 row counts, 7 schema-object counts, extensions, writability, 3 application queries; all match |
| Errors / warnings | **0 / 0** in both the dump and the restore logs |
| Duration | **backup 421 s · restore 4 s · ≈8 min end to end** |
| Repeatable procedure | **yes** — §5 |
| Production modified | **no** — `pg_dump` only |
| Backup *pipeline* verified | **NO** — none exists (§1) |
| Full recovery path verified | **NO** — restore is step one of six (§7) |
| RPO / retention window known | **NO** — never asked (§7) |
| Procedure proven repeatable by a second person | **NO** — author only (§7) |

**Evidence:** [`124-restore-drill-evidence/`](124-restore-drill-evidence/)
