import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { listTalentProjectsForAdmin } from "@/features/admin/inspect-talent-project";

export const metadata: Metadata = { title: "Talent projects | ABTalks Admin" };

function formatWhen(d: Date): string {
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Every recruiter's talent projects, read-only (T-278 / TC-A-016).
 *
 * The entry point to the inspection view. T-263 (global admin search) will
 * eventually reach the same detail route; until it lands this list is how
 * support finds a project.
 *
 * Server Component, no server action, no mutating control.
 */
export default async function AdminTalentProjectsPage() {
  await requireAdmin();
  const projects = await listTalentProjectsForAdmin();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Talent projects</h1>
        <p className="text-sm text-muted-foreground">
          Every recruiter&apos;s projects, newest first. Opening one is
          read-only — it changes nothing and does not mark anything as viewed.
        </p>
      </header>

      {projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">No talent projects yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Project</th>
                <th className="px-3 py-2 font-medium">Owner</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Matches</th>
                <th className="px-3 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/hire/projects/${p.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {p.label}
                    </Link>
                    {p.archivedAt ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        archived
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {p.owner.name ?? p.owner.email ?? "—"}
                  </td>
                  <td className="px-3 py-2">{p.status}</td>
                  <td className="px-3 py-2 tabular-nums">{p.matchCount}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {formatWhen(p.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
