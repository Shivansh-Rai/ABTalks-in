import { PlatformRole, RoleScopeType } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { PlatformConfigPanel } from "@/components/admin/platform-config-panel";
import { PlatformAdminsPanel } from "@/components/admin/platform-admins-panel";
import {
  CONTACT_UNLOCK_COST_KEY,
  MOCK_FREE_ALLOWANCE_KEY,
  MOCK_POINT_COST_KEY,
  STARTING_GRANT_KEY,
  getIntConfig,
} from "@/lib/platform-config";

export const metadata = { title: "Settings | Admin" };

export default async function AdminSettingsPage() {
  await requireAdmin();

  const [startingGrantMinor, unlockCostMinor, mockFreeAllowance, mockPointCost, admins] =
    await Promise.all([
      getIntConfig(STARTING_GRANT_KEY),
      getIntConfig(CONTACT_UNLOCK_COST_KEY),
      getIntConfig(MOCK_FREE_ALLOWANCE_KEY),
      getIntConfig(MOCK_POINT_COST_KEY),
      prisma.userRoleAssignment.findMany({
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
      }),
    ]);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Settings"
        description="Runtime configuration and who holds the Platform Admin role. There is no company-admin persona and no deactivate-platform control."
      />

      <PlatformConfigPanel
        values={{
          startingGrantMinor,
          unlockCostMinor,
          mockFreeAllowance,
          mockPointCost,
        }}
      />

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-[#353535]">
          Team & access
        </h2>
        <PlatformAdminsPanel
          admins={admins.map((r) => ({
            id: r.id,
            email: r.user.email,
            name: r.user.name,
            grantedAt: r.grantedAt.toISOString(),
          }))}
        />
      </section>
    </div>
  );
}
