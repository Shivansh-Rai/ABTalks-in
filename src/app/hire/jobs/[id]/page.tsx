import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { auth } from "@/auth";
import { requireRecruiterWorkspace } from "@/features/recruiter-workspace/workspace";
import { getRecruiterJob, listApplicantsForOwnedJob } from "@/features/recruiter-jobs/service";
import {
  prismaApplicantStore,
  prismaJobStore,
} from "@/features/recruiter-jobs/prisma-store";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDateIST } from "@/lib/date-utils";
import { JobLifecycleButtons } from "@/components/hire/jobs/job-lifecycle-buttons";
import { JobFormClient } from "@/components/hire/jobs/job-form-client";
import { JobApplicantsDesk } from "@/components/hire/jobs/job-applicants-desk";
import { JobApplicantsList } from "@/components/hire/jobs/job-applicants-list";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function RecruiterJobDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/talent/login?from=/hire/jobs/${id}`);
  }

  const workspace = await requireRecruiterWorkspace();
  if (!workspace.ok) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <p className="text-sm text-muted-foreground">{workspace.message}</p>
      </main>
    );
  }

  const deps = {
    jobs: prismaJobStore(),
    applications: prismaApplicantStore(),
  };
  const result = await getRecruiterJob(deps, { userId: workspace.data.userId }, id);
  if (!result.ok) notFound();
  const job = result.data;

  const applicantsRes = await listApplicantsForOwnedJob(
    deps,
    { userId: workspace.data.userId },
    id,
  );
  const applicants = applicantsRes.ok
    ? applicantsRes.data.map((row) => ({
        id: row.id,
        candidateRef: row.candidateRef,
        displayName: row.displayName,
        note: row.note,
        status: row.status,
        appliedLabel: formatDateIST(row.appliedAt),
      }))
    : [];

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <JobApplicantsDesk jobId={job.id} applicants={applicants}>
      <Link
        href="/hire/jobs"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-4")}
      >
        ← All jobs
      </Link>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{job.type}</Badge>
          <Badge
            variant={
              job.status === "PUBLISHED"
                ? "default"
                : job.status === "CLOSED"
                  ? "secondary"
                  : "outline"
            }
          >
            {job.status}
          </Badge>
          {job.workMode ? <Badge variant="outline">{job.workMode}</Badge> : null}
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {job.title}
        </h1>
        <p className="text-muted-foreground">
          {job.company}
          {job.location ? ` · ${job.location}` : null}
        </p>
        <p className="text-xs text-muted-foreground">
          {job.publishedAt
            ? `Published ${formatDateIST(job.publishedAt)}`
            : `Created ${formatDateIST(job.createdAt)}`}
          {job.closedAt ? ` · Closed ${formatDateIST(job.closedAt)}` : null}
        </p>
      </div>

      <div className="mt-6 rounded-xl border bg-card p-4">
        <JobLifecycleButtons jobId={job.id} status={job.status} />
        {job.status === "PUBLISHED" ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Candidates can see this job at{" "}
            <Link href={`/jobs/${job.id}`} className="underline">
              /jobs/{job.id}
            </Link>
            .
          </p>
        ) : job.status === "DRAFT" ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Draft — not visible to candidates. Direct URL access is refused
            server-side.
          </p>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            Closed — no new applications accepted. Reopen any time.
          </p>
        )}
      </div>

      <JobApplicantsList applicants={applicants} />

      {job.description ? (
        <div className="prose prose-sm dark:prose-invert mt-8 max-w-none [&_p]:mb-3">
          <ReactMarkdown>{job.description}</ReactMarkdown>
        </div>
      ) : null}

      <details className="mt-10 rounded-xl border bg-card p-4">
        <summary className="cursor-pointer text-sm font-medium">
          Edit job details
        </summary>
        <div className="mt-4">
          <JobFormClient
            jobId={job.id}
            initial={{
              title: job.title,
              description: job.description,
              location: job.location ?? "",
              workMode: job.workMode ?? "REMOTE",
              type: job.type,
              skills: job.skills,
              applyExternalUrl: job.applyExternalUrl ?? "",
            }}
          />
        </div>
      </details>
      </JobApplicantsDesk>
    </main>
  );
}
