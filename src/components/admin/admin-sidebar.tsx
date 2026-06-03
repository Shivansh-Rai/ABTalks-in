"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, FileText, LayoutDashboard, Megaphone, Users } from "lucide-react";
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

interface AdminSidebarProps {
  navItems: NavItem[];
}

export function AdminSidebar({ navItems }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden space-y-1 md:block">
      {navItems.map((item) => {
        const Icon = iconMap[item.icon];
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
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
    </aside>
  );
}
