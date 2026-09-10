# 116 — Show the team code and team roster on `/hackathon`

## 1. Goal
A registered hackathon participant currently has no place to see their team code
or who is on their team. Put a "Your team" panel on the `/hackathon` page for
registered users — team code (copyable) plus the live member list — and close the
smaller gaps around it (joiners never see the code, full teams lose the code).

## 2. Current behavior — what actually happens today

The data exists and is correct. Nothing renders it.

- `getMyRegistration()` ([get-my-registration.ts](src/features/hackathon/get-my-registration.ts))
  already returns `team.code`, `team.name`, `entryType`, the full `members[]`
  (name, college, isLeader, slotIndex) and `spotsLeft`.
- `/hackathon` ([page.tsx](src/app/hackathon/page.tsx#L133-L136)) calls
  `getMyRegistration()` **only to compute a boolean** (`registered`) that feeds
  the unlock gate. The team payload is thrown away.
- The only registration CTA on the page is `RegistrationDialogTrigger`, which
  **returns `null` once you are registered**
  ([registration-dialog-trigger.tsx](src/components/hackathon-v2/registration-dialog-trigger.tsx#L46-L48)).
  So after a refresh, a registered user's page has no team surface at all.
- The `SuccessPanel` inside that dialog does show a team code — but only for
  `entryType === "TEAM_CREATE"`
  ([success-panel.tsx](src/components/hackathon/success-panel.tsx#L94-L114)).
  Someone who joined with a code (`TEAM_JOIN`) never sees the code, and the panel
  is gone the moment the dialog closes. It never lists members.
- `TeamRoster` and `InvitePanel` — the components that *do* render roster + code
  ([team-roster.tsx](src/components/hackathon/dashboard/team-roster.tsx),
  [invite-panel.tsx](src/components/hackathon/dashboard/invite-panel.tsx)) — live
  on `/hackathon/dashboard`, which is hard-disabled by
  `const SHOW_LIVE_DASHBOARD = false`
  ([dashboard/page.tsx](src/app/hackathon/(app)/dashboard/page.tsx#L25-L27)).
  That route renders a "New Hackathon Coming Soon" card plus last event's winners.
- That matters beyond this page: `get-landing-state.ts:84` and
  `derive-event-notifications.ts:142` both send registered users to
  `/hackathon/dashboard`, i.e. into the coming-soon wall.
- Even with the dashboard on, `InvitePanel` is only rendered when
  `reg.spotsLeft > 0` ([dashboard/page.tsx](src/app/hackathon/(app)/dashboard/page.tsx#L142-L144)),
  so a full 3-person team can no longer see its own code.

**Root cause:** the team surface was built for the dashboard, the dashboard was
switched off for the between-events period, and `/hackathon` was never given a
replacement.

**Decision this plan takes:** do NOT flip `SHOW_LIVE_DASHBOARD`. That flag also
un-hides the mission timer, problem statements, sponsor panel and submission
checklist, which are event-day surfaces. Instead render an independent, small
"Your team" panel on `/hackathon` that reads the same source of truth. If you
want the full dashboard back for Vicodathon 2.0, that is a separate call.

## 3. Files to touch
- `src/components/hackathon-v2/team-panel.tsx` `[new]` — client component: team
  code + copy button + member list + open spots. Landing-page (`hk-`) styling.
- `src/app/hackathon/page.tsx` `[edit]` — keep the `getMyRegistration()` result
  instead of discarding it; render `<TeamPanel>` under the hero when registered.
- `src/app/hackathon/_styles/hackathon-v2.css` `[edit]` — add the `.hk-team*`
  block, modelled on the existing `.hk-done__panel` / `.hk-done__code` rules
  (~line 1572).
- `src/components/hackathon/success-panel.tsx` `[edit]` — show the team code for
  `TEAM_JOIN` too, not only `TEAM_CREATE`.
- `src/app/hackathon/(app)/dashboard/page.tsx` `[edit]` — render `InvitePanel`
  for any `TEAM` entry, not only when `spotsLeft > 0` (dormant today, correct
  when the flag flips).

## 4. Server vs Client
- `src/app/hackathon/page.tsx` — **Server**. Unchanged status.
- `team-panel.tsx` — **Client** (`"use client"`, needs `navigator.clipboard` +
  `useState` for the copied flag).
- Server → Client boundary: `page.tsx` passes `team-panel.tsx` only plain
  serializable props — `entryType: "SOLO" | "TEAM"`, `teamCode: string`,
  `teamName: string | null`, `members: HackathonMember[]` (plain object array of
  strings/booleans/numbers), `maxTeamSize: number`. **No functions, no icons, no
  class instances, no Date objects** across the boundary.
- `success-panel.tsx` — already Client. Unchanged status.
- `invite-panel.tsx` / `team-roster.tsx` — unchanged.

## 5. Steps

### Step 1 — `src/components/hackathon-v2/team-panel.tsx` `[new]`
1. `"use client"` at the top.
2. Props type exactly as in §4. Import `HackathonMember` as a **type-only**
   import from `@/features/hackathon/get-my-registration` (that module is
   `server-only`; `import type` erases at compile time, so this is safe — do not
   import any value from it).
3. Render nothing (`return null`) when `entryType === "SOLO"` — a solo entrant has
   no code to share and no roster. Solo users keep the page they have today.
4. Section markup, following the existing `hk-` conventions in this folder:
   - `<section className="hk-team" aria-labelledby="hk-team-title">`
   - Heading `<h2 className="hk-h2 hk-team__title" id="hk-team-title">Your team</h2>`
     and a sub-line: `{teamName ?? "Your team"} · {members.length}/{maxTeamSize} members`.
   - **Code block** (`div.hk-team__panel`): label "Your team code", the code in
     `<code className="hk-team__code">{teamCode}</code>`, and a copy button
     `className="ab-btn hk-btn--outline"` whose label flips to `Copied!` for 2s
     via `window.setTimeout`. Wrap the `navigator.clipboard.writeText` call in
     `try/catch` and reset the flag on failure — same shape as
     `success-panel.tsx` lines 26-34. **Render this unconditionally for TEAM**,
     including when the team is full.
   - Helper line: "Teammates open the Register popup on this page and enter this
     code to join you."
   - **Roster** `<ul className="hk-team__list">`: one `<li>` per member with an
     initials avatar (copy the `initials()` helper from
     [team-roster.tsx](src/components/hackathon/dashboard/team-roster.tsx#L14-L19)
     verbatim into this file — do not create a shared util for six lines), the
     full name, a `Leader` chip when `member.isLeader`, and the college on a
     second line. Key by `member.id`.
   - After the members, render `Math.max(0, maxTeamSize - members.length)`
     "Open spot" placeholder `<li>`s with dashed borders, keyed `open-${i}`.
5. No data fetching, no server actions, no roster editing in this component.
   Removing a teammate stays a dashboard-only affordance.

### Step 2 — `src/app/hackathon/page.tsx` `[edit]`
1. Replace
   ```ts
   const registered = userId ? (await getMyRegistration(userId)) !== null : false;
   ```
   with a kept value:
   ```ts
   const registration = userId ? await getMyRegistration(userId) : null;
   const registered = registration !== null;
   ```
   Everything downstream that reads `registered` is unchanged.
2. Import `TeamPanel` and `HACKATHON` (already imported).
3. Render it **immediately after `<Hero .../>` and before `<LockedSections>`**:
   ```tsx
   {registration ? (
     <TeamPanel
       entryType={registration.team.entryType}
       teamCode={registration.team.code}
       teamName={registration.team.name}
       members={registration.members}
       maxTeamSize={HACKATHON.maxTeamSize}
     />
   ) : null}
   ```
   Outside `LockedSections` on purpose: a registered user is unlocked by
   definition, and the panel must never be part of the padlock gate.

### Step 3 — `src/app/hackathon/_styles/hackathon-v2.css` `[edit]`
Append a `.hk-team` block near the `.hk-done` rules (~line 1572). Reuse the
existing custom properties (`--ab-ink-2`, `--ab-muted`, etc.) — introduce no new
color literals that aren't already in this file. Rules needed:
`.hk-team` (section spacing consistent with `.hk-how`), `.hk-team__title`,
`.hk-team__sub`, `.hk-team__panel` (mirror `.hk-done__panel`), `.hk-team__label`,
`.hk-team__code-row`, `.hk-team__code` (mirror `.hk-done__code`),
`.hk-team__note`, `.hk-team__list` (reset list styles, gap), `.hk-team__member`,
`.hk-team__avatar`, `.hk-team__chip`, `.hk-team__college`, `.hk-team__open`
(dashed border variant). Add the same mobile stacking treatment the
`@media` block at ~line 1646 applies to `.hk-done__links`.

### Step 4 — `src/components/hackathon/success-panel.tsx` `[edit]`
Change the team-code block's condition from
`entryType === "TEAM_CREATE"` to `entryType !== "SOLO"`, and make the note text
conditional: keep "Share this with your teammates…" for `TEAM_CREATE`, and for
`TEAM_JOIN` use "This is your team's code — it's also on the hackathon page any
time you need it." Nothing else in this file changes.

### Step 5 — `src/app/hackathon/(app)/dashboard/page.tsx` `[edit]`
Change
```tsx
{reg.team.entryType === "TEAM" && reg.spotsLeft > 0 ? (
```
to
```tsx
{reg.team.entryType === "TEAM" ? (
```
`InvitePanel` already renders `spotsLeft` correctly at 0 ("0 spots left"). Do not
touch `SHOW_LIVE_DASHBOARD`.

## 6. Guardrails for Cursor (DO NOT)
- DO NOT flip `SHOW_LIVE_DASHBOARD` to `true`. It is out of scope and it un-hides
  event-day surfaces (mission timer, problem statements, submission checklist).
- DO NOT edit `middleware.ts`, `auth.config.ts` or anything on the edge import
  path. Nothing in this plan touches auth.
- DO NOT add `requireRole` / `requireAdmin` to `/hackathon` — it is a **public**
  route that must keep rendering for signed-out visitors.
- DO NOT import a value from `@/features/hackathon/get-my-registration` inside a
  client component. `import type` only.
- DO NOT create a shared `initials()` util, a `useCopyToClipboard` hook, or any
  other new abstraction file. Only `team-panel.tsx` is new.
- DO NOT change `getMyRegistration`, its Prisma `select`, or any repository.
  This plan reads existing data only — no schema change, no migration, no seed.
- DO NOT add a second `getMyRegistration()` call to `page.tsx`; reuse the one
  result.
- DO NOT use `<Button asChild>` or `<Button render={<Link>}>`; the landing page
  uses raw `ab-btn` classes, keep it that way.
- DO NOT show the team code to a `SOLO` entrant or to a signed-out visitor.
- DO NOT use `console.*`; this change needs no logging at all.

## 7. DB safety
Not applicable. No schema, migration, seed or data change.

## 8. Verification
Manual, on `npm run dev`:
1. **Signed out** → `/hackathon` renders exactly as before: padlock locked, no
   team panel, Register CTA visible.
2. **Signed in, not registered** → no team panel; Register CTA still works.
3. **Register as TEAM_CREATE** → success panel shows the code (unchanged); close
   the dialog and refresh → the "Your team" panel is on the page with the code,
   yourself tagged `Leader`, and two "Open spot" rows.
4. **Register a second account with TEAM_JOIN** using that code → the success
   panel now shows the team code too; after refresh, both accounts' panels list
   both members and one open spot.
5. **Fill the team to 3** → the code is still visible on both accounts (this is
   the `spotsLeft > 0` regression, fixed in step 5 for the dashboard too).
6. **Register as SOLO** → no team panel at all.
7. Check the panel at 375px width — code row stacks, no horizontal overflow.

Must pass: `npx tsc --noEmit` and `npm run build`.

Exactly these files should have changed:
- `src/components/hackathon-v2/team-panel.tsx` (new)
- `src/app/hackathon/page.tsx`
- `src/app/hackathon/_styles/hackathon-v2.css`
- `src/components/hackathon/success-panel.tsx`
- `src/app/hackathon/(app)/dashboard/page.tsx`

## 9. Commit message
```
feat(hackathon): show team code and roster on the hackathon page

Registered participants had no surface for their team code or member
list once the registration dialog closed — the roster components live
on /hackathon/dashboard, which is behind SHOW_LIVE_DASHBOARD=false.

Adds a "Your team" panel to /hackathon fed by the getMyRegistration
result the page already fetched, shows the team code to TEAM_JOIN
registrants in the success panel, and keeps the invite panel visible
once a team is full.

Also gates the panel server-side so SOLO registrants' team data never
enters the RSC flight payload, and renders the existing roster and
invite panel on the dashboard's coming-soon branch so the four
existing redirects to /hackathon/dashboard land somewhere useful.
```

---

## 10. Implementation addendum (2026-09-09) — verified facts & deviations

### Pre-flight verification (all three traps checked)
1. **`entryType` really is two different fields — both usages in this plan were
   correct.** `prisma/schema.prisma:1172` defines
   `enum HackathonEntryType { SOLO | TEAM }` on `HackathonTeam` — that is the
   persisted, team-level value `getMyRegistration` returns, so Steps 2/5 are
   right. `src/lib/validations/hackathon.ts:30-39` defines a *separate* Zod
   discriminated union `SOLO | TEAM_CREATE | TEAM_JOIN`, which is registration
   **intent** captured by the form and passed to `SuccessPanel` — so Step 4 is
   also right. **Do not harmonize these two.**
2. **`member.id` exists.** The §2 shape summary omitted it, but the Prisma
   `select` at `get-my-registration.ts:44-49` includes `id: true` and the mapper
   returns it. Keyed by `member.id` as planned; no `select` change needed.
3. **`HACKATHON.maxTeamSize`** confirmed at `hackathon-config.ts:7` (`3`).

Bonus: **roster ordering was already correct** — `get-my-registration.ts:43`
already applies `orderBy: { slotIndex: "asc" }`. No client-side sort added; a
redundant one would have been noise.

### Deviation: the dead-end fix is one file at the destination, not two at the source
The gap is real but bigger than described — **four** surfaces route registered
users to `/hackathon/dashboard`, not two:
- `features/landing/get-landing-state.ts:84`
- `features/notification/derive-event-notifications.ts:142`
- `features/registration/registration-gate.ts:87` (`postRegisterDestination`)
- `features/hackathon/registration-status.ts:23`
  (`hackathonRedirectForProfilelessUser` — its **return type is the string
  literal** `"/hackathon/dashboard" | null`)

The last two are asserted by `registration-gate.test.ts` in five places, and one
carries a literal type. Repointing all four is not a 2-line change.

Fixed at the destination instead: the `!SHOW_LIVE_DASHBOARD` branch of
`dashboard/page.tsx` now renders the existing `TeamRoster` + `InvitePanel`
alongside the coming-soon card (`canManage={false}` — no roster editing between
events). One file, no routing changes, no test changes, no literal-type change,
and **all four entry points now land somewhere useful**. It also makes Step 5's
`InvitePanel` fix verifiable today instead of shipping blind.

### Also applied (from review)
- `clearTimeout` on unmount **and** on re-click, so double-clicks don't stack
  timers (`team-panel.tsx`).
- `navigator.clipboard` is `undefined` on non-HTTPS origins — explicit
  `"failed"` state with a "select the code above and copy it" fallback message,
  and `aria-live="polite"` on the status line.
- `registration-dialog-trigger.tsx` now calls `router.refresh()` on dialog
  **close** as well as on success, so the panel is present when the dialog goes
  away. Verification step 3's manual reload was papering over a UX gap.

### Cost of the deviation: the team surface now lives in two places
`/hackathon` renders `TeamPanel`; `/hackathon/dashboard`'s coming-soon branch
renders `TeamRoster` + `InvitePanel`. **A future roster field has to be added in
both places.** They deliberately stay separate — different design systems (`hk-`
CSS custom properties vs. the dashboard's Tailwind dark theme) and different
affordances (the dashboard one supports removal when the event is live) — so
unifying them would cost more than it saves today. Accepted, not overlooked.

### Correction: Step 5's condition change is still untested
An earlier note claimed the destination-side fix made Step 5 verifiable. That is
only half true and the distinction matters:
- **Verified:** `InvitePanel`'s behaviour at `spotsLeft === 0` — it renders and
  reads "0 spots left" (component-level, exercised through the coming-soon
  branch).
- **Still untested:** the actual Step 5 edit, i.e. dropping `&& reg.spotsLeft > 0`
  from the guard at what is now line 152. That line sits in the
  `SHOW_LIVE_DASHBOARD === true` branch, which is dead code today and was never
  executed during verification.

### Verification actually run
- `npx tsc --noEmit` — clean.
- `npm run build` — `✓ Compiled successfully in 63s`. The one Turbopack warning
  is a pre-existing `next.config.ts` NFT-tracing notice, unrelated.
- `npx eslint` on all five changed files — one error, `react-hooks/purity` on
  `dashboard/page.tsx:113` (`Date.now()` in `rosterLocked`). **Pre-existing**,
  confirmed by re-running eslint against a clean stash (same error, old line 97).
  Untouched — out of scope for this change.
**Runtime verification (done 2026-09-09).** Ran against a throwaway local
Postgres DB (`abtalks_hkverify`, created, seeded, and dropped afterwards) in a
detached git worktree on `next dev -p 3411`, authenticated through the
`dev-credentials` provider. **Production Neon was never touched** — `.env.local`
points at the live `neondb`, and the suggested "insert a dummy participant row"
would have added a fake entrant to the open ViCodathon 2.0 roster.
Fixtures: a full 3/3 team (`Neural Nomads` / `ABC123`) and a SOLO entrant.

| Scenario | Result |
| --- | --- |
| Landing, 3/3 full team (§8.5) | `ABC123` + all three members render; **no** "Open spot" rows; header reads `Neural Nomads · 3/3 members` |
| Landing, anonymous | no team code in HTML |
| Landing, SOLO | no panel |
| Dashboard coming-soon, TEAM | `TeamRoster` + `InvitePanel` render; `Neural Nomads · 3/3`; **"0 spots left"** — the full-team case works |
| Dashboard coming-soon, SOLO | nothing team-related renders; coming-soon card intact |

**Bug found and fixed during this pass.** For a SOLO entrant the landing page
rendered `<TeamPanel>` and let the *component* return `null`. The component
showed nothing, but because it is a Client Component its props — including
`teamCode` and the member array — were serialized into the RSC flight payload and
were greppable in the page source (`"entryType":"SOLO","teamCode":"SOLO99"`).
Own-data only, so not a cross-user leak, but it defeats guardrail #9's intent.
Fixed by gating **server-side** in `page.tsx`
(`registration && registration.team.entryType === "TEAM"`), so the props are
never serialized; the component's own SOLO check stays as defence in depth.
Re-verified: `SOLO99` no longer appears anywhere in the SOLO user's HTML.

**Note for whoever tests the dashboard next:** `/hackathon/dashboard` runs
`registrationRedirect` first, so a user without a `StudentProfile` gets a 307 to
`/register` and never reaches the page. The first dashboard run looked like "the
roster didn't render" when it was actually a redirect. Seed a `StudentProfile`
alongside the `HackathonParticipant` row.

Still not covered: the 375px layout check (§8.7) — CSS-only, unverified.

### Follow-up for a later session (not done here)
`postRegisterDestination` (`registration-gate.ts:87`) and
`hackathonRedirectForProfilelessUser` (`registration-status.ts:23`) still
hard-code `/hackathon/dashboard`. That is fine **only because** the coming-soon
branch is now a useful destination. **When `SHOW_LIVE_DASHBOARD` flips for
ViCodathon 2.0 that branch stops rendering, and this routing decision has to be
re-examined** — the live dashboard has its own "Registration is closed" path for
`reg === null`, which is not what a fresh post-registration arrival should see.
Revisit alongside the flag flip, not before.
