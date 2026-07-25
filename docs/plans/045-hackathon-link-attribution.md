# 045 — Hackathon link attribution (trackable share links)

## 1. Goal

Let the organizer share up to ~50 distinct hackathon links (one per placement
officer, friend, WhatsApp group, poster) and see how many registrations came
from each one — with **zero** user-facing referral code. The student clicks a
normal-looking link and registers; attribution is invisible to them.

Scope is the hackathon funnel only. The 60-day `?ref=` referral system is
untouched and must stay untouched.

## 2. Current behavior

- `/hackathon` (`src/app/hackathon/page.tsx`) is a public landing page.
- `/hackathon/register` is in `protectedPaths` (`middleware.ts:29`), so an
  unauthenticated click bounces to `/login?from=/hackathon/register`, possibly
  through an off-site Google OAuth round trip, before reaching the form. **Query
  params do not survive this; cookies do.** This is the whole reason the design
  below uses a cookie.
- `middleware.ts` already implements this exact pattern for the 60-day system:
  `applyRefCookie()` (`middleware.ts:35`) validates a `?ref=` value and writes
  the httpOnly `abtalks_ref` cookie on every response path.
- Hackathon data lives in **Supabase**, not Prisma — `hackathon_teams`,
  `hackathon_participants`, `hackathon_event`, accessed via
  `src/lib/hackathon-supabase.ts` with the service-role key. There is no
  Prisma model for the hackathon and this plan adds none.
- Registration writes happen in
  `src/app/actions/hackathon-actions.ts` at **two** insert sites:
  the solo/leader insert (`hackathon_participants`, ~line 178) and `insertJoin()`
  for TEAM_JOIN members.
- `isEmailRegistered()` enforces one entry per email, so one participant row =
  one human. **Counts need no dedup logic.**
- There is no hackathon section in the admin nav (`src/app/admin/layout.tsx`).

## 3. Decisions locked (do not revisit)

| Decision | Choice |
|---|---|
| Metric | Registrations only. **No click tracking, no clicks table.** |
| Link format | `https://abtalks.in/hackathon?s=<slug>`. **No `/h/:slug` route, no rewrites.** |
| Attribution | **First touch wins** — cookie written once, never overwritten while it lives. |
| Cookie name | `abtalks_src` — deliberately NOT `abtalks_ref`. |
| Param name | `s` — deliberately NOT `ref`. |

Reusing `ref`/`abtalks_ref` would cross-contaminate the 60-day referral report
and the hackathon report in both directions. Keep them fully separate.

## 4. Files to touch

| Path | Change | Note |
|---|---|---|
| `middleware.ts` | `[edit]` | Read `?s=`, set first-touch `abtalks_src` cookie on all three response paths. **Edge-safe — no new imports.** |
| `src/lib/validations/hackathon.ts` | `[edit]` | Add `sourceSlugSchema` (shared slug shape). |
| `src/lib/hackathon-supabase.ts` | `[edit]` | Add `getHackathonLinkStats()`. |
| `src/app/actions/hackathon-actions.ts` | `[edit]` | Read cookie, write `source_slug` on both inserts, clear cookie on success. |
| `src/app/admin/hackathon-links/page.tsx` | `[new]` | Server Component report table. |
| `src/components/admin/hackathon-link-copy.tsx` | `[new]` | `"use client"` copy-to-clipboard button. |
| `src/app/admin/layout.tsx` | `[edit]` | Add nav item. |
| `src/components/admin/admin-sidebar.tsx` | `[edit]` | Add `hackathonLinks` to `IconName` union + `iconMap`. |
| `src/components/admin/admin-mobile-nav.tsx` | `[edit]` | Same union + map — **this file duplicates the union; both must be edited or the build fails.** |

Supabase DDL is run by hand in the Supabase SQL editor (§7) — there is no
`supabase/` migrations directory in this repo and this plan does not create one.

## 5. Server vs Client

| Component | Type | Notes |
|---|---|---|
| `middleware.ts` | Edge runtime | Only `next-auth` + `next/server`. **No `@/lib/*` imports** — the 1 MB Edge bundle limit. The slug regex is inlined here, duplicated from the Zod schema on purpose. Do not "DRY" it by importing. |
| `src/app/admin/hackathon-links/page.tsx` | **Server** | `async`, awaits `headers()` for base URL, calls the feature fn directly. |
| `src/components/admin/hackathon-link-copy.tsx` | **Client** | Receives one `url: string` prop. Strings only across the boundary — no functions, no icon components, no class instances. |
| `src/app/actions/hackathon-actions.ts` | Server Action | Already `"use server"`. |

## 6. Steps

### Step 1 — `src/lib/validations/hackathon.ts` `[edit]`

Append (keep existing exports untouched):

```ts
export const sourceSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_-]{1,32}$/, "Invalid source slug");
```

### Step 2 — `middleware.ts` `[edit]`

**Edge-safe file. Add no imports.** Alongside the existing `REF_COOKIE_*`
constants add:

```ts
const SRC_COOKIE_NAME = "abtalks_src";
const SRC_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days
```

Add a helper next to `applyRefCookie` (do not modify `applyRefCookie` itself):

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

Inside the `auth((req) => { ... })` handler, next to the existing
`const ref = req.nextUrl.searchParams.get("ref");`, add:

```ts
const src = req.nextUrl.searchParams.get("s");
const alreadyAttributed = req.cookies.has(SRC_COOKIE_NAME);
```

Then replace **all three** `applyRefCookie(x, ref)` call sites with
`withTracking(x, ref, src, alreadyAttributed)`. All three matter: the
protected-path redirect is the one a cold link click actually hits.

Leave `export const config.matcher` exactly as it is — `/hackathon` already
matches.

### Step 3 — `src/app/actions/hackathon-actions.ts` `[edit]`

Add imports:

```ts
import { cookies } from "next/headers";
import { sourceSlugSchema } from "@/lib/validations/hackathon";
```

(`cookies()` is async in Next 16 — always `await cookies()`, matching
`src/app/actions/referral-actions.ts`.)

Add a module-level helper:

```ts
const SRC_COOKIE_NAME = "abtalks_src";

async function readSourceSlug(): Promise<string | null> {
  const raw = (await cookies()).get(SRC_COOKIE_NAME)?.value;
  if (!raw) return null;
  const parsed = sourceSlugSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
```

In `submitHackathonRegistrationAction`, after the `hackathonRegistrationSchema`
parse succeeds and `const d = ...` is built:

```ts
const sourceSlug = await readSourceSlug();
```

Then:

1. **Solo/leader insert** — add `source_slug: sourceSlug,` to the
   `hackathon_participants` insert object (the one with `is_leader: true`).
2. **`insertJoin`** — add `source_slug: sourceSlug,` to its insert object too.
   `insertJoin` closes over the enclosing scope, so `sourceSlug` is in scope; do
   not add a parameter.
3. **On every successful return** (SOLO/TEAM_CREATE success, and both
   TEAM_JOIN successes — the first attempt and the post-race retry), clear the
   cookie before returning:

```ts
(await cookies()).delete(SRC_COOKIE_NAME);
```

Clearing matters because college lab machines are shared: without it, the next
person to register on that device inherits a stale attribution.

**Do not** add `source_slug` to any Zod schema, to `HackathonRegistrationInput`,
or to the registration form. It must never be client-supplied — the cookie is
the only source. A client-supplied value would be trivially forgeable.

Attribution semantics to preserve: each participant is credited to the link
**they personally** arrived through. A teammate who joins with a 6-char team
code and no cookie gets `null`, not the leader's slug. That is correct — they
came from the leader, not from a tracked link.

### Step 4 — `src/lib/hackathon-supabase.ts` `[edit]`

Append:

```ts
export type HackathonLinkStat = {
  slug: string;
  label: string;
  note: string | null;
  registrations: number;
};

export type HackathonLinkStats = {
  links: HackathonLinkStat[];
  totalRegistrations: number;
  attributedRegistrations: number;
  directRegistrations: number;
  unknownSlugs: { slug: string; registrations: number }[];
};

export async function getHackathonLinkStats(): Promise<HackathonLinkStats> {
  const [linksRes, participantsRes] = await Promise.all([
    hackathonSupabase
      .from("hackathon_links")
      .select("slug, label, note")
      .order("label"),
    hackathonSupabase.from("hackathon_participants").select("source_slug"),
  ]);

  const linkRows = linksRes.data ?? [];
  const participantRows = participantsRes.data ?? [];

  const counts = new Map<string, number>();
  let directRegistrations = 0;

  for (const row of participantRows) {
    const slug = row.source_slug;
    if (!slug) {
      directRegistrations += 1;
      continue;
    }
    counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }

  const known = new Set(linkRows.map((r) => r.slug));

  const links: HackathonLinkStat[] = linkRows
    .map((r) => ({
      slug: r.slug,
      label: r.label,
      note: r.note ?? null,
      registrations: counts.get(r.slug) ?? 0,
    }))
    .sort((a, b) => b.registrations - a.registrations);

  const unknownSlugs = [...counts.entries()]
    .filter(([slug]) => !known.has(slug))
    .map(([slug, registrations]) => ({ slug, registrations }))
    .sort((a, b) => b.registrations - a.registrations);

  return {
    links,
    totalRegistrations: participantRows.length,
    attributedRegistrations: participantRows.length - directRegistrations,
    directRegistrations,
    unknownSlugs,
  };
}
```

Two deliberate choices, do not "optimize" them:

- **Tally in JS, one query.** Supabase JS has no GROUP BY. Per-link
  `count: exact` queries would be ~50 round trips. Selecting one narrow column
  for a few thousand rows and counting in memory is correct at hackathon scale.
- **Unknown slugs are surfaced, not dropped.** If a link is mistyped or shared
  before its row exists, the registrations still show up in a separate bucket
  instead of vanishing silently.

### Step 5 — `src/components/admin/hackathon-link-copy.tsx` `[new]`

```tsx
"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HackathonLinkCopy({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="gap-1.5"
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}
```

This is a real `<Button>` with an `onClick` — not a link — so the
`buttonVariants`-on-`<Link>` rule does not apply here.

### Step 6 — `src/app/admin/hackathon-links/page.tsx` `[new]`

Server Component. Do **not** call `requireAdmin()` — `src/app/admin/layout.tsx`
already guards every route under `/admin`. Adding it again would be a redundant
second session lookup.

- Derive base URL exactly as `src/app/profile/page.tsx:114-117` does:
  `const host = (await headers()).get("host") ?? "abtalks.in"`, protocol `http`
  when host includes `localhost`, else `https`.
- Call `getHackathonLinkStats()`.
- Render four summary tiles: Total registrations, From tracked links, Direct /
  untracked, Active links (`links.length`).
- Main table using `@/components/ui/table` primitives, columns:
  **Label** (with `note` as muted subtext) · **Slug** (mono) ·
  **Registrations** (tabular-nums, bold) · **Share** (`registrations /
  totalRegistrations` as a percent, `—` when total is 0) ·
  **Link** (`{baseUrl}/hackathon?s={slug}` in a truncating mono span +
  `<HackathonLinkCopy url={...} />`).
- Below it, only when `unknownSlugs.length > 0`, a small secondary table headed
  "Unrecognized slugs" explaining these came from links with no row in
  `hackathon_links`.
- Empty state when `links.length === 0`: tell the reader to insert rows into
  `hackathon_links` in Supabase (§7).
- Follow the existing look of `src/app/admin/referrals/page.tsx`. **No date
  filters and no CSV export in this version** — `hackathon_participants` has no
  exposed created-at in this plan's read path.

### Step 7 — Admin nav `[edit ×3]`

- `src/app/admin/layout.tsx` — add to `navItems`, directly after the Referrals
  entry:
  ```ts
  {
    href: "/admin/hackathon-links",
    label: "Hackathon Links",
    icon: "hackathonLinks" as const,
  },
  ```
- `src/components/admin/admin-sidebar.tsx` — add `| "hackathonLinks"` to the
  `IconName` union (~line 27) and `hackathonLinks: Link2,` to `iconMap`; import
  `Link2` from `lucide-react`.
- `src/components/admin/admin-mobile-nav.tsx` — **identical** union + `iconMap`
  + import edit (~line 30). This file carries its own copy of the union; editing
  only the sidebar is a type error.

## 7. DB safety

Supabase-only. **No Prisma migration, no `prisma/schema.prisma` edit, no
`npx prisma migrate`.** Nothing in this plan touches Neon.

Before running anything: commit the working tree so there is a clean checkpoint,
and note the commit hash in the PR description.

Both statements below are additive and idempotent. The `alter table` adds a
nullable column, so every existing participant row keeps working and simply
reads as "direct / untracked".

Run in the **Supabase SQL editor**:

```sql
-- 1. Named share links
create table if not exists hackathon_links (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique check (slug ~ '^[a-z0-9_-]{1,32}$'),
  label      text not null,
  note       text,
  created_at timestamptz not null default now()
);

-- 2. Attribution column on participants
alter table hackathon_participants
  add column if not exists source_slug text;

create index if not exists hackathon_participants_source_slug_idx
  on hackathon_participants (source_slug);
```

Then insert the links (one statement, extend to ~50 rows). Slugs must be
lowercase and match the check constraint:

```sql
insert into hackathon_links (slug, label, note) values
  ('vjit-po',      'VJIT — placement officer',   'Shared with Priya, 24 Jul'),
  ('cbit-po',      'CBIT — placement officer',   null),
  ('wa-batch2027', 'WhatsApp — 2027 batch group', null),
  ('friend-arjun', 'Arjun (friend)',              null)
on conflict (slug) do nothing;
```

RLS: these tables are reached only with the service-role key from
`src/lib/hackathon-supabase.ts` (`import "server-only"`), which bypasses RLS.
Match whatever RLS posture the existing `hackathon_*` tables already have — do
not loosen anything, and never expose `hackathon_links` to the anon key.

## 8. Guardrails for Cursor (DO NOT)

- **DO NOT** import `@/lib/*` — or anything beyond `next-auth` / `next/server` —
  into `middleware.ts`. The slug regex is intentionally duplicated there. Do not
  refactor it into a shared module.
- **DO NOT** touch `applyRefCookie`, the `abtalks_ref` cookie,
  `src/app/actions/referral-actions.ts`, `generate-referral-code.ts`,
  `complete-registration.ts`, or `/admin/referrals`. The 60-day referral system
  is out of scope entirely.
- **DO NOT** add `source_slug` to `hackathonRegistrationSchema`,
  `HackathonRegistrationInput`, or `src/components/hackathon/registration-form.tsx`.
  The value comes from the httpOnly cookie server-side only. A client-supplied
  slug is forgeable.
- **DO NOT** add `requireRole` / `requireAdmin` to `/hackathon`,
  `/hackathon/register`, `/login`, or the Auth.js handler. `/hackathon` is
  **public** — a shared link must open for a logged-out stranger. Only the new
  `/admin/hackathon-links` page is admin-gated, and it inherits that from
  `src/app/admin/layout.tsx`.
- **DO NOT** create a clicks table, a `/h/:slug` route, a middleware rewrite, or
  any link-management CRUD UI. Links are inserted by hand in Supabase.
- **DO NOT** overwrite an existing `abtalks_src` cookie. First touch wins — this
  is the whole point of the `alreadyAttributed` guard.
- **DO NOT** add a Prisma model, edit `prisma/schema.prisma`, or run any
  migrate/seed/deploy command.
- **DO NOT** create new abstraction files beyond the two listed in §4. Inline
  everything else.
- **DO NOT** use `<Button asChild>` or `<Button render={<Link>}>` anywhere in
  the admin page — `buttonVariants` directly on `<Link>`.
- **DO NOT** use `console.error`; use `logger` from `@/lib/logger`.
- **DO NOT** use `any`. `source_slug` is `string | null`.
- Only these files may change: the nine in §4. Confirm with `git status` before
  reporting done.

## 9. Verification

Type/build gate:

```
npx tsc --noEmit
npm run build
```

The build must not report a middleware size warning — if it does, an
`@/lib/*` import leaked into `middleware.ts`.

Manual, in a fresh incognito window each time:

1. **Cold attributed registration.** Open `/hackathon?s=vjit-po` logged out.
   DevTools → Application → Cookies: `abtalks_src=vjit-po`, HttpOnly ✓,
   SameSite=Lax. Click Register → log in (use Google, so the OAuth round trip is
   actually exercised) → complete the form. Confirm in Supabase that the new
   `hackathon_participants` row has `source_slug = 'vjit-po'`, and that the
   cookie is now gone.
2. **First-touch holds.** New incognito. Visit `/hackathon?s=vjit-po`, then
   `/hackathon?s=friend-arjun`. Cookie must still read `vjit-po`.
3. **Direct registration.** New incognito, go straight to `/hackathon` with no
   `?s=`. Register. Row must have `source_slug = null` and land in the
   "Direct / untracked" tile.
4. **Team join.** Registrant A creates a team via `?s=vjit-po`. Registrant B (new
   incognito, no `?s=`) joins with the team code. B's row must be `null`, not
   `vjit-po`.
5. **Junk input.** Visit `/hackathon?s=<script>alert(1)</script>` and
   `/hackathon?s=` + 40 chars. No cookie is set in either case; the page renders
   normally.
6. **Unknown slug bucket.** Visit `/hackathon?s=not-a-real-link`, register, and
   confirm the admin page lists it under "Unrecognized slugs" rather than
   dropping it.
7. **Admin page.** `/admin/hackathon-links` as an `ADMIN_EMAILS` address —
   counts reconcile (`attributed + direct === total`), Copy yields the full
   `https://abtalks.in/hackathon?s=…` URL, nav item appears in both the desktop
   sidebar and the mobile nav. As a non-admin, confirm it redirects to
   `/dashboard`.
8. **Regression.** `/?ref=ABC123` still sets `abtalks_ref` and `/admin/referrals`
   still renders.

Exactly these files should show in `git status`: the nine listed in §4.

## 10. Commit message

```
feat(hackathon): per-link registration attribution

Share links carry ?s=<slug>; middleware stores it in a first-touch httpOnly
abtalks_src cookie so attribution survives the login/OAuth round trip to
/hackathon/register. Registration writes source_slug onto the participant row
and clears the cookie.

New /admin/hackathon-links reports registrations per named link, plus direct
and unrecognized-slug buckets. Supabase-only: adds hackathon_links and
hackathon_participants.source_slug. The 60-day ?ref= referral system is
untouched.
```
