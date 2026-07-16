---
name: Admin student remarks
overview: Add an admin-only Remarks tab on `/admin/students/[id]` with a new `AdminRemark` model and full CRUD (add / edit / delete), showing a scrollable history dated DD/MM/YYYY in IST.
todos:
  - id: schema
    content: Add AdminRemark model + User relations; run prisma migrate
    status: in_progress
  - id: loader-actions
    content: Load remarks in getStudentDetail; add create/update/delete server actions
    status: pending
  - id: ui-tab
    content: Build StudentRemarksPanel and wire Remarks tab on student detail page
    status: pending
  - id: verify
    content: Changelog line, typecheck/build, manual CRUD smoke test
    status: pending
isProject: false
---

# 024 — Admin student remarks tab

## 1. Goal
Give admins a private Remarks tab on the student detail page to add, edit, and delete free-form notes about a student, with a scrollable dated history (DD/MM/YYYY, IST).

## 2. Current behavior
- Student detail lives at [`src/app/admin/students/[id]/page.tsx`](src/app/admin/students/[id]/page.tsx). Tabs are client-side only (`Submissions`, `Quiz Attempts`, `Admin Actions`, `Recruiter Profile`) — no URL tab routing.
- Data is loaded by [`src/features/admin/get-student-detail.ts`](src/features/admin/get-student-detail.ts).
- Admin mutations use `requireAdmin` + Zod + `{ ok }` envelope in [`src/app/actions/admin-actions.ts`](src/app/actions/admin-actions.ts), then `revalidatePath(`/admin/students/${id}`)`.
- There is no student remarks model. Closest fields (`AdminAction.reason`, `RecruiterReview.adminNote`) are for audit / recruiter notes, not a general remark history.
- `formatDateIST` uses `d MMM yyyy` — remarks need a separate `dd/MM/yyyy` display (inline `formatInTimeZone`, no new date-utils helper).

**Defaults (locked):** Any admin may edit/delete any remark. Hard delete (no soft-delete). Remarks are admin-only (already gated by `/admin` layout + `requireAdmin` on actions). Show author name + date on each row.

## 3. Files to touch
- [`prisma/schema.prisma`](prisma/schema.prisma) **[edit]** — add `AdminRemark` + User relations
- Prisma migration **[new]** — create `AdminRemark` table (via `npx prisma migrate dev`)
- [`src/features/admin/get-student-detail.ts`](src/features/admin/get-student-detail.ts) **[edit]** — load remarks for the student
- [`src/app/actions/admin-remark-actions.ts`](src/app/actions/admin-remark-actions.ts) **[new]** — create / update / delete actions
- [`src/components/admin/student-remarks-panel.tsx`](src/components/admin/student-remarks-panel.tsx) **[new]** — client UI for CRUD + scrollable list
- [`src/app/admin/students/[id]/page.tsx`](src/app/admin/students/[id]/page.tsx) **[edit]** — add Remarks tab after Recruiter Profile
- [`docs/CHANGELOG.md`](docs/CHANGELOG.md) **[edit]** — one pending-reconcile line for schema

Also write this plan to [`docs/plans/024-admin-student-remarks.md`](docs/plans/024-admin-student-remarks.md) when implementing starts (project convention).

## 4. Server vs Client
- `[id]/page.tsx` — Server Component; passes plain remark DTOs into the client panel.
- `student-remarks-panel.tsx` — `"use client"` (form state, edit mode, transitions, toasts).
- Props across boundary: only serializable data (`studentId`, `studentName`, `remarks: { id, body, createdAt ISO string, updatedAt ISO string, adminName }[]`). No functions/icons/class instances.

## 5. Steps

### Step 1 — Schema
Add to `prisma/schema.prisma`:

```prisma
model AdminRemark {
  id            String   @id @default(cuid())
  studentUserId String
  adminUserId   String
  body          String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  student       User     @relation("RemarkStudent", fields: [studentUserId], references: [id], onDelete: Cascade)
  admin         User     @relation("RemarkAdmin", fields: [adminUserId], references: [id], onDelete: Cascade)

  @@index([studentUserId, createdAt(sort: Desc)])
}
```

On `User`, add:
- `remarksReceived AdminRemark[] @relation("RemarkStudent")`
- `remarksAuthored AdminRemark[] @relation("RemarkAdmin")`

Run `npx prisma migrate dev` with a name like `add_admin_remark`, then `npx prisma generate`.

### Step 2 — Load remarks in `getStudentDetail`
In the existing `Promise.all`, add:

```ts
prisma.adminRemark.findMany({
  where: { studentUserId: userId },
  orderBy: { createdAt: "desc" },
  select: {
    id: true,
    body: true,
    createdAt: true,
    updatedAt: true,
    admin: {
      select: {
        email: true,
        studentProfile: { select: { fullName: true } },
      },
    },
  },
}),
```

Map into return value:

```ts
remarks: remarks.map((r) => ({
  id: r.id,
  body: r.body,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  adminName: r.admin.studentProfile?.fullName?.trim() || r.admin.email || "Admin",
})),
```

### Step 3 — Server actions (`admin-remark-actions.ts`)
Pattern mirrors `admin-actions.ts`:

- `createAdminRemarkAction({ studentUserId, body })`
- `updateAdminRemarkAction({ remarkId, body })`
- `deleteAdminRemarkAction({ remarkId })`

Each action:
1. `await requireAdmin()`
2. Zod `safeParse` — `body: z.string().trim().min(1).max(2000)`; ids `z.string().min(1)`
3. Verify student exists (`studentProfile` present) on create; on update/delete verify remark exists
4. Write with Prisma (`create` / `update` / `delete`) — store `adminUserId` from `requireAdmin()` on create only (do not change author on edit)
5. `revalidatePath(`/admin/students/${studentUserId}`)`
6. Return `{ ok: true }` or `{ ok: false, message }`

Do **not** write `AdminAction` audit rows for remark CRUD (remarks are themselves the history).

### Step 4 — UI component `StudentRemarksPanel`
Client component props: `studentId`, `studentName`, `remarks` (from server).

Layout:
1. **Add form** at top: `Textarea` + “Add remark” button → `createAdminRemarkAction` → toast + `router.refresh()`.
2. **Scrollable history** below: container `max-h-[28rem] overflow-y-auto space-y-2` (or similar). Newest first (already ordered desc).
3. Each remark card:
   - Body text (whitespace-pre-wrap)
   - Meta line: `adminName · DD/MM/YYYY` using `formatInTimeZone(new Date(createdAt), "Asia/Kolkata", "dd/MM/yyyy")`
   - If `updatedAt` differs from `createdAt` by >1s, append `(edited)` — optional small cue, keep minimal
   - **Edit** → inline textarea replace + Save/Cancel calling `updateAdminRemarkAction`
   - **Delete** → confirm via existing dialog pattern (or `window.confirm` only if no AlertDialog used nearby; prefer AlertDialog if already used in admin student actions) → `deleteAdminRemarkAction`

Empty state: “No remarks yet”.

### Step 5 — Wire tab on detail page
In [`src/app/admin/students/[id]/page.tsx`](src/app/admin/students/[id]/page.tsx), after Recruiter Profile trigger:

```tsx
<TabsTrigger value="remarks">Remarks</TabsTrigger>
```

And content:

```tsx
<TabsContent value="remarks">
  <StudentRemarksPanel
    studentId={data.student.userId}
    studentName={data.student.fullName}
    remarks={data.remarks}
  />
</TabsContent>
```

### Step 6 — Changelog
Under `## Pending reconcile` in [`docs/CHANGELOG.md`](docs/CHANGELOG.md), append exactly one line:

`2026-07-16 [schema] AdminRemark model for admin-only student remark history on student detail`

## 6. Guardrails for Cursor (DO NOT)
- Do NOT put remarks on public student pages or recruiter share pages.
- Do NOT reuse `AdminAction` or `RecruiterReview.adminNote` for this feature.
- Do NOT import `@/lib/*` into `middleware.ts`.
- Do NOT add URL `?tab=` routing.
- Do NOT add soft-delete / `deletedAt`.
- Do NOT create extra abstraction files beyond those listed.
- Do NOT modify `src/components/ui/*`.
- Do NOT edit `CLAUDE.md` or `docs/project-context.md`.
- If migrate/build fails, stop and report the exact error — no improvised workarounds.

## 7. DB safety
- Commit / Neon snapshot before migrate if working against shared Neon (note current commit hash).
- Run: `npx prisma migrate dev --name add_admin_remark` then `npx prisma generate`.
- No seed changes required (empty remarks table is fine).

## 8. Verification
Manual:
1. Open `/admin/students/[id]` as admin → see **Remarks** tab after Recruiter Profile.
2. Add a remark → appears at top with today’s date as `DD/MM/YYYY`.
3. Add several remarks → list scrolls inside the panel.
4. Edit a remark → body updates; date stays the original created date.
5. Delete a remark → removed after confirm.
6. Non-admin cannot reach `/admin/*` (existing layout gate).

Automated: `npx tsc --noEmit` (or project typecheck) and `npm run build` must pass.

Files that should have changed: schema + migration, `get-student-detail.ts`, `admin-remark-actions.ts`, `student-remarks-panel.tsx`, `[id]/page.tsx`, `docs/CHANGELOG.md`, and `docs/plans/024-admin-student-remarks.md`.

## 9. Commit message
`feat(admin): add student remarks tab with CRUD history`
