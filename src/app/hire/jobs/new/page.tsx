import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { requireRecruiterWorkspace } from "@/features/recruiter-workspace/workspace";
import { JobFormClient } from "@/components/hire/jobs/job-form-client";

export default async function RecruiterNewJobPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/talent/login?from=/hire/jobs/new");

  const workspace = await requireRecruiterWorkspace();
  if (!workspace.ok) {
    return (
      <div className="hire-jobs">
        <p className="hire-jobs__error">{workspace.message}</p>
      </div>
    );
  }

  return <JobFormClient company={workspace.data.company} />;
}
