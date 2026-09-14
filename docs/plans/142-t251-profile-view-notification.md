# 142 — T-251 Profile-view notification (TC-C-018)

**Status:** DRAFT FOR REVIEW. Not signed, not approved, not started.
**Branch:** `feature/T-251-profile-view-notification` off `master` (upstream/master @ `ad17a3cd`).
**Owner:** Manuvrtti (self). Native module (jobs / notifications / notification delivery). Cross-owner touches routed to Sohail on schema (none this ticket) and Shallika on any product-surface copy.

## 1. Goal

As a candidate, I know when a real recruiter looked at me.

Concrete rules from the task grid:
- When a real recruiter opens a candidate's profile → the candidate is notified.
- At most ONCE per (recruiter, candidate) per **rolling 24 hours**. Repeated views inside the window notify nothing.
- In-app **always**, email **selectively** (user preference).
- **Automated / system reads never notify** (admin inspect, cron scans, migration jobs).
- Covers TC-C-018.

## 2. Current behavior

- **T-248 notification service** is live at
  [src/features/notification/notification-service.ts:49](../../src/features/notification/notification-service.ts#L49).
  `dispatch()` writes `UserNotification` + `NotificationDelivery(in_app, sent)` in one transaction, keyed unique on
  `dedupeKey`, and hands the email delivery to `processEmailDelivery`. Only
  `priority: "important"` events get the email path.
- **`profile.viewed` event is already registered** in
  [src/features/notification/event-types.ts:45-52](../../src/features/notification/event-types.ts#L45-L52),
  but at `priority: "low"` and `defaultEmailEnabled: false`. Nothing dispatches it today (grep confirms zero writer call sites).
- **Recruiter → candidate profile view happens in two client surfaces**:
  1. **Search / Scout desk** — [src/components/hire/scout-chat.tsx:743-762](../../src/components/hire/scout-chat.tsx#L743-L762)
     `openFromList()` calls `markMatchViewedAction` in an effect right after
     opening the `CandidateInspector`. Action lives at
     [src/app/actions/talent-project-actions.ts:116-141](../../src/app/actions/talent-project-actions.ts#L116-L141),
     gated by `requireApprovedRecruiter()`. Stamps `TalentRequestMatch.viewedAt`.
  2. **Jobs applicants desk** — [src/components/hire/jobs/job-applicants-desk.tsx:44-58](../../src/components/hire/jobs/job-applicants-desk.tsx#L44-L58)
     `open()` calls `getMyJobApplicantCardAction` when the recruiter clicks an
     applicant. Action at
     [src/app/actions/recruiter-job-actions.ts:293-326](../../src/app/actions/recruiter-job-actions.ts#L293-L326),
     gated by `requireRecruiterWorkspace()`. Currently a pure read.
- **Admin/system reads are deliberately excluded by design**. The admin
  view is [src/components/admin/talent-project-inspector.tsx](../../src/components/admin/talent-project-inspector.tsx)
  — a Server Component with NO writer imports. Its header comment (lines 8-29)
  states this explicitly: "an admin opening this page must change nothing at
  all — including the recruiter's `lastViewedAt`". Since the admin path
  never touches the action layer, adding the notification there means it
  physically cannot fire for admin reads. No extra gate needed.
- **Self-view guard** does not exist. A recruiter who is also a candidate
  could theoretically appear in their own results — must be excluded to
  prevent self-notification.

## 3. Files to touch

### Feature module (new)
- `[new]` `src/features/profile-view-notification/service.ts` — pure
  service: `notifyProfileViewed(deps, { candidateUserId, recruiterUserId })`.
- `[new]` `src/features/profile-view-notification/store.ts` — Prisma-backed
  `ProfileViewNotificationStore` with `findRecent(candidateUserId, recruiterUserId, since)`.
- `[new]` `src/features/profile-view-notification/service.test.ts` — TC-C-018
  scenarios against in-memory store + fake dispatch (rolling window, second
  recruiter, cross-user isolation).

### Notification wiring
- `[edit]` `src/features/notification/event-types.ts` — flip `profile.viewed`
  to `priority: "important"`, keep `defaultEmailEnabled: false` (this is
  the "selectively by email" — user opts in).
- `[new]` `src/features/notification/templates/profile.viewed.html`
- `[new]` `src/features/notification/templates/profile.viewed.txt`

### Producer hooks
- `[edit]` `src/app/actions/talent-project-actions.ts` — `markMatchViewedAction`
  awaits `notifyProfileViewed(...)` after the DB update succeeds. Failure
  logged but does not fail the recruiter's action (dedup makes retry safe).
- `[edit]` `src/app/actions/recruiter-job-actions.ts` — `getMyJobApplicantCardAction`
  fires `notifyProfileViewed(...)` after `loadApplicantMatchForOwnedJob`
  returns `ok`. The applicant's userId is available on the loaded row
  (we resolve it via `decodeCandidateRef` inside the fanout call).

### Plan doc
- `[new]` `docs/plans/142-t251-profile-view-notification.md` (this file).

## 4. Server vs Client

| Component | Kind | Notes |
|---|---|---|
| `src/features/profile-view-notification/*` | Server | `service.ts` pure so tests can import; `store.ts` and any file touching `prisma` gets `import "server-only"`. |
| `src/app/actions/*` | Server Action | `"use server"` already. Auth session inside the action, never trust the client. |
| `src/components/hire/scout-chat.tsx` | Client | UNCHANGED — its `markMatchViewedAction` call already carries `requestId + candidateUserId`. Producer wiring is server-side. |
| `src/components/hire/jobs/job-applicants-desk.tsx` | Client | UNCHANGED. |

No Server→Client function / icon / class-instance props.

## 5. Steps

### Step 1 — Event registry (upgrade)

[event-types.ts](../../src/features/notification/event-types.ts): change `profile.viewed`:

```ts
"profile.viewed": {
  key: "profile.viewed",
  label: "Profile viewed by a recruiter",
  priority: "important",       // was "low" — enables email path via T-248
  suppressionExempt: false,    // in-app is enforced, candidate can turn EMAIL off
  emailExempt: false,
  defaultEmailEnabled: false,  // "selectively" — opt-in
},
```

Adjust
[notification-acceptance.test.ts:143-193](../../src/features/notification/notification-acceptance.test.ts#L143-L193)
if it asserts on the old shape.

### Step 2 — Templates

`profile.viewed.html`:
```html
<div style="font-family: Inter, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <p style="color: #353535;">Hi {{recipientName}},</p>
  <h2 style="color: #000000; margin: 16px 0 8px;">{{title}}</h2>
  <p style="color: #353535;">{{body}}</p>
  <p><a href="{{baseUrl}}{{href}}" style="color: #03535F;">Open your profile on ABTalks &rarr;</a></p>
  <hr style="border: none; border-top: 1px solid #E9E9E9; margin: 24px 0;" />
  <p style="color: #A5A5A5; font-size: 12px;">
    Turn off profile-view emails at {{baseUrl}}/settings/notifications.
  </p>
</div>
```

`profile.viewed.txt`: analogous plain-text version.

### Step 3 — Store

`src/features/profile-view-notification/store.ts`:
```ts
import "server-only";
import { prisma } from "@/lib/db";

export type ProfileViewStore = {
  /** Returns true if a profile.viewed notification exists for
   *  (candidateUserId, recruiterUserId) with createdAt >= `since`. */
  hasRecentNotification(
    candidateUserId: string,
    recruiterUserId: string,
    since: Date,
  ): Promise<boolean>;
};

export function prismaProfileViewStore(): ProfileViewStore {
  return {
    async hasRecentNotification(candidateUserId, recruiterUserId, since) {
      const row = await prisma.userNotification.findFirst({
        where: {
          eventType: "profile.viewed",
          recipientUserId: candidateUserId,
          primaryEntityId: recruiterUserId,
          createdAt: { gte: since },
        },
        select: { id: true },
      });
      return row !== null;
    },
  };
}
```

### Step 4 — Service

`src/features/profile-view-notification/service.ts`:

```ts
import type { ProfileViewStore } from "./store";

export type DispatchFn = (event: {
  eventType: string;
  recipientUserId: string;
  primaryEntityId: string;
  title: string;
  body?: string;
  href?: string;
  metadata?: Record<string, unknown>;
}) => Promise<{ ok: true; deduplicated: boolean } | { ok: false; message: string }>;

export type ServiceDeps = {
  store: ProfileViewStore;
  dispatch: DispatchFn;
  now?: () => Date;
  loadRecruiterName?: (userId: string) => Promise<string | null>;
};

export const ROLLING_WINDOW_MS = 24 * 60 * 60 * 1000;

export type NotifyResult =
  | { ok: true; sent: true; notificationId?: string }
  | { ok: true; sent: false; reason: "self_view" | "window" }
  | { ok: false; message: string };

export async function notifyProfileViewed(
  deps: ServiceDeps,
  input: { candidateUserId: string; recruiterUserId: string },
): Promise<NotifyResult> {
  if (input.candidateUserId === input.recruiterUserId) {
    return { ok: true, sent: false, reason: "self_view" };
  }
  const now = (deps.now ?? (() => new Date()))();
  const since = new Date(now.getTime() - ROLLING_WINDOW_MS);

  const recent = await deps.store.hasRecentNotification(
    input.candidateUserId,
    input.recruiterUserId,
    since,
  );
  if (recent) return { ok: true, sent: false, reason: "window" };

  const recruiterName =
    (await deps.loadRecruiterName?.(input.recruiterUserId)) ?? "A recruiter";

  const res = await deps.dispatch({
    eventType: "profile.viewed",
    recipientUserId: input.candidateUserId,
    // primaryEntityId is the recruiter — that's what the rolling-window
    // query pivots on.
    primaryEntityId: input.recruiterUserId,
    title: `${recruiterName} viewed your profile`,
    body: "They opened your profile from a recruiter surface. You will not be notified again for this recruiter for the next 24 hours.",
    href: "/profile",
    metadata: { recruiterUserId: input.recruiterUserId, at: now.toISOString() },
  });

  if (!res.ok) return { ok: false, message: res.message };
  return { ok: true, sent: true };
}
```

### Step 5 — dedupeKey uniqueness note

`dispatch()` builds the dedupeKey as `${eventType}:${recipientUserId}:${primaryEntityId}` — that would keep only ONE lifetime `profile.viewed` per (candidate, recruiter). T-251 wants rolling 24h. So the primaryEntityId trick alone won't do — we drive dedup from our own query and pass a **rotating** primaryEntityId? No — cleaner: pass a bucket suffix in the recruiter id.

**Chosen approach:** pass primaryEntityId as `${recruiterUserId}#${bucketMinutes}` where `bucketMinutes = floor(now / (24*60*60*1000))`. This makes the dedupeKey rotate every 24h at UTC midnight and stops the `UserNotification.dedupeKey` unique index from silently blocking a legitimate second send after the window. Rolling-window enforcement still lives in our `hasRecentNotification` check; the bucket is defense-in-depth.

BUT — this creates a subtle problem for the store query: `primaryEntityId` in the DB will now be `${recruiterId}#{bucket}`, and searching for "any prior view by this recruiter" needs a prefix match. Change the store to query with `primaryEntityId: { startsWith: recruiterUserId + "#" }` OR keep primaryEntityId as the pure recruiter id and separately compute a **unique** dedupeKey by hand.

**Revised chosen approach (simpler):** stop overloading `primaryEntityId`. Keep it as the pure `recruiterUserId`. Compute a per-send unique dedupeKey OURSELVES and bypass the default builder by passing the key we want. That needs a small `dispatch()` API extension. **Or** — cleaner still — store the pure recruiter id in `primaryEntityId` and let the dedupeKey be built with a **rotating** bucket suffix on top:

I'll ship the second option: extend `DispatchEvent` with an optional `dedupeKey?: string`. When set, the service uses it; when unset, it falls back to today's formula. Backwards compatible — the T-250 fanout does not pass it, so its behavior is unchanged.

Concretely:
- `src/features/notification/notification-service.ts` — change `dispatch()` to accept optional `dedupeKey`:
  ```ts
  const dedupeKey = event.dedupeKey ?? buildDedupeKey(event.eventType, event.recipientUserId, event.primaryEntityId);
  ```
- The T-251 service computes `dedupeKey = profile.viewed:{candidate}:{recruiter}:${floor(now / (24*60*60*1000))}` and passes it. Any second call with the same 24h bucket dedupes at the DB level; a new bucket lets a new notification through.
- Store query becomes independent of dedupeKey — it selects by (eventType, recipientUserId, primaryEntityId, createdAt >= since). Two safety nets: window query + rotating dedupeKey.

### Step 6 — Wire into `markMatchViewedAction`

[talent-project-actions.ts](../../src/app/actions/talent-project-actions.ts):

```ts
// after the successful updateMany + revalidateHire:
try {
  await notifyProfileViewed(
    {
      store: prismaProfileViewStore(),
      dispatch: dispatchNotification,
      loadRecruiterName: (id) =>
        prisma.user.findUnique({ where: { id }, select: { name: true } }).then((u) => u?.name ?? null),
    },
    {
      candidateUserId: parsed.data.candidateUserId,
      recruiterUserId: gate.data.userId,
    },
  );
} catch (error) {
  logger.error("[profile-view] notify failed", { error: String(error) });
}
```

Wrapped in try/catch: recruiter's mark-viewed must succeed even if the notification path errors.

### Step 7 — Wire into `getMyJobApplicantCardAction`

Same shape inside `recruiter-job-actions.ts` after `loadApplicantMatchForOwnedJob` succeeds. The candidate's userId is on the returned card via `candidateRef` decode; simpler: read `parsed.data.candidateRef`, `decodeCandidateRef(ref)` → `parsed.id`.

### Step 8 — Templates load automatically

`template-renderer.ts` already resolves `${eventType}.html/txt` from disk with a generic fallback. No changes to the renderer.

### Step 9 — Tests

`src/features/profile-view-notification/service.test.ts`:

- **TC-C-018.1** — First view fires; sends exactly one dispatch.
- **TC-C-018.2** — Second view by same recruiter within 24h: no dispatch, returns `{ok:true, sent:false, reason:"window"}`.
- **TC-C-018.3** — Third view within 1h same recruiter: still no dispatch.
- **TC-C-018.4** — View by different recruiter within same hour: fires (different pair).
- **TC-C-018.5** — Advance clock 24h+1min, same recruiter re-views: fires again.
- **TC-C-018.6** — Self-view (candidateUserId === recruiterUserId): `{ok:true, sent:false, reason:"self_view"}`. No dispatch.
- **TC-C-018.7** — Dispatch returns `{ok:false}`: service returns `{ok:false}`. No crash.

## 6. Guardrails for Cursor (DO NOT)

- **DO NOT** wire the notification into `talent-project-inspector.tsx` (admin) or any Server Component that admins reach. The comment at lines 8-29 of that file is the contract.
- **DO NOT** call `notifyProfileViewed` from any cron, migration script, or non-authenticated code path — the trigger must be a recruiter session action.
- **DO NOT** change the primaryEntityId semantics. It stays the pure recruiterUserId. The rotating bucket lives in `dedupeKey` only.
- **DO NOT** add a WhatsApp / SMS transport (T-248 rule stands).
- **DO NOT** use `Button asChild` or `Button render={<Link>}`.
- **DO NOT** widen `dispatch()`'s signature in a way that breaks its two existing callers (T-250 fanout in `recruiter-jobs/service.ts` and `admin-job-actions.ts`). Add `dedupeKey?` as OPTIONAL only.
- **DO NOT** log the candidate's or recruiter's PII in the failure path — user ids only. `lib/logger.ts`, never `console.error`.

## 7. DB safety

**No schema change.** Reuses `UserNotification`. No migration, no backfill, no data risk.

Read-side impact: adds one indexed `findFirst` per profile view. The existing
`@@index([recipientUserId, createdAt(sort: Desc)])` on `UserNotification` covers
the query. No index change needed.

## 8. Verification

- `npx tsc --noEmit` — 0 errors, whole repo.
- `npx tsx src/features/profile-view-notification/service.test.ts` — 7 passing.
- Existing notification tests (`npm run test:notification-dispatch`, `:notification-acceptance`) — unchanged, still passing. `profile.viewed`'s priority change means one acceptance test that asserted the old "low" behavior may need updating.
- `npm run test:candidate-jobs` and `test:recruiter-jobs` — unchanged.
- Manual walk-through on prod after deploy (see §9).

## 9. Manual test on prod (TC-C-018 acceptance walk)

1. As **recruiter A**, sign in and open candidate `X`'s profile from scout desk. Watch the recruiter's server log for `[profile-view] dispatch ok`. Candidate X's bell should show *"Recruiter A viewed your profile"* within seconds.
2. Refresh and re-open X in the same tab; also open the applicant panel view of the same X on a job A owns. **No new notification** for either view.
3. Sign out A, sign in as **recruiter B**, open X. Candidate X's bell shows one new notification (one for A earlier, one for B now — count = 2).
4. Sign out B, sign in as **admin**, open X in the admin talent-project-inspector view. **No new notification.**
5. Wait until the 24h window from step 1 has passed (or use a test env where `now()` can be advanced). Recruiter A re-opens X. Candidate X's bell shows a fresh notification (window rolled).

## 10. Commit message

```
feat(hire): T-251 candidate profile-view notification

Notify a candidate at most once per (recruiter, candidate) per rolling
24 hours when a real recruiter opens their profile. In-app always, email
opt-in via NotificationPreference. Admin and system reads never notify
(admin inspector is a Server Component with no writer imports).

Reuses the T-248 dispatch and adds an optional dedupeKey pass-through
so the profile.viewed event key can rotate on a 24-hour bucket.

Refs: T-251, TC-C-018
```

---

## Not in scope

- Deep-linking the notification href to a "who viewed my profile" page — for now, `/profile` is the CTA. A future ticket may add a viewers list.
- Aggregation ("5 recruiters viewed you today") — T-251 is one-per-recruiter-per-24h, not a digest.
- Recruiter-visible signal ("candidate is aware"). Not requested.
- T-254 (UTM attribution / DebugView) — separate ticket the user mentioned alongside. Handled independently.
