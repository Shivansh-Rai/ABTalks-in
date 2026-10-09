import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { DashboardShell } from "@/components/dashboard-hub/dashboard-shell";
import { isCodingPracticeEnabled } from "@/lib/feature-flags";

/**
 * /practice, coding practice inside the candidate shell (plan 186).
 * Off unless ENABLE_CODING_PRACTICE=true. Each page guards its own session.
 */
export default async function PracticeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isCodingPracticeEnabled()) notFound();

  const session = await auth();
  const shellUser = {
    name: session?.user?.name ?? "",
    email: session?.user?.email ?? "",
    image: session?.user?.image ?? null,
  };
  return (
    <DashboardShell
      user={shellUser}
      isAdmin={session?.user?.isAdmin ?? false}
      showSectionNav={false}
      signedIn={Boolean(session?.user?.id)}
      collapsible
      startCollapsed
    >
      {children}
    </DashboardShell>
  );
}
