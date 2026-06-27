import { Suspense } from "react";
import { RedemptionStatus } from "@prisma/client";
import { RedemptionsTable } from "@/components/admin/redemptions-table";
import { getRedemptions } from "@/features/admin/get-redemptions";

const VALID_STATUSES = new Set<string>([
  "ALL",
  "PENDING",
  "SHIPPED",
  "FULFILLED",
  "CANCELLED",
]);

function parseStatus(
  value: string | undefined,
): RedemptionStatus | "ALL" {
  if (!value || !VALID_STATUSES.has(value)) return "ALL";
  if (value === "ALL") return "ALL";
  return value as RedemptionStatus;
}

export default async function AdminRedemptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const status = parseStatus(sp.status);
  const rows = await getRedemptions({ status });

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">
          Redemptions
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage marketplace reward fulfillment and shipping.
        </p>
      </div>

      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <RedemptionsTable rows={rows} status={status} />
      </Suspense>
    </div>
  );
}
