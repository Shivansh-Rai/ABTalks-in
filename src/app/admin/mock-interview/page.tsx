import type { Metadata } from "next";
import { MockInterviewStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-auth";
import { listMockInterviews } from "@/features/admin/mock-interview-admin";
import { MockInterviewTable } from "@/components/admin/mock-interview-table";
import { MockInterviewFilters } from "@/components/admin/mock-interview-filters";

export const metadata: Metadata = {
  title: "Mock interviews | Admin",
};

const VALID_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "ABANDONED",
  "INVALID",
] as const;

function pickStatus(v: string | undefined): MockInterviewStatus | undefined {
  if (!v) return undefined;
  return (VALID_STATUSES as readonly string[]).includes(v)
    ? (v as MockInterviewStatus)
    : undefined;
}

export default async function AdminMockInterviewPage({
  searchParams,
}: {
  searchParams: Promise<{
    userId?: string;
    domain?: string;
    status?: string;
    from?: string;
    to?: string;
  }>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const rows = await listMockInterviews({
    userId: sp.userId?.trim() || undefined,
    domainSlug: sp.domain?.trim() || undefined,
    status: pickStatus(sp.status),
    from: sp.from?.trim() || undefined,
    to: sp.to?.trim() || undefined,
  });

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">
          Mock interviews
        </h1>
        <p className="text-sm text-muted-foreground">
          Moderation surface over MockInterview rows: filter by user, domain,
          status or date, then invalidate, delete or grant an allowance. T-276.
        </p>
      </div>

      <MockInterviewFilters
        initial={{
          userId: sp.userId ?? "",
          domain: sp.domain ?? "",
          status: sp.status ?? "",
          from: sp.from ?? "",
          to: sp.to ?? "",
        }}
      />

      <MockInterviewTable rows={rows} />
    </div>
  );
}
