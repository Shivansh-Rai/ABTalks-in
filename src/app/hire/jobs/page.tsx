import Link from "next/link";
import { redirect } from "next/navigation";
import { JobStatus } from "@prisma/client";
import { auth } from "@/auth";
import { requireRecruiterWorkspace } from "@/features/recruiter-workspace/workspace";
import { listRecruiterJobs } from "@/features/recruiter-jobs/service";
import { prismaJobStore } from "@/features/recruiter-jobs/prisma-store";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDateIST } from "@/lib/date-utils";

function statusVariant(status: JobStatus) {
  if (status === "PUBLISHED") return "default" as const;
  if (status === "CLOSED") return "secondary" as const;
  return "outline" as const;
}

export default async function RecruiterJobsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/talent/login?from=/hire/jobs");

  const workspace = await requireRecruiterWorkspace();
  if (!workspace.ok) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <p className="text-sm text-muted-foreground">{workspace.message}</p>
      </main>
    );
  }

  const result = await listRecruiterJobs(
    { jobs: prismaJobStore() },
    { userId: workspace.data.userId },
  );
  const jobs = result.ok ? result.data : [];

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-[40px] leading-[48px] font-bold tracking-normal max-md:text-[32px] max-md:leading-[36px]">
            Your jobs
          </h1>
          <p className="mt-1 text-[17px] leading-7 text-muted-foreground max-md:text-base max-md:leading-[25px]">
            Draft roles stay private until you publish them. Close a role to
            stop accepting applications; reopen it any time.
          </p>
        </div>
        <Link
          href="/hire/jobs/new"
          className={cn(buttonVariants({}))}
        >
          + New job
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="mt-10 rounded-xl border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No jobs yet. Write your first role and save it as a draft.
          </p>
          <Link
            href="/hire/jobs/new"
            className={cn(buttonVariants({}), "mt-4 inline-flex")}
          >
            Write a job
          </Link>
        </div>
      ) : (
        <ul className="mt-8 grid gap-3">
          {jobs.map((job) => (
            <li key={job.id}>
              <Link
                href={`/hire/jobs/${job.id}`}
                className="block rounded-xl border bg-card p-5 shadow-sm transition-colors hover:border-primary/30 hover:bg-card/80"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="font-heading text-[20px] leading-[26px] font-semibold">
                        {job.title}
                      </h2>
                      <Badge variant={statusVariant(job.status)}>
                        {job.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {job.company}
                      {job.location ? ` · ${job.location}` : null}
                      {job.workMode ? ` · ${job.workMode}` : null}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Updated {formatDateIST(job.updatedAt)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
