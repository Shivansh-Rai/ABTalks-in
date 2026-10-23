import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getEmailNotificationPreferences } from "@/features/notification/email-preferences";
import { NotificationPreferencesForm } from "@/components/settings/notification-preferences-form";

export default async function NotificationSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const preferences = await getEmailNotificationPreferences(session.user.id);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold mb-2">Notification Settings</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Choose which email notifications you receive. In-app notifications are
        always on.
      </p>
      <NotificationPreferencesForm preferences={preferences} />
    </main>
  );
}
