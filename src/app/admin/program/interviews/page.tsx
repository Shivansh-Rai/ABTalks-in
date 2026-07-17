import { AdminInterviewsPanel } from "@/components/program/admin-interviews-panel";
import { listInterviewsForAdmin } from "@/features/program/interview";
import { getAdminProgramCohort } from "@/features/program/admin";

export default async function AdminProgramInterviewsPage() {
  const cohort = await getAdminProgramCohort();

  if (!cohort) {
    return <p className="text-sm text-muted-foreground">No cohort configured.</p>;
  }

  const rows = await listInterviewsForAdmin(cohort.id);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Interviews
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {cohort.name} — voice exit interviews, transcripts, and re-evaluation.
        </p>
      </header>

      <AdminInterviewsPanel rows={rows} />
    </div>
  );
}
