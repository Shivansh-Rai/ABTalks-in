import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashboardShell } from "@/components/dashboard-hub/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDateIST } from "@/lib/date-utils";
import { listMyApplications } from "@/features/candidate-jobs/service";
import { prismaApplicationStore } from "@/features/candidate-jobs/prisma-store";
import { prismaJobStore } from "@/features/recruiter-jobs/prisma-store";

function statusVariant(status: string) {
  if (status === "ACCEPTED") return "default" as const;
  if (status === "REJECTED") return "secondary" as const;
  if (status === "REVIEWING") return "outline" as const;
  return "outline" as const;
}

export default async function MyApplicationsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?from=/jobs/my");
  }

  const res = await listMyApplications(
    { jobs: prismaJobStore(), applications: prismaApplicationStore() },
    { userId: session.user.id },
  );
  const applications = res.ok ? res.data : [];

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
          <h1 className="font-display text-3xl font-bold tracking-tight">
            My applications
          </h1>
          <Link
            href="/jobs"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Browse jobs
          </Link>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Your submitted applications, newest first. Status changes when the
          recruiter updates the pipeline.
        </p>

        {applications.length === 0 ? (
          <div className="mt-10 rounded-xl border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              You haven&apos;t applied to any jobs yet.
            </p>
            <Link
              href="/jobs"
              className={cn(buttonVariants({}), "mt-4 inline-flex")}
            >
              See open roles
            </Link>
          </div>
        ) : (
          <ul className="mt-8 grid gap-3">
            {applications.map((app) => (
              <li key={app.id}>
                <Link
                  href={`/jobs/${app.jobId}`}
                  className="block rounded-xl border bg-card p-5 shadow-sm transition-colors hover:border-primary/30 hover:bg-card/80"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-lg font-semibold">
                          {app.job.title}
                        </h2>
                        <Badge variant={statusVariant(app.status)}>
                          {app.status}
                        </Badge>
                        {!app.job.isOpen ? (
                          <Badge variant="secondary">Job closed</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {app.job.company}
                        {app.job.location ? ` · ${app.job.location}` : null}
                        {app.job.workMode ? ` · ${app.job.workMode}` : null}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Applied {formatDateIST(app.createdAt)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </DashboardShell>
  );
}
