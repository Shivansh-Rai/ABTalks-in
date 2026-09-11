# 133 — Projects and search sessions

**Owner:** Zainab · **Branch:** `New-project-UI` · **Demo 1 readiness**
**Not touched:** T-226, T-228, T-229, T-230, T-232, credits, unlocks, outreach, recruiter isolation.

## 1. Goal

A **project** (`TalentRequest`) is a persistent hiring container, and every search inside it is a
**search session** with its own prompt, brief, chat and results. The shortlist and assessments belong
to the project. Nothing from Project A appears in Project B.

```
Recruiter → Project (TalentRequest)
              ├── Search sessions (TalentSearchSession) → prompt · brief · chat · results
              ├── Assessments (TalentProjectAssessment link → RecruiterAssessment)
              └── Project shortlist (TalentRequestMatch.decision = SHORTLISTED)
```

## 2. Current behaviour (audit, 11 Sep)

- **Projects:** `TalentRequest` is persistent, but only created by the first search. "New project" just
  navigated to `/hire`.
- **Sessions:** none. "New search" cleared the screen, and the next search **overwrote** the project's
  one brief (`TalentRequest` spec columns). `runMatchAction` deleted every UNDECIDED match outside the
  latest run.
- **Header shortlist:** the recruiter-wide legacy list plus **every** project's SHORTLISTED rows,
  deduplicated per person. This leaked across projects.
- **Assessments:** scoped to organization + creator. No project.

## 3. Decisions (approved 11 Sep)

| # | Decision |
|---|---|
| D-1 | Existing projects become Project + Session 1. No data is lost. |
| D-2 | Assessments with no project stay available as **Unassigned**. None are deleted, rewritten or auto-assigned. |
| D-3 | Shashank's T-243/T-244 code is **not modified**. The project link lives in a separate table owned by this work. |
| D-4 | The legacy `RecruiterShortlistItem` stays separate and is never merged into a project's shortlist. |

## 4. Design

- **Schema (additive only):**
  - new `TalentSearchSession` (`requestId`, `ordinal`, `title`, `spec`, `resultCandidateIds`, `resultSnapshot`, `overallGap`, `matchCount`, `lastRunAt`)
  - `TalentRequestMessage.sessionId` (nullable)
  - new `TalentProjectAssessment` (`requestId`, `assessmentId` unique, `linkedByUserId`)
  - The only line in Shashank's model is the Prisma back-relation `projectLink` on `RecruiterAssessment`. No columns, no behaviour.
- **New project:** `createTalentProjectAction({ name })` creates the `TalentRequest` immediately, then the client opens `/hire/<id>`. **No session is created** until the first search.
- **New search:** the client drops its `sessionId`. The next message creates session N+1 in the **same** project. The previous session is untouched.
- **Reopen a session:** `/hire/<id>?session=<sid>`. The page loads that session's messages, brief and results, keyed so Scout remounts. The sidebar lists every session in the project.
- **Brief per session:** `sendScoutMessageAction` reads its prior brief and chat history from the **session**. It still mirrors the latest brief onto the `TalentRequest` columns, so the demand board, admin view and hire alerts keep working unchanged.
- **Results per session:**
  - `runMatchAction` saves the session's ordered candidate ids and a scoring snapshot.
  - The project-level `TalentRequestMatch` rows are still upserted, so decisions and the shortlist stay project-level.
  - An UNDECIDED row is deleted only if it is in **no** session of the project, so session 2 can't erase session 1.
- **Legacy → Session 1 (D-1):** `ensureLegacySession(requestId)` runs when a project has **no** session but does have messages or matches.
  - It creates Session 1 from the project's brief, attaches every sessionless message, and snapshots the current matches.
  - It's idempotent (unique `(requestId, ordinal)`), and runs on project open and before any send or search.
  - `npm run db:backfill:search-sessions` runs the same function over every project (a dry run unless `--apply`).
  - The adoption and sample-demand paths are unchanged: their sessionless rows become Session 1 on first open.
- **Shortlist isolation (D-4):**
  - The layout sends every project's SHORTLISTED rows with their `projectRequestId`, via a new non-deduplicating `listProjectShortlistByProject`. `listProjectShortlist` is unchanged, because Shashank's assessment store uses it.
  - `HireChrome` filters to the project in the URL. Inside a project you see only that project's shortlist.
  - Legacy rows appear only off-project, labelled as not belonging to any project.
- **Assessments (D-2, D-3):**
  - `features/hire/project-assessments.ts` lists the assessments linked to a project, lists the Unassigned ones, and links or unlinks them. Everything is scoped to the recruiter's org + creator and to a project they own.
  - The sidebar shows the project's assessments and an **Attach an unassigned assessment** control.
  - **Integration point for Shashank:** after `createAssessment` in the create-test flow, call `linkProjectAssessmentAction` with the project the recruiter came from. Optionally, group `/hire/assessments` by project. Both are left to him.

## 5. Files

**New:**
- `src/features/hire/search-sessions.ts`
- `src/features/hire/project-assessments.ts`
- `src/app/actions/project-session-actions.ts`
- `src/components/hire/new-project-dialog.tsx`
- `src/components/hire/project-assessments-list.tsx`
- `prisma/scripts/backfill-search-sessions.ts`
- `prisma/scripts/check-project-sessions.ts`
- `src/features/hire/project-sessions.test.ts`
- the migration

**Edited:**
- `prisma/schema.prisma`
- `src/app/actions/hire-actions.ts`: `sendScoutMessageAction` and `runMatchAction` only
- `src/lib/validations/hire.ts`: optional `sessionId`
- `src/app/hire/[requestId]/page.tsx`
- `src/features/hire/load-request-matches.ts`: optional session filter
- `src/features/hire/project-shortlist.ts`: the sibling export
- `src/app/hire/layout.tsx`
- `src/components/hire/hire-chrome.tsx`
- `src/components/hire/hire-sidebar.tsx`
- `src/components/hire/hire-desk-context.tsx`
- `src/components/hire/scout-chat.tsx`: session state, New search, New project
- `src/features/hire/navbar-shortlist.test.ts`: accept the renamed layout call
- `package.json`
- `docs/CHANGELOG.md`

**Must not change:**
- `src/features/recruiter-assessments/**`, `src/app/actions/recruiter-assessment-actions.ts`, `src/app/hire/assessments/**`, `src/app/hire/create-test/**`
- `contact-access.ts`, `unlock-*`, `credits*`, `outreach*`
- `recordSampleDemandAction`, `adoptGuestScoutSessionAction`, the guest (non-persist) Scout flow

## 6. Migration

`20260912090000_project_search_sessions`. Create-only: 2 tables, 1 nullable column, indexes and foreign keys.
**No backfill in SQL.** Session 1 is materialized by `ensureLegacySession`: on open, or by the backfill script.

## 6b. Built (12 Sep): deviations

- **Pure helpers extracted** so the database proofs run the production logic without an auth session: `createProject` and `pruneUndecidedOutsideSessions` (in `search-sessions.ts`). The actions call them.
- **New file `src/components/hire/shortlist-scope.ts`**, holding `projectIdFromPath` and `scopePodRows`. They're pure, so the isolation rule is unit-tested.
- **`hire-talent-pod.tsx`** gained an optional `scopeLabel` heading ("Project: …" or "Saved candidates — not part of any project").
- **`serverCartCount` removed** from `HireChrome`. The count is now `scopedRows.length`, the same array the pod renders.
- **Two tests updated for the intended rule change:**
  - `navbar-shortlist.test.ts`: four checks moved from "one merged list" to "scoped per project".
  - `match-persistence.test.ts`: the cleanup check now reads `pruneUndecidedOutsideSessions`.
  - Their guarantees are unchanged.

## 7. Tests (required)

`test:project-sessions` (source) and `db:check:project-sessions` (database proofs):
1. New project persists.
2. A new search creates a session in the same project.
3. A project can hold many sessions.
4. A previous session is still readable, with its brief, chat and results intact.
5. A and B have independent sessions.
6. A's shortlist is not in B's.
7. A's linked assessment is not in B's list.
8. A legacy project becomes Session 1 with its messages and matches.
9. Unassigned assessments are still listed.
10. Recruiter B can't read or write Recruiter A's projects or sessions.
