# 031 — B2B Program 08 — Recruiter portal: registration, approval, talent pool, shortlists

> Depends on 029 (030 for interview data on profiles). Recruiters LOG IN (owner
> decision), access is FREE initially, and they see members only AFTER
> `cohort.resultsPublishedAt` is set (post-cohort access). Namespace: `/talent`.
> Do NOT confuse with `src/features/recruiter/` (admin-authored share reports) — untouched.

## 1. Goal
Recruiters sign up with Google, complete a company profile, get admin approval, and
once results are published browse the ranked talent pool with filters, open rich member
profiles (scores, commits, projects + AI feedback, interview summary, AI rec, links),
and maintain a private shortlist with notes.

## 2. Current behavior
After 024: `Role.RECRUITER`, `RecruiterProfile`, `RecruiterShortlistItem` exist unused;
`requireRecruiter()` exists; middleware protects `/talent`. Login-page exception for
`from=/talent/...` exists. No recruiter UI.

## 3. Files to touch
- `[new] src/features/talent-pool/recruiter-registration.ts` —
  `registerRecruiter(userId, {fullName, company, phone?})` — creates `RecruiterProfile`
  (approved:false) + sets `User.role = RECRUITER` **only if current role is STUDENT
  without any StudentProfile** (a user can't be both a student and a recruiter; if a
  StudentProfile exists, reject with a clear message). `getRecruiterState(userId)`.
- `[new] src/features/talent-pool/pool.ts` — all queries gate on BOTH
  `recruiter.approved` and `cohort.resultsPublishedAt != null`:
  - `getTalentPool(filters)` — ENROLLED/COMPLETED members of the published cohort,
    ranked (roadmap §5 sort); filters: text search (name/company/role), skills
    (hasSome), min yearsExperience band, min totalScore; paginated (30/page).
  - `getTalentProfile(memberId)` — full detail: profile fields (NO phone, NO entry
    attempt details), score breakdown, commit heatmap data, **mission portfolio**
    (per-day: mission type, title, passed/skipped, runs used, clean pass or not, AI
    Mentor notes — the "what they actually built" story), clean-pass rate, projects
    (scores + AI feedback), interview (overall + sub-scores + summary + transcript),
    aiRecommendation, links (GitHub, LinkedIn, resumeUrl), email (visible — approved
    recruiters get contact). Never expose `missionSpec` or raw hidden-test data.
  - shortlist: `toggleShortlist`, `updateShortlistNote`, `getShortlist`.
- `[new] src/app/actions/talent-actions.ts` — `registerRecruiterAction`,
  `toggleShortlistAction`, `updateShortlistNoteAction` (Zod + envelope; every action
  re-checks approved+published server-side).
- `[new] src/app/talent/layout.tsx` — Server; `notFound()` if `!isProgramEnabled()`;
  minimal recruiter shell + nav (Pool, Shortlist) — nav hidden on register/pending.
- `[new] src/app/talent/register/page.tsx` — Server; states: no session → this page is
  middleware-protected so session exists; no RecruiterProfile → form; else redirect to
  `/talent` or `/talent/pending`.
- `[new] src/components/talent/recruiter-register-form.tsx` — Client; RHF + Zod.
- `[new] src/app/talent/pending/page.tsx` — Server; "application received / awaiting
  approval" (also the landing for unapproved per `requireRecruiter` redirect from 024).
- `[new] src/app/talent/page.tsx` — Server; `requireRecruiter()`; if no cohort
  published → "results not published yet" state; else pool table/cards: rank, name,
  role, company, yrs, skills chips, total score + component mini-bars, clean-pass %,
  interview badge, shortlist star; filter bar (client component posting searchParams).
- `[new] src/app/talent/members/[id]/page.tsx` — Server; `requireRecruiter()`; full
  profile per `getTalentProfile`; shortlist + note UI.
- `[new] src/app/talent/shortlist/page.tsx` — Server; shortlisted members + notes.
- `[new] src/components/talent/` — `pool-filters.tsx`, `member-card.tsx`,
  `shortlist-button.tsx`, `score-breakdown.tsx` (Client where interactive; JSON props).
- `[new] src/app/admin/program/recruiters/page.tsx` — `requireAdmin`; pending recruiter
  applications with approve/reject; approve sets `approved`, `approvedAt`,
  `approvedByAdminId`, writes `AdminAction` (`PROGRAM_APPROVE_RECRUITER`), and sends an
  email via existing `src/lib/email.ts` `sendEmail` ("Your ABTalks recruiter access is
  approved" + link). Reject deletes the RecruiterProfile + resets role to STUDENT +
  emails politely.
- `[new] src/app/actions/admin-recruiter-actions.ts` — the two admin actions above.
- `[edit] src/app/program/page.tsx` — "I'm a recruiter" CTA → `/talent/register` (added
  in 024; verify link works end-to-end now).
- `[edit] docs/project-context.md` — recruiter portal shipped.

## 4. Server vs Client
| File | Type | Notes |
|---|---|---|
| all `/talent` pages, admin page | Server | `requireRecruiter` / `requireAdmin`; DB-checked every request |
| forms, filters, shortlist button | Client | JSON props only |
| features | server | approved+published double-gate in EVERY pool query |

## 5. Steps
1. Registration feature + form + pending page. 2. Admin approval page + emails.
3. Pool + profile + shortlist features/actions. 4. `/talent` pages + components.
5. Publish flow: the `resultsPublishedAt` toggle button ships in 032's cohort admin —
   for now set it via DB to test; note this dependency in the PR description.
6. Verify, context doc, commit.

## 6. Guardrails for Cursor (DO NOT)
- Do NOT show members' `phone`, entry-assessment details, or attempt-level answers to
  recruiters. Email + LinkedIn + GitHub + resume ARE shown (owner decision).
- Do NOT rely on JWT `role` for access — `requireRecruiter()` hits the DB (approval
  can be revoked; JWT is stale).
- Do NOT let unapproved/pre-publish recruiters reach pool data through the ACTIONS
  (server-side re-check in every query, not just the page).
- Do NOT create recruiter accounts for users with a StudentProfile — explicit rejection
  message; no silent role flips.
- Do NOT touch `src/features/recruiter/` or `/r/[token]` (existing share reports).
- Do NOT build recruiter→candidate messaging, exports, or payments — out of scope v1.

## 7. DB safety
No schema change. Role flips + approvals are guarded transactional updates with
AdminAction audit rows.

## 8. Verification
- New Google user → `/talent/register` → form → `/talent/pending`; admin approves →
  email received → `/talent` shows "results not published"; set `resultsPublishedAt`
  → pool renders ranked members with filters working (skills, search, min score).
- Member profile shows all sections incl. interview summary; phone absent from DOM.
- Shortlist star + note persist; second recruiter cannot see the first's shortlist.
- Unapproved recruiter hitting `/talent` or actions directly → redirected/rejected.
- A recruiter visiting student routes (`/dashboard`) → existing behavior unchanged
  (redirected to `/register`? verify and report what happens — must not crash).
- Build + tsc clean; §3 files only.

## 9. Commit message
`feat(talent): recruiter portal — registration + admin approval, post-publish talent pool, member profiles, shortlists`
