import type { DataRightsRequestStatus } from "@prisma/client";
import Link from "next/link";
import { DataRequestsTable } from "@/components/admin/data-requests-table";
import { getDataRightsRequests } from "@/features/legal/get-data-rights-requests";
import { cn } from "@/lib/utils";

const FILTERS = ["PENDING", "DONE", "REJECTED", "ALL"] as const;

function parseStatus(value: string | undefined): DataRightsRequestStatus | "ALL" {
  if (value === "DONE" || value === "REJECTED" || value === "ALL") return value;
  return "PENDING";
}

export default async function AdminDataRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const status = parseStatus(sp.status);
  const rows = await getDataRightsRequests({ status });

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">
          Data rights requests
        </h1>
        <p className="text-sm text-muted-foreground">
          DPDP access, correction, erasure and nomination requests submitted at{" "}
          <Link href="/privacy/requests" className="underline underline-offset-4">
            /privacy/requests
          </Link>
          . Acknowledge within 24 hours; the Privacy Policy commits to a response
          within 30 days.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Filter by status">
        {FILTERS.map((filter) => (
          <Link
            key={filter}
            href={`/admin/data-requests?status=${filter}`}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              status === filter
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {filter}
          </Link>
        ))}
      </nav>

      <DataRequestsTable rows={rows} />
    </div>
  );
}
