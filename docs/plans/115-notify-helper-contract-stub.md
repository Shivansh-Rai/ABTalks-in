# 115 — `notifyUser` contract freeze: no-op stub that type-checks

> **Supersedes nothing.** This is phase 1 of `docs/plans/114-unified-notify-helper.md`.
> 107 stays the implementation plan; this plan lands only the **frozen names and
> signatures** so other developers can code against them from Wednesday. No
> schema change, no database write, no email.

---

## 1. Goal

Publish the notification helper's **public contract** — one function signature
and the type names around it — as a compiling no-op, so other developers can
import and call `notifyUser()` immediately and have their call sites be correct
when the real implementation lands. Every name in §4 is frozen after Wednesday.

---

## 2. Current behavior

Restating only what this plan depends on; full survey is in 107 §2.

- Notifications are **broadcast-only**: one `Notification` row read by many
  users, filtered at read time by `audience`
  (`src/features/notification/get-notifications.ts:106-114`). There is no
  per-recipient row and no way to notify one person.
- **`src/features/notification/types.ts` is client-safe.** It has no
  `import "server-only"`, no `@prisma/client` import, and is imported directly by
  the Client Component `src/components/shared/notification-provider.tsx:26-30`.
  This constrains where the new types can live.
- **No test framework.** Tests are standalone `tsx` scripts colocated as
  `*.test.ts`, each with its own `npm run test:*` script — e.g.
  `src/features/hire/visibility.test.ts` via `npm run test:visibility`. They use
  a local `assert` / `suite` pair, print `✓`/`✗`, and end with
  `process.exitCode = 1` on failure. Do not add vitest or jest.
- `sendEmail` (`src/lib/email.ts:32`) already returns a three-state result:
  `{ ok: true }`, `{ ok: false, skipped: true }` (no API key, or an
  `@abtalks.dev` seed address), `{ ok: false }` (the send threw).

---

## 3. What is being reused, named exactly

| Reusing | Where it lives now | How it is reused |
|---|---|---|
| **`sendEmail`** | `src/lib/email.ts:32` | The only email door. Phase 1 imports its result type and freezes the mapping from it (§5b); phase 2 calls it. No new provider, no new `BrevoClient`. |
| **`SendEmailResult`** | `src/lib/email.ts:28` | Imported **type-only** into `notify.ts` and consumed by `emailDeliveryFrom`. This is what makes the reuse compiler-enforced rather than a promise in a comment. |
| **`NotificationCategoryKey`** | `src/features/notification/types.ts:1` | The existing notification-type identifier. `NotifyInput.category` uses it **verbatim, imported, never redefined**. It mirrors the Prisma `NotificationCategory` enum and stays what it already is: presentation only — it picks the icon in `notification-provider.tsx:191-197`. |
| **The `key` namespace convention** | `AppNotification.key`, `src/features/notification/types.ts:16` (`admin:<id>`, `workshop:<eventId>`, `hackathon:kickoff`) | Personal notifications extend the same scheme with `user:<id>`. Frozen here as the exported constant `PERSONAL_KEY_PREFIX`. |
| **The result envelope** | The `type Result<T>` declared locally in `src/app/actions/admin-notification-actions.ts:9` and every sibling action file | Same `{ ok: true, data } | { ok: false, message }` shape, exported as `NotifyResponse` (§4 note on why not `Result`). |
| **The `*.test.ts` + `npm run test:*` harness** | `src/features/hire/visibility.test.ts` | Copied structure for `notify.test.ts`. |

### The one thing that is genuinely new — say so plainly

**There is no existing event-type identifier in this codebase.** I looked for
one. What exists is `NotificationCategory` (icons) and `NotificationAudience`
(targeting); neither carries *what happened*. The string keys are the closest
thing, and they identify an *item*, not an event class.

So `NotificationEventKey` is a new name. It is the only new identifier in this
plan, and it is deliberately a **TypeScript union stored as a `String` column**
in phase 2 — not a Prisma enum — so adding a value never needs a migration.

---

## 4. The frozen contract

Everything below is public API after Wednesday. Additions later are fine;
renames and removals are not.

### 4a. New types — all in `src/features/notification/types.ts`

```ts
/**
 * What happened, as a stable machine key. `NotificationCategoryKey` is icons;
 * this is meaning. Format: `<domain>.<past-tense-event>`, lowercase, one dot.
 *
 * FROZEN: a value that has shipped is never renamed — it is stored on the row.
 * Adding a value is non-breaking and needs no migration (stored as String).
 */
export type NotificationEventKey =
  | "submission.approved"
  | "submission.rejected"
  | "certificate.issued"
  | "recruiter.approved"
  | "admin.direct";

/** The two delivery channels. Frozen at two; SMS/WhatsApp would be a new plan. */
export type NotifyChannel = "inApp" | "email";

/** Per-channel outcome. `skipped` is a success — it means "correctly not sent". */
export type NotifyDelivery = "delivered" | "skipped" | "failed";

/** Why a channel was skipped. `not_implemented` is permanent — see §6. */
export type NotifySkipReason =
  | "not_implemented"
  | "channel_disabled"
  | "preference_off"
  | "no_email_address"
  | "test_address"
  | "provider_unconfigured";

export type NotifyInput = {
  userId: string;
  eventKey: NotificationEventKey;
  /** Max 120 chars. Becomes the email subject verbatim. */
  title: string;
  /** Max 500 chars. */
  body?: string | null;
  /** Internal path ("/dashboard") or absolute https:// URL. Max 300 chars. */
  href?: string | null;
  /** Icon only. Defaults to "GENERAL". */
  category?: NotificationCategoryKey;
  /** Both default to true. `false` skips that channel outright. */
  channels?: { inApp?: boolean; email?: boolean };
};

export type NotifyResult = {
  /** The persisted row id, or null when nothing was persisted. */
  notificationId: string | null;
  inApp: NotifyDelivery;
  email: NotifyDelivery;
  /** Populated only for channels whose delivery is "skipped". */
  skipReasons: Partial<Record<NotifyChannel, NotifySkipReason>>;
};

export type NotifyResponse =
  | { ok: true; data: NotifyResult }
  | { ok: false; message: string };

/** Personal feed items are keyed `user:<UserNotification.id>`. */
export const PERSONAL_KEY_PREFIX = "user:";
```

One additive change to the existing `AppNotification` type:

```ts
  /**
   * True for `user:` items — addressed to this person, not broadcast.
   * RESERVED: always undefined until 107 lands the read path.
   */
  isPersonal?: boolean;
```

> **Why `NotifyResponse` and not `Result`:** every action file already declares
> its own local `type Result<T>`. An exported `Result` would collide on import
> in exactly the files most likely to call this. The shape is identical.

### 4b. New functions — `src/features/notification/notify.ts` `[new]`

```ts
export async function notifyUser(input: NotifyInput): Promise<NotifyResponse>;

/** Maps sendEmail's three-state result onto NotifyDelivery. Pure. */
export function emailDeliveryFrom(result: SendEmailResult): NotifyDelivery;
```

`emailDeliveryFrom` is the whole reason the stub is more than a placeholder: it
is real, pure, testable today, and it makes the `sendEmail` reuse a
**compile-time fact** rather than a comment. Mapping:

| `SendEmailResult` | → `NotifyDelivery` |
|---|---|
| `{ ok: true }` | `"delivered"` |
| `{ ok: false, skipped: true }` | `"skipped"` |
| `{ ok: false }` | `"failed"` |

---

## 5. Files to touch

| File | | Note |
|---|---|---|
| `src/features/notification/types.ts` | `[edit]` | append §4a; **must stay client-safe** |
| `src/features/notification/notify.ts` | `[new]` | the stub + `emailDeliveryFrom` |
| `src/features/notification/notify.test.ts` | `[new]` | tsx script, harness copied from `visibility.test.ts` |
| `package.json` | `[edit]` | one line: `"test:notify"` |

**Four files. Nothing else.** In particular: no `prisma/schema.prisma`, no
migration, no `get-notifications.ts`, no `notification-actions.ts`, no
`notification-provider.tsx`, no component, no route.

> `package.json` already shows as modified in the working tree. Commit or stash
> that first so the one-line script addition lands as its own reviewable change.

### Server vs Client

| File | Boundary |
|---|---|
| `types.ts` | **Neither** — pure types + one `const`. No `server-only`, no `@prisma/client`, no `@/lib/*` runtime import. A Client Component imports this file today; breaking that breaks the bell. |
| `notify.ts` | **Server only** — first line `import "server-only";` |
| `notify.test.ts` | Node script, run by `tsx` |

No Server→Client prop passing in this plan — no component is touched.

---

## 6. Steps

### Step 1 — types (`types.ts`) · testable: `npx tsc --noEmit` passes

Append the §4a block to the **end** of the existing file, and add the
`isPersonal?: boolean` field to `AppNotification`.

Do not reorder, rename, or re-comment anything already in the file. Do not add
`import "server-only"`. Do not import from `@prisma/client` — `NotificationCategoryKey`
is already a hand-written union at line 1 and stays that way.

### Step 2 — the stub (`notify.ts`) · testable: `npx tsc --noEmit` passes

```ts
import "server-only";
import type { SendEmailResult } from "@/lib/email";
import { logger } from "@/lib/logger";
import type { NotifyDelivery, NotifyInput, NotifyResponse } from "./types";
```

Implement `emailDeliveryFrom` for real (the table in §4b) — it is pure and has
no dependencies.

Implement `notifyUser` as a no-op that returns the documented shape:

```ts
export async function notifyUser(input: NotifyInput): Promise<NotifyResponse> {
  logger.info("[notify] stub — nothing delivered", {
    userId: input.userId,
    eventKey: input.eventKey,
  });

  return {
    ok: true,
    data: {
      notificationId: null,
      inApp: "skipped",
      email: "skipped",
      skipReasons: { inApp: "not_implemented", email: "not_implemented" },
    },
  };
}
```

Rules for this body:

- **Returns `ok: true`, never throws, never rejects.** Callers must be able to
  wire real code paths now and have them behave correctly, just silently.
- **No Zod, no validation.** Validation is phase 2 (107 §6e step 1). A stub that
  rejects input would make callers write error handling against a behaviour that
  does not exist yet.
- **No `prisma` import.** Not even unused — this file must not pull the client in.
- **No `sendEmail` runtime import.** `import type` only; a value import would be
  unused and fail lint.
- `async` with no `await` — if the lint config flags `require-await`, keep
  `async` (the signature is frozen) and satisfy the rule however the codebase
  already does elsewhere; do not change the return type to a non-Promise.
- The file header comment must state: **this is a stub, the contract is frozen,
  the implementation is `docs/plans/114-unified-notify-helper.md`.**

> **`not_implemented` stays in `NotifySkipReason` permanently.** It is honest
> while the stub is live, it is cheap, and removing a union member later would
> break any exhaustive `switch` a caller has written. Freezing means freezing.

### Step 3 — the test (`notify.test.ts` + `package.json`) · testable: `npm run test:notify`

Copy the harness shape from `src/features/hire/visibility.test.ts:26-41`
(`let passed/failed`, `assert`, `suite`, `✓`/`✗` output, `process.exitCode = 1`).
Header comment gives the run command, as that file's does.

Four suites:

1. **`emailDeliveryFrom` maps all three states** — the only real behaviour here.
   Assert `{ok:true} → "delivered"`, `{ok:false,skipped:true} → "skipped"`,
   `{ok:false} → "failed"`.
2. **The stub returns the frozen shape** — `res.ok === true`,
   `data.notificationId === null`, both channels `"skipped"`, both skip reasons
   `"not_implemented"`.
3. **The stub is inert** — call it and assert it resolves without throwing, for
   an input using every optional field and for one using none.
4. **`types.ts` stays client-safe** — a source scan, in the spirit of
   `visibility.test.ts`'s second check. Read `src/features/notification/types.ts`
   with `readFileSync`, strip comments, and assert it contains none of
   `server-only`, `@prisma/client`, `@/lib/`. This is the check that actually
   earns its keep: the failure it guards against is a future edit that adds a
   Prisma import to the shared types file and breaks the bell for every user at
   runtime, which no type-check catches.

Add to `package.json` scripts, matching the neighbouring entries' style:

```json
"test:notify": "NODE_OPTIONS=--conditions=react-server tsx src/features/notification/notify.test.ts"
```

> The `--conditions=react-server` flag matches the sibling `test:*` scripts and
> is what lets a `server-only` module load under `tsx`. `notify.ts` has it;
> without the flag the import throws.

### Step 4 — prove a caller compiles · testable: `npx tsc --noEmit`

Do **not** add a consumer file. Instead, inside `notify.test.ts`, add a
compile-only block that exercises the call shape a real Server Action would use:

```ts
// Compile-time only: this is the shape other developers will write.
const _example: NotifyInput = {
  userId: "u_123",
  eventKey: "submission.approved",
  title: "Your Day 12 submission was approved",
  body: "Nice work.",
  href: "/dashboard",
  category: "CHALLENGE",
  channels: { email: true },
};
void _example;
```

If this does not type-check, the contract is wrong — fix the contract now, before
Wednesday, not the example.

### Step 5 — verify · `npm run build` and `npm run lint`

Both must pass clean. `npm run build` runs `prisma generate` first; that is fine
and touches nothing, since the schema is unchanged.

---

## 7. Guardrails for Cursor (DO NOT)

- **DO NOT** add anything to `prisma/schema.prisma`, and **do not run**
  `prisma db push`, `migrate dev`, or `migrate reset`. This phase has zero
  schema surface. (`migrate reset` against this database would destroy
  production data — see 107 §8.)
- **DO NOT** make `notifyUser` actually write, send, or read anything. No
  `prisma`, no `sendEmail` call, no `fetch`. It is a stub on purpose.
- **DO NOT** add `import "server-only"`, a `@prisma/client` import, or any
  `@/lib/*` runtime import to `types.ts`. A Client Component imports that file.
- **DO NOT** rename, reshape, or re-order anything already in `types.ts` —
  `AppNotification.key`, `publishedAt` as an ISO string, and `EMPTY_FEED` are
  depended on by `notification-provider.tsx` **and** by feeds already cached in
  users' `sessionStorage` from the current deploy.
- **DO NOT** export a type named `Result` from `types.ts`. It collides with the
  local `Result<T>` in every action file.
- **DO NOT** add vitest, jest, or any test dependency. The harness is a `tsx`
  script.
- **DO NOT** add a new email provider, `BrevoClient`, queue, cron, or retry.
- **DO NOT** create extra files — no `notify-types.ts`, no `constants.ts`, no
  `escape-html.ts`. Four files, listed in §5.
- **DO NOT** wire any of the five `NotificationEventKey` values to a real call
  site in this phase. Freezing the name is the deliverable; calling it is 107.
- **DO NOT** use `console.*`. `logger` from `@/lib/logger`.
- **DO NOT** touch `middleware.ts` or `auth.config.ts`.

---

## 8. DB safety

**Not applicable — and that is the point of this phase.** No schema change, no
migration, no data touched, nothing to snapshot. This is why the contract can
land before Wednesday without a Neon branch or a production window.

The DB safety section that matters is 107 §8, and it applies when the
implementation lands, not now.

---

## 9. Verification

1. `npx tsc --noEmit` — clean.
2. `npm run lint` — clean. Watch specifically for an unused-import error on
   `SendEmailResult` (it must be consumed by `emailDeliveryFrom`) and for
   `require-await` on `notifyUser`.
3. `npm run test:notify` — 4 suites, `0 failed`, exit code 0.
4. `npm run build` — passes.
5. **Bell regression** (the one runtime risk in this plan, from editing a file
   the client imports): load `/dashboard` signed in, open the bell. Items render,
   the badge clears on open, and the panel anchors under the bell. Check the
   browser console for a module error mentioning `server-only` — that is what a
   bad `types.ts` edit looks like.
6. **Grep proof of reuse.** `notify.ts` imports `SendEmailResult` from
   `@/lib/email` and `NotificationCategoryKey` from `./types`. Neither is
   redefined anywhere in the diff.
7. **`git status` shows exactly four files** — the three in `src/features/notification/`
   plus `package.json`. No `prisma/` changes, no migration file, no lockfile
   change.

---

## 10. Assumptions

Stated because each one, if wrong, changes the contract — and the contract is
frozen after Wednesday.

**About the freeze**

1. The freeze covers **names and shapes only**, not behaviour. Callers get
   `skipped`/`not_implemented` until 107 lands, and must not branch on that.
2. Adding a `NotificationEventKey` value later is non-breaking and needs no
   migration. **Renaming or removing one is breaking** and is assumed never to
   happen after Wednesday.
3. `NotifySkipReason` and `NotifyDelivery` are assumed to be consumed in
   exhaustive `switch` statements by other developers, so no member is ever
   removed — including `not_implemented`.
4. Two channels is the whole world. SMS or WhatsApp would be a new plan, not a
   new member on `NotifyChannel`.

**About behaviour callers should code against**

5. `notifyUser` **never throws and never returns `ok: false`** in phase 1. In
   phase 2 `ok: false` means input validation failed — nothing else.
6. An **email failure never fails the call**. It surfaces as
   `data.email === "failed"` with `ok: true`. The in-app notification is the
   delivery that matters.
7. **Absent preference row = emails ON** (107 §6c). Callers assume email will be
   attempted unless the user opted out.
8. Callers **must invoke `notifyUser` after their own transaction commits**,
   never inside `$transaction`. Holding a pooled connection across an outbound
   Brevo call is how a free-tier pool is exhausted. The stub does not enforce
   this and cannot; it is a documented caller obligation from day one.
9. `title` is used **verbatim as the email subject**, so callers write it as a
   subject line, not a UI fragment.
10. `category` remains **presentation only**. Nothing branches on it, then or now.

**About scope**

11. **Single recipient only.** No `notifyUsers` batch variant is frozen now.
    Adding one later is purely additive. This is deliberate: a batch signature
    frozen without a real caller would be guesswork.
12. `notificationId` is `string | null` **permanently**, not just during the
    stub — a caller that skips the in-app channel legitimately has no id.
13. The recruiter work in 107 (`RECRUITER` audience, bells on `/talent` and
    `/hire`) is orthogonal and blocked by nothing here.
14. `sendEmail`'s signature and its three-state result are assumed stable. If
    `SendEmailResult` changes, `emailDeliveryFrom` is the single place that
    breaks — by design.
15. The three files that bypass `sendEmail` with their own `BrevoClient`
    (`lib/workshop-email.ts`, `lib/hackathon-email.ts`,
    `features/email/challenge-reset-email.ts`) stay untouched and out of scope.
16. `NewsletterSubscription` stays inert and is **not** the email preference.

**About the environment**

17. No schema change means no exposure to the shared dev==prod Neon database or
    its known migration drift.
18. `package.json` currently has uncommitted changes in the working tree; this
    plan assumes they are committed or stashed before Step 3.
19. `NODE_OPTIONS=--conditions=react-server` is required for a `server-only`
    module to load under `tsx`, matching every sibling `test:*` script.

---

## 11. What this phase deliberately does NOT do

So nobody reads the merged stub as a finished feature:

- No `UserNotification` table — nothing is persisted, the bell shows nothing new.
- No `NotificationPreference` table — the switch does not exist, so no user
  preference is actually honoured yet.
- No email is sent.
- No `/settings/notifications` page, no unsubscribe token.
- No recruiter audience, no bell on `/talent` or `/hire`.

All of the above is `docs/plans/114-unified-notify-helper.md`, which this plan
leaves completely intact.

---

## 12. Commit message

```
feat(notifications): freeze notifyUser contract as a typed no-op stub

Publishes the shared notification helper's public API so other work can be
written against it now. No database, no email, no schema change.

- notifyUser(NotifyInput): Promise<NotifyResponse> — returns ok:true with
  both channels "skipped"/"not_implemented". Never throws.
- emailDeliveryFrom(SendEmailResult): NotifyDelivery — real and pure. Makes
  the reuse of sendEmail (src/lib/email.ts) a compile-time fact rather than
  a comment in a plan.
- Reuses NotificationCategoryKey verbatim for the category field, and the
  existing key-namespace convention for PERSONAL_KEY_PREFIX ("user:").
- NotificationEventKey is the one genuinely new identifier: the codebase had
  no event-type concept, only category (icons) and audience (targeting). It
  is a TS union stored later as String, so new values need no migration.
- Test guards the mapping, the frozen shape, and that types.ts stays
  client-safe — notification-provider.tsx imports it.

Contract frozen. Implementation: docs/plans/114-unified-notify-helper.md

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
