# 020 — AI Talent Hunt (AI Cohort Training Program) public registration page

## 1. Goal
Build a **public marketing landing + 5-step application form** for the *AI Talent Hunt for
Working Professionals* (the "AI Cohort Training Program") at `/ai-talent-hunt`. It captures a
richer, USA-focused application across 5 sections (Personal → Professional → Story →
Commitment → Review) and stores each submission as one row in a **new `cohort_applications`
table in the existing isolated workshop Supabase project** — decoupled from the main
Neon/Prisma app, exactly like the sibling `/ai-workshop` page. Styled with the **main app
design system** (indigo/shadcn), not the orange→pink workshop brand. Confirmation email is
**out of scope for this pass** (success is shown on-screen; email wired later).

## 2. Current behavior
- The only comparable surface today is `/ai-workshop` (`src/app/ai-workshop/page.tsx`): a
  standalone marketing microsite with a **single-step** registration form. It stores rows in an
  **isolated Supabase project** (`src/lib/workshop-supabase.ts`, table `registrations`), sends a
  Brevo email (`src/lib/workshop-email.ts`), and posts via a public API route
  (`src/app/api/ai-workshop/register/route.ts`). Its visual style is bespoke inline-CSS
  orange→pink — **we are NOT copying that style.**
- The main app's registration (`src/app/register/registration-form.tsx`) is the idiom we WILL
  match visually and mechanically: **React Hook Form + `zodResolver` + shadcn** primitives
  (`Input`, `Label`, `Select`, `RadioGroup`, `Textarea`, `Card`, `Button`, `Badge`), Zod schema in
  `src/lib/validations/`, submit via a **Server Action** returning the `{ ok, ... }` envelope.
- Routing/shell facts (verified):
  - `middleware.ts` gates via an **allowlist** `protectedPaths` (`/dashboard`, `/challenge`,
    `/profile`, `/quiz`, `/register`, `/admin`, `/jobs`, `/mission`). Anything not listed is
    **public by default** → `/ai-talent-hunt` is public with no middleware change.
  - The root layout (`src/app/layout.tsx`) renders **no global app header**; it wraps everything
    in `MainShell` + `AppFooter` + `BottomNavGate`. `AppFooter` returns `null` on `/ai-workshop`
    (route allowlist). `BottomNavGate` renders only for **authenticated** sessions, so logged-out
    visitors (our audience) see no bottom nav.
- There is **no `checkbox` primitive** in `src/components/ui/` yet (needed for Step 4). There ARE
  `progress`, `textarea`, `select`, `radio-group`, `card`, `sonner` (toast).
- No cohort/talent-hunt code exists on `feature/ai-cohort-training` yet (branch is greenfield,
  zero diff vs `master`).

## 3. Files to touch
**New — page & sections (route `src/app/ai-talent-hunt/`)**
- `[new] src/app/ai-talent-hunt/page.tsx` — Server Component. Exports `metadata`; composes the
  marketing sections + the form; provides the page background (app tokens).
- `[new] src/components/talent-hunt/hero.tsx` — Server Component. Headline "AI Talent Hunt for
  Working Professionals", tagline "Learn. Build. Ship AI.", launch (15 Jul) / completion (30 Aug)
  chips, and a "Pre-assessment required" note (marketing copy only — see §6).
- `[new] src/components/talent-hunt/program-at-a-glance.tsx` — Server Component. 6 stat blocks:
  4 Core Modules · 30 Days Intensive · 4 Live Projects · 50 Seats (USA only) · 2 hrs/day ·
  1-on-1 Mentorship.
- `[new] src/components/talent-hunt/what-you-will-build.tsx` — Server Component. 4 module cards
  (AI Enterprise & Ecosystem; APIs, Microservices & AI Infrastructure; LLMs, Reasoning & Agentic
  AI; MCP, AI Security, MLOps & Adoption) with the sub-bullets from the doc.
- `[new] src/components/talent-hunt/who-this-is-for.tsx` — Server Component. Audience row
  (Engineers · Data Professionals · PMs · Architects · Consultants) + "USA-based working
  professionals serious about AI careers".
- `[new] src/components/talent-hunt/application-form.tsx` — **Client Component** (`"use client"`).
  The 5-step RHF wizard (the only interactive piece). Calls the Server Action.

**New — data & validation**
- `[new] src/lib/validations/cohort-application.ts` — Zod schema, dropdown enums, inferred type.
- `[new] src/app/actions/cohort-application-actions.ts` — `submitCohortApplicationAction` Server
  Action. Re-validates with Zod, lowercases email, dedupes, inserts into `cohort_applications`
  via `workshopSupabase`, returns the result envelope. Logs via `lib/logger.ts`.
- `[new] src/components/ui/checkbox.tsx` — add the shadcn checkbox primitive (see Step 0).

**Edits**
- `[edit] src/components/shared/app-footer.tsx` — add an `isTalentHunt` check
  (`pathname === "/ai-talent-hunt" || pathname.startsWith("/ai-talent-hunt/")`) and `return null`
  for it, exactly like the existing `isWorkshop` branch.
- `[edit] docs/project-context.md` — document the new public route, the `cohort_applications`
  Supabase table, and that email is deferred.

**Manual (not a repo file)**
- `[new]` SQL run once in the **workshop Supabase project** SQL editor (see §7).

> No Prisma model, no migration, no new API route, no change to `middleware.ts`,
> `auth.config.ts`, `auth.ts`, or `MainShell`.

## 4. Server vs Client
| Component | Type | Notes |
|---|---|---|
| `ai-talent-hunt/page.tsx` | **Server** | metadata + composition; no client props passed down except plain static content. |
| `hero.tsx`, `program-at-a-glance.tsx`, `what-you-will-build.tsx`, `who-this-is-for.tsx` | **Server** | Static marketing content. Lucide icons may be *rendered inside* these (fine); do NOT pass icons/functions **as props** across a boundary. |
| `application-form.tsx` | **Client** (`"use client"`) | RHF, step state, checkbox/select interactivity, calls the action. Self-contained — receives **no** function/icon props. |
| `cohort-application-actions.ts` | **Server module** (`"use server"`) | Imports `workshopSupabase`; never imported into an edge/middleware path. |
| `checkbox.tsx` | **Client** | shadcn primitive (base-ui). |

Boundary safety: the form is a leaf Client Component that takes **no props** (or only plain
strings/booleans if we later inject config). Marketing sections are pure Server Components. No
Server→Client function/icon/class-instance prop passing anywhere. ✅

## 5. Steps (file-by-file, no design decisions left to executor)

### Step 0 — Add the checkbox primitive
Run `npx shadcn@latest add checkbox`. Confirm it writes `src/components/ui/checkbox.tsx` and that
it uses the project's **base-ui** stack (consistent with `switch.tsx` / `radio-group.tsx`, which
import from `@base-ui/react`). **If** the CLI emits a Radix-based file that doesn't match the
base-nova preset, hand-author `checkbox.tsx` modeled on the existing `src/components/ui/switch.tsx`
using `@base-ui/react`'s `Checkbox`. Do not add `@radix-ui/react-checkbox`.

### Step 1 — Validation schema (`src/lib/validations/cohort-application.ts`)
Define enums with the **exact** option strings from the form doc, then the object schema. Use
`z.enum([...])` for every dropdown, `z.literal(true)` for each commitment checkbox.

```ts
import { z } from "zod";

export const VISA_CATEGORIES = [
  "US Citizen", "Permanent Resident (Green Card)", "H-1B", "H-4 EAD",
  "L-1 / L-2 EAD", "OPT (F-1)", "STEM OPT Extension", "CPT (F-1)", "O-1",
  "TN Visa (Canada/Mexico)", "E-3 (Australia)", "Other / Not applicable",
] as const;

export const EDUCATION_LEVELS = [
  "High School / GED", "Associate Degree",
  "Bachelor's Degree — Computer Science / Engineering", "Bachelor's Degree — Other Field",
  "Master's Degree — Computer Science / AI / Data Science", "Master's Degree — Other Field",
  "PhD — Computer Science / AI / Related", "PhD — Other Field",
  "Bootcamp / Self-taught", "Professional Certifications (AWS, GCP, Azure, etc.)",
] as const;

export const TOTAL_EXPERIENCE = [
  "Less than 1 year", "1–2 years", "3–5 years", "6–9 years", "10–15 years", "15+ years",
] as const;

export const AI_ML_EXPERIENCE = [
  "None — completely new to AI/ML", "Under 6 months (hobby / self-study)",
  "6–12 months", "1–2 years", "3–5 years", "5+ years",
] as const;

export const INDUSTRIES = [
  "Technology / Software", "Finance / FinTech / Banking", "Healthcare / Life Sciences",
  "Retail / E-commerce", "Manufacturing / Supply Chain", "Consulting / Advisory",
  "Government / Public Sector", "Education / Research", "Media / Entertainment", "Other",
] as const;

export const TARGET_ROLES = [
  "AI / ML Engineer", "MLOps / AI Platform Engineer", "AI Solutions Architect",
  "AI Product Manager", "AI Security Engineer", "Data Scientist moving into AI Engineering",
  "Enterprise AI Consultant", "AI Research Engineer", "Not sure yet — exploring options", "Other",
] as const;

export const START_WINDOWS = [
  "As soon as possible", "Within 2–4 weeks", "Within 1–2 months",
  "Flexible — ready whenever the cohort launches",
] as const;

const confirmed = z.literal(true, { error: "Please confirm to continue." });

export const cohortApplicationSchema = z.object({
  // Step 1 — Personal
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  linkedinUrl: z.string().trim().url("Enter a valid URL")
    .refine((v) => /linkedin\.com/i.test(v), "Enter your LinkedIn profile URL"),
  visaCategory: z.enum(VISA_CATEGORIES, { error: "Select an option" }),
  // Step 2 — Professional
  educationLevel: z.enum(EDUCATION_LEVELS, { error: "Select an option" }),
  totalExperience: z.enum(TOTAL_EXPERIENCE, { error: "Select an option" }),
  aiMlExperience: z.enum(AI_ML_EXPERIENCE, { error: "Select an option" }),
  currentTitleCompany: z.string().trim().min(1, "This field is required").max(200),
  industry: z.enum(INDUSTRIES, { error: "Select an option" }),
  primaryLanguagesTools: z.string().trim().min(1, "This field is required").max(300),
  // Step 3 — Story
  whyInterested: z.string().trim().min(50, "Please write at least a few sentences").max(2500),
  whatToAchieve: z.string().trim().min(50, "Please write at least a few sentences").max(2500),
  targetRole: z.enum(TARGET_ROLES, { error: "Select an option" }),
  // Step 4 — Commitment
  commitHours: confirmed,
  attendSessions: confirmed,
  understandPreCall: confirmed,
  basedInUsa: confirmed,
  readyForChallenge: confirmed,
  preferredStartWindow: z.enum(START_WINDOWS, { error: "Select an option" }),
});

export type CohortApplicationInput = z.infer<typeof cohortApplicationSchema>;
```
(`z.literal(true)` message syntax follows Zod v4, matching the codebase's `zod@^4`.)

### Step 2 — Server Action (`src/app/actions/cohort-application-actions.ts`)
Public (NO `auth()` / `requireRole`). Accept the typed object, re-validate, dedupe by email,
insert, return envelope. Reuse the existing `workshopSupabase` client.

```ts
"use server";

import { workshopSupabase } from "@/lib/workshop-supabase";
import { logger } from "@/lib/logger";
import {
  cohortApplicationSchema,
  type CohortApplicationInput,
} from "@/lib/validations/cohort-application";

export async function submitCohortApplicationAction(input: CohortApplicationInput) {
  const parsed = cohortApplicationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const { data: existing } = await workshopSupabase
    .from("cohort_applications")
    .select("id")
    .eq("email", d.email)
    .maybeSingle();
  if (existing) {
    return { ok: false as const, message: "You've already applied with this email." };
  }

  const { error } = await workshopSupabase.from("cohort_applications").insert({
    first_name: d.firstName,
    last_name: d.lastName,
    email: d.email,
    linkedin_url: d.linkedinUrl,
    visa_category: d.visaCategory,
    education_level: d.educationLevel,
    total_experience: d.totalExperience,
    ai_ml_experience: d.aiMlExperience,
    current_title_company: d.currentTitleCompany,
    industry: d.industry,
    primary_languages_tools: d.primaryLanguagesTools,
    why_interested: d.whyInterested,
    what_to_achieve: d.whatToAchieve,
    target_role: d.targetRole,
    commit_hours: d.commitHours,
    attend_sessions: d.attendSessions,
    understand_pre_call: d.understandPreCall,
    based_in_usa: d.basedInUsa,
    ready_for_challenge: d.readyForChallenge,
    preferred_start_window: d.preferredStartWindow,
  });
  if (error) {
    logger.error("cohort application insert failed", { error });
    return { ok: false as const, message: "Something went wrong. Please try again." };
  }
  return { ok: true as const };
}
```
(Confirm `lib/logger.ts` exposes `logger.error(msg, meta)`; if the signature differs, match it —
do NOT use `console.error`.)

### Step 3 — The 5-step wizard (`src/components/talent-hunt/application-form.tsx`)
- `"use client"`. `useForm<CohortApplicationInput>({ resolver: zodResolver(cohortApplicationSchema), mode: "onTouched", defaultValues: { …empty strings…, commitHours: false, … } })`.
- Local `const [step, setStep] = useState(1)` (1–5) and `const [submitted, setSubmitted] = useState(false)`.
- **Progress**: shadcn `<Progress value={(step/5)*100} />` + "Step N of 5 — <title>" label using
  `font-display`.
- **Per-step field groups** (drive `trigger()` before "Next"):
  - Step 1: `firstName, lastName, email, linkedinUrl, visaCategory`
  - Step 2: `educationLevel, totalExperience, aiMlExperience, currentTitleCompany, industry, primaryLanguagesTools`
  - Step 3: `whyInterested, whatToAchieve, targetRole`
  - Step 4: `commitHours, attendSessions, understandPreCall, basedInUsa, readyForChallenge, preferredStartWindow`
  - Step 5: review only (no inputs)
- "Next" handler: `const ok = await trigger(FIELDS[step]); if (ok) setStep(step + 1);`. "Back"
  decrements. Only Step 5 renders the real submit button.
- Field rendering mirrors `register/registration-form.tsx`:
  - Text inputs → `<Input {...register("firstName")} aria-invalid={!!errors.firstName} />` with
    `<Label>` + `errors.x && <p className="text-sm text-destructive">…</p>`.
  - Dropdowns → `<Controller>` + shadcn `<Select>` (`SelectTrigger/Value/Content/Item`), mapping
    over the enum arrays from Step 1.
  - Textareas (`whyInterested`, `whatToAchieve`) → shadcn `<Textarea rows={6}>` with the doc's
    placeholder text ("Tell us what brought you here…" / "Describe the specific outcome…") and a
    small live word-count helper (`text-xs text-muted-foreground`, "150–250 words recommended").
  - Commitments (Step 4) → 5 rows, each shadcn `<Checkbox>` (via `<Controller>`,
    `checked`/`onCheckedChange`) + the exact statement text, red inline error when unchecked on
    Next.
- **Review (Step 5)** — read-only summary grouped as the doc specifies (Personal Information /
  Professional Background / Your Story / Commitment ["All 5 confirmed" ✓] / Target Role), then a
  "By submitting, you confirm all information provided is accurate and complete." line, then the
  **Submit Application →** `<Button>`.
- **Submit** (`handleSubmit(onSubmit)`): `setIsSubmitting(true)` → `await submitCohortApplicationAction(values)`
  → on `!ok` `toast.error(res.message)` (sonner) → on `ok` `setSubmitted(true)`. Wrap in
  `try/finally` to reset `isSubmitting`.
- **Success screen** (when `submitted`): replace the card with a centered success state — check
  icon (`lucide-react` `CircleCheck`), "Application received", body: *"Our team will review your
  application and email you to schedule your 30-minute pre-cohort call. Seats are limited (50,
  USA only) — keep an eye on your inbox."* No redirect, no email in this pass.
- Card styling: `Card` / `bg-card` / `rounded-xl` / `shadow-card`, `max-w-2xl mx-auto`,
  indigo primary buttons — consistent with the app. Optional `framer-motion` fade between steps
  (already a dep; mirror the `AnimatePresence` usage in `register/registration-form.tsx`).

### Step 4 — Marketing sections & page
- Build `hero.tsx`, `program-at-a-glance.tsx`, `what-you-will-build.tsx`, `who-this-is-for.tsx`
  as **static Server Components** using app tokens (`bg-background`, `text-foreground`,
  `text-muted-foreground`, `bg-primary`, `font-display` for headings, `Card`, `Badge`). Content
  verbatim from the form doc (§ "PROGRAM AT A GLANCE", "WHAT YOU WILL BUILD", "WHO THIS IS FOR").
- `page.tsx` (Server Component):
  ```tsx
  export const metadata: Metadata = {
    title: "AI Talent Hunt for Working Professionals | ABTalks",
    description:
      "A 30-day intensive AI cohort for USA-based working professionals. 4 core modules, 4 live projects, 1-on-1 mentorship. 50 seats. Apply now.",
  };
  export default function AITalentHuntPage() {
    return (
      <div className="min-h-screen bg-background">
        <Hero />
        <ProgramAtAGlance />
        <WhatYouWillBuild />
        <WhoThisIsFor />
        <section id="apply" className="px-4 py-16"><ApplicationForm /></section>
      </div>
    );
  }
  ```
  Hero CTA button is a `buttonVariants`-styled `<a href="#apply">` (NOT `<Button asChild>`).

### Step 5 — Hide the app footer on this route
In `src/components/shared/app-footer.tsx`, alongside `isWorkshop`, add:
```ts
const isTalentHunt =
  pathname === "/ai-talent-hunt" || pathname.startsWith("/ai-talent-hunt/");
if (isWorkshop || isTalentHunt) return null;
```

### Step 6 — Docs
Update `docs/project-context.md`: add `/ai-talent-hunt` to public routes; note the
`cohort_applications` table in the workshop Supabase project (source of truth for applications);
note confirmation email is deferred.

## 6. Guardrails for Cursor (DO NOT)
- **Public surface** — do NOT add `auth()`, `requireRole`, or `requireAdmin` anywhere in this
  feature, and do NOT add `/ai-talent-hunt` to `protectedPaths` in `middleware.ts`. It must be
  reachable logged-out.
- **Storage** — do NOT touch the main Neon/Prisma DB, `prisma/schema.prisma`, or run any
  migration. Applications go ONLY to the workshop Supabase `cohort_applications` table via the
  existing `workshopSupabase` client.
- **Mutations via Server Action, not an API route** — do NOT create `src/app/api/.../route.ts`
  for this. (The `/ai-workshop` API route is the old pattern; we deliberately match the main
  app's Server-Action convention here.)
- **Do NOT copy the workshop's orange→pink inline-CSS style.** Use app tokens + shadcn only.
- **Server vs Client** — keep the 4 marketing sections as Server Components; only
  `application-form.tsx` and `checkbox.tsx` are `"use client"`. Never pass a function, Lucide
  icon, or class instance as a prop from a Server Component into a Client Component.
- **Pre-assessment is NOT part of this form.** The doc's "Pre-assessment required" is marketing
  copy only — do NOT invent assessment/quiz questions or steps. The application is exactly the 5
  steps specified.
- **No phone field.** The doc's Step 1 has no phone — do not add one (unlike `/ai-workshop`).
- **Buttons/links** — style links with `buttonVariants` on the `<a>`/`<Link>`; never
  `<Button asChild>` or `<Button render={<Link>}>` (Base UI semantics).
- **Logging** — use `lib/logger.ts`, not `console.error`.
- **Strict TS / Zod** — no `any`; Zod validates at the action boundary and via `zodResolver` in
  the form. Enum option strings must match the doc EXACTLY (they double as stored values).
- **Checkbox** — prefer `npx shadcn@latest add checkbox`; if it conflicts with the base-ui
  preset, hand-author from `switch.tsx`. Do NOT pull in `@radix-ui/react-checkbox`.
- **Confirm** files were actually written and `npm run build` + `npx tsc --noEmit` pass before
  reporting done (Cursor has silently skipped writes before).

## 7. DB safety (Supabase — manual, run by the user; NOT Prisma)
This is a **new table in the workshop's own Supabase project** (separate from Neon). Run once in
that project's SQL editor. **Match the RLS posture of the existing `registrations` table** — if
`registrations` has RLS disabled (or an anon insert/select policy), do the same here, otherwise
the anon-key insert/dedupe in the Server Action will silently fail.

```sql
create table if not exists cohort_applications (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null,
  linkedin_url text not null,
  visa_category text not null,
  education_level text not null,
  total_experience text not null,
  ai_ml_experience text not null,
  current_title_company text not null,
  industry text not null,
  primary_languages_tools text not null,
  why_interested text not null,
  what_to_achieve text not null,
  target_role text not null,
  commit_hours boolean not null default false,
  attend_sessions boolean not null default false,
  understand_pre_call boolean not null default false,
  based_in_usa boolean not null default false,
  ready_for_challenge boolean not null default false,
  preferred_start_window text not null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

-- one application per email (case-insensitive)
create unique index if not exists cohort_applications_email_key
  on cohort_applications (lower(email));
```
If `registrations` uses an explicit anon policy rather than RLS-off, mirror it:
```sql
alter table cohort_applications enable row level security;
create policy "anon insert" on cohort_applications for insert to anon with check (true);
create policy "anon read"   on cohort_applications for select to anon using (true);
```
The owner reads/exports applications from the Supabase dashboard (no admin UI in this pass).

## 8. Verification
- `npm run build` and `npx tsc --noEmit` pass.
- Visit `/ai-talent-hunt` **logged out** → page renders, no auth redirect, no app header/footer/
  bottom-nav; marketing sections + Step 1 of the form visible.
- Walk all 5 steps: per-step "Next" blocks on invalid/empty fields with inline errors; Step 4
  blocks until all 5 checkboxes are checked; Step 5 shows the correct review summary.
- Submit → success screen appears; a row lands in Supabase `cohort_applications` with all fields
  populated and `status = 'new'`.
- Re-submit the same email → friendly "already applied" toast, no duplicate row.
- Confirm it renders correctly in both light and dark (tokens) and at 390px width (mobile).
- Files changed exactly: `src/app/ai-talent-hunt/page.tsx`, `src/components/talent-hunt/*` (5),
  `src/components/ui/checkbox.tsx`, `src/lib/validations/cohort-application.ts`,
  `src/app/actions/cohort-application-actions.ts`, `src/components/shared/app-footer.tsx`,
  `docs/project-context.md` — plus the manual Supabase table.

## 9. Commit message
```
feat(ai-talent-hunt): public 5-step cohort application page + Supabase storage

Adds /ai-talent-hunt marketing landing and a 5-step (Personal, Professional,
Story, Commitment, Review) application form for the AI Cohort Training Program.
Submissions are stored in a new cohort_applications table in the isolated
workshop Supabase project via a Server Action; styled with the main app design
system. Confirmation email deferred to a later pass.
```
