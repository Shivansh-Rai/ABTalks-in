import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AdminActionFilterType } from "@/features/admin/get-admin-actions-feed";

function hrefForPage(
  page: number,
  type: AdminActionFilterType,
  adminUserId: string | null,
): string {
  const params = new URLSearchParams();
  if (type !== "all") params.set("type", type);
  if (adminUserId) params.set("admin", adminUserId);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/admin/actions?${qs}` : "/admin/actions";
}

export function AdminActionsPagination({
  page,
  totalPages,
  total,
  type,
  adminUserId,
}: {
  page: number;
  totalPages: number;
  total: number;
  type: AdminActionFilterType;
  adminUserId: string | null;
}) {
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages} · {total} action{total === 1 ? "" : "s"}
      </p>
      <div className="flex gap-2">
        {hasPrev ? (
          <Link
            href={hrefForPage(page - 1, type, adminUserId)}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Previous
          </Link>
        ) : (
          <span
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "pointer-events-none opacity-50",
            )}
          >
            Previous
          </span>
        )}
        {hasNext ? (
          <Link
            href={hrefForPage(page + 1, type, adminUserId)}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Next
          </Link>
        ) : (
          <span
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "pointer-events-none opacity-50",
            )}
          >
            Next
          </span>
        )}
      </div>
    </div>
  );
}
