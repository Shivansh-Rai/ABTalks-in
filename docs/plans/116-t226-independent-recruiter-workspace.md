# 116 — T-226 Independent recruiter setup

**Owner:** Zainab · **Due:** 2026-09-10 (Demo 1) · **Depends on:** T-225 ✅ (merged, PR #270), T-200 ✅ (design, confirmed done)
**Blocks:** T-228 (yours), T-255 (Sohail), T-234 + T-243 (shashank), T-245 (Manuvrtti), T-227 (yours, 11 Sep)
**Covers:** TC-R-003

---

## 1. Goal

A recruiter registers with a work email, verifies it, and reaches a working workspace of
their own. Two recruiters sharing an email domain get **separate, independent** workspaces —
neither can see the other's projects, credits, jobs, pipeline, assessments or outreach. An
interrupted setup resumes where it left off.

This is a product-contract clause, not a feature preference. Demo88 §2: *"Every recruiter
works alone… Two recruiters on the same company email domain stay independent."* Multi-user
company hiring is explicitly Phase 2 / Contact Sales.

## 2. Current behavior

**The good news, established by reading the code rather than assuming it.** The shared-company
model is **written but never read**. `src/features/hire/provision-recruiter.ts` is the *only*
file in `src/` that touches `Organization`, `OrganizationMember` or `UserRoleAssignment`, and
`TalentList` — the one model that hangs off `organizationId` — has **zero readers anywhere**.
`organizationId` appears in exactly two files: `provision-recruiter.ts` and
`repositories/types.ts`.

So T-226 is **not** the invasive unwind it looks like from the schema. No recruiter surface
reads org scope today. What exists is a write path pointing at a future that has been
cancelled.

What that write path currently does, deliberately:

- `provisionRecruiterIdentity` upserts an `Organization` by a slug derived from the **company
  name**, with the comment *"Two recruiters from the same company must land in the same
  Organization — that is the whole point of the model: it is what lets teammates share talent
  lists and jobs."* This is precisely what T-226 forbids.
- It then upserts an `OrganizationMember` and creates a `UserRoleAssignment` scoped to that org.
- Called from three places: `registerRecruiterWithOtpAction` (only when a seat auto-approves),
  `registerRecruiter` (the seat-gated Google path), and `approveRecruiterAction` (admin approval).

**Recruiter-scoped data today** is already per-user, not per-org — `RecruiterShortlistItem`,
`TalentRequest`, `TalentEngagementRequest` and `VirtualCandidateRequest` all key on
`recruiterUserId`. That is the correct shape for T-226 and needs no change.

**Setup state today is three-valued and not resumable.** `getRecruiterState` returns
`none | pending | approved`, and eight surfaces gate on it (`/hire` layout + page, `/talent`
layout, `/talent/login`, `/talent/register`, `/talent/pending`, `/talent/shortlist`, `/`).
There is no notion of a setup that was started and abandoned: a recruiter is registered or
they are not.

**Approval remains a human step.** A registration with no `VerifiedRecruiterSeat` lands
`approved: false` and waits for an admin. T-226 does not change that, and must not be read as
removing it.

## 3. Files to touch

| Path | | Note |
|---|---|---|
| `prisma/schema.prisma` | `[edit]` | `RecruiterProfile`: add `setupStep`, `setupCompletedAt`. New enum `RecruiterSetupStep`. |
| `prisma/migrations/<ts>_recruiter_independent_workspace/migration.sql` | `[new]` | Additive, nullable/defaulted. See §7. |
| `src/features/hire/provision-recruiter.ts` | `[edit]` | Slug per **recruiter**, not per company. Kill the shared-org upsert. |
| `src/features/talent-pool/recruiter-registration.ts` | `[edit]` | `RecruiterState` gains `setup_incomplete`; `getRecruiterState` returns the step. |
| `src/features/recruiter-workspace/workspace.ts` | `[new]` | `requireRecruiterWorkspace(userId)` — the single server-side resolver every recruiter surface uses. |
| `src/app/actions/recruiter-setup-actions.ts` | `[new]` | `saveRecruiterSetupStepAction`, `completeRecruiterSetupAction`. |
| `src/app/talent/setup/page.tsx` | `[new]` | Resumable setup, server component. |
| `src/components/talent/recruiter-setup-form.tsx` | `[new]` | `"use client"` — the only client file here. |
| `src/app/talent/pending/page.tsx` | `[edit]` | Route `setup_incomplete` → `/talent/setup`. |
| `src/app/talent/register/page.tsx` | `[edit]` | Same routing addition. |
| `src/app/hire/layout.tsx`, `src/app/hire/page.tsx`, `src/app/talent/layout.tsx`, `src/app/talent/shortlist/page.tsx`, `src/app/talent/login/page.tsx`, `src/app/page.tsx` | `[edit]` | Handle the new state; no other change. |
| `src/features/recruiter-workspace/workspace.test.ts` | `[new]` | Isolation + resume + same-domain independence. |
| `package.json` | `[edit]` | `test:recruiter-workspace` script. |
| `docs/CHANGELOG.md` | `[edit]` | One line under `## Pending reconcile`. |

**Do not touch:** `src/auth.ts`, `src/auth.config.ts`, `middleware.ts`, `src/lib/validations/work-email.ts`,
anything under `src/components/ui/`.

## 4. Server vs Client

Everything is a **Server Component** except `recruiter-setup-form.tsx`, which is `"use client"`
because it holds form state across steps.

**Server → Client boundary:** the setup page passes only a plain serialisable object —
`{ step: string, values: { fullName, company, phone } }`. No functions, no icons, no class
instances, no Prisma objects. The form calls Server Actions directly; it never receives one
as a prop.

## 5. Steps

### Step 1 — Schema

Add to `RecruiterProfile`:

```prisma
/// Where an interrupted setup resumes. COMPLETE means the workspace is usable.
setupStep        RecruiterSetupStep @default(PROFILE)
setupCompletedAt DateTime?
```

New enum, ordered as the wizard runs:

```prisma
enum RecruiterSetupStep {
  PROFILE
  COMPANY
  COMPLETE
}
```

Existing rows must land `COMPLETE` — see §7. A recruiter who registered before today has a
working account and must not be dropped into a setup wizard.

### Step 2 — One workspace per recruiter

Rewrite `orgSlug` in `provision-recruiter.ts` so the slug derives from the **recruiter's own
user id**, not the company name:

- `orgSlug(company)` → `recruiterWorkspaceSlug(userId, company)`, returning
  `` `${companyBase}-${userId.slice(-8)}` `` — readable, and unique per recruiter.
- Replace the `organization.upsert({ where: { slug } })` find-or-create with a create-if-absent
  keyed on that per-recruiter slug.
- Rewrite the block comment. The current one states the opposite rule and will otherwise mislead
  the next reader into "fixing" this back.
- `OrganizationMember` and `UserRoleAssignment` stay exactly as they are — with a per-recruiter
  org they can no longer put two people in one scope, which is what we want. `TalentList` keeps
  its non-null `organizationId` and needs no schema change.

**Why keep `Organization` at all rather than deleting it.** Plan 078 Phase 7 is frozen for
September (plan 112 §13 D-1) and `TalentList.organizationId` is a required FK. Repointing the
slug is a two-line behavioural change; removing the model is a migration against frozen
territory. Keep the table, change what a row *means*: one workspace, one recruiter.

### Step 3 — The state machine

In `recruiter-registration.ts`, widen `RecruiterState`:

```ts
| { status: "setup_incomplete"; step: RecruiterSetupStep; fullName: string; company: string }
```

`getRecruiterState` selects `setupStep` and `setupCompletedAt` and returns `setup_incomplete`
when `setupCompletedAt` is null. Order of checks, and it matters: **no profile → `none`;
profile but setup unfinished → `setup_incomplete`; setup done but unapproved → `pending`;
both → `approved`.** Setup precedes approval — an admin should be approving a finished
application, not a half-filled one.

### Step 4 — `requireRecruiterWorkspace`

New file, `"server-only"`. This is the resolver Sohail's T-255 will build his isolation sweep
on, so its shape matters beyond today:

```ts
export async function requireRecruiterWorkspace(): Promise<
  { ok: true; data: { userId: string; recruiterProfileId: string; organizationId: string } }
  | { ok: false; message: string }
>
```

It resolves the caller from `auth()` **on the server** and never accepts a userId, workspace id
or organization id from the caller. Every future recruiter-scoped read and write goes through
it. Returns the result envelope, like everything else.

### Step 5 — Setup actions

`saveRecruiterSetupStepAction` — Zod-validated per step, writes the fields for that step and
advances `setupStep`. Idempotent: re-saving the same step is not an error.
`completeRecruiterSetupAction` — validates every required field is present, sets
`setupStep: COMPLETE` and `setupCompletedAt: new Date()`, and only then calls
`provisionRecruiterIdentity`.

Both resolve the recruiter through `requireRecruiterWorkspace`, never from input.

### Step 6 — Setup page and routing

`/talent/setup` reads the state server-side and renders the step it is on. The six gating
surfaces get one new branch each: `setup_incomplete` → `redirect("/talent/setup")`. No other
logic changes in those files.

### Step 7 — Tests

`npm run test:recruiter-workspace`, following the `work-email.test.ts` convention — pure checks
plus source assertions:

1. Two recruiters on the same email domain resolve to **different** `organizationId`s.
2. `recruiterWorkspaceSlug` is stable for one user and distinct across users on one company name.
3. A resumed setup returns to its stored step; re-saving a step is idempotent.
4. `getRecruiterState` orders correctly — `setup_incomplete` wins over `pending`.
5. Source: `provision-recruiter.ts` contains no company-only slug, and the misleading comment is gone.
6. Source: every file that calls `getRecruiterState` handles `setup_incomplete` (no silent fallthrough).
7. Source: `requireRecruiterWorkspace` reads `auth()` and takes no id parameter.

## 6. Guardrails for Cursor (DO NOT)

- **DO NOT** touch `middleware.ts`, `auth.config.ts` or `auth.ts`. Nothing here is edge-adjacent.
- **DO NOT** add `requireRole`/`requireAdmin` to `/talent/setup` — it is reached by a signed-in
  but **unapproved** recruiter. Gate on session + recruiter profile only. Marking it admin-only
  is the failure mode that has happened before on public/pending surfaces.
- **DO NOT** remove the approval step. `approved` stays; T-226 is about workspace independence,
  not auto-approval.
- **DO NOT** drop, rename or empty `Organization`, `OrganizationMember`, `UserRoleAssignment` or
  `TalentList`. Change the slug rule only.
- **DO NOT** accept a workspace id, organization id or user id from the client anywhere. Server-resolved
  or it does not happen.
- **DO NOT** create new abstraction files beyond the three listed in §3.
- **DO NOT** weaken T-225. `isPersonalEmailDomain` guards stay exactly where they are, and
  `npm run test:work-email` must still pass 15/15.
- **DO NOT** build company identity fields (website, industry, size) — that is **T-227**, tomorrow.
  The COMPANY step here collects only what `RecruiterProfile` already has.
- **DO NOT** backfill existing recruiters into `PROFILE`. They are `COMPLETE`.

## 7. DB safety

Schema change, so: commit checkpoint on a clean tree, **Neon branch snapshot before migrating**,
record the commit hash in the PR.

The four previously-pending migrations were applied to the dev database on 2026-09-09 and
`prisma migrate status` reports up to date, so this migration lands on a clean base. **Production
has not had those four applied** — flag that in the PR; this migration must not reach production
ahead of them.

Migration must be additive and safe on a live table:

```sql
CREATE TYPE "RecruiterSetupStep" AS ENUM ('PROFILE', 'COMPANY', 'COMPLETE');

ALTER TABLE "RecruiterProfile"
  ADD COLUMN "setupStep" "RecruiterSetupStep" NOT NULL DEFAULT 'PROFILE',
  ADD COLUMN "setupCompletedAt" TIMESTAMP(3);

-- Every recruiter that exists today already has a working account.
UPDATE "RecruiterProfile"
SET "setupStep" = 'COMPLETE', "setupCompletedAt" = "createdAt";
```

The `UPDATE` is the important line. Without it every existing recruiter is thrown into a setup
wizard on their next sign-in.

Then `npx prisma generate`.

Existing `Organization` rows are left alone. A pre-existing shared org keeps its members; only
**new** provisioning is per-recruiter. Note this in the PR as a known residue — the dev DB has
zero recruiters, so in practice there is nothing to migrate.

## 8. Verification

```bash
npm run test:recruiter-workspace
npm run test:work-email          # must still be 15/15 — T-225 unharmed
npx tsc --noEmit                 # expect 0 errors; baseline is now 0
npx eslint <changed files>
```

Manual, on `/talent/register` with `ENABLE_RECRUITER_AUTH=true` set locally **and reverted after**:

1. Register `a@acme-test.com`, complete setup, land in a working workspace.
2. Register `b@acme-test.com` — same domain — complete setup. Confirm a **separate** workspace:
   different `organizationId`, and A's shortlist/requests invisible to B.
3. Start a third setup, abandon it mid-way, sign out, sign back in — lands on the step it left.
4. Confirm a gmail.com address is still refused (T-225 regression).
5. Confirm candidate sign-in is untouched.

Changed files should be exactly those in §3 — nothing else.

## 9. Commit message

```
feat(recruiter): one independent workspace per recruiter (T-226)

Two recruiters on the same email domain now get separate workspaces.
provisionRecruiterIdentity keyed its Organization slug on the company name,
deliberately putting colleagues in one shared org; the September product
contract says every recruiter works alone and multi-user hiring is Phase 2,
so the slug is now per-recruiter.

RecruiterProfile gains setupStep + setupCompletedAt so an interrupted setup
resumes where it left off, and getRecruiterState gains a setup_incomplete
state ordered ahead of pending. requireRecruiterWorkspace resolves the
caller server-side and is the single boundary every recruiter-scoped read
and write will go through.

Approval is unchanged. T-225 work-email enforcement is untouched.

Covers TC-R-003.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
