# T-278 / TC-A-016 — Read-only talent project inspection (A2 Admin Entity Operations)

> **R1 carve-out SIGNED by Sohail (2026-09-11). Implemented on this branch.**
> All three open questions were decided at sign-off — see §0.
> Plan file: `docs/plans/135-t278-admin-project-inspection.md` · Branch:
> **`feat/t278-admin-project-inspection`**, cut from a freshly-synced `master`.
> Parent ticket T-234 ("projects"). Related: T-262 (DB-backed admin role), T-207, T-263.

---

## 0. Sign-off (2026-09-11)

The three questions §7 put to the signer were answered before implementation:

1. **R1 carve-out — approved**, on the plan's stated conditions: a read only, no new
   server action, no reachable writer, gated by the DB-checked `requireAdmin()`, and a
   separate path leaving every recruiter-scoped `recruiterUserId` predicate untouched so
   recruiter↔recruiter isolation still holds.
2. **"Pipeline state" — approved as the decision buckets** (UNDECIDED / SHORTLISTED /
   REJECTED). `PipelineStage` is not to be shown: it is schema-only with no reader, writer
   or UI. The page says plainly that decision is the pipeline state.
3. **Searchability filter — kept.** Admin sees exactly what the recruiter sees; candidates
   who opted out of search stay dropped. The page notes this so it is not mistaken for
   missing data.

## 1. Context

> **Outcome:** As ABTalks support/admin, I can open any recruiter's talent project
> **read-only** and see its criteria, results, viewed/shortlisted/rejected candidates and
> pipeline state — with **no control able to modify anything.**
> **TC-A-016:** open a project as an admin, confirm every element is visible, confirm no
> control can modify it.

**This is genuinely new surface.** `grep -rn "TalentRequest" src/app/admin src/features/admin
src/components/admin` returns **zero hits**. The only admin contact with the table today is
anonymous aggregate — `getDemandBoard()` (`features/hire/demand-board.ts:25-36`) selects
`status, mustHaveStack, salaryMin, salaryMax, seniority` across all recruiters with no id,
no title and no matches.

Unlike T-239 and T-244, there is nothing already built to accept here. But most of the
*data* work is done: `loadRequestMatches` already assembles exactly what TC-A-016 asks for.
The work is a new admin route, a read-only presentation, and — the hard part — a
**defensible read-only guarantee**.

---

## 2. What exists vs what is missing

| Piece | State | Where |
|---|---|---|
| Admin route gating | **Exists, free** | `middleware.ts:64` puts `/admin` in `protectedPaths` (session-only); `src/app/admin/layout.tsx:11` calls `requireAdmin()` once for the whole subtree. **A new `/admin/**` route inherits both.** |
| `requireAdmin()` | **Exists** | `src/lib/admin-auth.ts:108-120` — DB-backed via `hasPlatformAdmin` → `UserRoleAssignment{role:ADMIN, scopeType:GLOBAL, revokedAt:null}`. Redirect gate (`/login`, `/dashboard`). |
| Entity-detail page pattern | **Exists, copy it** | `src/app/admin/program/members/[id]/page.tsx:42-53` — async `params`, feature-layer loader, `notFound()`, back-link, tabbed cards. |
| No-mutator page pattern | **Exists, copy it** | `src/app/admin/program/content/page.tsx`, `src/app/admin/referrals/page.tsx`. |
| The data loader | **Exists, reuse unchanged** | `src/features/hire/load-request-matches.ts:35-58` returns `title, name, status, alertWhenAvailable, lastViewedAt, archivedAt, matches[], cartCount`; the match select at `:67-83` carries `firstSeenAt, viewedAt, decision`. |
| Criteria renderer | **Exists, unused, pure** | `src/components/hire/spec-summary.tsx` — no `"use client"`, no hooks, prop-driven, **imported nowhere**. Server-Component-safe. |
| Admin view of a TalentRequest | **MISSING** | — |
| Admin entry point to a project | **MISSING** | T-263 (global admin search) is Demo 3 and unbuilt. |
| **Pipeline state** | **MISSING — see §3** | — |

---

## 3. ⚠️ Acceptance-criteria ambiguity: "pipeline state"

There are two concepts and **only one is implemented**:

- **`TalentRequestMatch.decision`** — `UNDECIDED | SHORTLISTED | REJECTED`
  (`schema.prisma:1226-1230`, column `:1260`). Written, read and rendered today.
- **`PipelineStage`** — the real 9-stage pipeline (`SOURCED…WITHDRAWN`,
  `schema.prisma:2146-2156`) on `TalentListItem` (`:3517-3535`).
  **`grep -rn "PipelineStage|TalentListItem|talentList" src/` returns zero hits.**
  Schema-only: no reader, no writer, no UI, and no FK to `TalentRequest`.

The schema comment at `:1221-1225` says the split is *"a decision pending sign-off"*.

**So there is no pipeline to inspect.** This plan shows the `decision` buckets and states
that plainly on the page. Trying to show `PipelineStage` would mean joining two unrelated
aggregates that nothing populates. **Confirm this reading with Sohail as part of §7.**

---

## 4. The read-only guarantee (the heart of the ticket)

### 4a. Every mutating control on the recruiter surface

`/hire/[requestId]` renders exactly one component — `ScoutChat` (`page.tsx:117-128`).
Everything below hangs off it. 23 controls were enumerated; the ones that matter:

| Control | Action | Ownership-scoped server-side? |
|---|---|---|
| Rename project | `renameTalentProjectAction` | ✅ `updateMany … recruiterUserId` |
| **Mark project opened — fires on `useEffect`, no click** | `markProjectOpenedAction` | ✅ but **writes `lastViewedAt`** |
| **Mark match viewed — fires on card open** | `markMatchViewedAction` | ✅ (silently no-ops, no count check) |
| Set decision / Reject / Add to shortlist | `setMatchDecisionAction` | ✅ |
| Re-run search | `runMatchAction` | ✅ |
| Gap report "train this cohort" | `requestCohortTrainAction` | ✅ |
| Legacy shortlist button | `toggleShortlistAction` | ❌ **bare `auth()`, no recruiter gate** |
| **Request intro** | `placeEngagementRequestAction` | ❌ **accepts a foreign `requestId` unchecked** |
| **Unlock contact** | `unlockContactAction` | ❌ **spends real credits, releases identity** |
| **Record candidate view — fires on card open** | `recordCandidateViewAction` | ❌ **no auth gate at all** |
| Save-for-later star | *(none — `localStorage`)* | n/a, but visibly "changes" state |

### 4b. The design conclusion

**Do not render the recruiter tree at all.** Three components are disqualified outright:

- **`ScoutChat`** — imports six server actions and **auto-fires two on mount**
  (`scout-chat.tsx:430` `markProjectOpenedAction`, `:691` `markMatchViewedAction`). An admin
  merely opening the page would attempt to stamp the recruiter's `lastViewedAt`, destroying
  their "new since your last visit" badges. It also needs `useHireDesk()` from the `/hire`
  layout.
- **`CandidateInspector`** — imports `revealContactAction` (`:46`, called `:195`, `:204`)
  with **no prop to disable it**. Billable.
- **`GapReport`** — calls `requestCohortTrainAction` from its only button, no prop to disable.

`DeskMatchCard` *is* prop-driven and goes inert when `requestId`/`onDecision` are omitted
(`showTriage` at `:153`), but it still mounts `DeskShortlistButton` (`:369`), which writes
the admin's own `localStorage`. `MatchResults` seeds a cart count and calls
`rememberEvidence`.

**Therefore: a new, purpose-built, server-rendered read-only view.** A Server Component that
imports no server action has **zero client mutation surface** — that is a guarantee you can
prove by static scan, not a promise about disabled buttons. It is also the only shape that
satisfies R2 ("hiding a button is not security") without auditing 23 controls.

> **Considered and rejected:** threading a `readOnly` prop through `ScoutChat` in the
> `question-editor.tsx` house style (`locked` → early-return + `disabled` + `readOnly` +
> remove destructive controls). Correct idiom for an *editor the owner is using*, wrong here:
> it leaves six live action imports and two mount-time writes one regression away from
> firing, on a screen whose entire purpose is to change nothing.

### 4c. The server-side backstop

The guarantee is that **the admin page reaches no writer**. Reuse is read-only by
construction:

- `loadRequestMatches` is called **unchanged**, with the **owner's** `recruiterUserId`
  resolved first. It performs no writes.
- The existing recruiter-scoped queries are **not relaxed**. `page.tsx:21-22` and
  `load-request-matches.ts:58` keep their `recruiterUserId` predicates — both are pinned by
  `isolation.test.ts:39-47`.
- **No new server action is created.** A read-only page needs none, and this also avoids
  `isolation.test.ts:76-88` (every `admin-*.ts` action file must call `requireAdmin`).
- `requireRecruiterWorkspace` is **not** touched — `workspace.test.ts:133` pins that it takes
  no parameters, deliberately, to close the "caller-supplied id" bug class.

---

## 5. Files to touch

| File | | Note |
|---|---|---|
| `src/features/admin/inspect-talent-project.ts` | **[new]** | `import "server-only"`. `listTalentProjectsForAdmin()` and `inspectTalentProject(requestId)`. The latter resolves the owner, then calls `loadRequestMatches(requestId, owner.recruiterUserId)` **unchanged**, and returns it plus owner identity. No writes. |
| `src/app/admin/hire/projects/page.tsx` | **[new]** | Server Component. Project list across all recruiters — owner, title, status, match count, updated. Links to the detail route. |
| `src/app/admin/hire/projects/[requestId]/page.tsx` | **[new]** | Server Component. `notFound()` on miss. Resolves from `params` only — **never `searchParams`** (`isolation.test.ts:138-141`). |
| `src/components/admin/talent-project-inspector.tsx` | **[new]** | Presentational Server Component — **no `"use client"`**, no imports from `@/app/actions/*`. Criteria (via `SpecSummary`), results, and the three decision buckets. |
| `src/components/admin/admin-sidebar.tsx` | [edit] | One nav entry. **`IconName` is a closed `as const` union with an `iconMap` at `:40-64`** — an unknown key is a type error, so both must be extended. |
| `src/features/admin/admin-project-inspect.test.ts` | **[new]** | Source-scan suite, `project-state.test.ts` style. |
| `package.json` | [edit] | `test:admin-project-inspect`. There is no aggregate `npm test`; every suite is registered by hand. |
| `docs/plans/135-t278-admin-project-inspection.md` | **[new]** | This plan. 130–133 are upstream; 134 is taken by PR #297. |
| `docs/CHANGELOG.md` | [edit] | One dated line. |

**Server vs Client:** every new file is a **Server Component or server-only module**. Nothing
new is a client component, so nothing crosses the RSC boundary and no function, icon or class
instance is passed as a prop. `SpecSummary` is reused precisely because it is
Server-Component-safe.

**No schema change. No migration.** Confirmed: every field TC-A-016 needs already exists on
`TalentRequest` (`schema.prisma:1152-1205`) and `TalentRequestMatch` (`:1240-1272`).

---

## 6. Steps

1. **`inspect-talent-project.ts`** — `inspectTalentProject(requestId)`:
   resolve `prisma.talentRequest.findUnique({ where: { id }, select: { recruiterUserId: true } })`,
   return `null` on miss, then `loadRequestMatches(requestId, owner.recruiterUserId)` and
   attach owner identity (name/email/company). Partition `matches` into
   shortlisted / rejected / undecided by `decision`, and surface `viewedAt` per row.
   `listTalentProjectsForAdmin()` uses the existing `@@index([status, createdAt(sort: Desc)])`
   (`schema.prisma:1205`) — there is **no index on `archivedAt`**, so do not filter on it.
2. **Detail page** — `requireAdmin()` defensively (the layout already gates; the test asserts
   the call is present), `notFound()` on miss, render the inspector, back-link to the list.
3. **Inspector component** — criteria via `SpecSummary`; a results table showing score, tier,
   `firstSeenAt`, `viewedAt`, `decision`; the three buckets; and a short header line naming
   the owning recruiter and stating the view is read-only.
4. **List page** + sidebar entry (extend `IconName` **and** `iconMap`).
5. **Tests** (§8).
6. **CHANGELOG + plan file.**

---

## 7. ⛔ Guardrails — R1–R4 (plan 115 §10, locked 2026-09-09)

> **R1 — Recruiter isolation.** "Recruiter A cannot read or mutate recruiter B's projects,
> pipeline, credits, ledger, jobs, assessments, unlocks or outreach — including by editing IDs
> or URLs. Isolation key is `recruiterUserId`."
> **R2 — Server-side authorization.** "Every protected mutation **and privileged read** is
> gated in the Server Action or Server Component with a DB-checked helper. **Hiding a button
> is not security.** Middleware is session-only (edge-safe)."
> **R3 — Database is source of truth.** **R4 — Idempotency.**
> *"Every HIGH-risk plan is signed against R1–R4 before code. A plan that only gates in the UI
> fails R2."* — and plans written after that file **"still STOP for Sohail."**

**This ticket is the first admin carve-out to R1 in the codebase.** It must be signed before
implementation. The carve-out, stated precisely:

- It is a **READ**, never a mutation. No new server action; no writer is reachable.
- It is gated by `requireAdmin()` — a **DB-checked** helper (`UserRoleAssignment`), satisfying
  R2's "privileged read" clause. Not a UI gate.
- It is a **new, separate path**. The recruiter-scoped queries keep their `recruiterUserId`
  predicates untouched, so R1 still holds for recruiter↔recruiter.
- Two open questions for the signer: **(a)** the "pipeline state" reading in §3; **(b)** the
  searchability caveat in §9.

### DO NOT

- **DO NOT** relax `page.tsx:21-22` or `load-request-matches.ts:58` — both are pinned by
  `isolation.test.ts:39-47`, and relaxing them would break R1 for recruiters too.
- **DO NOT** add a `userId` parameter to `requireRecruiterWorkspace` — `workspace.test.ts:133`
  fails deliberately on that, and it is the bug class the signature closes.
- **DO NOT** render `ScoutChat`, `CandidateInspector`, `GapReport`, `MatchResults`,
  `MatchCard`, `DeskMatchCard`, `DeskShortlistButton` or `UnlockContactDialog` on the admin
  page. §4b explains each.
- **DO NOT** import anything from `@/app/actions/*` into the new files.
- **DO NOT** create a server action file named `admin-*.ts` (it would fall under
  `isolation.test.ts:76-88`). No actions at all.
- **DO NOT** read the project id or owner from `searchParams` — `params` only
  (`isolation.test.ts:138-141`).
- **DO NOT** write `lastViewedAt`, `viewedAt`, or any analytics row on admin view.
- **DO NOT** write an `AdminAction` audit row — see §9.
- **DO NOT** touch `middleware.ts` or `auth.config.ts` (edge-safe rule). **None is needed:**
  `/admin` is already in `protectedPaths` and matching is `startsWith`.
- **DO NOT** fix the four pre-existing holes in §9 in this PR.
- **DO NOT** change the schema or add a migration.

---

## 8. Verification

**Automated** — new `src/features/admin/admin-project-inspect.test.ts`, `tsx` source-scan in
the house style (`stripComments()` first, so prose cannot satisfy an assertion):

- The admin page and inspector import **nothing** from `@/app/actions/`.
- Neither contains `prisma.*.update(`, `.updateMany(`, `.create(`, `.upsert(`, `.delete(`.
- The detail page calls `requireAdmin` and `notFound`, and **does not** contain `searchParams`.
- `inspect-talent-project.ts` contains no writer and does not import `requireRecruiterWorkspace`.
- **Negative pins on the existing files** — `load-request-matches.ts` still contains
  `recruiterUserId` in its `where`, and `hire/[requestId]/page.tsx` still contains
  `recruiterUserId: userId`. *(If a future change relaxes them, this test fails.)*
- A **directory sweep** over `src/app/admin/hire/projects/**` asserting no file imports a
  server action — modelled on `isolation.test.ts:76-88`, which sweeps all `admin-*.ts`.

Also re-run, unchanged: `test:demo1-security` (isolation + admin-auth, the R1–R4 suite),
`test:project-state`, `test:recruiter-workspace`.

```
npx tsc --noEmit          # expect 0
npm run build             # expect exit 0
npm run test:admin-project-inspect
npm run test:demo1-security
npm run test:project-state
npm run test:recruiter-workspace
```

**Manual (TC-A-016)** — as a `UserRoleAssignment` admin:

1. `/admin/hire/projects` lists projects across recruiters.
2. Open one → criteria, results, and the viewed/shortlisted/rejected buckets are all visible.
3. **Confirm no control can modify:** no rename input, no Reject/Shortlist buttons, no
   re-run search, no request-intro, no unlock, no save-star. View source: no `<button>` or
   `<form>` bound to a server action.
4. **The real check —** note the project's `lastViewedAt` and a match's `viewedAt` **before**
   opening, then re-check **after**. Both must be **unchanged**. This is what distinguishes a
   genuine read-only view from a hidden-button one.
5. Open a **non-existent** id and an **archived** project → `notFound()`, never a 403.
6. As a **non-admin** signed-in user, hit the URL directly → redirected to `/dashboard` by
   `requireAdmin`.

---

## 9. Out of scope — found, deliberately not fixed

**Four pre-existing holes** that would matter if an admin ever used the *recruiter* page.
They do not affect this plan's surface (which renders none of them), but they are real:

| Where | Issue |
|---|---|
| `hire-request-actions.ts:124-127` | **`placeEngagementRequestAction` accepts a foreign `requestId` with no ownership check** — `requestId: requestId ?? null` is never validated against `recruiterUserId`. An admin-who-is-also-a-recruiter clicking "Request intro" on another recruiter's project creates an engagement owned by them but foreign-keyed to that project, polluting it and the demand board. **A genuine pre-existing bug, independent of this ticket.** |
| `talent-actions.ts:76-100` | `toggleShortlistAction` has a bare `auth()` — no recruiter gate, no project scope. |
| `hire-unlock-actions.ts:48-69` | `unlockContactAction` takes only `candidateRef`; an admin-recruiter would spend their own credits and permanently release an identity. |
| `hire-view-actions.ts:24` | `recordCandidateViewAction` has **no auth gate at all**; `auth()` at `:48` only derives a viewer key. |

**Audit logging — deliberately none.** `AdminAction.targetUserId` is a **required FK to
`User`** (`schema.prisma:700-713`), so it cannot name a `TalentRequest`. Nine of the 29
existing writers already work around this by self-targeting the admin. More decisively:
**every one of the 29 call sites logs a mutation — there is not one read-logging site in the
codebase.** Plan 123, which would add `entityType`/`entityId`, is
*"DRAFT FOR REVIEW. Not signed, not approved, not started."* Logging nothing keeps the surface
genuinely read-only and avoids pre-empting an unsigned schema decision. **Raise it with Sohail
in §7** — if he wants reads audited, plan 123 is the prerequisite, not this ticket.

**Searchability caveat (decision for the signer).** `loadRequestMatches:98-101` re-applies
`filterSearchableUserIds` on every read, so candidates who have since made themselves
unsearchable are dropped. An admin view will therefore **not** show every stored match — which
sits awkwardly against "confirm every element is visible". Recommendation: **keep the filter**
(admin sees exactly what the recruiter sees, which is the support use case) and say so on the
page. Bypassing it would expose candidates who opted out, and is a privacy decision this plan
should not make silently.

---

## 10. Commit plan

1. `feat(admin): read-only talent project inspection (T-278 / TC-A-016)` — loader, routes,
   inspector, sidebar entry.
2. `test(admin): pin the read-only guarantee on talent project inspection` — the scan suite
   and its npm script.
3. `docs: plan 135 and CHANGELOG for T-278 admin project inspection`

PR to **`byteninjaa0/ABtalksapp`**, head `shashank-mishra08:feat/t278-admin-project-inspection`.

---

## 11. Implementation notes (2026-09-11)

Built as specified. Three things worth recording:

1. **The sidebar has TWO icon registries, not one.** `admin-sidebar.tsx` and
   `admin-mobile-nav.tsx` each declare their own `IconName` union and `iconMap`, and the
   same nav array in `admin/layout.tsx` feeds both. Extending only the first is a type
   error at the layout, not at the component — the plan's file list named one file where
   two were needed.

2. **The read-only test caught its own blind spot.** The "is a Server Component" assertion
   originally read the raw file and tripped on this very module's doc comment, which
   discusses `"use client"` in prose. It now strips comments first — which is still sound,
   because a directive is a string literal, not a comment, so a real one survives the strip.

3. **`loadRequestMatches` was reused byte-for-byte**, called with the owner's
   `recruiterUserId` resolved from a prior `findUnique`. No change to that file, so the
   `isolation.test.ts` pin on its scoping is untouched — and the admin sees exactly the
   recruiter's view, which is the support use case.

### Verification actually run

- `npm run test:admin-project-inspect` — **11 passed, 0 failed**
- `npm run test:demo1-security` — **16 / 8 / 6 / 4 passed**, exit 0 (the R1–R4 suite)
- `npm run test:project-state` — **10 passed**; `npm run test:recruiter-workspace` — **16 passed**
- `npx tsc --noEmit` — **0 errors**; `npm run build` — exit 0, both routes registered
- `npx eslint` on all five new files — no problems
- **Browser walkthrough (TC-A-016) not yet run** — the decisive check is capturing
  `lastViewedAt` and a match's `viewedAt` before and after an admin visit and confirming
  both unchanged. That plus the recording is the outstanding evidence.
