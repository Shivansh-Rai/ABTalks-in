import { auth } from "@/auth";
import { DashboardShell } from "@/components/dashboard-hub/dashboard-shell";
import "@/components/course/course.css";

/**
 * /learn, free, text-first courses inside the candidate shell.
 * Public surface: readable signed out (like /mock-interviews); signing in only
 * adds the account chrome. Progress lives in the viewer's browser.
 */
export default async function LearnLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const signedIn = Boolean(session?.user?.id);
  const shellUser = {
    name: session?.user?.name ?? "",
    email: session?.user?.email ?? "",
    image: session?.user?.image ?? null,
  };
  return (
    <DashboardShell user={shellUser} isAdmin={session?.user?.isAdmin ?? false} showSectionNav={false} signedIn={signedIn} collapsible startCollapsed>
      {children}
    </DashboardShell>
  );
}
