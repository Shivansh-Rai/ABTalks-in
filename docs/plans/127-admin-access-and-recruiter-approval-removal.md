# 127 — Admin access repair + removal of the recruiter application process

Status: ready to execute
Author: Claude (planning), 2026-09-11
Related: plan 112 (September execution), T-226 (independent recruiter
workspace), T-243 (recruiter assessments)

---

## 1. Goal

Fix three production complaints in one pass: (a) the admin panel bounces an
`ADMIN_EMAILS` account straight back to `/dashboard`, (b) the admin Jobs page is
unreachable for the same reason, and (c) a registered recruiter is parked behind
an "Application received / we're reviewing your recruiter application" screen
instead of landing in their own workspace. After this, an `ADMIN_EMAILS` account
reaches `/admin` and `/admin/jobs`, and any recruiter who signs in lands in
`/hire` with a provisioned workspace — no approval queue anywhere.

---

## 2. Current behavior

### 2a. Admin panel / admin jobs — REPRODUCED

`src/lib/admin-auth.ts` has two authorities that disagree:

- `auth.config.ts:63` sets `token.isAdmin` from **`ADMIN_EMAILS`**, so the
  header renders the "Admin" button (`app-header.tsx:133`).
- `requireAdmin()` gates on a live **`UserRoleAssignment(ADMIN, GLOBAL)`** row
  and `redirect("/dashboard")` when there is none.

The bridge between them, `bootstrapAdminsFromEnv()`, is written as a
**global** first-run bootstrap:

```ts
const active = await prisma.userRoleAssignment.count({
  where: { role: ADMIN, scopeType: GLOBAL, revokedAt: null },
});
if (active > 0) return;                 // <- bails for EVERY later env addition
```

Verified against the dev database on 2026-09-11:

| fact | value |
| --- | --- |
| `ADMIN_EMAILS` | `shivanshrai2316@gmail.com` |
| that user | `cmoimq8nr0000ib043bjpyoe7`, role `STUDENT`, **no** admin assignment |
| active `GLOBAL ADMIN` rows | exactly 1, for `sksohail.swaraj@gmail.com` |

Because someone else already holds the only GLOBAL ADMIN row, the bootstrap
short-circuits and the env-listed email is never granted. Curl with a minted
session for that user:

```
GET /admin       -> 307 /dashboard
GET /admin/jobs  -> 307 /dashboard
GET /jobs        -> 200      (candidate jobs page is fine)
GET /dashboard   -> 200
```

So **"jobs not working" is the same defect**: `/admin/jobs`, and every
`admin-job-actions.ts` mutation (`createJobAction`, `updateJobAction`,
`toggleJobOpenAction`, `deleteJobAction`), all call `requireAdmin()` first. The
candidate-facing `/jobs` list renders correctly and the data is present
(3 published jobs, 68 applications).

### 2b. Recruiter application process — REPRODUCED by inspection

`RecruiterProfile.approved` gates every recruiter surface:

- `lib/program-auth.ts:82` — `requireRecruiter()` redirects to `/talent/pending`
  when `!profile.approved`. This is what `/hire/assessments`,
  `/hire/create-test`, `/hire/evidence`, `/hire/requests`, `/hire/[requestId]`
  and `/talent/members/[id]` all sit behind, which is exactly the reported
  "assessment is gated by Application received".
- `features/recruiter-workspace/workspace.ts:54` — refuses with "Your recruiter
  application is still under review."
- `app/talent/pending/page.tsx` — the "Application received … We're reviewing
  your recruiter application for {company}. You'll receive an email once
  approved." screen.
- Registration writes `approved: Boolean(seat)` where `seat` is a
  `VerifiedRecruiterSeat` row, so a recruiter with no pre-verified seat is
  parked unapproved and must be approved by hand in `/admin/recruiters`.
- `getRecruiterState()` also has a `setup_incomplete` state that bounces to a
  two-step `/talent/setup` wizard; that wizard is the only place a workspace
  (`Organization` + `OrganizationMember` + `UserRoleAssignment` + starting
  credits) is ever provisioned for a non-seated recruiter.

Dev-database recruiter profiles: 4 rows, 2 with `approved: false`, 1 with
`setupCompletedAt: null`; only 2 `OrganizationMember` rows exist. So two
recruiters today have no workspace at all.

---

## 3. Files to touch

### Fix A — admin access

| file | | note |
| --- | --- | --- |
| `src/lib/admin-auth.ts` | `[edit]` | Bootstrap per email, not once globally; fold it into the miss path of `hasPlatformAdmin`. |

### Fix B — remove the application process

| file | | note |
| --- | --- | --- |
| `src/features/hire/provision-recruiter.ts` | `[edit]` | Add `ensureRecruiterWorkspace(userId)` — idempotent, self-healing, no new file. |
| `src/features/talent-pool/recruiter-registration.ts` | `[edit]` | `RecruiterState` becomes `none \| active`. Drop `pending`, `setup_incomplete`, `listPendingRecruiterApplications`. `registerRecruiter()` provisions immediately, no seat requirement. |
| `src/features/recruiter-workspace/workspace.ts` | `[edit]` | Drop the `approved` / `setupCompletedAt` refusals; heal a missing workspace instead of failing. |
| `src/lib/program-auth.ts` | `[edit]` | `requireRecruiter()`: session + profile only, then ensure workspace. Redirects to `/talent/login` / `/talent/register`. |
| `src/lib/recruiter-gate.ts` | `[edit]` | Both gates stop reading `approved`. |
| `src/features/talent-pool/pool.ts` | `[edit]` | `assertPoolAccess` requires a profile, not approval. |
| `src/features/hire/recruiter-account.ts` | `[edit]` | Stop returning `null` for an unapproved profile. |
| `src/app/actions/recruiter-auth-actions.ts` | `[edit]` | OTP registration always approves, completes setup and provisions. |
| `src/app/actions/talent-actions.ts` | `[edit]` | Drop the `/talent/pending` revalidate. |
| `src/app/actions/talent-project-actions.ts` | `[edit]` | `requireApprovedRecruiter` becomes a registered-recruiter check. |
| `src/app/actions/recruiter-seat-actions.ts` | `[edit]` | Stop flipping `RecruiterProfile.approved` when a seat is toggled. |
| `src/app/actions/admin-recruiter-actions.ts` | `[delete]` | approve/reject are the application process. |
| `src/components/talent/admin-recruiters-panel.tsx` | `[edit]` | Becomes a read-only recruiter directory (no approve/reject buttons). |
| `src/app/admin/recruiters/page.tsx` | `[edit]` | "Waiting for review" becomes "All recruiters"; keep the verified-emails panel. |
| `src/app/admin/program/recruiters/page.tsx` | `[edit]` | Same list, new copy. |
| `src/app/admin/layout.tsx` | `[edit]` | Drop the pending-count badge and its query. |
| `src/app/admin/page.tsx` | `[edit]` | "Pending Recruiters" card becomes "Recent Recruiters". |
| `src/features/admin/get-overview-stats.ts` | `[edit]` | `pendingRecruiters` becomes `recentRecruiters` (drop the `approved: false` filter). |
| `src/app/talent/pending/page.tsx` | `[delete]` | The screen the user asked to remove. |
| `src/app/talent/setup/page.tsx` | `[delete]` | Registration now provisions; the wizard is the other half of the wait. |
| `src/components/talent/recruiter-setup-form.tsx` | `[delete]` | |
| `src/app/actions/recruiter-setup-actions.ts` | `[delete]` | Its credit grant already lives in `provisionRecruiterIdentity`. |
| `src/app/page.tsx` | `[edit]` | Recruiter goes to `/hire`, full stop. |
| `src/app/talent/login/page.tsx` | `[edit]` | Signed-in recruiter goes to `redirectTo`. |
| `src/app/talent/register/page.tsx` | `[edit]` | Same, plus drop the "someone confirms your company" copy. |
| `src/app/talent/layout.tsx` | `[edit]` | Drop `pending`. |
| `src/app/hire/layout.tsx` | `[edit]` | Drop `pending` / `pendingName`. |
| `src/app/hire/page.tsx` | `[edit]` | `persist` from `active`. |
| `src/app/talent/shortlist/page.tsx` | `[edit]` | `active` instead of `approved`. |
| `src/components/hire/hire-auth-provider.tsx` | `[edit]` | Drop `pending` from the context. |
| `src/components/hire/hire-chrome.tsx` | `[edit]` | Drop the "Pending · Sign out" header branch. |
| `src/components/hire/hire-talent-pod.tsx` | `[edit]` | Drop the `approvalPending` toast branch. |
| `src/components/hire/request-intro-button.tsx` | `[edit]` | Same (two branches). |
| `src/components/talent/recruiter-login-form.tsx` | `[edit]` | Navigate to `/hire`. |
| `src/components/talent/recruiter-register-form.tsx` | `[edit]` | Copy only; still lands on `/talent/login?email=`. |
| `src/components/talent/talent-shell.tsx` | `[edit]` | `HIDE_NAV` loses `/talent/pending`. |
| `src/features/recruiter-workspace/workspace.test.ts` | `[edit]` | Replace the four approval/setup suites with ones asserting the new contract. |
| `src/features/recruiter-auth/work-email.test.ts` | `[edit]` | Drop the two suites that assert seat/approve ordering in deleted code; keep every work-email rule. |
| `docs/CHANGELOG.md` | `[edit]` | One dated line under `## Pending reconcile`. |

**No schema change.** `RecruiterProfile.approved` / `approvedAt` /
`setupStep` / `setupCompletedAt` stay in the schema (Plan 078 Phase 7 is frozen
for September). They are written `true` / `COMPLETE` / now, and are no longer
read as a gate. No migration, no Neon branch, no backfill script: existing
`approved: false` rows self-heal on the owner's next visit via
`ensureRecruiterWorkspace`.

---

## 4. Server vs Client

Everything touched on the server side is a Server Component, Server Action or
`server-only` module. Client components touched:

| component | direction |
| --- | --- |
| `hire-auth-provider.tsx` `"use client"` | receives `approved: boolean`, `signedIn: boolean`, `authEnabled: boolean` from `hire/layout.tsx` and `talent/layout.tsx` (Server). Only booleans cross. |
| `hire-chrome.tsx` `"use client"` | loses the `pendingName: string \| null` prop. `account` and `podRows` (plain serialisable objects) are unchanged. |
| `hire-talent-pod.tsx`, `request-intro-button.tsx` `"use client"` | read the context, no prop change. |
| `admin-recruiters-panel.tsx` `"use client"` | receives `recruiters: RecruiterRow[]` (plain objects, `createdAt` already an ISO string). After the edit it holds no state and calls no action — **convert it to a Server Component** and drop `"use client"`. |

No functions, icons or class instances cross any Server to Client boundary.

---

## 5. Steps

### Step 1 — `src/lib/admin-auth.ts`

Replace `bootstrapAdminsFromEnv()` and `hasPlatformAdmin()`:

- `hasPlatformAdmin(userId)` first does the existing `findFirst` for a live
  `ADMIN/GLOBAL/revokedAt: null` row and returns `true` on a hit — **no
  bootstrap query on the happy path** (today it always runs a `count` first, so
  this is one query fewer per admin request).
- On a miss it calls `bootstrapAdminFromEnv(userId)`, which:
  1. returns `false` if `ADMIN_EMAILS` is empty;
  2. loads the user's `email` and refuses if it is not in the list
     (case-insensitive);
  3. counts that user's own `ADMIN/GLOBAL` rows **including revoked ones** — a
     non-zero count means the grant was deliberately revoked, so it returns
     `false` and env never re-grants it (the existing rule, now enforced
     per person instead of platform-wide);
  4. otherwise `create`s the assignment inside `try/catch` (a concurrent
     duplicate is not an error) and returns `true`.
- Keep the `logger.error` on failure. Keep the doc comment's promise — restate
  it as *per email*, and say why: an email added to `ADMIN_EMAILS` after the
  first admin exists was silently ignored.

Leave `auth.config.ts` alone. `token.isAdmin` stays an env-derived hint for
chrome; the DB row stays the authority. After this change they agree.

### Step 2 — `ensureRecruiterWorkspace` in `src/features/hire/provision-recruiter.ts`

Append:

```ts
export async function ensureRecruiterWorkspace(
  userId: string,
): Promise<{
  organizationId: string;
  recruiterProfileId: string;
  company: string;
  fullName: string;
} | null>
```

- `prisma.recruiterProfile.findUnique({ where: { userId }, select: { id, fullName, company, approvedAt, setupCompletedAt } })`; `null` returns `null`.
- `prisma.organizationMember.findFirst({ where: { userId, status: "ACTIVE" }, select: { organizationId } })`.
- If that membership exists **and** `setupCompletedAt` is set, return it. This
  is the steady state and costs the same two reads
  `requireRecruiterWorkspace` already paid.
- Otherwise run one interactive transaction:
  `provisionRecruiterIdentity(tx, { userId, company: profile.company })` (which
  is already idempotent and already funds the workspace through
  `grantOnboardingCredits`), then
  `tx.recruiterProfile.update({ where: { id }, data: { approved: true, approvedAt: profile.approvedAt ?? new Date(), setupStep: "COMPLETE", setupCompletedAt: new Date() } })`.
  Use `{ maxWait: 20_000, timeout: 20_000 }` — the same window
  `grantOnboardingCreditsAtomic` uses, because the same credit lock is taken.
- Comment it as the replacement for `completeRecruiterSetupAction`: the workspace
  is now created by the act of being a recruiter, not by finishing a wizard.

### Step 3 — `src/features/talent-pool/recruiter-registration.ts`

- `RecruiterState` becomes
  `{ status: "none" } | { status: "active"; fullName: string; company: string }`.
- `getRecruiterState` returns `active` for any existing profile. **Read-only** —
  it runs in layouts; it must not provision.
- Delete `listPendingRecruiterApplications` and `PendingRecruiterApplication`;
  add `listRecruiters()` returning every profile (id, fullName, company, phone,
  email, `createdAt` ISO, `hasWorkspace`) newest first, `take: 500`.
- `registerRecruiter(userId, input)`: keep the student-account refusal, the role
  check, the existing-profile check and `isPersonalEmailDomain`. **Remove** the
  `VerifiedRecruiterSeat` requirement; keep the lookup only to prefer
  `seat.company` over the typed company. Create the profile with
  `approved: true`, `approvedAt: new Date()`, `setupStep: "COMPLETE"`,
  `setupCompletedAt: new Date()`, set `User.role = RECRUITER`, and call
  `provisionRecruiterIdentity` in the same transaction (it already does).

### Step 4 — the gates

- `features/recruiter-workspace/workspace.ts`: keep the session and
  profile-exists checks and the "resolved from the session, never from a
  payload" doc. Delete the `setupCompletedAt` and `approved` refusals. Replace
  the membership lookup with `ensureRecruiterWorkspace(userId)`; `null` gives
  "This account is not a recruiter account."
- `lib/program-auth.ts` `requireRecruiter()`: no session redirects to
  `/talent/login`; `ensureRecruiterWorkspace(userId)` returning `null` redirects
  to `/talent/register`; otherwise return `{ profile: { id, company, fullName }, userId }`
  so the six existing call sites keep compiling.
- `lib/recruiter-gate.ts`: `requireApprovedRecruiterAction` keeps its name and
  signature (six call sites) but now only requires a profile — update the
  doc comment and the messages ("Sign in to continue." / "Register as a
  recruiter first."). `requireRegisteredRecruiterAction` keeps returning
  `approved` but hard-codes `true`.
- `features/talent-pool/pool.ts` `assertPoolAccess`: `select: { id: true }`,
  refuse only when there is no profile.
- `app/actions/talent-project-actions.ts` `requireApprovedRecruiter`: same.
- `features/hire/recruiter-account.ts`: drop `approved` from the select and the
  `if (!profile?.approved) return null` line; keep `if (!profile) return null`.

### Step 5 — registration action

`app/actions/recruiter-auth-actions.ts`, `registerRecruiterWithOtpAction`:

- Keep the OTP verification, the duplicate-profile refusal and both
  `isPersonalEmailDomain` checks (the work-email rule is unrelated to approval
  and stays exactly as it is).
- `const seat = await findLiveSeat(normalised)` stays, used only for
  `seat?.company`. Delete `const approved = Boolean(seat)`.
- Always create with `approved: true`, `approvedAt: new Date()`,
  `setupStep: "COMPLETE"`, `setupCompletedAt: new Date()`, and always call
  `provisionRecruiterIdentity`.
- Return `{ ok: true, data: { approved: true } }` — the shape the register form
  already accepts; do not churn the client contract.
- Rewrite the function doc: the account is live the moment the code is verified.

### Step 6 — delete the wait

Delete `src/app/talent/pending/page.tsx`, `src/app/talent/setup/page.tsx`,
`src/components/talent/recruiter-setup-form.tsx`,
`src/app/actions/recruiter-setup-actions.ts`,
`src/app/actions/admin-recruiter-actions.ts`.

Then fix every reference the compiler finds:

- `app/page.tsx` — `redirect(recruiter.status === "none" ? "/dashboard" : "/hire")`, no setup branch.
- `app/talent/login/page.tsx` — `if (state.status === "active") redirect(redirectTo)`.
- `app/talent/register/page.tsx` — `if (state.status === "active") redirect(redirectTo)`; replace "someone from ABTalks confirms your company before access opens" with "We verify your email and your workspace opens straight away."
- `components/talent/recruiter-login-form.tsx` — `window.location.href = "/hire"`, and rewrite the T-226 comment: there is no intermediate state left to re-read.
- `components/talent/recruiter-register-form.tsx` — comment only.
- `components/talent/talent-shell.tsx` — `HIDE_NAV = ["/talent/login", "/talent/register"]`.
- `app/actions/talent-actions.ts` — drop `revalidatePath("/talent/pending")`.

### Step 7 — hire/talent chrome

- `app/hire/layout.tsx`: `const active = state.status === "active"`; delete
  `pending`; `{active && <MergeGuestCart />}`; pass `approved={active}`; drop
  `pendingName`.
- `app/talent/layout.tsx`: same.
- `app/hire/page.tsx`: `const persist = recruiter.status === "active"`.
- `app/talent/shortlist/page.tsx`: `state.status !== "active"`.
- `components/hire/hire-auth-provider.tsx`: drop `pending` from the type, the
  props, the fallback and the memo.
- `components/hire/hire-chrome.tsx`: drop the `pendingName` prop and the
  `: pendingName ? (…)` branch, leaving `account ? menu : sign-in button`.
- `components/hire/hire-talent-pod.tsx` and
  `components/hire/request-intro-button.tsx`: `const { approved, openAuth } = useHireAuth()`
  and delete the three `if (approvalPending) { toast.error("…still being reviewed."); return; }`
  blocks. A signed-out visitor still falls through to `savePendingCheckout` +
  `openAuth("checkout")`, which is the behaviour that already exists for guests.

### Step 8 — admin surfaces

- `features/admin/get-overview-stats.ts`: rename `pendingRecruitersRaw` to
  `recentRecruitersRaw`, drop `where: { approved: false }`, order
  `createdAt: "desc"`, `take: 5`; rename the returned key to `recentRecruiters`.
- `app/admin/page.tsx`: retitle the card "Recent Recruiters", empty copy "No
  recruiters yet.", and change the row button from "Review" to "View".
- `app/admin/layout.tsx`: delete `pendingRecruiterCount`, its `try/catch`, the
  `prisma`/`logger` imports if now unused, and make the nav label the plain
  string `"Recruiters"`.
- `components/talent/admin-recruiters-panel.tsx`: drop `"use client"`, the two
  action imports and both handlers. Rename the prop to `recruiters` and render
  name / company / email / phone / joined date / a "workspace ready" or "no
  workspace yet" hint. No buttons.
- `app/admin/recruiters/page.tsx`: `listRecruiters()`; section heading
  "All recruiters (n)"; page subtitle drops "or pre-verify a work email so they
  skip the wait" in favour of "Everyone who has registered to hire, and the work
  emails we have pre-verified." Keep `RecruiterSeatsPanel`.
- `app/admin/program/recruiters/page.tsx`: `listRecruiters()`, subtitle
  "Everyone registered for post-publish talent pool access."
- `app/actions/recruiter-seat-actions.ts` `setRecruiterSeatActiveAction`: delete
  the `recruiterProfile.updateMany({ data: { approved: active } })` block and
  the `user` lookup that only feeds it. Leave a comment saying a seat is now a
  pre-verified company name, not an access grant.

### Step 9 — tests

- `features/recruiter-workspace/workspace.test.ts`: keep every slug suite and
  every "resolved from the session" suite. Replace:
  - "an unfinished or unapproved recruiter gets no workspace" with **"a
    registered recruiter always gets a workspace"**: assert `workspace.ts`
    contains `ensureRecruiterWorkspace` and contains neither `profile.approved`
    nor `under review`.
  - "setup_incomplete is decided before pending" with **"there is no pending
    state"**: assert `recruiter-registration.ts` contains neither
    `"pending"` nor `"setup_incomplete"`.
  - the suite reading `src/app/talent/pending/page.tsx` with an assertion that
    the file does **not** exist (`existsSync`), same for `/talent/setup`.
  - "the setup page is reachable by an unapproved recruiter" with **"no route
    redirects to an application screen"**: grep `src/app` and `src/components`
    for `/talent/pending` and assert zero hits.
- `features/recruiter-auth/work-email.test.ts`: delete "the authenticated path
  refuses before the seat is consulted" (the seat is no longer a gate) and "an
  admin cannot approve a personal-domain application" (the action is gone).
  Drop `admin-recruiter-actions.ts` from the no-escape-hatch loop. Every other
  suite — including both `isPersonalEmailDomain` ordering suites and the seat
  schema suite — stays untouched.

### Step 10 — changelog

Append one dated line to `docs/CHANGELOG.md` under `## Pending reconcile`.

---

## 6. Guardrails for Cursor (DO NOT)

- **DO NOT** touch `middleware.ts` or `auth.config.ts`. Nothing here needs a new
  protected path, and `@/lib/*` must never enter the edge bundle.
- **DO NOT** change `prisma/schema.prisma`. No column is dropped, renamed or
  added. Plan 078 Phase 7 is frozen for September.
- **DO NOT** run a migration, a seed, a backfill or `db:cleanup`. Existing
  `approved: false` rows heal themselves on next visit.
- **DO NOT** weaken the work-email rule. `isPersonalEmailDomain` /
  `WORK_EMAIL_REQUIRED_MESSAGE` must still refuse before any profile is written,
  in both registration paths. It is a separate rule from approval.
- **DO NOT** add `requireRole` / `requireAdmin` to `/talent/login`,
  `/talent/register`, `/hire`, `/talent`, `/hire/matches` or
  `/talent/shortlist`. They are public entries and the middleware exempts them
  by exact path.
- **DO NOT** delete `VerifiedRecruiterSeat`, `RecruiterProfile.approved`,
  `approvedAt`, `setupStep` or `setupCompletedAt` — from the schema or from the
  writes. They are written and ignored, not removed.
- **DO NOT** provision from `getRecruiterState`. It runs in two layouts on every
  request; writes belong in `requireRecruiter` / `requireRecruiterWorkspace`.
- **DO NOT** create new abstraction files. `ensureRecruiterWorkspace` goes in
  `features/hire/provision-recruiter.ts` next to the code it wraps.
- **DO NOT** use `<Button asChild>` or `<Button render={<Link>}>`; put
  `buttonVariants` on the `<Link>`.
- **DO NOT** use `console.error`; `lib/logger.ts` only.
- **DO NOT** re-scope `bootstrapAdminFromEnv` back to a platform-wide count —
  that is the bug.
- **DO NOT** let env re-grant a revoked admin. The per-user check must count
  revoked rows too.

---

## 7. DB safety

Not applicable — no schema or data migration. The only new writes are ones the
codebase already performs (`provisionRecruiterIdentity`,
`recruiterProfile.update`, `userRoleAssignment.create`), issued through existing
idempotent paths.

---

## 8. Verification

1. `npx tsc --noEmit -p tsconfig.json` — clean.
2. `npm run lint` — no new errors.
3. `npm run test:recruiter-workspace`, `npm run test:work-email`,
   `npm run test:demo1-security` — all pass.
4. `npm run build` — succeeds (this is what proves nothing still imports a
   deleted route or action).
5. Dev server + a minted session cookie for `shivanshrai2316@gmail.com`
   (`authjs.session-token.v2`):
   - `GET /admin` gives **200** (was 307 to `/dashboard`)
   - `GET /admin/jobs` gives **200** and lists the 3 seeded jobs
   - `GET /admin/recruiters` gives 200, shows all 4 recruiters, no Approve/Reject
   - a `UserRoleAssignment(ADMIN, GLOBAL)` row now exists for that user, and
     the pre-existing row for `sksohail.swaraj@gmail.com` is untouched
6. Dev server + a minted session for the unapproved recruiter
   `cmtvr27fl0002og94gids0h70` (`Shivansh Rai / bigbets`, `approved: false`):
   - `GET /hire` gives 200
   - `GET /hire/assessments` gives **200** (was 307 to `/talent/pending`)
   - `GET /hire/create-test` gives 200
   - `GET /talent/pending` gives **404**
   - afterwards that profile reads `approved: true`, `setupCompletedAt` set, and
     an `OrganizationMember(ACTIVE)` row exists for it
7. Files changed: exactly the table in §3 — 5 deletions, no new source file,
   `prisma/schema.prisma` untouched.

---

## 9. Commit message

```
fix(admin,hire): grant env admins per email and drop recruiter approval

bootstrapAdminsFromEnv bailed whenever any GLOBAL ADMIN row existed, so an
email added to ADMIN_EMAILS after the first admin never got an assignment —
the header showed Admin (env-derived) and /admin 307'd to /dashboard. It is
now per email, still refusing to re-grant a revoked one.

Recruiter approval is removed. Registration provisions the workspace and the
starting credits, so signing in lands on /hire instead of "Application
received". /talent/pending, /talent/setup and the admin approve/reject queue
are deleted; RecruiterProfile.approved stays in the schema, written true and
read nowhere.
```

---

## 10. Note for the product owner

Removing approval also removes the only mechanism that could hold or revoke
recruiter access: after this, anyone who can receive mail at a non-personal
domain self-serves into a workspace that can browse candidate evidence. The
work-email rule and `VerifiedRecruiterSeat` both survive, but neither gates
anything any more. If access control is wanted back later, the cheapest
re-entry is a single read of `approved` in `ensureRecruiterWorkspace` — the
column and its data are deliberately left in place for exactly that.
