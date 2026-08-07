# 056 — Show synergy points on admin student detail

## 1. Goal

On `/admin/students/[id]`, display the user’s current synergy points balance in the Progress Stats card, immediately under **Last Submitted Day**.

## 2. Current behavior

- Progress Stats in [`src/app/admin/students/[id]/page.tsx`](src/app/admin/students/[id]/page.tsx) shows days completed, streaks, on-time count, and last submitted day.
- [`getStudentDetail`](src/features/admin/get-student-detail.ts) already loads the full `studentProfile` (including `synergyPoints`) and returns it as `data.profile`.
- Admin can grant synergy via `StudentActionPanel`, but the current balance is never shown.

## 3. Files to touch

- [`src/app/admin/students/[id]/page.tsx`](src/app/admin/students/[id]/page.tsx) **[edit]** — add one Progress Stats row under Last Submitted Day.
- [`docs/plans/056-admin-student-synergy-points.md`](docs/plans/056-admin-student-synergy-points.md) **[new]** — this plan on disk for the executor.

No loader, schema, or action changes.

## 4. Server vs Client

Page remains a Server Component. Render `data.profile.synergyPoints` (number, default `0` on profile). No new client components or props across the boundary.

## 5. Steps

In the Progress Stats `CardContent`, after the Last Submitted Day `<p>`, add:

```tsx
<p>
  <span className="text-muted-foreground">Synergy Points:</span>{" "}
  {data.profile.synergyPoints}
</p>
```

Match the existing label/value styling of the other rows. Do not change grant synergy, tabs, or loaders.

## 6. Guardrails for Cursor (DO NOT)

- Do NOT change `getStudentDetail`, schema, or grant/redeem flows.
- Do NOT add a new component file.
- Do NOT show the SynergyEvent ledger or history in this task.
- Do NOT edit middleware / CLAUDE.md / project-context.

## 7. Verification

1. Open `/admin/students/<userId>` as admin.
2. Progress Stats shows **Synergy Points:** under Last Submitted Day with the student’s balance.
3. Grant synergy → refresh → balance increases by the granted amount.
4. `npm run build` (or at least typecheck) still passes; only the page file should change (plus this plan doc).

## 8. Commit message

```
feat(admin): show synergy points on student detail progress stats
```
