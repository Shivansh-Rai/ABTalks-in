# 011 — Recruiter profile: beautify + branded wordmark + admin-curated resume sections

> Refines the shipped recruiter feature (plan 010). One schema migration (adds
> fields to the existing `RecruiterReview`). Branch:
> `git checkout -b feature/recruiter-profile-polish`.
>
> Decisions locked with the user:
> - **Logo:** a designed CSS **wordmark** (AB monogram + "ABTalks", brand
>   indigo/violet) — no image file.
> - **Beautify:** the public `/r/<token>` page currently reads as flat grey;
>   redesign it into a branded, polished one-pager using the app's tokens.
> - **Resume sections:** add **Projects, Education & marks, Achievements,
>   Certifications**, all **admin-typed** in the review form (resume stays a
>   pasted link; no PDF upload, no parsing, no LLM). Personal/contact info stays
>   hidden (still no email/phone/LinkedIn/GitHub; projects carry no links).

## 1. Goal
Make the recruiter-facing profile look intentional and on-brand, and let the
admin add curated resume highlights — Projects, Education & marks, Achievements,
Certifications — that render on the anonymized `/r/<token>` page and its PDF.

## 2. Context / current behavior (all shipped, plan 010)
- `src/app/r/[token]/page.tsx` — public Server Component. Functional but visually
  flat: `bg-white` + `text-muted-foreground` everywhere, outline badges, a plain
  text "ABTalks" header, no accent/hierarchy. Renders name, domain, ratings
  (text stars), summary, strengths, recommended roles, an "ABTalks-verified
  consistency" stats block, and skills. Mounts `./print-button.tsx`.
- `src/features/recruiter/get-recruiter-profile.ts` — public read by token;
  builds the anonymized view-model (no email/phone/LinkedIn/GitHub/adminNote).
- `src/features/recruiter/get-recruiter-review.ts` — admin read of the current
  review for the form.
- `src/app/actions/recruiter-review-actions.ts` — `upsertRecruiterReviewAction`
  (typed `input`), publish/unpublish/regenerate.
- `src/components/admin/recruiter-review-panel.tsx` — client form (ratings 1–5,
  headline, summary, strengths, recommendedRoles, adminNote, publish controls).
- `prisma/schema.prisma` `RecruiterReview` has ratings + headline/summary/
  strengths[]/recommendedRoles[]/adminNote + token/publish fields. **No**
  projects/education/achievements/certifications yet.
- Design tokens (from `globals.css`): `--primary` indigo `239 84% 67%`; domain
  utilities `domains-ai/ds/se` (+ `-bg`); `font-display` = Plus Jakarta. The
  app's gradient hero pattern is `bg-gradient-to-br from-primary to-violet-500
  text-primary-foreground` (used in the synergy popup).

## 3. Files to touch

**Schema**
- `prisma/schema.prisma` `[edit]` — add `projects Json?`, `education Json?`,
  `achievements String[]`, `certifications String[]` to `RecruiterReview`.

**New files**
- `src/lib/validations/recruiter.ts` `[new]` — Zod schemas + inferred types for
  the structured fields (Project, Education), shared by the action (write) and
  the read functions (parse). Justified shared module — not trivial inline.

**Edited files**
- `src/features/recruiter/get-recruiter-review.ts` `[edit]` — select + return
  the new fields (Json parsed to typed arrays; achievements/certifications as
  `string[]`).
- `src/features/recruiter/get-recruiter-profile.ts` `[edit]` — add the new
  fields to the public view-model (parsed/typed; no links in projects).
- `src/app/actions/recruiter-review-actions.ts` `[edit]` — validate + persist
  the new fields in `upsertRecruiterReviewAction`.
- `src/components/admin/recruiter-review-panel.tsx` `[edit]` — add form UI:
  repeatable Projects rows, repeatable Education rows, Achievements list,
  Certifications list.
- `src/app/r/[token]/page.tsx` `[edit]` — full visual redesign + CSS wordmark
  logo + render the four new sections.

**Not touched**
- `middleware.ts` — `/r` stays public.
- `print-button.tsx` — unchanged.
- `src/components/ui/*` — no primitive edits.

## 4. Server vs Client
- `validations/recruiter.ts`, `get-recruiter-review.ts`,
  `get-recruiter-profile.ts`, `recruiter-review-actions.ts` — **Server-only** /
  Server Actions. Json is Zod-parsed server-side into concrete types (no `any`).
- `recruiter-review-panel.tsx` — **Client**. Receives the review (incl. typed
  `projects`/`education` arrays, `achievements`/`certifications` string[]) as
  **plain serializable props**. No Date/function/icon crosses the boundary.
- `app/r/[token]/page.tsx` — **Server** (public). Renders typed arrays. Mounts
  the existing client `PrintButton`. The wordmark is pure server-rendered
  markup (no client needed).

## 5. Step-by-step changes

### 5.1 Schema (`prisma/schema.prisma`)
Add to `RecruiterReview`:
```prisma
  projects        Json?      // Array<{ title: string; description: string }>
  education       Json?      // Array<{ degree, institution, year?, score? }>
  achievements    String[]   @default([])
  certifications  String[]   @default([])
```
- Json (not child tables): these are small curated lists; Json keeps it simple.
  They are always validated via Zod on write and parsed via Zod on read, so the
  app never touches raw `any`.

### 5.2 `src/lib/validations/recruiter.ts` (new)
```ts
import { z } from "zod";

export const projectSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).default(""),
});
export const educationSchema = z.object({
  degree: z.string().trim().min(1).max(120),
  institution: z.string().trim().min(1).max(160),
  year: z.string().trim().max(20).default(""),     // "2025" or "2021–2025"
  score: z.string().trim().max(40).default(""),    // "8.4 CGPA" or "82%"
});

export const projectsSchema = z.array(projectSchema).max(8).default([]);
export const educationListSchema = z.array(educationSchema).max(6).default([]);
export const achievementsSchema = z.array(z.string().trim().min(1).max(160)).max(12).default([]);
export const certificationsSchema = z.array(z.string().trim().min(1).max(120)).max(12).default([]);

export type Project = z.infer<typeof projectSchema>;
export type Education = z.infer<typeof educationSchema>;

/** Safe parse helpers for reading Prisma Json (unknown) into typed arrays. */
export function parseProjects(value: unknown): Project[] {
  const r = projectsSchema.safeParse(value);
  return r.success ? r.data : [];
}
export function parseEducation(value: unknown): Education[] {
  const r = educationListSchema.safeParse(value);
  return r.success ? r.data : [];
}
```

### 5.3 `get-recruiter-review.ts` (edit, admin read)
- Add to the `select`: `projects`, `education`, `achievements`, `certifications`.
- In the normalized return, add:
  `projects: parseProjects(r?.projects)`, `education: parseEducation(r?.education)`,
  `achievements: r?.achievements ?? []`, `certifications: r?.certifications ?? []`.

### 5.4 `get-recruiter-profile.ts` (edit, public view-model)
- Add to the `RecruiterReview` `select`: `projects`, `education`, `achievements`,
  `certifications`.
- Extend `RecruiterProfileView` with:
  `projects: Project[]; education: Education[]; achievements: string[]; certifications: string[];`
- Populate via `parseProjects` / `parseEducation` and the string arrays.
- **Projects carry NO links** — the type has only title + description, so
  nothing identity-revealing leaks.

### 5.5 `recruiter-review-actions.ts` (edit)
- In `upsertRecruiterReviewAction`'s Zod input, add:
  `projects: projectsSchema`, `education: educationListSchema`,
  `achievements: achievementsSchema`, `certifications: certificationsSchema`.
- Persist `projects` and `education` as Json (pass the validated arrays directly
  — Prisma accepts JS arrays for `Json`); `achievements`/`certifications` as
  `string[]`.
- Keep the existing audit row + `reviewedByAdminId`/`reviewedAt`.

### 5.6 `recruiter-review-panel.tsx` (edit, admin UI)
Add four sub-sections to the form (keep existing ones):
- **Projects** — repeatable rows; each row = a `title` input + a `description`
  textarea + a remove button. An "Add project" button appends an empty row
  (cap 8). Stored as `Project[]` in component state.
- **Education & marks** — repeatable rows; each = `degree`, `institution`,
  `year`, `score` (CGPA/%) inputs + remove. "Add education" (cap 6).
- **Achievements** — tag/list input (Enter/comma to add a line; chips with
  remove), cap 12. Mirror the existing `strengths` tag pattern.
- **Certifications** — same tag/list pattern, cap 12.
- On Save, include `projects`, `education`, `achievements`, `certifications` in
  the `upsertRecruiterReviewAction` payload.
- Initialize state from the new props returned by `get-recruiter-review`.
- Use `useTransition`; no `<Button asChild>`.

### 5.7 `app/r/[token]/page.tsx` (edit) — visual redesign + wordmark + sections
Rebuild the page as a branded one-pager. Concrete spec (Cursor makes no design
choices):

**Page shell**
- Root: `min-h-svh bg-muted/30 text-foreground print:bg-white print:min-h-0
  [print-color-adjust:exact] [-webkit-print-color-adjust:exact]`.
- Centered card: `mx-auto max-w-3xl my-6 overflow-hidden rounded-2xl border
  bg-card shadow-sm print:my-0 print:rounded-none print:border-0 print:shadow-none`.

**Hero band (branded)**
- `bg-gradient-to-br from-primary to-violet-500 px-6 py-7 text-primary-foreground`.
- Top row: the **wordmark** (left) + a "Verified by ABTalks" pill (right,
  `bg-white/20 text-primary-foreground`).
  - Wordmark markup (inline, no new file): a rounded square monogram
    `inline-flex size-8 items-center justify-center rounded-lg bg-white/20
    font-display font-bold` containing `AB`, followed by
    `<span class="font-display text-xl font-bold tracking-tight">ABTalks</span>`.
- Candidate block: name `font-display text-3xl font-bold`; a row of badges —
  domain (use a light-on-gradient style, e.g. `bg-white/15 text-primary-foreground
  border-white/30`) and "Ready for interview" when true; the college/class or
  role@org line in `text-primary-foreground/80`; the `headline` (if any) in
  `text-primary-foreground/95 text-lg`.

**Body** (`px-6 py-6 space-y-8`)
- **Ratings** — a `grid gap-4 sm:grid-cols-3`; each rating in its own tinted
  card (`rounded-xl border bg-muted/30 p-3`) with the label, amber ★ row, and
  `N/5`. Keep the existing `StarRating`, just place each in a card. "Not rated"
  hidden tiles are fine.
- Helper for section headers: a small component/inline pattern — an
  `h2 font-display text-lg font-semibold` with a short `bg-primary` accent bar
  or a primary-tinted icon chip to the left (use Lucide icons rendered
  server-side: `FileText` Summary, `Sparkles` Strengths, `FolderGit2` Projects,
  `GraduationCap` Education, `Trophy` Achievements, `BadgeCheck` Certifications,
  `Target` Recommended roles, `Activity` Consistency, `Wrench` Skills).
- **Summary** (if present) — prose, `text-sm leading-relaxed`.
- **Key strengths** — chips (`Badge`), primary-tinted.
- **Projects** (if any) — a list; each project a `rounded-xl border p-3` with the
  `title` bold and `description` muted. **No links.**
- **Education & marks** (if any) — list of rows: `degree` bold, `institution`
  muted, with `year` and `score` as small chips/inline text.
- **Achievements** (if any) — a bulleted list (`list-disc`).
- **Certifications** (if any) — chips.
- **Recommended roles** — chips (secondary).
- **ABTalks-verified consistency** — keep the progress bar + streak/synergy
  stats, but in a tinted card with the `Activity` icon header. Frame the synergy
  line as "Community contribution".
- **Skills** — chips.

**Footer** (`border-t px-6 py-5`)
- Left: "Interested? Connect with this candidate through **ABTalks**." with the
  small wordmark.
- Right: `<PrintButton />` (already `print:hidden`).

**Print**
- Keep `[print-color-adjust:exact]`. Ensure the gradient hero still renders;
  if a tester reports the gradient dropping in print, fall back to a solid
  `print:bg-primary` on the hero. Constrain to A4 width (the `max-w-3xl` card).

**Empty states** — every new section renders only when it has content (same
conditional pattern already used for summary/strengths).

## 6. Guardrails for Cursor (DO NOT)
- DO NOT add `requireAdmin`/`requireRole`/`auth()` to `/r/[token]` or the public
  read — it stays **public**. Do NOT add `/r` to `middleware.ts` protectedPaths.
- DO NOT select or render email, phone, `linkedinUrl`, `githubUsername`, or
  `adminNote` anywhere in the public path. Projects have **no link field** —
  don't add one.
- DO NOT add Vercel Blob, a PDF parser, OCR, or any LLM call. Resume stays a
  pasted link; the four sections are admin-typed. (This plan adds none of that
  infra.)
- DO NOT store Json without Zod validation on write and Zod parsing on read.
  Never cast Prisma `Json` to a typed shape with `as` — go through
  `parseProjects`/`parseEducation`. No `any`.
- DO NOT pass functions, Lucide icon components, Dates, or class instances
  across the Server→Client boundary. The admin panel gets plain JSON; the `/r`
  page renders icons server-side (fine in RSC) and mounts `PrintButton` with no
  props.
- DO NOT use `<Button asChild>` / `<Button render={<Link>}>` — `buttonVariants`.
- DO NOT use `include` — `select` only. Multi-write admin actions stay wrapped
  in `prisma.$transaction` with an `AdminAction` audit row.
- DO NOT log via `console.*` — use `lib/logger.ts`.
- DO NOT introduce a new image asset or `next/image` for the logo — it's a CSS
  wordmark (the user chose this). Inline the wordmark markup; no new component
  file for it.
- DO NOT regress the existing fields (ratings, headline, summary, strengths,
  recommendedRoles, publish/token controls) — only add to them.

## 7. DB safety (schema change)
1. **Checkpoint:** `git add -A && git commit -m "checkpoint before recruiter sections migration"`. Note the hash.
2. **Neon branch snapshot** before migrating.
3. **Migrate:** `npx prisma migrate dev --name add_recruiter_review_sections`.
   - Adds `projects`/`education` (nullable Json) and `achievements`/
     `certifications` (`String[]` default `[]`). Existing rows: Json null,
     arrays empty. No backfill.
4. **Regenerate client:** `npx prisma generate`.
5. `npm run build` to confirm migration + types.

## 8. Verification
Manual (local, `ENABLE_DEV_AUTH=true`):
1. `npm run dev`. As `admin@abtalks.dev`, open a student → "Recruiter Profile"
   tab. Add 2 projects, 1–2 education rows (with CGPA/%), a few achievements and
   certifications, plus existing ratings/summary. Save → persists on reload.
2. Publish → open `/r/<token>` (incognito/logged-out):
   - The hero is a branded indigo→violet band with the **AB wordmark** and the
     "Verified by ABTalks" pill; the page looks designed, not flat grey.
   - Projects / Education & marks / Achievements / Certifications sections render
     with their content and icons; empty sections are hidden.
   - **No email/phone/LinkedIn/GitHub** anywhere; projects show no links; the
     admin note is absent. Confirm via page source / RSC payload.
3. "Download PDF" → clean branded one-pager; colors/gradient preserved; button
   hidden; fits A4.
4. Unpublish → `/r/<token>` 404s; regenerate link → old token 404s, new works.
5. **Light + dark** (admin preview) and mobile 390px: layout holds, no overflow.
6. **Build/typecheck:** `npm run lint`, `npm run build`, `tsc --noEmit` clean.

Files that should change (and only these): the schema, the 1 new validations
file, and the 5 edited files in §3.

## 9. Commit message
```
feat(recruiter): beautify public profile + branded wordmark + resume sections

Redesigns /r/<token> into a branded one-pager (gradient hero, AB wordmark,
icon section headers, carded ratings) using the app's tokens, and adds
admin-curated resume sections — Projects, Education & marks, Achievements,
Certifications — stored on RecruiterReview (Json + string[]), validated and
parsed via a shared Zod module. Still fully anonymized: no email/phone/LinkedIn/
GitHub, projects carry no links. No Blob/PDF-parsing/LLM; resume stays a link.

Migration: add_recruiter_review_sections.
```
