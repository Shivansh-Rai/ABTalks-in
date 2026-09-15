import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { StatCard } from "@/components/admin/stat-card";
import { getDeliveryLog } from "@/features/admin/get-delivery-log";
import { formatDateTimeIST } from "@/lib/date-utils";
import { AlertTriangle, Mail, Pause } from "lucide-react";

export const metadata = { title: "Delivery Log | Admin" };

export default async function AdminDeliveryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const { status: raw } = await searchParams;
  const status =
    raw === "SENT" || raw === "FAILED" || raw === "SKIPPED" ? raw : undefined;
  const data = await getDeliveryLog(status);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Delivery Log"
        description="Outbound email attempts. Recipient addresses are hashed and never shown here."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Sent"
          value={data.sent}
          accent="green"
          icon={<Mail className="h-4 w-4" />}
        />
        <StatCard
          label="Failed"
          value={data.failed}
          accent="orange"
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <StatCard
          label="Skipped"
          value={data.pending}
          accent="blue"
          icon={<Pause className="h-4 w-4" />}
        />
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {[
          { href: "/admin/delivery", label: "All" },
          { href: "/admin/delivery?status=SENT", label: "Sent" },
          { href: "/admin/delivery?status=FAILED", label: "Failed" },
          { href: "/admin/delivery?status=SKIPPED", label: "Skipped" },
        ].map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="rounded-full border border-[#E9E9E9] bg-white px-3 py-1.5 hover:border-[#03535F] hover:text-[#03535F]"
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <section className="overflow-x-auto rounded-xl border border-[#E9E9E9] bg-white">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="border-b border-[#E9E9E9] text-xs uppercase tracking-[0.06em] text-[#8F8F8F]">
            <tr>
              <th className="px-5 py-3 font-medium">When</th>
              <th className="px-5 py-3 font-medium">Kind</th>
              <th className="px-5 py-3 font-medium">Channel</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Failure</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-[#787878]">
                  No delivery rows.
                </td>
              </tr>
            ) : (
              data.rows.map((row) => (
                <tr key={row.id} className="border-b border-[#E9E9E9] last:border-0">
                  <td className="px-5 py-3 text-[#787878]">
                    {formatDateTimeIST(row.createdAt)}
                  </td>
                  <td className="px-5 py-3 font-medium text-[#353535]">{row.kind}</td>
                  <td className="px-5 py-3">{row.channel}</td>
                  <td className="px-5 py-3">
                    <span
                      className={
                        row.status === "SENT"
                          ? "rounded-full bg-[#18D39B]/10 px-2 py-0.5 text-xs font-medium text-[#197E23]"
                          : row.status === "FAILED"
                            ? "rounded-full bg-[#D92D20]/10 px-2 py-0.5 text-xs font-medium text-[#D92D20]"
                            : "rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                      }
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="max-w-xs truncate px-5 py-3 text-[#787878]">
                    {row.failureReason ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
