import { requireAdmin } from "@/lib/admin-auth";
import { AppHeader } from "@/components/shared/app-header";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminMobileNav } from "@/components/admin/admin-mobile-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();

  const navItems = [
    { href: "/admin", label: "Overview", icon: "overview" as const },
    { href: "/admin/students", label: "Students", icon: "students" as const },
    { href: "/admin/ai-cohort", label: "AI Cohort", icon: "cohort" as const },
    { href: "/admin/submissions", label: "Submissions", icon: "submissions" as const },
    { href: "/admin/jobs", label: "Jobs", icon: "jobs" as const },
    { href: "/admin/content", label: "Content", icon: "content" as const },
    { href: "/admin/analytics", label: "Analytics", icon: "analytics" as const },
    {
      href: "/admin/campus-ambassadors",
      label: "Campus Ambassadors",
      icon: "ambassadors" as const,
    },
    { href: "/admin/referrals", label: "Referrals", icon: "referrals" as const },
    { href: "/admin/redemptions", label: "Redemptions", icon: "redemptions" as const },
  ];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        user={{
          name: admin.name ?? "Admin",
          email: admin.email ?? "admin@local",
          image: null,
          role: "ADMIN",
          isAdmin: true,
        }}
      />
      <div className="flex">
        <div className="sticky top-14 hidden min-h-[calc(100vh-3.5rem)] w-64 shrink-0 flex-col border-r bg-card px-4 py-6 md:flex">
          <AdminSidebar navItems={navItems} />
        </div>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8">
          <AdminMobileNav navItems={navItems} />
          {children}
        </main>
      </div>
    </div>
  );
}
