"use client";

import { usePathname } from "next/navigation";
import {
  DashboardShell,
  type DashboardShellUser,
} from "@/components/dashboard-hub/dashboard-shell";
import { PRACTICE_BASE } from "@/features/coding-practice/constants";

/**
 * The candidate shell for /practice. The coding workspace
 * (/practice/<challenge>/<day>/<slot>) fills the screen, so it gets no footer
 * at any width; the day list keeps the shell footer.
 */
export function PracticeShell({
  user,
  isAdmin,
  signedIn,
  children,
}: {
  user: DashboardShellUser;
  isAdmin: boolean;
  signedIn: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const depth = pathname
    .slice(PRACTICE_BASE.length)
    .split("/")
    .filter(Boolean).length;
  const isWorkspace = depth >= 3;

  return (
    <DashboardShell
      user={user}
      isAdmin={isAdmin}
      showSectionNav={false}
      signedIn={signedIn}
      showFooter={!isWorkspace}
      collapsible
      startCollapsed
    >
      {children}
    </DashboardShell>
  );
}
