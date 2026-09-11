import { listRecruiters } from "@/features/talent-pool/recruiter-registration";
import { AdminRecruitersPanel } from "@/components/talent/admin-recruiters-panel";

export default async function AdminProgramRecruitersPage() {
  const recruiters = await listRecruiters();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Recruiters
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everyone registered for post-publish talent pool access.
        </p>
      </header>

      <AdminRecruitersPanel recruiters={recruiters} />
    </div>
  );
}
