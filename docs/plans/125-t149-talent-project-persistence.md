# T-149 / TC-R-004 — Talent project with persistent criteria

> **Plan 125.** Belongs on branch `feat/talent-request-persistence` (where the
> foundation lives). Number 116 is already used: this branch has
> `116-t022-two-browser-forensics.md`, and `upstream/master` has
> `116-hackathon-team-code-and-roster.md`. This branch already carries 117–124.

---

## Corrections (re-investigated 2026-09-10) — READ BEFORE §3

The plan below is reproduced verbatim. Its **architecture (§4 onward) is correct
and matches the feature branch**. But several mechanical claims were written
against a repo state that does not exist in this checkout. The following
corrections **override** the original text wherever they conflict — especially
all of §3 and the migration/PR/numbering references.

**Verified true (no change):** every schema claim on
`origin/feat/talent-request-persistence` — `TalentRequest.{name,lastViewedAt,
archivedAt}`, `TalentRequestMatch.{firstSeenAt @default(now()), viewedAt,
decision}`, `@@unique([requestId, candidateUserId])`, `enum TalentMatchDecision`
(schema.prisma:1092–1212); `load-request-matches.ts` already selects/returns the
six values; `RecruiterShortlistItem` is program-track only. **B4 is real**:
`20260905120000_redemption_structured_address` and
`20260905120000_talent_request_persistence` share the exact timestamp — rename
is required.

**Wrong for this repo (measured):**

| Original claim | Reality |
|---|---|
| `upstream` = byteninjaa0/ABtalksapp; fast-forward from `upstream/master` | **No `upstream` remote.** Only `origin` = shashank-mishra08/ABtalksapp. §3 0c–0e fail. |
| "Branch off synced master, merge the foundation, **exactly four files conflict**" | **`origin/master` has no hire feature** (no `src/features/hire/`, no `src/app/hire/`, 0× `model TalentRequest`, newest migration July `20260731153045`). The persistence branch is **506 ahead / 0 behind** master. The foundation is not on master at all. |
| Master carries `20260908190000_*` / `20260909120000_*` | Don't exist; master tops out in July 2026. |
| "master is at 116 … this plan is **125**" | That numbering is now correct. This file was briefly `116-t149-…` and has been renamed to **125** so it does not collide with `116-t022-…` (this branch) or `116-hackathon-…` (`upstream/master`). |
| PR #254, DO NOT MERGE | Repo PRs are in the **#123–125** range; no #254. Branch is unmerged but not as #254. |
| Work from a clean `master` | Current checkout is `feat/abtalks-dev` with uncommitted changes. |

**Replacement for §3 (supersedes §3 entirely):** the foundation is the branch
itself — do not route through master.

```bash
git fetch origin feat/talent-request-persistence
git checkout -b feat/t149-talent-project-persistence origin/feat/talent-request-persistence
```

Then the only real prep that remains from the original §3 is the **migration
folder rename** (B4), exactly as written:

```
prisma/migrations/20260905120000_talent_request_persistence/
              →   20260910120000_talent_request_persistence/
```

`npx prisma generate` must still succeed afterward. Ignore the "four conflicts",
"fast-forward upstream", and "push origin master" steps — they do not apply.

Everything from §4 onward stands as written.

---

## 1. Context — what this is, and why it is not a greenfield task
A recruiter today uses `/hire` ("Scout"): they describe a role in conversation,
Scout builds a job spec, and a search returns ranked candidates. That work is
stored as a `TalentRequest` row (the brief) + `TalentRequestMessage` rows (the
transcript) + `TalentRequestMatch` rows (the last match run).

The ticket asks for that object to become a project that remembers six things:
its name, its criteria, the candidates returned, who was viewed, who was
shortlisted and who was rejected — and to restore all of it after sign-out, in a
different browser.

Three of those six already work. Three do not, and the reasons are structural:

| Item | Today | Why |
|---|---|---|
| Criteria | ✅ persists | `TalentRequest` mirrors `JobSpec` 1:1 |
| Candidates returned | ⚠️ last run only | `runMatchAction` does `deleteMany` then `createMany` — every re-run destroys history |
| Name | ❌ | no column; the list shows the role title, so two searches for the same role are indistinguishable |
| Viewed | ❌ | nothing anywhere records that a card was opened — client or server |
| Shortlisted | ⚠️ one track of four | `RecruiterShortlistItem.memberId` is a required FK to `ProgramMember`; CLAUDE / CHALLENGE_60 / HACKATHON candidates have no such row, so they fall back to localStorage `abtalks-hire-star` |
| Rejected | ❌ | no concept exists |

The load-bearing fact: most of the foundation is already written. Branch
`feat/talent-request-persistence` adds exactly the six columns this ticket
needs, plus the upsert that stops the match run from wiping them:

```
model TalentRequest      { + name String?  + lastViewedAt DateTime?  + archivedAt DateTime? }
model TalentRequestMatch { + firstSeenAt DateTime @default(now())  + viewedAt DateTime?
                           + decision TalentMatchDecision @default(UNDECIDED)
                           + @@unique([requestId, candidateUserId]) }
enum TalentMatchDecision  { UNDECIDED SHORTLISTED REJECTED }
```

`runMatchAction` on that branch upserts instead of delete+recreate, and
`loadRequestMatches` already selects and returns all six values.

What that branch deliberately did not do is write any of them: "T-040/T-044
build the place to keep match state and stop it being destroyed on re-run.
Nothing yet puts anything in it."

This task is the writers, the UI, and the sync work to get there.

## 2. Decisions taken (confirmed)
- Shortlisted / rejected live on `TalentRequestMatch.decision`, project-scoped.
  Keyed on `candidateUserId`, the only key all four tracks share, so a hackathon
  candidate can finally be saved. Per-project, which is what the ticket asks for,
  and it sidesteps org-scoping entirely. The global shortlist migration onto
  `TalentList`/`TalentListItem` is T-027, a separate HIGH-RISK task with a Sohail
  gate. Not this ticket.
- New branch off the persistence branch (see Corrections §3 replacement). The
  original PR stays open as the audit record.
- Local Postgres only. `DATABASE_URL` in `.env.local` points at production.
  Production apply is a separate, gated step — see §7.
- Projects stay scoped by `recruiterUserId`. No `organizationId` on
  `TalentRequest`. Every read already filters on `recruiterUserId`.

## 3. Step 0 — SUPERSEDED
See **Corrections → Replacement for §3** above. Branch off
`feat/talent-request-persistence`; do the migration rename; ignore the
upstream/master sync steps.

## 4. Architecture
`TalentRequest` is the project. No parallel `Project` model — "A search-brief
record already exists. EXTEND it — do not create a parallel project table."

```
TalentRequest  ── the project
  name          recruiter's label      ← rename action              [NEW WRITER]
  <18 spec cols> criteria              ← already written by sendScoutMessageAction
  lastViewedAt  last visit             ← stamped on project open    [NEW WRITER]
  archivedAt    filed away             ← optional, §6 step 9        [NEW WRITER]
  │
  ├── TalentRequestMessage   the Scout transcript      (already persists)
  └── TalentRequestMatch     one row per candidate
        firstSeenAt   first appearance  ← DB default, never updated (the upsert's whole point)
        viewedAt      opened by me      ← write-once on inspector open  [NEW WRITER]
        decision      UNDECIDED | SHORTLISTED | REJECTED ← triage       [NEW WRITER]
```

Two shortlists must not be confused. The desk card today carries
`ShortlistButton` ("Add to Shortlist" → `RecruiterShortlistItem`, program-track
only, else localStorage) which feeds the pod / cart used to place an intro
request. That is a basket for outreach, untouched by this ticket. What we add is
project triage: Shortlist / Reject on the match row. To stop the two reading as
the same thing, the existing pod button is relabelled "Add to request list" on
the desk card only (`podLabel` variant in `shortlist-button.tsx`) — copy change,
no behaviour change.

The `lastViewedAt` read-then-write ordering matters. The "new since your last
visit" badge is `firstSeenAt > lastViewedAt`. If the page stamps
`lastViewedAt = now()` during render, the badge is computed against the visit
that is happening, and nothing is ever new. So: the Server Component reads the
old value and renders badges from it; a client `useEffect` then calls a server
action to stamp the new one. A prefetch therefore does not count as a visit.

## 5. Files to touch
**New**

| Path | Note |
|---|---|
| `src/app/actions/talent-project-actions.ts` | all four new writers. Must be a separate file from `hire-actions.ts` — `match-persistence.test.ts` source-scans `hire-actions.ts` and fails if `viewedAt:` / `decision:` / `firstSeenAt:` appear there. That guard stays. |
| `src/features/hire/project-state.test.ts` | source-scan suite in the style of `visibility.test.ts` |

**Edited**

| Path | Change |
|---|---|
| `src/lib/validations/hire.ts` | `renameTalentProjectSchema`, `markMatchViewedSchema`, `setMatchDecisionSchema`, `markProjectOpenedSchema` |
| `src/features/hire/load-request-matches.ts` | already returns the six values; add the derived `isNew` boolean per match |
| `src/app/hire/page.tsx` | select `name` + `archivedAt`; exclude archived; pass `name ?? title` |
| `src/app/hire/[requestId]/page.tsx` | pass `name`, `lastViewedAt`, and per-match state into `ScoutChat` |
| `src/components/hire/scout-chat.tsx` | project-name field in the Requirement panel; stamp-visit effect; pass state to `MatchResults`; "Hide rejected" toggle |
| `src/components/hire/match-results.tsx` | thread `MatchState` + the decision callback through to the card |
| `src/components/hire/desk-match-card.tsx` | Shortlist / Reject controls, Viewed and New badges, rejected-card dim state |
| `src/components/talent/shortlist-button.tsx` | `podLabel` copy → "Add to request list" (copy only) |
| `src/app/hire/hire-scout.css` | styles for the badges, the triage row and the rejected state |
| `package.json` | `test:project-state` script |

**Explicitly NOT edited:** `src/features/hire/search-candidates.ts` ·
`score-candidate.ts` · `pool-brief.ts` · `spec-fields.ts` · `middleware.ts` ·
`auth.config.ts` · `src/features/talent-pool/pool.ts` · `RecruiterShortlistItem`
and everything reading it · `TalentList` / `TalentListItem` / `CandidateNote`.

## 6. Server vs Client
| Component | Boundary | Notes |
|---|---|---|
| `app/hire/page.tsx` | Server | projects list; plain serialisable rows only |
| `app/hire/[requestId]/page.tsx` | Server | reads old `lastViewedAt`, computes `isNew` per match, serialises Date → ISO string before crossing |
| `scout-chat.tsx` | Client | already client; owns the name input and the stamp-visit effect |
| `match-results.tsx`, `desk-match-card.tsx` | Client | receive `MatchCardData & { viewedAt, decision, isNew }` — all primitives |

Server→Client prop audit: no Date objects cross. `loadRequestMatches` returns
Dates today; the page must map them to ISO strings (or booleans) before passing.
No functions, no icons, no class instances.

## 7. Steps
1. **Branch + migration rename** — per Corrections §3 replacement. Branch off
   `feat/talent-request-persistence`; rename the migration folder;
   `npx prisma generate` must succeed.
2. **Local database.** A PostgreSQL 17 server is on this machine
   (`postgresql@17` via Homebrew, keg-only — put
   `/usr/local/opt/postgresql@17/bin` on PATH). `createdb abtalks_t149`, point a
   local-only env at it, `npx prisma migrate deploy`, then seed with
   `npm run db:seed` + `npm run db:seed:hire`. Never run a migration against
   `DATABASE_URL` as it stands.
3. **Validation schemas** — `src/lib/validations/hire.ts`. Every action takes
   `{ requestId }` and, where relevant, `{ candidateUserId }` + `{ decision }`.
   `name`: trimmed, 1–80 chars. `decision`:
   `z.enum(["UNDECIDED","SHORTLISTED","REJECTED"])`.
4. **`src/app/actions/talent-project-actions.ts`** — four actions, each opening
   with `requireApprovedRecruiter()` and each scoping its write by
   `recruiterUserId`:
   - `renameTalentProjectAction({ requestId, name })` →
     `updateMany({ where: { id, recruiterUserId }, data: { name } })`.
     `updateMany` not `update`, so a foreign id is a 0-row no-op.
   - `markProjectOpenedAction({ requestId })` →
     `updateMany({ …, data: { lastViewedAt: new Date() } })`.
   - `markMatchViewedAction({ requestId, candidateUserId })` → write-once:
     `talentRequestMatch.updateMany({ where: { requestId, viewedAt: null, candidateUserId, request: { recruiterUserId } }, data: { viewedAt: new Date() } })`.
     Idempotent, at most one write per candidate per project.
   - `setMatchDecisionAction({ requestId, candidateUserId, decision })` →
     `updateMany` with the same ownership predicate. Setting `UNDECIDED` is undo.

   All four return the `{ ok, data } | { ok, message }` envelope, log through
   `lib/logger.ts`, and `revalidatePath("/hire")` + `/hire/${requestId}`.
5. **Read path** — `load-request-matches.ts`. After the branch it already
   selects the six values. Add `isNew: firstSeenAt > (lastViewedAt ?? firstSeenAt)`
   per match, computed server-side. Keep `filterSearchableUserIds` exactly where
   it is: a saved match list is a discovery surface, so a candidate who has since
   gone private must still drop out.
6. **Project list** — `app/hire/page.tsx`: add `name`, `archivedAt` to the
   select, `where: { recruiterUserId, archivedAt: null }`, and pass
   `name ?? title` as the label with `updatedAt` as the last-activity date.
7. **Naming + visit stamp** — `scout-chat.tsx`. An inline "Name this project"
   field in the Requirement panel (`hire-req__`), defaulting to `name ?? title`,
   saved on blur via `renameTalentProjectAction`. Plus one mount effect: if
   `persist && requestId`, call `markProjectOpenedAction`. Guard with a ref so it
   fires once per mount.
8. **Triage UI** — `desk-match-card.tsx`. In the existing `desk-card__cta` row,
   beside "View more details":
   - Viewed badge when `viewedAt != null`; New badge when `isNew && !viewedAt`.
   - Shortlist and Reject buttons calling `setMatchDecisionAction`; the active
     one renders selected and clicking it again sets `UNDECIDED`.
   - `decision === "REJECTED"` → `desk-card--rejected` (dimmed, collapsed to one
     line, with an Undo). The row is never deleted — the rejection itself must
     restore.
   - The viewed write hangs off the existing `onOpen` path
     (`onOpen={setOpenMatch}` in `scout-chat.tsx`), the single "recruiter looked
     at this candidate" event.
   - Relabel the `podLabel` copy in `shortlist-button.tsx` to
     "Add to request list".
9. **Optional — archive (`archivedAt`).** The column ships with the migration.
   One action, one menu item; the list filter from step 6 already excludes
   archived rows. Drop first if the day runs short.
10. **Tests** — `src/features/hire/project-state.test.ts`, a source scan
    (no DB, no network), asserting:
    - a writer exists for each of `name`, `lastViewedAt`, `viewedAt`, `decision`;
    - every write in `talent-project-actions.ts` is an `updateMany` carrying a
      `recruiterUserId` predicate — no bare `update({ where: { id } })`;
    - the viewed write is guarded by `viewedAt: null`;
    - `desk-match-card.tsx` reads `decision`/`viewed` from props, and neither it
      nor `match-results.tsx` imports `desk-shortlist` / `guest-cart` for triage
      state (the ticket's "not localStorage" constraint, enforced mechanically);
    - `runMatchAction` still never assigns the three state columns — i.e.
      `match-persistence.test.ts` still passes unchanged.
    Register `test:project-state` in `package.json`.

## 8. Blockers and risks — read before starting

| # | Blocker | Status | Effect |
|---|---|---|---|
| B1 | The persistence branch is unmerged, awaiting Sohail's signature on five schema questions (`113-talent-request-persistence-audit.md` / schema-review) | OPEN | Everything here sits on those six columns. Branching off the branch unblocks local work; a production release still needs the signature. If `decision` is dropped, the shortlist/reject half needs a different home. |
| B2 | D-2 — `prisma migrate deploy` does not work on the production database (leftover `20260813000000_general_interview` folder); no migration merges until a rehearsal on a Neon child branch is recorded | OPEN | Blocks production apply for all pending migrations. Local Postgres is unaffected. |
| B3 | `DATABASE_URL` in `.env.local` is production; `DIRECT_URL` is a different, unreachable Neon endpoint | live hazard | Any careless `prisma migrate dev` hits real users. Step 2 prevents this. |
| B4 | Migration filename collision — `20260905120000` is shared by `_redemption_structured_address` (applied) and `_talent_request_persistence` | **CONFIRMED, fixable now** | Rename per Corrections §3. |
| B5 | Unique-index pre-flight — `@@unique([requestId, candidateUserId])` FAILS if duplicate pairs exist | prod unchecked | Before any production apply: `SELECT "requestId","candidateUserId",COUNT(*) FROM "TalentRequestMatch" GROUP BY 1,2 HAVING COUNT(*)>1;` must return zero rows. |
| B6 | No Neon or Vercel CLI, no `NEON_*` creds on this machine | OPEN | A child-branch snapshot can't be taken here. Someone with Neon access must, or the production step waits. |
| B7 | No CI, no test framework — tests are `tsx` scripts run by name; there is no `npm test` | structural | "Automated-test output" for the evidence pack means pasting the output of the named `test:*` scripts. |
| B8 | Design gate — T-023/T-024 "Approved design required before frontend work starts" | check | Steps 7–8 are frontend. Confirm the UI/UX sheet, or build server-side first and hold the UI. |
| B9 | An unapproved recruiter persists nothing — `persist = recruiter.status === "approved"` | by design | TC-R-004 must be run as an approved recruiter. |
| B10 | Scope creep toward T-027 | — | "Shortlisted" here is project triage. The global multi-track shortlist migration is a separate, HIGH-RISK, Sohail-gated ticket. Do not start it inside this PR. |

## 9. Verification — TC-R-004
Build gates (all must be clean):

```
npx tsc --noEmit
npm run lint
npm run build
npm run test:project-state       # new
npm run test:match-persistence   # must still pass, unchanged
npm run test:visibility          # the discovery gate must be untouched
npm run test:hire-score  test:sample  test:virtual  test:guest-adoption
```

The ticket's own manual test, run against the local database:

1. Sign in as an approved recruiter in Browser A (a fresh profile — confirm
   localStorage is empty first, or the test proves nothing).
2. Create a project, name it ("Senior Backend Engineer — Delhi NCR"), set
   criteria through Scout, run the search.
3. View four candidates (open the inspector on each).
4. Shortlist two, reject one.
5. Note the four public ids and their states. Sign out.
6. Open Browser B — a genuinely separate Chrome profile with its own
   `--user-data-dir`. Confirm localStorage is `[]`. Sign in as the same
   recruiter.
7. Open the project. Assert, item by item: name identical · every criterion
   identical and editable · the same candidates in the same order with the same
   scores · the four viewed ones marked viewed · the two shortlisted still
   shortlisted · the rejected one still rejected · the untouched ones still
   neutral.
8. Refresh. Identical again.

Extra checks that catch the failures this area actually has:
- Re-run the search in the project → `firstSeenAt` unchanged for everyone
  already there, viewed/decision state intact, and only a genuinely new
  candidate carries New.
- Isolation: open the project id as a different recruiter → not-found, not an
  empty page. Fire `setMatchDecisionAction` with someone else's `requestId` →
  0 rows changed, no error leak.
- Direct DB read after step 4 — `viewedAt`, `decision` and `name` are populated
  in Postgres, not just on screen.
- Regression: open a pre-existing talent project and confirm its criteria,
  matches and shortlist are unchanged; re-run a search that worked before and
  confirm the same candidates come back.

Files that should have changed: exactly those in §5. Anything under
`search-candidates.ts`, `score-candidate.ts`, `middleware.ts`, or
`RecruiterShortlistItem`'s readers means the scope slipped.

## 10. Guardrails for Cursor (DO NOT)
- DO NOT create a parallel `Project` / `TalentProject` model. `TalentRequest`
  is the project.
- DO NOT put the new writers in `hire-actions.ts`. `match-persistence.test.ts`
  source-scans that file for `viewedAt:` / `decision:` / `firstSeenAt:` and will
  fail. That guard is correct.
- DO NOT change `runMatchAction`'s upsert. Its update branch touches scoring
  fields only; the absence of the three state columns there is the whole
  feature.
- DO NOT use `prisma.update({ where: { id } })` for any of these writes. Use
  `updateMany` with a `recruiterUserId` predicate, so a foreign id is a no-op.
- DO NOT remove or bypass `searchableUserWhere()` / `filterSearchableUserIds`.
  `npm run test:visibility` guards this.
- DO NOT read triage state from localStorage. `desk-shortlist.ts`,
  `guest-cart.ts` and `guest-matches-store.ts` stay out of the decision/viewed
  path entirely.
- DO NOT touch `RecruiterShortlistItem`, `TalentList`, `TalentListItem` or
  `CandidateNote`. That is T-027.
- DO NOT run any migration, seed, or `db:*` script against `DATABASE_URL` as it
  stands — it is production. Local database only, per §7 step 2.
- DO NOT stamp `lastViewedAt` during server render. Read old, render badges,
  stamp from the client.
- DO NOT pass Date objects across the Server→Client boundary. Serialise to ISO
  strings or booleans in the page.
- DO NOT create files beyond the two listed in §5.
- DO NOT delete a rejected match row. Rejection is state that has to survive.
- When a build error contradicts this plan, trust the error and gather data.
- Confirm the files were written and `npm run build` passes before reporting
  done.

## 11. Commit message
```
feat(hire): a talent project remembers its name and every decision (T-149)

TalentRequest becomes a named, persistent hiring project. It already kept the
criteria; it now also keeps the recruiter's work on the results.

- name / rename, and the project list shows it instead of the role title
- lastViewedAt stamped on open, read before it is written, so "new since your
  last visit" has something to compare against
- viewedAt written once when a candidate is opened
- decision (UNDECIDED / SHORTLISTED / REJECTED) per match, keyed on
  candidateUserId so all four candidate tracks work, not just the cohort
- every write is an updateMany scoped by recruiterUserId, so a foreign request
  id changes nothing rather than leaking

Builds on the schema and the match-run upsert from the persistence branch
(T-040, T-044), which created these columns and deliberately left them unwritten.
Nothing is read from localStorage. The global multi-track shortlist migration
onto TalentListItem remains T-027 and is untouched here.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```
