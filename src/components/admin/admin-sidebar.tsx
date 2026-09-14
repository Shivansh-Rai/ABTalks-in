"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  Code2,
  FileText,
  Gift,
  GraduationCap,
  LayoutDashboard,
  Link2,
  Megaphone,
  Package,
  ShieldCheck,
  FolderSearch,
  Presentation,
  UserPlus,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

type IconName =
  | "overview"
  | "notifications"
  | "students"
  | "submissions"
  | "jobs"
  | "content"
  | "analytics"
  | "ambassadors"
  | "referrals"
  | "hackathonLinks"
  | "redemptions"
  | "dataRequests"
  | "program"
  | "cohort"
  | "hackathon"
  | "workshop"
  | "recruiters"
  | "talentProjects"
  | "platformAdmins";

const iconMap = {
  overview: LayoutDashboard,
  notifications: Bell,
  students: Users,
  submissions: FileText,
  jobs: Briefcase,
  content: BookOpen,
  analytics: BarChart3,
  ambassadors: Megaphone,
  referrals: Gift,
  hackathonLinks: Link2,
  redemptions: Package,
  dataRequests: ShieldCheck,
  program: GraduationCap,
  cohort: GraduationCap,
  hackathon: Code2,
  workshop: Presentation,
  recruiters: UserPlus,
  talentProjects: FolderSearch,
  platformAdmins: ShieldCheck,
} as const;

type NavItem = {
  href: string;
  label: string;
  icon: IconName;
};

interface AdminSidebarProps {
  navItems: NavItem[];
}

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar({ navItems }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full flex-col">
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const Icon = iconMap[item.icon];
          const isActive = isNavActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "abt-nav-item gap-3 px-4",
                isActive ? "abt-nav-active" : "abt-nav-idle",
              )}
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-border pt-4">
        <Link
          href="/dashboard"
          className="text-xs text-primary hover:underline"
        >
          ← Back to student portal
        </Link>
      </div>
    </aside>
  );
}
