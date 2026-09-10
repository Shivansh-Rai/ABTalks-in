import type { Metadata } from "next";
import { PlatformRole, RoleScopeType } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { PlatformAdminsPanel } from "@/components/admin/platform-admins-panel";

export const metadata: Metadata = {
  title: "Platform Admins | Admin",
};

export default async function PlatformAdminsPage() {
  await requireAdmin();

  const rows = await prisma.userRoleAssignment.findMany({
    where: {
      role: PlatformRole.ADMIN,
      scopeType: RoleScopeType.GLOBAL,
      revokedAt: null,
    },
    orderBy: { grantedAt: "asc" },
    select: {
      id: true,
      grantedAt: true,
      user: { select: { email: true, name: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Platform Admins
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Access is a database role. Grant and revoke take effect immediately —
          no deployment.
        </p>
      </div>
      <PlatformAdminsPanel
        admins={rows.map((r) => ({
          id: r.id,
          email: r.user.email,
          name: r.user.name,
          grantedAt: r.grantedAt.toISOString(),
        }))}
      />
    </div>
  );
}
