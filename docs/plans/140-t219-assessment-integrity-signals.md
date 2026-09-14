# Plan 140 — T-219 Assessment integrity signals (strict mode)

**Ticket:** T-219 — `docs/ABTalks88.xlsx` → Team Execution Board row 84. Owner: Shivansh. Demo 2, wall 2026-09-14.
**Depends on:** T-218 (plan 129), T-244 (plan 128), T-243 (plan 121). **Feeds:** T-273 (admin assessment support reads these records).
**Status:** plan only. No code written. Verified against `ab-dev` at `9e2cc7b5` on 2026-09-14.

> **Local prerequisites (same as plans 121 / 128 / 129):** `/hire` sign-in needs
> `ENABLE_RECRUITER_AUTH=true`, and **`.env.local` points at the production database**
> (`ep-young-shadow-amawetjy`). Read §7 before `next dev`, `prisma generate` against a
> database, or any DB command.

### What the sources require

| Source | Text |
|---|---|
| Board row 84 — **What must be true** | "Fullscreen entry and exit, tab and window changes, visibility changes, copy and paste, page leave and timing are all recorded as fact against the attempt. Camera presence is recorded only where the camera is genuinely used with explicit permission. The product never claims eye-movement detection, second-monitor detection or certainty about cheating." |
| Board row 84 — **Manual test** | "Take an assessment and deliberately exit fullscreen, switch tabs, copy and paste, and leave the page. Confirm each signal is recorded with a timestamp against the attempt." |
| Board row 84 — **Acceptance** | "Every listed signal is recorded and visible on the attempt. No screen or document claims eye tracking, monitor detection or cheating certainty." |
| Board row 84 — **Regression guard** | "Do not make claims the browser cannot support." |
| Owner spec — **Fullscreen exit** | Exit → immediately blur questions/options → blocking modal *"Fullscreen Required — Please return to fullscreen mode to continue your assessment."* → on return remove blur + close modal → continue exactly where they left off → record exit time, return time, total duration outside. |
| Owner spec — **Tab / window** | Record when the candidate switches tabs or the browser loses focus, and when they return. |
| Owner spec — **Visibility / leave** | Record when the page becomes hidden or the candidate leaves it, and the return time. |
| Owner spec — **Copy / paste** | Detect, record **and block** copy, cut and paste. |
| Owner spec — **Timing** | Record how long the candidate was away from the exam. |
| Owner spec — **Event log** | Every event timestamped and attached to the attempt, e.g. `10:24 — Fullscreen exited`. |
| Owner spec — **No unsupported claims** | Never claim second monitors, eye movement, websites visited, whether they cheated, or whether someone helped. |
| Architecture rule 5 (workbook) | Idempotent under retry and duplication. |

### Decisions confirmed with the owner (2026-09-14)

| # | Decision |
|---|---|
| **D-1** | **Camera is a per-assessment recruiter setting, and when set it is required.** The candidate must allow the camera to start. If it stops mid-attempt (turned off, unplugged, permission revoked) the questions blur behind a **"Camera Required"** modal until it is back. Only **on/off** is recorded. No image or video leaves the device, and "camera on" is never presented as "a person was present". |
| **D-2** | **Phones cannot take strict assessments, and neither can a desktop browser that can't enter fullscreen.** There is no "allow and record" fallback. |
| **D-3** | **Paste is allowed only in file-link fields, and recorded.** Copy, cut, paste and drop are blocked everywhere else. |
| **D-4** | **Strict mode applies to every assessment published after this ships, fixed at publish.** There is no toggle. Assessments already published keep the T-218 behaviour. |

### Ownership check (`CLAUDE.md` mandatory rules)

- **TASK:** T-219 — strict mode for recruiter assessments: device + fullscreen + camera gates, blocking, recording page activity against the attempt, recruiter activity view.
- **MODULE:** Candidate-side assessments (T-218) and recruiter-side assessment builder / monitor (T-243 / T-244). Both are owned by Shivansh.
- **FILES TO MODIFY:** §3.

**CROSS-MODULE CHANGES REQUIRED — approve before implementation**

| Owner | Module | Files | Why | Proposed change |
|---|---|---|---|---|
| Sohail | Database architecture | `prisma/schema.prisma`, new migration | Recording needs tables; strict mode and camera need columns | Additive only: 1 enum, 2 columns, 2 tables (§5 step 1) |
| Sohail | Shared architecture / security | new `src/app/api/assessments/[assignmentId]/events/route.ts` | `navigator.sendBeacon` / `fetch(keepalive)` cannot call a Server Action, and page-leave facts are lost without one (§2.4) | One cookie-authenticated, same-origin POST route — an explicit exception to "Mutations via Server Actions" |
| Sohail | Database conventions | ingestion write | The Neon pooler drops interactive transactions (§2.4) | One nested Prisma `upsert` (Prisma's internal transaction), not `$transaction(async tx)` |
| Sohail | Authorization | `assessment-attempt-actions.ts` | Server-side phone refusal | Read the `Sec-CH-UA-Mobile` request header on start / save / submit |
| Sohail | Security tests | `src/features/hire/isolation.test.ts` | Keep the new route and page in the security suite | Two source-scan suites (append only) |
| Shared | `/hire` stylesheet | `src/app/hire/hire-scout.css` | Recruiter activity page | New `.hire-assess-activity*` rules only; nothing existing changes |
| Zainab | Legal (T-279) | **not edited here** | The privacy policy (`PRIVACY_VERSION 2026-09-09`) never mentions assessments | Must describe page-activity recording and camera on/off before production release |
| Shallika | UI/UX (T-203) | **not edited here** | Gate, modal and activity page are new screens | Built on existing assessment styles; design approval pending |

**Not touched:** `middleware.ts`, `src/auth.ts`, `src/auth.config.ts`, `src/features/notification/*`,
`src/components/dashboard-hub/*`, `src/lib/rate-limit*`, `package.json`, `prisma/cleanup.ts`.

---

## 1. Goal

For every recruiter assessment published from now on, a candidate can only take it on a laptop
or desktop, in fullscreen, with the camera on when the recruiter requires it, and with copy, cut
and paste blocked. Leaving fullscreen, or the camera stopping, blurs the questions behind a
blocking modal until the requirement is met again. Every fullscreen, visibility, focus, page-leave,
clipboard, upload-link and camera change is recorded with a timestamp against the attempt. The
recruiter sees those facts, and the time away they add up to, on a per-attempt activity page that
states plainly what the browser cannot tell anyone.

## 2. Current behavior — verified, not taken from status lines

### 2.1 Schema audit — **GO**

Checked against `prisma/schema.prisma`, the migrations, and the generated client
(`node_modules/.prisma/client/schema.prisma` is identical to the repo schema, ignoring whitespace).

| Model | Relevant facts |
|---|---|
| `RecruiterAssessment` | `status` (DRAFT/PUBLISHED/ARCHIVED), `durationMinutes?`, `passMarkPercent`, `publishedAt?`. **New since T-218:** `projectLink TalentProjectAssessment?` (migration `20260912090000_project_search_sessions`, cascades from `TalentRequest`; unrelated to assignments). No strictness or camera column exists. |
| `AssessmentQuestion` | `type` (MULTIPLE_CHOICE/PARAGRAPH/FILE_UPLOAD), `position`, `uploadDestinationUrl?`; `answers AssessmentAnswer[]` |
| `RecruiterAssessmentAssignment` | **= the attempt** (plan 128 §10, plan 129 §11: "T-219 … record them against `RecruiterAssessmentAssignment.id`"). `status` ASSIGNED/STARTED/SUBMITTED, `startedAt?`, `submittedAt?`, `scorePercent?`, `passed?`. Unique `(assessmentId, candidateUserId)`. FK assessment **RESTRICT**, candidate **CASCADE**. |
| `AssessmentAnswer` | `(assignmentId, questionId)` unique; assignment **CASCADE**, question **RESTRICT**; `@@index([questionId])` |

Nothing records browser activity today. Delete paths are safe for new child tables:
`prisma/cleanup.ts` deletes assignments before users (so children cascade first), and
`src/features/admin/anonymize-user.ts` does not touch assessments.

### 2.2 Candidate flow today (T-218, unchanged since `cdaa8cf6` except one banner string)

- `/assessments/[assignmentId]` → `AssessmentAttempt` (client) → `CandidateAssessmentScreen`,
  stages `instructions` → `taking` → `submitted`. Start calls `startAssessmentAttemptAction`, answers
  autosave via `saveAssessmentAnswerAction`, and submit is the guarded transaction.
- The screen has no device, fullscreen, camera, clipboard or visibility handling. Its instructions
  stage says "come back on any device", which strict mode will change.
- File-upload questions render the recruiter's link (`hire-cand-assess__upload-link`, new tab) and a
  URL input the candidate pastes into.

### 2.3 Recruiter side today

- `/hire/assessments/[assessmentId]` (monitor): a facts line and a table
  (Candidate / Status / Assigned / Started / Completed / Score / Result). `getAssessmentMonitor` reads
  through the workspace `Scope`, and a foreign id is `notFound()`.
- The builder has Duration / Untimed / Pass mark settings and a `hire-assess__note` (from presets).
  Publishing goes through `store.publish` → `updateMany … data: { status: "PUBLISHED", publishedAt }`.
- `presets.ts` types each template's `content` as `ContentInput` (five literals).

### 2.4 Platform facts that shape the design (each verified)

| Fact | Evidence | Consequence |
|---|---|---|
| No browser-signal code exists anywhere | grep for `requestFullscreen`, `visibilitychange`, `sendBeacon`, `paste`: only a "Future: requestFullscreen()" comment in the interview module | Greenfield; nothing to reuse or break |
| Toasts (`sonner`) and `components/ui/dialog` portal to `document.body` | `route-theme-toaster.tsx`, `dialog.tsx` `DialogPortal` | Fullscreen **must** target `document.documentElement`. An inner element would hide every portal. |
| React 19.2.4 supports the `inert` prop | `@types/react` `inert?: boolean` | Blocked content is made unfocusable and unreadable to assistive tech, not just visually blurred |
| Session cookie is `SameSite=Lax`, `HttpOnly` | `auth.config.ts` overrides only the cookie **name**; `@auth/core/lib/init.js` deep-`merge`s it with `defaultCookies`, whose `sessionToken` has `sameSite: "lax"` | A cross-site POST carries no session → a cookie-authenticated route is not CSRF-writable. An Origin check is added as defense in depth. |
| Authenticated mutation route precedent exists | `PUT /api/notification-preferences` uses `auth()` + envelope JSON | The route follows that shape |
| Server Actions need a `Next-Action` header | Next.js action protocol | `sendBeacon` and `fetch(keepalive)` cannot call them, and page leave needs one of those. Hence one Route Handler. |
| Interactive transactions through the Neon pooler fail | `project-context.md` §16; presets commit `773e400b` "replace interactive $transaction with nested writes"; `writeClient()` returns the **pooled** client when `ENABLE_DUAL_WRITE` is unset (it is unset locally) | Every T-219 write is a single Prisma operation (nested upsert or `updateMany`) |
| Fullscreen API availability | iPhone Safari and most in-app browsers have none; `document.fullscreenEnabled` is false when disallowed; `Esc` always exits and can't be prevented | D-2 gate; the exit modal is the only response to `Esc` |
| Chromium sends `Sec-CH-UA-Mobile` on every HTTPS request | low-entropy client hint (`?1` on phones, `?0` otherwise); Safari/Firefox send nothing | Server-side phone refusal is defense in depth for Chromium; the client gate covers all browsers |
| The privacy policy does not mention assessments | grep over `src/app/privacy`, `legal*` | Legal follow-up (Zainab, T-279) before production |
| Existing copy makes no detection claims | grep for eye/gaze/monitor/proctor/cheat: only the challenge **rules** text "Cheating or Platform Misuse" (a policy line, not a detection claim) | Nothing to remove; new copy is guarded by a test (§5 step 13) |

---

## 3. Files to touch

**Schema**
- `prisma/schema.prisma` [edit] — enum `AssessmentAttemptEventType`; models `AssessmentAttemptSession`, `AssessmentAttemptEvent`; columns `RecruiterAssessment.strictMode`, `.cameraRequired`; back-relations.
- `prisma/migrations/20260914120000_assessment_attempt_integrity/migration.sql` [new] — additive only.

**Shared**
- `src/lib/validations/assessment.ts` [edit] — event types + batch schema + limits; `cameraRequired` in the draft schema.

**Candidate server**
- `src/features/assessment-attempts/service.ts` [edit] — rules on load, device refusal, `recordAttemptEvents`.
- `src/features/assessment-attempts/prisma-store.ts` [edit] — new selects, `findEventContext`, `writeEventBatch`.
- `src/features/assessment-attempts/activity.ts` [new] — **pure** activity summary + all recruiter-facing copy + disclaimers.
- `src/app/actions/assessment-attempt-actions.ts` [edit] — pass the device hint.
- `src/app/api/assessments/[assignmentId]/events/route.ts` [new] — the one ingestion endpoint.

**Candidate client**
- `src/components/assessments/integrity-recorder.ts` [new] — plain TS event queue / transport (injected deps, unit-testable).
- `src/components/assessments/assessment-integrity.tsx` [new] — `"use client"`: pre-start checklist, the in-attempt guard (listeners, blur, modal, self-view), device/fullscreen/camera helpers.
- `src/components/assessments/assessment-attempt.tsx` [edit] — strict path: gates, fullscreen on Start, guard around the screen, clean-up on submit.
- `src/components/hire/assessment/candidate-assessment-screen.tsx` [edit] — `startPanel` / `startBlockedReason` / `resumeHint` props; `data-*` hooks for question, upload link and file-link input.
- `src/components/hire/assessment/candidate-assessment-screen.css` [edit] — blur, modal, self-view, checklist.
- `src/app/assessments/[assignmentId]/page.tsx` [edit] — pass `rules`.
- `src/app/assessments/page.tsx` [edit] — "Laptop or desktop · Fullscreen · Camera" chips.

**Recruiter**
- `src/features/recruiter-assessments/service.ts` [edit] — `strictMode` / `cameraRequired` on rows; monitor activity counts; `getAttemptActivity`.
- `src/features/recruiter-assessments/prisma-store.ts` [edit] — select/write `cameraRequired`; publish sets `strictMode`; `countActivityEvents`, `findAttemptActivity`.
- `src/features/recruiter-assessments/presets.ts` [edit] — `PresetContent` type; `cameraRequired: false` in the combined content.
- `src/components/hire/assessment/assessment-builder.tsx` [edit] — "Require camera" checkbox + strict-mode note.
- `src/app/hire/create-test/page.tsx` [edit] — `rowToDraft` maps `cameraRequired`.
- `src/app/hire/assessments/[assessmentId]/page.tsx` [edit] — strict/camera facts; Activity column.
- `src/app/hire/assessments/[assessmentId]/attempts/[assignmentId]/page.tsx` [new] — per-attempt activity page.
- `src/app/hire/hire-scout.css` [edit, shared] — `.hire-assess-activity*` rules.

**Tests / docs**
- `src/features/assessment-attempts/assessment-attempts.test.ts` [edit] — ingestion, summary, recorder, device refusal, copy guard.
- `src/features/recruiter-assessments/recruiter-assessments.test.ts` [edit] — strict at publish, camera setting, activity scoping.
- `src/features/hire/isolation.test.ts` [edit] — route + activity page scans.
- `docs/CHANGELOG.md` [edit] — one line, at implementation.

## 4. Server vs Client

| File | Boundary | Notes |
|---|---|---|
| `events/route.ts` | Server (Route Handler, Node runtime) | `auth()`, Origin check, Zod, envelope JSON |
| `activity.ts` | Server-used pure module | No React, no Prisma, no `server-only` (imported by tests) |
| `service.ts` / `prisma-store.ts` (both features) | Server only | Already `import "server-only"` |
| `assessment-attempt-actions.ts` | `"use server"` | |
| `integrity-recorder.ts` | Client-used plain TS | No React; DOM access only through injected deps |
| `assessment-integrity.tsx` | **Client** | Owns listeners; receives a `MediaStream` and callbacks from `AssessmentAttempt` — Client→Client, fine |
| `assessment-attempt.tsx`, `candidate-assessment-screen.tsx` | **Client** | |
| `/assessments/[assignmentId]/page.tsx` | **Server** | Passes `rules: { strictMode: boolean; cameraRequired: boolean }` — booleans only |
| `/hire/…/attempts/[assignmentId]/page.tsx` | **Server** | Renders everything itself; **no client component**; dates formatted on the server |
| `assessment-builder.tsx` | Client | New `cameraRequired` state |

**Server→Client props added:** `AssessmentAttempt.rules` (two booleans). No `Date`, function, icon
or class instance crosses from a Server Component. `MediaStream` exists only on the client.

---

## 5. Steps

### Step 1 — Schema (`prisma/schema.prisma`)

**1a.** In `RecruiterAssessment`, after `passMarkPercent`:

```prisma
  /// T-219: fixed at publish. Every assessment published after T-219 ships is
  /// strict: laptop/desktop only, fullscreen required, copy/cut/paste blocked,
  /// page activity recorded. Rows published before stay false and keep the
  /// T-218 behaviour. Only store.publish ever writes true.
  strictMode      Boolean                   @default(false)
  /// T-219: recruiter's builder setting — editable while DRAFT, fixed at
  /// publish. The candidate's camera must be on to see the questions. Only
  /// on/off is recorded; no image or video ever leaves the candidate's device.
  cameraRequired  Boolean                   @default(false)
```

**1b.** After `AssessmentAnswer`:

```prisma
/// T-219: what the candidate's page reported. Facts about the page, never
/// conclusions about the candidate — see src/features/assessment-attempts/activity.ts.
enum AssessmentAttemptEventType {
  SESSION_STARTED
  PAGE_LEFT
  FULLSCREEN_ENTERED
  FULLSCREEN_EXITED
  VISIBILITY_HIDDEN
  VISIBILITY_VISIBLE
  WINDOW_BLURRED
  WINDOW_FOCUSED
  COPY_BLOCKED
  CUT_BLOCKED
  PASTE_BLOCKED
  DROP_BLOCKED
  LINK_PASTED
  UPLOAD_LINK_OPENED
  CAMERA_ON
  CAMERA_OFF
}

/// T-219: one page lifetime of a strict attempt — a page load, or a restore
/// from the back/forward cache. clientSessionId is crypto.randomUUID() minted
/// by that page. firstSeenAt/lastSeenAt are SERVER receipt times, so how long a
/// page kept reporting is known without trusting the device clock.
///
/// CASCADE on the assignment: activity goes with the attempt it describes.
model AssessmentAttemptSession {
  id              String   @id @default(cuid())
  assignmentId    String
  clientSessionId String
  firstSeenAt     DateTime @default(now())
  /// Receipt time of the latest batch (events or heartbeat) from this page.
  lastSeenAt      DateTime @default(now())

  assignment RecruiterAssessmentAssignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  events     AssessmentAttemptEvent[]

  @@unique([assignmentId, clientSessionId])
  @@index([assignmentId, firstSeenAt])
}

/// T-219: one reported change on a strict attempt's page.
///
/// (assignmentId, sessionId, seq) is unique, so a batch resent after a network
/// failure, or sent by both fetch and sendBeacon, is stored once.
/// occurredAt = device time corrected to server time (see recordAttemptEvents);
/// clientOccurredAt keeps the raw device value for audit.
///
/// CASCADE through the session (and so the assignment). RESTRICT on the question,
/// matching AssessmentAnswer: a published assessment's questions never change.
model AssessmentAttemptEvent {
  id               String                     @id @default(cuid())
  assignmentId     String
  /// = AssessmentAttemptSession.clientSessionId
  sessionId        String
  seq              Int
  type             AssessmentAttemptEventType
  occurredAt       DateTime
  clientOccurredAt DateTime
  receivedAt       DateTime                   @default(now())
  /// The question an event happened in or about. Never any content.
  questionId       String?
  /// Repeats of the same blocked clipboard action within 1s, coalesced. 1 otherwise.
  count            Int                        @default(1)

  session  AssessmentAttemptSession @relation(fields: [assignmentId, sessionId], references: [assignmentId, clientSessionId], onDelete: Cascade)
  question AssessmentQuestion?      @relation(fields: [questionId], references: [id], onDelete: Restrict)

  @@unique([assignmentId, sessionId, seq])
  @@index([assignmentId, occurredAt])
  @@index([questionId])
}
```

**1c.** Back-relations (virtual, no column):
- `RecruiterAssessmentAssignment` after `answers`: `sessions AssessmentAttemptSession[]`
- `AssessmentQuestion` after `answers`: `attemptEvents AssessmentAttemptEvent[]`

**1d.** `npx prisma format` → `npx prisma validate` → revert any realignment of models this plan
doesn't touch (plans 128/129 both hit `OutboundDelivery`) → `npx prisma generate` (offline).

**Why this shape (consistency):**
- Events can't exist without a session, and a session can't exist without an assignment: the
  **composite FK** `(assignmentId, sessionId)` → `(assignmentId, clientSessionId)` makes a session id
  unusable across attempts, and the chain cascades cleanly.
- There are **no denormalized counters** on the assignment. Totals are computed from the rows, so
  there is no second source of truth to drift. The monitor uses one `groupBy`.
- `@@index([questionId])` exists for the RESTRICT check on question deletes, like `AssessmentAnswer`.
- No user agent, IP, clipboard content, keystroke or image is stored. This is data minimisation.

### Step 2 — Migration

Offline, in **bash** (PowerShell 5.1 `>` writes UTF-16):

```bash
git show HEAD:prisma/schema.prisma > "$TMP/schema.before.prisma"
mkdir -p prisma/migrations/20260914120000_assessment_attempt_integrity
npx prisma migrate diff \
  --from-schema-datamodel "$TMP/schema.before.prisma" \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/20260914120000_assessment_attempt_integrity/migration.sql
```

It must contain exactly:
- 1 `CREATE TYPE "AssessmentAttemptEventType"` (16 values)
- 1 `ALTER TABLE "RecruiterAssessment" ADD COLUMN "cameraRequired" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "strictMode" BOOLEAN NOT NULL DEFAULT false`
- 2 `CREATE TABLE` (`AssessmentAttemptSession`, `AssessmentAttemptEvent`)
- 2 `CREATE UNIQUE INDEX` and 3 `CREATE INDEX`
- 3 FKs: session → assignment `ON DELETE CASCADE`; event `(assignmentId, sessionId)` → session `ON DELETE CASCADE`; event → question `ON DELETE RESTRICT`

**No `DROP`, no `ALTER COLUMN`, no other table** — otherwise stop and report. A constant-default
`ADD COLUMN` is metadata-only on Postgres 11+ (no table rewrite). Confirm `20260914120000` is unused
and sorts after `20260912140000_t245_t246_job_lifecycle`.

### Step 3 — Shared validation (`src/lib/validations/assessment.ts`)

**3a.** In `assessmentDraftSchema`'s object, after `passMarkPercent`:

```ts
    cameraRequired: z.boolean().default(false),
```

(`strictMode` is **not** in the draft schema: no client can set it.)

**3b.** Append:

```ts
import type { AssessmentAttemptEventType } from "@prisma/client"; // type-only: erased from the client bundle

/** T-219 — everything a strict attempt's page may report. Mirrors the Prisma
 *  enum; assessment-attempts.test.ts asserts the two lists are equal. */
export const ATTEMPT_EVENT_TYPES = [
  "SESSION_STARTED",
  "PAGE_LEFT",
  "FULLSCREEN_ENTERED",
  "FULLSCREEN_EXITED",
  "VISIBILITY_HIDDEN",
  "VISIBILITY_VISIBLE",
  "WINDOW_BLURRED",
  "WINDOW_FOCUSED",
  "COPY_BLOCKED",
  "CUT_BLOCKED",
  "PASTE_BLOCKED",
  "DROP_BLOCKED",
  "LINK_PASTED",
  "UPLOAD_LINK_OPENED",
  "CAMERA_ON",
  "CAMERA_OFF",
] as const satisfies readonly AssessmentAttemptEventType[];
export type AttemptEventType = (typeof ATTEMPT_EVENT_TYPES)[number];

export const CLIPBOARD_EVENT_TYPES = [
  "COPY_BLOCKED",
  "CUT_BLOCKED",
  "PASTE_BLOCKED",
  "DROP_BLOCKED",
] as const satisfies readonly AttemptEventType[];
/** Require a FILE_UPLOAD questionId of the same assessment. */
export const FILE_LINK_EVENT_TYPES = [
  "LINK_PASTED",
  "UPLOAD_LINK_OPENED",
] as const satisfies readonly AttemptEventType[];
export const CAMERA_EVENT_TYPES = [
  "CAMERA_ON",
  "CAMERA_OFF",
] as const satisfies readonly AttemptEventType[];

export const MAX_EVENTS_PER_BATCH = 50;
export const MAX_EVENTS_PER_ATTEMPT = 1_000;
export const MAX_SESSIONS_PER_ATTEMPT = 50;
export const MAX_EVENT_BODY_BYTES = 64_000;

export const attemptEventSchema = z
  .object({
    seq: z.number().int().min(0).max(1_000_000),
    type: z.enum(ATTEMPT_EVENT_TYPES),
    /** Epoch ms, the device clock at the moment it happened. */
    occurredAt: z.number().int().positive(),
    questionId: z.string().min(1).max(64).optional(),
    count: z.number().int().min(1).max(1_000).optional(),
  })
  .strict();

export const attemptEventBatchSchema = z
  .object({
    sessionId: z.string().uuid(),
    /** Epoch ms, the device clock when THIS transmission was made (re-stamped on retry). */
    sentAt: z.number().int().positive(),
    events: z.array(attemptEventSchema).max(MAX_EVENTS_PER_BATCH),
  })
  .strict();
export type AttemptEventBatch = z.infer<typeof attemptEventBatchSchema>;
```

### Step 4 — Recruiter: strict at publish, camera setting

**4a. `src/features/recruiter-assessments/service.ts`**
- `AssessmentRow`: add `strictMode: boolean; cameraRequired: boolean;`.
- `ContentInput`: add `cameraRequired: boolean;`. `toContent`: add `cameraRequired: input.cameraRequired`.
- `AssessmentMonitor.assessment`: add `strictMode`, `cameraRequired`. `AssessmentMonitor`: add
  `activityCounts: Record<string, number>` (by assignment id; `{}` unless `strictMode`).
- Store port — add:
  ```ts
  countActivityEvents(assessmentId: string, scope: Scope): Promise<Record<string, number>>;
  findAttemptActivity(assessmentId: string, assignmentId: string, scope: Scope): Promise<AttemptActivityRow | null>;
  ```
  with
  ```ts
  export type AttemptActivityRow = {
    assignmentId: string;
    label: string; // listUserDisplayNames || refPublicId — same as the monitor
    status: AssignmentStatus;
    assignedAt: Date;
    startedAt: Date | null;
    submittedAt: Date | null;
    assessment: { title: string; strictMode: boolean; cameraRequired: boolean };
    questionNumbers: Record<string, number>; // question id → 1-based position
    sessions: { clientSessionId: string; firstSeenAt: Date; lastSeenAt: Date }[];
    events: ActivityEvent[]; // from activity.ts
  };
  ```
- `getAssessmentMonitor`: fill the two flags; when `row.strictMode`, `activityCounts = await store.countActivityEvents(assessmentId, scope)`.
- New:
  ```ts
  export async function getAttemptActivity(store, scope, assessmentId, assignmentId, now: Date)
    : Promise<Result<{ row: AttemptActivityRow; summary: ActivitySummary | null }>>
  ```
  `row = await store.findAttemptActivity(...)` → `NOT_FOUND("Attempt not found")` when null.
  `summary = row.assessment.strictMode ? summarizeAttemptActivity({ … , now }) : null`.
- `publishAssessment` doc comment: add "sets strictMode (T-219)". No logic change — the store does it.

**4b. `src/features/recruiter-assessments/prisma-store.ts`**
- `ASSESSMENT_SELECT`: add `strictMode: true, cameraRequired: true`.
- `create` and `replaceContent` data: add `cameraRequired: input.cameraRequired`.
- `publish`: `data: { status: "PUBLISHED", publishedAt: at, strictMode: true }`. It is still one
  guarded `updateMany`, so strictness is fixed atomically with publication.
- `countActivityEvents`:
  ```ts
  const groups = await prisma.assessmentAttemptEvent.groupBy({
    by: ["assignmentId"],
    where: { session: { assignment: { assessmentId, assessment: scopeWhere(scope) } } },
    _count: { _all: true },
  });
  return Object.fromEntries(groups.map((g) => [g.assignmentId, g._count._all]));
  ```
- `findAttemptActivity`: `findFirst` on `recruiterAssessmentAssignment` with
  `where: { id: assignmentId, assessmentId, assessment: scopeWhere(scope) }` selecting the
  `AttemptActivityRow` fields, plus `assessment.questions { id, position }` and
  `sessions { clientSessionId, firstSeenAt, lastSeenAt }` ordered by `firstSeenAt`. Return `null`
  when missing. Then events:
  ```ts
  prisma.assessmentAttemptEvent.findMany({
    where: { assignmentId, session: { assignment: { assessmentId, assessment: scopeWhere(scope) } } },
    orderBy: [{ occurredAt: "asc" }, { seq: "asc" }],
    take: MAX_EVENTS_PER_ATTEMPT + MAX_EVENTS_PER_BATCH,
    select: { sessionId: true, seq: true, type: true, occurredAt: true, questionId: true, count: true },
  });
  ```
  The scope filter is repeated on the event read on purpose: defense in depth if a caller ever
  skips the assignment check. Label via `listUserDisplayNames`, falling back to `refPublicId`.

**4c. `src/features/recruiter-assessments/presets.ts`**
- `export type PresetContent = Omit<ContentInput, "cameraRequired">;` and `AssessmentPreset.content: PresetContent`.
  The five template literals stay untouched.
- `buildContentFromPresets` return: add `cameraRequired: false`.
- `presets.test.ts` needs no change (it spreads `content` into the draft schema, whose default fills the field).

**4d. `src/app/hire/create-test/page.tsx`** — `rowToDraft`: add `cameraRequired: row.cameraRequired`.

**4e. `src/components/hire/assessment/assessment-builder.tsx`**
- `const [cameraRequired, setCameraRequired] = useState(existingDraft?.cameraRequired ?? false);`
- `previewDraft`: add `cameraRequired` (and to its dependency list).
- In `.hire-assess__settings`, after Pass mark: a checkbox using the Untimed pattern
  (`className="hire-assess-q__required"`), label **"Require camera"**. Beneath the settings row:
  `<p className="hire-assess-hint">Candidates must keep their camera on to see the questions. ABTalks never records or sees the video — only when the camera is on or off.</p>`
- Under the header, always (a second `hire-assess__note`):
  `Published assessments run in strict mode: laptop or desktop only, fullscreen required, copy and paste blocked, and page activity recorded for you to review.`

### Step 5 — Candidate service and store

**5a. Types (`src/features/assessment-attempts/service.ts`)**
- `AttemptRow.assessment`: add `strictMode: boolean; cameraRequired: boolean;`.
- `AttemptListRow`: add `strictMode: boolean; cameraRequired: boolean;`.
- `LoadedAttempt`: add `rules: { strictMode: boolean; cameraRequired: boolean };`. `loadAttempt` fills
  it from the row. `view` is unchanged, so the builder preview's types are untouched.
- `export type DeviceHint = { mobile: boolean };`
- `startAttempt`, `saveAnswer`, `submitAttempt` gain a last parameter `device: DeviceHint = { mobile: false }`.
  The default keeps every existing call site and test compiling. In each, right after the
  existing `isOpen` / NOT_FOUND check:
  ```ts
  if (row.assessment.strictMode && device.mobile) {
    return CONFLICT("This assessment can only be taken on a laptop or desktop computer.");
  }
  ```
  Non-strict attempts are unaffected: D-4 keeps already-published assessments exactly as T-218.

**5b. Ingestion — store port additions**

```ts
export type EventContext = {
  status: AttemptStatus;
  startedAt: Date | null;
  submittedAt: Date | null;
  assessment: {
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    strictMode: boolean;
    cameraRequired: boolean;
    questions: { id: string; type: QuestionType }[];
  };
  eventCount: number;
  sessionExists: boolean;
  sessionCount: number;
};

export type EventWrite = {
  seq: number;
  type: AttemptEventType;
  occurredAt: Date;
  clientOccurredAt: Date;
  receivedAt: Date;
  questionId: string | null;
  count: number;
};

// in AttemptStore:
findEventContext(assignmentId: string, candidateUserId: string, clientSessionId: string): Promise<EventContext | null>;
/** Creates the session if new, sets lastSeenAt = receivedAt, inserts events skipping duplicates — one operation. */
writeEventBatch(assignmentId: string, clientSessionId: string, receivedAt: Date, events: EventWrite[]): Promise<void>;
```

**5c. `recordAttemptEvents(store, candidateUserId, assignmentId, body: unknown, receivedAt: Date)`**
→ `Result<{ accepted: number; dropped: number; limitReached: boolean }>`

Constants (local): `SUBMIT_GRACE_MS = 60_000`, `AFTER_SUBMIT_TOLERANCE_MS = 5_000`,
`BEFORE_START_TOLERANCE_MS = 300_000`, `MAX_CLIENT_LAG_MS = 86_400_000`, `SENT_BEFORE_TOLERANCE_MS = 1_000`.

1. `attemptEventBatchSchema.safeParse(body)` → `INVALID("Invalid activity batch")`.
2. `ctx = await store.findEventContext(assignmentId, candidateUserId, sessionId)`. `null`, or
   `ctx.assessment.status !== "PUBLISHED"` → `NOT_FOUND("Assessment not found")`.
3. `!ctx.assessment.strictMode` → `CONFLICT("Activity isn't recorded for this assessment.")`.
4. `ctx.status === "ASSIGNED" || !ctx.startedAt` → `CONFLICT("The assessment hasn't started.")`.
5. `ctx.status === "SUBMITTED" && receivedAt > submittedAt + SUBMIT_GRACE_MS` → `CONFLICT("This assessment has been submitted.")`.
   (The grace lets the final flush that races the submit land. Every event it carries must still
   pass rule 8c.)
6. `!ctx.sessionExists && ctx.sessionCount >= MAX_SESSIONS_PER_ATTEMPT` → `CONFLICT("Too many page sessions for this attempt.")`.
7. **Clock correction:** `offsetMs = receivedAt − sentAt`. Every event in the batch was stamped by the
   same device clock as `sentAt`, so adding the offset maps device time onto server time. The error is
   the network latency (typically < 1s), and a device whose clock is hours off still yields correct
   times.
8. For each event, in `seq` order:
   a. Drop if `occurredAt > sentAt + SENT_BEFORE_TOLERANCE_MS` (can't happen after it was sent) or
      `sentAt − occurredAt > MAX_CLIENT_LAG_MS`.
   b. `corrected = new Date(Math.min(occurredAt + offsetMs, receivedAt.getTime()))`.
   c. Drop if `corrected < startedAt − BEFORE_START_TOLERANCE_MS`, or (`submittedAt` and
      `corrected > submittedAt + AFTER_SUBMIT_TOLERANCE_MS`).
   d. Drop `CAMERA_*` when `!ctx.assessment.cameraRequired`.
   e. `questionId`:
      - `FILE_LINK_EVENT_TYPES`: required, and must be a `FILE_UPLOAD` question of this assessment, else drop.
      - `CLIPBOARD_EVENT_TYPES`: kept only if it is a question of this assessment, else `null`.
      - every other type: `null`.
   f. `count`: clipboard types → `event.count ?? 1`; all others → `1`.
9. `capacity = Math.max(0, MAX_EVENTS_PER_ATTEMPT − ctx.eventCount)`; `accepted = kept.slice(0, capacity)`;
   `limitReached = ctx.eventCount + kept.length > MAX_EVENTS_PER_ATTEMPT`. This is a soft cap:
   concurrent batches can overshoot by at most one batch, and it bounds storage rather than
   guaranteeing an invariant.
10. **Always** `await store.writeEventBatch(assignmentId, sessionId, receivedAt, accepted)`. Even an
    empty batch is the heartbeat that advances `lastSeenAt`.
11. `OK({ accepted: accepted.length, dropped: parsed.events.length − kept.length, limitReached })`.

**5d. `src/features/assessment-attempts/prisma-store.ts`**
- `findAttempt` and `listAttempts` selects: add `strictMode: true, cameraRequired: true` under
  `assessment`, and map them.
- `findEventContext`: first `recruiterAssessmentAssignment.findFirst({ where: { id, candidateUserId }, select: { status, startedAt, submittedAt, assessment: { select: { status, strictMode, cameraRequired, questions: { select: { id, type } } } } } })`.
  Return `null` if missing, **before** any count runs. Then `Promise.all([ assessmentAttemptEvent.count({ where: { assignmentId } }), assessmentAttemptSession.findUnique({ where: { assignmentId_clientSessionId: { assignmentId, clientSessionId } }, select: { id: true } }), assessmentAttemptSession.count({ where: { assignmentId } }) ])`.
- `writeEventBatch` — **one** nested Prisma operation (internal transaction, pooler-safe like the presets store):
  ```ts
  const data = events.map((e) => ({
    seq: e.seq, type: e.type, occurredAt: e.occurredAt, clientOccurredAt: e.clientOccurredAt,
    receivedAt: e.receivedAt, questionId: e.questionId, count: e.count,
  }));
  const nested = data.length > 0 ? { createMany: { data, skipDuplicates: true } } : undefined;
  const write = () =>
    writeClient().assessmentAttemptSession.upsert({
      where: { assignmentId_clientSessionId: { assignmentId, clientSessionId } },
      create: { assignmentId, clientSessionId, firstSeenAt: receivedAt, lastSeenAt: receivedAt, events: nested },
      update: { lastSeenAt: receivedAt, events: nested },
      select: { id: true },
    });
  try {
    await write();
  } catch (error) {
    // Two first batches from one page raced to create the session: the loser retries as an update.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      await write();
      return;
    }
    throw error;
  }
  ```
  `lastSeenAt` is a receipt time, so a concurrent older request can move it back by at most the
  milliseconds between two receipts, which is harmless. Duplicate events are skipped by the
  `(assignmentId, sessionId, seq)` unique.

**5e. `src/app/actions/assessment-attempt-actions.ts`** — add a local helper, then pass its result
as the last argument to `startAttempt`, `saveAnswer` and `submitAttempt`:
```ts
async function deviceHint(): Promise<DeviceHint> {
  return { mobile: (await headers()).get("sec-ch-ua-mobile") === "?1" };
}
```
`headers` comes from `next/headers`. Nothing else in the file changes.

### Step 6 — The events route (`src/app/api/assessments/[assignmentId]/events/route.ts`)

Header comment: why this is a Route Handler and not a Server Action (§2.4), why it is safe (cookie
`SameSite=Lax`, Origin check, session-scoped service, NOT_FOUND on foreign ids), and that it
accepts `text/plain` because `sendBeacon` sends text.

```ts
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  // 1. Same-origin only (defense in depth; the session cookie is SameSite=Lax).
  const origin = request.headers.get("origin");
  if (origin !== null) {
    let host: string | null = null;
    try { host = new URL(origin).host; } catch { host = null; }
    if (host !== request.nextUrl.host) return reply(403, { ok: false, message: "Forbidden" });
  }
  // 2. The candidate is the session user.
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return reply(401, { ok: false, message: "Please sign in to continue." });
  // 3. Path param + body.
  const parsedParams = z.object({ assignmentId: z.string().min(1).max(64) }).safeParse(await params);
  if (!parsedParams.success) return reply(404, { ok: false, message: "Assessment not found" });
  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_EVENT_BODY_BYTES) return reply(413, { ok: false, message: "Too large" });
  let body: unknown;
  try { body = JSON.parse(text); } catch { return reply(400, { ok: false, message: "Invalid activity batch" }); }
  // 4. Service.
  try {
    const result = await recordAttemptEvents(prismaAttemptStore(), userId, parsedParams.data.assignmentId, body, new Date());
    if (!result.ok) return reply(statusFor(result.code), { ok: false, message: result.message });
    return reply(200, { ok: true, data: result.data });
  } catch (error) {
    logger.error("[assessment-events] record", { assignmentId: parsedParams.data.assignmentId, error: String(error) });
    return reply(500, { ok: false, message: "Couldn't record activity." });
  }
}
```
`reply` wraps `NextResponse.json(body, { status })`. `statusFor`: NOT_FOUND→404, CONFLICT→409,
INVALID→400. **No** GET/PUT/DELETE. **No** `searchParams`. **No** logging of event bodies. Middleware
is unchanged: `/api/assessments/…` doesn't start with any protected prefix, and the handler
authenticates itself, returning JSON 401 rather than a redirect.

### Step 7 — Activity summary and all recruiter copy (`src/features/assessment-attempts/activity.ts`)

Pure module. **Every recruiter-facing string about activity lives here**, so one test can guard it.

**7a. Types and constants**

```ts
export const SESSION_GRACE_MS = 45_000;           // heartbeat 20s + slack
export const UPLOAD_LINK_ATTRIBUTION_MS = 5_000;
export const TIMELINE_GROUP_MS = 1_000;

export type ActivityEvent = {
  sessionId: string; seq: number; type: AttemptEventType;
  occurredAt: Date; questionId: string | null; count: number;
};
export type ActivitySession = { clientSessionId: string; firstSeenAt: Date; lastSeenAt: Date };
export type IntervalKind = "FULLSCREEN" | "HIDDEN" | "UNFOCUSED" | "PAGE_CLOSED" | "CAMERA_OFF";
export type TimelineEntry = { at: Date; sessionNumber: number | null; lines: string[] };
export type ActivitySummary = {
  window: { start: Date; end: Date; inProgress: boolean };
  sessionCount: number;
  awayMs: number;
  awayAfterUploadLinkMs: number;
  totals: Record<IntervalKind, { times: number; ms: number; withoutReturn: number }>;
  clipboardBlocked: number;   // sum of count
  linksPasted: number;
  timeline: TimelineEntry[];
  limitReached: boolean;
};
export function summarizeAttemptActivity(input: {
  startedAt: Date; submittedAt: Date | null; now: Date; cameraRequired: boolean;
  sessions: ActivitySession[]; events: ActivityEvent[];
  questionNumbers: Record<string, number>; eventCount: number;
}): ActivitySummary
```

**7b. The model — "in view"**

A page session is **in view** while it is `visible && focused && fullscreen`. **Time away** is the
part of the attempt window `[startedAt, submittedAt ?? now]` during which **no** session was in
view. Taking the union across sessions makes two open tabs, or two devices, correct: a hidden tab
isn't "away" while another assessment tab is in view.

**7c. Algorithm (deterministic; tests pin every rule)**

```
winStart = startedAt; winEnd = submittedAt ?? now; inProgress = submittedAt === null
bySession = events grouped by sessionId, each sorted by seq (events for unknown sessions ignored)
sessionStart(s) = first SESSION_STARTED occurredAt in s ?? s.firstSeenAt
order sessions by sessionStart; sessionNumber = index + 1

for each session s:
  leftAt     = first PAGE_LEFT occurredAt in s (or none)
  sessionEnd = min(leftAt ?? (s.lastSeenAt + SESSION_GRACE_MS), winEnd)
  state = { visible: true, focused: true, fullscreen: false, camera: !cameraRequired }
  open  = { FULLSCREEN: null, HIDDEN: null, UNFOCUSED: null, CAMERA_OFF: null }
  inViewSince = null
  for e of s events (stop after PAGE_LEFT):
    at = clamp(e.occurredAt, sessionStart(s), sessionEnd)
    wasInView = state.visible && state.focused && state.fullscreen
    FULLSCREEN_EXITED : if fullscreen  → fullscreen=false; open.FULLSCREEN = at
    FULLSCREEN_ENTERED: if !fullscreen → fullscreen=true;  close(FULLSCREEN, at) → returnAfter[e]
    VISIBILITY_HIDDEN : if visible     → visible=false;    open.HIDDEN = at
    VISIBILITY_VISIBLE: if !visible    → visible=true;     close(HIDDEN, at) → returnAfter[e]
    WINDOW_BLURRED    : if focused     → focused=false;    open.UNFOCUSED = at
    WINDOW_FOCUSED    : if !focused    → focused=true;     close(UNFOCUSED, at) → returnAfter[e]
    CAMERA_OFF        : if camera      → camera=false;     open.CAMERA_OFF = at
    CAMERA_ON         : if !camera     → camera=true;      close(CAMERA_OFF, at) → returnAfter[e]
    UPLOAD_LINK_OPENED: uploadLinkTimes.push(at)
    COPY/CUT/PASTE/DROP_BLOCKED: clipboardBlocked += e.count
    LINK_PASTED       : linksPasted += 1
    isInView = state.visible && state.focused && state.fullscreen
    if !wasInView && isInView: inViewSince = at
    if wasInView && !isInView: inView.push([inViewSince, at])
  if in view at the end: inView.push([inViewSince, sessionEnd])
  each still-open interval → closed at sessionEnd, counted in times and ms, withoutReturn += 1
  if leftAt: PAGE_CLOSED [leftAt, next sessionStart > leftAt ?? winEnd]; withoutReturn += 1 when no next session

close(kind, at): only when open[kind] !== null → times += 1, ms += at − open[kind]; returnAfter = at − open[kind]; open[kind] = null
  (a FULLSCREEN_ENTERED with no preceding exit in that session is "Entered fullscreen" — not a return, no interval)

merged = union of all inView intervals, clipped to [winStart, winEnd]
awayMs = (winEnd − winStart) − Σ merged
awaySegments = complement of merged within the window
awayAfterUploadLinkMs = Σ segments whose start s has some upload-link time t with s − 5000 ≤ t ≤ s
limitReached = eventCount >= MAX_EVENTS_PER_ATTEMPT
```

Per-kind totals count only **explicit change → return** pairs (plus, flagged, pairs that never saw a
return). Time before the first fullscreen entry on a reopened page is **not** a "fullscreen exit": it
counts toward combined time away, but not toward "Fullscreen exited". The same rule applies to the
camera.

**7d. Timeline**
- Rows: two server facts — **"Started the assessment"** at `startedAt` and **"Submitted the
  assessment"** at `submittedAt`, both with `sessionNumber: null` — plus every event, sorted by
  `occurredAt`, then session number, then `seq`.
- Grouping: consecutive events in the same session within `TIMELINE_GROUP_MS` of the group's first
  event form one entry with several lines. A tab switch out of fullscreen produces three facts at the
  same second; they show as one row.

**7e. Copy — exact strings** (`formatDuration`: `< 1000ms` → `"under 1s"`; else `"45s"`, `"2m 14s"`, `"1h 02m"`)

`describeEvent(e, ctx: { returnAfterMs?: number; questionNumber?: number; sessionNumber: number; multipleSessions: boolean })`:

| Type | Line |
|---|---|
| SESSION_STARTED | `Opened the assessment page` + ` (page session {n})` when `multipleSessions` |
| PAGE_LEFT | `Left the assessment page` |
| FULLSCREEN_EXITED | `Fullscreen exited` |
| FULLSCREEN_ENTERED | `Returned to fullscreen after {d}` if paired, else `Entered fullscreen` |
| VISIBILITY_HIDDEN | `Assessment page hidden` |
| VISIBILITY_VISIBLE | `Assessment page shown again after {d}` if paired, else `Assessment page shown` |
| WINDOW_BLURRED | `Browser window lost focus` |
| WINDOW_FOCUSED | `Browser window focused again after {d}` if paired, else `Browser window focused` |
| COPY_BLOCKED | `Copy blocked` + ` in Q{n}` + ` ({count} attempts)` when count > 1 |
| CUT_BLOCKED | `Cut blocked` + the same suffixes |
| PASTE_BLOCKED | `Paste blocked` + the same suffixes |
| DROP_BLOCKED | `Dropped content blocked` + the same suffixes |
| LINK_PASTED | `Pasted a link into Q{n}'s file-link field` |
| UPLOAD_LINK_OPENED | `Opened the upload link for Q{n}` |
| CAMERA_OFF | `Camera off` |
| CAMERA_ON | `Camera back on after {d}` if paired, else `Camera on` |

`SUMMARY_COPY`:

| Key | Label | Help text |
|---|---|---|
| away | `Time away from the assessment page` | `Time between start and submission when no assessment page was visible, focused and in fullscreen — including while the page was closed.` |
| awayAfterUploadLink | — | `of which {d} began within 5 seconds of opening an upload link` |
| FULLSCREEN | `Fullscreen exited` | `{times} times · {d} outside fullscreen` |
| HIDDEN | `Page hidden` | `Browsers report this when the tab is switched, the window is minimised or the screen is locked. They don't say which.` |
| UNFOCUSED | `Window not focused` | `Reported when another window, app or system dialog takes focus.` |
| PAGE_CLOSED | `Page closed` | `Time from leaving the page until it was opened again.` |
| CAMERA_OFF | `Camera off` | `Time the camera was off after being on.` |
| clipboard | `Copy, cut and paste blocked` | `Attempts, including repeats.` |
| links | `Links pasted` | `Pasted into file-link fields, where pasting is allowed.` |
| sessions | `Page sessions` | `Each page load or reopening is a new session.` |
| withoutReturn | — | `{n} with no recorded return — the page stopped reporting, for example it was closed without a leave event or lost its connection.` |
| limit | — | `Recording stopped at 1,000 events for this attempt; later events weren't stored.` |

Disclaimers, exported verbatim:

```ts
export const ACTIVITY_DISCLAIMER =
  "These events are what the candidate's browser reported while the assessment page was open: what happened on the page and when, not why. ABTalks does not detect other screens or devices, eye movement, which websites or apps were used, or whether anyone helped, and it does not judge whether a candidate cheated. A browser can be modified to stop reporting, so a missing event is not proof that something didn't happen.";

export const CAMERA_DISCLAIMER =
  "“Camera on” means the camera on the candidate's device was running. ABTalks doesn't record or see the video and can't tell who, or whether anyone, was in front of it.";

/** Words no activity label, summary label or activity page may use. The two disclaimers are exempt (they negate these). */
export const BANNED_CLAIM_PATTERN =
  /cheat|suspicious|violation|flagged|red flag|risk score|integrity score|trust score|proctor|eye[- ]?(movement|tracking)|gaze|second (monitor|screen)|multiple monitors|another person|someone else|impersonat|detected/i;
```

### Step 8 — Client recorder (`src/components/assessments/integrity-recorder.ts`)

Plain TS, no React, no DOM globals. Every side effect is injected, so the tests drive it with fakes.

```ts
export type RecorderDeps = {
  assignmentId: string;
  send: (body: string) => Promise<{ status: number }>; // fetch(url, { method: "POST", body, keepalive: true, headers: { "content-type": "text/plain;charset=UTF-8" } })
  beacon: (body: string) => boolean;                   // navigator.sendBeacon(url, new Blob([body], { type: "text/plain;charset=UTF-8" }))
  now: () => number;                                    // Date.now
  uuid: () => string;                                   // crypto.randomUUID
  setTimer: (fn: () => void, ms: number) => number;
  clearTimer: (id: number) => void;
  onStopped: (status: 401 | 404 | 409) => void;
};

export type IntegrityRecorder = {
  startSession(): void;   // new sessionId, seq = 0, records SESSION_STARTED
  record(type: AttemptEventType, questionId?: string): void;
  flushWithBeacon(): void;
  leave(): void;          // PAGE_LEFT (once per session) + flushWithBeacon
  finish(): void;         // stop without PAGE_LEFT: submitted, or the app closed the attempt
  isStopped(): boolean;
};
export function createIntegrityRecorder(deps: RecorderDeps): IntegrityRecorder;
```

Rules:
- The queue holds `{ seq, type, occurredAt: now(), questionId?, count, sentByBeacon: boolean, inFlight: boolean }`.
- **Coalescing:** recording a `CLIPBOARD_EVENT_TYPES` event whose last queued event has the same type
  and questionId, is not in flight, was not beaconed, and occurred ≤ 1000ms ago → `count += 1`
  instead of a new seq.
- **Fetch flush:** scheduled 5s after the first unsent event. It takes up to `MAX_EVENTS_PER_BATCH`
  in seq order, sets `inFlight`, and builds `{ sessionId, sentAt: now(), events }`, with `sentAt`
  stamped **now**, at transmission.
  - `200` → remove those events.
  - `401`/`404`/`409` → `stop()` + `onStopped(status)`.
  - `400`/`413` → drop that batch.
  - Network error or `5xx` → clear `inFlight` and retry after 2s, 5s, then every 10s.
- **Heartbeat:** if nothing was sent for 20s, send an empty batch (`events: []`).
- **Beacon flush:** `beacon(JSON of every unsent event, up to 50)`. If it returns true, mark those
  events `sentByBeacon` and **keep them**. The next fetch flush resends them, and the server's unique
  key stores them once. That's how a silently dropped beacon still gets delivered.
- `finish()` and stopping clear all timers and ignore later `record()` calls.
- `leave()` records `PAGE_LEFT` at most once per session.

### Step 9 — Strict-mode UI (`src/components/assessments/assessment-integrity.tsx`)

`"use client"`. `import "@/components/hire/assessment/candidate-assessment-screen.css";`

**9a. Helpers (exported)**

```ts
export const PHONE_SHORT_SIDE_PX = 600;
type NavigatorWithUAData = Navigator & { userAgentData?: { mobile?: boolean } };
type FullscreenDocument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
};
type FullscreenCapableElement = HTMLElement & { webkitRequestFullscreen?: () => void };

export type StrictSupport = { phone: boolean; fullscreenSupported: boolean; cameraSupported: boolean };

export function detectStrictSupport(): StrictSupport {
  const nav: NavigatorWithUAData = navigator;
  const doc: FullscreenDocument = document;
  const shortSide = Math.min(window.screen.width, window.screen.height);
  return {
    // Phones in either orientation; tablets (short side ≥ 600) and desktops pass.
    phone: nav.userAgentData?.mobile === true || shortSide < PHONE_SHORT_SIDE_PX,
    fullscreenSupported: document.fullscreenEnabled === true || doc.webkitFullscreenEnabled === true,
    cameraSupported: window.isSecureContext && typeof navigator.mediaDevices?.getUserMedia === "function",
  };
}

export function isPageFullscreen(): boolean {
  const doc: FullscreenDocument = document;
  return (document.fullscreenElement ?? doc.webkitFullscreenElement ?? null) !== null;
}

/** MUST be called synchronously inside a click handler (user activation). */
export function requestPageFullscreen(): Promise<boolean> {
  const el: FullscreenCapableElement = document.documentElement;
  try {
    if (typeof el.requestFullscreen === "function") {
      return el.requestFullscreen({ navigationUI: "hide" }).then(() => true, () => false);
    }
    if (typeof el.webkitRequestFullscreen === "function") {
      el.webkitRequestFullscreen();
      return Promise.resolve(true);
    }
  } catch {
    /* fall through */
  }
  return Promise.resolve(false);
}

export async function exitPageFullscreen(): Promise<void> { /* exitFullscreen / webkitExitFullscreen when isPageFullscreen(), errors swallowed */ }

export async function acquireCamera(): Promise<
  { ok: true; stream: MediaStream } | { ok: false; reason: "denied" | "unavailable" | "unsupported" }
> {
  if (typeof navigator.mediaDevices?.getUserMedia !== "function") return { ok: false, reason: "unsupported" };
  try {
    return { ok: true, stream: await navigator.mediaDevices.getUserMedia({ video: true, audio: false }) };
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    return { ok: false, reason: name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable" };
  }
}

export function isCameraLive(stream: MediaStream | null): boolean {
  return !!stream && stream.getVideoTracks().some((t) => t.readyState === "live" && t.enabled && !t.muted);
}
```

**9b. `StrictModeChecklist`** — shown in the instructions stage (`startPanel`).
Props: `support: StrictSupport | null`, `cameraRequired`, `camera: MediaStream | null`,
`cameraError: "denied" | "unavailable" | "unsupported" | null`, `onAllowCamera: () => void`, `busy`.

Content — exact copy:
- Heading **"Before you start"**.
- Requirement rows, each ✓ or ✗ with text:
  - **Laptop or desktop computer.** ✗: `Assessments can't be taken on a phone. Open this page on a laptop or desktop computer.`
  - **Fullscreen.** ✗: `This browser can't show the assessment in fullscreen. Open it in Chrome, Edge, Firefox or Safari on a laptop or desktop.`
  - **Camera** (only when `cameraRequired`):
    - Not yet allowed: a button **"Allow camera"**.
    - Live: `Camera on — only you can see this preview.`, with a small muted `<video autoPlay muted playsInline>` preview.
    - `denied`: `Camera access is blocked. Allow it for this site in your browser's address bar, then try again.`
    - `unavailable`: `No camera was found. Connect a camera, then try again.`
    - `unsupported`: `This browser can't use a camera. Open it in Chrome, Edge, Firefox or Safari.`
  - While `support === null`: `Checking your device…`
- Heading **"What's recorded"** followed by:
  `While you take this assessment, ABTalks records the time of each of these:`
  - `Leaving and returning to fullscreen`
  - `The assessment page being hidden or shown again, and the browser window losing or regaining focus`
  - `Leaving and reopening the assessment page`
  - `Copy, cut and paste attempts — these are blocked, except pasting a link into a file-link field`
  - `Opening an upload link`
  - (camera) `Your camera turning on or off. The video stays on your device — it isn't recorded or sent.`
  - Closing line: `Nothing outside this page is recorded. The recruiter sees these events with your answers.`

**9c. `StrictModeUnavailable`** — the resume case on a phone or unsupported browser. Title
**"Continue on a laptop or desktop"**, body: `This assessment can only be taken on a laptop or desktop computer, in a browser that can show it in fullscreen. Your answers are saved — open this page there to continue.`
It starts no recorder.

**9d. `StrictModeGuard`**
Props: `assignmentId`, `cameraRequired`, `camera: MediaStream | null`,
`onRequestCamera: () => Promise<boolean>`, `endingRef: { current: "submitted" | null }`,
`onStopped: (status: number) => void`, `children`.

- **Mount** (one `useEffect`): create the recorder with real deps (URL `/api/assessments/${assignmentId}/events`).
  Call `startSession()`, then record the snapshot:
  - `FULLSCREEN_ENTERED` if `isPageFullscreen()`
  - `VISIBILITY_HIDDEN` if `document.visibilityState === "hidden"`
  - `WINDOW_BLURRED` if `!document.hasFocus()`
  - `CAMERA_ON` if `cameraRequired && isCameraLive(camera)`
- **Listeners** (all removed on cleanup):
  - `fullscreenchange` + `webkitfullscreenchange` → `FULLSCREEN_EXITED` / `FULLSCREEN_ENTERED`; set `outsideFullscreen`.
  - `document` `visibilitychange` → `VISIBILITY_HIDDEN` + `flushWithBeacon()` / `VISIBILITY_VISIBLE`.
  - `window` `blur` / `focus` → `WINDOW_BLURRED` / `WINDOW_FOCUSED`.
  - `window` `pagehide` → `leave()`.
  - `window` `pageshow` with `event.persisted` → `startSession()` + snapshot. A back/forward-cache
    restore is a new page session.
  - Clipboard, on `document`, **capture phase**, not passive:
    - `copy` / `cut` → `preventDefault()`; record `COPY_BLOCKED` / `CUT_BLOCKED` with the
      `questionId` of the closest `[data-question-id]`.
    - `paste`: if the target is inside `[data-link-input-question]` → **allow**, record
      `LINK_PASTED` with that question id. Otherwise `preventDefault()` + `PASTE_BLOCKED`.
    - `drop` → `preventDefault()` + `DROP_BLOCKED`.
    - `beforeinput` with `inputType` in `insertFromPaste | insertFromPasteAsQuotation | insertFromDrop`
      and the target not in a link input → `preventDefault()`, with **no** record. The `paste`/`drop`
      handler already recorded it; this only catches mobile-keyboard insertions that skip `paste`.
    - `dragstart` inside the guard → `preventDefault()`, not recorded (not a listed signal).
    - Blocked actions show `toast("Copy, cut and paste are turned off during this assessment.")`,
      at most once per 3s.
  - `click` capture: target inside `[data-upload-link-question]` → `UPLOAD_LINK_OPENED` with that id.
    The link still opens.
  - Camera (when `cameraRequired` and a stream exists): for each video track, `ended` and `mute`
    → `CAMERA_OFF` and blocked; `unmute` → `CAMERA_ON`. When `camera` changes to a new live stream
    → `CAMERA_ON`.
- **Blocked:** `blocked = outsideFullscreen || (cameraRequired && !cameraLive)`.
- **Render:**
  ```tsx
  <div className="hire-cand-assess-guard" data-blocked={blocked ? "true" : "false"}>
    <div className="hire-cand-assess-guard__content" inert={blocked}>{children}</div>
    {blocked ? <BlockingModal …/> : null}
    {cameraRequired && cameraLive ? <SelfView stream={camera} /> : null}
  </div>
  ```
- **`BlockingModal`:** `role="alertdialog"`, `aria-modal="true"`, labelled and described; focus
  moves to its button when it opens.
  - Fullscreen unmet, after an exit in this session: **"Fullscreen Required"** /
    `Please return to fullscreen mode to continue your assessment.` / button **"Return to fullscreen"**.
  - Fullscreen unmet, never entered in this session (reopened page): **"Fullscreen Required"** /
    `Please enter fullscreen mode to continue your assessment.` / button **"Enter fullscreen"**.
  - Only the camera unmet: **"Camera Required"** / `Please turn your camera back on to continue your assessment.`
    / button **"Turn camera on"**.
  - Always: `Your answers are saved.`
  - **Button handler:** if fullscreen is unmet, call `requestPageFullscreen()` **synchronously first**
    — it needs the click's user activation, and a camera prompt could consume it. Then, if the
    camera is unmet, `await onRequestCamera()`. Show inline errors, using 9b's camera copy or
    `Fullscreen couldn't be opened. Try again.`
- **Focus restore:** when becoming blocked, remember `document.activeElement`. When unblocked,
  re-focus it if it's still connected. The caret and selection in a textarea survive, so the
  candidate continues exactly where they left off.
- **Self-view:** fixed bottom-right `<video autoPlay muted playsInline>` (160×120) captioned
  `Camera on — only you can see this`.
- **Cleanup on unmount:** remove every listener, then
  `endingRef.current === "submitted" ? recorder.finish() : recorder.leave()`. Leaving by an in-app
  link is a page leave, even though it isn't `pagehide`.

### Step 10 — Candidate integration

**10a. `src/components/assessments/assessment-attempt.tsx`**
- New prop `rules: { strictMode: boolean; cameraRequired: boolean }`. **When `!rules.strictMode`, the
  component behaves exactly as today** — no gate, no guard, no recorder.
- Strict state:
  - `support: StrictSupport | null` — set in a mount effect via `detectStrictSupport()`.
  - `camera: MediaStream | null`, `cameraError`.
  - `endingRef = useRef<"submitted" | null>(null)`.
- `allowCamera()` / `requestCamera()`: `acquireCamera()`, then set the stream or error. The previous
  stream's tracks are stopped when a new one replaces it.
- **Instructions stage:** pass the screen `startPanel={<StrictModeChecklist …/>}` and
  `resumeHint="Your answers save automatically as you go. You can close this page and continue later on a laptop or desktop."`.
  Also pass `startBlockedReason`: the first unmet requirement's short text (`Checking your device…` /
  the phone line / the fullscreen line / `Allow your camera to start.`), or `null` when all pass.
- **`start()` — strict:**
  ```ts
  const entering = requestPageFullscreen(); // synchronous call inside the click handler
  startTransition(async () => {
    if (!(await entering)) { toast.error("Fullscreen couldn't be opened. Try again."); return; }
    const res = await startAssessmentAttemptAction({ assignmentId });
    if (!res.ok) {
      await exitPageFullscreen();
      toast.error(res.message);
      if (res.status === 409 || res.status === 404) router.refresh();
      return;
    }
    setStage("taking");
    router.refresh();
  });
  ```
  Non-strict `start()` is unchanged.
- **Taking stage (strict):**
  - `support.phone || !support.fullscreenSupported || (rules.cameraRequired && !support.cameraSupported)`
    → render `<StrictModeUnavailable />` **instead of** the screen.
  - Otherwise wrap the existing `<CandidateAssessmentScreen …/>` in `<StrictModeGuard …>`.
  - `support === null` → render the screen inside the guard; the guard's modal blocks until requirements are met.
- **Every path that sets stage `"submitted"`** (submit success, submit 409, autosave 409):
  set `endingRef.current = "submitted"` immediately before `setStage("submitted")`.
- Effect on `[stage]`: when `"submitted"`, `void exitPageFullscreen()` and stop all camera tracks.
  It runs after the guard's cleanup, so the exit isn't recorded.
- Unmount cleanup: stop camera tracks.
- Guard `onStopped(409)` → `router.refresh()`. The server says the attempt is no longer open, and the
  refreshed props move the stage.

**10b. `src/components/hire/assessment/candidate-assessment-screen.tsx`**
- Props: `startPanel?: ReactNode`, `startBlockedReason?: string | null`, `resumeHint?: string`
  (default: the current sentence).
- Instructions stage:
  - Render `startPanel` above the start summary.
  - The start button's `disabled` becomes `busy || Boolean(startBlockedReason)`.
  - Show `startBlockedReason` under the button as `hire-cand-assess__hint`.
  - The resume sentence uses `resumeHint`.
- Hooks for the guard. They are inert data attributes; the preview ignores them.
  - Each question `<li>`: `data-question-id={key}`.
  - The upload anchor: `data-upload-link-question={q.id ?? String(index)}`.
  - The file-link `<input>`: `data-link-input-question={q.id ?? String(index)}`.
- The builder preview passes none of the new props → **unchanged**.

**10c. `src/app/assessments/[assignmentId]/page.tsx`** — `rules={loaded.data.rules}`.

**10d. `src/app/assessments/page.tsx`** — for rows with `strictMode`, a muted line
`Laptop or desktop · Fullscreen` + ` · Camera` when `cameraRequired`, under the facts line.

### Step 11 — Recruiter pages

**11a. `src/app/hire/assessments/[assessmentId]/page.tsx` (monitor)**
- `facts`: push `Strict mode` when `assessment.strictMode`, and `Camera required` when `assessment.cameraRequired`.
- When `assessment.strictMode`, add an **Activity** column after Result:
  - `status === "ASSIGNED"` → `—`
  - otherwise `{n} events` (or `None recorded` when `n` is 0) plus a `<Link href={\`/hire/assessments/${assessment.id}/attempts/${a.id}\`}>View</Link>`
    styled `hire-assess-linkbtn`.
- No column for non-strict assessments.

**11b. `src/app/hire/assessments/[assessmentId]/attempts/[assignmentId]/page.tsx` [new]**

```tsx
type Props = { params: Promise<{ assessmentId: string; assignmentId: string }> };
export const metadata: Metadata = { title: "Candidate activity | ABTalks Hire" };

export default async function AttemptActivityPage({ params }: Props) {
  await requireRecruiter();
  const workspace = await requireRecruiterWorkspace();
  if (!workspace.ok) notFound();
  const { assessmentId, assignmentId } = await params;
  const found = await getAttemptActivity(
    prismaAssessmentStore(),
    { organizationId: workspace.data.organizationId, createdByUserId: workspace.data.userId },
    assessmentId, assignmentId, new Date(),
  );
  if (!found.ok) notFound(); // foreign, unknown, or the id of another assessment's attempt
  // render …
}
```

Layout, all inside `hire-assess-list hire-assess-activity`:
1. Back link `← {assessment title}` to the monitor.
2. Kicker `Candidate activity`; `<h1>{label}</h1>`. Facts: `Started {IST}` · `Submitted {IST}` (or
   `In progress — totals so far`) · `Took {formatDuration}` when submitted.
3. `summary === null` → one paragraph: `Activity isn't recorded for this assessment — it was published before strict mode.` Stop.
4. Disclaimer block: `ACTIVITY_DISCLAIMER`, plus `CAMERA_DISCLAIMER` when `cameraRequired`.
5. Summary tiles (`dl`) from `SUMMARY_COPY`: time away (+ upload-link share), fullscreen, hidden,
   unfocused, page closed, camera off (only when `cameraRequired`), clipboard, links, sessions. Show
   the "without return" line when `withoutReturn > 0`, and the limit notice when `limitReached`.
6. Timeline `<ol>`: each entry's time as `toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", second: "2-digit" })`,
   then its lines. Empty → `No activity was recorded yet.`

**No other string literal on this page may describe activity.** Everything comes from `activity.ts`
(enforced in step 13).

### Step 12 — CSS

**12a. `candidate-assessment-screen.css`** (append):
- `.hire-cand-assess-guard { position: relative; }`
- `.hire-cand-assess-guard[data-blocked="true"] .hire-cand-assess-guard__content { filter: blur(14px); pointer-events: none; user-select: none; }`
- **Immediate blur**, before React re-renders — two separate rules, since an unknown pseudo-class
  invalidates a whole selector list:
  - `html:not(:fullscreen) .hire-cand-assess-guard .hire-cand-assess-guard__content { filter: blur(14px); }`
  - `html:not(:-webkit-full-screen) .hire-cand-assess-guard .hire-cand-assess-guard__content { filter: blur(14px); }`
  The guard only exists on strict attempts, where fullscreen is always required.
- `.hire-cand-assess-block` — `position: fixed; inset: 0; z-index: 60` (above `.abt-header` z 40);
  backdrop `rgba(0,0,0,0.45)`; centered card using the existing `__header` card radius, border and
  `#03535F` primary button.
- `.hire-cand-assess-selfview` — `position: fixed; right: 16px; bottom: 16px; z-index: 55`; 160×120,
  `border-radius: 12px`, `object-fit: cover`, `transform: scaleX(-1)`, caption below.
- `.hire-cand-assess-rules`, `__row`, `__status--ok` (`#197E23`), `__status--bad` (`#b91c1c`),
  `.hire-cand-assess-recorded` list — existing tints only, no new colours.

**12b. `hire-scout.css`** (append, shared file — new rules only):
`.hire-assess-activity__disclaimer` (the `#fff7ed` banner treatment), `__tiles` (grid, 3 columns;
1 column under 640px), `__tile`, `__timeline`, `__time` (tabular-nums, muted), `__lines`, `__notice`.
Reuse the `hire-assess-*` palette and radii.

### Step 13 — Tests

**13a. `src/features/assessment-attempts/assessment-attempts.test.ts`** (extend; same harness)

*Fixture:* the in-memory `StoredAssessment` gains `strictMode` and `cameraRequired` (defaults
`false`, so every existing T-218 test runs unchanged on the non-strict path). Add `sessions` and
`events` maps, and implement `findEventContext` and `writeEventBatch`: create-if-missing, set
`lastSeenAt`, skip duplicate `(assignmentId, sessionId, seq)`. A `strictFixture(cameraRequired = false)`
helper starts attempt C.

*Device refusal*
- **G1.** strict + `{ mobile: true }` → CONFLICT on start, save and submit; nothing written.
- **G2.** non-strict + `{ mobile: true }` → start/save/submit behave exactly as today.
- **G3.** `loadAttempt` returns `rules` matching the assessment.

*Ingestion*
- **I1.** a batch for a started strict attempt is stored; the session is created with
  `firstSeenAt = lastSeenAt = receivedAt`; `accepted` equals the event count.
- **I2.** device clock 2h behind: `occurredAt` is corrected to within the batch latency;
  `clientOccurredAt` keeps the raw value.
- **I3.** the same batch twice: no new events, `lastSeenAt` advances.
- **I4.** another candidate's assignment → NOT_FOUND, nothing written (no session row).
- **I5.** non-strict → CONFLICT; ASSIGNED → CONFLICT.
- **I6.** SUBMITTED: received within 60s with `occurredAt ≤ submittedAt` → stored; `occurredAt > submittedAt + 5s` → dropped; received after 60s → CONFLICT.
- **I7.** camera events on a non-camera assessment → dropped.
- **I8.** `LINK_PASTED` / `UPLOAD_LINK_OPENED` with a PARAGRAPH question or another assessment's
  question → dropped; `PASTE_BLOCKED` with a foreign questionId → stored with `questionId: null`.
- **I9.** event after `sentAt + 1s`, or older than 24h → dropped.
- **I10.** 51 events or a non-UUID sessionId → INVALID, nothing written.
- **I11.** 990 stored + 20 sent → 10 accepted, `limitReached: true`; the next batch accepts 0 but still updates `lastSeenAt`.
- **I12.** 50 sessions exist → a new 51st session → CONFLICT; an existing session is still accepted.
- **I13.** an empty batch (heartbeat) creates or updates the session and stores no events.
- **I14.** `ATTEMPT_EVENT_TYPES` equals `Object.values($Enums.AssessmentAttemptEventType)` as a set.

*Summary (`summarizeAttemptActivity`)*
- **S1.** exit → return in one session: FULLSCREEN `{ times: 1, ms }`; line `Returned to fullscreen after 2m 14s`.
- **S2.** a tab switch (exit + hidden + blur, then returns) counts once in `awayMs` and once in each per-kind total.
- **S3.** two concurrent sessions: A hidden while B is in view → not away.
- **S4.** leave → next session: PAGE_CLOSED interval; `awayMs` includes it; `Left the assessment page`.
- **S5.** crashed session (no leave, no return): in view until `lastSeenAt + 45s`, away after; `withoutReturn` counted.
- **S6.** away starting ≤5s after `UPLOAD_LINK_OPENED` → `awayAfterUploadLinkMs`; >5s → not.
- **S7.** camera off → on duration; a reopened page before its first `CAMERA_ON` is not counted as "Camera off".
- **S8.** in progress uses `now`; submitted uses `submittedAt`; events after the window are clamped out.
- **S9.** clipboard counts sum `count`; `Paste blocked in Q3 (3 attempts)`.
- **S10.** events in one session within 1s form one timeline entry; "Started" and "Submitted" rows are present.
- **S11.** `Entered fullscreen` (no prior exit) creates no FULLSCREEN interval.

*Recorder (`createIntegrityRecorder`, fake deps)*
- **R1.** `startSession` → seq 0 is `SESSION_STARTED`; seq increments.
- **R2.** repeated `PASTE_BLOCKED` on one question within 1s coalesce into `count`; after 1s, a new seq.
- **R3.** flush sends ≤50 events, `sentAt` = time of send; a retry re-stamps `sentAt`.
- **R4.** network error → retried with backoff; 200 → removed; 409 → stopped, `onStopped(409)`, later `record` ignored.
- **R5.** beaconed events stay queued and go out on the next fetch flush.
- **R6.** 20s with nothing sent → an empty heartbeat batch.
- **R7.** `leave()` records `PAGE_LEFT` once and beacons; `finish()` records nothing.

*The regression guard as a test*
- **C1.** every value produced by `describeEvent` (for every type, paired and unpaired, with
  question and count) and every `SUMMARY_COPY` string does **not** match `BANNED_CLAIM_PATTERN`.
- **C2.** the source of `attempts/[assignmentId]/page.tsx`, `assessment-integrity.tsx`, and the
  builder's strict note do not match `BANNED_CLAIM_PATTERN`.
- **C3.** `ACTIVITY_DISCLAIMER` contains `does not detect` and `not proof`; `CAMERA_DISCLAIMER`
  contains `doesn't record or see the video`.

**13b. `src/features/recruiter-assessments/recruiter-assessments.test.ts`** (extend)

The in-memory store's rows gain `strictMode: false` and `cameraRequired: input.cameraRequired`; its
`publish` sets `strictMode: true`; it implements `countActivityEvents` (from a `activity` map) and
`findAttemptActivity`.
- **P1.** publish sets `strictMode`; publishing twice keeps it; `saveAssessmentDraft` after publish is still CONFLICT.
- **P2.** `cameraRequired` round-trips through create and save while DRAFT; defaults false; preset-built content has `cameraRequired: false`.
- **P3.** `getAssessmentMonitor` → `activityCounts` only when strict.
- **P4.** `getAttemptActivity`: another workspace → NOT_FOUND; a real assignment id with a different
  `assessmentId` → NOT_FOUND; non-strict → `summary: null`.

**13c. `src/features/hire/isolation.test.ts`** (append two suites)
- **"assessment events route is session-scoped and same-origin"** — the route source contains
  `auth()`, `headers.get("origin")` and `recordAttemptEvents`, and contains none of `searchParams`,
  `console.`, `export async function GET`.
- **"attempt activity page 404s a foreign attempt"** — the page contains `requireRecruiterWorkspace`
  and `notFound()`, and not `searchParams`.

No new npm scripts: everything runs in `test:assessment-attempts`, `test:recruiter-assessments` and
the isolation suite.

### Step 14 — CHANGELOG (at implementation)

One line under `## Pending reconcile`:

`- 2026-09-1X [schema|rule] T-219 (plan 140): strict mode for recruiter assessments — RecruiterAssessment.strictMode (set true by publish only; pre-existing rows false) + cameraRequired (builder, DRAFT-editable); AssessmentAttemptSession (per page lifetime, server firstSeenAt/lastSeenAt) + AssessmentAttemptEvent (16 facts: fullscreen/visibility/focus/page leave/clipboard/upload link/camera; unique assignment×session×seq; composite FK to session, CASCADE; RESTRICT to question) via POST /api/assessments/[assignmentId]/events (route handler: sendBeacon/keepalive need it; SameSite=Lax + Origin check; one nested upsert, no interactive tx); device clock corrected per batch; strict attempts refuse phones (client gate + Sec-CH-UA-Mobile on start/save/submit) and browsers without fullscreen; fullscreen exit or camera stop blurs + blocks; copy/cut/paste/drop blocked except paste into file-link fields; recruiter /hire/assessments/[id]/attempts/[assignmentId] shows facts, time away (union of not-in-view across sessions) and fixed disclaimers — no detection or cheating claims (tested).`

---

## 6. Guardrails (DO NOT)

**Standing**
- **DO NOT** edit `middleware.ts`, `src/auth.ts` or `src/auth.config.ts`. Nothing here is on the edge path.
- **DO NOT** use `any`, `console.*`, or `as` casts on the question/answer unions. DOM vendor
  properties use the narrow intersection types in step 9a, not casts.
- **DO NOT** return full Prisma records — explicit `select` on every read.
- **DO NOT** use `<Button asChild>` / `<Button render={<Link>}>`, or a disabled `<Link>`.
- **DO NOT** create files this plan doesn't list: no `use-strict-mode.ts`, no `constants.ts`, no
  `fullscreen.ts`, no second CSS file.
- **DO NOT** modify `src/components/ui/*`.

**T-219**
- **DO NOT** write any user-facing string that claims detection of other screens, devices, eye
  movement, websites, other people, or cheating, and **DO NOT** add scores, risk levels, badges or
  colours that rank candidates by activity. Facts and durations only. All activity copy lives in
  `activity.ts`.
- **DO NOT** present "camera on" as a person being present. **DO NOT** record, upload, snapshot,
  analyse or store video, images or audio. `getUserMedia` is `{ video: true, audio: false }` and the
  stream never leaves the page.
- **DO NOT** store clipboard contents, keystrokes, user agent, IP, window titles or URLs. Events
  carry a type, time, question id and repeat count — nothing else.
- **DO NOT** let any client set `strictMode`. Only `store.publish` writes it, and only to `true`.
- **DO NOT** apply strict behaviour (gates, blocking, recording, the phone refusal) to assessments
  with `strictMode = false`.
- **DO NOT** fullscreen anything but `document.documentElement` — portaled toasts and dialogs would vanish.
- **DO NOT** await anything before calling `requestPageFullscreen()` in a click handler.
- **DO NOT** block the context menu, text selection, or keyboard shortcuts other than copy/cut/paste,
  and don't try to intercept `Esc` (it can't be done; the exit modal is the response).
- **DO NOT** add columns to `RecruiterAssessmentAssignment` or write any T-218-owned column. T-219
  writes only the two new tables and the two new `RecruiterAssessment` columns.
- **DO NOT** use `$transaction(async (tx) => …)` for ingestion. It uses the single nested upsert.
- **DO NOT** add GET/PUT/DELETE to the events route, read `searchParams`, or log request bodies.
- **DO NOT** put a relation filter inside T-218's guarded `updateMany` calls (unchanged).
- **DO NOT** fire GA4 events for any of this (T-253) or notify anyone (T-249).
- **DO NOT** edit the privacy policy or terms — that is Zainab's T-279; raise it.
- **DO NOT** run `prisma db push`, `migrate dev`, `migrate deploy`, seeds or SQL against production,
  and **do not** run `next dev` with the new client while `.env.local` points at production (§7).

## 7. DB safety

**Additive only:** 1 enum, 2 columns (constant default, metadata-only), 2 tables, 5 indexes, 3 FKs.
There is no backfill: every existing row gets `strictMode = false` / `cameraRequired = false`, which
is exactly D-4.

1. **Checkpoint.** Commit non-schema work first; record the hash in the PR body.
2. **Point away from production.** Production is `ep-young-shadow-amawetjy` (plans 114-A, 115, 126).
   **The `PRODUCTION_NEON_HOST_ID` constants in `prisma/scripts/` and `src/repositories/points.ts`
   name `ep-nameless-term-ams9a5e3` and are stale — don't use them as the check.** Set
   `DATABASE_URL` **and** `DIRECT_URL` to a Neon **child branch of production** and confirm the host
   `npx prisma migrate status` prints. If you can't prove it, stop.
3. **Know the chain.** On the child, `npx prisma migrate status` shows whether T-243
   (`20260911090000`), T-244 (`20260911180000`), T-218 (`20260911210000`) and the later migrations are
   applied. **T-219's FKs need `RecruiterAssessmentAssignment` and `AssessmentQuestion`.** Record the
   result in the PR body.
4. **Generate the SQL offline** (step 2) and review it against the expected list.
5. **Rehearse on the child:** `npx prisma migrate deploy`. Then in `psql`:
   - `\d "AssessmentAttemptEvent"` shows `AssessmentAttemptEvent_assignmentId_sessionId_seq_key` and the composite FK.
   - `\d "AssessmentAttemptSession"` shows `AssessmentAttemptSession_assignmentId_clientSessionId_key`.
   - `SELECT count(*) FROM "RecruiterAssessment" WHERE "strictMode" OR "cameraRequired";` → `0`.
   - Run §8 manual steps 3–11 on the child, which exercises the nested upsert through the real pooled endpoint.
6. **Production is not applied by this plan.** `vercel.json` runs `npm run build:deploy` →
   `prisma migrate deploy`, so **merging to master applies it** — Sohail's review is the gate.
   `project-context.md` §16 says `migrate deploy` can't run on production and the 2026-09-02
   CHANGELOG entry says it does; confirm with Sohail before merging.
7. **Rollback:** revert the code **first** (otherwise strict assessments would silently lose strict
   mode). Then:
   `DROP TABLE "AssessmentAttemptEvent"; DROP TABLE "AssessmentAttemptSession"; DROP TYPE "AssessmentAttemptEventType"; ALTER TABLE "RecruiterAssessment" DROP COLUMN "strictMode", DROP COLUMN "cameraRequired";`

## 8. Verification

**Offline**
- `npx tsc --noEmit` — clean, apart from the 3 errors already in `src/features/notification/notify.test.ts` from master.
- `npx eslint` on every file in §3 — no new errors.
- `npm run build` — succeeds; `/api/assessments/[assignmentId]/events` and `/hire/assessments/[assessmentId]/attempts/[assignmentId]` are `ƒ`.
- `npm run test:assessment-attempts` — existing 29 + G1–G3, I1–I14, S1–S11, R1–R7, C1–C3, all green.
- `npm run test:recruiter-assessments` — existing 36 + P1–P4 green.
- `npm run test:assessment-presets` — still 15/15.
- `npx cross-env NODE_OPTIONS=--conditions=react-server tsx src/features/hire/isolation.test.ts` — existing 11 + 2 new.

**Manual — on the child branch from §7, never production.** Recruiter R; candidates C and D
(`ENABLE_DEV_AUTH=true`). **Record steps 3–11 for the evidence.**

1. **Legacy unchanged:** an assessment published before migration (or with `strictMode` set false on
   the child) → C opens it on a phone-sized viewport, answers and submits as in T-218. No gate, no
   modal, no rows in `AssessmentAttemptSession`.
2. R builds an assessment with all four question types, ticks **Require camera**, sees the
   strict-mode note, creates and sends to C. The monitor facts read `Strict mode · Camera required`
   and there is an Activity column.
3. **Phone gate:** C opens the link in Chrome DevTools device mode (a phone) → ✗ laptop-or-desktop
   and Start disabled. Force-enable Start in DevTools → the server refuses (`Sec-CH-UA-Mobile: ?1`)
   with the laptop message.
4. **Desktop Chrome:** checklist ✓ laptop, ✓ fullscreen → **Allow camera** → prompt → preview →
   **Start** → the page goes fullscreen and the questions appear, with the self-view bottom-right.
5. **Fullscreen exit:** press `Esc` → questions blur **immediately**, the "Fullscreen Required" modal
   shows and Tab can't reach the answers. Click **Return to fullscreen** → unblurred, and the caret is
   back where it was in the paragraph.
6. **Tab switch:** `Ctrl+Tab` away for ~10s and back → modal (fullscreen was exited) → return.
7. **Clipboard:** `Ctrl+C` on a question → blocked with a toast; `Ctrl+V` in the paragraph → blocked;
   drag text into it → blocked; paste a link into the file-link field → **allowed**.
8. **Upload link:** open it → a new tab (fullscreen exits) → come back → return to fullscreen.
9. **Camera:** revoke camera permission in site settings (or unplug) → "Camera Required" modal →
   re-allow → **Turn camera on** → continue.
10. **Leave and reopen:** close the tab, wait ~30s, reopen from `/assessments` → the modal asks to
    enter fullscreen (and the camera) → continue.
11. **Submit** → fullscreen exits, the camera light turns off, "Submitted".
12. **Recruiter:** the monitor shows `{n} events · View` for C. The activity page shows:
    - the disclaimer and camera disclaimer
    - "Time away" roughly matching the time spent out (steps 5–10), with the upload-link share
    - `Fullscreen exited` N times, page hidden, window not focused, `Page closed` ≈30s, camera off ≈ step 9
    - `Copy, cut and paste blocked` ≥3 and `Links pasted` 1
    - a timeline with a row per step and the times in IST
13. **SQL:**
    ```sql
    SELECT type, count(*) FROM "AssessmentAttemptEvent" WHERE "assignmentId" = '<C>' GROUP BY 1 ORDER BY 1;
    SELECT "clientSessionId", "firstSeenAt", "lastSeenAt" FROM "AssessmentAttemptSession" WHERE "assignmentId" = '<C>';
    ```
    Every type from steps 4–11 is present, there are 2+ sessions, and no event has a `questionId`
    from another assessment.
14. **Idempotency:** in DevTools, replay one events request → the response is 200 with no new rows.
15. **Isolation:** as D, POST to C's events URL → 404 and no rows. As another recruiter, open C's
    activity page URL → 404. A cross-origin POST (`curl` with `Origin: https://example.com` plus a
    valid cookie) → 403.
16. **Browsers:** repeat steps 4–7 in **Firefox** and **Safari (macOS)**. **Safari: confirm typing
    works in fullscreen.** If it doesn't, stop and report — Safari would need to be gated like an
    unsupported browser.
17. **Builder preview regression:** `/hire/create-test` Preview renders as before (no gate, no guard, no recording).

**Files that should have changed** — exactly §3, nothing else.

## 9. Commit message

```
feat(assessments): strict mode — fullscreen, camera, blocked clipboard and recorded page activity (T-219)

Every assessment published from now on is strict (RecruiterAssessment.strictMode,
set by publish only; existing ones keep T-218 behaviour). Candidates must use a
laptop or desktop (client gate + Sec-CH-UA-Mobile on start/save/submit) in a
browser that can enter fullscreen, and keep the camera on when the recruiter
requires it (cameraRequired). Leaving fullscreen, or the camera stopping, blurs
the questions behind a blocking modal until it's back. Copy, cut, paste and
drop are blocked, except pasting a link into a file-link field.

Fullscreen, visibility, focus, page-leave, clipboard, upload-link and camera
changes are recorded against the attempt (AssessmentAttemptSession +
AssessmentAttemptEvent) through one same-origin route that sendBeacon can
reach; batches are idempotent, device clocks are corrected per batch, and
writes are a single nested upsert. Recruiters see the timeline, per-signal
durations and time away (the union of not-in-view time across page sessions)
on a per-attempt page with fixed disclaimers. Nothing claims detection of
screens, devices, eye movement, websites, helpers or cheating, and a test
enforces it.
```

---

## 10. Architecture decisions made in this plan

| # | Decision | Why |
|---|---|---|
| A1 | The attempt is `RecruiterAssessmentAssignment`; events hang off it through a **session** table | Plans 128/129 name it the attempt. Sessions give server-observed liveness, so a crashed page can't look "in view" forever. |
| A2 | Composite FK `(assignmentId, sessionId)` → session | A client session id can never attach events to another attempt; one cascade path |
| A3 | **No denormalized totals** on the assignment | One source of truth; totals are derived on read (monitor uses `groupBy`) |
| A4 | Route Handler for ingestion | `sendBeacon` / `keepalive` can't call Server Actions, and page leave is a required signal |
| A5 | One nested upsert per batch, retry once on P2002 | Atomic session + events without an interactive transaction (Neon pooler) |
| A6 | Clock correction `occurredAt + (receivedAt − sentAt)` | Wrong device clocks still produce correct times; error = network latency |
| A7 | Heartbeat every 20s, in view bounded by `lastSeenAt + 45s` | A killed or offline page stops counting as in view |
| A8 | "Time away" = union of **not-in-view** across sessions | No double counting of simultaneous signals; correct with two tabs or devices |
| A9 | Per-kind totals count only explicit change → return pairs | "Fullscreen exited" means an exit happened, not "hadn't re-entered yet" |
| A10 | Phone = UA-CH `mobile` or screen short side < 600 CSS px | Phones in any orientation; tablets and narrow desktop windows pass (D-2 says phones) |
| A11 | Strict mode, phone refusal and recording apply only to `strictMode` assessments | D-4: already-published assessments keep T-218 behaviour |
| A12 | All activity copy in `activity.ts`, guarded by a banned-claims test | Makes the regression guard mechanical, not a review hope |
| A13 | Blur via CSS `:not(:fullscreen)` **and** React state | The CSS reacts the same frame fullscreen exits; the state drives `inert` and the modal |
| A14 | Beaconed events stay queued until a fetch confirms | A silently dropped beacon is still delivered; the unique key dedupes |

## 11. Honest limits, out of scope, risks

**What the product must say it cannot do** (candidate-facing: "Nothing outside this page is
recorded"; recruiter-facing: the disclaimers):
- Everything is **reported by the candidate's browser**. A modified browser can suppress or fake
  events, so a missing event isn't proof. The gates and blocking are client-side and can be bypassed
  by a determined user. The phone refusal is also enforced server-side for Chromium only.
- Window blur has many causes (other apps, system dialogs, notifications). Hidden doesn't say tab vs
  minimise vs lock.
- No detection of screenshots, screen recording, printing, devtools, a second screen, a second
  device, other people, eye or face — none of this is possible from a web page, and none of it is claimed.
- "Camera on" only means the camera stream was running. Nobody sees the video.
- Times carry network-latency error (typically < 1s). Pages that die offline lose their last events.
  Recording stops at 1,000 events per attempt.

**Out of scope:** countdown timers / auto-submit (plan 129 D-5), per-question timing, print blocking,
AI or face analysis, candidate-visible activity log, admin console (T-273), GA4 (T-253), recruiter
notification on completion (T-249), privacy/terms copy (T-279), rate limiting beyond the per-batch,
per-attempt and per-session caps (Sohail's limiter can be added later), including activity in
own-data export (T-217 follow-up, Shivansh).

**Risks**
- **Legal:** the privacy policy doesn't cover this data. Production release waits on T-279 (Zainab).
- **Safari fullscreen typing** — verified in §8 step 16; it may force gating Safari.
- **T-218 local transactions:** `saveAnswer` / `submit` use `writeClient().$transaction`, which is the
  pooled client when `ENABLE_DUAL_WRITE` is unset. This is the failure the presets PR hit, and local
  manual tests may fail on answers before T-219 is involved. Production has dual-write on. It is
  flagged, not fixed here (T-218 follow-up).
- **Design:** T-203 / Shallika approval is pending for the gate, modal and activity page.
- **Migration chain** (T-243 → T-219) is unverified on production and applies on the next master deploy.
- **Load:** heartbeats every 20s per active candidate plus flushes. It is bounded, but it is Vercel
  function invocations, so watch costs at scale.
