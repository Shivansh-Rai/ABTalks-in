import { listProjectsForAdmin } from "@/features/program/projects";
import { AdminProjectsPanel } from "@/components/program/admin-projects-panel";
import { resolveAdminProgramCohort } from "@/features/program/admin";

type Props = {
  searchParams: Promise<{ cohortId?: string }>;
};

export default async function AdminProgramProjectsPage({ searchParams }: Props) {
  const params = await searchParams;
  const cohort = await resolveAdminProgramCohort(params.cohortId);

  if (!cohort) {
    return (
      <p className="text-sm text-muted-foreground">No cohort configured.</p>
    );
  }

  const { ungraded, graded } = await listProjectsForAdmin(cohort.id);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Projects
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {cohort.name} — AI grading and overrides.
        </p>
      </header>

      <AdminProjectsPanel
        cohortId={cohort.id}
        ungraded={ungraded}
        graded={graded}
      />
    </div>
  );
}
