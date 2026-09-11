# 133 — Remove candidate-controlled discoverability and per-field visibility

## 1. Goal

No candidate-facing discoverability control and no candidate-controlled
per-field visibility exist anywhere in the product. Which fields a recruiter
sees is decided by one platform policy; admin moderation remains the only way to
take a candidate out of recruiter search.

## 2. Current behavior (full-stack map)

### 2a. The table

`CandidateVisibility` (one row per `User`, `prisma/schema.prisma:2309`):

| Column | Meaning today | Writers | Readers |
|---|---|---|---|
| `searchableByRecruiters` | platform eligibility for recruiter search | `dual-write.ts` `ensureCandidateVisibility` (create → `true`), `ensureProgramMemberDiscoverable` (cohort policy → `true`), `anonymizeUser` (→ `false`), ops scripts | `searchableUserWhere()`, `buildUserGate()`, `filterSearchableUserIds()`, `getProfileEvidence()` (display) |
| `showEmail/Phone/Resume/Linkedin/Github/AssessmentScores/InterviewResults/CurrentEmployer` | **per-field visibility** | `anonymizeUser` (all → `false`), `scripts/seed-demo-profile.ts`. **No other writer** — never the 2b backfill, never a candidate | recruiter serializers (§2d), one search predicate (§2c), `getProfileEvidence()` (display) |
| `consentSource`, `consentedAt` | audit label | dual-write, 2b backfill | nothing on a request path |
| `withdrawnAt` | **hard stop** | `anonymizeUser` only | `searchableUserWhere()`, `buildUserGate()`, dual-write (early return) |

### 2b. Candidate-controlled surfaces (the thing being removed)

| Surface | Layer | File | State today |
|---|---|---|---|
| "I opt in to share my program profile with approved recruiters…" checkbox | UI | `src/components/program/apply-form.tsx:207-223` | **Decorative.** The server ignores it — `features/program/entry.ts:305` stamps `recruiterVisibilityConsentAt: new Date()` for every applicant, and `lib/validations/program.ts:33` documents the field as "accepted if a stale client still posts it; ignored". The candidate is told they are choosing something they are not. |
| `recruiterVisibilityConsent` | API input | `lib/validations/program.ts:34` | Accepted, then discarded. |
| `setRecruiterVisibilityAction({ enabled })` | API (Server Action) | `app/actions/talent-actions.ts:188-227` | **Callable, orphaned.** No UI imports it, but it is an exported `"use server"` action that lets a program member write `ProgramMember.recruiterVisibilityConsentAt`. |
| "Recruiters can currently discover your profile … scores shown/hidden … managed separately" | UI | `components/profile/evidence-section.tsx:160-172` | Component is rendered nowhere, but the copy and prop still exist. |
| `recruiterVisibility { searchableByRecruiters, showAssessmentScores, showInterviewResults }` | API response | `features/profile/get-evidence.ts:62-66, 119-126, 151` | **Live.** `/profile` calls `getProfileEvidence()` on every load; the field is selected and returned to the candidate's own page tree. |
| "What you are looking for. Separate from recruiter visibility." | UI copy | `app/profile/page.tsx:388` | Live label naming the removed concept. |

`src/lib/analytics/instrumentation.test.ts:239-243` independently classifies
`talent-actions.ts` and `evidence-section.tsx` as **"candidate visibility
toggles"** — corroborating the map above.

### 2c. Recruiter search predicates

- `searchableUserWhere()` — `repositories/talent.ts:29`. `deletedAt: null` +
  `visibility.is { searchableByRecruiters: true, withdrawnAt: null }`. Merged into
  every `/hire` track (`repositories/hire.ts`), `/talent`
  (`features/talent-pool/pool.ts`), `load-request-matches.ts`, and the recruiter
  assessment store. **Reads no candidate-controlled value** (§4 D1).
- `buildUserGate()` — `repositories/talent.ts:159-192`. Same gate **plus**
  `...(f.minAssessmentScore && { showAssessmentScores: true })` — a **per-field
  visibility flag used as search eligibility**. `minAssessmentScore` is set by no
  caller (grep: only `types.ts:25` and this function), so it is dead in practice,
  but it is exactly the pattern being removed.
- `visibleProgramMemberWhere()` — `repositories/talent.ts:155`. Returns
  `{ recruiterVisibilityConsentAt: { not: null } }`. Exported from
  `repositories/index.ts`, used by **nothing** except its own test. Dead
  candidate-consent predicate.

### 2d. Where per-field visibility is applied

| Reader | Effect |
|---|---|
| `talent.ts` `loadRecruiterIdentities` (→ every `/hire` track + `/talent`) | `hasLinkedin/hasGithub/hasResume` gated on `show*`; forwards `showInterviewResults/showAssessmentScores/showCurrentEmployer` in `RecruiterPublicIdentity` |
| `talent.ts` `searchCandidates` (new path) | selects `show*`, gates LinkedIn/GitHub/resume flags and `companyName` |
| `hire.ts` program mapper `:168, :176` | interview nulled unless `showInterviewResults`; company nulled when `showCurrentEmployer === false` |
| `hire.ts` `identityFromLegacyProfile` `:45-62` | hard-coded `showAssessmentScores: true`, `showInterviewResults: false` — **inconsistent** with the table defaults |
| `talent-pool/pool.ts:345, :384` | company and interview gated |
| `hire/challenge-dossier.ts:317` | quiz average gated on `showAssessmentScores` |

### 2e. Moderation today

- The only admin moderation is **account deletion**: `DeleteUserAccountDialog` →
  `anonymizeUser()` (`features/admin/anonymize-user.ts`), which sets
  `User.deletedAt`, `CandidateVisibility.withdrawnAt`, and
  `searchableByRecruiters = false`, and writes an `AdminAction` audit row.
- It is **durable**: `ensureCandidateVisibility` and
  `ensureProgramMemberDiscoverable` both return early on `withdrawnAt`, so no
  dual-write — including one triggered by the candidate's own cohort activity —
  can reopen a moderated account. Nothing a candidate can call writes
  `deletedAt` or `withdrawnAt`.

### 2f. Current data flow

```text
/program apply checkbox ──► applyToProgramAction ──► (flag discarded)
                                                      entry.ts stamps consent for everyone
setRecruiterVisibilityAction (orphan) ──► ProgramMember.recruiterVisibilityConsentAt
                                                      │ (audit label only)
                                                      ▼
                         dual-write ─► CandidateVisibility.searchableByRecruiters ◄── admin anonymize
                                        CandidateVisibility.show*  ◄── admin anonymize, demo seed
                                                      │
              ┌───────────────────────────────────────┼──────────────────────────────┐
              ▼                                       ▼                              ▼
   searchableUserWhere / buildUserGate      recruiter serializers           getProfileEvidence
   (+ showAssessmentScores clause)          (per-field gating on show*)     → candidate's page
```

## 3. Target architecture

```text
            Candidate profile (CandidateProfile + children)
                          │
                          ▼
            RECRUITER_FIELD_POLICY  (one constant, repositories/talent.ts)
                          │
                          ▼
            searchableUserWhere()   — platform eligibility + moderation
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
   deletedAt null, withdrawnAt null,   deleted / withdrawn (admin) or
   searchableByRecruiters true         platform-closed
              │                       │
              ▼                       ▼
     recruiter sees policy fields    excluded
```

No candidate-writable value appears anywhere in this flow.

## 4. Decisions

**D1 — `searchableByRecruiters` is retained, as platform eligibility, and stays
in the predicate.** It is not candidate-controlled: no candidate path writes it
(§2a). Its `false` population is the documented platform/legal decision in
`docs/project-context.md` §479–525 — the ~12,800 historical users were
**explicitly not opened**, and the published Privacy/Terms still describe
discovery as opt-in. Removing it from the predicate would open all of them
overnight, which is a legal decision this plan must not make silently. This is
the "other legitimate platform eligibility rule" the requirement asks us to
preserve. *(Optional follow-up for Sohail: rename the column to something that
cannot be read as a candidate preference.)*

**D2 — Moderation is `User.deletedAt` + `CandidateVisibility.withdrawnAt`,
unchanged.** Admin-only, audited, durable, server-enforced (§2e). This plan does
not touch it; it adds tests that pin it.

**D3 — The eight `show*` columns are removed (Option A).** Every read is replaced
by `RECRUITER_FIELD_POLICY`, whose values **equal today's column defaults**:

| Field | Policy | Today for every non-deleted row |
|---|---|---|
| LinkedIn / GitHub presence | shown (boolean only, never the URL) | `true` |
| Current employer | shown | `true` |
| Resume presence | hidden | `false` |
| Assessment scores | hidden | `false` |
| Interview results | hidden | `false` |
| Email / phone | never on a search or profile surface — released only through `contact-access.ts` on `CONTACT_SHARED` | `false`, and unread |

Because no writer ever changed these columns on a non-deleted row, this is a
**zero-change swap for recruiters**, and it matches the documented rule
(§495: "email, phone, résumé, assessment/interview detail stay separately
gated"). Deleted rows are excluded by D2 regardless. After the swap the columns
have no reader and no legitimate writer, so they are dropped rather than kept as
dead state.

**D4 — `ProgramMember.recruiterVisibilityConsentAt` column is retained
(Option B), its candidate write paths are removed.** It is on a legacy table, and
CLAUDE.md freezes legacy drops for September 2026 (Phase 7 W1-B). It is read only
for the audit label in dual-write. The checkbox, the API field, the orphan action
and the dead predicate fragment all go.

**D5 — `minAssessmentScore` filter is removed.** No caller sets it, and filtering
on a field the platform hides would let a recruiter infer that field.

## 5. Files to touch

### In my module (Candidate profile / Evidence) — no approval needed

- `src/features/profile/get-evidence.ts` `[edit]` — stop selecting and returning `recruiterVisibility`.
- `src/components/profile/evidence-section.tsx` `[edit]` — remove the discoverability/"shown/hidden" block.
- `src/app/profile/page.tsx` `[edit]` — drop "Separate from recruiter visibility." from the preferences description.
- `src/features/profile/profile.test.ts` `[edit]` — candidate API/UI assertions.

### CROSS-MODULE — blocked on owner approval (see §14)

- `src/components/program/apply-form.tsx` `[edit]` — remove the opt-in checkbox.
- `src/lib/validations/program.ts` `[edit]` — remove `recruiterVisibilityConsent`.
- `src/features/program/entry.ts` `[edit]` — stop stamping a consent time for people who never consented.
- `src/app/actions/talent-actions.ts` `[edit]` — delete `setRecruiterVisibilityAction`.
- `src/repositories/talent.ts` `[edit]` — add `RECRUITER_FIELD_POLICY`; remove `show*` reads, the `showAssessmentScores` gate clause, `minAssessmentScore`, `visibleProgramMemberWhere`; drop policy fields from `RecruiterPublicIdentity`.
- `src/repositories/types.ts` `[edit]` — remove `minAssessmentScore`.
- `src/repositories/index.ts` `[edit]` — drop the `visibleProgramMemberWhere` export.
- `src/repositories/hire.ts` `[edit]` — policy instead of identity flags; fix the inconsistent legacy fallback.
- `src/features/talent-pool/pool.ts` `[edit]` — policy instead of identity flags.
- `src/features/hire/challenge-dossier.ts` `[edit]` — policy instead of `showAssessmentScores`.
- `src/features/admin/anonymize-user.ts` `[edit]` — drop the `show*` writes (deletion itself unchanged).
- `scripts/seed-demo-profile.ts`, `prisma/seed-demo-recruiter.ts`, `prisma/scripts/rehearse-078-talent.ts` `[edit]` — stop referencing dropped columns (`seed-demo-recruiter.ts` writes six `show*` fields at lines 153–158; found by the step-1 re-scan).
- `ARCHITECTURE.md` `[edit]` — lines 233–236 describe `showEmail`/`showPhone`/`showResume` as candidate switches; rewrite to "contact release goes only through `contact-access.ts`; field exposure follows `RECRUITER_FIELD_POLICY`".
- **No change needed** (they only touch `recruiterVisibilityConsentAt`, which D4 keeps): `prisma/seed-hire-fixtures.ts`, `prisma/scripts/repair-078-talent-preflip.ts`, `prisma/scripts/migrate-078-shared.ts`, `prisma/scripts/compare-078-talent.ts`, `prisma/scripts/migrate-2b-visibility.ts`. Historical `migration.sql` files are never edited.
- `prisma/schema.prisma` `[edit]` + `prisma/migrations/NNN_drop_candidate_visibility_show_fields/migration.sql` `[new]`.
- `src/features/hire/visibility.test.ts` `[edit]` — predicate and moderation assertions.

## 6. Server vs Client

| File | Kind |
|---|---|
| `get-evidence.ts`, repositories, `anonymize-user.ts`, `entry.ts` | server-only |
| `talent-actions.ts` | Server Action module |
| `evidence-section.tsx` | client (not currently rendered) |
| `apply-form.tsx` | client |
| `app/profile/page.tsx` | Server Component — only a string changes |

No new value crosses the RSC boundary. `ProfileEvidence` loses a field; nothing
client-side read it.

## 7. Steps (implementation order)

1. **In-module, now:** `get-evidence.ts` → `evidence-section.tsx` → `page.tsx` copy → `profile.test.ts`. Typecheck, lint, tests.
2. **On approval — UI + API first:** `apply-form.tsx`, `program.ts` schema, `entry.ts`, `talent-actions.ts`. (Zod strips unknown keys, so an old client still posting `recruiterVisibilityConsent` is harmless.)
3. **On approval — platform policy:** add `RECRUITER_FIELD_POLICY` to `talent.ts`; switch `talent.ts`, `hire.ts`, `pool.ts`, `challenge-dossier.ts` to it; remove the gate clause, `minAssessmentScore`, `visibleProgramMemberWhere`.
4. **On approval — stop writing:** `anonymize-user.ts`, seeds, rehearsal script.
5. **Deploy steps 2–4.** The columns still exist; nothing reads or writes them.
6. **Then apply the migration** dropping the eight columns (§8). Order matters: dropping first would break the running build.
7. Tests + re-scan (§9).

## 8. DB safety / migration strategy

- **Only the eight `show*` columns are dropped.** `searchableByRecruiters`,
  `withdrawnAt`, `consentSource`, `consentedAt` stay (D1, D2).
- **Data loss assessment:** for every non-deleted row the dropped values equal the
  schema defaults (never written by the backfill or by any candidate path), so
  they are exactly reconstructible from `RECRUITER_FIELD_POLICY`. Deleted rows
  hold all-`false` and are excluded from search by `deletedAt`/`withdrawnAt`
  regardless. Nothing meaningful is lost.
- **Before applying:** confirm on a Neon child branch that
  `SELECT count(*) FROM "CandidateVisibility" WHERE "withdrawnAt" IS NULL AND
  (showEmail OR showPhone OR showResume OR showAssessmentScores OR
  showInterviewResults OR NOT showLinkedin OR NOT showGithub OR NOT
  showCurrentEmployer)` is `0`. A non-zero count means someone changed a value
  out-of-band and the "zero-change" claim must be re-examined before dropping.
- Commit checkpoint → Neon child branch snapshot → note hash →
  `npx prisma migrate deploy` on the branch → run the verification below →
  production **after** the code deploy.
- No search index or cache to rebuild: search is live Prisma queries. The `/hire`
  pool snapshot cache (`pool-facts.ts`) holds no visibility flags.

## 9. Test strategy / Verification

`npx tsc --noEmit`, `npx eslint`, `npm run test:profile`,
`npm run test:visibility`, `npm run test:hire-score`, analytics instrumentation
test, `npm run build`.

- **Candidate UI:** no discoverability copy in `evidence-section.tsx`; no opt-in
  checkbox in `apply-form.tsx`; no "recruiter visibility" label on `/profile`.
- **Candidate API:** `getProfileEvidence` neither selects `candidateVisibility`
  nor returns `recruiterVisibility`; `applyProfileSchema` has no
  `recruiterVisibilityConsent`; `talent-actions.ts` exports no visibility action;
  no candidate action writes `candidateVisibility` or `recruiterVisibilityConsentAt`.
- **Search:** `searchableUserWhere`/`buildUserGate` contain no `show*` key; no
  hire/talent file reads a `show*` column; a profile-only candidate with no
  visibility flags beyond the platform default is still eligible.
- **Fields:** `RECRUITER_FIELD_POLICY` equals the table in D3; serializers read
  only it.
- **Moderation:** the gate still requires `deletedAt: null` and
  `withdrawnAt: null`; both dual-write ensures return early on `withdrawnAt`;
  `anonymizeUser` still sets `deletedAt` + `withdrawnAt`.

Manual:

1. `/program` apply form — no recruiter opt-in checkbox.
2. `/profile` → every section — no discoverability or per-field control or copy.
3. Crafted POST of `recruiterVisibilityConsent: false` to apply — accepted, no effect.
4. `/hire` search for a fresh candidate with skills — returned.
5. Admin deletes that candidate — no longer returned, and no later cohort
   activity brings them back.

## 10. Potential regressions

| Risk | Mitigation |
|---|---|
| Dropping columns before the code deploys breaks every recruiter query | §7 order: code first, migration second |
| Hidden out-of-band `show*` edits make the swap non-zero-change | §8 pre-drop count query |
| `identityFromLegacyProfile` currently shows assessment scores; unifying the policy hides the quiz average for challenge candidates **with no `CandidateProfile` row** | Accepted as a consistency fix; called out to Sohail |
| The instrumentation test lists these two files as "candidate visibility toggles" | Both files still exist and stay un-instrumented, so the exclusion holds; the label goes stale (Manuvrtti). Note: the suite currently aborts earlier, on HEAD too, at `recruiterRegSubmitted` being emitted from two recruiter-onboarding files — unrelated to this plan (Zainab/Manuvrtti) |
| Privacy/Terms copy still says opt-in | Pre-existing, deferred legal task (§522); not solved here |
| Opening the ~12,800 legacy-closed users | **Deliberately not done** (D1) |

## 11. Guardrails for Cursor (DO NOT)

- **DO NOT** remove `searchableByRecruiters`, `withdrawnAt` or `deletedAt` from `searchableUserWhere`.
- **DO NOT** open the legacy-closed population; that is a legal decision.
- **DO NOT** change `anonymizeUser`'s deletion semantics — only drop its `show*` writes.
- **DO NOT** replace per-field visibility with another per-candidate setting; the policy is a constant.
- **DO NOT** apply the migration before the code that stops reading the columns is live.
- **DO NOT** drop `ProgramMember.recruiterVisibilityConsentAt` — legacy drops are frozen.
- **DO NOT** expose email/phone anywhere other than `contact-access.ts`.

## 12. Commit message

```
refactor(visibility): remove candidate-controlled discoverability and field visibility

Candidates can no longer influence whether or how recruiters see them. The
/program opt-in checkbox (already ignored server-side), its API field, the
orphaned setRecruiterVisibilityAction, and the candidate-facing
recruiterVisibility read are removed. The eight CandidateVisibility.show*
columns are replaced by one platform RECRUITER_FIELD_POLICY equal to their
defaults, then dropped.

searchableByRecruiters stays as platform eligibility (the documented
legacy-closed population), and admin deletion via deletedAt + withdrawnAt
remains the durable, admin-only moderation stop.
```

## 13. Re-scan targets after implementation

`show(Email|Phone|Resume|Linkedin|Github|AssessmentScores|InterviewResults|CurrentEmployer)`,
`recruiterVisibility`, `setRecruiterVisibilityAction`,
`visibleProgramMemberWhere`, `minAssessmentScore`, `discoverab`.

## 14. Cross-module approvals required

See the chat summary for the per-owner CROSS-MODULE CHANGE REQUIRED blocks. Steps
2–6 do not start until each owner approves.
