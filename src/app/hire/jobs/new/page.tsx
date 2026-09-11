import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { requireRecruiterWorkspace } from "@/features/recruiter-workspace/workspace";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { JobFormClient } from "@/components/hire/jobs/job-form-client";

export default async function RecruiterNewJobPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/talent/login?from=/hire/jobs/new");

  const workspace = await requireRecruiterWorkspace();
  if (!workspace.ok) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <p className="text-sm text-muted-foreground">{workspace.message}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <Link
        href="/hire/jobs"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-4")}
      >
        ← All jobs
      </Link>
      <h1 className="font-display text-3xl font-bold tracking-tight">
        Write a job
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Posts as {workspace.data.company}. Saves as a draft — you publish it
        when you&apos;re ready.
      </p>

      <div className="mt-8 rounded-xl border bg-card p-6">
        <JobFormClient />
      </div>
    </main>
  );
}
