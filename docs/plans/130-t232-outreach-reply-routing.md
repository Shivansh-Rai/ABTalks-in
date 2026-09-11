# 130 — T-232: Outreach email and on-site reply routing

**Owner:** Zainab · **Task:** T-232 (Demo 1, date + wall 11 Sep) · **Test case:** TC-R-014 · **UAT:** UAT-08
**Depends on:** T-229 ✅ (PR #290), design **T-202 / UX-03** (see §6, approval A-1)
**Consumed by:** T-266 (admin recruiter detail reads outreach), T-249 (recruiter notification events)
**Branch base:** `upstream/master` @ `59f9a290`

## Approvals (11 Sep)

| # | Item | Outcome |
|---|---|---|
| A-1 | Build compose/thread screens without a UX-03 design | Shallika: "we try our best". Build to the criteria and expect a visual pass. |
| A-2 | Two new tables + production migration | Sohail: yes. |
| A-3 | Optional `replyTo` on `sendEmail`, `no-reply@abtalks.in` for outreach | Sohail and Suyash: yes. **Condition (Suyash):** replies are web-only, so the email must say explicitly *"Do not reply to this email; click the link to view the thread and reply."* A Gmail reply to `no-reply@` is lost, and TC-R-014 is tested as a web reply. |
| A-4 | `outreach.message_received` in-app-only event | Sohail: yes. |
| A-5 | Register the actions file under `OUTREACH` | Sohail: yes. |
| A-6 | Per-recruiter keying; revoked access blocks sending but keeps history | Sohail: yes. |

## Built (11 Sep): deviations from the plan below

| Plan said | Built | Why |
|---|---|---|
| Mount "Email candidate" in `candidate-inspector.tsx` | Mounted in `match-card.tsx` (in the unlock slot once `CONTACT_SHARED`) and on `/hire/requests` beside the revealed email | Commit `4b568d93` ("ui updated") removed contact display from the inspector; its Reveal buttons now open the plan gate. The inspector is untouched. |
| `emailFailureReason` = `sendEmail`'s redacted reason | A recruiter-readable sentence (`readableEmailFailure`); the technical reason stays on the linked `OutboundDelivery` row | The raw reason is `BrevoError: Status code: 401 Body: {…}`, which is not readable for a recruiter. |
| Email HTML built inline | `buildOutreachEmail()` exported and tested by behaviour | Escaping and notice order proved directly, not only by source text. |
| DB safety step 3: `migrate dev --create-only` | `migrate diff` (committed schema → new schema) + `migrate deploy` on the dev branch | The dev DB (`ep-proud-sky-ayl98f6m`) has `20260909120000_workshop_events` applied, but PR #274 deleted that file, so `migrate dev` demanded a full reset. The SQL is identical: create-only, no ALTER/DROP on existing tables. |
| Checkpoint commit hash | Clean base `59f9a290` (upstream/master) | No commit made without the developer asking. |
| `unlock-contact.test.ts` untouched | Its `hasContactAccess` assertion now checks the query rather than the whole function text | T-259 wrapped the function in logging and the whole-text match went red on master. Access logic is unchanged. |

**Results:** `test:outreach` 27/27 · `db:check:outreach` 31/31 (dev branch) · `test:unlock` 21/21 ·
`test:recruiter-workspace` 16/16 · rate-limit-policy 6/6 · `tsc` clean (except the existing
`notify.test.ts` errors) · lint 0 errors · `npm run build` passes.

---

## 1. Goal

A recruiter who has unlocked a candidate emails them from inside ABTalks. The
candidate replies **on ABTalks** (Sohail's ruling, 11 Sep: no inbound email
parsing), and the reply reaches **that recruiter only**: in their `/hire`
messages, as a notification, and as an email to their own work address. Every
message and every send failure is saved with a readable reason.

## 2. Current behaviour

- **Outbound mail:** `sendEmail` (`src/lib/email.ts`) is the only way mail
  leaves the app (Brevo). Every call writes an `OutboundDelivery` row with a
  redacted `failureReason` (T-259). **Every email carries one global Reply-To**
  (`REPLY_TO_EMAIL`, defaulting to `team@abtalks.in`). For outreach that is a
  shared inbox, which T-232's regression guard forbids.
- **Inbound mail:** nothing. There is no webhook route and no inbound domain. Per
  the ruling above, none is added.
- **Access gate:** `hasContactAccess(recruiterUserId, candidateUserId)` and
  `loadProtectedContact` (`src/features/hire/contact-access.ts`) decide who may
  see a candidate's email. Access is `TalentEngagementRequest.status ===
  "CONTACT_SHARED"`, written by the T-229 unlock or by an admin introduction.
  **Access is per recruiter user, not per organization.**
- **Notifications:** `dispatch()` (`src/features/notification/notification-service.ts`,
  Manuvrtti's T-248) is real: it deduplicates on `eventType:recipient:primaryEntityId`,
  writes `UserNotification` (which the bell reads) plus `NotificationDelivery`, and
  sends email inline for `important` events unless the user opted out.
  **`outreach.reply_received` is already registered** (important,
  email on by default) and **already has templates**
  (`templates/outreach.reply_received.{html,txt}`). `notifyUser` in `notify.ts`
  is a no-op stub, so this task does not use it.
- **Rate limiting:** the `OUTREACH` bucket (30 per 15 min) exists in
  `src/lib/rate-limit-policy.ts`, and its `files: []` entry carries the comment
  *"Unlock / outreach are Zainab's Demo 1 actions. When those files exist they
  must import assertRateLimit"*.
- **`TalentEngagementMessage` is not suitable.** It is the recruiter↔ABTalks-team
  comment thread on an introduction request, and `/admin/hire` renders it. Putting
  private recruiter↔candidate mail there would show it to admins and mix two
  meanings, so outreach gets its own tables.
- **The `/hire` desk has no notification bell.** `HireChrome` / `HireSidebar`
  never mount `NotificationBell`, so a recruiter bell notification is only visible
  off-desk. The in-app signal on `/hire` therefore has to be an unread count on a
  new Messages link (§5, step 9).
- **There is no candidate messages surface.** `/messages` is unused.

## 3. Decisions

| # | Decision | Ruling |
|---|---|---|
| **O-1** | Where replies happen | On ABTalks. The candidate replies at `/messages/[threadId]`. There is no inbound email parsing. |
| **O-2** | Thread identity | One thread per **(recruiterUserId, candidateUserId)**, `@@unique`. Keyed on the recruiter **user**, not the org: every recruiter works alone (demo contract §2), and `hasContactAccess` is per user. |
| **O-3** | Who may send | A recruiter, only if `hasContactAccess` is true **at send time**. The candidate's address comes from `loadProtectedContact`, which is the existing gate; it is reused, not re-implemented. |
| **O-4** | Who may reply | Only the thread's `candidateUserId`, from the session. A thread id belonging to someone else is **not found**, never "forbidden". |
| **O-5** | Idempotency | Every send/reply carries a client-generated `clientRequestId` (uuid). `@@unique([threadId, clientRequestId])` means a double-click or retry writes one message and sends one email. |
| **O-6** | Email to the candidate | Sent directly with `sendEmail` (kind `outreach.message`, subject `OutreachMessage:<id>`), so the result lands on **that message row**. A failure is stored as `emailStatus = FAILED` plus `sendEmail`'s already-redacted reason. The message is still saved and still visible to the candidate on-site; a failed email does not lose the message. |
| **O-7** | Reply-To on outreach mail | **Needs approval (A-3).** Proposed: an optional `replyTo` on `sendEmail`, set to `OUTREACH_REPLY_TO` (default `no-reply@abtalks.in`). The email body says replies to it are not read and links to the on-site thread. Without this, a candidate pressing "Reply" in Gmail lands in `team@abtalks.in`, a shared inbox. |
| **O-8** | Telling the recruiter | After the reply commits, `dispatch({ eventType: "outreach.reply_received", recipientUserId: thread.recruiterUserId, primaryEntityId: message.id, href: "/hire/messages/<threadId>" })`. That gives one bell row and one email to the recruiter's own work address, deduplicated by message id. Called **after** the transaction, never inside it (notify.ts caller obligation). |
| **O-9** | Telling the candidate in-app | **Optional, needs approval (A-4).** Register `outreach.message_received` with `priority: "low"` so `dispatch` writes the bell row but never emails; the outreach email itself (O-6) is the email. If A-4 is refused, drop step 4. The candidate still gets the email with a link. |
| **O-10** | Unread | `recruiterLastReadAt` / `candidateLastReadAt` on the thread, set when the owning side opens it. Unread means `lastMessageAt > lastReadAt` **and** the last message came from the other side. |
| **O-11** | What each side sees | Candidate: the recruiter's name and company, never the recruiter's email. Recruiter: the candidate's name (already paid for). Admin: nothing in this task (T-266). |
| **O-12** | Access revoked after messages exist | If `hasContactAccess` later turns false, the recruiter cannot **send** (O-3), but the existing history stays readable to both sides. The candidate can still reply, because they started nothing and lose nothing. |

## 4. Files to touch

| Path | | Note |
|---|---|---|
| `prisma/schema.prisma` | [edit] | `OutreachThread`, `OutreachMessage`, enums `OutreachAuthor`, `OutreachEmailStatus`; back-relations on `User` (named) and `Organization`. **Approval A-2.** |
| `prisma/migrations/20260911120000_t232_outreach/migration.sql` | [new] | Generated by `migrate dev --create-only`, read before applying. |
| `src/features/hire/outreach.ts` | [new] | `server-only`. All reads and writes for both personas, each scoped to the session user. |
| `src/lib/validations/hire-outreach.ts` | [new] | Zod schemas for the three actions. |
| `src/app/actions/outreach-actions.ts` | [new] | `sendOutreachAction`, `recruiterReplyAction`, `candidateReplyAction`: Zod, rate limit, result envelope. |
| `src/lib/email.ts` | [edit] | Optional `replyTo?: string` param, defaulting to today's `REPLY_TO`. No behaviour change for existing callers. **Approval A-3.** |
| `src/lib/rate-limit-policy.ts` | [edit] | `OUTREACH.files = ["src/app/actions/outreach-actions.ts"]`. **Approval A-5.** |
| `src/features/notification/event-types.ts` | [edit] | Add `outreach.message_received` (low, in-app only). **Approval A-4, optional.** |
| `src/components/hire/outreach-compose-dialog.tsx` | [new] | Client. Subject + message, cost-free, send state, email-failure notice. |
| `src/components/hire/candidate-inspector.tsx` | [edit] | "Email candidate" button next to revealed contact details; "Open conversation" if a thread exists. |
| `src/components/outreach/outreach-thread.tsx` | [new] | Server. Renders a message list from plain data (both personas). |
| `src/components/outreach/outreach-reply-box.tsx` | [new] | Client. Textarea + send; picks the action by a `persona` string prop. |
| `src/app/hire/messages/page.tsx` | [new] | Server. Recruiter's thread list, unread first. |
| `src/app/hire/messages/[threadId]/page.tsx` | [new] | Server. Recruiter thread + per-message email status + reply box. Not found if not theirs. |
| `src/app/messages/page.tsx` | [new] | Server. Candidate's thread list. `auth()`, then redirect to `/login` if signed out. |
| `src/app/messages/[threadId]/page.tsx` | [new] | Server. Candidate thread + reply box. Not found if not theirs. |
| `src/app/hire/layout.tsx` | [edit] | Compute `unreadMessages` for an active recruiter; pass it to `HireChrome`. |
| `src/components/hire/hire-chrome.tsx` | [edit] | Pass `unreadMessages` through to `HireSidebar`. |
| `src/components/hire/hire-sidebar.tsx` | [edit] | "Messages" link to `/hire/messages` with the unread count. |
| `src/features/hire/outreach.test.ts` | [new] | Pure + source assertions. |
| `prisma/scripts/check-outreach.ts` | [new] | DB proofs (isolation, gate, idempotency, failure logging, notification). |
| `package.json` | [edit] | `test:outreach`, `db:check:outreach`, both `cross-env`-prefixed. |
| `docs/CHANGELOG.md` | [edit] | One `## Pending reconcile` line. |

**Must not change:** `contact-access.ts`, `unlock-contact.ts`, `unlock-transaction.ts`,
`notification-service.ts`, `email-delivery.ts`, `middleware.ts`, `auth.config.ts`,
`hire-request-actions.ts`, `TalentEngagementMessage`.

## 5. Steps

1. **Schema** (`prisma/schema.prisma`):

   ```prisma
   enum OutreachAuthor { RECRUITER CANDIDATE }
   enum OutreachEmailStatus { PENDING SENT FAILED SKIPPED NONE }

   model OutreachThread {
     id                   String   @id @default(cuid())
     recruiterUserId      String
     organizationId       String
     candidateUserId      String
     /// The CONTACT_SHARED engagement that allowed the first message. Provenance for T-266/T-267.
     engagementId         String?
     subject              String
     lastMessageAt        DateTime @default(now())
     lastMessageBy        OutreachAuthor
     recruiterLastReadAt  DateTime?
     candidateLastReadAt  DateTime?
     createdAt            DateTime @default(now())
     updatedAt            DateTime @updatedAt

     recruiter    User         @relation("OutreachThreadsAsRecruiter", fields: [recruiterUserId], references: [id], onDelete: Cascade)
     candidate    User         @relation("OutreachThreadsAsCandidate", fields: [candidateUserId], references: [id], onDelete: Cascade)
     organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
     messages     OutreachMessage[]

     @@unique([recruiterUserId, candidateUserId])
     @@index([recruiterUserId, lastMessageAt(sort: Desc)])
     @@index([candidateUserId, lastMessageAt(sort: Desc)])
   }

   model OutreachMessage {
     id                 String              @id @default(cuid())
     threadId           String
     author             OutreachAuthor
     authorUserId       String?
     body               String
     clientRequestId    String
     /// Only RECRUITER messages are emailed (to the candidate). CANDIDATE replies are NONE here;
     /// the recruiter's copy goes through dispatch() and is tracked on NotificationDelivery.
     emailStatus        OutreachEmailStatus @default(NONE)
     emailFailureReason String?
     emailDeliveryId    String?
     createdAt          DateTime            @default(now())

     thread OutreachThread @relation(fields: [threadId], references: [id], onDelete: Cascade)
     authorUser User?      @relation("OutreachMessagesAuthored", fields: [authorUserId], references: [id], onDelete: SetNull)

     @@unique([threadId, clientRequestId])
     @@index([threadId, createdAt])
   }
   ```

   (`authorUser`, not `author`, because `author` is the enum column.) Add the three
   back-relation arrays on `User` and `outreachThreads OutreachThread[]` on
   `Organization`. Cascade on candidate delete is deliberate: T-217
   self-deletion must take the candidate's messages with it.

2. **Migration**: follow §7 exactly.

3. **`src/lib/email.ts`** (after A-3): add `replyTo?: string` to the options,
   and `replyTo: { email: opts.replyTo ?? REPLY_TO }`. Nothing else changes.

4. **`event-types.ts`** (after A-4; skip if refused): add
   `"outreach.message_received": { key, label: "Message from a recruiter", priority: "low", suppressionExempt: true, emailExempt: false, defaultEmailEnabled: false }`.
   No template is needed because `low` never emails.

5. **`src/lib/validations/hire-outreach.ts`**:
   - `sendOutreachSchema = { candidateRef: string min 1 max 200, subject: string trim 1..150, body: string trim 1..5000, clientRequestId: uuid }`
   - `threadReplySchema = { threadId: cuid, body: string trim 1..5000, clientRequestId: uuid }`

6. **`src/features/hire/outreach.ts`** (`import "server-only"`):
   - Local `escapeHtml` (the repo keeps this local per file; three copies exist, so match that).
   - `sendRecruiterMessage({ recruiterUserId, organizationId, candidateUserId, engagementId, subject?, body, clientRequestId, recruiterName, company })`:
     1. `loadProtectedContact(recruiterUserId, candidateUserId)`. Null means refuse with "Unlock this candidate before messaging them." **This is O-3; there is no other access check.**
     2. One `prisma.$transaction` (`{ maxWait: 20000, timeout: 20000 }`): upsert the thread on the unique pair (create sets `subject`, `organizationId`, `engagementId`), then create the message (`author: RECRUITER`, `emailStatus: PENDING`) and update the thread's `lastMessageAt` / `lastMessageBy` / `recruiterLastReadAt`. If the insert hits a unique violation on `(threadId, clientRequestId)`, it is a retry: return the existing message and send nothing.
     3. After commit: `sendEmail({ to: contact.email, replyTo: OUTREACH_REPLY_TO, kind: "outreach.message", subjectType: "OutreachMessage", subjectId: message.id, subject: \`${recruiterName} at ${company}: ${thread.subject}\`, html, text })`. The body is escaped, followed by a "Reply on ABTalks" link to `${NEXT_PUBLIC_APP_URL}/messages/${threadId}` and, **above the message** so it can't be missed, the line "Do not reply to this email — replies to it are not delivered. Click the link to view the conversation and reply to ${recruiterName} on ABTalks." (A-3 condition.)
     4. Write the result onto the message: `SENT`, `SKIPPED` (with reason) or `FAILED` (with reason), plus `deliveryId`.
     5. (A-4) `dispatch({ eventType: "outreach.message_received", recipientUserId: candidateUserId, primaryEntityId: message.id, title: \`${recruiterName} at ${company} sent you a message\`, href: \`/messages/${threadId}\` })`.
     6. Return `{ threadId, messageId, emailStatus, emailFailureReason }`.
   - `sendCandidateReply({ candidateUserId, threadId, body, clientRequestId })`: `findFirst({ where: { id: threadId, candidateUserId } })`, then **not found** if missing. The same transaction shape writes `author: CANDIDATE`, `emailStatus: NONE` and sets `candidateLastReadAt`. After commit: `dispatch("outreach.reply_received" → thread.recruiterUserId, primaryEntityId: message.id, title: \`${candidateName} replied\`, body: first 280 chars, href: \`/hire/messages/${threadId}\`)`. A dispatch failure is logged and does **not** fail the reply, because the message is already saved.
   - Reads, each with explicit `select` and always filtered by the session user id: `listRecruiterThreads(recruiterUserId)`, `getRecruiterThread(recruiterUserId, threadId)` (also stamps `recruiterLastReadAt`), `listCandidateThreads(candidateUserId)`, `getCandidateThread(candidateUserId, threadId)` (stamps `candidateLastReadAt`), and `countUnreadForRecruiter(recruiterUserId)`.
   - The candidate never receives `recruiterUserId`'s email, and no select on the candidate path touches `User.email`.

7. **`src/app/actions/outreach-actions.ts`** (`"use server"`):
   - `sendOutreachAction(input)`: Zod, then `requireRecruiterWorkspace()`, then `assertRateLimit({ bucket: "OUTREACH", subjectId: userId })`, then `resolveEligibleCandidates([candidateRef])` (refuses `SAMPLE:` and out-of-pool refs), then load recruiter name/company from `RecruiterProfile`, then `sendRecruiterMessage`. Revalidate `/hire/messages`.
   - `recruiterReplyAction(input)`: Zod, then workspace, then rate limit, then load the thread **scoped to `recruiterUserId`** (not found otherwise), then `sendRecruiterMessage` with the thread's pair.
   - `candidateReplyAction(input)`: Zod, then `auth()` (signed in, otherwise "Sign in to reply."), then rate limit (subject = userId), then `sendCandidateReply`. Revalidate `/messages/[id]`.
   - All return `{ ok: true, data } | { ok: false, message }`. None accepts a recruiter id, org id, candidate user id or email from the client. Errors go through `logger`, never `console.error`.

8. **UI, recruiter**:
   - `outreach-compose-dialog.tsx` (client): props `candidateRef: string`, `candidateName: string`, `existingThreadId: string | null`. It generates `clientRequestId` once per open via `crypto.randomUUID()`, disables the button while pending, and on `emailStatus` FAILED/SKIPPED shows "Saved on ABTalks, but the email didn't send: <reason>".
   - `candidate-inspector.tsx`: where the revealed contact renders, add the dialog trigger. Nothing is shown while locked.
   - `/hire/messages` and `/hire/messages/[threadId]` (server): `requireRecruiterWorkspace()`, then `notFound()` for someone else's id. Each recruiter message shows a small delivery line: Emailed · Not emailed: reason.

9. **Unread count on the desk**: `hire/layout.tsx` calls `countUnreadForRecruiter(userId)` only when `active`, and passes the number through `HireChrome` to `HireSidebar` as a "Messages" item with a badge. It is a plain number, safe across the server→client boundary.

10. **UI, candidate**: `/messages` and `/messages/[threadId]` (server): `auth()`, redirect to `/login?callbackUrl=…` if signed out. They use the same `OutreachThread` view, plus `OutreachReplyBox persona="candidate"`. The header says "Replies go only to <recruiter name> at <company>."

11. **Rate-limit registry** (after A-5): add the actions file to `OUTREACH.files`.

12. **Tests + scripts + CHANGELOG** (§8).

## 6. Server vs Client

| Component | Kind | Boundary notes |
|---|---|---|
| `app/hire/messages/page.tsx`, `[threadId]/page.tsx` | Server | Pass plain arrays of `{ id, author, body, createdAt: string, emailStatus, emailFailureReason }`. |
| `app/messages/page.tsx`, `[threadId]/page.tsx` | Server | Same shape, minus the email fields. |
| `components/outreach/outreach-thread.tsx` | Server | Pure render from props. |
| `components/outreach/outreach-reply-box.tsx` | **Client** | Props `threadId: string`, `persona: "recruiter" \| "candidate"`. It imports both server actions itself. **No function is passed as a prop.** |
| `components/hire/outreach-compose-dialog.tsx` | **Client** | Strings only. |
| `components/hire/candidate-inspector.tsx` | Client (existing) | Adds a child client component; no new cross-boundary props. |
| `app/hire/layout.tsx` | Server (existing) | New `unreadMessages: number` → `HireChrome` (client). Number only. |
| `hire-chrome.tsx`, `hire-sidebar.tsx` | Client (existing) | Receive a number. No icons or class instances cross. |

**Design:** UX-03 (T-202) gates T-232, but its screen list covers only the
unlock, credits and plans screens. **No outreach compose or thread screen has
been designed.** Build to the textual acceptance criteria with the existing
`hire-*` / shadcn patterns and expect a visual pass (A-1).

## 7. DB safety

1. Commit the code checkpoint (schema edit only) and record the hash here: `______`.
2. Take a **Neon branch snapshot** of production and record the branch name: `______`.
3. `npx prisma migrate dev --create-only --name t232_outreach` against the **dev
   branch**. Read the SQL: it must be only `CREATE TYPE` ×2, `CREATE TABLE` ×2,
   indexes and FKs, with **no `ALTER`/`DROP` on existing tables**.
4. `npx prisma migrate dev` (dev branch), then `npx prisma generate`.
5. `npm run db:check:outreach` against the dev branch.
6. Production `prisma migrate deploy` is **a separate step, approved by
   Sohail (A-2)**. It is additive, and no backfill is needed.

## 8. Verification

**Automated (`test:outreach`, pure + source assertions):**
1. No action reads `recruiterUserId`, `organizationId`, `candidateUserId` or an email from its input schema.
2. `sendRecruiterMessage` calls `loadProtectedContact` before any write.
3. Every read in `outreach.ts` filters on the session user id (source assertion on each `where`).
4. The transaction options are `{ maxWait: 20000, timeout: 20000 }`.
5. `dispatch` is not called inside `$transaction`.
6. `outreach-actions.ts` imports `assertRateLimit` (the rate-limit policy test also enforces this once A-5 lands).
7. Recruiter-authored text is HTML-escaped in the email body.
8. `contact-access.ts` and `unlock-contact.ts` are unchanged (hash assertion, the same pattern as `unlock-contact.test.ts`).

**DB proofs (`db:check:outreach`, dev branch):**
9. Recruiter without access → refused, no thread, no message, no email attempt.
10. Recruiter with access → one thread, one message, one `OutboundDelivery` row, and `emailStatus` matches the delivery.
11. Same `clientRequestId` twice, including concurrently → one message, one send.
12. Recruiter B (same org domain) reading or replying to A's thread id → not found (TC-R-014 regression guard).
13. Candidate C2 replying to C1's thread → not found.
14. Candidate reply → one `UserNotification` for **that recruiter only**, `eventType = outreach.reply_received`, and a replay of the same reply produces no second notification.
15. Forced send failure (`BREVO_API_KEY=invalid`) → `emailStatus = FAILED`, readable `emailFailureReason`, message still stored.

**Manual (TC-R-014 / UAT-08), dev server:**
- As recruiter A, unlock a candidate, then Email candidate. The message shows in `/hire/messages` as "Emailed", and the candidate's real inbox gets it with a "Reply on ABTalks" link.
- As the candidate, open the link, reply, and check the header names recruiter A only.
- As recruiter A: the Messages badge shows 1, the reply appears in the thread, and A's work inbox gets the `outreach.reply_received` email.
- As recruiter B on the same domain: `/hire/messages` is empty, and pasting A's thread URL returns not found.
- Restart with `BREVO_API_KEY=invalid`, send: "Saved on ABTalks, but the email didn't send: …" appears, and the `OutboundDelivery` row is `FAILED` with a reason.
- Double-click Send: one message.
- Locked candidate: no Email button is shown, and calling the action directly is refused.

**Gates:** `npx tsc --noEmit`, `npm run lint`, `npm run build`, `test:outreach`,
`test:unlock`, `test:credits`, `test:recruiter-workspace`, and `test:demo1-security`
(which needs `cross-env`; flag it to Sohail, don't edit it).

**Files that should have changed:** exactly the §4 list, and nothing under "Must not change".

## 9. Commit message

```
feat(outreach): recruiter emails an unlocked candidate; reply on ABTalks routes to that recruiter (T-232)

- OutreachThread/OutreachMessage, one thread per recruiter+candidate
- send gated by loadProtectedContact; idempotent on clientRequestId
- per-message email status + redacted failure reason
- candidate replies at /messages; outreach.reply_received to the sender only
- /hire/messages with unread count; OUTREACH rate limit

TC-R-014
```

## 10. Guardrails for Cursor (DO NOT)

- **DO NOT** add inbound email parsing, a webhook route, or any MX/DNS dependency (O-1).
- **DO NOT** use `TalentEngagementMessage` or `/admin/hire` for outreach.
- **DO NOT** add an access check beside `loadProtectedContact` / `hasContactAccess`, and do not modify `contact-access.ts`.
- **DO NOT** accept a recruiter id, org id, candidate user id, email address or recipient from the client.
- **DO NOT** call `dispatch` or `sendEmail` inside `prisma.$transaction`.
- **DO NOT** key threads on `organizationId`. Two recruiters in one org must not share threads.
- **DO NOT** expose the recruiter's email to the candidate, or the candidate's email to anyone without access.
- **DO NOT** touch `middleware.ts` or `auth.config.ts`; the pages check `auth()` themselves.
- **DO NOT** edit `notification-service.ts`, `email-delivery.ts` or the dashboard nav (other owners' domains).
- **DO NOT** render recruiter- or candidate-written text as HTML anywhere; escape it in email and render it as text in React.
- **DO NOT** pass functions, icons or class instances from Server to Client components.
- **DO NOT** fail a candidate reply because a notification failed; log it and keep the saved message.
- **DO NOT** use `console.error`; use `logger`.
