# Plan 121 — Recruiter assessment builder (R9, part 1)

**Status:** implemented on `ab-dev` (2026-09-10), staged, not committed.
**Ticket:** R9 in `docs/plans/112-september-execution-plan.md` §390 — "Assessment
builder & candidate tests". This plan covers **builder + preview + list only**.
Publish / assign / attempt / auto-evaluate are a later ticket.

**Local prerequisite:** `/hire` sign-in needs `ENABLE_RECRUITER_AUTH=true` in
`.env.local`. Without it `/talent/login` and `/talent/register` render "Not open
yet" and the `recruiter-otp` Credentials provider in `src/auth.ts` refuses to
authorize, so none of the manual checks in §8 can be run. This is the kill
switch added 2026-08-25, **not** anything this plan changed — opening it in
production is ticket R1 (see `112-september-execution-plan.md` §312).

## 1. Goal
Let an approved recruiter open the Shortlist panel on `/hire`, click **Create
assessment for Shortlisted**, and build a Google-Forms-style assessment at
`/hire/create-test` — title, subheading, instructions, ordered questions
(multiple choice with single or multiple correct answers, paragraph, file
upload), duration, pass mark, per-question points — preview it on the exact
component the candidate will later attempt on, and save it as a `DRAFT` that
appears on `/hire/assessments`. Nothing is published, assigned or sent.

## 2. Current behavior
- The Shortlist panel is `HireTalentPod` (`src/components/hire/hire-talent-pod.tsx`),
  opened from the "Shortlist" nav button in `hire-chrome.tsx` via
  `useHireDesk().openPod()`. It is a **view state**, not a route — `view === "pod"`
  swaps `hire-scout-region` for `hire-pod-region` inside `/hire`.
- The panel's right rail (`<aside className="hire-pod__request">`) holds a note
  textarea and one action: **Place request for N candidates**. There is no
  assessment entry point anywhere in the product.
- `hire-chrome.tsx` decides desk chrome with
  `/^\/hire\/[^/]+$/.test(pathname)` minus an explicit deny-list
  (`/hire/evidence`, `/hire/requests`, `/hire/matches`). Any new single-segment
  `/hire/*` route falls into desk mode unless added to that list.
- Recruiter-scoped writes go through `requireRecruiterWorkspace()`
  (`src/features/recruiter-workspace/workspace.ts`) — its own doc comment already
  names assessments as in-scope. Pages use `requireRecruiter()`
  (`src/lib/program-auth.ts`, redirects to `/talent/pending`).
- **Assessment tables that exist and must not be used here:**
  `AssessmentReport` / `AssessmentScore` / `AssessmentReportShare` are *result*
  tables (recommendation, strengths, per-dimension scores) with zero live usage
  — they are the output of grading, not the definition of a test.
  `Question` / `QuestionOption` are reachable only through
  `QuizActivityConfig → Activity → Module → ProgramVersion → LearningProgram`,
  have no `type` column, and would force a synthetic learning program per
  recruiter assessment. §319 of plan 112 suggested reusing them; **this plan
  deliberately does not** (decision confirmed 2026-09-10).

## 3. Files to touch

**Schema**
- `prisma/schema.prisma` [edit] — 2 enums + 3 models + back-relations on
  `Organization` and `User`.
- `prisma/migrations/20260911090000_recruiter_assessment_builder/migration.sql` [new]

**Server**
- `src/lib/validations/assessment.ts` [new] — Zod schemas for the whole
  assessment payload; imported by both the action and the client builder.
- `src/features/recruiter-assessments/service.ts` [new] — store-injectable
  `createAssessment`, `saveAssessmentDraft`, `listAssessments`, `getAssessment`,
  `deleteAssessment`. No Prisma import.
- `src/features/recruiter-assessments/prisma-store.ts` [new] — the real store,
  every query with an explicit `select`.
- `src/features/recruiter-assessments/recruiter-assessments.test.ts` [new] —
  in-memory-store suite (mirrors `src/features/recruiter-jobs/recruiter-jobs.test.ts`).
- `src/app/actions/recruiter-assessment-actions.ts` [new] — server actions.

**Routes**
- `src/app/hire/create-test/page.tsx` [new] — Server Component, `requireRecruiter()`,
  reads the shortlist, renders the builder.
- `src/app/hire/assessments/page.tsx` [new] — Server Component, `requireRecruiter()`,
  lists this recruiter's assessments.

**Components**
- `src/components/hire/assessment/assessment-builder.tsx` [new] — Client, the
  whole builder form + preview toggle. Owns all draft state.
- `src/components/hire/assessment/question-editor.tsx` [new] — Client, one
  question card (type dropdown, options, Move Up / Move Down / Duplicate / Delete).
- `src/components/hire/assessment/candidate-assessment-screen.tsx` [new] —
  Client, **the real candidate screen**. Preview mounts it with `readOnly`; the
  later attempt route mounts the same component with `readOnly={false}`.
- `src/components/hire/assessment/assessment-types.ts` [new] — the client-side
  draft types, inferred from the Zod schemas (`z.infer`), no duplication.

**Edits**
- `src/components/hire/hire-talent-pod.tsx` [edit] — CTA in the right rail.
- `src/components/hire/hire-chrome.tsx` [edit] — add `/hire/create-test` and
  `/hire/assessments` to the desk deny-list; add an "Assessments" nav button.
- `src/app/hire/hire-scout.css` [edit] — CTA + builder + preview styles.
- `src/features/hire/isolation.test.ts` [edit] — one new suite (see step 13).
- `package.json` [edit] — `"test:recruiter-assessments"` script.
- `docs/CHANGELOG.md` [edit] — one dated line under `## Pending reconcile`.

## 4. Server vs Client

| File | Boundary | Notes |
|---|---|---|
| `src/app/hire/create-test/page.tsx` | **Server** | Passes only plain JSON to the builder: `shortlistCount: number`, `shortlistRefs: string[]`, `existingDraft: AssessmentDraft \| null`. |
| `src/app/hire/assessments/page.tsx` | **Server** | Renders rows directly; no client component except the delete button. |
| `assessment-builder.tsx` | **Client** | `"use client"`. Holds the entire draft in `useState`; saves via `useTransition` + server action. |
| `question-editor.tsx` | **Client** | Receives `question`, `index`, `total` and **callback props** (`onChange`, `onMoveUp`, `onMoveDown`, `onDelete`). Client→Client, which is fine. |
| `candidate-assessment-screen.tsx` | **Client** | Receives the draft + `readOnly: boolean`. Pure render + local answer state. |
| `assessment-types.ts` | shared | Types only, no runtime code. |
| `service.ts` / `prisma-store.ts` | **Server only** | `import "server-only"` at the top of both. |

**Server→Client boundary check:** no functions, icon components, class instances
or `Date` objects cross from a Server Component. `createdAt` / `updatedAt` are
serialized to ISO strings in the page before being passed down. `lucide-react`
icons are imported **inside** the client components, never passed as props.

## 5. Steps

### Step 1 — Schema
Add to `prisma/schema.prisma`:

```prisma
enum RecruiterAssessmentStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

enum AssessmentQuestionType {
  MULTIPLE_CHOICE
  PARAGRAPH
  FILE_UPLOAD
}

/// A recruiter-authored test. Owned by one workspace (T-226): reads and writes
/// go through requireRecruiterWorkspace() and are scoped by organizationId.
///
/// Deliberately NOT built on Question/QuestionOption: those are reachable only
/// through QuizActivityConfig -> Activity -> Module -> LearningProgram, which
/// would mean inventing a learning program for every recruiter test.
model RecruiterAssessment {
  id              String                    @id @default(cuid())
  organizationId  String
  createdByUserId String
  title           String
  subheading      String?
  instructions    String?
  status          RecruiterAssessmentStatus @default(DRAFT)
  /// Null = untimed. Whole minutes; the candidate screen renders the chip.
  durationMinutes Int?
  /// Percentage of auto-gradeable points needed to pass.
  passMarkPercent Int                       @default(60)
  /// Read-only provenance: which shortlisted candidates this was drafted for.
  /// Public AB-#### refs, never user ids. Nothing reads this yet — the assign
  /// ticket does. It is captured at draft time because the shortlist changes.
  shortlistRefs   String[]                  @default([])
  publishedAt     DateTime?
  archivedAt      DateTime?
  createdAt       DateTime                  @default(now())
  updatedAt       DateTime                  @updatedAt

  organization Organization         @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  createdBy    User                 @relation("RecruiterAssessmentsCreated", fields: [createdByUserId], references: [id], onDelete: Cascade)
  questions    AssessmentQuestion[]

  @@index([organizationId, createdByUserId, updatedAt(sort: Desc)])
  @@index([status])
}

model AssessmentQuestion {
  id           String                 @id @default(cuid())
  assessmentId String
  position     Int
  type         AssessmentQuestionType
  /// The question text the candidate reads.
  title        String
  helpText     String?
  isRequired   Boolean                @default(true)
  points       Int                    @default(1)
  /// MULTIPLE_CHOICE only. False = radio group, true = checkbox group.
  allowMultipleCorrect Boolean        @default(false)
  /// PARAGRAPH only. Word cap enforced on the candidate screen.
  maxWords     Int?
  /// FILE_UPLOAD only. Where the recruiter expects the file to be uploaded.
  /// ABTalks stores no files; the candidate answers with their own link.
  uploadDestinationUrl String?
  /// RESERVED for a later sections ticket. Never written in v1 — always null.
  /// No relation and no FK on purpose: the AssessmentSection table does not
  /// exist yet, and a dangling FK is worse than a documented placeholder.
  sectionId    String?

  assessment RecruiterAssessment        @relation(fields: [assessmentId], references: [id], onDelete: Cascade)
  options    AssessmentQuestionOption[]

  @@unique([assessmentId, position])
  @@index([assessmentId, position])
}

model AssessmentQuestionOption {
  id         String  @id @default(cuid())
  questionId String
  position   Int
  body       String
  isCorrect  Boolean @default(false)

  question AssessmentQuestion @relation(fields: [questionId], references: [id], onDelete: Cascade)

  @@unique([questionId, position])
  @@index([questionId, isCorrect])
}
```

Back-relations to add:
- `Organization` — `recruiterAssessments RecruiterAssessment[]`
- `User` — `assessmentsAuthored RecruiterAssessment[] @relation("RecruiterAssessmentsCreated")`

Then `npx prisma format` and `npx prisma generate`.

### Step 2 — Migration
Write `prisma/migrations/20260911090000_recruiter_assessment_builder/migration.sql`
by hand (the repo keeps a migrations folder; do **not** rely on `db push` for
this one — three new tables with FKs deserve a reviewable file). It is purely
additive: two `CREATE TYPE`, three `CREATE TABLE`, the indexes, the FKs. **No
existing table is altered.** See §7 for how to apply it.

### Step 3 — Validation schemas
`src/lib/validations/assessment.ts`. One schema tree, used by the action **and**
by the client for inline field errors:

```ts
export const MAX_PARAGRAPH_WORDS = 250;

const optionSchema = z.object({
  body: z.string().trim().min(1, "Give this option a name").max(300),
  isCorrect: z.boolean().default(false),
});

const baseQuestion = z.object({
  title: z.string().trim().min(1, "Write the question").max(2000),
  helpText: z.string().trim().max(1000).optional().nullable(),
  isRequired: z.boolean().default(true),
  points: z.number().int().min(0).max(100).default(1),
});

const mcqSchema = baseQuestion.extend({
  type: z.literal("MULTIPLE_CHOICE"),
  allowMultipleCorrect: z.boolean().default(false),
  options: z.array(optionSchema).min(2, "Add at least two options").max(12),
});

const paragraphSchema = baseQuestion.extend({
  type: z.literal("PARAGRAPH"),
  maxWords: z.number().int().min(10).max(1000).default(MAX_PARAGRAPH_WORDS),
});

const fileUploadSchema = baseQuestion.extend({
  type: z.literal("FILE_UPLOAD"),
  uploadDestinationUrl: z
    .string()
    .trim()
    .url("Enter the full link where the file should be uploaded"),
});

export const assessmentQuestionSchema = z.discriminatedUnion("type", [
  mcqSchema,
  paragraphSchema,
  fileUploadSchema,
]);

export const assessmentDraftSchema = z.object({
  assessmentId: z.string().min(1).optional(), // present = update
  title: z.string().trim().min(1, "Give the assessment a title").max(200),
  subheading: z.string().trim().max(300).optional().nullable(),
  instructions: z.string().trim().max(5000).optional().nullable(),
  durationMinutes: z.number().int().min(1).max(480).nullable().default(null),
  passMarkPercent: z.number().int().min(0).max(100).default(60),
  shortlistRefs: z.array(z.string().max(64)).max(500).default([]),
  questions: z
    .array(assessmentQuestionSchema)
    .min(1, "Add at least one question")
    .max(100),
});
```

Two rules the schema must also enforce, via `.superRefine` on
`assessmentDraftSchema`:
1. Every `MULTIPLE_CHOICE` question has **at least one** `isCorrect` option.
2. When `allowMultipleCorrect === false`, exactly one option is `isCorrect`.

Neither belongs on the client alone — the action must refuse a payload that
violates them.

### Step 4 — Service (`src/features/recruiter-assessments/service.ts`)
`import "server-only"` at the top. Define the store port and take it as the
first argument, exactly like `features/recruiter-jobs/service.ts`:

```ts
export type Scope = { organizationId: string; createdByUserId: string };

export type AssessmentStore = {
  create(scope: Scope, input: CreateInput): Promise<{ id: string }>;
  replaceContent(assessmentId: string, scope: Scope, input: ContentInput): Promise<void>;
  findOwned(assessmentId: string, scope: Scope): Promise<AssessmentRow | null>;
  listOwned(scope: Scope): Promise<AssessmentListRow[]>;
  delete(assessmentId: string, scope: Scope): Promise<boolean>;
};
```

Rules the service enforces:
- **Every** read and write takes `Scope`. There is no "find by id" without it.
- A row that exists but belongs to another workspace resolves to `null`, and the
  caller returns **NOT_FOUND**, not FORBIDDEN — an id must not be enumerable.
  (Same rule T-245 landed for jobs; see CHANGELOG 2026-09-10.)
- `saveAssessmentDraft` refuses when `status !== "DRAFT"` with
  "This assessment has already been published and can no longer be edited."
  This matters because of the write strategy below.

### Step 5 — Prisma store (`prisma-store.ts`)
`import "server-only"`. Explicit `select` on every query — no full-record returns.

**Write strategy for questions — full replace inside one transaction:**

```
prisma.$transaction(async (tx) => {
  await tx.assessmentQuestion.deleteMany({ where: { assessmentId } });
  for (const [i, q] of questions.entries()) {
    await tx.assessmentQuestion.create({
      data: {
        assessmentId,
        position: i,
        ...fields,
        options: { create: q.options?.map((o, j) => ({ ...o, position: j })) ?? [] },
      },
      select: { id: true },
    });
  }
  await tx.recruiterAssessment.update({
    where: { id: assessmentId },
    data: header,
    select: { id: true },
  });
});
```

**Why full replace and not per-row position updates:** `@@unique([assessmentId,
position])` makes a naive swap fail mid-transaction (both rows briefly hold the
same position). Full replace means the DB never sees a partial order, and
reordering stays pure client state. It is safe **only** while `status = DRAFT`,
because no attempt row can reference a question id yet — which is exactly what
step 4's status guard protects. When the attempt ticket lands, this becomes a
diff-based update, and the guard is what tells that author so.

### Step 6 — Server actions (`src/app/actions/recruiter-assessment-actions.ts`)
`"use server"` at the top. Mirror `recruiter-job-actions.ts` exactly:

- `saveRecruiterAssessmentAction(input: unknown)` — `requireRecruiterWorkspace()`
  → `{ ok: false, message, status: 403 }` on failure; `assessmentDraftSchema.safeParse`;
  create when `assessmentId` is absent, `saveAssessmentDraft` when present;
  `revalidatePath("/hire/assessments")`; return `{ ok: true, data: { id } }`.
- `deleteRecruiterAssessmentAction({ assessmentId })` — same gate, service
  `delete`, revalidate.

Both wrap the body in try/catch and log through `logger.error` with a
`[recruiter-assessment-actions]` prefix. **No `console.error`.** Errors returned
to the client are human-readable strings, never `String(error)`.

### Step 7 — The Shortlist CTA (`hire-talent-pod.tsx`)
In the `<aside className="hire-pod__request">`, **below** the existing "Place
request" submit button, add a divider and the assessment CTA. It reads `rows`,
which is already computed in that component (server rows + guest extras).

```tsx
{rows.length === 0 ? (
  <button
    type="button"
    disabled
    className="hire-pod__assess is-disabled"
    title="Add candidates to your Shortlist first"
  >
    <ClipboardList className="size-4" aria-hidden="true" />
    Create assessment for Shortlisted
  </button>
) : (
  <Link href="/hire/create-test" className="hire-pod__assess">
    <ClipboardList className="size-4" aria-hidden="true" />
    Create assessment for Shortlisted
  </Link>
)}
```

Two things this must get right:
- **Do not render a disabled `<Link>`.** There is no such thing — an anchor with
  `aria-disabled` is still clickable. The empty state is a real `<button disabled>`.
- **Do not pass candidate refs in the URL.** The create page re-reads the
  shortlist server-side with `getShortlist(userId)`, the same call
  `src/app/hire/layout.tsx` already makes. Candidate refs in a query string end
  up in logs and browser history for no benefit.

### Step 8 — `/hire/create-test` page
Server Component:

```tsx
export const metadata = { title: "Create an assessment | ABTalks Hire" };

export default async function CreateTestPage() {
  const { userId } = await requireRecruiter();
  const list = await getShortlist(userId);
  const refs = list.ok
    ? list.data.map((r) => encodeCandidateRef("PROGRAM", r.memberId))
    : [];
  return (
    <AssessmentBuilder
      shortlistCount={refs.length}
      shortlistRefs={refs}
      existingDraft={null}
    />
  );
}
```

`requireRecruiter()` redirects an unapproved visitor to `/talent/pending` — this
route is **not** public and must not be added to any public allow-list.

### Step 9 — The builder (`assessment-builder.tsx`)

Layout: a two-pane page. Left = the form. Right (or a full-width tab on mobile)
= the live preview. A segmented control at the top switches **Edit / Preview**;
on desktop ≥1100px both are visible side by side and the control only scrolls.

**Header fields:** Assessment Title (required), Subheading, Instructions
(textarea). **Settings row:** Duration in minutes (number input + an "Untimed"
checkbox that sets it to `null`), Pass mark % (number input 0–100).

**Initial state — one MCQ, already added**, per the brief:

```ts
const NEW_MCQ = () => ({
  key: crypto.randomUUID(), // client-only React key, never sent
  type: "MULTIPLE_CHOICE" as const,
  title: "",
  helpText: null,
  isRequired: true,
  points: 1,
  allowMultipleCorrect: false,
  options: [
    { body: "Option 1", isCorrect: false },
    { body: "Option 2", isCorrect: false },
  ],
});
const [questions, setQuestions] = useState([NEW_MCQ()]);
```

**Type switching.** The dropdown offers Multiple Choice / Paragraph / File
Upload. Changing type keeps `title`, `helpText`, `isRequired`, `points` and
resets the type-specific fields (options / `maxWords` / `uploadDestinationUrl`).
Do **not** silently keep options on a paragraph question — the discriminated
union will reject the payload and the recruiter gets a confusing error.

**Reorder.** Under each question card, a small row of controls:
`Move Up` (disabled at index 0), `Move Down` (disabled at the last index),
`Duplicate`, `Delete` (disabled when only one question remains). Move is an
array swap on client state — no server round trip, no `position` arithmetic:

```ts
function move(from: number, to: number) {
  setQuestions((q) => {
    if (to < 0 || to >= q.length) return q;
    const next = [...q];
    [next[from], next[to]] = [next[to], next[from]];
    return next;
  });
}
```

After a move, focus the moved card (`document.getElementById(\`q-${key}\`)?.focus()`)
so keyboard users are not dumped at the top of the page, and fire a `polite`
live-region announcement ("Question moved to position 3 of 7").

**Per type in the editor:**
- *Multiple Choice*: a list of option rows, each with a text input, a
  correct-answer control and a remove button; an **Add option** button; a
  **Multiple correct** switch. When the switch is off the correct control is a
  radio (picking one clears the others); when on it is a checkbox and any number
  may be correct. Toggling the switch **off** while two or more are correct keeps
  the first and clears the rest, with a toast saying so.
- *Paragraph*: a single number input for the word cap, defaulted to
  `MAX_PARAGRAPH_WORDS` (250). No answer field here — the recruiter is not
  answering it.
- *File Upload*: one URL input, labelled "Where should candidates upload the
  file?" with helper text "ABTalks does not store files. Candidates open this
  link, upload there, and paste their own link back as the answer."

**Save.** One button, "Save draft". `useTransition` → `saveRecruiterAssessmentAction`.
On `ok: false`, `toast.error(res.message)` and do not clear state. On `ok: true`,
`toast.success("Draft saved")` and `router.push("/hire/assessments")`.
There is **no Publish button** in this build.

### Step 10 — The candidate screen (`candidate-assessment-screen.tsx`)
This is the component the later attempt route will mount. Props:

```ts
{ draft: AssessmentDraft; readOnly: boolean }
```

It renders: the title, subheading, instructions block, a duration chip
("30 minutes" — static, it does not count down in preview), a pass-mark line,
then each question in order with the real input the candidate will use —
radio group, checkbox group, a fixed-height textarea with a live
"128 / 250 words" counter that turns red past the cap, or the file-upload block
(the recruiter's destination rendered as an `<a target="_blank" rel="noopener noreferrer">`
plus a "Paste the link to your uploaded file" URL input).

When `readOnly` is true, every input is `disabled` and a banner reads
"Preview — this is exactly what the candidate sees. Answers are not saved."
The submit button is present but disabled.

Building the preview as this component, rather than a separate mock, is the
point: it is what makes "previews it using the real candidate screen" true, and
it leaves the attempt ticket with one surface instead of two to keep in sync.

### Step 11 — `/hire/assessments` page
Server Component, `requireRecruiter()`, then `listAssessments` scoped to the
workspace. A table (card list on mobile) with: **Title**, **Questions**,
**Duration**, **Pass mark**, **Status**, **Students**, **Passed**, **Failed**,
**Last edited**, and a row action to open the builder or delete.

**Students / Passed / Failed render `—`, not `0`,** with a footnote: "Results
appear once you publish an assessment and assign it." There is no attempt table
in this build, and a hard `0` would claim nobody attempted rather than that
attempts do not exist yet. Empty state: "No assessments yet" plus a link to
`/hire/create-test`.

### Step 12 — Chrome wiring (`hire-chrome.tsx`)
1. Add both routes to the desk deny-list so they render in `hire-plain`, not as
   a desk view:
   ```ts
   const desk =
     pathname === "/hire" ||
     (/^\/hire\/[^/]+$/.test(pathname ?? "") &&
       pathname !== "/hire/evidence" &&
       pathname !== "/hire/requests" &&
       pathname !== "/hire/matches" &&
       pathname !== "/hire/create-test" &&
       pathname !== "/hire/assessments");
   ```
   Without this, `/hire/create-test` renders inside `hire-workspace` with the
   journey rail and a parked scout region — a broken page.
2. Add an **Assessments** nav button beside "Shortlist", as a
   `<Link href="/hire/assessments">` styled with the existing `hire-hbtn` class.
   It is a route, not a desk view — do not add a fourth `HireDeskView`.

`/hire/[requestId]/page.tsx` is a dynamic sibling; Next.js resolves the static
`create-test` and `assessments` segments first, so there is no route conflict.
Confirm by loading `/hire/create-test` and checking it is not the request page.

### Step 13 — Tests
- `src/features/recruiter-assessments/recruiter-assessments.test.ts` — in-memory
  store, mirroring `recruiter-jobs.test.ts`. Cases: create returns an id;
  save replaces questions and renumbers positions from 0; a foreign workspace's
  id resolves to NOT_FOUND on read, save and delete; saving a `PUBLISHED` row is
  refused; MCQ with zero correct options is rejected; single-correct MCQ with two
  correct options is rejected; paragraph question carrying options is rejected.
- `src/features/hire/isolation.test.ts` [edit] — one suite:
  "recruiter assessment actions go through the workspace gate", asserting
  `src/app/actions/recruiter-assessment-actions.ts` contains
  `requireRecruiterWorkspace` and does **not** use `session.user.id` as a scope
  value.
- `package.json` — `"test:recruiter-assessments": ...` matching the exact runner
  the sibling `test:recruiter-jobs` script uses.

### Step 14 — CHANGELOG
Append one dated line under `## Pending reconcile` in `docs/CHANGELOG.md`,
tagged `[schema|rule]`, naming the three new tables, the two new routes, the
workspace scoping rule and the DRAFT-only full-replace write strategy.

## 6. Guardrails for Cursor (DO NOT)

- **DO NOT** touch `middleware.ts` or `auth.config.ts`. No file in this plan is
  reachable from the edge bundle. If you find yourself importing `@/lib/*` into
  something middleware imports, stop.
- **DO NOT** use `<Button asChild>` or `<Button render={<Link>}>`. Links that
  look like buttons use `buttonVariants(...)` on the `<Link>` directly, or the
  hand-rolled `hire-*` CSS classes the rest of this surface uses.
- **DO NOT** render a disabled `<Link>` for the empty-shortlist state. Use a
  real `<button type="button" disabled>`.
- **DO NOT** add `requireRole` / `requireAdmin` to these routes — they are
  recruiter surfaces, gated by `requireRecruiter()` (pages) and
  `requireRecruiterWorkspace()` (actions).
- **DO NOT** reuse `Question` / `QuestionOption` / `QuizActivityConfig` /
  `Activity`, and do not create a `Module`, `ProgramVersion` or `LearningProgram`
  row for an assessment. If a plan-112 line seems to ask for it, this plan
  overrides it — §2 says why.
- **DO NOT** write to `AssessmentReport` / `AssessmentScore` /
  `AssessmentReportShare`. Those are grading output and belong to a later ticket.
- **DO NOT** write `SkillEvidence` — it has no live writer and fixing that is
  P0-0 in plan 112, not this ticket.
- **DO NOT** implement publish, assign, notify, email, attempt, submit or
  grading. No `PipelineStage` transition, no `TalentEngagementRequest` write, no
  `lib/email.ts` call. The Save button saves a DRAFT and nothing leaves the row.
- **DO NOT** upload or store candidate files. File-upload questions hold a URL
  the recruiter typed, and later a URL the candidate types. No blob storage, no
  `multipart/form-data`, no Supabase bucket.
- **DO NOT** put candidate refs, ids or names in a query string. The create page
  reads the shortlist server-side.
- **DO NOT** return full Prisma records. Every query carries an explicit
  `select`. Every multi-step write is inside `prisma.$transaction`.
- **DO NOT** use `console.*`. Logging is `lib/logger.ts`.
- **DO NOT** use `any`, or cast the discriminated union with `as`. If TypeScript
  complains about a question type, narrow on `question.type`.
- **DO NOT** create files this plan does not list. In particular: no
  `use-assessment-draft.ts` hook, no `reorder.ts` helper, no `constants.ts` — a
  five-line array swap is inlined in the component that owns the state.
- **DO NOT** run `prisma migrate deploy`, `db push`, seeds or any deploy against
  the production database. §7 is a checklist for a human, not a script to run.
- **DO NOT** add a fourth `HireDeskView`. `/hire/assessments` is a route.

## 7. DB safety

Schema change: **additive only** — two new enums, three new tables, no column
added to or removed from any existing table, no data backfill.

1. Commit all non-schema work first and note the commit hash in the PR body.
2. Take a Neon branch snapshot from the current production branch before
   applying anything. Record the branch name and timestamp in the PR body.
3. `npx prisma format && npx prisma generate` locally.
4. Apply to the **local/dev** database only:
   `npx prisma migrate dev --name recruiter_assessment_builder`.
   Confirm the generated SQL is purely `CREATE TYPE` / `CREATE TABLE` /
   `CREATE INDEX` / `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY`. If it
   contains a `DROP` or an `ALTER COLUMN` on an existing table, stop and report.
5. **Ask before applying to Neon.** Production migration runs only on explicit
   approval, after the diff in step 4 has been reviewed.
6. No seed script and no backfill. Existing recruiters simply have zero rows.

Rollback: the three tables can be dropped with no effect on any existing row,
because nothing outside this feature references them.

## 8. Verification

**Build / typecheck**
- `npx tsc --noEmit` clean.
- `npm run build` succeeds.
- `npm run test:recruiter-assessments` — all green.
- `npm run test:demo1-security` — still green with the new suite.

**Manual, signed in as an approved recruiter**
1. `/hire` with an **empty** Shortlist → open the Shortlist panel. "Create
   assessment for Shortlisted" is visibly greyed and clicking does nothing.
   Confirm in devtools it is a `<button disabled>`, not an anchor.
2. Add one candidate → reopen the panel. The button is live with the same label.
   Click it → lands on `/hire/create-test`.
3. The page renders **without** the desk journey rail, shows "For 1 shortlisted
   candidate", and starts with exactly one Multiple Choice question.
4. Add an option, name it, mark it correct. Turn **Multiple correct** on, mark a
   second correct. Turn it back off → a toast explains only the first stayed
   correct.
5. Add a Paragraph question and a File Upload question. Set the file-upload link
   to a non-URL → the field shows an inline error and Save is refused.
6. Use **Move Up** / **Move Down** to put the file-upload question first. The
   preview reorders with it. Move Up on the first question is disabled.
7. Set duration to 30 and pass mark to 70. Switch to **Preview**: the candidate
   screen shows a "30 minutes" chip, disabled inputs, the paragraph textarea with
   a `0 / 250 words` counter, and the upload link as a real anchor.
8. Save draft → redirected to `/hire/assessments`. The row shows the title, 3
   questions, 30 min, 70%, DRAFT, and `—` under Students / Passed / Failed.
9. Reload `/hire/assessments` → the row is still there (a DB row, not local state).
10. **Isolation:** sign in as a second approved recruiter on the same email
    domain. `/hire/assessments` is empty. Opening the first recruiter's
    assessment id directly returns a 404, not a 403.
11. Sign out. `/hire/create-test` and `/hire/assessments` both redirect to
    `/talent/pending`.
12. `/hire`, `/hire/requests`, `/hire/matches` and `/hire/evidence` are visually
    unchanged — the chrome edit must not have altered which of them get desk mode.

**Files that should have changed** — exactly the list in §3, nothing else. In
particular `src/app/hire/page.tsx`, `src/features/hire/*` (other than the
isolation test) and every existing action file are untouched.

## 9. Deliberately out of scope (R9 part 2)
Publish, assign to shortlisted candidates, candidate notification, the attempt
route, timer enforcement, submission, auto-grading of MCQ / multi-select, manual
grading of paragraph and file-upload answers, `AssessmentReport` writes,
`SkillEvidence` emission, and the real Students / Passed / Failed counts on
`/hire/assessments`. `shortlistRefs` and the reserved `sectionId` column exist so
that ticket does not need a migration to start.

## 10. Commit message

```
feat(hire): recruiter assessment builder, preview and drafts list

Adds RecruiterAssessment / AssessmentQuestion / AssessmentQuestionOption,
workspace-scoped through requireRecruiterWorkspace (T-226). The Shortlist
panel gains a "Create assessment for Shortlisted" CTA, greyed while the
Shortlist is empty, opening /hire/create-test — a Forms-style builder for
multiple-choice (single or multi correct), paragraph and file-upload
questions with reorder, duration, pass mark and per-question points.
Preview mounts the real candidate screen, so the attempt ticket has one
surface rather than two. Saved assessments land as DRAFT and list at
/hire/assessments. No publish, assign, attempt or grading — R9 part 2.
```
