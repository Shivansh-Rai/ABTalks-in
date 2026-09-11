import Link from "next/link";
import { redirect } from "next/navigation";
import { JobType, JobWorkMode } from "@prisma/client";
import { auth } from "@/auth";
import { DashboardShell } from "@/components/dashboard-hub/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDateIST } from "@/lib/date-utils";
import { browsePublishedJobs } from "@/features/candidate-jobs/service";
import { prismaApplicationStore } from "@/features/candidate-jobs/prisma-store";
import { prismaJobStore } from "@/features/recruiter-jobs/prisma-store";
import { JobFilters } from "@/components/jobs/job-filters";

function jobTypeLabel(type: JobType): string {
  switch (type) {
    case "FULL_TIME":
      return "Full-time";
    case "INTERNSHIP":
      return "Internship";
    case "CONTRACT":
      return "Contract";
    case "PART_TIME":
      return "Part-time";
    default:
      return type;
  }
}

const WORK_MODES = new Set<string>(Object.values(JobWorkMode));
const JOB_TYPES = new Set<string>(Object.values(JobType));

type Props = {
  searchParams: Promise<{
    location?: string;
    workMode?: string;
    type?: string;
    skills?: string;
  }>;
};

export default async function JobsPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const sp = await searchParams;
  const workMode =
    sp.workMode && WORK_MODES.has(sp.workMode)
      ? (sp.workMode as JobWorkMode)
      : undefined;
  const opportunityType =
    sp.type && JOB_TYPES.has(sp.type) ? (sp.type as JobType) : undefined;
  const skills = sp.skills
    ? sp.skills.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;
  const location = sp.location?.trim() || undefined;

  const result = await browsePublishedJobs(
    { jobs: prismaJobStore(), applications: prismaApplicationStore() },
    { location, workMode, opportunityType, skills },
  );
  const jobs = result.ok ? result.data : [];

  const shellUser = {
    name: session.user.name ?? session.user.email ?? "",
    email: session.user.email ?? "",
    image: session.user.image ?? null,
  };

  return (
    <DashboardShell
      user={shellUser}
      isAdmin={session.user.isAdmin ?? false}
      showSectionNav={false}
    >
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">
              Jobs
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Open roles from the ABTalks community and partners.
            </p>
          </div>
          <Link
            href="/jobs/my"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            My applications
          </Link>
        </div>

        <JobFilters />

        {jobs.length === 0 ? (
          <p className="mt-10 text-center text-muted-foreground">
            No open roles match those filters. Try clearing them.
          </p>
        ) : (
          <ul className="mt-8 grid gap-4">
            {jobs.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/jobs/${job.id}`}
                  className={cn(
                    "block rounded-xl border bg-card p-5 shadow-sm transition-colors hover:border-primary/30 hover:bg-card/80",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h2 className="font-display text-lg font-semibold">
                        {job.title}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {job.company}
                        {job.location ? ` · ${job.location}` : null}
                        {job.workMode ? ` · ${job.workMode}` : null}
                      </p>
                      {job.skills && job.skills.length > 0 ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {job.skills.slice(0, 6).join(" · ")}
                        </p>
                      ) : null}
                    </div>
                    <Badge variant="outline">{jobTypeLabel(job.type)}</Badge>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Posted {formatDateIST(job.createdAt)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </DashboardShell>
  );
}
