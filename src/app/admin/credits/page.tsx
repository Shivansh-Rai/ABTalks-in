import { requireAdmin } from "@/lib/admin-auth";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { StatCard } from "@/components/admin/stat-card";
import { PlatformConfigPanel } from "@/components/admin/platform-config-panel";
import { getCreditsConsole } from "@/features/admin/get-credits-console";
import {
  CONTACT_UNLOCK_COST_KEY,
  MOCK_FREE_ALLOWANCE_KEY,
  MOCK_POINT_COST_KEY,
  STARTING_GRANT_KEY,
  getIntConfig,
} from "@/lib/platform-config";
import { formatDateTimeIST } from "@/lib/date-utils";
import { Coins, Users } from "lucide-react";

export const metadata = { title: "Credits & Plans | Admin" };

function usdFromMinor(minor: number): string {
  return (minor / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export default async function AdminCreditsPage() {
  await requireAdmin();
  const [data, startingGrantMinor, unlockCostMinor, mockFreeAllowance, mockPointCost] =
    await Promise.all([
      getCreditsConsole(),
      getIntConfig(STARTING_GRANT_KEY),
      getIntConfig(CONTACT_UNLOCK_COST_KEY),
      getIntConfig(MOCK_FREE_ALLOWANCE_KEY),
      getIntConfig(MOCK_POINT_COST_KEY),
    ]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Credits & Plans"
        description="Starting grant and unlock cost are runtime config. Balances are the ledger — they are not overwritten here."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Recruiter workspaces"
          value={data.recruiterCount}
          accent="blue"
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Credits spent (all time)"
          value={usdFromMinor(data.spentMinor)}
          accent="green"
          icon={<Coins className="h-4 w-4" />}
        />
      </div>

      <PlatformConfigPanel
        values={{
          startingGrantMinor,
          unlockCostMinor,
          mockFreeAllowance,
          mockPointCost,
        }}
      />

      <section className="overflow-hidden rounded-xl border border-[#E9E9E9] bg-white">
        <div className="border-b border-[#E9E9E9] px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-[#353535]">
            Recent ledger
          </h2>
        </div>
        {data.latest.length === 0 ? (
          <p className="px-5 py-8 text-sm text-[#787878]">No credit movements yet.</p>
        ) : (
          <ul className="divide-y divide-[#E9E9E9]">
            {data.latest.map((row) => (
              <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3 text-sm">
                <div>
                  <p className="font-medium text-[#353535]">
                    {row.recruiter.recruiterProfile?.fullName ||
                      row.recruiter.name ||
                      row.recruiter.email}
                  </p>
                  <p className="text-xs text-[#787878]">
                    {row.recruiter.recruiterProfile?.company} · {row.type}
                  </p>
                  <p className="text-xs text-[#787878]">{row.reason}</p>
                </div>
                <div className="text-right">
                  <p
                    className={
                      row.amount < 0 ? "font-medium text-[#D92D20]" : "font-medium text-[#197E23]"
                    }
                  >
                    {row.amount < 0 ? "" : "+"}
                    {usdFromMinor(row.amount)}
                  </p>
                  <p className="text-xs text-[#8F8F8F]">
                    {usdFromMinor(row.balanceAfter)} after
                  </p>
                  <p className="text-xs text-[#8F8F8F]">
                    {formatDateTimeIST(row.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
