import Link from "next/link";
import { JobForm } from "@/components/admin/job-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDateIST } from "@/lib/date-utils";
import { getJobsAdmin } from "@/features/jobs/get-jobs-admin";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import type { JobType } from "@prisma/client";

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

export default async function AdminJobsPage() {
  const jobs = await getJobsAdmin();

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Jobs"
        description="Post roles and review applications. Recruiter-owned jobs stay on their workspace."
      />

      <JobForm mode="create" />

      <div className="space-y-4">
        <h2 className="font-display text-xl font-semibold">All jobs</h2>
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No jobs posted yet.</p>
        ) : (
          <ul className="grid gap-3">
            {jobs.map((job) => (
              <li
                key={job.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/admin/jobs/${job.id}`}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {job.title}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {job.company}
                    {job.location ? ` · ${job.location}` : null} ·{" "}
                    {jobTypeLabel(job.type)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {job._count.applications} applicants ·{" "}
                    {formatDateIST(job.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={job.isOpen ? "default" : "secondary"}>
                    {job.isOpen ? "Open" : "Closed"}
                  </Badge>
                  <Link
                    href={`/admin/jobs/${job.id}`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    Manage
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
