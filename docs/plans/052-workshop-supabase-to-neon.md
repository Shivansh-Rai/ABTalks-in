# 052 — Migrate Workshop Registrations from Supabase to Neon + Add Auth

## 1. Goal

Move the workshop registration tables (`registrations`, `registrations-AIW-15Aug`, and
`workshop_config`) out of the isolated workshop Supabase into the main Neon/Prisma
database, and put the registration behind Auth.js Google sign-in — the same identity
model the 60-day challenge and the hackathon already use. Existing registration rows must
be migrated without loss.

**Explicitly out of scope:** `cohort_applications` and `cohort_applications_india` stay on
Supabase and are not touched. `@supabase/supabase-js` stays in `package.json`, and
`src/lib/workshop-supabase.ts` survives in reduced form (cohort helpers only).

## 2. Why, and the one tradeoff to accept knowingly

The mechanical case matches plan `045`: identity split across two databases, no FK, no
transactions, no Neon branch snapshot coverage, and an RLS-key module one bad client
import from leaking. Adding auth makes it sharper — the moment a registration carries a
`userId`, keeping the row in a second database is indefensible.

**The tradeoff, stated once so it is a deliberate choice:** `/ai-workshop` is a
cold-traffic lead magnet. Today the form is five fields and zero friction. Putting Google
sign-in in front of it will measurably reduce top-of-funnel signups — that is the known
cost of the identity you are buying. The design below minimises it (the marketing page
stays fully public and anonymous; the gate sits only on the submit step), but it does not
eliminate it.

**If you later want to reverse the gate** without unwinding the migration: `userId` is
nullable by design, so dropping the `auth()` check in the action and re-opening the
anonymous form is a ~10-line change. The schema supports both modes. This is why the
column is nullable rather than required — it is not an oversight.

**What you gain:** workshop attendees become real `User` rows, so a workshop signup can be
joined to challenge enrollment, hackathon participation, and certificates. Today a
workshop attendee who later joins the 60-day challenge is two unrelated records.

## 3. Current behavior

- **Storage:** one Supabase table *per event*, so a repeat attendee is never blocked by
  another event's unique-email constraint
  ([events-data.ts:29](src/components/workshop/events-data.ts#L29)).
  - `registrations` — the original event (`ai-workshop-live`, 2026-07-18)
  - `registrations-AIW-15Aug` — current live event (`uiux-ai-workshop`, 2026-08-01)
  - `workshop_config` — singleton: `zoom_link`, `whatsapp_link`, `webinar_date`,
    `webinar_time`, `webinar_target_utc`
- **Write path:** `POST /api/ai-workshop/register`
  ([route.ts](src/app/api/ai-workshop/register/route.ts)) — **no auth at all**. Zod-parses
  name/email/phone/role/organization, resolves the target table server-side from
  `getRegistrableEvent(istTodayKey())` (a forged event id can't redirect the write), and
  relies on the table's unique-email constraint for duplicates because RLS gives anon
  insert-only access. Sends a Brevo confirmation email; a mail failure is logged and
  swallowed, never failing the request.
- **Read paths:** `getWorkshopConfig()` (page + email), `getRecentRegistrations()`
  (social-proof ticker, name + org only). Both fail soft — config falls back to a hardcoded
  constant, ticker falls back to `[]` then sample data.
- **Client:** [RegistrationForm.tsx](src/components/workshop/RegistrationForm.tsx) — client
  component, `fetch()` to the API route, confetti success modal, 3-second countdown then
  redirect to WhatsApp.
- **`User.email` is `String @unique` and non-nullable**
  ([schema.prisma:254](prisma/schema.prisma#L254)) — so email→user backfill is a clean 1:1
  join *where a match exists*.

### The critical difference from plan 045

Hackathon registration was **already session-gated** when it migrated, so every
participant email resolved to a `User` and the script could safely **abort on any
unmatched row**.

Workshop registration has **never** been gated. Expect **most or all** existing rows to
have no matching `User`. Therefore:

> **The workshop migration must NOT abort on unmatched emails.** `userId` is nullable,
> unmatched rows migrate with `userId = null`, and the script reports the matched /
> unmatched split. Copying plan 045's abort-on-unmatched rule here would abort on
> essentially every row.

## 4. Files to touch

### Schema + migration

| Path | New/Edit | Note |
|---|---|---|
| `prisma/schema.prisma` | `[edit]` | Add `WorkshopRegistration` + `WorkshopConfig` models, `User.workshopRegistrations` back-relation. |
| `scripts/migrate-workshop-to-neon.ts` | `[new]` | One-off, idempotent, table→eventId mapped, best-effort user linking. |
| `package.json` | `[edit]` | Add `workshop:migrate` + `workshop:verify` scripts. |

### Data layer

| Path | New/Edit | Note |
|---|---|---|
| `src/features/workshop/get-workshop-config.ts` | `[new]` | `getWorkshopConfig()` — Prisma, same fallback. |
| `src/features/workshop/get-recent-registrations.ts` | `[new]` | `getRecentRegistrations(eventId)` + `RecentRegistrant` type. |
| `src/features/workshop/registration-status.ts` | `[new]` | `getMyRegistration(userId, eventId)`. |
| `src/features/workshop/get-admin-data.ts` | `[new]` | Per-event roster + stats for `/admin/workshop`. |
| `src/lib/workshop-supabase.ts` | `[edit]` | **Shrink, do not delete.** Remove `getWorkshopConfig`, `getRecentRegistrations`, `WorkshopConfig`, `RecentRegistrant`. Keep `workshopSupabase`, `CohortRegion`, `CohortApplicationRow`, `getCohortApplications`. |

### Write path (API route → Server Action)

| Path | New/Edit | Note |
|---|---|---|
| `src/app/actions/workshop-actions.ts` | `[new]` | `submitWorkshopRegistrationAction` — `auth()`-gated, Prisma, result envelope. |
| `src/app/api/ai-workshop/register/route.ts` | `[delete]` | Replaced by the action (CLAUDE.md: mutations via Server Actions). |

### UI

| Path | New/Edit | Note |
|---|---|---|
| `src/app/ai-workshop/page.tsx` | `[edit]` | Import config from `@/features/workshop`; `await auth()`; pass serializable session summary to the form. |
| `src/components/workshop/RegistrationForm.tsx` | `[edit]` | **Client.** Signed-out → sign-in CTA. Signed-in → form with locked email. `fetch` → action call. |
| `src/components/workshop/SocialProof.tsx` | `[edit]` | Import `RecentRegistrant` from `@/features/workshop/get-recent-registrations`. |
| `src/components/workshop/events-data.ts` | `[edit]` | `registrationTable?: string` → `registrationOpen?: boolean`; `event.id` becomes the `eventId`. |

### Admin

| Path | New/Edit | Note |
|---|---|---|
| `src/app/admin/workshop/page.tsx` | `[new]` | Server Component, `await requireAdmin()` first line. Per-event tabs (same `?event=` pattern as `/admin/ai-cohort?region=`). |
| `src/components/admin/workshop-registrations-view.tsx` | `[new]` | **Client** — table + CSV export via `lib/csv.ts`. |
| `src/app/admin/layout.tsx` | `[edit]` | Add `{ href: "/admin/workshop", label: "Workshop", icon: "workshop" as const }`. |
| `src/components/admin/admin-sidebar.tsx` | `[edit]` | Add `"workshop"` to `IconName` **and** `iconMap`. |
| `src/components/admin/admin-mobile-nav.tsx` | `[edit]` | **Same edit again — separate second icon map. Missing this breaks the build.** |

**Not touched:** `middleware.ts`, `auth.ts`, `auth.config.ts`,
`src/app/actions/cohort-application-actions.ts`,
`src/app/actions/cohort-application-india-actions.ts`, `src/app/admin/ai-cohort/`,
`src/components/admin/cohort-applications-view.tsx`, `/ai-cohort-register`,
`src/lib/workshop-email.ts`, `src/components/ui/`.

## 5. Prisma schema

```prisma
/// Workshop / webinar signup. One row per (event, person).
/// `eventId` matches WorkshopEvent.id in src/components/workshop/events-data.ts —
/// events stay code-defined (they carry copy and Lucide icons), only signups are in the DB.
model WorkshopRegistration {
  id           String   @id @default(cuid())
  eventId      String
  /// Null for rows migrated from the pre-auth Supabase era, and for any future
  /// anonymous mode. Every registration created after this migration has one.
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

/// Singleton (id always 1) — Zoom / WhatsApp links shown on /ai-workshop and in the
/// confirmation email. Was the Supabase `workshop_config` table.
model WorkshopConfig {
  id               Int      @id @default(1)
  zoomLink         String
  whatsappLink     String
  webinarDate      String
  webinarTime      String
  webinarTargetUtc String
  updatedAt        DateTime @updatedAt
}
```

On `model User`, add the back-relation next to `hackathonParticipant`:
```prisma
  workshopRegistrations WorkshopRegistration[]
```

**Design notes (deliberate — do not "simplify"):**
- **`@@unique([eventId, email])`** reproduces the old per-table unique-email constraint
  exactly. It is what makes per-event tables unnecessary: a repeat attendee registers again
  for a different `eventId` without conflict. **This is the constraint that replaces the
  whole per-event-table scheme — do not drop it.**
- **`@@unique([eventId, userId])`** is the auth-era duplicate guard. Postgres treats NULLs
  as distinct, so the many legacy `userId = null` rows do not collide with each other.
  Both constraints coexist intentionally.
- **`userId` nullable** — required for the legacy rows (see §3) and it is the escape hatch
  described in §2. **Do not make it required.**
- **`email` kept alongside `userId`** — a snapshot of what they registered with, used for
  CSV export and the confirmation email without a join. It may diverge from `User.email`
  later; that is intended, same as `HackathonParticipant.email`.
- Events stay in `events-data.ts`, **not** in a DB table. They hold marketing copy and
  `LucideIcon` component references, which cannot cross the Server→Client boundary and do
  not belong in Postgres. Only signups move.
- `WorkshopRegistration` is a plain `String` `role`, not an enum — the form offers
  "Student" / "Professional" but this is free-form lead data, and the existing rows are
  strings. Do not introduce an enum and do not reuse `UserType`.

## 6. DB safety (schema change — mandatory before any of §7)

1. `git add -A && git commit -m "checkpoint before workshop Neon migration"` — **note the
   commit hash.**
2. **Create a Neon branch snapshot** of the current database (CLAUDE.md §17).
3. **Export both Supabase tables + `workshop_config` to CSV** from the Supabase UI as a
   second, independent backup. Keep these files until well after cutover.

### Migration command — resolve this before running

There is a **known conflict** between two rules in this repo:
- Plan `045` says: use `prisma migrate dev`, never `db push`.
- The Neon migration-drift workaround established since then says: use `prisma db push`,
  never `migrate reset`.

**Both models here are purely additive** (two new tables, one new back-relation, zero
changes to existing tables), so either is safe. **Default to `npx prisma db push` +
`npx prisma generate`**, consistent with the current drift workaround. If the migration
history has since been repaired, prefer `npx prisma migrate dev --name workshop_tables`.
**Under no circumstances run `prisma migrate reset`.** Confirm which one applies before
touching the production database.

## 7. Steps

### Step 1 — Schema

Add the two models + back-relation from §5. Apply per §6. This creates two empty tables
and touches nothing existing — safe to deploy while the Supabase-backed site is still live.

### Step 2 — `scripts/migrate-workshop-to-neon.ts` `[new]`

One-off Node script run with `tsx`, same shape as `prisma/cleanup.ts`.

1. Reads `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL`.
   (The anon key is insert-only under RLS and **cannot read the rows** — the service-role
   key is required. If it is no longer available, fall back to importing the §6 CSV
   exports; support a `--from-csv <dir>` flag for that path.)
2. **Table → eventId map, hardcoded at the top of the script:**
   ```ts
   const TABLE_TO_EVENT_ID = {
     "registrations":            "ai-workshop-live",
     "registrations-AIW-15Aug":  "uiux-ai-workshop",
   } as const;
   ```
   **Verify this mapping against Supabase before running.** `registrations` is the
   original un-suffixed table and is assumed to be the 2026-07-18 event. If Supabase holds
   any other `registrations*` table, stop and get the mapping confirmed — a wrong mapping
   files people under the wrong event and is not silently detectable afterwards.
3. Fetches **all** rows from each table (no `.limit()` — page in batches of 1000).
4. **Pre-flight resolve, before writing anything:** for each row, look up
   `prisma.user.findUnique({ where: { email: row.email.toLowerCase() }, select: { id: true } })`.
   Build `Map<rowId, userId | null>`.
   - **Unmatched is NORMAL and must NOT abort** — registration was never gated. Count them.
   - **Do abort** if two rows in the *same* `eventId` resolve to the same `userId`, or if
     two rows in the same event share an email after lowercasing (would violate the unique
     constraints). Print both rows and exit non-zero — that needs a human decision.
5. Writes in a single `prisma.$transaction`, per table:
   - Insert each registration with mapped `eventId`, resolved `userId` (or null), and
     **original `created_at` preserved** into `createdAt`. Lowercase the email on write.
   - Upsert `WorkshopConfig` id 1 from the Supabase `workshop_config` row.
6. **Idempotent:** at start, if `prisma.workshopRegistration.count() > 0`, print counts and
   exit 0 without writing. Re-running must never duplicate.
7. Prints a summary per table: rows read, rows written, **matched to a User**, **unmatched
   (userId null)**, and config migrated y/n.

### Step 3 — `package.json` `[edit]`

```json
"workshop:migrate": "tsx scripts/migrate-workshop-to-neon.ts",
"workshop:verify":  "tsx scripts/migrate-workshop-to-neon.ts --verify"
```
`--verify` is **read-only**: per-table row counts and a both-directions set-diff of emails
between Supabase and Neon. Exits non-zero on any mismatch.

### Step 4 — `src/features/workshop/*` `[new]`

Port with the **same return shapes** so components need no prop changes. Always `select`,
never return full records.

- `getWorkshopConfig()` — `prisma.workshopConfig.findUnique({ where: { id: 1 }, select: {...} })`.
  **Keep the exact `FALLBACK_CONFIG` object and the fail-soft `try/catch → fallback`
  behavior** from [workshop-supabase.ts:16](src/lib/workshop-supabase.ts#L16). The
  `/ai-workshop` page must never 500 because the config row is missing.
- `getRecentRegistrations(eventId: string)` — now **scoped to one event** (previously it
  read the un-scoped `registrations` table). Ordered `createdAt` desc, take 20,
  `select: { name: true, organization: true }` only — **never** email or phone, this feeds
  a public ticker. Same first-name-only mapping. Fail-soft `→ []`. Export the
  `RecentRegistrant` interface from here.
- `getMyRegistration(userId, eventId)` — `findUnique` on `@@unique([eventId, userId])`,
  select `id, name, createdAt`. Used to show "You're already registered" instead of the
  form. Fail-soft `→ null`.
- `getAdminData(eventId)` — full roster (all fields, admin context) + total count.

### Step 5 — `src/components/workshop/events-data.ts` `[edit]`

- Replace `registrationTable?: string` with `registrationOpen?: boolean`, and delete the
  "Supabase table" doc comment (the injection warning it carries no longer applies — the
  value is no longer used as an identifier).
- `getRegistrableEvent(todayKey)` becomes
  `upcomingEvents(todayKey).find((e) => e.register && e.registrationOpen)`.
  Set `registrationOpen: true` on `uiux-ai-workshop` (which currently has `register: true`
  + `registrationTable`).
- **Keep the server-side event resolution rule intact:** the action must still derive the
  event from `getRegistrableEvent(istTodayKey())` and must **never** accept an `eventId`
  from the client. This was a deliberate anti-forgery measure
  ([route.ts:41](src/app/api/ai-workshop/register/route.ts#L41)) and it still matters.

### Step 6 — `src/app/actions/workshop-actions.ts` `[new]` — the auth gate

```ts
"use server";
```

`submitWorkshopRegistrationAction(input)`:

1. `const session = await auth();`
   **If no `session?.user?.id`:** return
   `{ ok: false, message: "Please sign in to reserve your seat." }`. This is the gate.
2. Zod-parse `{ phone, role, organization }` plus an optional `name` override.
   `phone: z.string().trim().min(1)`, `role: z.string().trim().min(1)`,
   `organization: z.string().trim().min(1).nullish()`.
   **`email` comes from `session.user.email`, never from the client** — same rule as
   `submitHackathonRegistrationAction`.
3. Resolve the event: `getRegistrableEvent(istTodayKey())`. If none →
   `{ ok: false, message: "Registration is closed right now. Check back soon!" }`.
4. `prisma.workshopRegistration.create({ data: { eventId: event.id, userId: session.user.id, name, email, phone, role, organization: organization || null }, select: { id: true } })`.
   Catch Prisma **`P2002`** (either unique constraint) → return the existing duplicate
   message verbatim:
   `"You've already registered. Please check your email for the webinar details."`
   This replaces the Postgres `23505` check — same behavior, Prisma error code.
5. **Confirmation email — preserve the existing semantics exactly.** Wrap
   `sendWorkshopConfirmationEmail` in its own `try/catch`; log via `logger.error` and
   **swallow**. The row is already saved; a Brevo outage must never fail the request or
   show the user an error. Keep the merge of `getWorkshopConfig()` with the event's own
   `fullDate(event.date)` / `event.time`.
6. Return `{ ok: true, data: { whatsappLink } }` so the client can redirect.

Then **delete `src/app/api/ai-workshop/register/route.ts`.**

### Step 7 — `src/app/ai-workshop/page.tsx` `[edit]` — Server Component

- `getWorkshopConfig` now from `@/features/workshop/get-workshop-config`.
- `const session = await auth();`
- Resolve `const event = getRegistrableEvent(istTodayKey())`, and if signed in,
  `getMyRegistration(session.user.id, event.id)`.
- **Server→Client boundary:** pass only primitives to `RegistrationForm` —
  `isSignedIn: boolean`, `sessionEmail: string | null`, `sessionName: string | null`,
  `alreadyRegistered: boolean`, `whatsappLink: string`. **Never pass the session object,
  a Lucide icon, or a `WorkshopEvent`** (it carries `Icon: LucideIcon`).
- **The page itself stays public.** Do **not** add `/ai-workshop` to `protectedPaths` in
  `middleware.ts` — the marketing page, countdown, ticker and event list must remain
  visible to logged-out cold traffic. The gate lives in the form section only.

### Step 8 — `src/components/workshop/RegistrationForm.tsx` `[edit]` — Client

Three states inside the existing glass card — **keep the card, the `.wk-input` styles, the
confetti modal, and the WhatsApp countdown exactly as they are.** Per the standing
preference, this is a state swap inside the existing shell, not a visual redesign.

1. **`alreadyRegistered`** → replace the fields with a short confirmed panel
   ("You're registered" + a WhatsApp link). No form.
2. **Signed out** → keep the heading and subtitle, replace the fields with a single
   "Continue with Google to reserve your seat" button linking to
   `/login?from=%2Fai-workshop%23register`, plus one line of reassurance
   ("Takes a few seconds — we use it to confirm your seat."). Use `buttonVariants` on a
   `<Link>` if you use the shared button, **never `<Button asChild>`** — or just keep the
   existing `.register-btn` class on an `<a>`, which is simpler here and stays on-brand
   with the microsite's dark palette.
3. **Signed in** → the current form, with:
   - Email field **rendered read-only / disabled**, prefilled from `sessionEmail`, with a
     small "signed in as" note. It is not submitted; the server uses the session.
   - Name prefilled from `sessionName`, still editable.
   - Phone, role, organization unchanged, including the country-code select.
   - `handleSubmit` calls `submitWorkshopRegistrationAction` instead of `fetch`, wrapped in
     `useTransition`. On `{ ok: false }` set `apiError` to `message`; on `{ ok: true }` run
     the existing success modal + countdown path unchanged.
   - Drop the client-side email validation branch (email is no longer user input); keep
     name / phone / role validation.

**Known UX seam, accept or handle deliberately:** `/login` is the ABTalks-branded page and
is visually nothing like the dark `/ai-workshop` microsite, so the sign-in bounce is
jarring. Acceptable for v1. If you want it smoother later, that is a separate change to
`/login` (accept a `from` param and render a lighter workshop-styled variant) — **do not
build that in this plan.**

### Step 9 — `SocialProof.tsx` `[edit]`

Change the `RecentRegistrant` import to
`@/features/workshop/get-recent-registrations`. Type-only import; no other change. Keep
the `FALLBACK` sample array.

### Step 10 — Admin

- `src/app/admin/workshop/page.tsx` — `await requireAdmin()` as the first line. Read
  `searchParams.event`, default to the current registrable event, and render tabs over the
  events that have registrations — **mirror the existing
  [`/admin/ai-cohort` region-tabs pattern](src/app/admin/ai-cohort/page.tsx) exactly**
  (`<Link href="?event=...">` + the same active-tab gradient classes). Show total count in
  the subheading.
- `workshop-registrations-view.tsx` — Client. Table: name, email, phone, role,
  organization, linked-account indicator (userId null vs set), registered-at. "Export CSV"
  using the existing `toCSV` + `downloadCSV` from [lib/csv.ts](src/lib/csv.ts). Contact
  details are appropriate here — this is admin context.
- Nav: add the item to [admin/layout.tsx](src/app/admin/layout.tsx), and add `"workshop"`
  to the `IconName` union **and** `iconMap` in **both**
  [admin-sidebar.tsx](src/components/admin/admin-sidebar.tsx#L19) **and**
  [admin-mobile-nav.tsx](src/components/admin/admin-mobile-nav.tsx). They are two separate
  copies. Suggested icon: `Presentation` or `Video` from lucide-react (`GraduationCap` and
  `Code2` are already taken).

### Step 11 — `src/lib/workshop-supabase.ts` `[edit]` — shrink, do not delete

Remove `WorkshopConfig`, `FALLBACK_CONFIG`, `getWorkshopConfig`, `RecentRegistrant`,
`getRecentRegistrations`. **Keep** `workshopSupabase`, `CohortRegion`,
`CohortApplicationRow`, `getCohortApplications` — the cohort tables are out of scope and
`/admin/ai-cohort` still depends on them.

## 8. Cutover sequence (live data — short freeze)

Do **not** dual-write. A brief freeze is simpler and safer at this scale.

1. Set `registrationOpen: false` on `uiux-ai-workshop` in `events-data.ts` → deploy. The
   API route already returns the "Registration is closed right now" 503 when no event
   resolves.
2. Wait ~1 minute for in-flight requests to settle.
3. `npm run workshop:migrate` against the **production** `DATABASE_URL`.
4. `npm run workshop:verify` — must exit 0 with matching counts.
5. Deploy the full code switch (Steps 4–11) with `registrationOpen: true` restored.
6. Smoke-test on production per §10.
7. **Leave the Supabase tables in place, untouched, for at least 7 days** as the rollback
   path. Dropping them is a separate change.

**Rollback:** revert to the §6 checkpoint commit and redeploy. The Supabase tables are
still authoritative and untouched — the migration only ever *reads* from Supabase.

## 9. Guardrails for Cursor (DO NOT)

- **DO NOT** abort the migration script on an unmatched email. Unlike the hackathon
  migration, unmatched is the *expected* case here — migrate the row with `userId = null`
  and report the count. Aborting would abort on nearly every row.
- **DO NOT** make `WorkshopRegistration.userId` required, and do not add
  `onDelete: Cascade` semantics that would drop lead data — the relation is optional by
  design.
- **DO NOT** drop `@@unique([eventId, email])`. It is what replaces the per-event tables.
- **DO NOT** invent a `WorkshopEvent` DB table or move `EVENTS` out of `events-data.ts`.
  Events carry `LucideIcon` references and marketing copy; only signups migrate.
- **DO NOT** accept `eventId` or `email` from the client in the action. The event comes
  from `getRegistrableEvent(istTodayKey())`; the email comes from `session.user.email`.
- **DO NOT** add `/ai-workshop` to `protectedPaths` in `middleware.ts`. The marketing page
  stays public; only the submit path is gated. Middleware must stay edge-safe — **no
  `@/lib/*` or `@/features/*` imports there.**
- **DO NOT** touch `cohort-application-actions.ts`,
  `cohort-application-india-actions.ts`, `/admin/ai-cohort`,
  `cohort-applications-view.tsx`, or `/ai-cohort-register`. Cohort stays on Supabase.
- **DO NOT** delete `src/lib/workshop-supabase.ts` or remove `@supabase/supabase-js` from
  `package.json` — the cohort helpers still live there.
- **DO NOT** drop the Supabase workshop tables or remove `SUPABASE_SERVICE_ROLE_KEY` until
  `workshop:verify` passes on production and the smoke test is done.
- **DO NOT** run `prisma migrate reset` — ever. See §6 on `db push` vs `migrate dev`.
- **DO NOT** make the confirmation-email failure fail the request. It is caught, logged via
  `logger`, and swallowed. Preserve that.
- **DO NOT** change any user-facing message string carried over from the API route — the
  duplicate, closed-registration, and generic-failure copy is reused verbatim.
- **DO NOT** select or expose `email` / `phone` in `getRecentRegistrations`. That feeds a
  public ticker: first name + organization only.
- **DO NOT** redesign the registration card, the confetti modal, or the WhatsApp countdown.
  This is a state swap inside the existing shell.
- **DO NOT** forget the **second** icon map in `admin-mobile-nav.tsx`.
- **DO NOT** return full Prisma records — always `select`. No `any`, no `console.*` (use
  `logger`), Zod at every boundary, result envelope everywhere.

## 10. Verification

**Build/typecheck:**
```
npx tsc --noEmit
npm run build
```

**Greps:**
```
grep -rn "workshop-supabase" src/          # ONLY cohort files + admin/ai-cohort remain
grep -rn "registrationTable" src/          # zero hits
grep -rn "api/ai-workshop" src/            # zero hits (route deleted, form uses the action)
grep -rn "cohort_applications" src/        # UNCHANGED — still Supabase
```

**Data integrity:**
```
npm run workshop:verify     # must exit 0
```
Then in Neon / Prisma Studio confirm:
- `WorkshopRegistration` count == sum of both Supabase table counts.
- Both-directions email set-diff per `eventId` is empty.
- Every row has an `eventId` in `{ "ai-workshop-live", "uiux-ai-workshop" }`:
  `SELECT DISTINCT "eventId" FROM "WorkshopRegistration";`
- No duplicate email within an event:
  `SELECT "eventId", lower(email), COUNT(*) FROM "WorkshopRegistration" GROUP BY 1,2 HAVING COUNT(*) > 1;`
  → zero rows.
- Every non-null `userId` resolves to a real `User`.
- `WorkshopConfig` has exactly one row (id 1) with all five values preserved.
- `createdAt` values match the Supabase `created_at` (spot-check the oldest and newest row
  in each table).

**Manual test script (production, post-cutover):**
1. **Logged out**, open `/ai-workshop` → page renders fully: countdown, topics, events,
   social-proof ticker. Form section shows the sign-in CTA, no fields.
2. Click it → lands on `/login`, sign in with Google → returns to `/ai-workshop`, form
   section now shows the fields with email locked to the Google account.
3. Submit → success modal, confetti, 3-second countdown, WhatsApp redirect. Confirmation
   email arrives (check Promotions/Spam).
4. Reload `/ai-workshop` while signed in → "You're registered" panel, not the form.
5. Submit again via a direct action call → duplicate message, exactly one row in the DB.
6. Ticker shows the new registration (first name + org only — confirm no email/phone in the
   page source).
7. A **migrated legacy registrant** signing in with the same Google email and hitting
   `/ai-workshop` → because legacy rows have `userId = null`, they will see the form, not
   the registered panel, and submitting will hit `@@unique([eventId, email])` and show the
   duplicate message. **This is expected and correct** (no data loss, no double row) — see
   §11 if you want it to be friendlier.
8. Set `registrationOpen: false` → form section shows the closed state; the action refuses.
9. **Admin:** `/admin/workshop` lists both events' rosters, tabs switch, CSV exports,
   linked-account column shows null for legacy rows.
10. Non-admin hitting `/admin/workshop` → redirected to `/dashboard`.
11. **`/admin/ai-cohort` still works unchanged** — both region tabs load from Supabase.

**Expected changed files** — exactly the §4 lists, plus (if using `migrate dev`)
`prisma/migrations/<timestamp>_workshop_tables/`. Anything touching cohort files,
`middleware.ts`, `auth.ts`, `auth.config.ts`, or `src/components/ui/` means Cursor went
off-plan.

## 11. Commit message

```
refactor(workshop): migrate registrations to Neon/Prisma and gate behind auth

Workshop signups lived in a separate Supabase instance with one table per event,
joined to nothing — no FK to User, no transactions, no Neon branch snapshot
coverage, and an RLS service key one bad import from the client bundle.

Adds WorkshopRegistration (unique per event+email and per event+userId) and
WorkshopConfig models, migrating every existing row with created_at and email
preserved and linking to a User where one exists by email. Registration now
requires an Auth.js session: the /ai-workshop marketing page stays public, but
the form itself requires Google sign-in and takes the email from the session.
The API route is replaced by a Server Action.

userId is intentionally nullable: pre-auth rows have no account, and it keeps
re-opening anonymous registration a small change.

Cohort application tables remain on Supabase and are untouched.
```

## 12. Follow-ups (not in this plan)

- **Backfill legacy rows** — a one-off script linking `userId` on `userId IS NULL` rows
  whose email now matches a `User`, so migrated attendees who later create an account get
  the "already registered" panel (test 7 above). Cheap, but it needs the accounts to exist
  first.
- **Drop the Supabase workshop tables** — separate change, ≥7 days after a verified
  cutover.
- **Migrate the cohort application tables** — would let you delete
  `workshop-supabase.ts` and `@supabase/supabase-js` entirely. Explicitly deferred.
- **Source attribution** (`sourceSlug` from the `abtalks_src` cookie, as
  `HackathonParticipant` has) — worth adding for workshop funnel tracking; deliberately
  left out here to keep the migration tight.
- **Workshop-styled sign-in bounce** — see the Step 8 UX seam.
- Surfacing workshop attendance on the student profile / admin student detail — now a
  trivial join thanks to the FK.
