# 171 — Admin global search typeahead

## 1. Goal

Give `/admin/search` live suggestions as an admin types, so the common case
("find this one candidate") resolves without a full page submit. The submit path,
the shareable `?q=` URL and the existing grouped result page all stay exactly as
they are.

## 2. Current behavior

`/admin/search` ([src/app/admin/search/page.tsx](../../src/app/admin/search/page.tsx))
is a Server Component. It renders a plain `<form action="/admin/search">` with a
single `name="q"` input and a submit button. On submit, Next re-renders the page
with `searchParams.q`, which is passed to
`searchAdminConsole` ([src/features/admin/search-admin-console.ts](../../src/features/admin/search-admin-console.ts)).
That runs four parallel `findMany` calls (candidates, recruiters, jobs,
assessments), `take: 8` each, every predicate a case-insensitive `contains`.
Nothing happens while typing. A gate rejects terms under 2 characters.

The repo already contains this exact feature in another place:
`CollegeCombobox` ([src/components/shared/college-combobox.tsx](../../src/components/shared/college-combobox.tsx))
plus `/api/colleges/search`. That pair establishes every mechanic we need —
Base UI `Autocomplete` with `mode="none"` and `filter={null}` (server filters,
not the client), a 250 ms debounce, an `AbortController` per keystroke, a
`queryRef` stale-response guard, and a GET Route Handler chosen deliberately
over a Server Action because the Next client router serializes Server Action
calls, which is fatal on a per-keystroke path.

### Index reality (checked against the migration, not assumed)

`pg_trgm` is installed and there are GIN trigram indexes on
`CandidateProfile.fullName`, `CandidateProfile.headline`,
`CandidateEducation.institutionName`, `Organization.name` and
`College.searchText`
([migration.sql:1433-1453](../../prisma/migrations/20260820120000_platform_data_architecture_phase1/migration.sql)).

There are **none** on the other columns this search reads: `User.email`,
`User.name`, `Job.title`, `Job.company`, `RecruiterProfile.fullName`,
`RecruiterProfile.company`, `RecruiterAssessment.title`. Those are
leading-wildcard `ILIKE`, so they sequentially scan. At current volume
(~13k users, far fewer jobs/recruiters/assessments) a seq scan with a text
predicate is single-digit milliseconds, and the audience is a handful of
platform admins — so this ships without new indexes. See §10 for the index
work, which is deliberately **not** in this plan because it touches other
owners' models.

## 3. Files to touch

| File | Mode | Note |
| --- | --- | --- |
| `src/features/admin/search-admin-console.ts` | `[edit]` | Add `suggestAdminConsole()` beside the existing full search. Lighter payload, 5 rows per group, 3-char gate, no résumé lookup, no extra repo round trip. |
| `src/app/api/admin/search/suggest/route.ts` | `[new]` | GET Route Handler. `getAdminContext()` + Zod + result envelope + `private, no-store`. |
| `src/components/admin/admin-search-box.tsx` | `[new]` | Client component. Base UI `Autocomplete`, debounce + abort + stale guard, grouped popup, navigates on select. |
| `src/app/admin/search/page.tsx` | `[edit]` | Swap the bare `<input>` for `<AdminSearchBox defaultValue={q} />`. Nothing else on the page changes. |

No other file changes. No schema change, no migration, no new dependency
(`@base-ui/react@^1.4.1` is already installed and already exports
`Autocomplete.Group` / `GroupLabel` / `Collection`).

## 4. Server vs Client

- `src/app/admin/search/page.tsx` — **Server**. Stays server. Still calls
  `requireAdmin()` and `searchAdminConsole()`.
- `src/components/admin/admin-search-box.tsx` — **Client** (`"use client"`).
- `src/app/api/admin/search/suggest/route.ts` — **Server** (Route Handler,
  Node runtime).
- `src/features/admin/search-admin-console.ts` — **Server**.

**Server → Client boundary:** the page passes `AdminSearchBox` exactly one prop,
`defaultValue: string`. No functions, no icons, no class instances, no Prisma
rows cross the boundary. Suggestion data reaches the client over `fetch`, as
plain JSON, never as a prop.

## 5. Steps

### Step 1 — `src/features/admin/search-admin-console.ts` `[edit]`

Append a new exported function; do not alter `searchAdminConsole`.

```ts
export type AdminSuggestItem = {
  id: string;
  href: string;
  title: string;
  meta: string;
};

export type AdminSuggestGroup = {
  value: string;              // group heading, e.g. "Candidates"
  items: AdminSuggestItem[];  // Base UI `Group` requires exactly this key
};

const SUGGEST_MIN = 3;
const SUGGEST_TAKE = 5;

export async function suggestAdminConsole(q: string): Promise<AdminSuggestGroup[]>
```

Rules for the body:

- Return `[]` when `q.trim().length < SUGGEST_MIN`. Three, not two: a trigram
  index cannot serve a pattern with fewer than three non-wildcard characters, so
  a 2-char gate would guarantee the slowest possible query on the hottest path.
  The submit path keeps its 2-char gate — that one runs once, not per keystroke.
- Four `Promise.all` queries mirroring `searchAdminConsole`'s predicates
  exactly, with `take: SUGGEST_TAKE`. Same `deletedAt: null` and
  `recruiterProfile: { is: null }` guards on the candidate query — a suggestion
  list must not surface a row the result page would hide.
- `select` every query (project rule). Select **only** what the dropdown row
  renders.
- **Do not** call `listCandidateProfiles`. It reads `CandidateProfile` by
  `userId`, which the candidate query already joins, so on this path it is a
  second round trip for data we hold. Read `candidateProfile.fullName` from the
  join, with the same `?? name ?? email` fallback chain the page uses.
- **Never** select `resume.blobPathname`. The suggest payload carries no private
  blob path and no résumé affordance at all; the résumé link stays on the
  submitted result page, where it is already audited.
- Build `href` server-side, identical to the page's links:
  candidates `/admin/students/${id}`, jobs `/admin/jobs/${id}`,
  recruiters `/admin/recruiters`, assessments `/admin/assessments`.
- Drop empty groups before returning, so the popup shows no bare heading.

### Step 2 — `src/app/api/admin/search/suggest/route.ts` `[new]`

Model it on
[`/api/admin/candidates/[userId]/resume/route.ts`](../../src/app/api/admin/candidates/[userId]/resume/route.ts)
for auth and on `/api/colleges/search` for shape.

```ts
export const runtime = "nodejs";

const querySchema = z.string().max(100).trim();

export async function GET(request: Request): Promise<NextResponse> {
  const admin = await getAdminContext();
  if (!admin) return 403 envelope;
  const parsed = querySchema.safeParse(new URL(request.url).searchParams.get("q") ?? "");
  if (!parsed.success) return 400 envelope;
  const data = await suggestAdminConsole(parsed.data);
  return NextResponse.json({ ok: true, data }, { headers: { "Cache-Control": "private, no-store" } });
}
```

- `getAdminContext()` and **not** `requireAdmin()`. `requireAdmin` calls
  `redirect()`, which would answer a `fetch` with an HTML login page and a 200.
  The resume route carries this same comment; keep one here too.
- No `assertRateLimit`. The limiter in `src/lib/rate-limit.ts` is
  DB-backed, so putting it on a typeahead would add a database **write** per
  keystroke — strictly more expensive than the read it would be protecting. The
  controls on this path are: admin-only auth, the 3-char gate, the 250 ms
  debounce, and the abort-on-keystroke. Write that reasoning into the file
  header so nobody "fixes" it later.
- `private, no-store`, never `public`. These rows are people.

### Step 3 — `src/components/admin/admin-search-box.tsx` `[new]`

`"use client"`. Port the mechanics from `CollegeCombobox` — do not invent new
ones:

- `useState` for the input value, seeded from `defaultValue`.
- `useEffect` on value: bail under 3 chars, `window.setTimeout(..., 250)`,
  abort the in-flight controller, `fetch` with the new controller's signal,
  `cache: "no-store"`.
- Keep `queryRef` and the `isSearchEnvelope` type guard, and swallow only
  `AbortError`. Copy both guards; a typeahead without the stale-response check
  shows answers to a question the user has already stopped asking.
- `Autocomplete.Root` with `mode="none"`, `filter={null}`,
  `items={groups}`. The server already filtered; letting Base UI filter again
  would hide correct rows.
- Grouped rendering, which v1.4.1 supports —
  `Group = { items: Item[], [key: string]: unknown }` per
  `internals/resolveValueLabel.d.ts`:

```tsx
<Autocomplete.List>
  {(group: AdminSuggestGroup) => (
    <Autocomplete.Group key={group.value} items={group.items}>
      <Autocomplete.GroupLabel>{group.value}</Autocomplete.GroupLabel>
      <Autocomplete.Collection>
        {(item: AdminSuggestItem) => (
          <Autocomplete.Item key={item.id} value={item}>…</Autocomplete.Item>
        )}
      </Autocomplete.Collection>
    </Autocomplete.Group>
  )}
</Autocomplete.List>
```

- **Selecting navigates.** Track the highlighted item in a ref and, in
  `onValueChange`, when `details.reason === "item-press"`, call
  `router.push(item.href)` — the same `highlightedRef` trick `CollegeCombobox`
  uses, because `onValueChange` hands back a string, not the item.
- `name="q"` on `Autocomplete.Input`, inside the unchanged `<form>`, so Enter
  with nothing highlighted still performs the ordinary GET submit and the Search
  button still works. **This is the one behavior with no precedent in the
  college case** (that combobox fills a field; this one drives a form). Verify
  it in the browser and, only if Base UI swallows the key, add an explicit
  `onKeyDown` that submits the form when no item is highlighted.
- Reuse the page's current input classes verbatim
  (`h-12 min-w-[16rem] flex-1 rounded-lg border border-[#D2D2D2] bg-white px-4
  text-base`) so the control looks identical when the popup is closed. Reuse the
  popup classes from `CollegeCombobox`.
- Keep the password-manager suppressors (`autoComplete="nope"`,
  `data-1p-ignore`) — an admin console search field attracts them.

### Step 4 — `src/app/admin/search/page.tsx` `[edit]`

Replace the `<input>` element with `<AdminSearchBox defaultValue={q} />`.
Leave the `<form action="/admin/search">`, the submit button, the two gate
messages and all four `ResultList`s untouched.

## 6. Guardrails for Cursor (DO NOT)

- **DO NOT** add `requireRole` / `requireAdmin` to the Route Handler — use
  `getAdminContext()`. And do not touch login, logout or the Auth.js handler;
  they are public and out of scope.
- **DO NOT** import anything from `@/lib/*` into `middleware.ts` or
  `auth.config.ts`, and do not add this route to the middleware matcher. The new
  route authorizes itself. The edge bundle stays clean.
- **DO NOT** create a shared "search primitives" module, a `useDebounce` hook,
  or a generic `<Typeahead>`. Three files, exactly the three listed in §3.
  Duplicating 20 lines of debounce from `CollegeCombobox` is the correct call
  here.
- **DO NOT** convert `src/app/admin/search/page.tsx` to a Client Component. Only
  the input is client.
- **DO NOT** modify `CollegeCombobox` or `/api/colleges/search` to "share" code
  with this. They are a working surface in someone else's flow.
- **DO NOT** change `searchAdminConsole`'s signature, its 2-char gate, its
  `take: 8`, or its résumé fields. The submitted result page must behave
  identically after this change.
- **DO NOT** add a Prisma migration or edit `prisma/schema.prisma`. The index
  work is §10 and needs other owners' sign-off.
- **DO NOT** put `assertRateLimit` on the suggest route (§5 step 2 says why).
- **DO NOT** return résumé fields, blob pathnames, phone numbers or any column
  the result page does not already display.
- **DO NOT** use `<Button asChild>` or `<Button render={<Link>}>`; this plan
  adds no buttons, so if you find yourself adding one, stop.
- **DO NOT** use `console.*`; use `lib/logger.ts`. No `any` — the envelope type
  guard exists precisely so the `unknown` from `res.json()` is narrowed.
- If the build contradicts any assumption in this plan (especially the Base UI
  grouped-items shape or the Enter-to-submit behavior), **trust the build**,
  gather the actual type/error, and report it — do not defend the plan.

## 7. DB safety

Not applicable. No schema change, no migration, no seed, no data write. The
feature is read-only and adds no column, table or index.

## 8. Verification

1. `npx tsc --noEmit` clean.
2. `npm run build` clean.
3. `npm run lint` on the changed files.
4. Auth boundary, against `npm run dev`, signed out:
   `curl -s -o /dev/null -w '%{http_code}' 'http://localhost:3000/api/admin/search/suggest?q=rah'`
   must be **403**, and the body must be the JSON envelope — not an HTML
   redirect. This is the single most important check in the list: it is the
   assertion that a new public-facing JSON endpoint did not just expose the
   candidate table.
5. `?q=ra` (2 chars) → `{ ok: true, data: [] }`, not a database hit.
6. `?q=` + 200 characters → **400** from the Zod `max(100)`.
7. Browser, as an admin: type into the box, confirm the popup groups by type,
   confirm clicking a row navigates, confirm Enter with nothing highlighted
   still submits to `?q=`, confirm the Search button still works, confirm the
   closed control is visually unchanged.
8. Exactly four files changed: the two new ones in §3 and the two edited ones.
   `git status` must show nothing else.

**Known verification limit:** step 7 needs an admin session. `User.password` is
NULL for every row on both live hosts, so credentials login is not available
from this machine. If no session can be obtained, say so plainly in the report
rather than implying step 7 passed.

## 9. Commit message

```
feat(admin): typeahead suggestions on global search

Adds a debounced, admin-only suggest endpoint and a Base UI Autocomplete
input to /admin/search. Results group by candidate / recruiter / job /
assessment and navigate on select; the existing form submit, ?q= URL and
result page are unchanged.

The suggest path gates at 3 characters (a trigram index cannot serve a
shorter pattern) and carries no resume fields. No rate limiter: the
limiter is DB-backed and would add a write per keystroke.
```

## 10. Follow-up, blocked on other owners — trigram indexes

Not in this plan. Recorded so the §2 finding is not lost.

Seven columns this search reads are leading-wildcard `ILIKE` with no trigram
support. Adding GIN indexes would make them index-served:

```sql
-- pg_trgm is already installed (plan 078 §10.3)
CREATE INDEX CONCURRENTLY user_email_trgm ON "User" USING gin (email gin_trgm_ops);
CREATE INDEX CONCURRENTLY user_name_trgm ON "User" USING gin (name gin_trgm_ops);
CREATE INDEX CONCURRENTLY job_title_trgm ON "Job" USING gin (title gin_trgm_ops);
CREATE INDEX CONCURRENTLY job_company_trgm ON "Job" USING gin (company gin_trgm_ops);
CREATE INDEX CONCURRENTLY recruiter_profile_fullname_trgm ON "RecruiterProfile" USING gin ("fullName" gin_trgm_ops);
CREATE INDEX CONCURRENTLY recruiter_profile_company_trgm ON "RecruiterProfile" USING gin (company gin_trgm_ops);
CREATE INDEX CONCURRENTLY recruiter_assessment_title_trgm ON "RecruiterAssessment" USING gin (title gin_trgm_ops);
```

**CROSS-MODULE CHANGE REQUIRED**

- **Owner / Module:** Manuvrtti — Jobs (`Job`); Zainab — Recruiter
  (`RecruiterProfile`); Shashank — recruiter-side assessments
  (`RecruiterAssessment`). `User` is shared architecture (Sohail).
- **Why:** those columns seq-scan on every suggest request.
- **Proposed change:** index-only. No column added, dropped or retyped; no
  application code reads differently; `CONCURRENTLY` means no write lock.
- **Status:** not required to ship §1–§9 — at ~13k users, admin-only, the scans
  are milliseconds. Raise it when volume grows or when this search is reused on
  a non-admin surface.

**Evidence gap to close first:** the claim "milliseconds" is reasoned from row
counts, not measured. An `EXPLAIN ANALYZE` of the four predicates against a live
host was attempted and blocked by the auto-mode classifier. Run it before
spending the owners' review time on the migration.
