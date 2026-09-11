"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function MainShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHackathon =
    pathname === "/hackathon" || pathname.startsWith("/hackathon/");
  const isDashboardShellRoute =
    pathname === "/dashboard" || pathname === "/profile";
  const isLanding = pathname === "/";
  /**
   * `pb-16` below reserves room for the fixed mobile BottomNav. That component
   * returns null on /workshop (see its own hide list), so on this route the
   * padding was 64px of blank page under the footer and nothing else.
   */
  const isWorkshop =
    pathname === "/workshop" || pathname.startsWith("/workshop/");
  const isHire = pathname === "/hire" || pathname.startsWith("/hire/");

  useEffect(() => {
    document.body.classList.toggle("landing-page", isLanding);
    return () => document.body.classList.remove("landing-page");
  }, [isLanding]);

  // Design System v2 is light-only: every route, Marketplace and Hackathon
  // included, renders on the one forest-green light theme.
  return (
    <main
      className={cn(
        "theme-abtalks-light theme-abtalks-brand flex-1",
        !isHackathon &&
          !isDashboardShellRoute &&
          !isWorkshop &&
          !isHire &&
          "pb-16 md:pb-0",
      )}
    >
      {children}
    </main>
  );
}
