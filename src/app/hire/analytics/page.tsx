import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getRecruiterAnalytics } from "@/features/hire/recruiter-analytics";
import { RecruiterAnalyticsLoader } from "@/components/hire/recruiter-analytics-loader";

export const metadata: Metadata = {
  title: "Analytics | Hire with ABTalks",
  description: "Company-scoped hiring funnel metrics and project performance.",
};

export const dynamic = "force-dynamic";

/**
 * Recruiter analytics.
 *
 * Laid out like the admin analytics dashboard — a two-column grid of shadcn
 * Cards, one recharts chart each, and a full-width table card — but rendered
 * inside the Hire shell, so it keeps the recruiter header and sidebar rather
 * than the admin chrome.
 *
 * Reads the same `getRecruiterAnalytics` as before. No metric definition,
 * query or permission changed here; this file only reshapes what is already
 * returned into the series the charts take.
 */
export default async function RecruiterAnalyticsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/talent/login?from=/hire/analytics");
  }

  const result = await getRecruiterAnalytics();
  if (!result.ok) {
    return (
      <div className="hire-analytics hire-shell-wide text-center">
        <p className="text-sm text-red-600">{result.message}</p>
      </div>
    );
  }

  const { companyName, overview, recentProjects } = result.data;

  return (
    /* `hire-shell-wide` opts out of the shell's 880px prose measure — a
       dashboard is not prose. Padding comes from `.hire-shell__content`, the
       same as every other plain /hire page. */
    <div className="hire-analytics hire-shell-wide space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#03535F]">
          Company Workspace · {companyName}
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold md:text-3xl">
          Analytics
        </h1>
        <p className="text-muted-foreground">
          Sourcing, candidate pipeline, assessment and project metrics for your
          organization.
        </p>
      </div>

      <RecruiterAnalyticsLoader
        data={{
          funnel: [
            { label: "Discovered", count: overview.candidatesDiscovered },
            { label: "Viewed", count: overview.candidatesViewed },
            { label: "Shortlisted", count: overview.candidatesShortlisted },
            { label: "Contacted", count: overview.candidatesContacted },
          ],
          workspace: [
            { label: "Active Jobs", count: overview.activeJobs },
            { label: "Active Projects", count: overview.activeProjects },
            { label: "Applications", count: overview.applications },
          ],
          assessments: [
            { label: "Assigned", count: overview.testsAssigned },
            { label: "Completed", count: overview.testsCompleted },
          ],
          projects: recentProjects.map((p) => ({
            id: p.id,
            name: p.name,
            matched: p.matched,
            viewed: p.viewed,
            shortlisted: p.shortlisted,
          })),
        }}
      />
    </div>
  );
}
