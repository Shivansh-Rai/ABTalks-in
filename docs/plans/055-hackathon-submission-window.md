# 055 — Hackathon Submission Window (`/hackathon/submission`)

## 1. Goal

Give registered hackathon teams a place to read the three briefs and file their
entry: a new `/hackathon/submission` page that unlocks at kickoff (Fri 7 Aug ·
8:00 PM IST), greets them by team name, lists the three briefs as collapsible
cards, and takes one editable submission per team (chosen brief + public GitHub
repo, live URL, AI-usage log URL) that they can re-save as often as they like
until the deadline. The dashboard's problem-statement card gains the
**"Unlock Problem Statement"** CTA that routes here once the clock passes kickoff.

---

## 2. Current behavior

- `/hackathon/dashboard` ([page.tsx](src/app/hackathon/dashboard/page.tsx)) is a
  Server Component: `auth()` → `getMyRegistration(session.user.id)` → renders
  `MissionTimer`, `ProblemStatementPanel`, `TeamRoster`, `InvitePanel`,
  `SubmissionChecklist`, `EventInfo`.
- [problem-statement-panel.tsx](src/components/hackathon/dashboard/problem-statement-panel.tsx)
  computes `unlocked` itself from `Date.now() >= kickoffUtc` and, when unlocked,
  renders the free-text `HackathonEvent.problemStatement` (or a "dropping shortly"
  fallback). **There is no path forward from it today.**
- [submission-checklist.tsx](src/components/hackathon/dashboard/submission-checklist.tsx)
  is read-only and its footnote still says "Submission opens near the deadline" —
  stale once this ships.
- Hackathon data is **fully on Neon/Prisma** (plans `045`/`046` did the cutover) —
  `HackathonTeam`, `HackathonParticipant`, `HackathonRemoval`, `HackathonEvent`,
  `HackathonLink` in [schema.prisma](prisma/schema.prisma:860). There is **no**
  submission table yet. Nothing hackathon-related reads Supabase any more.
- `getMyRegistration(userId)`
  ([get-my-registration.ts](src/features/hackathon/get-my-registration.ts)) already
  returns `{ team: { id, code, name, entryType }, me: { fullName, isLeader }, members, spotsLeft }`.
  Reuse it as-is; **do not** write a second lookup.
- `/hackathon/*` has its own dark layout ([layout.tsx](src/app/hackathon/layout.tsx)):
  `bg-black text-white`, DSEG7 + IBM Plex Mono, `HackathonHeader` on top. A new page
  under that segment inherits all of it for free.
- `middleware.ts` `protectedPaths` already lists `/hackathon/register` and
  `/hackathon/dashboard`.
- Feature flags live in [feature-flags.ts](src/lib/feature-flags.ts)
  (`ENABLE_PROGRAM`, `BYPASS_DAY_LOCKS`, …) — server-side reads, booleans passed
  to clients as props.
- There is **no `.env.example`** in the repo; env vars are added to `.env.local`
  by hand.

### Layout gotcha (same as plan 042 — do not re-litigate)

`main-shell.tsx` strips bottom padding on `/hackathon/*`, but `BottomNavGate` still
renders the app's fixed mobile bottom nav for logged-in users. The submission page's
own container must carry **`pb-28 md:pb-10`**. Do not edit `main-shell.tsx` or the
bottom-nav files.

---

## 3. Decisions locked before implementation

Confirmed with the product owner — these are settled, do not re-open:

| Question | Decision |
|---|---|
| Route | `/hackathon/submission` (inside the hackathon segment, not top-level `/submission`) |
| Who owns a submission | **The team.** One row per team; any member can view and edit it |
| "Option to upload" | **Three URL text fields only.** No file upload, no Vercel Blob |
| How many briefs per team | **Exactly one.** A team's entry targets one brief; picking a different brief and saving *moves* the entry — it does not create a second one |

Decisions taken as part of this plan (flagged, not asked):

- **Required to save:** `githubUrl` only. `liveUrl` and `aiLogUrl` may be left blank
  and filled in later — that is the whole point of "edit as often as you like".
  A submission missing either shows an **Incomplete** badge until all three exist.
- **Edit window:** editable from kickoff until `HACKATHON.deadlineUtc`. After the
  deadline the page renders the saved entry read-only. No late edits, no grace period.
- **No network liveness check** on any URL (unlike the 60-day challenge's HEAD probe).
  Teams re-save constantly during a hackathon and judges open the links by hand.
- **No global uniqueness** on `githubUrl` (the 60-day challenge rule does not apply
  here — it would false-block a team that recreates its repo).
- **No edit history.** New saves overwrite the row, exactly as specified.
- `HACKATHON_PREVIEW=true` bypasses **only the kickoff lock**, never the deadline
  lock. To exercise the closed state, temporarily edit the config dates (as plan 042's
  test script does) and revert.

### Copy that still needs the organizer (does not block the build)

- **Brief 2 title** goes into config verbatim as given:
  `"AI Interview Agent - 02 · The Interview Agent"`. If that was meant to be a title
  plus a separate kicker, fix the config string later — no code change needed.
- **Brief 3 has no one-line tagline** yet. Config ships `tagline: ""` and the card
  renders no tagline line when the string is empty.
- **All three brief bodies are empty** for now (`body: []`) and render the placeholder
  "Full brief drops here shortly — watch the WhatsApp group." Filling them in is a
  config edit + redeploy.

---

## 4. Files to touch

### New

| Path | New/Edit | Server/Client | Note |
|---|---|---|---|
| `src/app/hackathon/submission/page.tsx` | `[new]` | **Server** | Auth + registration gate, window gate, composes the page. |
| `src/components/hackathon/submission/locked-state.tsx` | `[new]` | Server (presentational) | Pre-kickoff panel + link back to the dashboard. |
| `src/components/hackathon/submission/brief-list.tsx` | `[new]` | Server (presentational) | "Choose your Brief" + 3 native `<details>` cards. |
| `src/components/hackathon/submission/submission-form.tsx` | `[new]` | **Client** | Brief selector (3 buttons) + 3 URL inputs + save. |
| `src/features/hackathon/submission-window.ts` | `[new]` | server-only | Single source of truth for unlocked / closed / editable. |
| `src/features/hackathon/get-team-submission.ts` | `[new]` | server-only | Reads the team's row, returns serializable data. |
| `src/app/actions/hackathon-submission-actions.ts` | `[new]` | Server Action | `saveHackathonSubmissionAction`. |
| `prisma/migrations/<generated>/migration.sql` | `[new]` | — | Produced by `prisma migrate dev`, never hand-written. |

### Edit

| Path | New/Edit | Note |
|---|---|---|
| `prisma/schema.prisma` | `[edit]` | New `HackathonBriefKey` enum + `HackathonSubmission` model + one back-relation line on `HackathonTeam`. |
| `src/components/hackathon/hackathon-config.ts` | `[edit]` | Add `briefs` array + `briefsHeading`. |
| `src/lib/validations/hackathon.ts` | `[edit]` | Add brief-key + submission schemas. |
| `src/lib/feature-flags.ts` | `[edit]` | Add `isHackathonPreviewEnabled()`. |
| `middleware.ts` | `[edit]` | One string in `protectedPaths`. |
| `src/app/hackathon/dashboard/page.tsx` | `[edit]` | Compute the window once, pass `unlocked`/`closed` down. |
| `src/components/hackathon/dashboard/problem-statement-panel.tsx` | `[edit]` | Take `unlocked`/`closed` as props; add the CTA. |
| `src/components/hackathon/dashboard/submission-checklist.tsx` | `[edit]` | Take `submissionOpen`; swap the stale footnote for a link. |
| `.env.local` (local only, not committed) | `[edit]` | `HACKATHON_PREVIEW="true"`. |

**Not touched:** `main-shell.tsx`, `bottom-nav*.tsx`, `src/components/ui/**`,
`src/lib/hackathon-supabase.ts`, `workshop-*`, any other feature's schema or actions.

---

## 5. Server vs Client

- `page.tsx`, `locked-state.tsx`, `brief-list.tsx` are **Server Components**. They
  pass only plain serializable data down — strings, numbers, booleans, arrays of
  string-keyed objects. No functions, no Lucide components, no `Date` instances, no
  class instances cross the boundary.
- **One** `"use client"` file: `submission-form.tsx` (needs `useState`,
  `useTransition`, `useRouter`, `toast`, `Dialog`).
- Props into the client form (all serializable):
  ```ts
  <SubmissionForm
    initial={ { brief: "BRIEF_1" | "BRIEF_2" | "BRIEF_3";
                githubUrl: string; liveUrl: string; aiLogUrl: string;
                updatedAtIso: string; updatedByName: string } | null }
    editable={boolean}
    closed={boolean}
  />
  ```
  `updatedAt` crosses as an **ISO string**, not a `Date`.
- `submission-form.tsx` **may** import `HACKATHON` from `hackathon-config.ts`
  (plain object, no `server-only`, already imported by `mission-timer.tsx`) and the
  Zod schemas from `lib/validations/hackathon.ts`. It must **never** import anything
  from `src/features/hackathon/*` or `@/lib/db`.
- `MissionTimer` is reused unchanged on the submission page (it is already a client
  component taking three string props).

---

## 6. Steps

### Step 1 — `prisma/schema.prisma` `[edit]`

Append near the other hackathon models (after `HackathonEvent`, before
`HackathonLink` — placement is cosmetic, keep them grouped):

```prisma
enum HackathonBriefKey {
  BRIEF_1
  BRIEF_2
  BRIEF_3
}

/// One entry per team. A team answers exactly ONE brief — re-saving with a
/// different `brief` moves the entry rather than creating a second one. Edits
/// overwrite in place (no history by design); `updatedBy*` records who saved last.
model HackathonSubmission {
  id              String            @id @default(cuid())
  teamId          String            @unique
  brief           HackathonBriefKey
  githubUrl       String
  liveUrl         String?
  aiLogUrl        String?
  /// Snapshot, not a relation — mirrors HackathonRemoval.removedByUserId.
  updatedByUserId String
  updatedByName   String
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  team HackathonTeam @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@index([updatedAt(sort: Desc)])
}
```

And add exactly one line to the existing `HackathonTeam` model
([schema.prisma:860](prisma/schema.prisma:860)) — Prisma requires the back-relation:

```prisma
  submission   HackathonSubmission?
```

No other existing model changes. `updatedByUserId` is a **plain scalar with no
`User` relation**, deliberately — same pattern as `HackathonRemoval.removedByUserId`
— so the `User` model is not touched.

### Step 2 — migration (see §7 for the safety ritual first)

```bash
npx prisma migrate dev --name hackathon_submission
```

Read the generated SQL before it is committed. It must contain only
`CREATE TYPE`, `CREATE TABLE`, `CREATE UNIQUE INDEX`, `CREATE INDEX`, and one
`ALTER TABLE "HackathonSubmission" ADD CONSTRAINT … FOREIGN KEY`. If it contains a
`DROP`, or any `ALTER` against a pre-existing table, **stop and report** — that means
schema drift, not this change.

### Step 3 — `src/components/hackathon/hackathon-config.ts` `[edit]`

Add inside the `HACKATHON` object (keep everything else untouched):

```ts
  briefsHeading: "Choose your Brief",

  // TODO(organizer): fill `body` for each brief; add Brief 3's tagline.
  briefs: [
    {
      key: "BRIEF_1",
      number: 1,
      title: "Redesign ABTalks",
      tagline: "Reimagine the platform you're standing on.",
      body: [] as string[],
    },
    {
      key: "BRIEF_2",
      number: 2,
      title: "AI Interview Agent - 02 · The Interview Agent",
      tagline:
        "Build an agent that runs a real technical interview and gives feedback worth acting on.",
      body: [] as string[],
    },
    {
      key: "BRIEF_3",
      number: 3,
      title: "Autonomous AI Creator",
      tagline: "",
      body: [] as string[],
    },
  ],
```

`key` values must match the Prisma enum exactly. Every string the submission page
renders — headings, brief copy, dates, placeholders that reference deliverables —
comes from here.

### Step 4 — `src/lib/feature-flags.ts` `[edit]`

```ts
/**
 * Local preview of the hackathon submission window before kickoff.
 * `HACKATHON_PREVIEW=true` in .env.local unlocks /hackathon/submission early for
 * the developer only. It does NOT bypass the submission deadline, and it must
 * never be set in the Vercel project env.
 */
export function isHackathonPreviewEnabled(): boolean {
  return process.env.HACKATHON_PREVIEW === "true";
}
```

Add `HACKATHON_PREVIEW="true"` to `.env.local` by hand (there is no `.env.example`
to update, and `.env.local` is not committed).

### Step 5 — `src/features/hackathon/submission-window.ts` `[new]`

```ts
import "server-only";
import { HACKATHON } from "@/components/hackathon/hackathon-config";
import { isHackathonPreviewEnabled } from "@/lib/feature-flags";

export type SubmissionWindow = {
  unlocked: boolean;   // briefs + form visible
  closed: boolean;     // past deadline — read-only
  editable: boolean;   // unlocked && !closed
  previewing: boolean; // unlocked only because of the env flag
};

export function getSubmissionWindow(now: number = Date.now()): SubmissionWindow
```

- `kickoff = new Date(HACKATHON.kickoffUtc).getTime()`,
  `deadline = new Date(HACKATHON.deadlineUtc).getTime()`.
- `preview = isHackathonPreviewEnabled()`.
- `unlocked = now >= kickoff || preview`
- `closed = now >= deadline` — **preview never affects this**.
- `editable = unlocked && !closed`
- `previewing = preview && now < kickoff`

This is the **only** place the window is computed. The page, the dashboard, and the
Server Action all call it — no duplicated `Date.now() >= kickoff` comparisons anywhere.

### Step 6 — `src/features/hackathon/get-team-submission.ts` `[new]`

```ts
import "server-only";
import { prisma } from "@/lib/db";

export type TeamSubmission = {
  brief: "BRIEF_1" | "BRIEF_2" | "BRIEF_3";
  githubUrl: string;
  liveUrl: string;
  aiLogUrl: string;
  updatedAtIso: string;
  updatedByName: string;
};

export async function getTeamSubmission(
  teamId: string,
): Promise<TeamSubmission | null>
```

`prisma.hackathonSubmission.findUnique({ where: { teamId }, select: { brief: true,
githubUrl: true, liveUrl: true, aiLogUrl: true, updatedAt: true, updatedByName: true } })`.
Return `null` when absent. Normalize `liveUrl`/`aiLogUrl` nulls to `""` and
`updatedAt` to `.toISOString()` so the value is client-safe. `select` is mandatory
(house rule) — no full-record return.

### Step 7 — `src/lib/validations/hackathon.ts` `[edit]`

Append (keep the existing exports untouched):

```ts
const hackathonRepoRegex =
  /^https:\/\/github\.com\/([a-zA-Z0-9-]{1,39})\/([a-zA-Z0-9._-]{1,100})\/?$/;

export const hackathonBriefKeySchema = z.enum([
  "BRIEF_1",
  "BRIEF_2",
  "BRIEF_3",
]);

export const hackathonSubmissionSchema = z.object({
  brief: hackathonBriefKeySchema,
  githubUrl: z
    .string()
    .trim()
    .max(500)
    .regex(
      hackathonRepoRegex,
      "Enter a public repo URL like https://github.com/you/project",
    ),
  liveUrl: z
    .union([z.literal(""), z.string().trim().url("Enter a valid URL").max(500)])
    .default(""),
  aiLogUrl: z
    .union([z.literal(""), z.string().trim().url("Enter a valid URL").max(500)])
    .default(""),
});

export type HackathonSubmissionInput = z.infer<typeof hackathonSubmissionSchema>;
```

The regex is a local copy of the one in
[program.ts:6](src/lib/validations/program.ts:6) (which is module-private); do not
export it from `program.ts` or create a shared URL-validation file. The optional-URL
shape mirrors [program.ts:36](src/lib/validations/program.ts:36).

### Step 8 — `src/app/actions/hackathon-submission-actions.ts` `[new]`

`"use server";` — one export, `saveHackathonSubmissionAction(input: HackathonSubmissionInput)`,
returning the house envelope `{ ok: true, data } | { ok: false, message }`.

Order of operations (each guard returns before the next):

1. `const session = await auth();` — no `session?.user?.id` →
   `{ ok: false, message: "Not authenticated" }`.
2. `hackathonSubmissionSchema.safeParse(input)` → on failure return
   `parsed.error.issues[0]?.message ?? "Invalid input"` (same shape as
   [hackathon-team-actions.ts:30](src/app/actions/hackathon-team-actions.ts:30)).
3. `const window = getSubmissionWindow();`
   - `!window.unlocked` → `{ ok: false, message: \`Submissions open at kickoff — ${HACKATHON.kickoffLabel}.\` }`
   - `window.closed` → `{ ok: false, message: \`Submissions closed on ${HACKATHON.deadlineLabel}.\` }`
   **This server-side check is the real gate.** The page's rendering state is only UX.
4. Look up the caller: `prisma.hackathonParticipant.findUnique({ where: { userId:
   session.user.id }, select: { teamId: true, fullName: true } })`. Missing →
   `{ ok: false, message: "You're not registered for the hackathon." }`.
5. `prisma.hackathonSubmission.upsert({ where: { teamId }, create: {...}, update: {...} })`
   — single statement, so **no transaction needed**. Write `brief`, `githubUrl`,
   `liveUrl: liveUrl || null`, `aiLogUrl: aiLogUrl || null`,
   `updatedByUserId: session.user.id`, `updatedByName: participant.fullName`.
   `update` sets the same fields (this is the "new edits override" behavior).
6. `revalidatePath("/hackathon/submission")` and `revalidatePath("/hackathon/dashboard")`.
7. Return `{ ok: true, data: { brief, updatedAtIso: saved.updatedAt.toISOString() } }`.

Wrap the upsert in `try/catch`; on error `logger.error("hackathon submission save failed", { error })`
and return `{ ok: false, message: "Couldn't save your submission. Try again." }`.
Never `console.*`.

**The team is resolved from the session, never from client input.** The action takes
no `teamId`, no `participantId`, no email.

### Step 9 — `src/app/hackathon/submission/page.tsx` `[new]` (Server)

```tsx
export const metadata: Metadata = {
  title: "Submit your build | ABTalks Vibe Code Hackathon",
};
```

1. `const session = await auth();` → no `session?.user?.id` →
   `redirect("/login?from=/hackathon/submission")`.
2. `const reg = await getMyRegistration(session.user.id);` → `null` →
   `redirect("/hackathon/register")`.
3. `const window = getSubmissionWindow();`
4. Container on every branch:
   `<div className="mx-auto w-full max-w-3xl px-4 py-10 pb-28 md:pb-10">`
   (`pb-28` clears the fixed mobile bottom nav — see §2).
5. **If `!window.unlocked`:** render `<LockedState />` inside the container and return.
   Do **not** query the submission table, and do **not** redirect — a locked page that
   explains itself beats a bounce.
6. Otherwise `const submission = await getTeamSubmission(reg.team.id);`
7. Greeting header:
   - `const greetingName = reg.team.entryType === "TEAM" ? (reg.team.name ?? reg.me.fullName) : reg.me.fullName;`
   - `<h1>Hello {greetingName}</h1>` + the same entry chip markup the dashboard uses
     (`SOLO` / team name pill), plus, when `window.previewing`, a small amber
     `PREVIEW` chip reading "Preview mode — locked for everyone else."
8. Body, top to bottom:
   - `<MissionTimer kickoffUtc={HACKATHON.kickoffUtc} deadlineUtc={HACKATHON.deadlineUtc} resultsLabel={HACKATHON.resultsLabel} />`
   - `<BriefList savedBrief={submission?.brief ?? null} />`
   - `<SubmissionForm initial={submission} editable={window.editable} closed={window.closed} />`
   - A back link to `/hackathon/dashboard` styled with
     `buttonVariants({ variant: "outline" })`.

### Step 10 — `src/components/hackathon/submission/locked-state.tsx` `[new]` (Server)

No props. Card in the established hackathon style
(`rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6`, heading
`text-sm font-semibold uppercase tracking-[0.16em] text-[#A78BFA]`):

- Lucide `Lock` icon + heading "Submission window".
- `Briefs unlock at kickoff: {HACKATHON.kickoffLabel}` and
  `Submissions close: {HACKATHON.deadlineLabel}`.
- A `buttonVariants({ variant: "outline" })` `<Link href="/hackathon/dashboard">`
  reading "Back to your dashboard".

### Step 11 — `src/components/hackathon/submission/brief-list.tsx` `[new]` (Server)

Props: `{ savedBrief: "BRIEF_1" | "BRIEF_2" | "BRIEF_3" | null }`.

- Section heading: `{HACKATHON.briefsHeading}` in the standard
  `text-sm font-semibold uppercase tracking-[0.16em] text-[#A78BFA]` style, with a
  muted subline: "Read all three. You submit to one."
- Map `HACKATHON.briefs` to **native `<details>` elements** — collapsible with zero
  JavaScript, so this stays a Server Component. Do **not** add an accordion primitive
  to `src/components/ui/` and do **not** make this a client component.

  Per card:
  ```tsx
  <details
    key={brief.key}
    className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors open:border-[#7364E6]/40 open:bg-[#7364E6]/[0.06] sm:p-6"
  >
    <summary className="flex cursor-pointer list-none items-start gap-4 [&::-webkit-details-marker]:hidden">
      {/* number badge: size-8 rounded-lg border border-[#7364E6]/40 bg-[#7364E6]/15
          grid place-items-center font-mono text-sm font-bold text-[#C4B5FD] */}
      {/* title (text-base font-semibold text-white) + tagline (mt-1 text-sm text-zinc-400,
          rendered only when brief.tagline !== "") */}
      {/* ChevronDown, ml-auto shrink-0 text-zinc-500 transition-transform group-open:rotate-180 */}
    </summary>
    {/* body */}
  </details>
  ```
- Body: when `brief.body.length > 0`, one `<p className="text-sm leading-relaxed
  text-zinc-300">` per paragraph; otherwise the single muted line
  "Full brief drops here shortly — watch the WhatsApp group."
- When `savedBrief === brief.key`, render a small emerald pill in the summary row
  reading **"Your entry"**. That is the only coupling between the list and the form,
  and it is server-rendered — the form calls `router.refresh()` after a successful
  save so the pill moves.
- The number badge and title must stay readable at 390px: `min-w-0` on the text
  column, no `whitespace-nowrap` on the title.

### Step 12 — `src/components/hackathon/submission/submission-form.tsx` `[new]` (Client)

`"use client"`. Props per §5.

**Read-only branch first:** if `!editable`, render a card headed "Your submission"
with the saved values as static labelled rows (each URL an
`<a target="_blank" rel="noopener noreferrer">`), a muted line
`Submissions closed · {HACKATHON.deadlineLabel}`, and — when `initial === null` —
"No submission was recorded for your team." Render **no inputs and no save button**
in this branch.

**Editable branch:**

- State: `selectedBrief` (init `initial?.brief ?? "BRIEF_1"`), and the three field
  values (init from `initial` or `""`). `useTransition` for pending. `useRouter` for
  `router.refresh()`. `toast` from `sonner`.
- Section heading "Submission" + subline
  "Edit as often as you like until the deadline. Each save replaces the last one."
- **Brief selector — three horizontal buttons**, the shape asked for:
  ```tsx
  <div className="grid grid-cols-3 gap-2">
    {HACKATHON.briefs.map((b) => (
      <button type="button" key={b.key} onClick={() => setSelectedBrief(b.key)}
        aria-pressed={selectedBrief === b.key}
        className={cn(
          "rounded-xl border px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide transition-colors sm:text-sm",
          selectedBrief === b.key
            ? "border-[#7364E6] bg-[#7364E6]/20 text-white"
            : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/25 hover:text-white",
        )}>
        BRIEF {b.number}
      </button>
    ))}
  </div>
  ```
  Three columns at every breakpoint (they read fine at 390px with `text-xs`).
- Under the selector, the selected brief's `title` in muted text so the choice is
  unambiguous.
- **Switch warning.** When `initial !== null && selectedBrief !== initial.brief`,
  render an amber notice above the fields:
  "Your saved entry is for **Brief {n}**. Saving now moves it to **Brief {m}** — you
  can only enter one brief."
- Three fields, using the existing `Input` primitive with `Label`, `type="url"`,
  `inputMode="url"`, `spellCheck={false}`:

  | Label | Placeholder | Required |
  |---|---|---|
  | Public GitHub repo link | `https://github.com/your-username/your-project` | yes |
  | Live URL | `https://your-project.vercel.app` | no |
  | AI-usage log URL | `https://github.com/your-username/your-project/blob/main/PROMPTS.md` | no |

  Each with a one-line muted helper taken from the matching
  `HACKATHON.deliverables[i].body` — do not retype that copy.
- Validate on submit with `hackathonSubmissionSchema.safeParse({...})`; show the first
  issue's message inline under the offending field (and `toast.error` it). Client
  validation is convenience only — the action re-validates.
- **Save button** (`Button`, full width on mobile): label `Save submission`, or
  `Saving…` with `<Loader2 className="size-4 animate-spin" />` while pending — same
  pattern as [registration-form.tsx:486](src/components/hackathon/registration-form.tsx:486).
- **Confirm dialog only when the brief is being moved** (`initial !== null &&
  selectedBrief !== initial.brief`): reuse the Base UI `Dialog` pattern from
  [remove-member-button.tsx](src/components/hackathon/dashboard/remove-member-button.tsx)
  — `DialogTrigger render={<Button …/>}`, title "Move your entry to Brief {m}?",
  description naming what is replaced, confirm button "Move and save". In every other
  case the save button submits directly with no dialog.
- On `{ ok: true }`: `toast.success("Submission saved")` and `router.refresh()`.
  On `{ ok: false }`: `toast.error(result.message)` and leave the fields as typed —
  never clear the form on failure.
- Below the button, when `initial !== null`:
  `Last saved by {initial.updatedByName}` + the local-time render of
  `initial.updatedAtIso`. Render the timestamp only after a `mounted` flag flips in
  `useEffect` (same hydration guard as
  [mission-timer.tsx:27](src/components/hackathon/dashboard/mission-timer.tsx:27)) —
  server and client time zones differ and would otherwise mismatch on hydration.
- **Incomplete badge:** when `initial !== null` and either optional URL is empty, an
  amber pill in the section header: "Incomplete — add your live URL and AI-usage log
  before the deadline."

### Step 13 — `middleware.ts` `[edit]`

Add `"/hackathon/submission"` to `protectedPaths`, directly after
`"/hackathon/dashboard"`. That is the **entire** edit — no `@/lib/*` import may enter
this file (Edge bundle limit).

### Step 14 — `src/app/hackathon/dashboard/page.tsx` `[edit]`

- `import { getSubmissionWindow } from "@/features/hackathon/submission-window";`
- `const submissionWindow = getSubmissionWindow();`
- `<ProblemStatementPanel unlocked={submissionWindow.unlocked} closed={submissionWindow.closed} statement={problemStatement} />`
  — the `kickoffUtc` prop goes away.
- `<SubmissionChecklist submissionOpen={submissionWindow.unlocked} />`
- Nothing else on this page changes.

### Step 15 — `problem-statement-panel.tsx` `[edit]`

- New props: `{ unlocked: boolean; closed: boolean; statement: string | null }`.
  **Delete** the internal `Date.now() >= new Date(kickoffUtc).getTime()` computation —
  the window helper is now the single source of truth (this is what makes
  `HACKATHON_PREVIEW` reach the dashboard too).
- Locked branch: unchanged markup.
- Unlocked branch: keep rendering `statement` when present (and the existing
  "dropping shortly" fallback when null), then append the CTA:
  ```tsx
  <Link
    href="/hackathon/submission"
    className={cn(buttonVariants({ size: "lg" }), "mt-6 w-full sm:w-auto")}
  >
    {closed ? "View your submission" : "Unlock Problem Statement"}
  </Link>
  ```
  `buttonVariants` on the `<Link>` — never `<Button asChild>` / `<Button render>`.
- When unlocked and not closed, add a muted line under the CTA:
  "3 briefs are live. Pick one and submit before {HACKATHON.deadlineLabel}."

### Step 16 — `submission-checklist.tsx` `[edit]`

- New prop `{ submissionOpen: boolean }`.
- Replace the stale footnote: when `submissionOpen` is false keep the current text;
  when true render
  `<Link href="/hackathon/submission" className="text-[#A78BFA] underline-offset-2 hover:underline">Submit these on the submission page →</Link>`.
- The checklist stays read-only and stays a Server Component.

---

## 7. DB safety

This is the one schema-touching step, and **dev and prod share a single Neon
database** — treat it as a production migration.

1. `git add -A && git commit -m "checkpoint before hackathon submission window"` —
   record the commit hash in the PR description.
2. Create a **Neon branch** from `main` as a snapshot before running anything.
3. Run `npx prisma migrate dev --name hackathon_submission`.
   - If Prisma reports **drift** or offers to **reset the database**, answer no,
     abort, and report. Never let it reset a shared database.
4. Open the generated `prisma/migrations/<ts>_hackathon_submission/migration.sql` and
   confirm it is purely additive: `CREATE TYPE "HackathonBriefKey"`,
   `CREATE TABLE "HackathonSubmission"`, the unique index on `teamId`, the
   `updatedAt` index, and one `ADD CONSTRAINT … FOREIGN KEY … REFERENCES
   "HackathonTeam"("id") ON DELETE CASCADE`. Any `DROP`, or any `ALTER TABLE` naming
   a different table, means stop.
5. `npx prisma generate` (the `postinstall` hook does this too, but run it explicitly
   so the client types exist before the build).
6. Commit the migration folder together with the schema change — `npm run build`
   runs `prisma migrate deploy`, so Vercel applies it on the next deploy.

No seed, no backfill, no cleanup-script change. Existing hackathon rows are untouched.

---

## 8. Verification

**Build / typecheck — must pass clean:**

```bash
npx tsc --noEmit
```

```bash
npm run build
```

The build output must list `/hackathon/submission` as a route.

**Greps (eyeball each):**

```bash
grep -rn "hackathon/submission" middleware.ts src/app src/components
```

```bash
grep -rn "use client" src/components/hackathon/submission/
```
→ exactly one hit, `submission-form.tsx`.

```bash
grep -rn "features/hackathon\|lib/db" src/components/hackathon/submission/
```
→ zero hits (no client or presentational component reaches the DB layer).

**Manual test script:**

1. Signed out → `/hackathon/submission` redirects to `/login?from=/hackathon/submission`.
2. Signed in but not registered → redirects to `/hackathon/register`.
3. `HACKATHON_PREVIEW` unset, before kickoff, registered → the page renders the
   **locked** panel (not a redirect), and the dashboard's problem-statement card is
   still locked with **no** CTA.
4. Set `HACKATHON_PREVIEW="true"` in `.env.local`, restart `npm run dev`:
   - Dashboard now shows "Unlock Problem Statement" → clicking it lands on
     `/hackathon/submission`.
   - The submission page greets `Hello <Team Name>` for a team account and
     `Hello <Full Name>` for a solo account, and shows the amber `PREVIEW` chip.
5. Open each of the three briefs — they expand and collapse independently, Brief 3
   shows no tagline line, all three show the "Full brief drops here shortly"
   placeholder.
6. Save with only a bad GitHub URL (`github.com/foo`) → inline error, nothing written.
7. Save `https://github.com/you/project` with both optional fields blank → success
   toast; reload → values persist, "Incomplete" pill shows, "Your entry" pill appears
   on Brief 1, "Last saved by <name>" line renders.
8. Fill the other two URLs and save again → the same row updates (check in Prisma
   Studio / Neon: **one** `HackathonSubmission` row for the team, `updatedAt` moved,
   old values gone).
9. Sign in as a **teammate** of the same team → they see the same saved submission and
   can edit it; saving flips `updatedByName` to their name.
10. Select **Brief 2** while Brief 1 is saved → amber switch warning appears; click
    Save → confirm dialog; confirm → still exactly **one** row, now `brief = BRIEF_2`,
    and the "Your entry" pill moves to Brief 2 after the refresh.
11. **Deadline behavior:** temporarily set `HACKATHON.deadlineUtc` a minute ahead.
    After it passes: the page renders the read-only branch (no inputs, no save
    button), the dashboard CTA reads "View your submission", and calling the action
    (e.g. via a stale open tab clicking Save) returns the "Submissions closed" message
    with no DB write. **Revert the config date afterward.**
12. Remove `HACKATHON_PREVIEW` from `.env.local`, restart → back to the locked state.
    Confirm the var is **not** set in the Vercel project env.
13. Mobile at 390px: no horizontal scroll; the three BRIEF buttons fit on one row; the
    fixed bottom nav does not cover the last card (the `pb-28` works).

**Exactly these files should show as changed:**

```
prisma/schema.prisma
prisma/migrations/<ts>_hackathon_submission/migration.sql
middleware.ts
src/lib/feature-flags.ts
src/lib/validations/hackathon.ts
src/components/hackathon/hackathon-config.ts
src/app/hackathon/dashboard/page.tsx
src/components/hackathon/dashboard/problem-statement-panel.tsx
src/components/hackathon/dashboard/submission-checklist.tsx
src/app/hackathon/submission/page.tsx
src/app/actions/hackathon-submission-actions.ts
src/features/hackathon/submission-window.ts
src/features/hackathon/get-team-submission.ts
src/components/hackathon/submission/locked-state.tsx
src/components/hackathon/submission/brief-list.tsx
src/components/hackathon/submission/submission-form.tsx
```

Anything under `src/components/ui/`, `main-shell.tsx`, the bottom-nav files, or any
non-hackathon Prisma model appearing in `git status` means the executor went
off-plan — revert before committing.

---

## 9. Guardrails for Cursor (DO NOT)

- **DO NOT** create more than one `HackathonSubmission` row per team. `teamId` is
  `@unique` and the write is a single `upsert` — no `create` + `findFirst` dance, no
  per-brief rows.
- **DO NOT** accept a `teamId`, `participantId`, team code, or email from the client
  in the Server Action. The team is resolved from `auth()` alone. (No IDOR.)
- **DO NOT** rely on the page's rendered state as the gate. The action must call
  `getSubmissionWindow()` itself and refuse when locked or closed.
- **DO NOT** let `HACKATHON_PREVIEW` bypass the deadline, and do not read it anywhere
  except `isHackathonPreviewEnabled()` in `feature-flags.ts`.
- **DO NOT** duplicate the `Date.now() >= kickoff` comparison anywhere. Everything
  goes through `getSubmissionWindow()`, including the edited dashboard panel.
- **DO NOT** add a file upload, Vercel Blob, `FormData` file handling, or a fourth
  field. Three URL text inputs, full stop.
- **DO NOT** add a HEAD/fetch liveness check on any submitted URL.
- **DO NOT** import `@/features/hackathon/*`, `@/lib/db`, or anything `server-only`
  from `submission-form.tsx` or any other `"use client"` file.
- **DO NOT** mark `page.tsx`, `brief-list.tsx`, or `locked-state.tsx` as
  `"use client"`. Use native `<details>` for the collapsibles.
- **DO NOT** add an accordion/collapsible primitive to `src/components/ui/`, and do
  not modify anything already in that folder.
- **DO NOT** edit `main-shell.tsx`, `bottom-nav.tsx`, or `bottom-nav-gate.tsx`. Clear
  the mobile nav with `pb-28 md:pb-10` on the page container.
- **DO NOT** add `@/lib/*` imports to `middleware.ts` — one string in `protectedPaths`
  is the whole edit.
- **DO NOT** hardcode brief copy, dates, labels, placeholders, or the WhatsApp link in
  a component. Everything comes from `HACKATHON` in `hackathon-config.ts`.
- **DO NOT** use `<Button asChild>` or `<Button render={<Link>}>`. `buttonVariants` on
  the `<Link>`.
- **DO NOT** use `console.*` (use `logger`), `any`, or silencing `as` casts.
- **DO NOT** return full Prisma records — every query carries a `select`.
- **DO NOT** touch any other Prisma model, run `db:seed`, `db:cleanup`, or
  `prisma migrate reset`.
- **DO NOT** build an admin view of submissions in this plan (see §11).
- **DO NOT** send email on save.

---

## 10. Commit message

```
feat(hackathon): submission window with three briefs and per-team entry

Add /hackathon/submission: unlocks at kickoff, greets the team by name, lists
the three briefs as collapsible cards, and takes one editable submission per
team (chosen brief + public GitHub repo, live URL, AI-usage log URL). Saves
overwrite in place and stay editable until the deadline, after which the page
renders read-only.

New HackathonSubmission model (one row per team, teamId unique) plus a
HackathonBriefKey enum. The window is computed in one server-only helper that
the page, the dashboard, and the Server Action all share; HACKATHON_PREVIEW=true
unlocks it locally before kickoff without bypassing the deadline. The dashboard's
problem-statement card now routes here via "Unlock Problem Statement".
```

---

## 11. Deferred (separate later plans)

- **Admin view** of submissions at `/admin/hackathon` — per-team brief + links, CSV
  export, and a judging/scoring surface. Organizers will need this before results day.
- **Brief content** in the DB (editable without a redeploy) rather than in
  `hackathon-config.ts`, alongside the existing `HackathonEvent.problemStatement`.
- Confirmation email on first save, and a deadline-approaching reminder to teams whose
  submission is still Incomplete.
- Per-team submission history / an audit trail of edits (explicitly out of scope: the
  current requirement is that new edits override old ones).
- Any automated verification of the submitted URLs (repo public? deploy reachable?
  PROMPTS.md present?).
