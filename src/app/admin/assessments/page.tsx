import { requireAdmin } from "@/lib/admin-auth";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { StatCard } from "@/components/admin/stat-card";
import { getAssessmentsConsole } from "@/features/admin/get-assessments-console";
import { formatDateIST } from "@/lib/date-utils";
import { ClipboardList, FileText, Pencil } from "lucide-react";

export const metadata = { title: "Assessments | Admin" };

export default async function AdminAssessmentsPage() {
  await requireAdmin();
  const data = await getAssessmentsConsole();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Assessments"
        description="Recruiter-built assessments across the platform. Creating and assigning stays on the recruiter workspace."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total assessments"
          value={data.total}
          accent="blue"
          icon={<ClipboardList className="h-4 w-4" />}
        />
        <StatCard
          label="Published"
          value={data.published}
          accent="green"
          icon={<FileText className="h-4 w-4" />}
        />
        <StatCard
          label="Drafts"
          value={data.drafts}
          accent="orange"
          icon={<Pencil className="h-4 w-4" />}
        />
      </div>

      <section className="overflow-x-auto rounded-xl border border-[#E9E9E9] bg-white">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-[#E9E9E9] text-xs uppercase tracking-[0.06em] text-[#8F8F8F]">
            <tr>
              <th className="px-5 py-3 font-medium">Assessment</th>
              <th className="px-5 py-3 font-medium">Created by</th>
              <th className="px-5 py-3 font-medium">Questions</th>
              <th className="px-5 py-3 font-medium">Assigned</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-[#787878]">
                  No recruiter assessments yet.
                </td>
              </tr>
            ) : (
              data.rows.map((row) => (
                <tr key={row.id} className="border-b border-[#E9E9E9] last:border-0">
                  <td className="px-5 py-3 font-medium text-[#353535]">{row.title}</td>
                  <td className="px-5 py-3 text-[#787878]">
                    {row.createdBy.name || row.createdBy.email}
                  </td>
                  <td className="px-5 py-3">{row._count.questions}</td>
                  <td className="px-5 py-3">{row._count.assignments}</td>
                  <td className="px-5 py-3">
                    <span
                      className={
                        row.status === "PUBLISHED"
                          ? "rounded-full bg-[#18D39B]/10 px-2 py-0.5 text-xs font-medium text-[#197E23]"
                          : row.status === "DRAFT"
                            ? "rounded-full bg-[#E7F2F3] px-2 py-0.5 text-xs font-medium text-[#03535F]"
                            : "rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                      }
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[#787878]">
                    {formatDateIST(row.updatedAt)}
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
