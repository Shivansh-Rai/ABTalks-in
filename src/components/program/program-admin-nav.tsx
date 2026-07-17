"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/program", label: "Overview" },
  { href: "/admin/program/members", label: "Members" },
  { href: "/admin/program/projects", label: "Projects" },
  { href: "/admin/program/interviews", label: "Interviews" },
  { href: "/admin/program/recruiters", label: "Recruiters" },
  { href: "/admin/program/content", label: "Content" },
];

export function ProgramAdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 border-b pb-4">
      {TABS.map((tab) => {
        const active =
          tab.href === "/admin/program"
            ? pathname === "/admin/program"
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
