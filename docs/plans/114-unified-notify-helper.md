# 114 — Unified notify helper: one call, in-app + email, preference-aware

## 1. Goal

Add one shared helper, `notifyUser()`, that delivers a notification to a single
user **in-app and by email in one call**, skipping the email when that user has
turned emails off. Today only admin broadcasts exist and there is no way to
notify one person, no per-user notification storage, and no email preference at
all. Also extend the existing bell to recruiters (`/talent`, `/hire`) with a
recruiter-only audience.

---

## 2. Current behavior

### The broadcast path (works)

- `/admin/notifications` → `NotificationComposer` (client) → `createNotificationAction`
  (`src/app/actions/admin-notification-actions.ts:41`) → `prisma.notification.create`
  inside a `$transaction` that also writes an `AdminAction` audit row.
- **One `Notification` row is read by many users.** There is no fan-out and no
  per-recipient row anywhere. Targeting happens at read time in
  `src/features/notification/get-notifications.ts:106-114`, which builds a `Set`
  of the caller's audiences from their memberships and filters rows by
  `Notification.audience`.
- `NotificationCategory` (`GENERAL WORKSHOP HACKATHON COHORT CHALLENGE`) is
  **presentation only** — it picks a Lucide icon in
  `notification-provider.tsx:191-197`. Nothing branches on it.
- `NotificationAudience` (`ALL CHALLENGE PROGRAM HACKATHON`) is the targeting
  dimension.
- **The only stable identity is a string key, synthesised at read time**, never
  stored: `` `admin:${row.id}` `` (`get-notifications.ts:116`). Derived items use
  `workshop:<eventId>`, `hackathon:kickoff`, `cohort:<id>:enrolling`.
  `NotificationRead.notificationKey` stores that key and is deliberately not an
  FK, because derived notifications have no row.
- Feed is capped at `FEED_LIMIT = 5` with a 14-day `ANNOUNCEMENT_MAX_AGE_DAYS`
  cutoff on admin rows (`get-notifications.ts:17,32`).
- Client: `NotificationProvider` (root layout) fetches lazily on first bell
  mount, caches in `sessionStorage` for 60s, marks everything read optimistically
  on open.

### Email (works, one door — mostly)

- `sendEmail` in `src/lib/email.ts:32` — Brevo transactional.
  `{ to, subject, html, text, attachments? } → { ok: true } | { ok: false; skipped? }`.
  Already guards missing `BREVO_API_KEY` and refuses `@abtalks.dev` seed
  addresses.
- Five callers: `contact-actions.ts:38`, `admin-recruiter-actions.ts:108,156`,
  `recruiter-auth-actions.ts:38`, `run-hire-alerts.ts:109`,
  `notify-data-request.ts:31`.
- Three files bypass it with their own `BrevoClient` — `lib/workshop-email.ts:9`,
  `lib/hackathon-email.ts:10`, `features/email/challenge-reset-email.ts:150`.
  **Out of scope here; do not touch them, and do not copy them.**

### Preferences (do not exist)

- No `emailNotif*`, `notifyByEmail`, `notificationPref` anywhere in schema or
  `src/`. `CandidatePreference` is job preferences (salary, openToWork) —
  unrelated.
- `NewsletterSubscription` (`schema.prisma:410`) is *marketing* consent, keyed on
  `email` not `userId`, written by `recordNewsletterOptIn` and **read by
  nothing**. No unsubscribe route or token exists.

### Recruiters (nothing wired)

- `NotificationBellButton` is mounted in exactly three places:
  `app-header.tsx:150`, `dashboard-hub/dashboard-header.tsx:97`,
  `workshop/Header.tsx:51`.
- Recruiter shells render their own headers with no bell: `TalentShell`
  (`src/components/talent/talent-shell.tsx:37`) and `HireChrome`
  (`src/components/hire/hire-chrome.tsx:83`).
- Recruiter identity is `RecruiterProfile.approved`, read via `getRecruiterState`
  (`src/features/talent-pool/recruiter-registration.ts:70`). `UserRoleAssignment`
  / `PlatformRole.RECRUITER` exist but are **not** the authoritative read path —
  do not use them here.

---

## 3. Decisions made before this plan (do not relitigate)

1. **One global email switch**, not per-category. `NotificationPreference.emailEnabled`.
2. **Separate from `NewsletterSubscription`.** That table is marketing consent
   keyed by address; unsubscribing from a newsletter must not silence
   "your submission was approved". Leave it untouched.
3. **Real per-user rows.** New `UserNotification` model with genuine fan-out —
   one row per recipient.
4. **Read state for personal rows lives on the row itself** (`readAt`), not in
   `NotificationRead`. `NotificationRead` exists because derived items have no
   row to stamp; a personal notification *is* a row, so writing a second row to
   record that you read your own row is waste. `markNotificationsReadAction`
   branches on the `user:` key prefix.
5. **Recruiters see `RECRUITER` + `ALL`.** `ALL` means all. Student-track
   announcements should be sent with audience `CHALLENGE`/`PROGRAM`, not `ALL` —
   that is an editorial discipline, not a code change. If this proves wrong in
   practice, the fix is one line in step 5c (drop `"ALL"` from the seed `Set`
   when the user is an approved recruiter with no learner membership); do not
   pre-build that.
6. **Email is sent after the DB write commits, never inside a transaction.**

---

## 4. Files to touch

| File | | Note |
|---|---|---|
| `prisma/schema.prisma` | `[edit]` | `RECRUITER` on `NotificationAudience`; new `UserNotification` + `NotificationPreference` models; two `User` back-relations |
| `src/features/notification/types.ts` | `[edit]` | `NotificationEventKey` union; extend `AppNotification` with `isPersonal` |
| `src/features/notification/notify.ts` | `[new]` | **the shared helper** — `notifyUser()` |
| `src/features/notification/preferences.ts` | `[new]` | read/write `NotificationPreference`; `unsubscribeToken` / `verifyUnsubscribeToken` |
| `src/features/email/notification-email.ts` | `[new]` | `{ subject, html, text }` builder |
| `src/features/notification/get-notifications.ts` | `[edit]` | fetch personal rows; recruiter audience; merge + new caps |
| `src/app/actions/notification-actions.ts` | `[edit]` | `markNotificationsReadAction` branches on `user:` prefix |
| `src/app/actions/notification-preference-actions.ts` | `[new]` | `setEmailNotificationsAction` (session **or** token) |
| `src/app/settings/notifications/page.tsx` | `[new]` | Server Component — the toggle, and the email unsubscribe landing |
| `src/components/settings/email-notifications-toggle.tsx` | `[new]` | Client Component — the switch |
| `src/app/actions/admin-notification-actions.ts` | `[edit]` | add `RECRUITER` to `audienceEnum` |
| `src/components/admin/notification-composer.tsx` | `[edit]` | add the `RECRUITER` option |
| `src/components/talent/talent-shell.tsx` | `[edit]` | mount `NotificationBellButton` |
| `src/components/hire/hire-chrome.tsx` | `[edit]` | mount `NotificationBellButton` |

**No other files.** In particular: do not touch `notification-provider.tsx`
(the client already renders whatever the feed returns), `admin-data.ts`,
`derive-event-notifications.ts`, `record-newsletter-optin.ts`, or any of the
three legacy Brevo files.

---

## 5. Server vs Client

| Component | Boundary | Notes |
|---|---|---|
| `src/app/settings/notifications/page.tsx` | **Server** | reads session + preference, passes plain booleans/strings down |
| `email-notifications-toggle.tsx` | **Client** (`"use client"`) | receives `{ enabled: boolean; token: string \| null }` — primitives only |
| `talent-shell.tsx` | already Client — verify the `"use client"` at its top before editing | `NotificationBellButton` is a Client Component; it can be rendered from either side, but must not receive an icon or function prop |
| `hire-chrome.tsx` | already Client — same check | same |
| `notification-composer.tsx` | Client | only the `audiences` const array changes |
| everything in `features/notification/` and `features/email/` | **Server only** | every new file starts with `import "server-only";` |

**Server→Client props crossing the boundary in this plan:** only `boolean`,
`string`, `string | null`. No functions, no Lucide icons, no Date objects, no
Prisma model instances. The existing feed already serialises `publishedAt` to an
ISO string — keep that for personal rows too.

---

## 6. Steps

### 6a. `prisma/schema.prisma` `[edit]`

Add `RECRUITER` to the existing enum (append — enum order is cosmetic but keep
it last so existing values keep their positions):

```prisma
enum NotificationAudience {
  ALL
  CHALLENGE
  PROGRAM
  HACKATHON
  RECRUITER
}
```

Add two models. Place them directly after `model NotificationRead` so the
notification block stays together.

```prisma
/// One row per recipient — the fan-out counterpart to `Notification`, which is
/// a single row read by many. Personal notifications ("your submission was
/// approved") have no audience: they have an owner.
///
/// `readAt` lives here rather than in `NotificationRead` on purpose. That table
/// exists because derived notifications have no row to stamp; this IS a row, so
/// a second row recording that you read your own row is pure waste.
model UserNotification {
  id        String               @id @default(cuid())
  userId    String
  /// Stable machine key for what happened ("submission.approved"). This is the
  /// notification TYPE the broadcast model never had — category is icons only.
  eventKey  String
  title     String
  body      String?
  /// Internal path ("/dashboard") or absolute URL. Optional.
  href      String?
  category  NotificationCategory @default(GENERAL)
  createdAt DateTime             @default(now())
  readAt    DateTime?
  /// Set when the email half actually went out. Null = in-app only (preference
  /// off, no address, or send failed). Diagnostic, never a resend queue.
  emailedAt DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt(sort: Desc)])
  @@index([userId, readAt])
}

/// Per-user delivery settings. One global switch by design: a per-category
/// matrix is a settings screen nobody tunes and four ways for a message to go
/// missing. Deliberately NOT NewsletterSubscription — that is marketing consent
/// keyed by email address, and unsubscribing from a newsletter must not silence
/// "your submission was approved".
///
/// Absent row = emails ON. Never require a row to exist before sending.
model NotificationPreference {
  id           String   @id @default(cuid())
  userId       String   @unique
  emailEnabled Boolean  @default(true)
  updatedAt    DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

On `model User`, next to the existing `notificationReads NotificationRead[]`
(schema.prisma:319), add:

```prisma
  userNotifications      UserNotification[]
  notificationPreference NotificationPreference?
```

### 6b. `src/features/notification/types.ts` `[edit]`

Add the event-key union — this is the missing "type" identifier. Start it with
exactly these three; add more only when a caller needs one:

```ts
/**
 * What happened, as a stable machine key. `category` is icons; this is meaning.
 * Never renamed once shipped — it is stored on the row and used as the
 * `user:<id>` item's provenance.
 */
export type NotificationEventKey =
  | "submission.approved"
  | "submission.rejected"
  | "admin.direct";
```

Extend `AppNotification` with one optional field so the panel can style personal
items later without another schema pass:

```ts
  /** True for `user:` items — addressed to this person, not broadcast. */
  isPersonal?: boolean;
```

Do **not** change `key`, `publishedAt` (stays an ISO string) or `EMPTY_FEED`.

### 6c. `src/features/notification/preferences.ts` `[new]`

```
import "server-only";
```

Three exports:

- `getEmailEnabled(userId: string): Promise<boolean>` —
  `prisma.notificationPreference.findUnique({ where: { userId }, select: { emailEnabled: true } })`,
  returning `row?.emailEnabled ?? true`. **Missing row means enabled.**
- `setEmailEnabled(userId: string, enabled: boolean): Promise<void>` — `upsert`
  with `select: { id: true }`.
- Unsubscribe token, using the pepper pattern already established in
  `src/features/recruiter-auth/otp.ts:26`:

```ts
export function unsubscribeToken(userId: string): string {
  return createHash("sha256")
    .update(`unsub:${userId}${process.env.AUTH_SECRET ?? ""}`)
    .digest("hex")
    .slice(0, 32);
}

export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  // timingSafeEqual on equal-length hex, same as otp.ts safeEqual
}
```

The `unsub:` prefix keeps this hash from ever colliding with the OTP hash space.

### 6d. `src/features/email/notification-email.ts` `[new]`

Pure builder, no `prisma`, no `sendEmail` — mirrors
`src/features/email/claude-welcome-email.ts:5`:

```ts
export function notificationEmail(input: {
  title: string;
  body: string | null;
  href: string | null;
  appUrl: string;
  unsubscribeUrl: string;
}): { subject: string; html: string; text: string }
```

- `subject` = `input.title` (already capped at 120 chars by the caller's Zod).
- Inline styles only, table-free, matching the `claude-welcome-email.ts` house
  style. Copy its local `LINK_STYLE` constant rather than importing it.
- `href` becomes an absolute URL: if it starts with `/`, prefix `appUrl`.
- **Every email ends with the unsubscribe line** — plain-text and HTML both:
  `You can turn these emails off: <unsubscribeUrl>`.
- Escape `title` and `body` into the HTML. Copy the four-replace `escapeHtml`
  from `run-hire-alerts.ts:135` as a local function in this file. Do **not**
  create a shared `escape-html.ts` — one duplicated 6-line function beats a new
  abstraction file.

### 6e. `src/features/notification/notify.ts` `[new]` — the helper

```
import "server-only";
```

```ts
export type NotifyInput = {
  userId: string;
  eventKey: NotificationEventKey;
  title: string;
  body?: string | null;
  href?: string | null;
  category?: NotificationCategoryKey;
  /** false = in-app only, skip email entirely regardless of preference. */
  email?: boolean;
};

export async function notifyUser(
  input: NotifyInput,
): Promise<Result<{ notificationId: string; emailed: boolean }>>;
```

Order of operations — exactly this:

1. Zod-parse `input` at the top (`title` max 120, `body` max 500, `href` max 300
   with the same `startsWith("/") || startsWith("https://")` refinement as
   `admin-notification-actions.ts:20-27`). Reuse those constraints; do not
   invent new limits.
2. `prisma.userNotification.create({ ..., select: { id: true } })`. **No
   transaction** — it is a single write.
3. If `email === false`, return `{ ok: true, data: { notificationId, emailed: false } }`.
4. `getEmailEnabled(userId)`. If false → return with `emailed: false`.
5. Look up the address: `prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } })`.
   No email → return with `emailed: false`.
6. Build `appUrl` as `process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://abtalks.in"`
   — the form already used in `notify-data-request.ts:26` and
   `admin-actions.ts:153`. Do **not** use the `NEXTAUTH_URL ?? AUTH_URL ??
   vercel.app` chain from `run-hire-alerts.ts`; that fallback is wrong.
7. `notificationEmail(...)` → `sendEmail(...)`.
8. On `{ ok: true }` only, stamp `emailedAt`. A `skipped: true` result is **not**
   emailed — leave `emailedAt` null.
9. Wrap steps 4-8 in try/catch. **An email failure must never fail the call**:
   log via `logger.error("[notify] email failed", { userId, eventKey, error })`
   and return `{ ok: true, ... emailed: false }`. The in-app notification already
   landed; that is the delivery that matters.

Add a header comment stating: **callers must invoke `notifyUser` after their own
transaction commits, never inside `$transaction`.** A held connection plus an
outbound HTTP call to Brevo is how you exhaust a free-tier pool.

### 6f. `src/features/notification/get-notifications.ts` `[edit]`

Add two constants next to the existing ones:

```ts
/** Personal notifications older than this stop showing. */
const PERSONAL_MAX_AGE_DAYS = 30;
/** Merged cap. Higher than FEED_LIMIT because personal items must not be
 *  crowded out by broadcasts — the panel list already scrolls. */
const MERGED_FEED_LIMIT = 15;
```

Leave `FEED_LIMIT = 5` and `ANNOUNCEMENT_MAX_AGE_DAYS = 14` **unchanged** —
they still govern the broadcast half and the reasoning in their doc comments
still holds.

Add two queries to the existing `Promise.all` (keep it one round-trip):

```ts
prisma.userNotification.findMany({
  where: { userId, createdAt: { gte: personalCutoff } },
  select: { id: true, title: true, body: true, href: true, category: true,
            createdAt: true, readAt: true },
  orderBy: { createdAt: "desc" },
  take: MERGED_FEED_LIMIT,
}),
prisma.recruiterProfile.findFirst({
  where: { userId, approved: true },
  select: { id: true },
}),
```

Then:

- After the existing audience block, add `if (recruiterProfile) audiences.add("RECRUITER");`
- Map personal rows to `AppNotification`:
  `key: \`user:${row.id}\``, `publishedAt: row.createdAt.toISOString()`,
  `isRead: row.readAt !== null`, `isPersonal: true`.
- Merge `[...adminItems, ...derivedItems]` **as today** (both get
  `isRead: readKeys.has(item.key)`), then concat the personal items — which
  already carry their own `isRead` and must **not** be passed through the
  `readKeys` map.
- Sort desc by `publishedAt`, `.slice(0, MERGED_FEED_LIMIT)`.
- `unreadCount` unchanged in shape.

### 6g. `src/app/actions/notification-actions.ts` `[edit]`

In `markNotificationsReadAction`, after the Zod parse, split the keys:

```ts
const personalIds = parsed.data
  .filter((k) => k.startsWith("user:"))
  .map((k) => k.slice("user:".length));
const otherKeys = parsed.data.filter((k) => !k.startsWith("user:"));
```

Keep the existing `notificationRead.createMany` for `otherKeys` (skip the call
when the array is empty), and add:

```ts
await prisma.userNotification.updateMany({
  where: { id: { in: personalIds }, userId, readAt: null },
  data: { readAt: new Date() },
});
```

`userId` in that `where` is the authorisation check — a caller must not be able
to mark someone else's row read by guessing a cuid. **Do not drop it.**

Leave `getMyNotificationsAction`'s public contract alone — its doc comment
(`notification-actions.ts:14-18`) explains why it must not gain `requireRole`.
It is **public on purpose**.

### 6h. Preference UI

`src/app/actions/notification-preference-actions.ts` `[new]`:

```ts
export async function setEmailNotificationsAction(input: {
  enabled: boolean;
  /** Present only when the caller arrived from an email footer, signed out. */
  token?: string;
  userId?: string;
}): Promise<Result<null>>
```

- Zod at entry.
- Resolve the subject: session `userId` first; if there is no session, require
  **both** `userId` and `token` and `verifyUnsubscribeToken(userId, token)`.
  No session and no valid token → `{ ok: false, message: "Not signed in" }`.
- `setEmailEnabled(subjectId, enabled)`, then `revalidatePath("/settings/notifications")`.
- **PUBLIC on purpose** — no `requireRole`/`requireAdmin`. Mark that in a
  comment, same as `notification-actions.ts` does.

`src/app/settings/notifications/page.tsx` `[new]` — Server Component:

- Read `auth()` and `searchParams` (`u`, `t`).
- Signed in → `getEmailEnabled(session.user.id)`, render the toggle with
  `token={null}`.
- Signed out with a valid `u` + `t` → render the toggle bound to that token.
- Neither → render a short "Sign in to manage email settings" with a
  `buttonVariants`-styled `<Link href="/login">`. **Use `buttonVariants` directly
  on the `<Link>`** — never `<Button asChild>` (Base UI button semantics).

`src/components/settings/email-notifications-toggle.tsx` `[new]` — Client:

- Props: `{ enabled: boolean; token: string | null; userId: string | null }`.
- A `Switch` from `src/components/ui/` (check it exists; if not, use a
  `Checkbox` — do **not** add a new UI primitive).
- On change: optimistic flip, call the action, `toast.success` / `toast.error`
  via `sonner`, revert on failure. Same shape as `notification-composer.tsx`'s
  submit handler.

> **Why a page and not a one-click GET route:** email clients and security
> scanners prefetch links. A GET that mutates would unsubscribe people who never
> clicked. The footer link lands on this page; the user flips the switch.

### 6i. Recruiter audience in the composer

`src/app/actions/admin-notification-actions.ts:18` — extend:

```ts
const audienceEnum = z.enum(["ALL", "CHALLENGE", "PROGRAM", "HACKATHON", "RECRUITER"]);
```

`src/components/admin/notification-composer.tsx:28-33` — append:

```ts
  { value: "RECRUITER", label: "Recruiters (approved)" },
```

Nothing else in either file changes — `Audience` is derived from the array.

### 6j. Mount the bell on recruiter surfaces

- `src/components/talent/talent-shell.tsx` — inside the `<header>` at line 37,
  in the right-hand cluster.
- `src/components/hire/hire-chrome.tsx` — inside `<header className="hire-app__header">`
  at line 83, in the right-hand cluster.

Both get:

```tsx
import { NotificationBellButton } from "@/components/shared/notification-bell-button";
```

Use the class string from `app-header.tsx:150` as the starting point and adjust
only spacing to match each shell. `HireChrome` uses its own `hire-scout.css`
design language — match its neighbours' sizing rather than pasting the dashboard
border/glow treatment verbatim.

`NotificationProvider` is already in the root layout (`app/layout.tsx:283`), so
both shells are inside it. **No provider changes.**

---

## 7. Guardrails for Cursor (DO NOT)

- **DO NOT** send email inside a `$transaction`, and do not add a `tx` parameter
  to `notifyUser`. Callers notify after they commit.
- **DO NOT** touch `middleware.ts` or `auth.config.ts`. Nothing here belongs on
  the edge, and `@/lib/*` imports there blow the 1 MB Edge bundle.
- **DO NOT** add `requireRole` / `requireAdmin` to `getMyNotificationsAction`,
  `markNotificationsReadAction`, `setEmailNotificationsAction`, or
  `/settings/notifications`. All four are public on purpose — a signed-out
  caller gets an empty feed or a sign-in prompt, never a redirect or a throw.
- **DO NOT** repurpose, read, or write `NewsletterSubscription`. It is marketing
  consent, keyed by address, and it stays inert.
- **DO NOT** use `UserRoleAssignment` / `PlatformRole.RECRUITER` for the audience
  check. Recruiter identity is `RecruiterProfile.approved` today.
- **DO NOT** add a new email provider, a new `BrevoClient`, a queue, a cron, or
  a retry. `sendEmail` from `@/lib/email` is the only door. `notifyUser` is
  fire-once.
- **DO NOT** refactor `lib/workshop-email.ts`, `lib/hackathon-email.ts` or
  `features/email/challenge-reset-email.ts`. Known duplication, separate job.
- **DO NOT** create a shared `escape-html.ts`. Inline the six lines.
- **DO NOT** change `AppNotification.key`, `publishedAt`'s ISO-string type, or
  `EMPTY_FEED` — `notification-provider.tsx` and the sessionStorage cache both
  depend on that shape, and a stale cached feed from before this deploy must
  still render.
- **DO NOT** reuse or rewrite a `notificationKey`. Keys are permanent; a changed
  key makes a read item unread again.
- **DO NOT** pass a Lucide icon, function, `Date`, or Prisma object across the
  Server→Client boundary. The client picks its icon from `category`.
- **DO NOT** run `prisma migrate dev`, `prisma migrate reset`, or
  `db:cleanup:*`. See §8 — `migrate reset` would wipe production.
- **DO NOT** use `console.*`. `logger` from `@/lib/logger` only.
- **DO NOT** return full records from Prisma. Every query in this plan has an
  explicit `select`.
- **DO NOT** add files beyond the table in §4.

---

## 8. DB safety

> ⚠️ **The Neon database is shared: dev *is* prod.** A schema change made
> locally lands on live user data immediately. Read this section fully before
> running anything.

**Known drift:** migration `20260711145400_add_phone_verified` is recorded in
`_prisma_migrations` but its file is missing from git. Because of that,
`prisma migrate dev` detects drift and offers `migrate reset` — **which would
destroy all production data. Never run it.** The project's standing practice is
`prisma db push` until the history is rebaselined.

Order:

1. **Commit checkpoint.** Commit all current work first and record the hash:
   `git rev-parse --short HEAD` → note it in the PR description.
2. **Neon branch snapshot.** In the Neon console, create a branch from `main`
   named `pre-107-notify-helper` before any push. This is the rollback.
3. Confirm `.env` has `DIRECT_URL` (the `DATABASE_URL` value minus `-pooler`) —
   `db push` needs it.
4. Edit `prisma/schema.prisma` (step 6a) and run:
   ```
   npx prisma db push
   npx prisma generate
   ```
5. **Verify before writing any application code against it:**
   ```
   npx prisma studio
   ```
   Confirm `UserNotification` and `NotificationPreference` exist and that
   `NotificationAudience` accepts `RECRUITER`.

Both new tables are additive and start empty; the enum gains a value that no
existing row uses. There is **no backfill and no data migration**. Rollback is
the Neon branch, not a down-migration.

---

## 9. Verification

**Build gate:** `npm run build` must pass with zero TypeScript errors. Adding
`RECRUITER` to `NotificationAudience` will surface any exhaustive `switch` on the
enum — there should be none, since `audience` is only ever compared via
`Set.has`, but the compiler is the authority. Trust the error over this plan.

**Manual, in order:**

1. **Preference default.** Sign in as a user with no `NotificationPreference`
   row. `/settings/notifications` shows the toggle **on**. (Absent row = enabled.)
2. **Helper, email on.** From a scratch script or an existing admin action, call
   `notifyUser({ userId, eventKey: "admin.direct", title: "Test", email: true })`
   for a real address. Expect: bell shows it immediately with the unread dot,
   **and** an email arrives with a working unsubscribe link.
3. **Helper, email off.** Turn the toggle off, call again. Expect: the bell item
   appears, **no email**, and `emailedAt` is null on the new row.
4. **Seed-address guard.** Call for an `@abtalks.dev` user. Expect: in-app row
   created, no send, `emailedAt` null, no error surfaced.
5. **No API key.** Unset `BREVO_API_KEY` locally and call again. Expect:
   in-app row still created, `{ ok: true, emailed: false }`, a `logger.warn`
   from `email.ts:41` — **the notify call must not fail.**
6. **Read state.** Open the bell. The personal item goes read and the badge
   clears. Reload — it stays read. Confirm in Studio that `UserNotification.readAt`
   is stamped and that **no** `NotificationRead` row was created for the
   `user:` key.
7. **Cross-user authorisation.** Copy a `user:<id>` key from user A, sign in as
   user B, and call `markNotificationsReadAction(["user:<A's id>"])` from the
   console. Expect: no change to A's row (the `userId` guard in the `updateMany`).
8. **Recruiter audience.** As admin, push an announcement with audience
   `Recruiters (approved)`. Expect: visible in the bell on `/hire` and `/talent`
   for an approved recruiter; **not** visible to a student on `/dashboard`.
9. **Recruiter bell renders.** Both recruiter headers show the bell, the panel
   opens anchored under it, and the mobile sheet still drops correctly below md.
10. **No regression.** A student on `/dashboard` still sees admin broadcasts and
    derived workshop/hackathon/cohort items, correctly ordered, capped, and with
    the 14-day cutoff still applied.
11. **Unsubscribe from email.** Sign out, open the unsubscribe link from the test
    email. The page loads and the toggle works. Then tamper with one character
    of the token — expect a rejection, not a silent success.

**Exactly these files should show as changed** — `git status` must match the §4
table plus `prisma/schema.prisma`. Nothing under `src/lib/`, `middleware.ts`,
`auth.ts`, or `auth.config.ts`. **No new migration file** (that is expected —
`db push` writes none).

---

## 10. Commit message

```
feat(notifications): unified notifyUser helper — in-app + email, preference-aware

Adds one helper that delivers a notification to a single user both in the
bell and by email, skipping the email when that user has turned emails off.

- UserNotification: real per-user rows, the fan-out counterpart to the
  broadcast-only Notification model. readAt lives on the row; NotificationRead
  exists for derived items that have no row, which does not apply here.
- NotificationPreference: one global emailEnabled switch. Absent row means
  enabled. Deliberately separate from NewsletterSubscription, which is
  marketing consent keyed by address.
- notifyUser() writes the row first and emails after; an email failure is
  logged and never fails the call.
- Email goes through the existing sendEmail/Brevo door. No new provider.
- Extends the bell to recruiters: RECRUITER audience matched from
  RecruiterProfile.approved, plus the bell mounted in TalentShell and
  HireChrome.
- Adds /settings/notifications, reachable signed-in or via a hashed
  unsubscribe token from an email footer.

Schema applied with `prisma db push` (migration history has known drift;
`migrate dev`/`reset` must never be run against this database).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
