# 045 — Hackathon link attribution (trackable share links)

> **Revised** after the Supabase → Neon/Prisma cutover (`724bbcf`). The original
> draft targeted `hackathon_*` Supabase tables and a standalone
> `/admin/hackathon-links` route; both are obsolete. This version uses Prisma
> and folds the report into the existing `/admin/hackathon` page.

## 1. Goal

Let the organizer share ~50 distinct hackathon links (one per placement officer,
friend, WhatsApp group, poster) and see how many registrations each produced —
with **zero** user-facing referral code. The student clicks a normal-looking
link and registers; attribution is invisible to them.

The same mechanism also measures **in-app promo surfaces** — today that is the
hackathon popup on the student dashboard — so the report answers both "which
outreach link worked" and "how many registrations the dashboard popup drove."
Those two are reported as separate groups; see §3.

Hackathon funnel only. The 60-day `?ref=` referral system is untouched.

## 2. Current behavior

- **Hackathon data is now Prisma/Neon.** `HackathonTeam`,
  `HackathonParticipant`, `HackathonEvent` in `prisma/schema.prisma:802-838`.
  `HackathonParticipant.userId` is `@unique`, so one registration per user is
  enforced at the DB level — **counts need no dedup logic.**
- `src/lib/hackathon-supabase.ts` still exists but **nothing imports it**. It is
  dead code from the cutover. Out of scope here; do not extend it, do not delete
  it as part of this change.
- Registration is `submitHackathonRegistrationAction`
  (`src/app/actions/hackathon-actions.ts`). Two write sites:
  - SOLO / TEAM_CREATE — `prisma.$transaction` wrapping
    `tx.hackathonTeam.create()` + `tx.hackathonParticipant.create()`, retried up
    to 5× on a `teamCode` unique collision.
  - TEAM_JOIN — `insertJoin()`, a bare `hackathonParticipant.create()`.
- `/hackathon/register` is in `protectedPaths` (`middleware.ts:29`), so a cold
  click bounces to `/login?from=/hackathon/register`, possibly through an
  off-site Google OAuth round trip, before reaching the form. **Query params do
  not survive that; cookies do.** This is the entire reason the design below
  uses a cookie.
- `middleware.ts` already implements this exact pattern for the 60-day system:
  `applyRefCookie()` (`middleware.ts:35`) validates `?ref=` and writes the
  httpOnly `abtalks_ref` cookie on all three response paths. Unchanged by the
  cutover.
- **The dashboard promo popup already exists** —
  `src/components/dashboard/hackathon-promo-modal.tsx` (PR #81, merged
  `6a19ea9`). A `"use client"` modal, shown once per browser via a `localStorage`
  seen-key, whose CTA is `<Link href="/hackathon">` at line 151. It is rendered
  **twice** in `src/app/dashboard/page.tsx` — line 292 (the `isPreStart` branch)
  and line 352 (the active-dashboard branch) — ungated by domain, so every
  enrolled 60-day student sees it. Its audience is therefore existing logged-in
  students, not new reach.
- **It is the only in-app link into the funnel.** A sweep of `"/hackathon` across
  `src/components` and `src/app` finds just that one. The other hits are either
  on-site CTAs already inside the funnel (`hackathon/hero.tsx:99`,
  `hackathon/final-cta.tsx:17`), static asset paths, or pathname comparisons in
  `main-shell.tsx` / `bottom-nav.tsx` / `app-footer.tsx`. None of those are entry
  points.
- **`/admin/hackathon` already exists** — `src/app/admin/hackathon/page.tsx` →
  `getAdminData()` (`src/features/hackathon/get-admin-data.ts`) →
  `HackathonView` (`src/components/admin/hackathon-view.tsx`, a Client
  Component). It renders 5 `Stat` tiles, an expandable Teams table, a CSV
  export, and the problem-statement editor. It is already in the admin nav.

## 3. Decisions locked (do not revisit)

| Decision | Choice |
|---|---|
| Metric | Registrations only. **No click tracking, no clicks table.** |
| Link format | `https://abtalks.in/hackathon?s=<slug>`. **No `/h/:slug` route, no rewrites.** |
| Attribution | **First touch wins** — cookie written once, never overwritten while it lives. |
| Cookie name | `abtalks_src` — deliberately NOT `abtalks_ref`. |
| Param name | `s` — deliberately NOT `ref`. |
| Admin surface | **Extend `/admin/hackathon`.** No new route, no nav changes. |
| Source kinds | `EXTERNAL` (shared links) and `INTERNAL` (in-app promos), reported as **separate groups with separate denominators**. |

Reusing `ref`/`abtalks_ref` would cross-contaminate the 60-day referral report
and the hackathon report in both directions. Keep them fully separate.

**Why `EXTERNAL` and `INTERNAL` are not pooled.** The dashboard popup fires at a
captive audience of already-enrolled students; a placement officer link reaches
people who have never heard of ABTalks. Ranking them in one list by raw count
puts the popup on top permanently and says nothing about which outreach worked.
Splitting them keeps "did my promo convert existing users" and "which channel
brought new people" as the separate questions they are. One enum column buys
that.

## 4. Files to touch

| Path | Change | Note |
|---|---|---|
| `prisma/schema.prisma` | `[edit]` | Add `HackathonLink` model; add `sourceSlug String?` to `HackathonParticipant`. |
| `prisma/migrations/<ts>_add_hackathon_link_attribution/` | `[new]` | Generated by `prisma migrate dev` — do not hand-write. |
| `middleware.ts` | `[edit]` | Read `?s=`, set first-touch `abtalks_src` cookie. **Edge-safe — no new imports.** |
| `src/lib/validations/hackathon.ts` | `[edit]` | Add `sourceSlugSchema`. |
| `src/app/actions/hackathon-actions.ts` | `[edit]` | Read cookie, write `sourceSlug` on both create sites, clear cookie on success. |
| `src/features/hackathon/get-admin-data.ts` | `[edit]` | Add link tally to the returned payload. |
| `src/components/admin/hackathon-view.tsx` | `[edit]` | New "Where registrations came from" section; source chip on member rows; `sourceSlug` in CSV. |
| `src/components/dashboard/hackathon-promo-modal.tsx` | `[edit]` | **One-line change**: CTA href gains `?s=dashboard-popup`. |

Eight files, one of them generated. **No new source files.** No admin nav edits
— `/admin/hackathon` is already in `src/app/admin/layout.tsx`.

## 5. Server vs Client

| Component | Type | Notes |
|---|---|---|
| `middleware.ts` | Edge runtime | Only `next-auth` + `next/server`. **No `@/lib/*` imports** — the 1 MB Edge bundle limit. The slug regex is inlined here, duplicated from the Zod schema on purpose. Do not "DRY" it by importing. |
| `get-admin-data.ts` | Server (`import "server-only"`) | Already returns a plain serializable object. Keep it that way. |
| `src/app/admin/hackathon/page.tsx` | **Server** | Unchanged. |
| `hackathon-view.tsx` | **Client** (`"use client"`) | Already receives `data` as a plain prop. The new fields are strings/numbers/booleans only — **no Date objects, no functions, no icon components across the boundary** (`createdAt` is already stringified upstream; match that). |

The copy-link button lives **inside** `hackathon-view.tsx` — it is already a
Client Component, so no new file is needed. Build the URL with
`window.location.origin` inside the click handler; do **not** plumb `headers()`
down from the server.

## 6. Steps

### Step 1 — `prisma/schema.prisma` `[edit]`

Add `sourceSlug` to `HackathonParticipant` (nullable — every existing row reads
as "direct"):

```prisma
model HackathonParticipant {
  // ...existing fields unchanged...
  graduationYear Int
  sourceSlug     String?
  createdAt      DateTime @default(now())
  // ...existing relations and attributes unchanged...
}
```

Add the new model near the other hackathon models:

```prisma
enum HackathonLinkKind {
  EXTERNAL
  INTERNAL
}

/// Named traffic sources for hackathon attribution. EXTERNAL = a link shared
/// off-platform; INTERNAL = an in-app promo surface (e.g. the dashboard popup).
/// Rows are inserted by hand; there is no admin CRUD. Intentionally NOT a
/// relation to HackathonParticipant.sourceSlug — see plan 045 §6 step 1.
model HackathonLink {
  id        String            @id @default(cuid())
  slug      String            @unique
  label     String
  note      String?
  kind      HackathonLinkKind @default(EXTERNAL)
  createdAt DateTime          @default(now())
}
```

`@default(EXTERNAL)` means the ~50 shared links need no `kind` in their insert;
only in-app surfaces set it explicitly.

**`sourceSlug` is a loose string, not a foreign key.** This is deliberate: a
mistyped or not-yet-created slug must still record on the participant row and
surface in the "Unrecognized" bucket. An FK would make that insert *fail*,
turning a typo in a shared link into a failed registration. Do not add a
relation, and do not add `onDelete` behavior.

No index on `sourceSlug` — nothing ever filters by it (the tally in Step 4 runs
in JS over rows already fetched), so an index would be pure write overhead.

### Step 2 — `middleware.ts` `[edit]`

**Edge-safe file. Add no imports.** Alongside the existing `REF_COOKIE_*`
constants:

```ts
const SRC_COOKIE_NAME = "abtalks_src";
const SRC_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days
```

Add next to `applyRefCookie` (leave `applyRefCookie` itself untouched):

```ts
function applySourceCookie(
  response: NextResponse,
  src: string | null,
  alreadyAttributed: boolean,
) {
  // First touch wins: never overwrite an existing attribution.
  if (alreadyAttributed) return response;
  if (!src || src.length > 32 || !/^[a-zA-Z0-9_-]+$/.test(src)) {
    return response;
  }

  response.cookies.set(SRC_COOKIE_NAME, src.toLowerCase(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SRC_COOKIE_MAX_AGE,
    path: "/",
  });

  return response;
}

function withTracking(
  response: NextResponse,
  ref: string | null,
  src: string | null,
  alreadyAttributed: boolean,
) {
  return applySourceCookie(applyRefCookie(response, ref), src, alreadyAttributed);
}
```

Inside the `auth((req) => { ... })` handler, beside the existing
`const ref = ...`:

```ts
const src = req.nextUrl.searchParams.get("s");
const alreadyAttributed = req.cookies.has(SRC_COOKIE_NAME);
```

Replace **all three** `applyRefCookie(x, ref)` call sites with
`withTracking(x, ref, src, alreadyAttributed)`. All three matter — the
protected-path redirect is the one a cold link click actually hits.

Leave `export const config.matcher` exactly as is; `/hackathon` already matches.

### Step 3 — `src/lib/validations/hackathon.ts` `[edit]`

Append (existing exports untouched):

```ts
export const sourceSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_-]{1,32}$/, "Invalid source slug");
```

### Step 4 — `src/app/actions/hackathon-actions.ts` `[edit]`

Add imports:

```ts
import { cookies } from "next/headers";
```

and add `sourceSlugSchema` to the existing
`@/lib/validations/hackathon` import.

Add module-level:

```ts
const SRC_COOKIE_NAME = "abtalks_src";

async function readSourceSlug(): Promise<string | null> {
  const raw = (await cookies()).get(SRC_COOKIE_NAME)?.value;
  if (!raw) return null;
  const parsed = sourceSlugSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
```

In `submitHackathonRegistrationAction`, right after `const d = { ...parsed.data, email };`:

```ts
const sourceSlug = await readSourceSlug();
```

> **P2028 guardrail — read this before touching the transaction.**
> This resolve **must** happen here, before the `for` retry loop and outside
> `prisma.$transaction`. Do not call `readSourceSlug()`, `cookies()`, or any
> other await inside the transaction callback. Commit `8f62c74` exists because
> long interactive transactions on the pooled Neon `DATABASE_URL` throw
> `P2028 Transaction not found`. `sourceSlug` is a plain value captured by the
> closure — the transaction body stays exactly as wide as it is today.

Then:

1. **SOLO / TEAM_CREATE** — add `sourceSlug,` to the `tx.hackathonParticipant.create()`
   `data` object inside the transaction. Nothing else in the callback changes.
2. **`insertJoin`** — add `sourceSlug,` to its `hackathonParticipant.create()`
   `data`. `insertJoin` closes over the enclosing scope, so `sourceSlug` is in
   scope; **do not add a parameter.**
3. **On every successful return** — the SOLO/TEAM_CREATE success and *both*
   TEAM_JOIN successes (first attempt and the post-race retry) — clear the
   cookie before returning:

```ts
(await cookies()).delete(SRC_COOKIE_NAME);
```

Clearing matters because college lab machines are shared: without it, the next
person to register on that device inherits a stale attribution.

**Do not** add `sourceSlug` to `hackathonRegistrationSchema`,
`HackathonRegistrationInput`, or `src/components/hackathon/registration-form.tsx`.
The httpOnly cookie is the only source. A client-supplied slug is forgeable.

Attribution semantics to preserve: each participant is credited to the link
**they personally** arrived through. A teammate who joins with a 6-char team
code and no cookie gets `null`, not the leader's slug. That is correct — they
came from the leader, not from a tracked link.

### Step 5 — `src/features/hackathon/get-admin-data.ts` `[edit]`

Add `sourceSlug: true` to the nested `participants` select. **The participant
rows are already being fetched** — the tally costs no extra participant query,
only one small query for the links table.

Extend the types:

```ts
export type AdminHackathonMember = {
  // ...existing...
  sourceSlug: string | null;
};

export type AdminHackathonSource = {
  slug: string;
  label: string;        // human label, or the slug itself when unrecognized
  note: string | null;
  kind: "EXTERNAL" | "INTERNAL";  // unrecognized slugs default to EXTERNAL
  registrations: number;
  isKnown: boolean;     // false ⇒ no HackathonLink row for this slug
};

export type AdminHackathonData = {
  // ...existing...
  sources: AdminHackathonSource[];
  externalParticipants: number;
  internalParticipants: number;
  directParticipants: number;
};
```

`attributedParticipants` is deliberately **not** a field — it would just be
`external + internal`, and having one number for both is what §3 rejects.
Compute it inline in the view if a combined figure is ever needed.

In `getAdminData()`, add `prisma.hackathonLink.findMany()` to the existing
`Promise.all` (third element):

```ts
prisma.hackathonLink.findMany({
  orderBy: { label: "asc" },
  select: { slug: true, label: true, note: true, kind: true },
}),
```

Carry `sourceSlug` through the `members` map. Then, in the same pass that
already walks `teams` for the counters, tally:

```ts
const sourceCounts = new Map<string, number>();
let directParticipants = 0;
```

Per participant: `null`/empty → `directParticipants += 1`; else bump
`sourceCounts`.

After the loop, build `sources` — known links first (including zero-count ones,
so a freshly created link is visibly live at 0), then unrecognized slugs:

```ts
const knownSlugs = new Set(links.map((l) => l.slug));

const sources: AdminHackathonSource[] = [
  ...links.map((l) => ({
    slug: l.slug,
    label: l.label,
    note: l.note,
    kind: l.kind,
    registrations: sourceCounts.get(l.slug) ?? 0,
    isKnown: true,
  })),
  ...[...sourceCounts.entries()]
    .filter(([slug]) => !knownSlugs.has(slug))
    .map(([slug, registrations]) => ({
      slug,
      label: slug,
      note: null,
      kind: "EXTERNAL" as const,
      registrations,
      isKnown: false,
    })),
].sort((a, b) => b.registrations - a.registrations);
```

Derive the two attributed counters from `sources` (not from a second pass over
participants), so they can never drift from the table the reader sees:

```ts
const internalParticipants = sources
  .filter((s) => s.kind === "INTERNAL")
  .reduce((sum, s) => sum + s.registrations, 0);
const externalParticipants =
  totalParticipants - directParticipants - internalParticipants;
```

Return `sources`, `directParticipants`, `internalParticipants`, and
`externalParticipants`.

Two deliberate choices — do not "optimize" them:

- **Tally in JS from already-fetched rows.** Per-link `count` queries would be
  ~50 round trips; a `groupBy` would be a second full scan. This adds exactly
  one small query. Correct at hackathon scale and consistent with plan 019's
  DB-usage posture.
- **Unrecognized slugs are surfaced, not dropped.** A mistyped or
  shared-before-created link still shows up instead of vanishing silently.

### Step 6 — `src/components/admin/hackathon-view.tsx` `[edit]`

Three changes to the existing Client Component.

**(a) New section, between the `Stat` tile grid and the existing Teams
`<section>`:**

```
Where registrations came from                    [4 tiles]
  Shared links · In-app promos · Direct / untracked · Active links
```

Then a `<Table>` reusing the imported primitives, columns:

| Column | Content |
|---|---|
| Source | `label`, with `note` as muted subtext. Unrecognized rows get a `<Badge variant="outline">Unrecognized</Badge>`. |
| Slug | `font-mono text-sm`. |
| Registrations | `tabular-nums font-medium`. |
| Share | percent of `totalParticipants` + a thin proportional bar. `—` when total is 0. |
| Link | `Copy` button (see below) — **`EXTERNAL` rows only**. |

**Group the body into two labelled blocks**, `EXTERNAL` first, then `INTERNAL`.
Use a full-width `<TableRow>` with a single `colSpan={5}` cell as the group
header (muted, `text-xs`, `bg-muted/30`): "Shared links" and "In-app promos".
Render the `INTERNAL` block only when it has at least one row.

Each row's **Share** percentage stays a percentage of `totalParticipants`, not
of its group — the reader needs every row plus Direct to sum to 100%.

`INTERNAL` rows get **no Copy button** — nobody shares the dashboard popup, and
a copyable URL for it would invite pasting it somewhere it does not belong.
Leave that cell empty.

Add a final `Direct / no link` row (muted, no slug, no copy button) carrying
`data.directParticipants`, so the column sums visibly reconcile to
`totalParticipants`.

Empty state when `data.sources.length === 0`: "No share links yet — add rows to
`HackathonLink` to start tracking." (§7 has the SQL.)

**(b) Copy button.** Local state in the existing component, no new file:

```tsx
const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

async function handleCopy(slug: string) {
  await navigator.clipboard.writeText(
    `${window.location.origin}/hackathon?s=${slug}`,
  );
  setCopiedSlug(slug);
  toast.success("Link copied");
  setTimeout(() => setCopiedSlug(null), 1500);
}
```

Render a real `<Button variant="ghost" size="sm" onClick={...}>` with
`Check`/`Copy` from `lucide-react` (add to the existing import). This is a
button with an `onClick`, not a link — the `buttonVariants`-on-`<Link>` rule
does not apply.

**(c) Per-participant source + CSV.** In the expanded member row, after the
`Grad {m.graduationYear}` span, add — only when `m.sourceSlug` is non-null — a
muted `via {m.sourceSlug}` span, matching the surrounding
`text-muted-foreground` styling. And add `sourceSlug: m.sourceSlug ?? ""` to the
row object in `handleExport()` so the CSV carries it.

Match the existing visual language exactly: `rounded-lg border`, `text-lg
font-medium` section headings, the existing `Stat` helper for tiles. **Do not**
introduce a chart library, a new UI primitive, or a tab bar.

### Step 7 — `src/components/dashboard/hackathon-promo-modal.tsx` `[edit]`

One line. At line 151, change the CTA href:

```diff
-              href="/hackathon"
+              href="/hackathon?s=dashboard-popup"
```

Nothing else in this file changes — not the `localStorage` seen-key, not the
`onClick={() => setOpen(false)}`, not the countdown, not the styling.

Why this is all it takes: the student is already logged in, so the click goes
straight to `/hackathon?s=dashboard-popup`; middleware sets `abtalks_src` on that
response; the existing on-site "Register" CTA carries them to
`/hackathon/register` with the cookie already in place.

**Do not add `?s=` to `hackathon/hero.tsx:99` or `hackathon/final-cta.tsx:17`.**
Those are on-site CTAs *inside* the funnel — whoever clicks them already has a
cookie (or legitimately has none, if they arrived at `/hackathon` directly).
Tagging them would relabel external arrivals as internal traffic.

**Deploy ordering:** the `dashboard-popup` row must exist in `HackathonLink`
*before* this modal change reaches production, or early popup clicks land in the
"Unrecognized" bucket. §7 step 4 covers it; run the insert first.

**First-touch interaction, expected and correct:** a student who earlier clicked
`?s=vjit-po` without registering, then registers via the popup, is credited to
`vjit-po`. The officer did introduce them. The popup is credited only when it is
genuinely the first hackathon touch. Do not special-case this.

## 7. DB safety

Schema change on **Neon via Prisma** (the Supabase path in the original draft no
longer applies).

Both changes are additive and non-destructive: one new table, one nullable
column. No existing row is rewritten; every current participant reads as
"direct". There is no data backfill.

1. Commit the working tree first so there is a clean checkpoint; note the commit
   hash in the PR description.
2. Take a Neon branch snapshot before migrating.
3. Generate and apply:

```
npx prisma migrate dev --name add_hackathon_link_attribution
npx prisma generate
```

**Migrations must run on `DIRECT_URL`, not the pooled `DATABASE_URL`.** This is
already how the project is configured (plan 008; commit `8f62c74`). If the
migration errors with `P2028` or a transaction/connection fault, **stop** — that
means it is going through the pooler. Do not retry blindly and do not hand-edit
the generated SQL.

4. Insert the sources. Neon SQL editor (or `psql` on the direct URL) — one
   statement, extend to ~50 rows. Slugs must be lowercase and match
   `^[a-z0-9_-]{1,32}$`. **Run this before deploying** (see Step 7):

```sql
insert into "HackathonLink" (id, slug, label, note, kind, "createdAt") values
  (gen_random_uuid()::text, 'dashboard-popup', 'Dashboard popup',             'In-app promo modal', 'INTERNAL', now()),
  (gen_random_uuid()::text, 'vjit-po',         'VJIT — placement officer',    'Shared with Priya, 24 Jul', 'EXTERNAL', now()),
  (gen_random_uuid()::text, 'cbit-po',         'CBIT — placement officer',    null, 'EXTERNAL', now()),
  (gen_random_uuid()::text, 'wa-batch2027',    'WhatsApp — 2027 batch group', null, 'EXTERNAL', now()),
  (gen_random_uuid()::text, 'friend-arjun',    'Arjun (friend)',              null, 'EXTERNAL', now())
on conflict (slug) do nothing;
```

The `dashboard-popup` row is **required**, not illustrative — it is the one the
Step 7 modal change points at.

(`id` is a Prisma `cuid()` default that Postgres does not generate;
`gen_random_uuid()::text` is a fine substitute for hand-inserted rows. Adjust
the `"createdAt"` column list if you prefer to let the default fill it.)

**Do not** add these to `prisma/seed.ts` — they are real operational data, and
`npm run db:cleanup` semantics should not sweep them up with test fixtures.

## 8. Guardrails for Cursor (DO NOT)

- **DO NOT** put any `await` — `cookies()`, `readSourceSlug()`, a lookup,
  anything — inside the `prisma.$transaction` callback. Read `sourceSlug`
  before the retry loop. This is the `P2028` failure mode from `8f62c74`.
- **DO NOT** import `@/lib/*`, or anything beyond `next-auth` / `next/server`,
  into `middleware.ts`. The slug regex is intentionally duplicated there; do not
  refactor it into a shared module.
- **DO NOT** make `sourceSlug` a foreign key or a Prisma relation to
  `HackathonLink`. Unrecognized slugs must still insert.
- **DO NOT** touch `applyRefCookie`, the `abtalks_ref` cookie,
  `src/app/actions/referral-actions.ts`, `generate-referral-code.ts`,
  `complete-registration.ts`, or `/admin/referrals`. The 60-day referral system
  is out of scope.
- **DO NOT** add `sourceSlug` to `hackathonRegistrationSchema`,
  `HackathonRegistrationInput`, or the registration form. Server-side cookie
  only — a client-supplied slug is forgeable.
- **DO NOT** touch `src/lib/hackathon-supabase.ts`. It is dead post-cutover code
  and is being handled separately. Do not import it, extend it, or delete it
  here.
- **DO NOT** add `requireRole` / `requireAdmin` to `/hackathon`,
  `/hackathon/register`, `/login`, or the Auth.js handler. `/hackathon` is
  **public** — a shared link must open for a logged-out stranger.
  `/admin/hackathon` already calls `requireAdmin()`; do not add a second guard.
- **DO NOT** create a clicks table, a `/h/:slug` route, a middleware rewrite,
  link-management CRUD, a new admin route, or a nav entry. Links are inserted by
  hand; the report lives on the existing `/admin/hackathon` page.
- **DO NOT** add `?s=` to `src/components/hackathon/hero.tsx`,
  `final-cta.tsx`, or any other CTA already inside the hackathon funnel. Only
  `hackathon-promo-modal.tsx` is an entry point. Tagging on-site CTAs would
  relabel external arrivals as internal traffic.
- **DO NOT** change anything else in `hackathon-promo-modal.tsx` — the
  `localStorage` seen-key, the countdown, the `setOpen(false)` handler, and the
  styling all stay. It is a one-line href edit.
- **DO NOT** pool `EXTERNAL` and `INTERNAL` into a single ranked list or a single
  "attributed" number. They are separate groups with separate tiles.
- **DO NOT** render a Copy button on `INTERNAL` rows.
- **DO NOT** overwrite an existing `abtalks_src` cookie. First touch wins.
- **DO NOT** create any new source file. All seven touched paths are in §4.
- **DO NOT** hand-write the migration SQL; let `prisma migrate dev` generate it.
- **DO NOT** use `any` (`sourceSlug` is `string | null`) or `console.error` (use
  `@/lib/logger`).
- Confirm with `git status` before reporting done.

## 9. Verification

Gate:

```
npx tsc --noEmit
npm run build
```

The build must not report a middleware size warning — if it does, an `@/lib/*`
import leaked into `middleware.ts`.

Manual, in a **fresh incognito window each time**:

1. **Cold attributed registration.** Open `/hackathon?s=vjit-po` logged out.
   DevTools → Application → Cookies: `abtalks_src=vjit-po`, HttpOnly ✓,
   SameSite=Lax. Register → log in **with Google**, so the OAuth round trip is
   actually exercised → complete the form. Confirm the new `HackathonParticipant`
   row has `sourceSlug = 'vjit-po'` and the cookie is now gone.
2. **First-touch holds.** New incognito. Visit `/hackathon?s=vjit-po`, then
   `/hackathon?s=friend-arjun`. Cookie must still read `vjit-po`.
3. **Direct registration.** New incognito, straight to `/hackathon`, no `?s=`.
   Row must be `null` and land in "Direct / untracked".
4. **Team join.** A creates a team via `?s=vjit-po`. B (new incognito, no `?s=`)
   joins with the team code. **B's row must be `null`, not `vjit-po`.**
5. **Transaction path still sound.** The TEAM_CREATE registration in (4) must
   complete without `P2028` — that path is the one wrapped in `$transaction`.
6. **Junk input.** `/hackathon?s=<script>alert(1)</script>` and `/hackathon?s=`
   + 40 chars. No cookie set in either case; page renders normally.
7. **Unrecognized bucket.** `/hackathon?s=not-a-real-link`, register, confirm it
   appears with the "Unrecognized" badge rather than being dropped.
8. **Dashboard popup.** As an enrolled 60-day student with no `abtalks_src`
   cookie, clear `localStorage` so the modal fires, open `/dashboard`, click
   "Register now". URL must be `/hackathon?s=dashboard-popup`; cookie must be
   set. Register, then confirm the row lands under **In-app promos**, not
   Shared links, and that it has **no Copy button**.
9. **Popup loses to first touch.** New incognito. Visit `/hackathon?s=vjit-po`,
   do not register, then reach the funnel via the dashboard popup and register.
   Result must be `vjit-po` — this is correct, not a bug.
10. **Admin display.** `/admin/hackathon` as an `ADMIN_EMAILS` address:
    - `externalParticipants + internalParticipants + directParticipants === totalParticipants`
    - the two group headers render; In-app promos is hidden when empty
    - a link with zero registrations still lists, at 0
    - Copy yields the full `https://…/hackathon?s=…` URL on `EXTERNAL` rows
    - expanding a team shows `via <slug>` on the attributed member only
    - CSV export contains the `sourceSlug` column
    - as a non-admin, the page still redirects to `/dashboard`
11. **Regression.** `/?ref=ABC123` still sets `abtalks_ref`; `/admin/referrals`
    still renders; existing pre-migration participants show as "Direct"; the
    popup still self-dismisses and still respects its `localStorage` seen-key.

Exactly these files should appear in `git status`: the seven edited paths in §4
plus one generated migration directory.

## 10. Commit message

```
feat(hackathon): per-link registration attribution

Share links carry ?s=<slug>; middleware stores it in a first-touch httpOnly
abtalks_src cookie so attribution survives the login/OAuth round trip to
/hackathon/register. Registration writes HackathonParticipant.sourceSlug and
clears the cookie.

The dashboard promo modal's CTA carries s=dashboard-popup, so in-app promo
conversions are measured by the same pipeline.

/admin/hackathon gains a "Where registrations came from" breakdown, split into
shared links and in-app promos with direct and unrecognized-slug buckets, plus a
per-member source chip and sourceSlug in the CSV export. Adds the HackathonLink
model; sourceSlug is intentionally a loose string, not an FK, so mistyped links
still record.

The 60-day ?ref= referral system is untouched.
```
