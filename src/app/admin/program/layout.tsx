import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin-auth";
import { listAdminCohorts } from "@/features/program/admin";
import { ProgramAdminNav } from "@/components/program/program-admin-nav";
import { ProgramCohortSwitcher } from "@/components/program/program-cohort-switcher";

export default async function AdminProgramLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  const cohorts = await listAdminCohorts();

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <ProgramAdminNav />
      </Suspense>
      <Suspense fallback={null}>
        <ProgramCohortSwitcher
          cohorts={cohorts.map((c) => ({
            id: c.id,
            name: c.name,
            status: c.status,
            joinCode: c.joinCode,
          }))}
        />
      </Suspense>
      {children}
    </div>
  );
}
