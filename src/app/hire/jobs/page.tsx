import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { requireRecruiterWorkspace } from "@/features/recruiter-workspace/workspace";
import { countApplicantsByJobIds, listRecruiterJobs } from "@/features/recruiter-jobs/service";
import {
  prismaApplicantStore,
  prismaJobStore,
} from "@/features/recruiter-jobs/prisma-store";
import { formatDateIST } from "@/lib/date-utils";
import { RecruiterJobsBoard } from "@/components/hire/jobs/recruiter-jobs-board";

export default async function RecruiterJobsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/talent/login?from=/hire/jobs");

  const workspace = await requireRecruiterWorkspace();
  if (!workspace.ok) {
    return (
      <div className="hire-jobs">
        <p className="hire-jobs__error">{workspace.message}</p>
      </div>
    );
  }

  const deps = {
    jobs: prismaJobStore(),
    applications: prismaApplicantStore(),
  };
  const result = await listRecruiterJobs(deps, { userId: workspace.data.userId });
  const jobs = result.ok ? result.data : [];
  const applicantCounts = await countApplicantsByJobIds(
    deps,
    jobs.map((job) => job.id),
  );

  return (
    <RecruiterJobsBoard
      jobs={jobs.map((job) => ({
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        workMode: job.workMode,
        type: job.type,
        status: job.status,
        applicantCount: applicantCounts[job.id] ?? 0,
        updatedLabel: formatDateIST(job.updatedAt),
      }))}
    />
  );
}
