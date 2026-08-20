# 038 — Interviewer-Agent integration (screening interviews for ready students)

> No schema change, no migration. Branch: `git checkout -b feature/interviewer-agent-integration`.
>
> Context: **Interviewer-Agent** is a separate, standalone Next.js app (sibling
> repo, not this codebase) that runs live AI-voice JD/resume screening
> interviews — a recruiter posts a job, adds a candidate + resume text, the
> app computes a real eligibility match, and (if eligible) mints a one-off
> magic-link interview (`/i/<token>`, no login) for that candidate. It already
> exposes three HTTP endpoints this plan consumes. This plan wires it to
> ABTalks' existing "become discoverable to recruiters" moment
> (`StudentProfile.isReadyForInterview`, set when `daysCompleted` reaches 60 —
> see `docs/project-context.md` §5 "Ready for Interview"), which today has no
> consumer at all ("Recruiter side deferred to Phase 2 (post-launch)").
>
> Decisions locked with the user:
> - **Admin-triggered, not self-serve recruiter portal.** No recruiter
>   accounts exist in ABTalks (confirmed: the only public recruiter-facing
>   surface is `/r/<token>`, a read-only share page — see plans 010–016). For
>   v1, an ABTalks **admin**, viewing a ready student, creates the screening
>   interview on a recruiter's behalf. A self-serve recruiter trigger is a
>   later phase, not this plan.
> - **No new Prisma models, no new columns.** Interviewer-Agent is the system
>   of record for interviews. The student dashboard shows scheduled interviews
>   via a **live read** (server-to-server fetch by email) each page load —
>   never synced/duplicated into this DB. Zero drift risk, zero migration.
> - **Resume is pasted text, not the `resumeUrl` link.** Interviewer-Agent has
>   no PDF-fetch/parsing pipeline for that URL (by design — no new
>   dependency). The admin pastes resume text into the trigger dialog; this
>   is a manual step for v1, same as ABTalks' own resume field is a
>   paste-a-URL placeholder today.
> - **Fail-open everywhere on the dashboard side.** If Interviewer-Agent is
>   unreachable or misconfigured, the student dashboard must render normally
>   with no "Scheduled Interviews" section — never a broken page, never a
>   thrown error.
> - **Interviewer-Agent's own code is out of scope for this plan** — its three
>   endpoints below are already built and deployed. Nothing here modifies that
>   repo.

## 1. Goal
An ABTalks admin, viewing a `isReadyForInterview` student at
`/admin/students/[id]`, can pick a live Interviewer-Agent job, paste the
student's resume text, and create a screening interview. The resulting
candidate link is shown to the admin to hand off manually (no email send in
this plan). Separately, the student's own `/dashboard` shows a "Scheduled
Interviews" card listing any interviews Interviewer-Agent has for their email,
each linking out to `/i/<token>`.

## 2. The three Interviewer-Agent endpoints (already live, contract only)

**`GET {INTERVIEWER_AGENT_API_URL}/api/jobs?status=live`** — no auth (non-sensitive).
```
200 { jobs: Array<{ id: string; title: string; created_at: string }> }
```

**`POST {INTERVIEWER_AGENT_API_URL}/api/integrations/abtalks/interviews`**
Header: `x-abtalks-integration-secret: <ABTALKS_INTEGRATION_SECRET>`
Body: `{ jobId: string; candidate: { fullName: string; email: string; phone?: string }; resumeText: string }`
```
200 { ok: true; interviewId: string; url: string }        // url is absolute
401 { ok: false; message: "Unauthorized" }
422 { ok: false; message: string }   // below invite threshold -- show verbatim
409 { ok: false; message: string }   // job not live / no approved questions
```

**`GET {INTERVIEWER_AGENT_API_URL}/api/integrations/abtalks/candidate-interviews?email=<email>`**
Header: `x-abtalks-integration-secret: <ABTALKS_INTEGRATION_SECRET>`
```
200 { ok: true; interviews: Array<{ jobTitle: string; status: string; createdAt: string; expiresAt: string | null; url: string }> }
```
`status` is one of `invited | system_check | in_progress | submitted | scored | expired`.
Never returns scores, transcript, or evidence — candidates never see evaluation
results, same rule this repo already follows for its own students.

## 3. Files to touch

**New**
- `.env.example` `[edit]` — document the two new vars (see §6).
- `src/features/interviewer-agent/client.ts` `[new]` — server-only fetch
  wrapper for the three endpoints above. Every function returns the
  `{ ok: true, data } | { ok: false, message }` envelope; logs failures via
  `lib/logger.ts`; never throws.
- `src/app/actions/interviewer-agent-actions.ts` `[new]` — one Server Action,
  `createScreeningInterviewAction`, admin-gated.
- `src/components/admin/screening-interview-panel.tsx` `[new]` — client
  component: job picker + resume textarea + submit, shown inside the new
  admin tab.
- `src/components/dashboard/scheduled-interviews-card.tsx` `[new]` — server
  component (no client state needed), renders the list or nothing.

**Edited**
- `src/app/admin/students/[id]/page.tsx` `[edit]` — add a `TabsTrigger`
  value="interviews" + `TabsContent`; fetch live jobs + this student's
  existing scheduled interviews in the existing `Promise.all`.
- `src/app/dashboard/page.tsx` `[edit]` — fetch scheduled interviews
  alongside the existing `heatmapData`/`quizAvailability`/`quizHistory`
  `Promise.all` (around line 287); render the new card.

**Not touched:** `prisma/schema.prisma`, `middleware.ts`, any Interviewer-Agent
file (different repo, different `CLAUDE.md`, out of scope here), the
gamification Synergy feature, `/r/[token]`.

## 4. Server vs Client
- `client.ts`, `interviewer-agent-actions.ts` — **Server-only**. `client.ts`
  reads `process.env.INTERVIEWER_AGENT_API_URL` /
  `process.env.ABTALKS_INTEGRATION_SECRET` directly — never imported from a
  Client Component or `middleware.ts` (would blow the Edge bundle like any
  other `@/lib/*`-style import; same rule as the rest of this app).
- `screening-interview-panel.tsx` — **Client** (`"use client"`). Receives the
  live jobs list as a plain serializable prop (`{id,title}[]`) fetched
  server-side by the page — the panel itself does not call Interviewer-Agent
  directly, only the Server Action.
- `scheduled-interviews-card.tsx` — **Server**. Receives the already-fetched
  interviews array as a prop; no client interactivity needed (each row is
  just a `<Link>` out to Interviewer-Agent).

## 5. Step-by-step changes

### 5.1 `src/features/interviewer-agent/client.ts` (new)
```ts
import "server-only";
import { logger } from "@/lib/logger";

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

function baseUrl() {
  const url = process.env.INTERVIEWER_AGENT_API_URL;
  if (!url) throw new Error("INTERVIEWER_AGENT_API_URL not configured");
  return url.replace(/\/$/, "");
}
function secret() {
  const s = process.env.ABTALKS_INTEGRATION_SECRET;
  if (!s) throw new Error("ABTALKS_INTEGRATION_SECRET not configured");
  return s;
}

export interface InterviewerAgentJob {
  id: string;
  title: string;
  createdAt: string;
}

export async function listLiveJobs(): Promise<Result<InterviewerAgentJob[]>> {
  try {
    const res = await fetch(`${baseUrl()}/api/jobs?status=live`, {
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, message: `Interviewer-Agent returned ${res.status}` };
    const json = await res.json();
    const jobs = (json.jobs ?? []).map((j: { id: string; title: string; created_at: string }) => ({
      id: j.id,
      title: j.title,
      createdAt: j.created_at,
    }));
    return { ok: true, data: jobs };
  } catch (e) {
    logger.error("interviewer-agent.listLiveJobs failed", { error: e });
    return { ok: false, message: "Could not reach Interviewer-Agent" };
  }
}

export interface CreateScreeningInterviewInput {
  jobId: string;
  fullName: string;
  email: string;
  phone?: string;
  resumeText: string;
}

export async function createScreeningInterview(
  input: CreateScreeningInterviewInput,
): Promise<Result<{ url: string }>> {
  try {
    const res = await fetch(`${baseUrl()}/api/integrations/abtalks/interviews`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-abtalks-integration-secret": secret(),
      },
      body: JSON.stringify({
        jobId: input.jobId,
        candidate: { fullName: input.fullName, email: input.email, phone: input.phone },
        resumeText: input.resumeText,
      }),
      cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      return { ok: false, message: json.message ?? `Interviewer-Agent returned ${res.status}` };
    }
    return { ok: true, data: { url: json.url } };
  } catch (e) {
    logger.error("interviewer-agent.createScreeningInterview failed", { error: e });
    return { ok: false, message: "Could not reach Interviewer-Agent" };
  }
}

export interface ScheduledInterview {
  jobTitle: string;
  status: string;
  createdAt: string;
  expiresAt: string | null;
  url: string;
}

// Fail-open by design: callers (the dashboard) must render normally even if
// this returns an empty array because Interviewer-Agent is unreachable.
export async function getScheduledInterviews(email: string): Promise<ScheduledInterview[]> {
  try {
    const res = await fetch(
      `${baseUrl()}/api/integrations/abtalks/candidate-interviews?email=${encodeURIComponent(email)}`,
      { headers: { "x-abtalks-integration-secret": secret() }, cache: "no-store" },
    );
    if (!res.ok) return [];
    const json = await res.json();
    if (!json.ok) return [];
    return json.interviews ?? [];
  } catch (e) {
    logger.error("interviewer-agent.getScheduledInterviews failed", { error: e });
    return [];
  }
}
```
`listLiveJobs`/`createScreeningInterview` return the envelope (admin flow
should surface real errors); `getScheduledInterviews` does not (dashboard
flow must fail silently — see §2 decision).

### 5.2 `src/app/actions/interviewer-agent-actions.ts` (new)
```ts
"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { createScreeningInterview } from "@/features/interviewer-agent/client";

const inputSchema = z.object({
  targetUserId: z.string().min(1),
  jobId: z.string().min(1),
  resumeText: z.string().min(1).max(20000),
});

export async function createScreeningInterviewAction(input: {
  targetUserId: string;
  jobId: string;
  resumeText: string;
}) {
  const admin = await requireAdmin();
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Invalid input" };
  const { targetUserId, jobId, resumeText } = parsed.data;

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { email: true, studentProfile: { select: { fullName: true, phone: true } } },
  });
  if (!target?.email || !target.studentProfile?.fullName) {
    return { ok: false as const, message: "Student profile incomplete" };
  }

  const result = await createScreeningInterview({
    jobId,
    fullName: target.studentProfile.fullName,
    email: target.email,
    phone: target.studentProfile.phone ?? undefined,
    resumeText,
  });
  if (!result.ok) return { ok: false as const, message: result.message };

  await prisma.adminAction.create({
    data: {
      adminUserId: admin.userId,
      targetUserId,
      actionType: "CREATE_SCREENING_INTERVIEW",
      metadata: { jobId, url: result.data.url },
    },
  });

  return { ok: true as const, url: result.data.url };
}
```
No transaction needed (single non-DB side effect + one audit-log insert, not
multiple related writes) — matches the pattern of `grantSynergyAction`, the
simplest existing action in `admin-actions.ts`, more than the heavier
multi-table ones.

### 5.3 `src/components/admin/screening-interview-panel.tsx` (new)
Client component, same conventions as `student-action-panel.tsx` (`useState`
for pending + form fields, `sonner` `toast`, `Button`/`Textarea`/`Select`
from `@/components/ui/*`, no `<Button asChild>`).
- Props: `studentId: string`, `jobs: { id: string; title: string }[]`.
- State: `jobId` (Select, default first job or empty), `resumeText`
  (Textarea), `pending`, `resultUrl: string | null`.
- Submit → `createScreeningInterviewAction({ targetUserId: studentId, jobId, resumeText })`.
  - `ok: true` → `toast.success("Screening interview created")`,
    `setResultUrl(result.url)` (render it as a copyable link/input below the
    form — this is what the admin hands to the recruiter), `router.refresh()`.
  - `ok: false` → `toast.error(result.message)` (surface the real message,
    e.g. the below-threshold match percentage — do not swallow it).
- If `jobs.length === 0`: render "No live jobs in Interviewer-Agent yet" and
  disable the form instead of showing an empty picker.

### 5.4 `src/components/dashboard/scheduled-interviews-card.tsx` (new)
Server component, plain function (not async — data already fetched by the
page), same `Card`/`Badge`/`buttonVariants` primitives as the rest of
`dashboard/page.tsx`.
```tsx
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDateIST } from "@/lib/date-utils";
import type { ScheduledInterview } from "@/features/interviewer-agent/client";

function statusLabel(status: string): string {
  if (status === "invited") return "Awaiting you";
  if (status === "system_check" || status === "in_progress") return "In progress";
  if (status === "submitted" || status === "scored") return "Completed";
  if (status === "expired") return "Expired";
  return status;
}

export function ScheduledInterviewsCard({ interviews }: { interviews: ScheduledInterview[] }) {
  if (interviews.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scheduled Interviews</CardTitle>
        <CardDescription>Screening interviews recruiters have set up for you</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {interviews.map((iv) => (
          <div
            key={iv.url}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/25 px-4 py-3"
          >
            <div>
              <p className="font-medium">{iv.jobTitle}</p>
              <p className="text-xs text-muted-foreground">
                Scheduled {formatDateIST(new Date(iv.createdAt))}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{statusLabel(iv.status)}</Badge>
              {iv.status === "invited" || iv.status === "system_check" ? (
                <a
                  href={iv.url}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(buttonVariants({ variant: "default", size: "sm" }), "gap-1")}
                >
                  Start <ExternalLink className="size-3" />
                </a>
              ) : null}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```
Renders `null` (nothing) for zero interviews — never an empty-state card
cluttering every student's dashboard.

### 5.5 `src/app/admin/students/[id]/page.tsx` (edit)
- Import `listLiveJobs`, `getScheduledInterviews` from
  `@/features/interviewer-agent/client`, and the new
  `ScreeningInterviewPanel` component.
- Extend the existing `Promise.all([getStudentDetail(id), getRecruiterReview(id)])`
  (line 45) to a `Promise.all([getStudentDetail(id), getRecruiterReview(id), listLiveJobs(), getScheduledInterviews(?)])`
  — but `data.user.email` isn't known until `getStudentDetail` resolves, so
  this one can't join the same `Promise.all`; fetch it right after, in
  parallel with nothing (or restructure into two sequential `Promise.all`
  batches — first `[getStudentDetail, getRecruiterReview, listLiveJobs]`,
  then `getScheduledInterviews(data.user.email)` once `data` is known).
- Add a `TabsTrigger value="interviews">Screening Interview</TabsTrigger>`
  next to the existing `recruiter` trigger, and a matching `TabsContent`:
  - If `!data.profile.isReadyForInterview`: short muted note — "Student isn't
    marked ready for interview yet."
  - Else: existing scheduled interviews for this student (reuse
    `ScheduledInterviewsCard`-style list, or a simpler inline list — admin
    already sees full status, no need to duplicate the exact component) above
    the `<ScreeningInterviewPanel studentId={data.student.userId} jobs={jobsResult.ok ? jobsResult.data : []} />`.
  - If `listLiveJobs()` failed (`ok: false`): show its `message` in a muted
    banner instead of the panel.

### 5.6 `src/app/dashboard/page.tsx` (edit)
- Import `getScheduledInterviews` and `ScheduledInterviewsCard`.
- Add it to the existing `Promise.all` at line 287 (`heatmapData`,
  `quizAvailability`, `quizHistory`) — fourth entry:
  `getScheduledInterviews(session.user.email ?? "")`. If `session.user.email`
  is falsy this returns `[]` from the client (empty string won't match any
  candidate row) — no special-casing needed.
- Render `<ScheduledInterviewsCard interviews={scheduledInterviews} />` in
  `<main>`, placed after the "Today's Task" card (~line 466), before the
  stats grid — this is the same neighborhood as the existing
  `isReadyForInterview` messaging at line 377, so a ready student sees both
  together.

## 6. Environment variables
Add to `.env.example` and the real `.env`/Vercel project settings:
```
# Interviewer-Agent integration (screening interviews)
INTERVIEWER_AGENT_API_URL="http://localhost:3001"   # Interviewer-Agent's own base URL
ABTALKS_INTEGRATION_SECRET="generate-a-long-random-shared-secret"  # must match Interviewer-Agent's env of the same name
```
The secret is a shared value — generate one long random string and set it
identically in both apps' environments (dev and prod separately). Never
commit the real value.

## 7. Guardrails for Cursor (DO NOT)
- DO NOT call `createScreeningInterview`, `listLiveJobs`, or
  `getScheduledInterviews` from a Client Component or from `middleware.ts` —
  server-only, holds a secret. `client.ts` must start with `import "server-only"`.
- DO NOT surface `ABTALKS_INTEGRATION_SECRET` to the browser in any form
  (props, JSON in a script tag, etc.).
- DO NOT let a Interviewer-Agent failure break `/dashboard`. `getScheduledInterviews`
  must catch everything and return `[]` — never let it throw into the page.
- DO NOT add a Prisma model, column, or migration for this. The dashboard
  read is live, every page load, by design (see §2 decision).
- DO NOT build an email-send step in this plan — the admin hands the link to
  the recruiter manually. That's a later fast-follow, not here.
- DO NOT touch any file under Interviewer-Agent's repo — different codebase,
  different `CLAUDE.md`, not in scope.
- DO NOT use `<Button asChild>`; use `buttonVariants` directly on `<Link>`/`<a>`.
- DO NOT use `console.*` — `lib/logger.ts` only.
- DO NOT skip Zod on `createScreeningInterviewAction`'s input.

## 8. Verification
1. Set both env vars locally, pointing `INTERVIEWER_AGENT_API_URL` at a
   running local Interviewer-Agent instance with a matching
   `ABTALKS_INTEGRATION_SECRET` and at least one **live** job (status=live,
   approved core questions).
2. As `admin@abtalks.dev`: open a `Day 60, COMPLETED, isReadyForInterview`
   test student (e.g. Meera — see `docs/project-context.md` §11) →
   "Screening Interview" tab → pick the job, paste a plausible resume →
   Create. Confirm a link comes back and `AdminAction` gets a
   `CREATE_SCREENING_INTERVIEW` row.
3. Log in as that same test student (their `@abtalks.dev` credentials) →
   `/dashboard` → confirm the "Scheduled Interviews" card shows the job title
   and an "Awaiting you" badge with a working "Start" link to Interviewer-Agent's `/i/<token>`.
4. Temporarily set `ABTALKS_INTEGRATION_SECRET` to a wrong value → reload
   `/dashboard` → confirm the page still renders fully, just without the
   Scheduled Interviews card (fail-open check).
5. For a student who is NOT ready for interview: confirm the admin tab shows
   the "not marked ready" note instead of the form, and their own dashboard
   shows no card.
6. `npm run lint`, `npm run build`, `tsc --noEmit` clean.

Files that should change (and only these): `.env.example` + the 6 files in §3.

## 9. Commit message
```
feat(interviewer-agent): admin-triggered screening interviews + student dashboard visibility

Wires the standalone Interviewer-Agent app into ABTalks' existing
isReadyForInterview moment. An admin, viewing a ready student, can now create
a JD/resume-matched screening interview via Interviewer-Agent's API (job
picker + pasted resume text) and hand the resulting link to a recruiter. The
student's own dashboard shows a "Scheduled Interviews" card via a live,
fail-open read from Interviewer-Agent by email -- no new schema, no data
duplication, no sync job. Two new env vars: INTERVIEWER_AGENT_API_URL,
ABTALKS_INTEGRATION_SECRET (shared secret, server-to-server only).
```
