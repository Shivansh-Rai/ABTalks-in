# 010 — Admin recruiter review + shareable anonymized profile (PDF)

> New feature with one schema migration. Branch:
> `git checkout -b feature/recruiter-profile`.
>
> Decisions locked with the user:
> - **Delivery:** a hosted, tokenized public page `/r/<token>` + a "Download
>   PDF" button (browser print-to-PDF; zero new dependencies).
> - **Anonymity:** show the student's real name, college/domain/skills, ABTalks
>   stats, and the admin ratings; **always hide email, phone, LinkedIn, AND
>   GitHub** (so recruiters can't contact the student directly — they go
>   through ABTalks).
> - **Review content:** 3 ratings (Confidence, Coding skills, Communication) on
>   a **1–5** scale + a private admin note + curated sections (headline,
>   summary, key strengths, recommended roles).
> - **Live:** the shared page always reflects current stats + the latest saved
>   review (no frozen snapshots).

## 1. Goal
Let an admin open a student, rate them (Confidence / Coding / Communication,
1–5), add a private note and curated talent-profile content, then publish an
**anonymized, ABTalks-branded recruiter profile** at a shareable link that
hides all direct-contact details and can be saved as a PDF.

## 2. Context / current behavior
- Admin student detail lives at `src/app/admin/students/[id]/page.tsx` (Server
  Component) — header card + Profile Info / Progress Stats cards + a `Tabs`
  block (Submissions / Quiz Attempts / Admin Actions) + `StudentActionPanel`.
  Data comes from `src/features/admin/get-student-detail.ts`.
- A student public profile already exists (`/students/[id]`,
  `src/features/profile/get-public-profile.ts`) — but it still exposes
  `linkedinUrl` and `githubUsername` and is NOT anonymized/curated. Do not
  reuse it for recruiters; this is a distinct, admin-curated artifact.
- `prisma/schema.prisma`: `StudentProfile` holds `phone`, `linkedinUrl`,
  `githubUsername`, `resumeUrl`, `skills`, `synergyPoints`, `isReadyForInterview`,
  `userType` + student/professional fields. `AdminAction` is the existing audit
  table. There is **no** recruiter-review model.
- `middleware.ts` `protectedPaths` = dashboard/challenge/profile/quiz/register/
  admin/jobs/mission. `/r/...` is **not** protected and is not `/login`, so the
  middleware already lets it through for everyone (public) — no change needed,
  but it must stay that way.
- No PDF library and no Blob storage are installed (confirmed in
  `package.json`). The print-to-PDF approach needs neither.
- `src/components/shared/bottom-nav.tsx` self-suppresses on `/`, `/login`,
  `/register`, `/claude-signup`, `/students` — `/r` must be added so a
  logged-in admin previewing the page doesn't see the student bottom nav.

## 3. Files to touch

**Schema / data**
- `prisma/schema.prisma` `[edit]` — add `RecruiterReview` model + the
  `User.recruiterReview` back-relation.

**New files**
- `src/features/recruiter/get-recruiter-review.ts` `[new]` — admin-side read of
  the current review for a user (select-only).
- `src/features/recruiter/get-recruiter-profile.ts` `[new]` — **public** read by
  share token; returns an anonymized view-model only when published.
- `src/app/actions/recruiter-review-actions.ts` `[new]` — admin actions: upsert
  review, publish, unpublish, regenerate token.
- `src/components/admin/recruiter-review-panel.tsx` `[new]` — Client. The rating
  + curated-content form, plus publish/link controls.
- `src/app/r/[token]/page.tsx` `[new]` — **public** recruiter profile page
  (Server Component). Branded, anonymized, print-styled.
- `src/app/r/[token]/print-button.tsx` `[new]` — Client. "Download PDF" button
  calling `window.print()`.

**Edited files**
- `src/app/admin/students/[id]/page.tsx` `[edit]` — fetch the review and add a
  "Recruiter Profile" tab rendering `<RecruiterReviewPanel />`.
- `src/components/shared/bottom-nav.tsx` `[edit]` — add `/r` to the suppress
  regex.

**Not touched**
- `middleware.ts` — `/r` is already public; do NOT add it to `protectedPaths`.
- `get-public-profile.ts` / `/students/[id]` — unrelated, leave as-is.
- `src/components/ui/*` — no primitive edits.

## 4. Server vs Client
- `get-recruiter-review.ts`, `get-recruiter-profile.ts` — **Server-only**
  modules (`select` only).
- `recruiter-review-actions.ts` — **Server Actions** (`"use server"`), all
  `requireAdmin()` except none are public.
- `recruiter-review-panel.tsx` — **Client**. Receives the current review as
  **plain serializable props** (numbers/null, strings, `string[]`, boolean,
  token string). No Date/function/icon crosses the boundary (if `reviewedAt`
  is shown, pass it as a preformatted string).
- `app/admin/students/[id]/page.tsx` — **Server**; fetches review, passes plain
  props to the panel.
- `app/r/[token]/page.tsx` — **Server** (public). Renders the anonymized
  view-model. Mounts the small client `<PrintButton />`.
- `print-button.tsx` — **Client** (needs `window.print()`).
- `bottom-nav.tsx` — already **Client**.

## 5. Step-by-step changes

### 5.1 Schema (`prisma/schema.prisma`)
```prisma
model RecruiterReview {
  id                  String    @id @default(cuid())
  userId              String    @unique
  confidenceRating    Int?      // 1..5
  codingRating        Int?      // 1..5
  communicationRating Int?      // 1..5
  headline            String?
  summary             String?
  strengths           String[]  @default([])
  recommendedRoles    String[]  @default([])
  adminNote           String?   // PRIVATE — never rendered to recruiters
  isPublished         Boolean   @default(false)
  shareToken          String?   @unique
  reviewedByAdminId   String?
  reviewedAt          DateTime?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  user                User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([shareToken])
}
```
- Add to `User`: `recruiterReview RecruiterReview?`.
- `shareToken` is null until first publish; `@unique` (nullable unique →
  Postgres allows many nulls).

### 5.2 `src/features/recruiter/get-recruiter-review.ts` (new, admin read)
```ts
import { prisma } from "@/lib/db";

export async function getRecruiterReview(userId: string) {
  const r = await prisma.recruiterReview.findUnique({
    where: { userId },
    select: {
      confidenceRating: true, codingRating: true, communicationRating: true,
      headline: true, summary: true, strengths: true, recommendedRoles: true,
      adminNote: true, isPublished: true, shareToken: true,
    },
  });
  // Return a normalized object (empty defaults) so the client form is simple.
  return {
    confidenceRating: r?.confidenceRating ?? null,
    codingRating: r?.codingRating ?? null,
    communicationRating: r?.communicationRating ?? null,
    headline: r?.headline ?? "",
    summary: r?.summary ?? "",
    strengths: r?.strengths ?? [],
    recommendedRoles: r?.recommendedRoles ?? [],
    adminNote: r?.adminNote ?? "",
    isPublished: r?.isPublished ?? false,
    shareToken: r?.shareToken ?? null,
  };
}
```

### 5.3 `src/features/recruiter/get-recruiter-profile.ts` (new, PUBLIC read)
- Resolve by `shareToken`; return `null` unless found AND `isPublished`.
- **Select ONLY allowed fields** — never select email/phone/linkedinUrl/
  githubUsername/adminNote into the view-model.
```ts
import { EnrollmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

export type RecruiterProfileView = {
  fullName: string;
  userType: "STUDENT" | "PROFESSIONAL";
  domain: string;
  college: string | null;
  graduationYear: number | null;
  organization: string | null;
  role: string | null;
  yearsExperience: number | null;
  skills: string[];
  daysCompleted: number;
  totalDays: number;
  currentStreak: number;
  longestStreak: number;
  isReadyForInterview: boolean;
  synergyPoints: number;
  ratings: { confidence: number | null; coding: number | null; communication: number | null };
  headline: string | null;
  summary: string | null;
  strengths: string[];
  recommendedRoles: string[];
};

export async function getRecruiterProfileByToken(
  token: string,
): Promise<RecruiterProfileView | null> {
  const review = await prisma.recruiterReview.findUnique({
    where: { shareToken: token },
    select: {
      isPublished: true,
      confidenceRating: true, codingRating: true, communicationRating: true,
      headline: true, summary: true, strengths: true, recommendedRoles: true,
      user: {
        select: {
          studentProfile: {
            select: {
              fullName: true, userType: true, domain: true, college: true,
              graduationYear: true, organization: true, role: true,
              yearsExperience: true, skills: true, synergyPoints: true,
              isReadyForInterview: true,
            },
          },
          enrollments: {
            where: { status: { not: EnrollmentStatus.ABANDONED } },
            orderBy: { startedAt: "asc" },
            select: {
              domain: true, status: true, daysCompleted: true,
              currentStreak: true, longestStreak: true,
              challenge: { select: { totalDays: true } },
            },
          },
        },
      },
    },
  });

  if (!review || !review.isPublished || !review.user.studentProfile) return null;
  const p = review.user.studentProfile;
  // Pick the enrollment matching the profile domain (active preferred), like
  // get-public-profile's resolver.
  const enr =
    review.user.enrollments.find((e) => e.domain === p.domain && e.status === "ACTIVE") ??
    review.user.enrollments.find((e) => e.domain === p.domain) ??
    review.user.enrollments[0] ?? null;

  return {
    fullName: p.fullName,
    userType: p.userType,
    domain: p.domain,
    college: p.college,
    graduationYear: p.graduationYear,
    organization: p.organization,
    role: p.role,
    yearsExperience: p.yearsExperience,
    skills: p.skills,
    daysCompleted: enr?.daysCompleted ?? 0,
    totalDays: enr?.challenge.totalDays ?? 60,
    currentStreak: enr?.currentStreak ?? 0,
    longestStreak: enr?.longestStreak ?? 0,
    isReadyForInterview: p.isReadyForInterview,
    synergyPoints: p.synergyPoints,
    ratings: {
      confidence: review.confidenceRating,
      coding: review.codingRating,
      communication: review.communicationRating,
    },
    headline: review.headline,
    summary: review.summary,
    strengths: review.strengths,
    recommendedRoles: review.recommendedRoles,
  };
}
```

### 5.4 `src/app/actions/recruiter-review-actions.ts` (new, admin)
All actions `await requireAdmin()` first; Zod-validate; use the result
envelope; wrap multi-write operations in `prisma.$transaction`; audit via
`AdminAction`.
- `upsertRecruiterReviewAction(input)`:
  - Zod: `userId` string; ratings each `z.coerce.number().int().min(1).max(5).nullable().optional()`;
    `headline`/`summary`/`adminNote` `z.string().max(...).optional()`;
    `strengths`/`recommendedRoles` `z.array(z.string().trim().min(1).max(60)).max(10)`.
  - `prisma.recruiterReview.upsert({ where: { userId }, create: {...}, update: {...} })`
    setting `reviewedByAdminId = admin.userId`, `reviewedAt = new Date()`.
  - Create an `AdminAction` row `actionType: "RECRUITER_REVIEW_UPDATED"`.
  - Return `{ ok: true }`.
- `publishRecruiterProfileAction({ userId })`:
  - Ensure a review row exists (upsert empty if needed). If `shareToken` is
    null, generate one: `const token = crypto.randomUUID().replace(/-/g, "")`
    (URL-safe, unguessable; the `@unique` guards collisions). Set
    `isPublished = true`. Audit `"RECRUITER_PROFILE_PUBLISHED"`.
  - Return `{ ok: true, data: { shareToken } }`.
- `unpublishRecruiterProfileAction({ userId })`: set `isPublished = false`
  (keep the token). Audit `"RECRUITER_PROFILE_UNPUBLISHED"`. Public reads now
  return null → 404.
- `regenerateShareTokenAction({ userId })`: set a fresh `shareToken` (revokes
  old links). Audit `"RECRUITER_LINK_REGENERATED"`. Return new token.
- `revalidateAdminViews(userId)` (existing helper) after each, plus
  `revalidatePath('/r/<token>')` is unnecessary (page is dynamic/uncached).

### 5.5 `src/components/admin/recruiter-review-panel.tsx` (new, client)
Props (plain): `{ studentId: string; studentName: string; review: <the
normalized object from get-recruiter-review> }`.
- **Ratings:** for each of Confidence / Coding / Communication render a 1–5
  segmented selector (five buttons, or 5 star toggles). Store as `number|null`.
- **Curated content:** `headline` input; `summary` textarea; `strengths` and
  `recommendedRoles` as tag inputs (comma/Enter to add, chips with remove — you
  can mirror the skills tag pattern in `profile-form.tsx`); `adminNote`
  textarea clearly labeled **"Private — never shown to recruiters."**
- **Save** → `upsertRecruiterReviewAction({...})`, toast, `router.refresh()`.
- **Publish controls:**
  - If not published: a "Publish recruiter profile" button →
    `publishRecruiterProfileAction`.
  - If published: show the link `\`${window.location.origin}/r/${review.shareToken}\``
    with a Copy button, a "Preview" link (`<Link href={"/r/"+token} target="_blank">`
    styled with `buttonVariants`), "Regenerate link", and "Unpublish" buttons.
- Use `useTransition` for the action calls. No `<Button asChild>` — links use
  `buttonVariants`.

### 5.6 `src/app/admin/students/[id]/page.tsx` (edit)
- Import `getRecruiterReview` + `RecruiterReviewPanel`. After
  `getStudentDetail`, also `const review = await getRecruiterReview(id);`
  (run it in the same place; a second await is fine, or `Promise.all`).
- Add a 4th tab:
  ```tsx
  <TabsTrigger value="recruiter">Recruiter Profile</TabsTrigger>
  ...
  <TabsContent value="recruiter">
    <RecruiterReviewPanel
      studentId={data.student.userId}
      studentName={data.student.fullName}
      review={review}
    />
  </TabsContent>
  ```

### 5.7 `src/app/r/[token]/page.tsx` (new, PUBLIC Server Component)
- `params: Promise<{ token: string }>`. `const profile = await
  getRecruiterProfileByToken(token); if (!profile) notFound();`
- **No `auth()`, no `requireAdmin`, no `requireRole`** — this is public.
- Layout: a standalone, branded one-pager (do NOT render `AppHeader`):
  - Top bar: ABTalks wordmark + a "Verified by ABTalks" badge.
  - Candidate header: `fullName`, domain badge, college + graduation year
    (or role @ organization · years for professionals), "Ready for interview"
    badge when true.
  - **Ratings block:** Confidence / Coding / Communication each shown as
    `N/5` with a 5-star visual (filled vs outline). If a rating is null, show
    "Not rated".
  - **Summary / headline** (curated prose), **Key strengths** (chips), and
    **Recommended roles** (chips).
  - **Proof of work strip:** `daysCompleted/totalDays` with a progress bar,
    current & longest streak, and synergy points — framed as ABTalks-verified
    consistency. (No personal data, no task content.)
  - **Skills** list.
  - Footer: "Interested? Connect with this candidate through ABTalks." + the
    `<PrintButton />`. **No email/phone/LinkedIn/GitHub anywhere.**
- **Print styling (no new deps):** use Tailwind `print:` utilities — `PrintButton`
  is `print:hidden`; the page root gets `[print-color-adjust:exact]
  [-webkit-print-color-adjust:exact]` so badges/stars print in color; set a
  white background and constrain width (`max-w-3xl mx-auto`). Verify it fits A4.
- `export const metadata` minimal; consider `robots: { index: false }` so the
  tokenized page isn't indexed.

### 5.8 `src/app/r/[token]/print-button.tsx` (new, client)
```tsx
"use client";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={cn(buttonVariants({ variant: "default" }), "print:hidden")}
    >
      <Download className="mr-2 size-4" /> Download PDF
    </button>
  );
}
```

### 5.9 `src/components/shared/bottom-nav.tsx` (edit)
- Add `/r` to the self-suppress regex so the student bottom nav never overlays
  a recruiter page:
  `/^\/(login|register|claude-signup|students|r)(\/|$)/.test(pathname)`.

## 6. Guardrails for Cursor (DO NOT)
- DO NOT add `requireAdmin` / `requireRole` / `auth()` gating to `/r/[token]`,
  `get-recruiter-profile.ts`, or anything in the public read path. The recruiter
  page is **public** by design. (Recruiters are not users.)
- DO NOT add `/r` to `middleware.ts` `protectedPaths` — it must stay public.
- DO NOT select or render `email`, `phone`, `linkedinUrl`, `githubUsername`, or
  `adminNote` in the public view-model or the `/r` page. The public read
  function must not even `select` them. Double-check the RSC payload contains no
  contact fields.
- DO NOT reuse `get-public-profile.ts` / `/students/[id]` (they expose LinkedIn
  + GitHub). This is a separate anonymized artifact.
- DO NOT add a PDF library, headless browser, or Blob storage. PDF = browser
  `window.print()` + Tailwind `print:` utilities only.
- DO NOT pass functions, Lucide icons, Dates, or class instances across the
  Server→Client boundary. The admin panel receives plain JSON; the `/r` page
  mounts the client `PrintButton` with no props.
- DO NOT use `<Button asChild>` / `<Button render={<Link>}>` — `buttonVariants`
  on `<Link>`/`<button>`.
- DO NOT use `any`. Ratings are `number | null`, validated 1–5 server-side.
- DO NOT use `include` — `select` only. Multi-write admin actions wrapped in
  `prisma.$transaction`; each writes an `AdminAction` audit row.
- DO NOT log via `console.*` — use `lib/logger.ts` for caught errors.
- DO NOT block publishing on completion status — any student can be reviewed and
  published at admin discretion (publishing is itself the recruiter-visibility
  gate).

## 7. DB safety (schema change)
1. **Checkpoint:** `git add -A && git commit -m "checkpoint before recruiter review migration"`. Note the hash.
2. **Neon branch snapshot** before migrating.
3. **Migrate:** `npx prisma migrate dev --name add_recruiter_review`.
4. **Regenerate client:** `npx prisma generate`.
5. No backfill needed — reviews are created on first save; `shareToken` on first
   publish. Existing data untouched.
6. `npm run build` to confirm migration + types.

## 8. Verification
Manual (local, `ENABLE_DEV_AUTH=true`):
1. `npm run dev`. As `admin@abtalks.dev`, open a student
   (`/admin/students/<id>`) → new "Recruiter Profile" tab.
2. Set the three 1–5 ratings, a headline, summary, a couple of strengths and
   recommended roles, and a private admin note. Save → toast; reload shows the
   values persisted.
3. Click "Publish recruiter profile" → a `/r/<token>` link appears with Copy +
   Preview. Open Preview in a new tab (or incognito / logged-out):
   - The page shows the name, domain, college, skills, ratings (stars),
     curated content, and ABTalks stats.
   - **No email, phone, LinkedIn, or GitHub appears anywhere.** View source /
     RSC payload to confirm contact fields aren't present.
   - The admin note does NOT appear.
4. Click "Download PDF" → the browser print dialog opens; "Save as PDF"
   produces a clean one-pager (button + any chrome hidden, colors preserved,
   fits A4).
5. "Regenerate link" → the old `/r/<oldtoken>` now 404s; the new link works.
   "Unpublish" → the link 404s until re-published.
6. Logged-out access to a published `/r/<token>` works (no redirect to
   `/login`); an unpublished or unknown token 404s.
7. As a logged-in student/admin, visiting `/r/<token>` shows no student bottom
   nav (suppressed).
8. **Build/typecheck:** `npm run lint`, `npm run build`, `tsc --noEmit` clean.

Files that should change (and only these): the schema, the 6 new files, and the
2 edited files in §3.

## 9. Commit message
```
feat(recruiter): admin review + shareable anonymized profile with PDF

Admins can rate a student (Confidence/Coding/Communication, 1–5), add a private
note and curated content (headline, summary, strengths, recommended roles), and
publish an ABTalks-branded recruiter profile at a tokenized public link
(/r/<token>). The page hides all direct-contact details (email, phone, LinkedIn,
GitHub) so recruiters connect through ABTalks, and offers a print-to-PDF
download. New RecruiterReview model; publish/unpublish/regenerate-link with
audit rows. No new dependencies.

Migration: add_recruiter_review.
```
