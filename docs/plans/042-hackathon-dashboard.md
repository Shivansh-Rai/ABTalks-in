# 042 — Vibe Code Hackathon: Participant Dashboard

## 1. Goal

Give every registered participant a post-registration home at
`/hackathon/dashboard`: a live, phase-aware **mission-control countdown**, their
**team roster** (names + college), an **invite panel** to recruit remaining
teammates, a **problem-statement** card that unlocks at kickoff, a read-only
**submission checklist**, and **event info + WhatsApp**. Full seven-segment
"mission-control" aesthetic matching the existing hackathon theme.

---

## 2. Current behavior

The hackathon microsite (plan `041`) is built and, importantly, **evolved past the
original no-login design** — this is the key fact the dashboard depends on:

- **Registration is now login-gated.** `/hackathon/register` is in the middleware
  `protectedPaths` ([middleware.ts:28](middleware.ts:28)); the page calls `auth()`
  and redirects to `/login` when signed out
  ([register/page.tsx:18](src/app/hackathon/register/page.tsx:18)); and
  `submitHackathonRegistrationAction` takes the email from the Google **session**,
  not the form ([hackathon-actions.ts:62](src/app/actions/hackathon-actions.ts:62)).
- **Therefore every registrant is a known, authenticated ABTalks account keyed by a
  unique email** (`hackathon_participants` has a case-insensitive unique email index).
  A dashboard can identify the viewer with `auth()` alone — **no magic-link token, no
  IDOR surface**, and no way to view another team's data.
- Data lives in the isolated workshop Supabase, reached only via the server-only
  service-role client [hackathon-supabase.ts](src/lib/hackathon-supabase.ts). Existing
  helpers: `getTeamByCode`, `isEmailRegistered`, `isTeamNameTaken`.
- After a successful submit, the form swaps itself for `<SuccessPanel />`
  ([registration-form.tsx:217](src/components/hackathon/registration-form.tsx:217)),
  which shows the team code but has **no path forward** — dead end today.
- The `/hackathon` segment has its own dark layout
  ([hackathon/layout.tsx](src/app/hackathon/layout.tsx)): `bg-black text-white`, and it
  loads the **DSEG7 Classic** seven-segment font plus IBM Plex Mono. The dashboard
  inherits this layout automatically.
- There is an existing seven-segment `Countdown`
  ([countdown.tsx](src/components/hackathon/countdown.tsx)) — purple radial-gradient
  units, DSEG7 digits, ghost "88" segments. The dashboard timer reuses this visual
  language.

### Layout gotcha to handle (do not ignore)

`main-shell.tsx` was updated to strip bottom padding on `/hackathon/*`
(`!isHackathon && "pb-16 md:pb-0"`) and set `bg-black`. But the dashboard is a
**protected** route, so its viewers are always logged in, and `BottomNavGate` renders
the app's **fixed mobile bottom nav** for logged-in users regardless of path. With the
hackathon padding stripped, that fixed nav overlaps the last ~64px of dashboard content
on mobile. **The dashboard's own container must add `pb-28 md:pb-10`** to clear it. Do
not "fix" this by editing `main-shell.tsx` or the bottom nav — those are shared.

---

## 3. Files to touch

### New — page + components (`src/components/hackathon/dashboard/`)

| Path | New/Edit | Server/Client | Note |
|---|---|---|---|
| `src/app/hackathon/dashboard/page.tsx` | `[new]` | **Server** | Auth, load registration + event, compose sections. |
| `src/components/hackathon/dashboard/mission-timer.tsx` | `[new]` | **Client** | Phase-aware big DSEG7 countdown; `router.refresh()` on phase change. |
| `src/components/hackathon/dashboard/team-roster.tsx` | `[new]` | Server (presentational) | Member cards, leader badge, initials avatars. |
| `src/components/hackathon/dashboard/invite-panel.tsx` | `[new]` | **Client** | Team code + copy button + spots-left. |
| `src/components/hackathon/dashboard/problem-statement-panel.tsx` | `[new]` | Server (presentational) | Locked vs revealed states. |
| `src/components/hackathon/dashboard/submission-checklist.tsx` | `[new]` | Server (presentational) | Read-only checklist from config deliverables. |
| `src/components/hackathon/dashboard/event-info.tsx` | `[new]` | Server (presentational) | Timeline recap + key dates + WhatsApp button. |

### Edit — wiring the new route in

| Path | New/Edit | Note |
|---|---|---|
| `middleware.ts` | `[edit]` | Add `"/hackathon/dashboard"` to `protectedPaths`. |
| `src/lib/hackathon-supabase.ts` | `[edit]` | Add `getMyRegistration(email)` + `getHackathonEvent()` + their types. |
| `src/app/hackathon/register/page.tsx` | `[edit]` | If the signed-in user is already registered, `redirect("/hackathon/dashboard")`. |
| `src/components/hackathon/success-panel.tsx` | `[edit]` | Add a primary "Go to your dashboard" CTA. |
| `src/components/hackathon/hero.tsx` | `[edit]` | Make async; if viewer is registered, primary CTA becomes "Go to your dashboard". |

**Not touched:** `main-shell.tsx`, `bottom-nav*`, `workshop-supabase.ts`, anything in
`src/components/ui/`, `prisma/`.

---

## 4. Server vs Client boundaries

- `page.tsx` is a **Server Component**. It calls `auth()` and the two server-only
  Supabase helpers, then passes **plain serializable data** into the section
  components (strings, numbers, booleans, arrays of `{ fullName, college, isLeader,
  slotIndex }`). No functions, no icon components, no class instances cross the boundary.
- Only **two** components are `"use client"`: `mission-timer.tsx` (needs `setInterval`
  + `useRouter`) and `invite-panel.tsx` (needs `navigator.clipboard`).
- The other four section components are **presentational Server Components** — they
  receive props and render markup, no client hooks.
- **Client components must never import `@/lib/hackathon-supabase`** (it's `server-only`
  and holds the service-role key). They receive everything as props.
- Props crossing into clients:
  - `<MissionTimer kickoffUtc={...} deadlineUtc={...} resultsLabel={...} />` — strings.
  - `<InvitePanel teamCode={...} spotsLeft={...} />` — string + number.

---

## 5. Steps

### Step 1 — Supabase: single-row event table (SQL editor, not from app)

The problem statement must be editable **live at kickoff** without a redeploy. Store it
in a one-row config table (mirrors the existing `workshop_config` pattern). This is not
a Prisma migration and touches only a new table.

```sql
create table if not exists hackathon_event (
  id                smallint primary key default 1,
  problem_statement text,
  updated_at        timestamptz not null default now(),
  constraint hackathon_event_singleton check (id = 1)
);

insert into hackathon_event (id) values (1) on conflict (id) do nothing;

alter table hackathon_event enable row level security;
-- No policies: anon key gets nothing, service role bypasses RLS.
```

Organizer workflow: at kickoff, paste the problem statement into that row's
`problem_statement` cell in the Supabase table editor. It auto-appears on the dashboard
(see reveal logic in Step 6).

### Step 2 — `middleware.ts` `[edit]`

Add `"/hackathon/dashboard"` to the `protectedPaths` array (right after
`"/hackathon/register"`). This keeps signed-out users out and sends them to `/login`
with a `from` back to the dashboard. **Do not** add anything `@/lib/*` to middleware —
it stays edge-safe.

### Step 3 — `src/lib/hackathon-supabase.ts` `[edit]`

Add these exports (keep the existing ones):

```ts
export type HackathonMember = {
  fullName: string;
  college: string;
  isLeader: boolean;
  slotIndex: number;
};

export type MyRegistration = {
  team: { id: string; code: string; name: string | null; entryType: "SOLO" | "TEAM" };
  me: { fullName: string; isLeader: boolean };
  members: HackathonMember[];
  spotsLeft: number;
};
```

**`getMyRegistration(email: string): Promise<MyRegistration | null>`**
1. Find the participant: `hackathon_participants` select
   `id, team_id, full_name, is_leader` where `.ilike("email", email)`, `.maybeSingle()`.
   Null/error → return `null`.
2. Find the team: `hackathon_teams` select `id, team_code, team_name, entry_type` where
   `id = team_id`, `.maybeSingle()`. Null/error → return `null`.
3. Find members: `hackathon_participants` select `full_name, college, is_leader,
   slot_index` where `team_id = team_id`, `.order("slot_index")`.
4. `spotsLeft = entry_type === "SOLO" ? 0 : HACKATHON.maxTeamSize - members.length`.
5. Return the assembled object. **Only ever query by the passed-in email** (which the
   caller sources from `auth()`), never from client input.

**`getHackathonEvent(): Promise<{ problemStatement: string | null }>`**
- Select `problem_statement` from `hackathon_event` `.maybeSingle()`; return
  `{ problemStatement: data?.problem_statement ?? null }`, and `{ problemStatement: null }`
  on error.

**Never select `email` or `phone` for the roster** — only `full_name`, `college`,
`is_leader`, `slot_index` leave this module toward the UI. This is the privacy decision
(name + college only between teammates).

### Step 4 — `src/app/hackathon/dashboard/page.tsx` `[new]` (Server)

```tsx
export const metadata: Metadata = {
  title: "Your Dashboard | ABTalks Vibe Code Hackathon",
};
```

Logic:
1. `const session = await auth();` — if `!session?.user?.email`, `redirect("/login?from=/hackathon/dashboard")`.
   (Belt-and-suspenders with the middleware; both are cheap.)
2. `const reg = await getMyRegistration(session.user.email.trim().toLowerCase());`
   If `null` → the user is logged in but hasn't registered → `redirect("/hackathon/register")`.
3. `const { problemStatement } = await getHackathonEvent();`
4. Container: `<div className="mx-auto w-full max-w-3xl px-4 py-10 pb-28 md:pb-10">`
   — the `pb-28` clears the fixed mobile bottom nav (see §2 gotcha).
5. Render, top to bottom:
   - A compact greeting header: "Welcome, {reg.me.fullName.split(' ')[0]}" +
     entry-type chip ("SOLO" / team name).
   - `<MissionTimer kickoffUtc={HACKATHON.kickoffUtc} deadlineUtc={HACKATHON.deadlineUtc} resultsLabel={HACKATHON.resultsLabel} />`
   - `<ProblemStatementPanel kickoffUtc={HACKATHON.kickoffUtc} statement={problemStatement} />`
   - `<TeamRoster entryType={reg.team.entryType} teamName={reg.team.name} members={reg.members} />`
   - **If** `reg.team.entryType === "TEAM" && reg.spotsLeft > 0`:
     `<InvitePanel teamCode={reg.team.code} spotsLeft={reg.spotsLeft} />`
   - `<SubmissionChecklist />`
   - `<EventInfo />`

### Step 5 — `mission-timer.tsx` `[new]` (Client)

Phase-aware three-state timer. Reuse the DSEG7 unit styling from
[countdown.tsx](src/components/hackathon/countdown.tsx) (purple radial-gradient units,
ghost "88", `font-family: '"DSEG7 Classic", monospace'`) but larger and as the page
centerpiece.

- Compute phase every tick from `Date.now()`:
  - `now < kickoff` → **PRE**: label "STARTS IN", counts down to `kickoffUtc`, accent
    **purple/indigo** (match existing units).
  - `kickoff <= now < deadline` → **LIVE**: label "TIME LEFT TO SUBMIT", counts down to
    `deadlineUtc`, accent **cyan/emerald**. When `< 60 min` remain, switch accent to
    **red** and add a subtle pulse (`animate-pulse` on the label, not the digits).
  - `now >= deadline` → **ENDED**: no live digits; show "SUBMISSIONS CLOSED" and
    `resultsLabel` in DSEG7/mono, accent **muted gray**.
- **Phase transition PRE→LIVE:** when the tick first crosses `kickoff`, call
  `router.refresh()` (`useRouter` from `next/navigation`) once so the server re-renders
  and the problem statement reveals without a manual reload. Guard with a ref so it
  fires only once.
- Hydration-safe: render static `00`s until `mounted` (same pattern as `countdown.tsx`),
  so SSR and first client paint match.
- Show the relevant absolute label under the digits (`HACKATHON.kickoffLabel` in PRE,
  `HACKATHON.deadlineLabel` in LIVE).

### Step 6 — `problem-statement-panel.tsx` `[new]` (Server, presentational)

Props: `{ kickoffUtc: string; statement: string | null }`.
- `const unlocked = Date.now() >= new Date(kickoffUtc).getTime();`
- **Locked** (`!unlocked`): a card with a lock icon (Lucide `Lock`), heading "Problem
  statement", body "Unlocks at kickoff — {HACKATHON.kickoffLabel}". Frosted/dimmed look.
- **Unlocked + statement present**: heading "Your challenge", render `statement` as
  pre-wrapped text (`whitespace-pre-wrap`), plus a line "Full brief and Q&A in the
  WhatsApp group."
- **Unlocked + statement null**: "The brief is dropping shortly — check the WhatsApp
  group." (organizer hasn't pasted it yet).
- Server-side `Date.now()` sets the initial state; the live reveal is driven by
  `MissionTimer`'s `router.refresh()` at kickoff.

### Step 7 — `team-roster.tsx` `[new]` (Server, presentational)

Props: `{ entryType: "SOLO" | "TEAM"; teamName: string | null; members: HackathonMember[] }`.
- Heading: SOLO → "Your entry"; TEAM → `teamName` + "· {members.length}/{HACKATHON.maxTeamSize}".
- One card per member (sorted by `slotIndex`, already ordered): a round **initials
  avatar** (first letters of `fullName`), the name, the college in muted text, and a
  **"Leader"** badge when `isLeader`.
- For TEAM with empty slots, render ghost/placeholder cards ("Open spot") for
  `spotsLeft` count so the roster visibly shows room — compute from
  `HACKATHON.maxTeamSize - members.length`. (SOLO: single card, no placeholders.)

### Step 8 — `invite-panel.tsx` `[new]` (Client)

Props: `{ teamCode: string; spotsLeft: number }`. Reuse the copy-button pattern already
in [success-panel.tsx](src/components/hackathon/success-panel.tsx) (Lucide `Copy`/`Check`,
2s "Copied!" flip, `navigator.clipboard.writeText`).
- Heading "Invite your team" + "{spotsLeft} spot(s) left".
- Big monospace code block (same styling as success panel's code display) + copy button.
- Helper line: "Teammates register at abtalksapp.vercel.app/hackathon/register and enter
  this code."

### Step 9 — `submission-checklist.tsx` `[new]` (Server, presentational)

Read-only. Map `HACKATHON.deliverables` into a checklist of unchecked circles (Lucide
`Circle`) with each `title` + `body`. A muted footnote: "Submission opens near the
deadline — you'll submit these here." (Actual intake is a **separate later plan**; do
not build a form.)

### Step 10 — `event-info.tsx` `[new]` (Server, presentational)

- A compact vertical recap of `HACKATHON.timeline` (title + body).
- Key dates block: `kickoffLabel`, `deadlineLabel`, `resultsLabel`.
- A prominent **"Join the WhatsApp group"** link styled with
  `buttonVariants({ size: "lg" })` pointing at `HACKATHON.whatsappLink` (opens in a new
  tab, `rel="noopener noreferrer"`).

### Step 11 — `success-panel.tsx` `[edit]`

Add, for **all** entry types, a primary CTA at the bottom:
`<Link href="/hackathon/dashboard" className={buttonVariants({ size: "lg" })}>Go to your dashboard →</Link>`.
Keep the existing team-code display and WhatsApp link. The dashboard becomes the
natural next step after registering.

### Step 12 — `register/page.tsx` `[edit]`

After `auth()` resolves the session (and before rendering the form), add:
```ts
const existing = await getMyRegistration(session.user.email.trim().toLowerCase());
if (existing) redirect("/hackathon/dashboard");
```
So an already-registered user who revisits `/hackathon/register` lands on their
dashboard instead of a second registration attempt. (The action already blocks
duplicate emails; this is the friendly redirect.)

### Step 13 — `hero.tsx` `[edit]`

Make the component `async`. Call `auth()`; if a session exists, call
`getMyRegistration(session.user.email…)`. If registered, the **primary** CTA becomes
`Go to your dashboard →` → `/hackathon/dashboard`; otherwise it stays `Register free →`
→ `/hackathon/register`. Keep the secondary anchor link unchanged. (`hero.tsx` is a
Server Component, so importing the server-only helper is safe.)

---

## 6. Guardrails for Cursor (DO NOT)

- **DO NOT** edit `main-shell.tsx`, `bottom-nav.tsx`, or `bottom-nav-gate.tsx`. Clear
  the fixed mobile nav with `pb-28 md:pb-10` on the dashboard container only.
- **DO NOT** import `@/lib/hackathon-supabase` (or anything `server-only`) from a
  `"use client"` file. `mission-timer` and `invite-panel` get plain props only.
- **DO NOT** select, pass, or render teammates' `email` or `phone` anywhere in the
  dashboard UI. Roster shows **name + college + leader flag** only. `getMyRegistration`
  must not even `select` those columns for the members list.
- **DO NOT** accept a team id, team code, or email from the client to decide whose data
  to show. The viewer's identity comes **only** from `auth()`. (No IDOR.)
- **DO NOT** add `@/lib/*` imports to `middleware.ts` — keep it edge-safe. The only edit
  there is one string in `protectedPaths`.
- **DO NOT** add a submission form / upload. The checklist is read-only; intake is a
  later plan.
- **DO NOT** hardcode dates, labels, deliverables, timeline, or the WhatsApp link in any
  component — every one comes from `HACKATHON` in
  [hackathon-config.ts](src/components/hackathon/hackathon-config.ts).
- **DO NOT** use `<Button asChild>` / `<Button render={<Link>}>`. Use `buttonVariants`
  on `<Link>`.
- **DO NOT** use `console.*` (use `logger`) or `any` / silencing `as` casts.
- **DO NOT** create a second Supabase client or put the service-role key anywhere but the
  existing `hackathon-supabase.ts`.
- **DO NOT** mark the four presentational section components `"use client"`.
- **DO NOT** touch `prisma/`, run any `db:*` command, or add a Prisma model — the event
  table is Supabase-only.

## 7. DB safety

No Neon/Prisma change. Before running the Step 1 SQL:
1. `git add -A && git commit -m "checkpoint before hackathon dashboard"` — note the hash.
2. Run the `hackathon_event` DDL in the Supabase SQL editor. It is
   `create table if not exists` and touches only the new table; `hackathon_teams`,
   `hackathon_participants`, and all workshop/cohort tables are untouched.
3. Confirm in the Supabase table editor: `hackathon_event` has exactly one row (`id = 1`,
   `problem_statement` null), RLS enabled, no policies.

## 8. Verification

**Build / typecheck (must pass clean):**
```
npx tsc --noEmit
npm run build
```
Build output must list `/hackathon/dashboard` as a route.

**Security greps (run and eyeball):**
```
grep -rn "SUPABASE_SERVICE_ROLE_KEY" src/     # only src/lib/hackathon-supabase.ts
grep -rn "hackathon-supabase" src/components/  # zero hits (no client imports the helper)
```
Also grep the dashboard client bundle in devtools for any teammate email/phone string —
zero hits.

**Manual test script:**
1. Signed out, hit `/hackathon/dashboard` → redirected to `/login`.
2. Sign in as a user who hasn't registered, hit `/hackathon/dashboard` → redirected to
   `/hackathon/register`.
3. Register a **team leader** → success panel now shows "Go to your dashboard →" → click
   it → dashboard loads with the roster (1/3, leader badge), invite panel showing the
   code + "2 spots left", and (before kickoff) the timer reading "STARTS IN" counting to
   kickoff, problem statement **locked**.
4. Copy the code; register **member 2** (different Google account) with it → their
   dashboard shows the team 2/3, both names + colleges, **no** invite panel would show
   for them only if… (invite panel shows to any team member while `spotsLeft > 0`) — fine.
5. On the leader's dashboard, refresh → member 2 now appears in the roster; invite panel
   shows "1 spot left".
6. Register **member 3** → roster 3/3, invite panel **gone** (spotsLeft 0) for everyone.
7. **Timer phases:** temporarily set `HACKATHON.kickoffUtc` to ~30s ahead and
   `deadlineUtc` a few minutes ahead. Load the dashboard: watch PRE count down; at
   kickoff it flips to "TIME LEFT TO SUBMIT" and the page auto-refreshes; paste a
   `problem_statement` into the Supabase row and refresh → it reveals; in the final
   minute the timer turns red; after `deadlineUtc` it shows "SUBMISSIONS CLOSED" +
   results label. **Revert the config dates afterward.**
8. Mobile 390px: no horizontal scroll; the bottom app-nav does **not** cover the last
   card (the `pb-28` works).
9. Solo registrant: dashboard shows a single-card "Your entry", **no** invite panel.
10. Revisit `/hackathon/register` while registered → bounced to the dashboard.

**Exactly these files should show as changed:**
```
middleware.ts
src/lib/hackathon-supabase.ts
src/app/hackathon/register/page.tsx
src/components/hackathon/hero.tsx
src/components/hackathon/success-panel.tsx
src/app/hackathon/dashboard/page.tsx
src/components/hackathon/dashboard/mission-timer.tsx
src/components/hackathon/dashboard/team-roster.tsx
src/components/hackathon/dashboard/invite-panel.tsx
src/components/hackathon/dashboard/problem-statement-panel.tsx
src/components/hackathon/dashboard/submission-checklist.tsx
src/components/hackathon/dashboard/event-info.tsx
```
Anything under `prisma/`, `src/components/ui/`, `main-shell.tsx`, or the bottom-nav
files appearing in `git status` means Cursor went off-plan — revert before committing.

## 9. Commit message

```
feat(hackathon): participant dashboard with live countdown and team roster

Add /hackathon/dashboard: a phase-aware seven-segment countdown (pre-kickoff →
live → closed, auto-refreshing at kickoff), the team roster (name + college,
leader badge), an invite panel to fill open team slots, a problem-statement card
that unlocks at kickoff from a Supabase-editable event row, a read-only
submission checklist, and event info + WhatsApp.

Viewer identity comes from the Google session (auth), so no token and no IDOR;
teammates' email/phone are never exposed. Success panel, hero, and the register
page now route registered users to the dashboard.
```

## 10. Deferred (separate later plans)

- **Submission intake** (GitHub repo + live URL + PROMPTS.md upload/validation, per
  team, gated to the LIVE window) — the checklist here is only a preview of the targets.
- **Admin view** of teams/participants (`/admin/hackathon`) + an admin field to edit the
  problem statement instead of the Supabase table editor.
- Editing/withdrawing a registration; converting a solo entry into a team.
- Real-time roster updates without refresh (would need polling or Supabase realtime;
  manual refresh is acceptable at this scale).
