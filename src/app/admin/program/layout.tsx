import { requireAdmin } from "@/lib/admin-auth";
import { ProgramAdminNav } from "@/components/program/program-admin-nav";

export default async function AdminProgramLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <ProgramAdminNav />
      {children}
    </div>
  );
}
