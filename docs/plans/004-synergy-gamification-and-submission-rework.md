# 004 — Synergy gamification + submission-flow rework

> Plan A of two (companion: `005-jobs-board-and-nav-rename.md`). These are
> independent migrations and can ship in either order. Branch off the current
> tip: `git checkout -b feature/synergy-gamification`.
>
> **Revised** per feedback: YouTube removed entirely; **GitHub is now optional
> too**; the only hard requirement to submit is the "I completed the task"
> checkbox; proof bonuses are for GitHub and/or LinkedIn; the synergy popup is
> a designed surface, not a wall of text.

## 1. Goal
Introduce "Synergy" — a per-person gamification score. Students earn synergy
by completing daily tasks (more for submitting **earlier in rank** that day),
with bonus synergy for attaching GitHub and/or LinkedIn proof of work. Rework
the submission flow so the **only required step is confirming "I completed the
task"** via a checkbox; GitHub and LinkedIn URLs are optional (each worth bonus
synergy). Show the user's synergy in the header with a click-through, visually
designed popup explaining how it works.

> Product note (flagged, implementing as requested): `Submission.githubUrl`'s
> global uniqueness was the main anti-plagiarism signal. Making GitHub optional
> means a checkbox-only submission still earns base + rank synergy and counts
> toward `daysCompleted`. Synergy's proof bonus is the incentive to still
> attach GitHub/LinkedIn. If proof-of-work rigor needs tightening later (e.g.
> require GitHub for CLAUDE specifically), that's a separate plan.

## 2. Context / current behavior
- **Submission flow today** is two server actions
  (`src/app/actions/submission-actions.ts`):
  `submitGithubStepAction` (validates GitHub, returns the LinkedIn template
  with `{{github_link}}` filled) → `submitLinkedinStepAction` (requires a
  LinkedIn URL, then calls `submitDay`). The client
  (`src/components/challenge/day-page.tsx`) requires **both** a GitHub and a
  LinkedIn URL before the Submit button enables (lines 192–233, 517–525).
- `src/features/submission/submit-day.ts` upserts the `Submission`, recounts
  `daysCompleted`, recomputes streaks via
  `src/features/submission/streak-utils.ts`, flips
  `isReadyForInterview`/`status` at 60, and marks referrals rewarded at day 7
  — all in one `prisma.$transaction`.
- A submission for day N can only be made on day N's scheduled IST date
  (`submitDay` rejects `submittedAtIst !== expectedDate`). So "earlier" can
  only mean **rank among that day's submitters** (the chosen model), not an
  earlier calendar date.
- `Submission.githubUrl` is currently `String @unique` (**NOT NULL**, globally
  unique). `Submission.linkedinUrl` is `String` (**NOT NULL**). No `youtubeUrl`,
  no synergy concept anywhere.
- `prisma/schema.prisma` `StudentProfile` is 1:1 with `User`; the natural home
  for a denormalized per-user synergy total.
- `src/components/shared/app-header.tsx` is a client component; the right-hand
  cluster holds the challenge switcher, Admin pill, theme toggle, and avatar
  dropdown. No synergy chip.
- `dialog.tsx` exists under `src/components/ui/` (shadcn). **No `checkbox`
  primitive exists** — use a styled native `<input type="checkbox">`.
- `rejectSubmissionAction` (`src/app/actions/admin-actions.ts`, line 186)
  deletes a submission inside a transaction and recomputes counters — it must
  also reverse synergy.
- `StudentActionPanel` (`src/components/admin/student-action-panel.tsx`) uses
  an in-file `ActionDialog` pattern — the place to add a manual synergy grant.

## 3. Files to touch

**Schema / data**
- `prisma/schema.prisma` `[edit]` — make `Submission.githubUrl` AND
  `Submission.linkedinUrl` nullable (no `youtubeUrl`), add
  `StudentProfile.synergyPoints Int`, add `SynergyEvent` model, add relations.
- `prisma/seed.ts` `[edit]` (optional) — set realistic `synergyPoints` on
  seeded users so the chip isn't 0 for everyone. Low priority.

**New files**
- `src/features/synergy/scoring.ts` `[new]` — pure scoring constants +
  `computeSubmissionSynergy({ rank, hasGithub, hasLinkedin })`. No Prisma.
- `src/features/synergy/award-submission-synergy.ts` `[new]` — given a tx,
  submission row, and rank, creates the `SynergyEvent` and bumps
  `StudentProfile.synergyPoints`.
- `src/features/synergy/get-my-synergy.ts` `[new]` — read the session user's
  synergy total (server module, `select`-only).
- `src/app/actions/synergy-actions.ts` `[new]` — `getMySynergyAction()`
  (returns `{ points }` for the header chip).
- `src/components/shared/synergy-chip.tsx` `[new]` — Client. The header chip +
  the designed "How synergy works" dialog.

**Edited files**
- `src/features/submission/validate-linkedin-url.ts` `[edit]` — allow empty
  (return ok) so LinkedIn is optional.
- `src/features/submission/submit-day.ts` `[edit]` — accept optional
  `githubUrl` / `linkedinUrl`, persist both (nullable), validate GitHub only
  when present, compute rank, and award synergy inside the existing
  transaction. Only award on **first** create (not on resubmit/update).
- `src/app/actions/submission-actions.ts` `[edit]` — replace the two-step
  actions with a single `submitDayAction(formData)` (GitHub optional, LinkedIn
  optional, `confirmed` checkbox required). Keep GitHub + CLAUDE duplicate
  validation but run it only when a GitHub URL is supplied.
- `src/components/challenge/day-page.tsx` `[edit]` — new submission card:
  confirmation checkbox (required), GitHub (optional, "+synergy"), LinkedIn
  (optional, "+synergy"), single submit call. Add a small "submit early for
  more synergy" hint.
- `src/app/challenge/[day]/page.tsx` `[edit]` — `existingSubmission` already
  selects `githubUrl` + `linkedinUrl`; no new field needed. Ensure both are
  passed as strings (empty when null).
- `src/components/shared/app-header.tsx` `[edit]` — render `<SynergyChip />`
  in the right-hand cluster (before the theme toggle).
- `src/app/actions/admin-actions.ts` `[edit]` — add `grantSynergyAction`;
  update `rejectSubmissionAction` to reverse synergy.
- `src/components/admin/student-action-panel.tsx` `[edit]` — add a
  "Grant Synergy" ActionDialog (points + reason).

**Not touched**
- `middleware.ts` — no route changes in this plan.
- `src/auth.ts` / `auth.config.ts` — synergy is NOT put in the JWT (it must
  stay live; the chip fetches it).
- `src/lib/validations/submission.ts` — no YouTube validator. (LinkedIn
  optionality is handled in `validate-linkedin-url.ts`.)

## 4. Server vs Client
- `synergy/scoring.ts`, `award-submission-synergy.ts`, `get-my-synergy.ts` —
  **Server-only** modules.
- `synergy-actions.ts`, `submission-actions.ts`, `admin-actions.ts` —
  **Server Actions** (`"use server"`).
- `SynergyChip` — **Client** (`"use client"`). Self-contained: on mount it
  calls `getMySynergyAction()` (useEffect + useState), renders the chip
  (or a `✦ …` skeleton until loaded), and opens the shadcn `Dialog`. **No
  props passed from server** → zero Server→Client boundary risk. Lucide icons
  live inside this client file.
- `day-page.tsx` — already **Client**. The checkbox is native; no new icon
  props cross a boundary.
- `app-header.tsx` — already **Client**; it just mounts `<SynergyChip />`.
- `student-action-panel.tsx` — already **Client**; new ActionDialog is local.
- `app/challenge/[day]/page.tsx` — **Server**; passes plain
  `{ githubUrl, linkedinUrl }` (strings) to `DayPage`. No Date/function/icon
  crossing.

## 5. Step-by-step changes

### 5.1 Schema (`prisma/schema.prisma`)
1. `Submission`:
   - `githubUrl String? @unique` (was `String @unique`). **Postgres allows
     multiple NULLs under a UNIQUE constraint**, so many checkbox-only
     submissions with null GitHub coexist; uniqueness still enforced among
     non-null values.
   - `linkedinUrl String?` (was `String`).
   - add relation back-ref: `synergyEvent SynergyEvent?`.
   - (No `youtubeUrl`.)
2. `StudentProfile`:
   - add `synergyPoints Int @default(0)`.
   - add `@@index([synergyPoints(sort: Desc)])` (future leaderboard / sorting).
3. `User`:
   - add `synergyEvents SynergyEvent[]`.
4. New model:
   ```prisma
   model SynergyEvent {
     id               String      @id @default(cuid())
     userId           String
     points           Int
     type             String      // "SUBMISSION" | "COMMUNITY_GRANT" | "ADJUSTMENT"
     submissionId     String?     @unique
     enrollmentId     String?
     dayNumber        Int?
     rankAtAward      Int?
     reason           String?
     createdByAdminId String?
     createdAt        DateTime    @default(now())
     user             User        @relation(fields: [userId], references: [id], onDelete: Cascade)
     submission       Submission? @relation(fields: [submissionId], references: [id], onDelete: Cascade)

     @@index([userId])
     @@index([createdAt])
   }
   ```
   - `submissionId @unique` + `onDelete: Cascade` → one event per submission;
     deleting the submission auto-removes its event. (The denormalized total
     is still decremented manually in the reject path — see 5.9.)

### 5.2 `src/features/synergy/scoring.ts` (new)
```ts
export const SYNERGY_BASE_SUBMISSION = 10;
export const SYNERGY_PROOF_GITHUB = 5;
export const SYNERGY_PROOF_LINKEDIN = 5;

/** Rank is 1-based order of submittedAt among submissions for the same
 *  (challengeId, dayNumber). Lower rank (earlier) = more synergy. */
export function rankBonus(rank: number): number {
  if (rank <= 1) return 25;
  if (rank <= 3) return 18;
  if (rank <= 10) return 12;
  if (rank <= 25) return 6;
  return 2;
}

export function computeSubmissionSynergy(input: {
  rank: number;
  hasGithub: boolean;
  hasLinkedin: boolean;
}): { points: number; rankBonus: number } {
  const rb = rankBonus(input.rank);
  const points =
    SYNERGY_BASE_SUBMISSION +
    rb +
    (input.hasGithub ? SYNERGY_PROOF_GITHUB : 0) +
    (input.hasLinkedin ? SYNERGY_PROOF_LINKEDIN : 0);
  return { points, rankBonus: rb };
}
```
Constants live here (not a separate trivial config file). These same numbers
feed the popup copy in 5.13 — keep them in sync if you tune them.

### 5.3 `src/features/synergy/award-submission-synergy.ts` (new)
```ts
import type { Prisma } from "@prisma/client";
import { computeSubmissionSynergy } from "./scoring";

export async function awardSubmissionSynergy(
  tx: Prisma.TransactionClient,
  args: {
    userId: string;
    submissionId: string;
    enrollmentId: string;
    challengeId: string;
    dayNumber: number;
    submittedAt: Date;
    hasGithub: boolean;
    hasLinkedin: boolean;
  },
): Promise<number> {
  // Rank = how many submissions already exist for this challenge+day with an
  // earlier submittedAt, +1. Excludes this submission.
  const earlier = await tx.submission.count({
    where: {
      dayNumber: args.dayNumber,
      enrollment: { challengeId: args.challengeId },
      submittedAt: { lt: args.submittedAt },
      id: { not: args.submissionId },
    },
  });
  const rank = earlier + 1;
  const { points } = computeSubmissionSynergy({
    rank,
    hasGithub: args.hasGithub,
    hasLinkedin: args.hasLinkedin,
  });

  await tx.synergyEvent.create({
    data: {
      userId: args.userId,
      points,
      type: "SUBMISSION",
      submissionId: args.submissionId,
      enrollmentId: args.enrollmentId,
      dayNumber: args.dayNumber,
      rankAtAward: rank,
    },
  });
  await tx.studentProfile.updateMany({
    where: { userId: args.userId },
    data: { synergyPoints: { increment: points } },
  });
  return points;
}
```

### 5.4 `src/features/synergy/get-my-synergy.ts` (new)
```ts
import { prisma } from "@/lib/db";

export async function getMySynergy(userId: string): Promise<number> {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId },
    select: { synergyPoints: true },
  });
  return profile?.synergyPoints ?? 0;
}
```

### 5.5 `src/app/actions/synergy-actions.ts` (new)
```ts
"use server";
import { auth } from "@/auth";
import { getMySynergy } from "@/features/synergy/get-my-synergy";

export async function getMySynergyAction(): Promise<{ points: number }> {
  const session = await auth();
  if (!session?.user?.id) return { points: 0 };
  return { points: await getMySynergy(session.user.id) };
}
```

### 5.6 Validation update
- `src/features/submission/validate-linkedin-url.ts`: at the top of
  `validateLinkedinUrl`, if the trimmed input is empty → `return { ok: true }`.
  (LinkedIn is now optional.) No YouTube validator is added.

### 5.7 `src/features/submission/submit-day.ts` (edit)
1. Signature:
   ```ts
   export async function submitDay(input: {
     userId: string;
     githubUrl?: string | null;
     linkedinUrl?: string | null;
     dayNumber: number;
     enrollmentId?: string | null;
   }): Promise<SubmitDayResult>
   ```
2. Normalize: `hasGithub = !!githubUrl?.trim()`, `hasLinkedin = !!linkedinUrl?.trim()`.
   - Validate GitHub (`validateSubmissionUrl`, plus CLAUDE commit-duplicate)
     **only when `hasGithub`**. Skip entirely when blank.
   - Validate LinkedIn only when non-empty (validator now no-ops on empty).
3. In the transaction:
   - Determine create-vs-update by reading the existing submission first
     (`tx.submission.findUnique` on `enrollmentId_dayNumber`). Branch:
     - **create**: `tx.submission.create({...})` with `githubUrl` =
       trimmed-or-`null`, `linkedinUrl` = trimmed-or-`null`. Then call
       `awardSubmissionSynergy(tx, { ... submittedAt: submission.submittedAt,
       hasGithub, hasLinkedin, challengeId: enrollment.challengeId })`.
     - **update** (resubmit): update `githubUrl`/`linkedinUrl`/`status`/
       `submittedAt`. **Do not** recompute rank or re-award synergy (rank is
       locked at first submission). Leave the existing SynergyEvent as-is.
   - Keep the existing `daysCompleted` recount, streak recompute,
     `isReadyForInterview` flip, and day-7 referral reward exactly as they are.
4. `SubmitDayOk` may add `synergyAwarded?: number` so the client can toast it.
   `submissionId / newStreak / daysCompleted` unchanged.

### 5.8 `src/app/actions/submission-actions.ts` (edit)
1. Delete `submitGithubStepAction` and `submitLinkedinStepAction` and their
   schemas.
2. Add a single action:
   ```ts
   const submitSchema = z.object({
     githubUrl: z.string().optional().default(""),
     linkedinUrl: z.string().optional().default(""),
     dayNumber: z.coerce.number().int().min(1).max(60),
     confirmed: z.coerce.boolean(),
   });

   export async function submitDayAction(formData: FormData) { ... }
   ```
   - Auth check. Parse. If `!confirmed` → `{ ok: false, message: "Please confirm you've completed the task." }`.
   - Resolve enrollment (reuse `resolveChallengeEnrollment`).
   - Day-window gate (always): `getCurrentDayNumber` (reject future days),
     `assertPastDaySubmittable`.
   - GitHub gate (**only when a GitHub URL is provided**): CLAUDE
     commit-duplicate check + `validateSubmissionUrl`. Move that block over from
     the old github step, wrapped in `if (githubUrl.trim()) { ... }`.
   - Then call `submitDay({ userId, githubUrl, linkedinUrl, dayNumber,
     enrollmentId })`. Return its result.
3. The LinkedIn-template handshake is dropped. The static "LinkedIn Post
   Guidelines" section in `day-page.tsx` stays as guidance. (If a prefilled
   LinkedIn post is wanted back, that's a separate task — note in the PR.)

### 5.9 Admin actions (`src/app/actions/admin-actions.ts`)
1. **`grantSynergyAction`** (new):
   ```ts
   export async function grantSynergyAction(input: {
     targetUserId: string; points: number; reason?: string;
   }) {
     const admin = await requireAdmin();
     const parsed = z.object({
       targetUserId: z.string().min(1),
       points: z.coerce.number().int().min(1).max(1000),
       reason: z.string().max(500).optional(),
     }).safeParse(input);
     if (!parsed.success) return { ok: false as const, message: "Invalid input" };
     const { targetUserId, points, reason } = parsed.data;
     try {
       await prisma.$transaction(async (tx) => {
         await tx.synergyEvent.create({ data: {
           userId: targetUserId, points, type: "COMMUNITY_GRANT",
           reason, createdByAdminId: admin.userId,
         }});
         await tx.studentProfile.updateMany({
           where: { userId: targetUserId },
           data: { synergyPoints: { increment: points } },
         });
         await tx.adminAction.create({ data: {
           adminUserId: admin.userId, targetUserId,
           actionType: "GRANT_SYNERGY", metadata: { points }, reason,
         }});
       });
       revalidateAdminViews(targetUserId);
       return { ok: true as const };
     } catch { return { ok: false as const, message: "Grant failed" }; }
   }
   ```
   - This covers "weekly communication practice" awards and any manual bonus.
2. **`rejectSubmissionAction`** (edit): inside the existing transaction, before
   `tx.submission.delete`, read the linked synergy event's points and reverse
   the denormalized total:
   ```ts
   const event = await tx.synergyEvent.findUnique({
     where: { submissionId }, select: { points: true },
   });
   if (event) {
     await tx.studentProfile.updateMany({
       where: { userId: submission.userId },
       data: { synergyPoints: { decrement: event.points } },
     });
   }
   // existing delete; the SynergyEvent row cascades away via submissionId FK
   ```

### 5.10 `src/components/admin/student-action-panel.tsx` (edit)
- Import `grantSynergyAction`.
- Add a new `ActionDialog` ("Grant Synergy") with a number input (`points`,
  1–1000) and an optional `reason` textarea. On confirm, call
  `grantSynergyAction({ targetUserId, points, reason })`, toast result,
  `router.refresh()`. Mirror the existing dialogs' structure exactly.

### 5.11 `src/components/challenge/day-page.tsx` (edit)
Replace the bottom submission card (lines ~491–526) and the `handleSubmit`
logic (lines ~192–233):
- State: `githubUrl`, `linkedinUrl`, `confirmed` (boolean), `submitting`.
  Prefill `githubUrl` / `linkedinUrl` from `existingSubmission` (strings,
  empty when null). Remove all YouTube state.
- Layout (designed, not a bare row):
  - A confirmation block first: a native `<input type="checkbox" id="confirm">`
    + `<label htmlFor="confirm">` reading **"I confirm I have completed
    today's task."** Style the checkbox area as a rounded card so it reads as
    the primary action.
  - Below it, an "Add proof (optional — earns more synergy)" subsection with:
    - GitHub URL input — optional. Helper under it: "Optional · +5 synergy".
      Placeholder "GitHub commit or repo URL".
    - LinkedIn URL input — optional. Helper: "Optional · +5 synergy".
  - Submit button.
- Submit enabled when `confirmed` AND `!submitting` (GitHub/LinkedIn NOT
  required).
- `handleSubmit`: build one FormData (`githubUrl`, `linkedinUrl`, `dayNumber`,
  `enrollmentId`, `confirmed`), call `submitDayAction`. On `ok`, toast
  `Day N submitted! +{synergyAwarded} synergy 🔥` (fall back to the old
  message if `synergyAwarded` is undefined) and route to dashboard.
- Add a one-line hint above the card: "Tip: the earlier you finish each day,
  the more synergy you earn — and adding your GitHub + LinkedIn earns even
  more."
- Remove the old two-call (`submitGithubStepAction` then
  `submitLinkedinStepAction`) sequence and any YouTube input.

### 5.12 `src/app/challenge/[day]/page.tsx` (edit)
- The `existingSubmission` select already returns `githubUrl` + `linkedinUrl`.
  Ensure they're passed to `DayPage` as strings: `githubUrl: existing?.githubUrl ?? ""`,
  `linkedinUrl: existing?.linkedinUrl ?? ""`. Update the
  `Props.existingSubmission` type in `day-page.tsx` to
  `{ githubUrl: string; linkedinUrl: string } | null` (drop any `youtubeUrl`).

### 5.13 `src/components/shared/synergy-chip.tsx` (new) + header wiring
This is a **designed** surface — visual, not textual.

**The chip** (in the header, before `<ThemeToggle />`):
```tsx
<button type="button" onClick={() => setOpen(true)} aria-label="View your synergy"
  className="group inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-gradient-to-r from-primary/15 to-violet-500/15 px-2.5 py-1 text-xs font-semibold text-primary shadow-sm transition-colors hover:from-primary/25 hover:to-violet-500/25">
  <Sparkles className="size-3.5 transition-transform group-hover:scale-110" aria-hidden />
  <span className="tabular-nums">{points ?? "…"}</span>
</button>
```

**The dialog** (shadcn `Dialog` / `DialogContent`) — give it real structure:
- **Gradient hero band** at the top of the dialog: a `rounded-t-lg`
  `bg-gradient-to-br from-primary to-violet-500 text-primary-foreground`
  header with a large `Sparkles` icon, the user's current points in big
  `font-display` numerals, and a one-line tagline: *"Your community
  score. The more you contribute, the more you're rewarded."*
- **"How you earn" — icon tiles** (a `grid grid-cols-1 sm:grid-cols-2 gap-3`),
  each tile a rounded card with a colored icon chip, a short bold title, and
  one line of copy. Four tiles:
  1. `Clock` (indigo) — **"Finish early"** — "The earlier you submit each day,
     the bigger your rank bonus."
  2. `Github` (emerald) — **"Attach your GitHub"** — "Link your commit or repo
     for +5 synergy on that day."  *(use the lucide `Github` icon)*
  3. `Linkedin` (sky) — **"Share on LinkedIn"** — "Post your progress and add
     the link for +5 synergy."  *(lucide `Linkedin` icon)*
  4. `Users` (violet) — **"Show up for the community"** — "Join weekly
     communication practice and other sessions — those earn synergy too."
- **"What it unlocks" — highlight strip**: a single `rounded-xl border
  border-primary/20 bg-primary/5 p-4` row with a `TrendingUp` icon and copy:
  *"Members with high synergy get more visibility in the community and early
  access to job opportunities."*
- A `DialogClose` "Got it" button (use `buttonVariants` styling on the close
  control, or shadcn's button — NOT `<Button asChild>`).
- All icons are imported and used **inside this client component** (no icon
  props cross a boundary). Keep the points number from
  `getMySynergyAction()` (re-use the value already fetched for the chip — lift
  it into the component so both the chip and the hero show it).
- Colors must use existing tokens / Tailwind utilities already in the app
  (`text-primary`, `bg-primary`, `from-violet-500`, domain-style emerald/sky
  utility classes). Don't introduce new CSS variables.

**Header wiring:** in `app-header.tsx`, mount `<SynergyChip />` in the right
cluster before `<ThemeToggle />`. (Admin layout renders AppHeader too, so
admins see their own chip; fine.)

## 6. Guardrails for Cursor (DO NOT)
- DO NOT add a YouTube field, validator, input, or column anywhere. There is no
  YouTube in this feature.
- DO NOT make GitHub or LinkedIn required (forms, zod, DB). Both are optional;
  the checkbox is the only hard requirement to submit.
- DO NOT remove `Submission.githubUrl`'s `@unique`. It becomes `String?
  @unique` — uniqueness still applies to non-null values (Postgres permits
  many NULLs). Do not add a partial index or other workaround; the nullable
  unique is sufficient.
- DO NOT put synergy in the JWT/session (`auth.ts` / `auth.config.ts`). It must
  be live; the chip fetches via `getMySynergyAction`. Touching the auth config
  also risks the edge bundle.
- DO NOT recompute rank or re-award synergy on resubmission. Rank is locked at
  the first `create`. The reject path is the only place synergy is reversed.
- DO NOT pass Lucide icons, functions, or Dates across a Server→Client
  boundary. `SynergyChip` is fully client and self-fetches; all icons stay
  inside it. `app/challenge/[day]/page.tsx` passes only strings to `DayPage`.
- DO NOT add a shadcn `checkbox` primitive or modify `src/components/ui/*`.
  Use a native `<input type="checkbox">` with Tailwind classes.
- DO NOT use `<Button asChild>` / `<Button render={<Link>}>`. (Standing rule.)
- DO NOT use `any`. The new result/return types are concrete.
- DO NOT skip the transaction wrapper. Synergy award + total increment +
  submission write happen in the SAME `prisma.$transaction` as the existing
  enrollment update. Same for grant and reject reversal.
- DO NOT use `include` — `select` only on every new query.
- DO NOT log via `console.*` — use `lib/logger.ts` for any caught errors.
- DO NOT leave the removed `submitGithubStepAction` / `submitLinkedinStepAction`
  exported or imported anywhere. Grep for their names after editing —
  `day-page.tsx` is the only caller.
- DO NOT change IST day logic. Submissions still only happen on the scheduled
  IST date; rank is computed by `submittedAt` ordering only.

## 7. DB safety (schema + data change)
1. **Checkpoint:** `git add -A && git commit -m "checkpoint before synergy migration"`. Note the commit hash.
2. **Neon branch snapshot** of the current DB before migrating (so a bad
   migration is recoverable).
3. **Migrate:**
   - `npx prisma migrate dev --name add_synergy_and_optional_proof_urls`
   - This alters `Submission.githubUrl` and `Submission.linkedinUrl` to
     nullable, adds `StudentProfile.synergyPoints` (default 0), and creates
     `SynergyEvent`.
   - Existing `Submission` rows keep their GitHub/LinkedIn values; all
     `synergyPoints` start at 0.
   - **Nullable-unique check:** confirm the generated migration alters
     `githubUrl` to nullable while keeping the unique index (Postgres
     `DROP NOT NULL` retains the unique index). Verify in the SQL before
     applying to the shared DB.
4. **Regenerate client:** `npx prisma generate`.
5. **Backfill (OPTIONAL, pre-launch only):** historical submissions have no
   SynergyEvent. Since the only real users are testers, the simplest path is
   `npm run db:cleanup:test` + `npm run db:seed` after the migration. A
   data-preserving backfill script is possible but NOT required for launch.
6. Run `npm run build` to confirm types + migration apply cleanly.

## 8. Verification
Manual (local, `ENABLE_DEV_AUTH=true`):
1. `npm run dev`. Log in as `arjun@abtalks.dev` / `test`.
2. **Header chip** shows the gradient `✦ {points}` pill. Click it → the
   designed dialog opens: gradient hero with the points, four "how you earn"
   tiles (finish early / GitHub / LinkedIn / community), and the "what it
   unlocks" strip mentioning visibility + early job access. No wall of text.
3. **Submit flow** on `/challenge/1`:
   - Submit button is **disabled** until the "I confirm I have completed
     today's task" checkbox is ticked. GitHub/LinkedIn are NOT required.
   - Submit with **checkbox only** (no URLs) → succeeds; toast shows
     `+{n} synergy`. The chip increments after navigating (or refresh).
   - Submit a different day with GitHub **and** LinkedIn filled → earns the
     two proof bonuses on top of base + rank.
   - Re-open a day, change the GitHub URL, resubmit → submission updates, but
     synergy does **not** change (rank locked, no re-award).
4. **Rank** sanity: with two test users submitting the same challenge+day, the
   first submitter's `SynergyEvent.rankAtAward` = 1 (bigger bonus), the second
   = 2. Inspect via psql or admin.
5. **Admin grant**: as `admin@abtalks.dev`, open a student detail →
   "Grant Synergy" → +50 with reason "Weekly comms practice". The student's
   chip and `synergyPoints` increase; an `AdminAction` `GRANT_SYNERGY` row and
   a `SynergyEvent` `COMMUNITY_GRANT` row exist.
6. **Reject reversal**: reject that student's Day 1 submission → their
   `synergyPoints` drop by exactly the awarded amount and the `SynergyEvent`
   for that submission is gone (cascade).
7. **Build/typecheck**: `npm run lint`, `npm run build`, `tsc --noEmit` all
   clean. Grep confirms `submitGithubStepAction` / `submitLinkedinStepAction`
   no longer exist and there are zero `youtube` references in the submission
   path.

Files that should change (and only these): the schema, the 5 new files, and
the edited files listed in §3.

## 9. Commit message
```
feat(synergy): rank-based synergy + checkbox submission, optional GH/LI proof

- New Synergy score per user (StudentProfile.synergyPoints) backed by an
  auditable SynergyEvent ledger. Completing a day earns a base + a rank bonus
  (earlier submitters that day earn more) + optional GitHub/LinkedIn proof
  bonuses. Rank is locked at first submission; resubmits don't re-award.
- Submission rework: the only required step is confirming completion via a
  checkbox. GitHub and LinkedIn URLs are optional (each worth bonus synergy).
  Collapses the two-step submit into a single submitDayAction. githubUrl and
  linkedinUrl are now nullable (githubUrl stays UNIQUE for non-null values).
- Header synergy chip with a designed "How synergy works" popup (gradient
  hero, earn tiles, visibility + early job access).
- Admin can grant synergy (e.g. weekly comms practice); rejecting a
  submission reverses its synergy.

Migration: add_synergy_and_optional_proof_urls.
```
