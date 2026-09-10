# 124 — restore drill evidence (2026-09-09)

Raw output from the drill described in `../124-database-restore-drill.md`.

| File | What it is |
|---|---|
| `timings.txt` | measured durations and dump size |
| `verify-production.txt` | counts read from production (read-only) |
| `verify-restored.txt` | the same counts read from the restored copy |
| `restore.log` | `pg_restore` output — empty, meaning zero errors |
| `dump-err.log` | `pg_dump` stderr — empty |
| `migrate-status.txt` | `prisma migrate status` against the restored copy |

Contains no credentials and no personal data — checked before committing. The 24 MB dump
and the 331 MB restored data directory both held real user data and were deleted after the
drill; they are deliberately not here.
