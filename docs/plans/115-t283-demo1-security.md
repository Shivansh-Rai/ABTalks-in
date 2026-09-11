# 115 — T-283 Architecture Guardrails + Demo 1 security (T-255–T-258, T-262)

**Owner:** Sohail · **Demo 1** (complete by EOD 11 Sep) · sources `docs/DailyTask88.md`, `docs/Demo88.md`, `docs/ABTalks88.xlsx`

## 1. Goal

Lock four checkable rules so Wave-1 cannot ship isolation, auth, persistence or
idempotency as UI-only, then implement Sohail's Demo 1 engineering: recruiter
isolation, server-side authorization, contact-payload stripping, rate limits on
money/contact paths, and database-backed Platform Admin access.

## 2. Current behavior

- Hire request pages/actions already scope `TalentRequest` / engagements with
  `recruiterUserId`. Isolation is per **user**, which matches Demo 1 contract §2
  (no company team). Credits, recruiter-owned jobs, assessments, pipeline and
  outreach **do not exist yet** — the helper must be the seam they call.
- `requireAdmin` is `ADMIN_EMAILS` env (`src/lib/admin-auth.ts`).
  `UserRoleAssignment` already exists and is written for recruiters; **nothing
  reads it for ADMIN**.
- `hasContactAccess` is the single unlock rule and has **zero callers**.
  `src/app/hire/requests/page.tsx` selects `candidate.email` for every row.
- Rate limiting: recruiter OTP (DB) and guest Scout (in-memory `Map`). Search,
  unlock, outreach, export are unprotected.
- `/hire/evidence` requires a session via middleware, not an approved recruiter.

## 3. Files to touch

| File | | Note |
|---|---|---|
| `docs/plans/115-t283-demo1-security.md` | `[new]` | This plan + the four guardrails and Wave-1 sign-off |
| `src/lib/recruiter-gate.ts` | `[new]` | Shared action-safe recruiter gates (no redirect) |
| `src/lib/rate-limit-policy.ts` | `[new]` | Pure buckets, windows, `isRateLimited` |
| `src/lib/rate-limit.ts` | `[new]` | DB-backed `assertRateLimit` |
| `src/lib/admin-auth.ts` | `[edit]` | ADMIN from `UserRoleAssignment`; env is bootstrap only |
| `src/app/actions/admin-platform-actions.ts` | `[new]` | Grant / revoke Platform Admin |
| `src/app/admin/platform-admins/page.tsx` | `[new]` | Server page |
| `src/components/admin/platform-admins-panel.tsx` | `[new]` | Client grant/revoke form |
| `src/app/admin/layout.tsx` | `[edit]` | Nav item |
| `src/components/admin/admin-sidebar.tsx` | `[edit]` | Icon |
| `src/components/admin/admin-mobile-nav.tsx` | `[edit]` | Same icon |
| `src/app/actions/hire-actions.ts` | `[edit]` | Shared gate + search rate limit |
| `src/app/actions/hire-request-actions.ts` | `[edit]` | Shared gate |
| `src/app/actions/hire-guest-actions.ts` | `[edit]` | Replace in-memory Map with `assertRateLimit` |
| `src/app/actions/virtual-candidate-actions.ts` | `[edit]` | Shared registered-recruiter gate |
| `src/app/actions/admin-export-actions.ts` | `[edit]` | Export rate limit after `requireAdmin` |
| `src/app/actions/admin-program-export-actions.ts` | `[edit]` | Same |
| `src/app/actions/admin-actions.ts` | `[edit]` | `isAdminEmail(target)` → `isPlatformAdminUser` |
| `src/app/hire/requests/page.tsx` | `[edit]` | Identity only after `hasContactAccess`; no email select otherwise |
| `src/app/hire/evidence/page.tsx` | `[edit]` | `requireRecruiter()` |
| `src/features/hire/contact-access.ts` | `[edit]` | `loadProtectedContact` — select email/phone only after access |
| `src/features/talent-pool/pool.ts` | `[edit]` | Released set via `contactAccessFor` |
| `prisma/schema.prisma` | `[edit]` | `RateLimitEvent` |
| `prisma/migrations/20260909120000_rate_limit_event/migration.sql` | `[new]` | Additive table |
| `src/features/hire/isolation.test.ts` | `[new]` | Source-scan isolation + auth |
| `src/features/hire/contact-payload.test.ts` | `[new]` | Contact never in public match; requests page uses the gate |
| `src/lib/rate-limit-policy.test.ts` | `[new]` | Pure limiter |
| `src/lib/admin-auth.test.ts` | `[new]` | `requireAdmin` reads `UserRoleAssignment` |
| `package.json` | `[edit]` | `test:demo1-security` |
| `docs/CHANGELOG.md` | `[edit]` | Pending reconcile lines |

**Not this plan:** T-269 credit correction, T-270 audit log, T-281 three-persona
pass — Excel Demo column is Demo 2/3. Unlock/outreach/jobs/assessments owned by
Zainab/shashank/Manuvrtti; this plan only ships the helpers they must call.

## 4. Server vs Client

| Module | Boundary |
|---|---|
| Guardrails doc | Written only |
| `recruiter-gate`, `rate-limit`, `admin-auth`, `contact-access` | Server (`server-only` where they touch Prisma) |
| `rate-limit-policy.ts` | Shared, zero imports |
| `platform-admins/page.tsx` | Server |
| `platform-admins-panel.tsx` | Client — receives serializable `{ id, email, name, grantedAt }[]` |
| Tests | Node `tsx` scripts, no React |

No functions, icons, or class instances across the Server→Client boundary.

## 5. Steps

### A. T-283 — lock the four rules (today)

Written in §10 of this file. Wave-1 sign-off in §11. No code in this step.

### B. Shared recruiter gate

`requireApprovedRecruiterAction` / `requireRegisteredRecruiterAction` in
`recruiter-gate.ts`. Replace the three copies in hire / hire-request /
virtual-candidate actions. Pages keep `requireRecruiter()` (redirect).

### C. T-255 / T-256

Keep every recruiter-scoped `findFirst`/`updateMany` on
`{ id, recruiterUserId: caller }`. `/hire/evidence` calls `requireRecruiter()`.
Source-scan test: hire action files that take a request/engagement id include
`recruiterUserId` in the Prisma `where`. Admin action files call `requireAdmin`.
Candidate-only actions (`saveCandidateAvailabilityAction`, `applyToJobAction`)
must **not** call `requireApprovedRecruiter`.

### D. T-257

`loadProtectedContact(recruiterUserId, candidateUserId)` returns `{ email, phone }`
only when `hasContactAccess` is true; otherwise `null`. Requests page: do not
`select` `candidate.email` on the list query. Load contact in a second query for
the ids `contactAccessFor` allows. `pool.ts` released set uses `contactAccessFor`
(keyed on `candidateUserId`, not `programMemberId`).

### E. T-258

`RateLimitEvent` table. `assertRateLimit({ bucket, subjectId })` inserts a row,
counts rows in the window, refuses with a readable message, logs via `logger`.
Call sites that exist today: Scout send/match (SEARCH), guest Scout (SEARCH,
subject `ip:…`), admin export actions (EXPORT). Unlock/outreach must import the
same helper when those actions land — listed in `REQUIRED_RATE_LIMIT_SITES`.

### F. T-262

`hasPlatformAdmin(userId)`: active `UserRoleAssignment` `role=ADMIN`,
`scopeType=GLOBAL`, `revokedAt=null`. `requireAdmin` / `getAdminContext` use it.

Bootstrap: if **zero** active GLOBAL ADMIN rows exist, upsert assignments for
every `User` whose email is in `ADMIN_EMAILS`. After that, env is ignored.
Grant by email (existing user). Revoke sets `revokedAt` + reason; refuse if it
would leave zero active admins. Non-admin calling grant/revoke is refused by
`requireAdmin`.

### G. Tests + changelog

`npm run test:demo1-security`. Append CHANGELOG lines. Do **not** run
`prisma migrate deploy` against production.

## 6. Guardrails for Cursor (DO NOT)

- Do not import `@/lib/*` from `middleware.ts`.
- Do not treat `ADMIN_EMAILS` as the live gate after bootstrap.
- Do not re-grant an env-listed admin who has been revoked.
- Do not select email/phone/resumeUrl onto a recruiter payload before
  `hasContactAccess`.
- Do not put the contact filter in CSS or a Client Component.
- Do not use the in-memory guest `Map` as the SEARCH limiter.
- Do not add Company Admin / shared workspace / shared credits.
- Do not implement T-269 / T-270 / T-281.
- Do not apply the migration to the production Neon branch.
- Do not add a new font or restyle existing admin chrome.
- Do not use `<Button asChild>` / `<Button render={<Link>}>`.
- No `any`. Result envelope `{ ok: true, data } | { ok: false, message }`.
- Prisma `select` only.

## 7. DB safety

- Additive `RateLimitEvent` only. No drop, no rewrite of existing tables.
- `UserRoleAssignment` already exists (phase 1). Grant/revoke is data, not schema.
- **Do not** `prisma migrate deploy` on production. Create a Neon child and apply
  there before any demo environment that is a copy of prod.
- Bootstrap writes ADMIN rows only when the table has none — first-admin
  chicken-and-egg, not a production backfill of recruiters.

## 8. Verification

- `npm run test:demo1-security` green.
- `npx tsc --noEmit` (or project typecheck) passes.
- Recruiter A opens `/hire/<B's requestId>` → not found.
- Recruiter calling `resetProgressAction` → redirected / refused.
- Network tab on `/hire/requests` before unlock: no email/phone in the payload.
- Rapid guest search → readable rate-limit message.
- Grant admin on `/admin/platform-admins` → that user reaches `/admin` without
  changing env. Revoke → immediate refusal. Last admin cannot be revoked.

## 9. Commit message

```
feat(security): Demo 1 isolation, contact stripping, rate limits, DB admin

Lock Wave-1 architecture guardrails and enforce them on live Hire/admin
paths: per-recruiter ownership, hasContactAccess as the only contact reader,
durable rate limits on search/export, and Platform Admin via UserRoleAssignment.
```

---

## 10. The four rules (T-283 — locked 2026-09-09)

**R1 — Recruiter isolation.** Recruiter A cannot read or mutate recruiter B's
projects, pipeline, credits, ledger, jobs, assessments, unlocks or outreach —
including by editing IDs or URLs. Isolation key is `recruiterUserId` (the
session user). Same-company email domain does **not** share a workspace.

**R2 — Server-side authorization.** Every protected mutation and privileged
read is gated in the Server Action or Server Component with a DB-checked
helper. Hiding a button is not security. Middleware is session-only (edge-safe).

**R3 — Database is source of truth.** Product state that must survive refresh,
sign-out or another device is a row. `localStorage` / `sessionStorage` are only
for guest-before-account (must merge on sign-in), UI chrome, and one-shot flashes.

**R4 — Idempotency.** Duplicate or retried requests must not duplicate charges,
unlocks, applications, notifications or engagement rows. Prefer `@@unique` and
return the existing row. Credit spends are transactional.

**Review rule:** every HIGH-risk Wave-1 plan is signed against R1–R4 before
code. A plan that only gates in the UI fails R2.

## 11. Wave-1 approach sign-off (T-283 evidence)

| Owner | Wave-1 (DailyTask88 9–11 Sep) | R1–R4 | Sign-off |
|---|---|---|---|
| Zainab | T-225 work-email only; T-226 independent workspace; T-228 credits; T-229 unlock; T-230 unlock safety | R1: credits on the recruiter, not the company. R2: refuse personal domains **server-side**. R3: ledger is source of balance. R4: unlock unique per (recruiter, candidate); retry does not charge twice. | **Signed, with conditions.** Unlock code must call `hasContactAccess` / `loadProtectedContact` and `assertRateLimit("UNLOCK")`. Do not select contact fields on search (T-257). |
| Shivansh | T-220 evidence records; T-218 assessment autosave; T-212 profile persist; T-213 discoverability; T-217 export/delete | R3: profile + answers in DB. R4: evidence create is idempotent. R2: deletion/export is the candidate's own userId only. | **Signed.** Assessment answers must not live only in the browser. Evidence unique per source. |
| shashank | T-234 projects; T-235 search; T-240 pipeline; T-243 assessment builder; T-260 backup restore | R1: project `where` includes `recruiterUserId`. R3: criteria/pipeline/shortlist in DB. R4: publish/assign do not duplicate. | **Signed, with conditions.** Extend `TalentRequest`; do not add a parallel project table. Search calls `assertRateLimit("SEARCH")`. Preview uses the real candidate screen. |
| Manuvrtti | T-248 notifications; T-245/T-246 jobs | R1: recruiter jobs owned by the posting recruiter. R2: apply once server-side (`@@unique`). R4: notify once per `(userId, notificationKey)`. | **Signed, with conditions.** Jobs need an owner column before recruiter CRUD. Notifications reuse `NotificationRead` uniqueness. Export calls `assertRateLimit("EXPORT")`. |
| Shallika | T-200–T-204 designs | n/a (no server). | **Signed for design.** PASS/NEEDS FIX is 11 Sep (T-209). |
| Sohail | this plan | R1–R4 on Hire + admin | **Signed — implementing T-255–T-258, T-262 in the same change.** |

HIGH-risk plans that appear after this file still STOP for Sohail and must quote
R1–R4 in the plan's Guardrails section.
