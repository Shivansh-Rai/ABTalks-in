import Link from "next/link";
import { Suspense } from "react";
import { AdminActionsFilters } from "@/components/admin/admin-actions-filters";
import { AdminActionsPagination } from "@/components/admin/admin-actions-pagination";
import {
  getAdminActionActors,
  getAdminActionsFeed,
  parseAdminActionFilterType,
} from "@/features/admin/get-admin-actions-feed";
import { formatDateTimeIST } from "@/lib/date-utils";

export default async function AdminActionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; type?: string; admin?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const type = parseAdminActionFilterType(sp.type);
  const adminUserId = sp.admin?.trim() || null;

  const [data, admins] = await Promise.all([
    getAdminActionsFeed({ page, type, adminUserId }),
    getAdminActionActors(),
  ]);

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">
          Admin Actions
        </h1>
        <p className="text-sm text-muted-foreground">
          All admin actions across students, newest first
        </p>
      </div>

      <Suspense fallback={null}>
        <AdminActionsFilters admins={admins} />
      </Suspense>

      {data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No admin actions found</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <div className="divide-y">
            {data.items.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-3 px-3 py-1.5 text-sm"
              >
                <span className="w-[8.5rem] shrink-0 truncate font-medium">
                  {row.adminName}
                </span>
                <span className="w-[9.5rem] shrink-0 truncate text-muted-foreground">
                  {row.actionLabel}
                </span>
                <Link
                  href={`/admin/students/${row.targetUserId}`}
                  className="w-[8.5rem] shrink-0 truncate text-primary hover:underline"
                >
                  {row.targetName}
                </Link>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {row.reason?.trim() || "-"}
                </span>
                <span className="w-[9.5rem] shrink-0 text-right text-xs text-muted-foreground">
                  {formatDateTimeIST(row.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <AdminActionsPagination
        page={data.page}
        totalPages={data.totalPages}
        total={data.total}
        type={data.type}
        adminUserId={data.adminUserId}
      />
    </div>
  );
}
