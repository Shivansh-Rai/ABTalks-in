# 041 — Vibe Code Hackathon: Landing Page + Registration

## 1. Goal

Ship a public, no-login hackathon microsite at `/hackathon` (marketing landing) and
`/hackathon/register` (registration flow) for a 48-hour online "pure vibe coding"
hackathon. Entrants register solo or as a team of up to 3 via a **team-code join
flow**: a leader creates the team and gets a shareable 6-character code, teammates
register separately and enter that code.

---

## 2. Current behavior

- Nothing exists at `/hackathon` — the route 404s today.
- The codebase already has two precedents for public, no-login event microsites:
  - `/ai-workshop` — form posts to `/api/ai-workshop/register`, data lands in the
    isolated workshop Supabase `registrations` table.
  - `/ai-cohort-register` + `/ai-cohort-register/apply` — multi-screen onboarding,
    data lands in Supabase `cohort_applications` via
    [cohort-application-actions.ts](src/app/actions/cohort-application-actions.ts).
- Supabase access today goes through a single anon-key client in
  [workshop-supabase.ts](src/lib/workshop-supabase.ts:6).
- `middleware.ts` protects only the paths in its `protectedPaths` array
  ([middleware.ts:10](middleware.ts:10)). `/hackathon` is **not** in it, so the route
  is public by default with zero changes.
- Root layout ([layout.tsx](src/app/layout.tsx)) wraps everything in `ThemeProvider`
  (light/dark), renders `AppFooter` on every route, and `BottomNavGate` which renders
  the bottom nav **only for logged-in users**. Public hackathon visitors therefore see
  landing content + footer only; a logged-in ABTalks student will additionally see the
  bottom nav. That is acceptable — do not add gating for it.

### Critical security constraint discovered during investigation

`src/lib/workshop-supabase.ts` is imported by a **client** component
([SocialProof.tsx](src/components/workshop/SocialProof.tsx)). Anything added to that
file ships to the browser. The hackathon service-role key therefore **must not** live
in that file — see step 1 below.

---

## 3. Files to touch

### New — data + validation layer

| Path | New/Edit | Note |
|---|---|---|
| `src/lib/hackathon-supabase.ts` | `[new]` | Server-only Supabase client using the **service role** key + hackathon read helpers. Starts with `import "server-only"`. |
| `src/lib/validations/hackathon.ts` | `[new]` | Zod schemas: participant fields + discriminated union on `entryType`. |
| `src/app/actions/hackathon-actions.ts` | `[new]` | `submitHackathonRegistrationAction`, `lookupHackathonTeamAction`. |

### New — config / copy

| Path | New/Edit | Note |
|---|---|---|
| `src/components/hackathon/hackathon-config.ts` | `[new]` | **Single source of all copy, dates, prizes, links, flags.** No hardcoded dates or copy anywhere else. |

### New — pages

| Path | New/Edit | Note |
|---|---|---|
| `src/app/hackathon/page.tsx` | `[new]` | Server Component. Metadata + composes landing sections. |
| `src/app/hackathon/register/page.tsx` | `[new]` | Server Component. Metadata + shell; renders the client form. |

### New — components (`src/components/hackathon/`)

| Path | New/Edit | Server/Client | Note |
|---|---|---|---|
| `hero.tsx` | `[new]` | **Server** | Event name, tagline, dates, two CTAs. |
| `countdown.tsx` | `[new]` | **Client** | Live countdown to kickoff. Rendered inside `hero.tsx`. |
| `theme-section.tsx` | `[new]` | **Server** | What "pure vibe coding" means + the rules of the theme. |
| `how-it-works.tsx` | `[new]` | **Server** | 4 numbered steps. |
| `timeline.tsx` | `[new]` | **Server** | Friday kickoff → Sunday deadline → results. |
| `deliverables.tsx` | `[new]` | **Server** | The 3 required submissions. |
| `prizes.tsx` | `[new]` | **Server** | Renders "announced soon" state when `PRIZES` is empty. |
| `rules.tsx` | `[new]` | **Server** | Eligibility + team size + fair-play rules. |
| `faq.tsx` | `[new]` | **Client** | Accordion (open/close state). |
| `final-cta.tsx` | `[new]` | **Server** | Closing band with register CTA. |
| `registration-form.tsx` | `[new]` | **Client** | The 3-step solo / create / join flow. |
| `success-panel.tsx` | `[new]` | **Client** | Post-submit screen; shows team code + copy button. |

**Nothing else in the repo is edited.** No `middleware.ts` change, no
`prisma/schema.prisma` change, no migration, no touching `workshop-supabase.ts`.

---

## 4. Server vs Client boundaries

- Both `page.tsx` files are **Server Components** with `export const metadata`.
- Only 4 components are `"use client"`: `countdown.tsx`, `faq.tsx`,
  `registration-form.tsx`, `success-panel.tsx`.
- **Server → Client props crossing the boundary** (all plain serializable data — no
  functions, no Lucide icon components, no class instances):
  - `hero.tsx` → `<Countdown targetIso={HACKATHON.kickoffUtc} />` — string only.
  - `register/page.tsx` → `<RegistrationForm />` — **no props at all**. The form
    imports `HACKATHON` directly from `hackathon-config.ts` (a plain object of
    strings/numbers, safe in a client bundle).
  - `registration-form.tsx` → `<SuccessPanel entryType={...} teamCode={...} teamName={...} />`
    — strings only.
- Icons: any Lucide icon used in a Server Component is imported and rendered **in that
  same file**. Never pass an icon as a prop across the boundary.

---

## 5. Steps

### Step 1 — Supabase schema (run in the Supabase SQL editor, not from the app)

Run this once against the workshop Supabase project. This is **not** a Prisma
migration and must not touch Neon.

```sql
create table if not exists hackathon_teams (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  entry_type   text not null check (entry_type in ('SOLO','TEAM')),
  team_name    text,
  team_code    text not null unique
);

create table if not exists hackathon_participants (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  team_id         uuid not null references hackathon_teams(id) on delete cascade,
  slot_index      smallint not null check (slot_index between 1 and 3),
  is_leader       boolean not null default false,
  full_name       text not null,
  email           text not null,
  phone           text not null,
  college         text not null,
  graduation_year smallint not null,
  unique (team_id, slot_index)
);

create unique index if not exists hackathon_participants_email_key
  on hackathon_participants (lower(email));

create index if not exists hackathon_participants_team_idx
  on hackathon_participants (team_id);

-- Lock both tables down completely for the anon/public key.
-- All access goes through the service-role client in Server Actions only.
alter table hackathon_teams        enable row level security;
alter table hackathon_participants enable row level security;
-- No policies are created, so anon gets nothing. Service role bypasses RLS.
```

**Why `unique (team_id, slot_index)` matters:** it is the concurrency guard. Two people
racing to claim the last seat both compute `slot_index = 3`; Postgres rejects the second
insert with a unique violation, which the action translates into "that team just filled
up". Do not replace this with an application-level count check alone.

### Step 2 — Env var

Add `SUPABASE_SERVICE_ROLE_KEY` (from Supabase → Project Settings → API → `service_role`)
to `.env.local` **and** to Vercel project env vars.

- **No `NEXT_PUBLIC_` prefix.** This key bypasses RLS; leaking it to the browser is a
  full database compromise.

### Step 3 — `src/lib/hackathon-supabase.ts` `[new]`

```ts
import "server-only";
import { createClient } from "@supabase/supabase-js";
```

- Export `hackathonSupabase`, built from `process.env.NEXT_PUBLIC_SUPABASE_URL!` and
  `process.env.SUPABASE_SERVICE_ROLE_KEY!`, with
  `{ auth: { persistSession: false, autoRefreshToken: false } }`.
- Export `type HackathonTeamLookup = { id: string; teamName: string | null; entryType: "SOLO" | "TEAM"; spotsLeft: number }`.
- Export `async function getTeamByCode(code: string): Promise<HackathonTeamLookup | null>`:
  select `id, team_name, entry_type` from `hackathon_teams` where
  `team_code = code.toUpperCase()`, `maybeSingle()`; return `null` on error or miss.
  Then `count` participants for that `team_id` and set
  `spotsLeft = HACKATHON.maxTeamSize - count`.
- Export `async function isEmailRegistered(email: string): Promise<boolean>` — select
  `id` from `hackathon_participants` where `email` matches case-insensitively
  (`.ilike("email", email)`), `maybeSingle()`.

**This file is a deliberate separate file, not an addition to `workshop-supabase.ts`,
because that file is imported by a Client Component and would leak the service key.**

### Step 4 — `src/lib/validations/hackathon.ts` `[new]`

```ts
import { z } from "zod";
import { requiredPhoneSchema } from "@/lib/validations/phone";
```

- `participantSchema` (object, reused by all three modes):
  - `fullName`: `z.string().trim().min(2, "Name is required").max(120)`
  - `email`: `z.string().trim().toLowerCase().email("Enter a valid email")`
  - `phone`: `requiredPhoneSchema` (already exists at
    [phone.ts:29](src/lib/validations/phone.ts:29))
  - `college`: `z.string().trim().min(2, "College is required").max(200)`
  - `graduationYear`: `z.number().int().min(2024).max(2032)`
- `hackathonRegistrationSchema` = `z.discriminatedUnion("entryType", [...])` over three
  members, each `participantSchema.extend(...)`:
  - `{ entryType: z.literal("SOLO") }`
  - `{ entryType: z.literal("TEAM_CREATE"), teamName: z.string().trim().min(2, "Team name is required").max(60) }`
  - `{ entryType: z.literal("TEAM_JOIN"), teamCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6}$/, "Team code must be 6 characters") }`
- `teamCodeSchema` = the same 6-char code rule alone (used by the lookup action).
- Export `type HackathonRegistrationInput = z.infer<typeof hackathonRegistrationSchema>`.

Mirror the existing style in [register.ts](src/lib/validations/register.ts) — explicit
string literals, no `any`.

### Step 5 — `src/app/actions/hackathon-actions.ts` `[new]`

`"use server"` at the top. Both actions return the standard envelope
`{ ok: true, data } | { ok: false, message }`. Log failures with
`logger.error(...)` from `@/lib/logger` — never `console.error`.

**`lookupHackathonTeamAction(code: string)`**
1. Parse with `teamCodeSchema`; on failure return `{ ok: false, message }`.
2. `getTeamByCode(code)`. If `null` → `{ ok: false, message: "No team found with that code. Check with your team leader." }`
3. If `entryType === "SOLO"` or `spotsLeft <= 0` → `{ ok: false, message: "That team is already full." }`
4. Else `{ ok: true, data: { teamName, spotsLeft } }`.

**`submitHackathonRegistrationAction(input: HackathonRegistrationInput)`**
1. If `!HACKATHON.registrationOpen` → `{ ok: false, message: "Registration is closed." }`
2. `hackathonRegistrationSchema.safeParse(input)`; on failure return
   `parsed.error.issues[0]?.message ?? "Invalid input"` (same shape as
   [cohort-application-actions.ts:13](src/app/actions/cohort-application-actions.ts:13)).
3. `await isEmailRegistered(d.email)` → if true, `{ ok: false, message: "You're already registered with this email." }`
4. Branch on `entryType`:
   - **SOLO / TEAM_CREATE** — generate a unique code, then insert:
     - Code generator, **inline in this file** (do not create a helper file): 6 chars
       from the alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no `I`/`O`/`0`/`1` —
       these get misread when shared over WhatsApp). Insert the team row; on a
       unique-violation error (Postgres code `23505`) regenerate and retry, max 5
       attempts, then return a generic failure.
     - Insert `hackathon_teams` row: `entry_type` = `"SOLO"` or `"TEAM"`,
       `team_name` = `teamName` for create / `null` for solo, `team_code`.
     - Insert `hackathon_participants` row with `team_id`, `slot_index: 1`,
       `is_leader: true`, and the participant fields.
     - **If the participant insert fails, delete the just-created team row** before
       returning the error, so no orphan teams accumulate. (Supabase JS has no
       transaction API — this compensating delete is the substitute. Do not skip it.)
     - Return `{ ok: true, data: { entryType, teamCode, teamName } }`.
   - **TEAM_JOIN**:
     - `getTeamByCode(d.teamCode)`; `null` → "No team found with that code."
     - `entryType === "SOLO"` → "That code belongs to a solo entry."
     - `spotsLeft <= 0` → "That team is already full."
     - Insert participant with `slot_index = HACKATHON.maxTeamSize - spotsLeft + 1`,
       `is_leader: false`.
     - **On unique-violation (`23505`) on `(team_id, slot_index)`: re-fetch the team
       once and retry with the recomputed slot. If it fails again, return
       "That team just filled up. Ask your leader for another team."** This is the
       race handler — implement it, do not simplify it away.
     - Return `{ ok: true, data: { entryType: "TEAM_JOIN", teamCode, teamName } }`.

### Step 6 — `src/components/hackathon/hackathon-config.ts` `[new]`

A single `export const HACKATHON = { ... } as const` object. **Every string, date,
number and link on the landing page comes from here** so the organizer edits one file.

Required keys:

```ts
name: "ABTalks Vibe Code Hackathon"
tagline: "48 hours. No boilerplate. Just you, your ideas, and AI."
registrationOpen: true
maxTeamSize: 3

// TODO(organizer): replace the three date values below before launch.
kickoffUtc: "2026-08-14T14:30:00Z"      // Fri 8:00 PM IST
deadlineUtc: "2026-08-16T14:30:00Z"     // Sun 8:00 PM IST
kickoffLabel: "Friday, 14 Aug · 8:00 PM IST"
deadlineLabel: "Sunday, 16 Aug · 8:00 PM IST"
resultsLabel: "Winners announced: Friday, 21 Aug"
registrationClosesLabel: "Registration closes Thursday, 13 Aug · 11:59 PM IST"

whatsappLink: "#"                        // TODO(organizer)
prizes: [] as { place: string; reward: string }[]   // empty ⇒ "announced soon" state
```

Plus arrays for `steps`, `timeline`, `deliverables`, `rules`, `faq`, `judging` — each
an array of `{ title, body }` (or `{ q, a }` for FAQ) so the section components just
map over them.

**The `TODO(organizer)` comments must be left in the file verbatim.** They mark the
values the organizer swaps in.

### Step 7 — Landing page content (`src/app/hackathon/page.tsx` + sections)

`page.tsx`:

```tsx
export const metadata: Metadata = {
  title: "ABTalks Vibe Code Hackathon | 48 Hours, Pure Vibe Coding",
  description: "Build anything in 48 hours using AI. Solo or teams of 3. Free to enter. Open to all Indian college students.",
};
```

Body renders, in order: `<Hero />`, `<ThemeSection />`, `<HowItWorks />`, `<Timeline />`,
`<Deliverables />`, `<Rules />`, `<Prizes />`, `<Faq />`, `<FinalCta />`.

Section-by-section content requirements:

1. **Hero** — event name, tagline, `kickoffLabel`, `<Countdown />`, primary CTA
   "Register free →" linking to `/hackathon/register`, secondary anchor link to
   `#how-it-works`. Show `registrationClosesLabel` under the CTAs.
2. **ThemeSection** (`#theme`) — explains pure vibe coding: you describe, the AI writes.
   State the spirit plainly: the point is prompting skill and product judgment, not
   typing speed. Reference Claude Code / Cursor / any AI coding tool as allowed.
3. **HowItWorks** (`#how-it-works`) — 4 steps: Register → Join the WhatsApp group →
   Build for 48 hours → Submit before the deadline.
4. **Timeline** — vertical rail on mobile, horizontal on `md:`. Kickoff, midpoint
   check-in, deadline, results.
5. **Deliverables** — exactly the three the organizer chose:
   - Public GitHub repo
   - Live deployed URL (Vercel / Netlify / anywhere reachable)
   - AI-usage log — a `PROMPTS.md` in the repo, or exported chat transcripts.
     Copy must say this is how we verify the build was genuinely vibe-coded.
6. **Rules** — solo or teams of up to 3; open to all Indian college students; one entry
   per person (enforced by the email unique index); build must start at kickoff;
   anything pre-built must be disclosed.
7. **Prizes** — if `HACKATHON.prizes.length === 0`, render a single card:
   "Prizes announced soon — register now, we'll email you the moment they're live."
   Otherwise map the array. Both branches must be implemented.
8. **Faq** — client accordion over `HACKATHON.faq`. Cover: Do I need a team? What if I
   can't code? Is it free? What counts as vibe coding? Can I use a template? How are
   winners picked?
9. **FinalCta** — repeat the register CTA.

**Styling:** Tailwind + the existing design tokens (`bg-background`, `text-foreground`,
`text-muted-foreground`, `border-border`, `bg-card`, `text-primary`). Cards are
`rounded-xl border bg-card shadow-sm hover:shadow-md`. Headings use `font-display`.
Must look correct in **both light and dark** (root layout has `ThemeProvider`) and at
**390px width first**. Section wrapper: `mx-auto w-full max-w-5xl px-4 py-16 sm:py-20`.

**Links styled as buttons use `buttonVariants` directly on `<Link>`** —
`<Link href="/hackathon/register" className={buttonVariants({ size: "lg" })}>`.
Never `<Button asChild>` or `<Button render={<Link>}>`.

### Step 8 — `src/app/hackathon/register/page.tsx` `[new]`

Server Component. Metadata (`title: "Register | ABTalks Vibe Code Hackathon"`). Renders
a heading, a back-link to `/hackathon`, and `<RegistrationForm />`. If
`HACKATHON.registrationOpen === false`, render a closed-state card instead of the form.

### Step 9 — `registration-form.tsx` `[new]` (Client)

React Hook Form + `zodResolver` (`@hookform/resolvers/zod`), shadcn `Form`, `Input`,
`Select`, `RadioGroup`, `Button` from `@/components/ui/*`. `useTransition` for the
pending state.

Three steps with a progress indicator:

- **Step 1 — How are you entering?** `RadioGroup` of three cards:
  "Going solo" / "Create a team" / "Join a team with a code". Sets `entryType`
  (`SOLO` / `TEAM_CREATE` / `TEAM_JOIN`).
- **Step 2 — Your details.** `fullName`, `email`, `phone` (label it "WhatsApp number" —
  the group invite goes there), `college`, `graduationYear` (`Select`, years 2024–2032).
- **Step 3 — depends on `entryType`:**
  - `SOLO` → skipped; step 2's button says "Register".
  - `TEAM_CREATE` → `teamName` input + a note: "You'll get a 6-character code to share
    with your teammates."
  - `TEAM_JOIN` → `teamCode` input, auto-uppercased, `maxLength={6}`. On blur (or a
    "Check code" button) call `lookupHackathonTeamAction`; on success show
    "Joining **{teamName}** — {spotsLeft} spot(s) left" and enable submit; on failure
    show the message inline and keep submit disabled.

Submit → `submitHackathonRegistrationAction(values)`. On `ok: false`, show
`result.message` in an inline error block (and `toast.error` via `sonner`). On
`ok: true`, swap the form for `<SuccessPanel />`.

Client-side back/next navigation between steps must preserve entered values (single
`useForm` instance across all steps — do not remount).

### Step 10 — `success-panel.tsx` `[new]` (Client)

- **TEAM_CREATE**: large monospace team code, a "Copy code" button
  (`navigator.clipboard.writeText`, flips to "Copied!" for 2s), and the line "Share this
  code with your teammates — they each register at
  `abtalksapp.vercel.app/hackathon/register` and enter it."
- **TEAM_JOIN**: "You're in — {teamName}."
- **SOLO**: "You're registered."
- All three: a "Join the WhatsApp group" `buttonVariants` link to
  `HACKATHON.whatsappLink`, and "What happens next" — kickoff time + that the problem
  statement drops at kickoff.
- Optional: fire `canvas-confetti` once on mount (already a dependency).

---

## 6. Guardrails for Cursor (DO NOT)

- **DO NOT** touch `prisma/schema.prisma`, create a Prisma migration, or run any
  `db:*` script. This feature stores nothing in Neon.
- **DO NOT** add anything to `src/lib/workshop-supabase.ts`. It is imported by the
  client component `SocialProof.tsx`; the service-role key put there would ship to the
  browser. The new client goes in `src/lib/hackathon-supabase.ts` with
  `import "server-only"` as its first line.
- **DO NOT** prefix the service key with `NEXT_PUBLIC_`.
- **DO NOT** import `@/lib/hackathon-supabase` from any `"use client"` file. Client
  code reaches the DB only through the two Server Actions.
- **DO NOT** edit `middleware.ts`. `/hackathon` is public because it is absent from
  `protectedPaths` — leave it absent. Adding it would break the entire feature.
- **DO NOT** add `requireRole`, `requireAdmin`, `auth()`, or any session check to the
  hackathon pages or actions. These routes are **public by design**. (This is the
  #1 recorded Cursor failure mode on this repo.)
- **DO NOT** use `<Button asChild>` or `<Button render={<Link>}>`. Use
  `buttonVariants({...})` as the `className` on `<Link>`.
- **DO NOT** use `console.error`. Use `logger` from `@/lib/logger`.
- **DO NOT** use `any`, or `as` casts to silence a type error.
- **DO NOT** create helper/util files beyond the ones listed in section 3. The team-code
  generator is ~8 lines and goes inline in `hackathon-actions.ts`.
- **DO NOT** modify anything in `src/components/ui/`.
- **DO NOT** hardcode dates, prize amounts, or marketing copy inside components — every
  one of those values comes from `hackathon-config.ts`.
- **DO NOT** mark a section component `"use client"` unless it is one of the four listed
  in section 4.
- **DO NOT** drop the `unique (team_id, slot_index)` constraint or the `23505` retry
  logic in favour of a plain count-then-insert. That constraint is the only thing
  preventing a 4-person team.
- **DO NOT** silently skip the compensating team-row delete when the leader's
  participant insert fails.

---

## 7. DB safety

No Neon/Prisma change, so no Neon branch snapshot is required. Before running the
Supabase DDL:

1. `git add -A && git commit -m "checkpoint before hackathon microsite"` — note the hash.
2. Run the Step 1 SQL in the Supabase SQL editor. It is `create table if not exists`
   throughout and touches **only** new `hackathon_*` tables — the existing
   `registrations`, `workshop_config`, `cohort_applications*` tables are untouched.
3. Verify in the Supabase table editor that both tables exist and RLS shows as
   **enabled with no policies**.
4. Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` and to Vercel before deploying.

---

## 8. Verification

**Build/typecheck (must pass clean):**
```
npx tsc --noEmit
npm run build
```
Confirm the build output lists `/hackathon` and `/hackathon/register` as static or
server-rendered routes, and that no build warning mentions
`SUPABASE_SERVICE_ROLE_KEY`.

**Security check (do this one manually, it is the highest-risk item):**
```
grep -rn "SUPABASE_SERVICE_ROLE_KEY" src/
```
Must match **only** `src/lib/hackathon-supabase.ts`. Then, in the browser devtools on
`/hackathon/register`, search the loaded JS bundles for the literal key value — zero
hits required.

**Manual test script (in order):**
1. Log out / open incognito. Visit `/hackathon` — page renders, no redirect to `/login`.
2. Toggle system light/dark — every section legible in both.
3. Resize to 390px — no horizontal scroll anywhere on the landing page.
4. Register **solo** (`solo@test.com`) → success panel shows "You're registered."
5. Register a **team leader** (`leader@test.com`, team "Test Squad") → success panel
   shows a 6-char code. Copy it.
6. Register **member 2** (`m2@test.com`) with that code → the check shows
   "Joining Test Squad — 2 spots left" and submit succeeds.
7. Register **member 3** (`m3@test.com`) with the same code → succeeds, 1 spot left
   before submit.
8. Register **member 4** (`m4@test.com`) with the same code → blocked with
   "That team is already full."
9. Re-register with `leader@test.com` → "You're already registered with this email."
10. Try a garbage code `ZZZZZZ` → "No team found with that code."
11. Try the **solo** entrant's code on the join step → "That code belongs to a solo entry."
12. In Supabase: `hackathon_teams` has 2 rows, `hackathon_participants` has 4 rows,
    the team has `slot_index` 1, 2, 3 with exactly one `is_leader = true`.
13. Clean up the test rows before launch.

**Exactly these files should show as changed:**
```
src/lib/hackathon-supabase.ts
src/lib/validations/hackathon.ts
src/app/actions/hackathon-actions.ts
src/app/hackathon/page.tsx
src/app/hackathon/register/page.tsx
src/components/hackathon/hackathon-config.ts
src/components/hackathon/hero.tsx
src/components/hackathon/countdown.tsx
src/components/hackathon/theme-section.tsx
src/components/hackathon/how-it-works.tsx
src/components/hackathon/timeline.tsx
src/components/hackathon/deliverables.tsx
src/components/hackathon/prizes.tsx
src/components/hackathon/rules.tsx
src/components/hackathon/faq.tsx
src/components/hackathon/final-cta.tsx
src/components/hackathon/registration-form.tsx
src/components/hackathon/success-panel.tsx
```
`git status` showing anything outside this list (especially `middleware.ts`,
`prisma/`, `src/lib/workshop-supabase.ts`, or `src/components/ui/`) means Cursor went
off-plan — revert those before committing.

---

## 9. Commit message

```
feat(hackathon): vibe code hackathon landing page and registration

Public microsite at /hackathon with a marketing landing page and a
/hackathon/register flow supporting solo entries, team creation with a
shareable 6-character code, and code-based joining (max 3 per team).

Registrations are stored in the isolated workshop Supabase via a new
server-only service-role client; no Neon/Prisma changes. Team capacity is
enforced by a unique (team_id, slot_index) constraint so concurrent joins
cannot overfill a team.
```

---

## 10. Deferred (not in this plan)

- **Admin view** of hackathon registrations (a `/admin/hackathon` page reading via
  `hackathon-supabase.ts`, mirroring `/admin/ai-cohort`) — worth a follow-up plan once
  registrations start coming in.
- **Project submission flow** (GitHub repo + live URL + prompt log intake) — needed
  before the deadline, but separate from registration. Plan it after this ships.
- **Confirmation email** on registration — the existing cohort flow also defers this.
- Converting a solo entry into a team after the fact.
- Judging / scoring UI.
