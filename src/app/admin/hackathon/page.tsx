import { requireAdmin } from "@/lib/admin-auth";
import { HackathonView } from "@/components/admin/hackathon-view";
import { getAdminData } from "@/features/hackathon/get-admin-data";

export default async function AdminHackathonPage() {
  await requireAdmin();
  const data = await getAdminData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hackathon</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Registrations, roster export, and problem statement.
        </p>
      </div>
      <HackathonView data={data} />
    </div>
  );
}
