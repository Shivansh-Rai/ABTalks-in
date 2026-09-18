import { AnalyticsDashboardLoader } from "@/components/admin/analytics-dashboard-loader";
import { AnalyticsRangeFilter } from "@/components/admin/analytics-range-filter";
import { DropoffStudentsView } from "@/components/admin/dropoff-students-view";
import { TrafficAnalyticsLoader } from "@/components/admin/traffic-analytics-loader";
import {
  TrafficRangeFilter,
  type GaRangeKey,
} from "@/components/admin/traffic-range-filter";
import {
  getAnalyticsData,
  type TimeRange,
} from "@/features/admin/get-analytics-data";
import { getDropoffStudents } from "@/features/admin/get-dropoff-by-day";
import { getAdminGaTraffic } from "@/features/admin/get-ga-traffic";
import { getUsersByCountry } from "@/repositories/ga-analytics";
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

function parseGaRange(input: string | undefined): GaRangeKey {
  if (input === "7d" || input === "30d" || input === "90d" || input === "365d") {
    return input;
  }
  return "30d";
}

function daysFor(key: GaRangeKey): number {
  return key === "7d" ? 7 : key === "30d" ? 30 : key === "90d" ? 90 : 365;
}

function toYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function gaWindows(key: GaRangeKey): {
  current: { start: string; end: string };
  previous: { start: string; end: string };
} {
  const days = daysFor(key);
  const end = new Date();
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - days + 1);
  const prevEnd = new Date(start);
  prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setUTCDate(prevStart.getUTCDate() - days + 1);
  return {
    current: { start: toYmd(start), end: toYmd(end) },
    previous: { start: toYmd(prevStart), end: toYmd(prevEnd) },
  };
}

function normDevice(input: string | undefined): string {
  if (input === "mobile" || input === "desktop" || input === "tablet") {
    return input;
  }
  return "all";
}

function normCountry(input: string | undefined): string {
  if (!input || input === "all") return "all";
  // Allow anything short and reasonable — GA `country` is a display name like
  // "India" or "United States", not a two-letter code.
  return input.length > 64 ? "all" : input;
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    dropoff_domain?: string;
    ga_range?: string;
    ga_device?: string;
    ga_country?: string;
  }>;
}) {
  const params = await searchParams;
  const range = parseRange(params.range);
  const dropoffDomain = parseDomain(params.dropoff_domain);
  const gaRangeKey = parseGaRange(params.ga_range);
  const device = normDevice(params.ga_device);
  const country = normCountry(params.ga_country);
  const { current, previous } = gaWindows(gaRangeKey);

  const gaFilters =
    device !== "all" || country !== "all"
      ? {
          ...(device !== "all" ? { deviceCategory: device } : {}),
          ...(country !== "all" ? { country } : {}),
        }
      : undefined;

  // Pull the top countries once with NO country filter so the dropdown always
  // shows every real option, even after the user has drilled into one.
  const [data, dropoffRows, gaTraffic, countryPool] = await Promise.all([
    getAnalyticsData(range),
    getDropoffStudents({ domain: dropoffDomain }),
    getAdminGaTraffic({ ...current, previous, filters: gaFilters }),
    getUsersByCountry({ ...current, limit: 20 }),
  ]);

  const countryOptions = countryPool.ok
    ? countryPool.data.map((row) => row.country).filter((c) => c && c !== "(not set)")
    : [];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">Analytics</h1>
        <p className="text-muted-foreground">
          Registration, engagement, drop-off, performance and traffic metrics.
        </p>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-xl font-semibold">
            Platform engagement
          </h2>
          <p className="text-sm text-muted-foreground">
            Registrations, submissions, domain distribution and submission hours
            for the ABTalks platform.
          </p>
        </div>
        <AnalyticsRangeFilter value={range} />
        <AnalyticsDashboardLoader data={data} />
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">
              Traffic &amp; audience (Google Analytics)
            </h2>
            <p className="text-sm text-muted-foreground">
              Live GA4 data. Every chart respects the filters below. Deltas
              on the KPI tiles compare this window to the previous one of the
              same length.
            </p>
          </div>
        </div>
        <TrafficRangeFilter
          value={gaRangeKey}
          device={device}
          country={country}
          countryOptions={countryOptions}
        />
        <TrafficAnalyticsLoader data={gaTraffic.data} />
      </section>

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
