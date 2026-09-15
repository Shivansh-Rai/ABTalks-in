# 145 — T-268: Email and notification delivery diagnosis console

**Workstream:** A3 Admin Diagnosis
**Persona:** ABTalks Platform Admin
**Owner:** Manuvrtti
**Demo:** Demo 3
**Implementation date:** 2026-09-15
**Wall date:** 2026-09-16
**Depends on:** T-248 (notification service — MERGED, PR #280), T-262 (DB-backed admin — LIVE), T-207 (design — not blocking; existing admin patterns reused)
**Test cases:** TC-A-006

---

## 1. Goal

Give Platform Admins one screen where they can find why a specific message did
not arrive. All delivery attempts are already persisted by T-248
(`NotificationDelivery`) and T-259 (`OutboundDelivery`). Nothing surfaces them
today. This plan adds the read-only admin screen, the search server action, and
the acceptance test.

## 2. Outcome (verbatim from task row)

> As ABTalks support, I can say why a message did not arrive.

## 3. Current behavior

- **`NotificationDelivery`** ([`prisma/schema.prisma:1918`](../../prisma/schema.prisma))
  tracks every per-user notification channel attempt with `state` (created |
  sending | sent | failed), `failureReason`, `attemptCount`, `lastAttemptAt`.
  Written by [`src/features/notification/notification-service.ts`](../../src/features/notification/notification-service.ts)
  and [`src/features/notification/email-delivery.ts`](../../src/features/notification/email-delivery.ts).
- **`OutboundDelivery`** ([`prisma/schema.prisma:4207`](../../prisma/schema.prisma))
  tracks non-notification outbound mail — recruiter OTP, hire alerts, contact
  form, DSAR — with `status` (SKIPPED | SENT | FAILED), `failureReason`,
  `recipientHash` (SHA-256, never the raw address). Written by
  [`src/lib/email.ts`](../../src/lib/email.ts).
- **No admin surface** reads either table. `/admin/notifications` is the
  broadcast composer (T-036), unrelated to delivery diagnosis.

## 4. Non-goals

- Retry buttons — retry runs on a schedule via
  `retryFailedDeliveries()`; a manual admin retry is a follow-up.
- Editing preferences from this screen — that lives with the user.
- Exposing raw recipient addresses stored as hashes in `OutboundDelivery`. The
  admin searches by known email and the server hashes for the query — the
  plaintext never comes back in the response payload for OutboundDelivery rows.
- Aggregated dashboards / charts — TC-A-006 asks for search + read, not analytics.

## 5. Files to touch

| Path | Kind | Purpose |
| --- | --- | --- |
| `src/features/notification/delivery-diagnosis.ts` | **new** | Read-only search + hydrate for both delivery tables. Server-only. |
| `src/features/notification/delivery-diagnosis.test.ts` | **new** | Acceptance test — TC-A-006 style. |
| `src/app/actions/admin-delivery-actions.ts` | **new** | Zod-validated server actions with `requireAdmin()` gate. |
| `src/app/admin/deliveries/page.tsx` | **new** | Server Component. Reads `searchParams`, renders filters + table. |
| `src/components/admin/delivery-filters.tsx` | **new** | Client filter form (recipient, event, channel, state, source). |
| `src/components/admin/delivery-table.tsx` | **new** | Client table with row expansion for failure detail. |
| `src/app/admin/layout.tsx` | **edit** | Add nav entry `{ href: "/admin/deliveries", label: "Deliveries", icon: "deliveries" }`. |
| `src/components/admin/admin-sidebar.tsx` | **edit** | Add `deliveries` icon. |
| `package.json` | **edit** | Add `test:delivery-diagnosis` script. |

## 6. Server vs Client

| Component | Server/Client | Notes |
| --- | --- | --- |
| `page.tsx` | Server | Awaits `searchParams`, calls `requireAdmin`, calls `searchDeliveries`. |
| `delivery-filters.tsx` | Client | Router-based form — updates URL query. |
| `delivery-table.tsx` | Client | Small `useState` for row expansion. Data comes in as plain-JSON `Row[]`. |
| Server → Client boundary | Plain JSON only — no Dates (ISO strings), no class instances, no functions. |

## 7. Steps

1. **Repository** — `delivery-diagnosis.ts` exports:
   - `type DeliverySource = "notification" | "outbound"`
   - `type DeliveryRow` — union with a `source` discriminator; both variants
     carry `id`, `state`, `channel`, `failureReason`, `attemptCount`,
     `lastAttemptAt`, `createdAt`, `updatedAt`, and source-specific fields
     (`eventType`, `recipient email/name` for notification rows; `kind`,
     `subjectType`, `subjectId`, `sentryEventId`, `requestId` for outbound).
   - `searchDeliveries(input)` — Zod-validated input with `recipient?` (email or
     userId), `eventType?`, `state?`, `channel?`, `source?`, `since?`, `until?`,
     `limit` (default 50, max 200). Returns a discriminated `DeliveryRow[]`.
   - Notification query: `prisma.notificationDelivery.findMany` with `select`
     including the recipient's email/name via the notification relation.
   - Outbound query: `prisma.outboundDelivery.findMany`. Recipient email is
     hashed server-side (`hashRecipient` from
     `src/lib/observability/notification-delivery.ts`) before the `where`
     clause.
   - Cap at 200 per source. Order by `updatedAt` (notification) /
     `createdAt` (outbound) desc.

2. **Server actions** — `admin-delivery-actions.ts`:
   - `"use server"` header.
   - `searchDeliveriesAction(input: unknown): Promise<ActionResult<DeliveryRow[]>>`.
   - Calls `requireAdmin()` FIRST. Zod-parses input. Delegates to the repository.
   - Returns `{ ok: true, data }` / `{ ok: false, message }`.

3. **Page** — `src/app/admin/deliveries/page.tsx`:
   - `searchParams: Promise<{ recipient?; event?; state?; channel?; source?; since?; until? }>`
   - `await requireAdmin()`.
   - Awaits `searchParams`, calls `searchDeliveries` directly (server component
     — no need to route through the action for the initial render).
   - Renders `<DeliveryFilters />` and `<DeliveryTable rows={rows} />`.
   - Empty, no-results, and error states are strings inside the page — this
     is not the UI-polish PR.

4. **Filter component** — `delivery-filters.tsx`:
   - Client component. Reads current searchParams via `useSearchParams`.
   - Text inputs for recipient / event; selects for state, channel, source; two
     date inputs for since/until.
   - "Apply" navigates to same path with the query string set.
   - "Reset" pushes to `/admin/deliveries`.

5. **Table component** — `delivery-table.tsx`:
   - Renders one row per delivery: source badge, event/kind, channel, state
     badge, recipient (email for notification rows, "hash: <first 8 chars>" for
     outbound), `attemptCount`, `lastAttemptAt`, `updatedAt`.
   - Click a row to expand: shows full `failureReason`, `requestId`,
     `sentryEventId`, `metadata`.
   - No mutations. Read-only screen.

6. **Nav** — `admin/layout.tsx` gets a new item and `admin-sidebar.tsx` a new
   `deliveries` icon (Radio or Send).

7. **Test** — `delivery-diagnosis.test.ts`: mirrors
   `notification-acceptance.test.ts` style. Seeds one notification with a
   `failed` email delivery, one outbound with `FAILED` status, and asserts
   that `searchDeliveries` returns both, that the failure reason is preserved
   verbatim, that filtering by `state: failed` narrows to the two, and that
   filtering by `recipient` hashes correctly for outbound rows.

## 8. Guardrails for Cursor (DO NOT)

- Do NOT return raw email addresses for `OutboundDelivery` rows — the schema
  stores only a hash. The `recipient` field on outbound rows is
  `"hash:<first-8-of-recipientHash>"`.
- Do NOT add columns to `NotificationDelivery` or `OutboundDelivery`. This is a
  read-only surface over shipped tables.
- Do NOT modify `src/lib/admin-auth.ts` — Sohail-owned. Import `requireAdmin`.
- Do NOT modify `src/lib/email.ts` or `email-delivery.ts` — T-248/T-259 shipped.
- Do NOT introduce a client-side Prisma call. Repository is server-only.
- Do NOT use `Button asChild` on the filter form — CLAUDE.md button rule.
- Do NOT log the raw recipient email anywhere. Query with the hash, echo back
  only the hash prefix.
- Cap every query at 200 rows. No unbounded `findMany`.
- No `console.error` — use `logger` from `@/lib/logger`.

## 9. DB safety

**No schema changes.** No migration. No seed. This PR is additive and read-only
over shipped tables.

## 10. Verification

1. `npx tsc --noEmit` — must pass with no errors.
2. `npm run test:delivery-diagnosis` — the new acceptance test must pass.
3. `npm run test:notification-dispatch` and `npm run test:email-delivery` — must
   still pass (T-248 regression guard).
4. Manual browser walk-through:
   - Sign in as admin, visit `/admin/deliveries`, see a row for at least one
     recent notification delivery.
   - Force a Brevo failure (invalidate `BREVO_API_KEY` locally, trigger any
     event that dispatches — e.g. `profile.viewed`) and confirm the row lands
     with `state: failed` and a readable reason.
   - Simulate a bounce: mark a `NotificationDelivery` row `state: failed` +
     `failureReason: "bounced (5.1.1 no such user)"` with a raw update, confirm
     it appears with the reason verbatim.
   - Filter by state=failed, channel=email — both rows appear, others do not.

## 11. Commit message

```
feat(admin): T-268 email and notification delivery diagnosis console

Adds /admin/deliveries — a read-only search surface over NotificationDelivery
(T-248) and OutboundDelivery (T-259). Admin filters by recipient, event type,
channel, state, source, and date range; row expansion shows failureReason,
attemptCount, lastAttemptAt, requestId, and sentryEventId.

Covers TC-A-006.

- new: src/features/notification/delivery-diagnosis.ts (repository)
- new: src/features/notification/delivery-diagnosis.test.ts
- new: src/app/actions/admin-delivery-actions.ts
- new: src/app/admin/deliveries/page.tsx
- new: src/components/admin/delivery-filters.tsx
- new: src/components/admin/delivery-table.tsx
- edit: src/app/admin/layout.tsx (nav entry)
- edit: src/components/admin/admin-sidebar.tsx (icon)
- edit: package.json (test script)

Read-only. No schema changes. No modifications to email.ts, email-delivery.ts,
notification-service.ts, or admin-auth.ts.
```
