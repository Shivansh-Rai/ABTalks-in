---
name: Untracked link users
overview: "Make each Unrecognized slug row on `/admin/hackathon-links` clickable: hover shows a right chevron, click opens a modal listing that slug’s registrants (Name, Email, Phone, Type, College)."
todos:
  - id: loader-users
    content: Attach users[] to unknownSlugs in get-link-stats
    status: in_progress
  - id: row-modal
    content: Build HackathonUnknownSlugRow with hover chevron + modal
    status: pending
  - id: wire-page
    content: Wire unrecognized section on hackathon-links page
    status: pending
  - id: verify
    content: Lint/typecheck smoke on touched files
    status: pending
isProject: false
---

# 051 — Untracked hackathon link user data

## 1. Goal

On `/admin/hackathon-links`, let admins open registrant details for each **Unrecognized slug** (untracked `?s=` value): hover shows `>`, click opens a scrollable modal with Name, Email, Phone, Type, College., The Untracked link are those links which are not the part of  the current tracked slugs

## 2. Current behavior

- Tracked links already have View via `[HackathonLinkView](src/components/admin/hackathon-link-view.tsx)` with the same columns (Team labeled as Team).
- `[getHackathonLinkStats](src/features/hackathon/get-link-stats.ts)` already builds `usersBySlug` for every `sourceSlug`, including unknown ones, but `unknownSlugs` only returns `{ slug, registrations }` — user arrays are dropped.
- Unrecognized section is a plain table in `[hackathon-links/page.tsx](src/app/admin/hackathon-links/page.tsx)` (no click / hover affordance).  


**Default (locked):** Scope is **Unrecognized slug rows only** (not the “Direct / untracked” summary tile). Direct (`sourceSlug = null`) stays as-is. Column header **Type** shows `solo` / `team` (same data as tracked View’s Team column).

## 3. Files to touch

- `[docs/plans/051-untracked-hackathon-link-users.md](docs/plans/051-untracked-hackathon-link-users.md)` **[new]** — this plan on implement
- `[src/features/hackathon/get-link-stats.ts](src/features/hackathon/get-link-stats.ts)` **[edit]** — attach `users` to each `unknownSlugs` entry
- `[src/components/admin/hackathon-unknown-slug-row.tsx](src/components/admin/hackathon-unknown-slug-row.tsx)` **[new]** — client row: hover `>`, click opens modal
- `[src/app/admin/hackathon-links/page.tsx](src/app/admin/hackathon-links/page.tsx)` **[edit]** — render unknown rows via the new component

Reuse modal table markup from `HackathonLinkView` (same Dialog + table pattern). Do **not** force-refactor tracked View unless a tiny shared type export is needed.

## 4. Server vs Client

- Page remains Server Component; passes plain DTOs into the client row.
- `hackathon-unknown-slug-row.tsx` — `"use client"` (hover/open state).
- Props: `{ slug, registrations, users: { id, fullName, email, phone, team, college }[] }` only.

## 5. Steps

### Step 1 — Extend loader

In `get-link-stats.ts`, change:

```ts
unknownSlugs: { slug: string; registrations: number; users: ...[] }[];
```

When mapping unknown entries:

```ts
.map(([slug, registrations]) => ({
  slug,
  registrations,
  users: usersBySlug.get(slug) ?? [],
}))
```

No extra DB query — users are already collected in the existing loop.

### Step 2 — `HackathonUnknownSlugRow` client component

- Table row with `group` class.
- Cells: slug, registrations count, trailing cell with `ChevronRight` that is `opacity-0 group-hover:opacity-100`.
- Entire row `role="button"` / `onClick` / keyboard Enter-Space opens Dialog (cursor-pointer, hover bg muted).
- Dialog: title `Unrecognized · {slug}`, scrollable table columns **Name | Email | Phone | Type | College**; empty state “No users have joined using this link”; close via existing Dialog X.
- Type cell: `capitalize` on `user.team` (`solo` / `team`).
- Modal width: `sm:max-w-5xl` (match tracked View).

### Step 3 — Wire page

Replace plain unknown `TableRow`s with:

```tsx
<HackathonUnknownSlugRow
  key={row.slug}
  slug={row.slug}
  registrations={row.registrations}
  users={row.users}
/>
```

Keep section heading/copy unchanged.

## 6. Guardrails for Cursor (DO NOT)

- Do NOT change Direct / untracked summary tile behavior in this task.
- Do NOT create `HackathonLink` rows from unrecognized slugs here.
- Do NOT add schema/migration.
- Do NOT edit middleware / CLAUDE.md / project-context.
- Do NOT break tracked-link View / Copy / Edit / Delete.

## 7. Verification

Manual:

1. Open `/admin/hackathon-links` with at least one unrecognized slug.
2. Hover row → `>` appears on the right.
3. Click row → modal lists that slug’s users with Name, Email, Phone, Type, College.
4. Tracked link View still works.

Automated: lint clean on touched files; `npx tsc --noEmit` if practical (ignore pre-existing `.next` noise).

## 8. Commit message

`feat(admin): show registrant details for unrecognized hackathon slugs`