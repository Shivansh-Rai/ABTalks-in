import { prisma } from "@/lib/db";
import { AdminRecruitersPanel } from "@/components/talent/admin-recruiters-panel";

export default async function AdminProgramRecruitersPage() {

  const pending = await prisma.recruiterProfile.findMany({
    where: { approved: false },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      fullName: true,
      company: true,
      phone: true,
      createdAt: true,
      user: { select: { email: true } },
    },
  });

  const rows = pending.map((p) => ({
    id: p.id,
    fullName: p.fullName,
    company: p.company,
    phone: p.phone,
    createdAt: p.createdAt.toISOString(),
    email: p.user.email,
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Recruiters
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Approve recruiters for post-publish talent pool access.
        </p>
      </header>

      <AdminRecruitersPanel pending={rows} />
    </div>
  );
}
