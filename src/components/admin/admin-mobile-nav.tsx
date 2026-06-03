"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  FileText,
  LayoutDashboard,
  Megaphone,
  Menu,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type IconName =
  | "overview"
  | "students"
  | "submissions"
  | "content"
  | "analytics"
  | "ambassadors";

const iconMap = {
  overview: LayoutDashboard,
  students: Users,
  submissions: FileText,
  content: BookOpen,
  analytics: BarChart3,
  ambassadors: Megaphone,
} as const;

type NavItem = {
  href: string;
  label: string;
  icon: IconName;
};

interface AdminMobileNavProps {
  navItems: NavItem[];
}

export function AdminMobileNav({ navItems }: AdminMobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="mb-2 flex items-center gap-2 md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-card"
        aria-label="Open admin menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40"
            aria-label="Close admin menu"
            onClick={() => setOpen(false)}
          />
          <div
            className={cn(
              "fixed inset-y-0 left-0 z-50 w-64 border-r bg-card p-4 shadow-xl transition-transform duration-200",
              open ? "translate-x-0" : "-translate-x-full",
            )}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold">Admin</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = iconMap[item.icon];
                const isActive =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                      isActive ? "bg-accent font-medium" : "hover:bg-accent/70",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-4 text-xs text-muted-foreground">
              Admin area is read-only for now.
            </div>
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="mt-2 block text-xs text-primary underline"
            >
              Back to student dashboard
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
