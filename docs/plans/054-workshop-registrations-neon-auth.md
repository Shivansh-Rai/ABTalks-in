# 054 — One Workshop Registrations Table in Neon, Behind Google Auth

> Supersedes [052-workshop-supabase-to-neon.md](052-workshop-supabase-to-neon.md), which was
> never implemented. 052 remains readable for its longer rationale; **this is the plan Cursor
> executes.** The change from 052: the "one table for every workshop event, forever" decision
> is now explicit and load-bearing rather than a side effect, and the two facts that must be
> confirmed before any code is written are hoisted to §0.

## 0. Confirm these two facts BEFORE writing any code

Both are unresolved and both are silently destructive if guessed wrong.

**(a) The date of `uiux-ai-workshop` — RESOLVED.** `2026-08-01` in
[events-data.ts:56](../../src/components/workshop/events-data.ts#L56) is **correct**; the event has
already happened. The `15Aug` in the table name is historical and misleading — ignore it. **No date
change.**

**This makes the whole migration purely archival, and that is good news:**

- Today is 2026-08-03, so both workshop events are past. `getRegistrableEvent` already returns
  `undefined` and **no registration is currently possible** — the form posts and the route answers
  "Registration is closed right now."
- Therefore **there is no live write traffic to race**, no freeze window, no dual-write question,
  and no risk of a signup landing in Supabase after the migration reads it. §7 collapses to
  "migrate, verify, deploy."
- The next real event, `linkedin-ai-interview` (2026-08-22), is still upcoming but has **no**
  `register` flag. Nothing becomes registrable as a side effect of this work.
- **The cost:** the auth gate cannot be smoke-tested through the real UI, because no event is
  registrable for the form to submit against. See §9 — this needs a deliberate temporary test
  event, and skipping it means shipping an untested auth path.

**(b) The table → eventId mapping — RESOLVED.** Confirmed from the Supabase table editor.
**There is no plain `registrations` table**; both are suffixed, and the two suffixes are
capitalised *differently*:

| Supabase table (exact literal) | `eventId` | Event date |
|---|---|---|
| `registrations-AIW-18july` | `ai-workshop-live` | 2026-07-18 |
| `registrations-AIW-15Aug` | `uiux-ai-workshop` | see (a) |

Note `18july` is lowercase while `15Aug` is capitalised. These strings are used verbatim as table
identifiers — copy them exactly; a case typo migrates zero rows from that event, silently.

**Related dead code, corrected after investigation:** the old
`getRecentRegistrations()` called `.from("registrations")` — a table that does not exist — but this
never affected users, because **neither that function nor
[SocialProof.tsx](../../src/components/workshop/SocialProof.tsx) is rendered anywhere.** The
social-proof ticker is not on the page at all. Step 4 still ports the function (correctly scoped to
an `eventId`) and Step 9 repoints the type import so it compiles, but **§9 test 6 cannot be run —
there is no ticker to observe.** Wiring `SocialProof` into `/ai-workshop` is a separate decision,
deliberately not part of this plan.

## 1. Goal

Move every workshop registration into **one** Neon/Prisma table, `WorkshopRegistration`, keyed by
`eventId` — replacing the current one-Supabase-table-per-event scheme — and put the registration
form behind the existing Auth.js Google sign-in. No registration row is lost.

**Out of scope, all staying on Supabase:**
- **`workshop_config`** — a single hand-edited row of Zoom/WhatsApp links, not user-generated
  data. It gains nothing from a foreign key and moving it would add a deploy-ordering hazard
  (the page falls back to a hardcoded July 2026 date until the row exists). `getWorkshopConfig()`
  stays in `src/lib/workshop-supabase.ts` exactly as it is.
- `cohort_applications` / `cohort_applications_india`.

`@supabase/supabase-js` stays in `package.json`; `src/lib/workshop-supabase.ts` keeps its config
reader plus the cohort helpers.

### The one table decision

The per-event tables exist for exactly one reason: each table has a unique-email constraint, so a
repeat attendee is not blocked by a previous event's row
([events-data.ts:21-29](../../src/components/workshop/events-data.ts#L21-L29)). A composite
`@@unique([eventId, email])` gives the same guarantee in a single table. **Every future workshop
is then just a new entry in `EVENTS` — no new table, no schema change, no migration.** This is
the point of the plan; do not reintroduce per-event tables or an `eventId`-named table suffix.

### The auth tradeoff, stated once

`/ai-workshop` is cold-traffic lead capture. Today the form is five fields and zero friction;
Google sign-in in front of it will measurably cut top-of-funnel signups. That is the known price
of the identity. The design minimises it — the marketing page stays fully public and anonymous,
the gate sits only on the submit step. `userId` is **nullable by design**, so re-opening
anonymous registration later is a ~10-line change (drop the `auth()` check in the action). What
you buy: workshop attendees become real `User` rows, joinable to challenge enrollment, hackathon
participation and certificates. Today they are unrelated records in a second database.

## 2. Current behavior

- **Storage:** Supabase, one table per event, plus a singleton `workshop_config` (`zoom_link`,
  `whatsapp_link`, `webinar_date`, `webinar_time`, `webinar_target_utc`).
- **Write path:** `POST /api/ai-workshop/register`
  ([route.ts](../../src/app/api/ai-workshop/register/route.ts)) — **no auth**. Zod-parses
  name/email/phone/role/organization, resolves the target table server-side from
  `getRegistrableEvent(istTodayKey())` so a forged event id cannot redirect the write, and relies
  on the table's unique-email constraint for duplicates (RLS gives anon insert-only access, so a
  pre-check SELECT would always return empty). Sends a Brevo confirmation email; a mail failure is
  logged and swallowed, never failing the request.
- **Read paths:** `getWorkshopConfig()` (page + email) and `getRecentRegistrations()` (public
  social-proof ticker, first name + organization only, reads the un-scoped `registrations` table).
  Both fail soft — config to a hardcoded `FALLBACK_CONFIG`, ticker to `[]` then sample data.
- **Client:** [RegistrationForm.tsx](../../src/components/workshop/RegistrationForm.tsx) — Client
  Component, `fetch()` to the API route, confetti success modal, 3-second countdown, WhatsApp
  redirect.
- `User.email` is `String @unique` and non-nullable, so email→user backfill is a clean 1:1 join
  *where a match exists*.

### The critical difference from the hackathon migration (plan 045)

Hackathon registration was **already session-gated** when it migrated, so every participant email
resolved to a `User` and the script could safely abort on any unmatched row. Workshop registration
has **never** been gated — expect **most or all** existing rows to have no matching `User`.

> **The migration script must NOT abort on unmatched emails.** `userId` is nullable, unmatched rows
> migrate with `userId = null`, and the script reports the matched/unmatched split. Copying 045's
> abort-on-unmatched rule here would abort on essentially every row.

## 3. Files to touch

### Schema + migration
| Path | | Note |
|---|---|---|
| `prisma/schema.prisma` | `[edit]` | Add `WorkshopRegistration` + `User.workshopRegistrations` back-relation. **No `WorkshopConfig`.** |
| `scripts/migrate-workshop-to-neon.ts` | `[new]` | One-off, idempotent, table→eventId mapped, best-effort user linking. Mirrors `scripts/migrate-hackathon-to-neon.ts`. |
| `package.json` | `[edit]` | Add `workshop:migrate` + `workshop:verify`. |

### Data layer
| Path | | Note |
|---|---|---|
| `src/features/workshop/get-recent-registrations.ts` | `[new]` | `getRecentRegistrations(eventId)` + `RecentRegistrant` type. |
| `src/features/workshop/registration-status.ts` | `[new]` | `getMyRegistration(userId, eventId)`. |
| `src/features/workshop/get-admin-data.ts` | `[new]` | Per-event roster + counts for `/admin/workshop`. |
| `src/lib/workshop-supabase.ts` | `[edit]` | **Shrink, do not delete** — see Step 10. |

### Write path (API route → Server Action)
| Path | | Note |
|---|---|---|
| `src/app/actions/workshop-actions.ts` | `[new]` | `submitWorkshopRegistrationAction` — `auth()`-gated, Prisma, result envelope. |
| `src/app/api/ai-workshop/register/route.ts` | `[delete]` | Replaced by the action (CLAUDE.md: mutations via Server Actions). |

### UI
| Path | | Note |
|---|---|---|
| `src/components/workshop/events-data.ts` | `[edit]` | `registrationTable?: string` → `registrationOpen?: boolean`; fix the date per §0(a). |
| `src/app/ai-workshop/page.tsx` | `[edit]` | Server Component. Config from `@/features/workshop`; `await auth()`; pass primitives to the form. |
| `src/components/workshop/RegistrationForm.tsx` | `[edit]` | **Client.** Three states; `fetch` → action. |
| `src/components/workshop/SocialProof.tsx` | `[edit]` | Type-only import moves. |

### Admin
| Path | | Note |
|---|---|---|
| `src/app/admin/workshop/page.tsx` | `[new]` | Server Component, `await requireAdmin()` first line, `?event=` tabs. |
| `src/components/admin/workshop-registrations-view.tsx` | `[new]` | **Client** — table + CSV export via `lib/csv.ts`. |
| `src/app/admin/layout.tsx` | `[edit]` | Add the nav item. |
| `src/components/admin/admin-sidebar.tsx` | `[edit]` | Add `"workshop"` to `IconName` **and** `iconMap`. |
| `src/components/admin/admin-mobile-nav.tsx` | `[edit]` | **Same edit again — a separate second icon map. Missing this breaks the build.** |

**Not touched:** `middleware.ts`, `auth.ts`, `auth.config.ts`, `src/lib/workshop-email.ts`,
`src/components/ui/`, `cohort-application-actions.ts`,
`cohort-application-india-actions.ts`, `/admin/ai-cohort`, `cohort-applications-view.tsx`,
`/ai-cohort-register`.

## 4. Prisma schema

```prisma
/// Every workshop / webinar signup, all events in one table. One row per (event, person).
/// `eventId` matches WorkshopEvent.id in src/components/workshop/events-data.ts — events stay
/// code-defined (they carry marketing copy and Lucide icons); only signups live in the DB.
/// A new workshop needs a new EVENTS entry and nothing else.
model WorkshopRegistration {
  id           String   @id @default(cuid())
  eventId      String
  /// Null for rows migrated from the pre-auth Supabase era, and for any future anonymous
  /// mode. Every registration created after this migration has one.
  userId       String?
  name         String
  email        String
  phone        String
  role         String
  organization String?
  createdAt    DateTime @default(now())

  user User? @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([eventId, email])
  @@unique([eventId, userId])
  @@index([eventId, createdAt(sort: Desc)])
  @@index([userId])
}

// No WorkshopConfig model — `workshop_config` stays in Supabase (§1).
```

On `model User`, next to `hackathonParticipant`:
```prisma
  workshopRegistrations WorkshopRegistration[]
```

**Deliberate — do not "simplify":**
- **Model/table name is `WorkshopRegistration`, PascalCase, with no `@@map`.** The schema contains
  no `@@map` on any of its 44 models — `HackathonParticipant`, `ProgramMember`, `StudentProfile`
  all map straight to PascalCase Postgres tables. Do **not** name it `Workshop_Reg`,
  `workshop_registrations`, or add an `@@map`; it would be the only inconsistent table in the
  database.
- **`@@unique([eventId, email])`** reproduces the old per-table unique-email constraint exactly.
  It is what makes per-event tables unnecessary. **Dropping it undoes the whole plan.**
- **`@@unique([eventId, userId])`** is the auth-era duplicate guard. Postgres treats NULLs as
  distinct, so the many legacy `userId = null` rows do not collide. Both constraints coexist
  intentionally.
- **`userId` nullable** — required for legacy rows, and it is the anonymous-mode escape hatch.
- **`email` kept alongside `userId`** — a snapshot of what they registered with, used for CSV
  export and the confirmation email without a join. May diverge from `User.email` later; same as
  `HackathonParticipant.email`.
- **`role` is a plain `String`, not an enum** — the form offers Student / Professional but this is
  free-form lead data and the existing rows are strings. Do not reuse `UserType`.

## 5. DB safety (mandatory before any of §6)

1. `git add -A && git commit -m "checkpoint before workshop Neon migration"` — **note the hash.**
2. **Create a Neon branch snapshot** (project-context §17).
3. **Export both registration tables + `workshop_config` to CSV** from the Supabase UI as an
   independent second backup. Keep them until well after cutover.

**Migration command.** Both models are purely additive (two new tables, one back-relation, zero
changes to existing tables), so either mechanism is safe. Given the standing Neon migration-drift
workaround, **default to `npx prisma db push` then `npx prisma generate`**. If the migration
history has since been repaired, prefer `npx prisma migrate dev --name workshop_tables`.
**Never run `prisma migrate reset`.**

## 6. Steps

### Step 1 — Schema
Add the models + back-relation from §4 and apply per §5. Creates two empty tables and touches
nothing existing — safe to deploy while the Supabase-backed site is still live.

### Step 2 — `scripts/migrate-workshop-to-neon.ts` `[new]`
One-off Node script run with `tsx`, same shape as `scripts/migrate-hackathon-to-neon.ts`.

1. Reads `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL`. The anon key
   is insert-only under RLS and **cannot read the rows** — the service-role key is required. If it
   is unavailable, support a `--from-csv <dir>` flag reading the §5 CSV exports instead.
2. Hardcode the §0(b) map at the top of the file:
   ```ts
   const TABLE_TO_EVENT_ID = {
     // Note the differing case: "18july" lowercase, "15Aug" capitalised. Verbatim from Supabase.
     "registrations-AIW-18july": "ai-workshop-live",
     "registrations-AIW-15Aug":  "uiux-ai-workshop",
   } as const;
   ```
   Both tables merge into the **one** `WorkshopRegistration` table, distinguished only by
   `eventId`. Assert at startup that every key in this map exists in Supabase and returns rows —
   a silently-empty read from a mistyped table name is the main failure mode here (it is exactly
   what `.from("registrations")` has been doing in production).
3. Fetch **all** rows per table — no `.limit()`; page in batches of 1000.
4. **Pre-flight resolve, before writing anything.** For each row,
   `prisma.user.findUnique({ where: { email: row.email.toLowerCase() }, select: { id: true } })`.
   Build `Map<rowId, userId | null>`.
   - **Unmatched is NORMAL and must NOT abort.** Count it.
   - **Do abort** if two rows in the same `eventId` resolve to the same `userId`, or share an
     email after lowercasing — that violates the unique constraints and needs a human. Print both
     rows, exit non-zero.
5. Write in a single `prisma.$transaction`: insert each registration with the mapped `eventId`,
   resolved `userId` (or null), lowercased email, and **original `created_at` preserved** into
   `createdAt`. **Do not touch `workshop_config`** — it is out of scope (§1).
6. **Idempotent:** if `prisma.workshopRegistration.count() > 0` at start, print counts and exit 0
   without writing. Re-running must never duplicate.
7. Print per table: rows read, written, matched to a User, unmatched, and config migrated y/n.

### Step 3 — `package.json` `[edit]`
```json
"workshop:migrate": "tsx scripts/migrate-workshop-to-neon.ts",
"workshop:verify":  "tsx scripts/migrate-workshop-to-neon.ts --verify"
```
`--verify` is **read-only**: per-table row counts plus a both-directions email set-diff between
Supabase and Neon. Exits non-zero on any mismatch.

### Step 4 — `src/features/workshop/*` `[new]`
Port with the **same return shapes** so components need no prop changes. Always `select`.

**`getWorkshopConfig()` is NOT ported** — it stays in `src/lib/workshop-supabase.ts` untouched,
reading Supabase, with its existing `FALLBACK_CONFIG`. The page and the action import it from
there.

- `getRecentRegistrations(eventId: string)` — now **scoped to one event** (it previously read the
  un-scoped `registrations` table). Order `createdAt` desc, take 20,
  `select: { name: true, organization: true }` **only — never email or phone; this feeds a public
  ticker.** Same first-name-only mapping. Fail-soft `→ []`. Export `RecentRegistrant` from here.
- `getMyRegistration(userId, eventId)` — `findUnique` on the `eventId_userId` compound key,
  select `id, name, createdAt`. Fail-soft `→ null`.
- `getAdminData(eventId)` — full roster (all fields; admin context) + total count.

### Step 5 — `src/components/workshop/events-data.ts` `[edit]`
- **No date changes.** Per §0(a) every date in `EVENTS` is correct as written.
- Replace `registrationTable?: string` with `registrationOpen?: boolean` and delete the
  "Supabase table" doc comment — the injection warning it carries no longer applies, since the
  value is no longer used as a SQL identifier.
- **Do not set `registrationOpen: true` on anything.** `uiux-ai-workshop` keeps `register: true`
  (harmless — `getRegistrableEvent` filters past events anyway) but gets **no** `registrationOpen`,
  so it stays closed exactly as it is today. Opening the next workshop is a separate, deliberate
  one-line act by a human, not a side effect of this migration.
- `getRegistrableEvent(todayKey)` becomes
  `upcomingEvents(todayKey).find((e) => e.register && e.registrationOpen)`.
- **Keep server-side event resolution intact.** The action still derives the event from
  `getRegistrableEvent(istTodayKey())` and **never** accepts an `eventId` from the client. This
  was a deliberate anti-forgery measure ([route.ts:40-42](../../src/app/api/ai-workshop/register/route.ts#L40-L42))
  and it still matters.

### Step 6 — `src/app/actions/workshop-actions.ts` `[new]` — the auth gate
`"use server"`. `submitWorkshopRegistrationAction(input)`:

1. `const session = await auth();` — if no `session?.user?.id`, return
   `{ ok: false, message: "Please sign in to reserve your seat." }`. **This is the gate.**
2. Zod-parse `{ name, phone, role, organization }`: `name`/`phone`/`role` as
   `z.string().trim().min(1)`, `organization` as `z.string().trim().min(1).nullish()`.
   **`email` comes from `session.user.email`, never from the client** — same rule as
   `submitHackathonRegistrationAction`.
3. `getRegistrableEvent(istTodayKey())`; if none →
   `{ ok: false, message: "Registration is closed right now. Check back soon!" }`.
4. `prisma.workshopRegistration.create({ data: { eventId: event.id, userId: session.user.id, name, email, phone, role, organization: organization || null }, select: { id: true } })`.
   Catch Prisma **`P2002`** (either unique constraint) → return verbatim:
   `"You've already registered. Please check your email for the webinar details."`
   This replaces the Postgres `23505` check — same behavior, Prisma error code. Reuse the existing
   `isPrismaUniqueViolation` helper pattern from `hackathon-actions.ts`.
5. **Confirmation email — preserve the existing semantics exactly.** Wrap
   `sendWorkshopConfirmationEmail` in its own `try/catch`, log via `logger.error`, and **swallow**.
   The row is already saved; a Brevo outage must never fail the request. Keep the merge of
   `getWorkshopConfig()` with the event's own `fullDate(event.date)` / `event.time`.
6. Return `{ ok: true, data: { whatsappLink } }` so the client can redirect.

Then **delete `src/app/api/ai-workshop/register/route.ts`.**

### Step 7 — `src/app/ai-workshop/page.tsx` `[edit]` — Server Component
- Import `getWorkshopConfig` from `@/features/workshop/get-workshop-config`.
- `const session = await auth();`, `const event = getRegistrableEvent(istTodayKey());`, and if
  signed in, `getMyRegistration(session.user.id, event.id)`.
- **Server→Client boundary:** pass only primitives to `RegistrationForm` — `isSignedIn: boolean`,
  `sessionEmail: string | null`, `sessionName: string | null`, `alreadyRegistered: boolean`,
  `whatsappLink: string`. **Never pass the session object, a Lucide icon, or a `WorkshopEvent`**
  (it carries `Icon: LucideIcon`).
- **The page stays public.** Do **not** add `/ai-workshop` to `protectedPaths` in
  `middleware.ts` — the marketing page, countdown, ticker and event list must stay visible to
  logged-out cold traffic. The gate lives in the form section only.

### Step 8 — `src/components/workshop/RegistrationForm.tsx` `[edit]` — Client
Three states inside the existing glass card. **Keep the card, `.wk-input` styles, the confetti
modal and the WhatsApp countdown exactly as they are** — this is a state swap inside the existing
shell, not a redesign.

1. **`alreadyRegistered`** → replace the fields with a short "You're registered" panel + WhatsApp
   link. No form.
2. **Signed out** → keep the heading and subtitle; replace the fields with a single
   "Continue with Google to reserve your seat" link to `/login?from=%2Fai-workshop%23register`,
   plus one reassurance line ("Takes a few seconds — we use it to confirm your seat."). Simplest
   and most on-brand: keep the existing `.register-btn` class on an `<a>`. If you use the shared
   button instead, apply `buttonVariants` to the `<Link>` — **never `<Button asChild>`**.
3. **Signed in** → the current form, with:
   - Email rendered **read-only / disabled**, prefilled from `sessionEmail`, with a small
     "signed in as" note. Not submitted; the server uses the session.
   - Name prefilled from `sessionName`, still editable.
   - Phone (incl. country-code select), role, organization unchanged.
   - `handleSubmit` calls `submitWorkshopRegistrationAction` inside `useTransition` instead of
     `fetch`. On `{ ok: false }` set `apiError` to `message`; on `{ ok: true }` run the existing
     success modal + countdown path unchanged.
   - Drop the client-side email validation branch (email is no longer user input); keep name /
     phone / role validation.

**Known UX seam, accepted for v1:** `/login` is the ABTalks-branded page and looks nothing like
the dark `/ai-workshop` microsite, so the sign-in bounce is jarring. Smoothing it is a separate
change to `/login` — **do not build that here.**

### Step 9 — `SocialProof.tsx` `[edit]`
Change the `RecentRegistrant` type-only import to
`@/features/workshop/get-recent-registrations`. No other change; keep the `FALLBACK` array.

### Step 10 — `src/lib/workshop-supabase.ts` `[edit]` — shrink, do not delete
Remove **only** `RecentRegistrant` and `getRecentRegistrations` (the latter queried a
non-existent `registrations` table). **Keep** `workshopSupabase`, `WorkshopConfig`,
`FALLBACK_CONFIG`, `getWorkshopConfig`, `CohortRegion`, `CohortApplicationRow`,
`getCohortApplications` — config and cohort are both out of scope.

### Step 11 — Admin
- `src/app/admin/workshop/page.tsx` — `await requireAdmin()` as the **first line**. Read
  `searchParams.event`, default to the current registrable event, render tabs over the events that
  have registrations — **mirror the [`/admin/ai-cohort` region-tabs pattern](../../src/app/admin/ai-cohort/page.tsx)
  exactly** (`<Link href="?event=...">` + the same active-tab gradient classes). Total count in the
  subheading.
- `workshop-registrations-view.tsx` — Client. Table: name, email, phone, role, organization,
  linked-account indicator (`userId` null vs set), registered-at. "Export CSV" via the existing
  `toCSV` + `downloadCSV` from [lib/csv.ts](../../src/lib/csv.ts). Contact details are appropriate
  here — admin context.
- Nav: add the item in [admin/layout.tsx](../../src/app/admin/layout.tsx), and add `"workshop"` to
  the `IconName` union **and** `iconMap` in **both**
  [admin-sidebar.tsx](../../src/components/admin/admin-sidebar.tsx#L21) **and**
  [admin-mobile-nav.tsx](../../src/components/admin/admin-mobile-nav.tsx) — two separate copies.
  Suggested icon: `Presentation` or `Video` (`GraduationCap` and `Code2` are taken).

## 7. Cutover sequence (no freeze needed)

Both workshop events are past (§0(a)), so **no registration can be written during the migration**.
This is an archival copy of frozen data — no freeze step, no dual-write, no race.

1. `npm run workshop:migrate` against the **production** `DATABASE_URL`.
2. `npm run workshop:verify` — must exit 0.
3. Deploy the full code switch (Steps 4–11). Registration stays closed throughout, before and
   after, because no event is registrable.
4. Run §9 verification, **including the temporary-test-event step** — the auth path has no other
   coverage.
5. **Leave the Supabase tables in place, untouched, for at least 7 days** as the rollback path.
   Dropping them is a separate change.

**Rollback is trivial here:** revert to the §5 checkpoint commit and redeploy. Supabase is still
authoritative and untouched — the migration only ever *reads* from it — and no user-visible
behavior changed, since registration was already closed.

## 8. Guardrails for Cursor (DO NOT)

- **DO NOT** start before §0 is answered. A wrong table→eventId mapping is undetectable after the
  fact, and the event date decides whether registration is open at all.
- **DO NOT** change any date in `EVENTS`, and **do not set `registrationOpen: true` on any real
  event.** Every date is correct and every workshop is past; registration is closed today and must
  still be closed after this ships. Opening the next workshop is a separate human decision.
- **DO NOT** merge the temporary `test-workshop-gate` event from §9. Grep for it before committing
  and delete the rows it created.
- **DO NOT** create a table (or an `eventId`-suffixed variant) per workshop. One table, `eventId`
  column, forever. Future events are `EVENTS` entries only.
- **DO NOT** migrate `workshop_config` or add a `WorkshopConfig` Prisma model. It stays in
  Supabase and `getWorkshopConfig()` stays in `src/lib/workshop-supabase.ts`.
- **DO NOT** drop `@@unique([eventId, email])` — it is what replaces the per-event tables.
- **DO NOT** abort the migration script on an unmatched email. Unlike the hackathon migration,
  unmatched is the *expected* case — migrate with `userId = null` and report the count.
- **DO NOT** make `WorkshopRegistration.userId` required.
- **DO NOT** invent a `WorkshopEvent` DB table or move `EVENTS` out of `events-data.ts` — events
  carry `LucideIcon` references and marketing copy.
- **DO NOT** accept `eventId` or `email` from the client in the action. Event comes from
  `getRegistrableEvent(istTodayKey())`; email comes from `session.user.email`.
- **DO NOT** add `/ai-workshop` to `protectedPaths` in `middleware.ts`. The marketing page stays
  public; only the submit path is gated. Middleware must stay edge-safe — **no `@/lib/*` or
  `@/features/*` imports there.**
- **DO NOT** touch `cohort-application-actions.ts`, `cohort-application-india-actions.ts`,
  `/admin/ai-cohort`, `cohort-applications-view.tsx`, or `/ai-cohort-register`.
- **DO NOT** delete `src/lib/workshop-supabase.ts` or remove `@supabase/supabase-js`.
- **DO NOT** drop the Supabase workshop tables or remove `SUPABASE_SERVICE_ROLE_KEY` until
  `workshop:verify` passes on production and the smoke test is done.
- **DO NOT** run `prisma migrate reset` — ever.
- **DO NOT** let a confirmation-email failure fail the request. Caught, logged via `logger`,
  swallowed.
- **DO NOT** change any user-facing message carried over from the API route — the duplicate,
  closed-registration and generic-failure copy is reused verbatim.
- **DO NOT** select or expose `email` / `phone` in `getRecentRegistrations` — public ticker, first
  name + organization only.
- **DO NOT** redesign the registration card, confetti modal, or WhatsApp countdown.
- **DO NOT** forget the **second** icon map in `admin-mobile-nav.tsx`.
- **DO NOT** return full Prisma records — always `select`. No `any`, no `console.*` (use
  `logger`), Zod at every boundary, result envelope everywhere.

## 9. Verification

**Build/typecheck**
```
npx tsc --noEmit
npm run build
```

**Greps**
```
grep -rn "workshop-supabase" src/     # ONLY cohort files + admin/ai-cohort remain
grep -rn "registrationTable" src/     # zero hits
grep -rn "api/ai-workshop" src/       # zero hits (route deleted, form uses the action)
grep -rn "cohort_applications" src/   # UNCHANGED — still Supabase
```

**Data integrity** — `npm run workshop:verify` must exit 0, then confirm in Neon:
- `WorkshopRegistration` count == sum of both Supabase table counts.
- `SELECT DISTINCT "eventId" FROM "WorkshopRegistration";` → only
  `ai-workshop-live`, `uiux-ai-workshop`.
- `SELECT "eventId", lower(email), COUNT(*) FROM "WorkshopRegistration" GROUP BY 1,2 HAVING COUNT(*) > 1;`
  → zero rows.
- Every non-null `userId` resolves to a real `User`.
- `createdAt` matches Supabase `created_at` — spot-check oldest and newest per table.
- `/ai-workshop` still shows the correct date/time in the hero — proves `getWorkshopConfig()` is
  still reading Supabase. A "July 11, 2026" date means it fell back and the Supabase read broke.

**Manual test (production, post-cutover)**

> ⚠️ **Tests 1–8 require a registrable event, and there isn't one** (§0(a) — both workshops are
> past). Without this setup they cannot run, and the auth gate ships completely untested.
>
> **Setup — do this on a preview deploy or localhost, never on production:** temporarily add a
> throwaway entry to `EVENTS` with a future `date` (e.g. `2026-12-31`), `register: true`,
> `registrationOpen: true`, and `id: "test-workshop-gate"`. Run tests 1–8 against it, then
> **delete the entry and confirm it is gone before merging** — `grep -rn "test-workshop-gate" src/`
> must return zero hits. Also delete any `WorkshopRegistration` rows it created:
> `DELETE FROM "WorkshopRegistration" WHERE "eventId" = 'test-workshop-gate';`
>
> Tests 9–11 (admin, migrated data) need no setup and run against the real migrated rows.

1. **Logged out**, open `/ai-workshop` → page renders fully (countdown, topics, events, ticker);
   the form section shows the sign-in CTA, no fields.
2. Click it → `/login`, sign in with Google → back on `/ai-workshop`, fields shown with email
   locked to the Google account.
3. Submit → success modal, confetti, 3-second countdown, WhatsApp redirect; confirmation email
   arrives (check Promotions/Spam).
4. Reload while signed in → "You're registered" panel, not the form.
5. Submit again via a direct action call → duplicate message, exactly one row in the DB.
6. ~~Ticker shows the new registration~~ — **not applicable.** `SocialProof` is not rendered on
   `/ai-workshop` (see §0(b)), so there is nothing to observe. The `select` is still restricted to
   name + organization so the component is safe if it is ever mounted.
7. A **migrated legacy registrant** signing in with the same Google email → legacy rows have
   `userId = null`, so they see the form, and submitting hits `@@unique([eventId, email])` and
   shows the duplicate message. **Expected and correct** (no data loss, no double row) — see §10.
8. Set `registrationOpen: false` → closed state; the action refuses.
9. **Admin:** `/admin/workshop` lists both events' rosters, tabs switch, CSV exports, the
   linked-account column shows null for legacy rows.
10. Non-admin on `/admin/workshop` → redirected to `/dashboard`.
11. **`/admin/ai-cohort` still works unchanged** — both region tabs load from Supabase.

**Expected changed files** — exactly the §3 lists, plus (if using `migrate dev`)
`prisma/migrations/<timestamp>_workshop_tables/`. Anything touching cohort files, `middleware.ts`,
`auth.ts`, `auth.config.ts`, or `src/components/ui/` means Cursor went off-plan.

## 10. Commit message

```
refactor(workshop): one registrations table in Neon, gated behind Google auth

Workshop signups lived in a separate Supabase instance with one table per
event, joined to nothing — no FK to User, no transactions, no Neon branch
snapshot coverage, and an RLS service key one bad import from the client
bundle. Every new workshop meant a new table.

Adds WorkshopRegistration — all events in one table, keyed by eventId, unique
per (event, email) and per (event, userId). Migrates every existing row from
both Supabase tables with created_at and email preserved, linking to a User
where one exists by email. A future workshop is now just an entry in
events-data.ts.

workshop_config stays in Supabase: one hand-edited row of links, no FK value,
and migrating it would leave the page on a stale fallback date until the row
landed.

Registration requires an Auth.js session: /ai-workshop stays public, but the
form requires Google sign-in and takes the email from the session. The API
route is replaced by a Server Action.

userId is intentionally nullable: pre-auth rows have no account, and it keeps
re-opening anonymous registration a small change.

Cohort application tables remain on Supabase and are untouched.
```

## 11. Follow-ups (not in this plan)

- **Backfill legacy rows** — one-off script setting `userId` on `userId IS NULL` rows whose email
  now matches a `User`, so migrated attendees who later create an account get the "already
  registered" panel (test 7). Cheap, but needs the accounts to exist first.
- **Drop the Supabase workshop tables** — ≥7 days after a verified cutover.
- **Migrate the cohort application tables** — would let you delete `workshop-supabase.ts` and
  `@supabase/supabase-js` entirely. Deferred.
- **Source attribution** (`sourceSlug` from the `abtalks_src` cookie, as `HackathonParticipant`
  has) — worth adding for workshop funnel tracking; left out to keep this tight.
- **Workshop-styled sign-in bounce** — see the Step 8 UX seam.
- Surfacing workshop attendance on the student profile / admin student detail — a trivial join now.
