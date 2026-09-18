# 153 — Profile-view notification: email arrives, bell stays quiet

## 1. Goal
Fix the reported bug where a recruiter viewing a candidate's profile results
in the OTP-style email landing in the candidate's inbox but the in-app bell
never showing the notification.

## 2. Symptom
User report (2026-09-18):
> "if any recruiter see my profile so mail is going to that candidate but no
> notification on candidate side"

Confirmed by tracing: the `UserNotification` row IS being written to the DB
on every profile view (verified via the T-251 dispatch flow and the write
transaction in `notification-service.dispatch`). The candidate's browser
just never re-fetches the feed after the row appears.

## 3. Diagnosis — write vs. read walkthrough

### 3a. Write path — correct
- `markMatchViewedAction` (or `getMyJobApplicantCardAction`) →
- `notifyProfileViewed(...)` in
  `src/features/profile-view-notification/service.ts` →
- `dispatch(...)` in `src/features/notification/notification-service.ts` →
- One transaction: `UserNotification.create({ recipientUserId: candidateUserId, ... })`
  + `NotificationDelivery(in_app, sent)` + (optional) `NotificationDelivery(email, created)`.
- If `emailDeliveryId` is set, `processEmailDelivery` fires the Brevo mail.

Both the row AND the email are inside the same transaction — if the email
went, the row exists. That matches the reported symptom exactly.

### 3b. Read path (server) — correct
`getNotificationsForUser` in `src/features/notification/get-notifications.ts`
queries `prisma.userNotification.findMany({ where: { recipientUserId }, ... })`.
`filterFeedForView(input, isRecruiter=false)` returns candidate arrays
untouched. So a candidate-role viewer sees every `profile.viewed` row.

### 3c. Read path (client) — **root cause**
`src/components/shared/notification-provider.tsx` was:

- **Fetch on mount only.** The provider set `loadedRef.current = true`
  after the first fetch and never refetched in that mount again.
- **60-second sessionStorage TTL.** Only used to decide whether to fetch
  on the NEXT mount, not on the current one.
- **No focus / visibility listener.** Nothing woke the provider up when
  the tab regained focus.

So the actual sequence in the field:

1. Candidate is signed in, has the header bell mounted, feed already
   loaded (`loadedRef.current = true`).
2. Recruiter opens candidate's profile → email fires → in-app row is
   written to `UserNotification` with `recipientUserId = candidateUserId`.
3. Candidate is still on the same page. Nothing tells the client to
   refetch. Bell shows the stale feed. Badge stays quiet.
4. Email hits the candidate's inbox. Candidate is confused.

The only way to see the new notification was to reload the tab or navigate
to a page that remounted `NotificationProvider` more than 60s after the
last mount.

## 4. Fix

### 4a. Refetch on tab-focus
Added a `visibilitychange` listener in the provider. When the tab becomes
visible again AND the provider has already loaded once (`loadedRef.current`),
call `refetchIfStale()`. Cheapest possible signal for "user is back —
show them the latest".

### 4b. Refetch when the bell opens
`openPanel()` now calls `refetchIfStale()` before the optimistic
mark-all-read. Fire-and-forget so the panel still opens instantly; the
fresh feed replaces the stale one when it lands.

### 4c. Cache windows
- `TTL_MS` reduced 60_000 → 20_000 (governs whether the first fetch on
  mount happens; smaller = faster catch-up after tab was in background).
- New `REFETCH_STALE_AFTER_MS = 10_000` (governs the focus / open
  refetches; small so a fresh refocus doesn't hit the network, but a
  meaningful pause does).

### 4d. Extracted `shouldRefetch` for testing
The `Date.now() - cachedAt > staleMs` predicate moved to
`src/features/notification/refetch-policy.ts` as a pure helper, so the
edge cases have a unit test the provider itself can't have (no client
component test harness in this project).

Bonus fix inside the helper: a `null`/`undefined` `cachedAt` returns
`true`, and a FUTURE `cachedAt` (clock drift, replayed test data) also
returns `true`. The old inline predicate returned `false` on a future
timestamp — a silent-bell hazard.

## 5. Files touched
- `src/components/shared/notification-provider.tsx` — TTL constant,
  `refetchIfStale`, `visibilitychange` effect, `openPanel` refetch call.
- `src/features/notification/refetch-policy.ts` `[new]` — pure predicate.
- `src/features/notification/refetch-policy.test.ts` `[new]` — 6 unit
  tests.

## 6. Ownership
Manuvrtti (Notifications / Notification delivery). Fully in-lane; no
cross-module edits.

## 7. Verification
- `npx tsc --noEmit` — clean.
- `npx tsx src/features/notification/refetch-policy.test.ts` — 6/6 pass.
- `npx tsx src/features/profile-view-notification/service.test.ts` —
  8/8 pass (unchanged, regression check).

### Manual test
1. Sign in as candidate `A` in tab 1. Open a page with the header
   (e.g. `/dashboard`). Bell renders, no unread badge.
2. Sign in as recruiter `R` in tab 2. Open candidate `A`'s profile
   from `/hire`.
3. Back in tab 1: click the bell within 10 seconds → the panel opens
   and shows *"You're getting noticed — 1 more recruiter viewed your
   profile."* (from plan 152 anonymised copy).
4. If you clicked the bell within 10 seconds of tab focus, the refetch
   ran on open. If you waited more than 10 seconds first, tab-focus
   already refetched.
5. Reload the recruiter tab and view the same profile again within
   the 24-hour rolling window → NO new notification on candidate side
   (T-251 dedup is preserved).
6. Wait 24h + 1s, re-view → a new notification appears in the bell on
   the candidate's next tab focus.

## 8. Commit message
```
fix(notifications): refetch bell on tab focus and panel open

Symptom: recruiter views candidate profile → email lands, bell stays
quiet. Cause: NotificationProvider fetched once on mount and never
refetched in that session, so any UserNotification created after the
candidate loaded a page never reached the bell until the tab was
reloaded.

- add a visibilitychange listener that refetches when the tab
  regains focus and the provider has already loaded
- refetchIfStale() from openPanel() so opening the bell always tries
  for the latest
- shorten TTL_MS 60s → 20s; new REFETCH_STALE_AFTER_MS = 10s governs
  the two live-event refetch paths
- extract the stale-cache predicate into refetch-policy.ts as a pure
  helper with 6 unit tests (also fixes a latent bug where a future
  cachedAt returned false, silently suppressing a refetch)
```
