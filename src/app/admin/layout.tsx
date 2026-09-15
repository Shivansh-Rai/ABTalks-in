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

  return (
    <div className="min-h-screen bg-[#F7FBFB]">
      <AppHeader
        user={{
          name: admin.name ?? "Admin",
          email: admin.email ?? "admin@local",
          image: null,
          role: "ADMIN",
          isAdmin: true,
        }}
      />
      <div className="flex md:h-[calc(100vh-55px)] md:overflow-hidden">
        <div className="scrollbar-admin-brand hidden w-[250px] shrink-0 border-r border-[#E9E9E9] bg-white md:block md:h-full md:overflow-y-auto">
          <div className="flex min-h-full flex-col px-3 py-6">
            <AdminSidebar />
          </div>
        </div>
        <main className="scrollbar-admin-brand min-w-0 flex-1 px-4 py-6 md:overflow-y-auto md:px-10">
          <AdminMobileNav />
          {children}
        </main>
      </div>
    </div>
  );
}
