# 185 — Recruiter-owned assessment templates + assessment import from JSON

**Owner:** Shivansh (assessment builder). Contributor edits, approved for this
feature (2026-10-07): schema and admin surface (Sohail), recruiter account
deletion and `/hire` paths (Zainab, CODEOWNERS).
**Decisions (Shivansh, 2026-10-07):** recorded in §2a. Nothing below is assumed
beyond them, except the two readings flagged there.

## 1. Goal
Two capabilities on the existing builder, with no change to how ABTalks presets
or platform sends work:

- **A. Personal templates (recruiter only).** A recruiter saves the builder's
  content as a named template that only they can list, open, rename, update or
  delete, and reuses it from `/hire/create-test`.
- **B. Import from JSON (recruiter and admin).** A JSON file fills the builder.
  A downloadable, commented sample of the format sits beside the import control.

## 2. Current behavior
- `/hire/create-test` landing renders static ABTalks presets
  (`presets.ts`, code, not rows) above an embedded blank builder. Presets are
  multi-select; their questions are locked in Customize.
- `AssessmentBuilder` holds all state in the browser, seeded once from
  `existingDraft`. Nothing is written until Save draft or Publish, where the
  server re-validates with `assessmentDraftSchema`.
- The same builder serves admin on `/admin/assessments/new`, a platform draft's
  page, and `[assessmentId]/edit` (sent: wording-only once someone started).
- Recruiter assessments are scoped by `organizationId` + `createdByUserId`,
  both from `requireRecruiterWorkspace()`.
- There is no template storage and no import.

## 2a. Decisions
| # | Decision |
|---|---|
| 1 | New table `RecruiterAssessmentTemplate`; content stored as validated JSON. |
| 2 | Isolation key: `organizationId` + `createdByUserId`, as for assessments. |
| 3 | Created only by **Save as template** inside the builder. |
| 4 | Rename / re-describe in place; to change questions, open it in the builder and press **Update template**. |
| 5 | Template questions are editable. Used only through Customize, one at a time (no direct publish, no combining). |
| 6 | Own **My templates** section above "Start from a template". |
| 7 | Name required, description optional, no tags. Saves title, subheading, instructions, duration, pass mark, camera, questions. Never candidates or shortlist. Cap 50 per recruiter; duplicate names allowed. |
| 8 | Import format = draft content + `formatVersion: 1`. Unknown keys are rejected by name. |
| 9 | Importing into a builder that has content replaces everything, after a confirm. |
| 10 | Controls: recruiter landing beside "Start from blank ↓" (fills the builder below and scrolls to it); builder header on standalone and admin new/draft pages; hidden when customizing a locked ABTalks preset and on admin "edit sent". |
| 11 | No export. The download is a sample with comments and commented-out optional values. |
| 12 | 1 MB limit, 100 questions. The file is read in the browser and never stored. |
| 13 | Plan, then straight into implementation. |
| 14 | This change writes schema + migration SQL and runs `prisma generate` only. Shivansh applies the migration to a Neon child branch. |

Two readings, flagged to Shivansh before implementing:
- **Comments in the sample (11):** standard JSON has no comments, so the importer
  accepts `//` and `/* */` comments and trailing commas. Otherwise the sample
  could not be uploaded as downloaded.
- **Omitted optional fields (8):** take the builder's defaults, since a
  commented-out value is an omitted one.

One rule added to protect an existing one: **Save as template is hidden while
customizing a locked ABTalks preset.** Template questions are editable, so
saving there would turn locked ABTalks questions into editable ones — the thing
plan 130 hid Duplicate to prevent.

## 3. Files to touch
**Schema**
- `prisma/schema.prisma` `[edit]` — model `RecruiterAssessmentTemplate`;
  back-relations on `Organization` and `User`.
- `prisma/migrations/20261007150000_recruiter_assessment_templates/migration.sql`
  `[new]` — one table, one index, two FKs. Additive.

**Validation**
- `src/lib/validations/assessment.ts` `[edit]` — the draft's content fields are
  named once and reused by `assessmentDraftSchema` (unchanged behaviour, same
  key order) and a new strict `assessmentContentSchema`; template schemas;
  `MAX_TEMPLATES_PER_RECRUITER`.
- `src/lib/validations/assessment-import.ts` `[new]` — client-safe:
  `MAX_IMPORT_BYTES`, `assessmentImportSchema`, `parseAssessmentImport(text)`.
- `public/documents/assessment-import-format.json` `[new]` — the sample.

**Server**
- `src/features/recruiter-assessments/templates.ts` `[new]` — store-injected
  service: list, get, create, update content, rename, delete.
- `src/features/recruiter-assessments/template-prisma-store.ts` `[new]`.
- `src/app/actions/recruiter-assessment-template-actions.ts` `[new]` — four
  actions, each behind `requireRecruiterWorkspace()`.
- `src/features/hire/delete-recruiter-account.ts` `[edit]` — delete the
  workspace's templates with its assessments (the Organization row survives a
  deletion, so nothing cascades).

**UI**
- `src/app/hire/create-test/page.tsx` `[edit]` — load templates, `?template=`
  branch, pass `canSaveTemplate`.
- `src/components/hire/assessment/assessment-json-import.tsx` `[new]` — the two
  controls and the error dialog.
- `src/components/hire/assessment/create-test-landing.tsx` `[new]` — picker +
  embedded builder, so the control in the picker head can hand a file to the
  builder below it.
- `src/components/hire/assessment/my-templates.tsx` `[new]` — the section, with
  rename and delete dialogs.
- `src/components/hire/assessment/assessment-builder.tsx` `[edit]` — import
  (header control, confirm, imperative handle), Save as / Update template.
- `src/components/hire/assessment/preset-picker.tsx` `[edit]` — a `headActions`
  slot beside "Start from blank ↓".
- `src/app/hire/hire-scout.css` `[edit]` — `.hire-assess-*` rules only.

**Tests and housekeeping**
- `src/features/recruiter-assessments/templates.test.ts` `[new]`.
- `src/features/recruiter-assessments/recruiter-assessments.test.ts` `[edit]` —
  T4's pin follows the picker into the landing component.
- `package.json` `[edit]` — `test:assessment-templates`.
- `docs/CHANGELOG.md` `[edit]` — one line.

**Not touched:** every admin page and `admin-assessment-actions.ts` (the header
control appears through the shared builder; templates need an explicit prop
admin never passes), `platform-assessments/*`, `presets.ts`, `service.ts`,
`prisma-store.ts`, `recruiter-assessment-actions.ts`, the notification module,
`middleware.ts`, candidate-side files.

## 4. Server vs Client
| File | Boundary | Crosses the boundary |
|---|---|---|
| `create-test/page.tsx` | Server | Plain JSON only: template summaries (`id`, `name`, `description`, `questionCount`, `durationMinutes`), `template: { id, name }`, booleans. |
| `create-test-landing.tsx` | Client | Holds a ref to the builder; no server props beyond the page's. |
| `my-templates.tsx` | Client | Calls rename / delete actions. |
| `assessment-json-import.tsx` | Client | Reads the file with `File.text()`; no network. |
| `assessment-builder.tsx` | Client | New props are a boolean, a plain object and a ref. |
| `templates.ts`, `template-prisma-store.ts` | Server only | — |
| `assessment-import.ts` | Shared, no server imports | Zod + string handling only. |

No functions, icons or class instances cross Server → Client.

## 5. Steps
1. **Schema.** Add the model:
   `id`, `organizationId`, `createdByUserId`, `name`, `description?`,
   `content Json`, `questionCount Int`, `durationMinutes Int?`, timestamps;
   both FKs `onDelete: Cascade`; index
   `(organizationId, createdByUserId, updatedAt desc)`. `questionCount` and
   `durationMinutes` mirror `content` for the card and have one writer.
   Generate the SQL with `prisma migrate diff` between the old and new schema
   files (no database connection), then `prisma generate`.
2. **Validation.** In `assessment.ts`, leave `assessmentDraftSchema`'s fields
   exactly as they are and move only its correct-option check into a named
   function, `correctOptionIssues`. Add `ASSESSMENT_CONTENT_SHAPE`, built from
   `assessmentDraftSchema.shape.*` so a limit has one definition, then
   `assessmentContentSchema` (that shape, `.strict()`, same check),
   `createTemplateSchema`, `updateTemplateContentSchema`,
   `renameTemplateSchema`, `templateIdSchema`.
3. **Import parser.** `parseAssessmentImport(text)`: strip a BOM; remove
   comments and trailing commas with a string-aware scanner (a `//` inside a
   URL string is data); `JSON.parse`; validate with `assessmentImportSchema`
   (`formatVersion: 1` + content, strict). Returns
   `{ ok: true, data } | { ok: false, message, issues }`, where each issue is
   one line such as `Question 3, option 2, body: Give this option a name`.
   The builder's option schema is not strict, so on its own it would drop a
   misspelt option key (`isCorect`) silently. Option keys are therefore checked
   on the raw file here, rather than by making that shared schema strict.
4. **Sample.** Every field once; optional ones commented out with an example
   value; a header comment explaining use and limits.
5. **Service + store.** Every store call takes the scope and puts it in the
   WHERE; update, rename and delete are single guarded writes
   (`updateMany` / `deleteMany` → row count), never read-then-write. `get`
   re-validates stored content. `create` refuses at 50.
6. **Actions.** Gate → Zod → service → `revalidatePath("/hire/create-test")`;
   `logger` on failure; result envelope.
7. **Account deletion.** One `deleteMany` beside the assessment one.
8. **Import control.** Hidden file input, "Import from JSON" button,
   "Download JSON format" link; size check before reading; errors in a dialog.
9. **Builder.**
   - `importContent(content)`: applies at once into an untouched builder,
     otherwise opens a confirm. Exposed through `ref` for the landing.
   - Header control when not embedded, not preset-locked and not sent.
   - With `canSaveTemplate` and not preset-locked: **Save as template** (dialog:
     name, description). Opened from a template: **Update template** and
     **Save as new template**.
10. **Landing.** `MyAssessmentTemplates` above `CreateTestLanding`.
    `?template=<id>` opens the builder with that content, editable, with a back
    link; an unknown or foreign id falls through to a blank builder, as `?id=`
    does.
11. **CSS, tests, CHANGELOG.**

## 6. Guardrails for Cursor (DO NOT)
- DO NOT take `organizationId`, `createdByUserId` or any owner id from the
  client. The scope comes from `requireRecruiterWorkspace()` only.
- DO NOT add a template query without the scope in its WHERE; no `findUnique`
  by id alone.
- DO NOT give admin any template surface: no admin action, no `canSaveTemplate`
  on an admin page, no template listing in an admin console.
- DO NOT change `presets.ts`, the preset publish action or the locked-question
  behaviour. DO NOT offer Save as template while preset-locked.
- DO NOT let import write anything. It fills builder state; Save draft and
  Publish stay the only writers, with their existing server validation.
- DO NOT loosen the per-question `.strict()` schemas for import.
- DO NOT show import on a sent platform assessment or a locked preset.
- DO NOT change what `assessmentDraftSchema` accepts, its messages or its key
  order.
- DO NOT touch the notification module or `middleware.ts`.
- DO NOT run `prisma migrate dev`, `migrate deploy` or `db push`. Generate SQL
  from schema files only.
- Explicit `select`, no `any`, no `console.*`, `buttonVariants` on `<Link>`.
- No em dashes in user-facing copy.

## 7. DB safety
Additive: one new table. No existing row or column changes.
1. Commit checkpoint; note the hash.
2. Shivansh creates a Neon child branch from production and applies
   `prisma migrate deploy` against that child's connection string only.
3. Rollback: `DROP TABLE "RecruiterAssessmentTemplate";` or discard the branch.
4. **Order:** the migration must be applied to an environment before this code
   is deployed there. `/hire/create-test` reads the table on load and fails
   loudly if it is missing, by the repo's own convention for schema drift.

This change itself performs no database write and opens no database connection.

## 8. Verification
- `npm run test:assessment-templates` (new): parser (comments, trailing commas,
  BOM, `//` inside strings, unknown key named, bad version, 101 questions,
  defaults), the shipped sample as-is and with every commented value enabled,
  template service (CRUD, another workspace gets NOT_FOUND everywhere and an
  empty list, cap, stored content re-validated), and source pins (every action
  gated, every store query scoped, no admin file mentions templates).
- Regression: `test:recruiter-assessments`, `test:assessment-presets`,
  `test:platform-assessments`, `test:assessment-attempts`,
  `test:recruiter-delete` (this one parses the schema and requires the new
  model to be purged).
- `npx tsc --noEmit`; `eslint` on touched files.
- Manual, after the migration is on a child branch:
  1. Recruiter A: build an assessment, **Save as template**; it appears under
     My templates. Rename it. Customize it: questions are editable; change one
     and **Update template**; reopen and see the change.
  2. Recruiter B: My templates is empty; `/hire/create-test?template=<A's id>`
     shows a blank builder.
  3. ABTalks presets: select, Publish, Customize and locked questions behave as
     before; no Save as template and no import while customizing one.
  4. Download the sample, import it unchanged: the builder fills with four
     questions. Type something, import again: confirm, then replace.
  5. Break the sample (misspell `isCorrect`): the dialog names the key and the
     question. Nothing in the builder changes.
  6. Admin `/admin/assessments/new`: import and download are present, no
     template controls. `[id]/edit` on a sent assessment: neither.
- `git diff --stat` matches §3.

## 9. Commit message
```
feat(hire): personal assessment templates and import from JSON

Recruiters can save the builder's content as a template only they can see,
then reuse it from a "My templates" section on /hire/create-test: customize
(questions stay editable), update, rename or delete. Templates live in a new
RecruiterAssessmentTemplate table scoped by organizationId + createdByUserId;
every query carries that scope and the owner never comes from the client.

Recruiters and admins can also fill the builder from a JSON file. The file is
read in the browser and never stored; the format is the draft content plus
formatVersion, unknown keys are rejected by name, and a commented sample is
downloadable beside the control. Admin gets import only.

ABTalks presets, their locked questions and platform sends are unchanged.
```
