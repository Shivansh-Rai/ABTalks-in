import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { listRecruiters } from "@/features/talent-pool/recruiter-registration";
import { AdminRecruitersPanel } from "@/components/talent/admin-recruiters-panel";
import {
  RecruiterSeatsPanel,
  type SeatRow,
} from "@/components/admin/recruiter-seats-panel";

export const metadata: Metadata = {
  title: "Recruiters | Admin",
};

export default async function AdminRecruitersPage() {
  await requireAdmin();

  const [recruiters, seats] = await Promise.all([
    listRecruiters(),
    prisma.verifiedRecruiterSeat.findMany({
      orderBy: [{ active: "desc" }, { verifiedAt: "desc" }],
      take: 500,
      select: {
        id: true,
        email: true,
        company: true,
        contactName: true,
        active: true,
        notes: true,
        verifiedAt: true,
      },
    }),
  ]);

  const users = await prisma.user.findMany({
    where: { email: { in: seats.map((s) => s.email) } },
    select: { email: true },
  });
  const withAccount = new Set(users.map((u) => u.email));

  const seatRows: SeatRow[] = seats.map((s) => ({
    id: s.id,
    email: s.email,
    company: s.company,
    contactName: s.contactName,
    active: s.active,
    notes: s.notes,
    verifiedAt: s.verifiedAt.toISOString(),
    hasAccount: withAccount.has(s.email),
  }));

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Recruiters
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everyone who has registered to hire, and the work emails we have
          pre-verified. Registering opens a workspace immediately — there is no
          approval step.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">
          All recruiters
          {recruiters.length > 0 ? ` (${recruiters.length})` : ""}
        </h2>
        <AdminRecruitersPanel recruiters={recruiters} />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Verified emails</h2>
        <RecruiterSeatsPanel seats={seatRows} />
      </section>
    </div>
  );
}
