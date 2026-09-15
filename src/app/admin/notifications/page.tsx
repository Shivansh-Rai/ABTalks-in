import { requireAdmin } from "@/lib/admin-auth";
import { NotificationComposer } from "@/components/admin/notification-composer";
import { NotificationsTable } from "@/components/admin/notifications-table";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { getAdminNotifications } from "@/features/notification/admin-data";

export default async function AdminNotificationsPage() {
  await requireAdmin();
  const rows = await getAdminNotifications();

  return (
    <div className="space-y-4 md:space-y-6">
      <AdminPageHeader
        title="Communications"
        description="In-app announcements. Email delivery is on Delivery Log. There is no SMS channel."
      />

      <NotificationComposer />

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Pushed announcements</h2>
        <NotificationsTable rows={rows} />
      </div>
    </div>
  );
}
