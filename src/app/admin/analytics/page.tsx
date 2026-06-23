import { AnalyticsDashboardLoader } from "@/components/admin/analytics-dashboard-loader";
import { AnalyticsRangeFilter } from "@/components/admin/analytics-range-filter";
import { DropoffStudentsView } from "@/components/admin/dropoff-students-view";
import {
  getAnalyticsData,
  type TimeRange,
} from "@/features/admin/get-analytics-data";
import { getDropoffStudents } from "@/features/admin/get-dropoff-by-day";
import { Domain } from "@prisma/client";

function parseRange(input: string | undefined): TimeRange {
  if (input === "weekly" || input === "monthly" || input === "daily") {
    return input;
  }
  return "daily";
}

function parseDomain(input: string | undefined): Domain | "ALL" {
  if (input === "SE" || input === "DS" || input === "AI" || input === "CLAUDE") {
    return input;
  }
  return "ALL";
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; dropoff_domain?: string }>;
}) {
  const params = await searchParams;
  const range = parseRange(params.range);
  const dropoffDomain = parseDomain(params.dropoff_domain);

  const [data, dropoffRows] = await Promise.all([
    getAnalyticsData(range),
    getDropoffStudents({ domain: dropoffDomain }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">Analytics</h1>
        <p className="text-muted-foreground">
          Registration, engagement, drop-off, and performance metrics.
        </p>
      </div>
      <AnalyticsRangeFilter value={range} />
      <AnalyticsDashboardLoader data={data} />

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-xl font-semibold">
            Drop-off students (day-wise)
          </h2>
          <p className="text-sm text-muted-foreground">
            ACTIVE students who are at least 3 days behind, plus all
            ABANDONED enrollments. Sorted by last submitted day (earliest
            droppers first).
          </p>
        </div>
        <DropoffStudentsView rows={dropoffRows} domain={dropoffDomain} />
      </section>
    </div>
  );
}
