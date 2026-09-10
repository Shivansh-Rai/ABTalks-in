# 119 — Admin soft-delete user account

## 1. Goal

Admins can soft-delete any student account from `/admin/students/[id]`: red **Delete user account** → modal (“Are you sure…”, type `delete`, **Delete** / **Cancel**) → account cannot log in, disappears from admin lists, PII scrubbed; evidence rows (certificates, points ledger, credentials) retained.

## 2. Current behavior

- Student detail: [`src/app/admin/students/[id]/page.tsx`](src/app/admin/students/[id]/page.tsx) — challenge path mounts [`StudentActionPanel`](src/components/admin/student-action-panel.tsx); hackathon path only has `GrantSynergyDialog`.
- Closest destructive action: **Remove from Challenge** (enrollment → `ABANDONED`), not account delete.
- Schema already has `User.deletedAt` / `User.anonymizedAt` (078); talent/interview already gate on `deletedAt: null`. **No `anonymizeUser` writer exists.** Hard `user.delete` is blocked by Restrict FKs (I15).
- Auth uses JWT (`auth.config.ts`); middleware cannot import Prisma. Node `auth()` from [`src/auth.ts`](src/auth.ts) can reject deleted users in callbacks.

**Defaults (locked):** Soft-delete + PII scrub. Button on **both** challenge and hackathon detail views. Confirmation text must be exactly `delete` (case-sensitive). Never hard-delete. Block deleting yourself or another platform admin.

## 3. Files to touch

- [`docs/plans/119-admin-soft-delete-user.md`](docs/plans/119-admin-soft-delete-user.md) **[new]** — this plan (project convention)
- [`src/features/admin/anonymize-user.ts`](src/features/admin/anonymize-user.ts) **[new]** — transactional soft-delete + scrub
- [`src/app/actions/admin-actions.ts`](src/app/actions/admin-actions.ts) **[edit]** — `deleteUserAccountAction`
- [`src/components/admin/delete-user-account-dialog.tsx`](src/components/admin/delete-user-account-dialog.tsx) **[new]** — red trigger + type-to-confirm modal
- [`src/components/admin/student-action-panel.tsx`](src/components/admin/student-action-panel.tsx) **[edit]** — mount dialog
- [`src/app/admin/students/[id]/page.tsx`](src/app/admin/students/[id]/page.tsx) **[edit]** — mount dialog on hackathon branch
- [`src/features/admin/get-students.ts`](src/features/admin/get-students.ts) **[edit]** — exclude `user.deletedAt != null`
- [`src/features/admin/get-student-detail.ts`](src/features/admin/get-student-detail.ts) **[edit]** — `notFound` if deleted
- [`src/auth.ts`](src/auth.ts) **[edit]** — reject deleted users on sign-in / authorize / session
- [`docs/CHANGELOG.md`](docs/CHANGELOG.md) **[edit]** — one pending-reconcile line (rule)

No Prisma migration (columns already exist).

## 4. Server vs Client

| Piece | Kind |
|-------|------|
| `[id]/page.tsx` | Server — passes `userId`, `userName` only |
| `delete-user-account-dialog.tsx` | Client — dialog open state, confirm input, pending |
| `student-action-panel.tsx` | Client — already; add dialog sibling |
| `anonymize-user.ts` / action | Server only |

Props across boundary: serializable strings only (`userId`, `userName`). No functions/icons.

## 5. Soft-delete semantics (`anonymizeUser`)

Run inside `writeClient().$transaction`. Never `prisma.user.delete`.

Concrete scrub (in transaction):

1. **Guards (before write):** target exists; `deletedAt` is null; `targetUserId !== admin.userId`; target is not platform admin (`hasPlatformAdmin`).
2. **Audit first** while email/name still readable: `AdminAction` with `actionType: "DELETE_USER_ACCOUNT"`, optional reason in metadata.
3. **User:** set `deletedAt` + `anonymizedAt` to now; `email` → `deleted+{userId}@deleted.local` (unique); `name` → `"Deleted User"`; `image`/`password`/`emailVerified` → null.
4. **Auth unlink:** `account.deleteMany({ userId })`, `session.deleteMany({ userId })`.
5. **StudentProfile** (if any): `fullName` → `"Deleted User"`; null out phone, college, org, links, resumeUrl; clear skills; set `phoneVerified` false; `referralCode` → `del_{userId}` (unique).
6. **CandidateProfile** (if any): same PII scrub; `referralCode` → `delc_{userId}`.
7. **PhoneVerification:** null/scrub phone or delete row.
8. **CandidateVisibility:** `searchableByRecruiters: false`, field shows false, set `withdrawnAt`.
9. **Challenge:** ACTIVE `Enrollment` → `ABANDONED` + existing dual-write helper if used by remove-from-challenge.
10. **Program:** active `ProgramMember` / open `ProgramEnrollment` — mark dropped/abandoned using the same status values existing drop/abandon paths use (do not invent new enums).
11. **Roles:** set `revokedAt` on subject’s active `UserRoleAssignment` rows.
12. Do **not** delete Certificate / Credential / PointsTransaction / SynergyEvent / AssessmentReport.

## 6. Steps

### Step 1 — `anonymize-user.ts`

Export `anonymizeUser(tx, { userId, adminUserId })` used only by the admin action. Use `select` on all reads. Throw typed errors for guard failures (action maps to `{ ok: false, message }`).

### Step 2 — `deleteUserAccountAction`

In [`admin-actions.ts`](src/app/actions/admin-actions.ts), mirror `removeFromChallengeAction`:

- Zod: `{ targetUserId: z.string().min(1), confirm: z.literal("delete") }` — server also requires confirm string so a buggy client cannot skip typing.
- `requireAdmin()`; call `anonymizeUser` in transaction; `revalidatePath("/admin/students")` and `revalidatePath(\`/admin/students/${id}\`)`.
- Return `{ ok: true }` or `{ ok: false, message }`.

### Step 3 — UI dialog

New client component `DeleteUserAccountDialog`:

- Trigger: `<Button variant="destructive" size="sm">Delete user account</Button>` (red).
- Modal copy: **Are you sure you want to delete this user's account?**
- Input labeled to type `delete`; Confirm **Delete** disabled until value === `"delete"`; explicit **Cancel** closes (do not rely only on `showCloseButton`).
- On success: toast, `router.push("/admin/students")` (list, since detail should 404).
- On failure: toast error; keep modal open.

Mount in `StudentActionPanel` after Remove-from-Challenge, and on the hackathon branch of `[id]/page.tsx` next to `GrantSynergyDialog`.

### Step 4 — Admin reads

- `getStudents`: add `user: { deletedAt: null }` (and nested `user: { is: { deletedAt: null } }` on enrollment/hackathon queries).
- `getStudentDetail`: if `user.deletedAt`, return null → existing `notFound()`.

### Step 5 — Auth gates ([`src/auth.ts`](src/auth.ts) only — not edge `auth.config.ts`)

- Dev + recruiter `authorize`: require `deletedAt: null`.
- `signIn` callback: if `user.id` has `deletedAt`, return `false`.
- Override `session` callback (spread existing from config, then): if `token.id` and user has `deletedAt`, return session without `user` / empty user so RSC pages like dashboard (`if (!session?.user?.id) redirect("/login")`) kick them out. Do **not** put Prisma in `auth.config.ts` / middleware.

### Step 6 — Changelog

Append under `## Pending reconcile`:

`YYYY-MM-DD [rule] Admin soft-delete user account via deletedAt/anonymizedAt scrub (plan 119)`

## 7. Guardrails for Cursor (DO NOT)

- Do NOT `prisma.user.delete` / `deleteMany` on User.
- Do NOT change Restrict FK cascades or add a migration for this feature.
- Do NOT import `@/lib/*` or Prisma into `middleware.ts` / `auth.config.ts`.
- Do NOT allow deleting self or another platform admin.
- Do NOT add new abstraction layers beyond `anonymize-user.ts` + dialog component listed above.
- Do NOT restyle the admin panel beyond the new destructive control.
- Do NOT wire DPDP data-requests “execute erasure” in this plan (status-only flow stays as-is); this is admin-initiated soft-delete only.
- When a build error contradicts this plan, stop and report — do not improvise.

## 8. DB safety

No schema mutation. Soft-delete writes to production data — before first production use, admin should verify on a Neon **child** branch (per project Neon rule). Implementation/dev testing must target a child branch connection string if mutating shared Neon; local/dev DB is fine without a branch.

## 9. Verification

Manual:

1. Open `/admin/students` → student → see red **Delete user account**.
2. Open modal: Cancel closes; Delete disabled until typing `delete`; wrong text stays disabled.
3. Confirm: redirect to list; user gone from list; detail URL 404.
4. Attempt login as that user → fail; talent/hire surfaces still exclude them (`deletedAt: null`).
5. Hackathon-only user: same button works.
6. Try delete self / another admin → error message, no change.

Build: `npx tsc --noEmit` (or project typecheck) and confirm only listed files changed.

## 10. Commit message

`feat(admin): soft-delete student accounts from student detail`
