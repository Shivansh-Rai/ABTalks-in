import "server-only";

import { unstable_cache } from "next/cache";
import { z } from "zod";
import { getGaDataClient } from "@/lib/analytics/ga-data-client";
import { logger } from "@/lib/logger";

/**
 * Minimal row shape from the GA4 Data API. Matches the `IRow` type but written
 * out here so this file does not depend on a type-only import from
 * `@google-analytics/data` — the client wrapper is where the runtime types
 * come from.
 */
type GaRow = {
  dimensionValues?: Array<{ value?: string | null }> | null;
  metricValues?: Array<{ value?: string | null }> | null;
};

/**
 * Plan 151. Read-only repository over the GA4 Data API.
 *
 * Every function:
 *   - Zod-parses its input.
 *   - Returns `{ ok, data } | { ok, message }`.
 *   - Wraps `runReport` in `unstable_cache` (5 min TTL) — GA has strict quotas,
 *     and the recruiter analytics page is a Server Component, so every
 *     refresh would otherwise burn a call.
 *   - Falls back to `ok: false` with a bounded message when the GA client is
 *     not configured; the surface renders the "unavailable" tab.
 */

const CACHE_TTL_SECONDS = 300;

/**
 * Plan 151. Dimension-level filters. When set, every report scopes to sessions
 * where the dimension matches — so a Traffic-tab view can be re-cut by device
 * or country without changing what the KPI tiles show.
 *
 * The values are echoed into the cache key, so distinct filter combinations
 * cache separately and don't stomp on each other.
 */
const FiltersSchema = z.object({
  deviceCategory: z.string().min(1).max(32).optional(),
  country: z.string().min(1).max(64).optional(),
});
export type GaFilters = z.infer<typeof FiltersSchema>;

const RangeSchema = z.object({
  start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "start must be YYYY-MM-DD"),
  end: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "end must be YYYY-MM-DD"),
  filters: FiltersSchema.optional(),
});

const TopSourcesInput = RangeSchema.extend({
  limit: z.number().int().min(1).max(20).default(6),
});

const TopPagesInput = RangeSchema.extend({
  limit: z.number().int().min(1).max(20).default(8),
});

const EventCountsInput = RangeSchema.extend({
  events: z.array(z.string().min(1)).min(1).max(12),
});

/** Stable string form for cache keys — never JSON.stringify the whole input. */
function filterKey(f: GaFilters | undefined): string {
  if (!f) return "none";
  return `d=${f.deviceCategory ?? "*"}|c=${f.country ?? "*"}`;
}

/** Build a GA4 `dimensionFilter` from `GaFilters`; returns undefined if empty. */
function buildDimensionFilter(f: GaFilters | undefined) {
  if (!f) return undefined;
  const clauses: Array<{
    filter: {
      fieldName: string;
      stringFilter: { matchType: "EXACT"; value: string };
    };
  }> = [];
  if (f.deviceCategory) {
    clauses.push({
      filter: {
        fieldName: "deviceCategory",
        stringFilter: { matchType: "EXACT" as const, value: f.deviceCategory },
      },
    });
  }
  if (f.country) {
    clauses.push({
      filter: {
        fieldName: "country",
        stringFilter: { matchType: "EXACT" as const, value: f.country },
      },
    });
  }
  if (clauses.length === 0) return undefined;
  if (clauses.length === 1) return clauses[0];
  return { andGroup: { expressions: clauses } };
}

export type SessionsTrendPoint = { date: string; sessions: number; newUsers: number };
export type TopSource = { source: string; sessions: number };
export type TopPage = {
  pagePath: string;
  pageviews: number;
  avgEngagementTime?: number;
};
export type EventCountMap = Record<string, number>;
export type CountryRow = { country: string; sessions: number; users: number };
export type CityRow = { city: string; sessions: number };
export type DeviceRow = { device: string; sessions: number };
export type BrowserRow = { browser: string; sessions: number };
export type LanguageRow = { language: string; sessions: number };
export type ChannelRow = { channel: string; sessions: number };
export type AudienceSummary = {
  totalUsers: number;
  newUsers: number;
  activeUsers: number;
  sessions: number;
  engagedSessions: number;
  screenPageViews: number;
  averageSessionDurationSec: number;
  engagementRate: number;
  bounceRate: number;
};

type Envelope<T> = { ok: true; data: T } | { ok: false; message: string };

function unavailable<T>(message: string): Envelope<T> {
  return { ok: false, message };
}

/** `YYYYMMDD` → `YYYY-MM-DD`. GA returns the compact form. */
function isoDate(gaDate: string): string {
  if (gaDate.length !== 8) return gaDate;
  return `${gaDate.slice(0, 4)}-${gaDate.slice(4, 6)}-${gaDate.slice(6, 8)}`;
}

async function runReportOrNull<T>(
  cacheKey: string,
  fn: () => Promise<T>,
): Promise<Envelope<T>> {
  try {
    const value = await unstable_cache(fn, [cacheKey], {
      revalidate: CACHE_TTL_SECONDS,
      tags: ["ga-analytics"],
    })();
    return { ok: true, data: value };
  } catch (error) {
    logger.warn(
      {
        err: error instanceof Error ? error.message : String(error),
        cacheKey,
      },
      "[ga-analytics] runReport failed",
    );
    return { ok: false, message: "GA_DATA_API_REPORT_FAILED" };
  }
}

// ── Sessions trend ───────────────────────────────────────────────────────────

export async function getSessionsTrend(
  input: z.input<typeof RangeSchema>,
): Promise<Envelope<SessionsTrendPoint[]>> {
  const parsed = RangeSchema.safeParse(input);
  if (!parsed.success) return unavailable(parsed.error.issues[0]?.message ?? "invalid range");
  const clientResult = getGaDataClient();
  if (!clientResult.ok) return unavailable(clientResult.message);
  const { client, propertyId } = clientResult;
  const { start, end, filters } = parsed.data;
  const dimensionFilter = buildDimensionFilter(filters);

  return runReportOrNull(`sessions-trend:${propertyId}:${start}:${end}:${filterKey(filters)}`, async () => {
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: start, endDate: end }],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "sessions" }, { name: "newUsers" }],
      orderBys: [{ dimension: { dimensionName: "date" } }],
      ...(dimensionFilter ? { dimensionFilter } : {}),
    });
    return (response.rows ?? []).map<SessionsTrendPoint>((row: GaRow) => ({
      date: isoDate(row.dimensionValues?.[0]?.value ?? ""),
      sessions: Number(row.metricValues?.[0]?.value ?? 0),
      newUsers: Number(row.metricValues?.[1]?.value ?? 0),
    }));
  });
}

// ── Top acquisition sources ──────────────────────────────────────────────────

export async function getTopSources(
  input: z.input<typeof TopSourcesInput>,
): Promise<Envelope<TopSource[]>> {
  const parsed = TopSourcesInput.safeParse(input);
  if (!parsed.success) return unavailable(parsed.error.issues[0]?.message ?? "invalid range");
  const clientResult = getGaDataClient();
  if (!clientResult.ok) return unavailable(clientResult.message);
  const { client, propertyId } = clientResult;
  const { start, end, limit, filters } = parsed.data;
  const dimensionFilter = buildDimensionFilter(filters);

  return runReportOrNull(`top-sources:${propertyId}:${start}:${end}:${limit}:${filterKey(filters)}`, async () => {
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: start, endDate: end }],
      dimensions: [{ name: "sessionSource" }],
      metrics: [{ name: "sessions" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: String(limit),
      ...(dimensionFilter ? { dimensionFilter } : {}),
    });
    return (response.rows ?? []).map<TopSource>((row: GaRow) => ({
      source: row.dimensionValues?.[0]?.value || "(direct)",
      sessions: Number(row.metricValues?.[0]?.value ?? 0),
    }));
  });
}

// ── Top hire/jobs pages ──────────────────────────────────────────────────────

export async function getTopHirePages(
  input: z.input<typeof TopPagesInput>,
): Promise<Envelope<TopPage[]>> {
  const parsed = TopPagesInput.safeParse(input);
  if (!parsed.success) return unavailable(parsed.error.issues[0]?.message ?? "invalid range");
  const clientResult = getGaDataClient();
  if (!clientResult.ok) return unavailable(clientResult.message);
  const { client, propertyId } = clientResult;
  const { start, end, limit } = parsed.data;

  return runReportOrNull(`top-hire-pages:${propertyId}:${start}:${end}:${limit}`, async () => {
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: start, endDate: end }],
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }],
      dimensionFilter: {
        orGroup: {
          expressions: [
            {
              filter: {
                fieldName: "pagePath",
                stringFilter: { matchType: "BEGINS_WITH", value: "/hire" },
              },
            },
            {
              filter: {
                fieldName: "pagePath",
                stringFilter: { matchType: "BEGINS_WITH", value: "/jobs" },
              },
            },
            {
              filter: {
                fieldName: "pagePath",
                stringFilter: { matchType: "BEGINS_WITH", value: "/talent" },
              },
            },
          ],
        },
      },
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: String(limit),
    });
    return (response.rows ?? []).map<TopPage>((row: GaRow) => ({
      pagePath: row.dimensionValues?.[0]?.value || "/",
      pageviews: Number(row.metricValues?.[0]?.value ?? 0),
    }));
  });
}

// ── Audience summary ─────────────────────────────────────────────────────────

export async function getAudienceSummary(
  input: z.input<typeof RangeSchema>,
): Promise<Envelope<AudienceSummary>> {
  const parsed = RangeSchema.safeParse(input);
  if (!parsed.success) return unavailable(parsed.error.issues[0]?.message ?? "invalid range");
  const clientResult = getGaDataClient();
  if (!clientResult.ok) return unavailable(clientResult.message);
  const { client, propertyId } = clientResult;
  const { start, end, filters } = parsed.data;
  const dimensionFilter = buildDimensionFilter(filters);

  return runReportOrNull(`audience-summary:${propertyId}:${start}:${end}:${filterKey(filters)}`, async () => {
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: start, endDate: end }],
      metrics: [
        { name: "totalUsers" },
        { name: "newUsers" },
        { name: "activeUsers" },
        { name: "sessions" },
        { name: "engagedSessions" },
        { name: "screenPageViews" },
        { name: "averageSessionDuration" },
        { name: "engagementRate" },
        { name: "bounceRate" },
      ],
      ...(dimensionFilter ? { dimensionFilter } : {}),
    });
    const row = (response.rows ?? [])[0] as GaRow | undefined;
    const m = (i: number) => Number(row?.metricValues?.[i]?.value ?? 0);
    return {
      totalUsers: m(0),
      newUsers: m(1),
      activeUsers: m(2),
      sessions: m(3),
      engagedSessions: m(4),
      screenPageViews: m(5),
      averageSessionDurationSec: m(6),
      engagementRate: m(7),
      bounceRate: m(8),
    };
  });
}

// ── Demographics: country ────────────────────────────────────────────────────

export async function getUsersByCountry(
  input: z.input<typeof TopSourcesInput>,
): Promise<Envelope<CountryRow[]>> {
  const parsed = TopSourcesInput.safeParse(input);
  if (!parsed.success) return unavailable(parsed.error.issues[0]?.message ?? "invalid range");
  const clientResult = getGaDataClient();
  if (!clientResult.ok) return unavailable(clientResult.message);
  const { client, propertyId } = clientResult;
  const { start, end, limit, filters } = parsed.data;
  const dimensionFilter = buildDimensionFilter(filters);

  return runReportOrNull(`users-country:${propertyId}:${start}:${end}:${limit}:${filterKey(filters)}`, async () => {
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: start, endDate: end }],
      dimensions: [{ name: "country" }],
      metrics: [{ name: "sessions" }, { name: "totalUsers" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: String(limit),
      ...(dimensionFilter ? { dimensionFilter } : {}),
    });
    return ((response.rows ?? []) as GaRow[]).map<CountryRow>((row) => ({
      country: row.dimensionValues?.[0]?.value || "Unknown",
      sessions: Number(row.metricValues?.[0]?.value ?? 0),
      users: Number(row.metricValues?.[1]?.value ?? 0),
    }));
  });
}

// ── Demographics: city ───────────────────────────────────────────────────────

export async function getUsersByCity(
  input: z.input<typeof TopSourcesInput>,
): Promise<Envelope<CityRow[]>> {
  const parsed = TopSourcesInput.safeParse(input);
  if (!parsed.success) return unavailable(parsed.error.issues[0]?.message ?? "invalid range");
  const clientResult = getGaDataClient();
  if (!clientResult.ok) return unavailable(clientResult.message);
  const { client, propertyId } = clientResult;
  const { start, end, limit, filters } = parsed.data;
  const dimensionFilter = buildDimensionFilter(filters);

  return runReportOrNull(`users-city:${propertyId}:${start}:${end}:${limit}:${filterKey(filters)}`, async () => {
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: start, endDate: end }],
      dimensions: [{ name: "city" }],
      metrics: [{ name: "sessions" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: String(limit),
      ...(dimensionFilter ? { dimensionFilter } : {}),
    });
    return ((response.rows ?? []) as GaRow[]).map<CityRow>((row) => ({
      city: row.dimensionValues?.[0]?.value || "Unknown",
      sessions: Number(row.metricValues?.[0]?.value ?? 0),
    }));
  });
}

// ── Tech: device / browser / language ────────────────────────────────────────

export async function getDeviceBreakdown(
  input: z.input<typeof RangeSchema>,
): Promise<Envelope<DeviceRow[]>> {
  const parsed = RangeSchema.safeParse(input);
  if (!parsed.success) return unavailable(parsed.error.issues[0]?.message ?? "invalid range");
  const clientResult = getGaDataClient();
  if (!clientResult.ok) return unavailable(clientResult.message);
  const { client, propertyId } = clientResult;
  const { start, end, filters } = parsed.data;
  const dimensionFilter = buildDimensionFilter(filters);

  return runReportOrNull(`device:${propertyId}:${start}:${end}:${filterKey(filters)}`, async () => {
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: start, endDate: end }],
      dimensions: [{ name: "deviceCategory" }],
      metrics: [{ name: "sessions" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      ...(dimensionFilter ? { dimensionFilter } : {}),
    });
    return ((response.rows ?? []) as GaRow[]).map<DeviceRow>((row) => ({
      device: row.dimensionValues?.[0]?.value || "unknown",
      sessions: Number(row.metricValues?.[0]?.value ?? 0),
    }));
  });
}

export async function getBrowserBreakdown(
  input: z.input<typeof TopSourcesInput>,
): Promise<Envelope<BrowserRow[]>> {
  const parsed = TopSourcesInput.safeParse(input);
  if (!parsed.success) return unavailable(parsed.error.issues[0]?.message ?? "invalid range");
  const clientResult = getGaDataClient();
  if (!clientResult.ok) return unavailable(clientResult.message);
  const { client, propertyId } = clientResult;
  const { start, end, limit, filters } = parsed.data;
  const dimensionFilter = buildDimensionFilter(filters);

  return runReportOrNull(`browser:${propertyId}:${start}:${end}:${limit}:${filterKey(filters)}`, async () => {
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: start, endDate: end }],
      dimensions: [{ name: "browser" }],
      metrics: [{ name: "sessions" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: String(limit),
      ...(dimensionFilter ? { dimensionFilter } : {}),
    });
    return ((response.rows ?? []) as GaRow[]).map<BrowserRow>((row) => ({
      browser: row.dimensionValues?.[0]?.value || "Unknown",
      sessions: Number(row.metricValues?.[0]?.value ?? 0),
    }));
  });
}

export async function getLanguageBreakdown(
  input: z.input<typeof TopSourcesInput>,
): Promise<Envelope<LanguageRow[]>> {
  const parsed = TopSourcesInput.safeParse(input);
  if (!parsed.success) return unavailable(parsed.error.issues[0]?.message ?? "invalid range");
  const clientResult = getGaDataClient();
  if (!clientResult.ok) return unavailable(clientResult.message);
  const { client, propertyId } = clientResult;
  const { start, end, limit, filters } = parsed.data;
  const dimensionFilter = buildDimensionFilter(filters);

  return runReportOrNull(`language:${propertyId}:${start}:${end}:${limit}:${filterKey(filters)}`, async () => {
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: start, endDate: end }],
      dimensions: [{ name: "language" }],
      metrics: [{ name: "sessions" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: String(limit),
      ...(dimensionFilter ? { dimensionFilter } : {}),
    });
    return ((response.rows ?? []) as GaRow[]).map<LanguageRow>((row) => ({
      language: row.dimensionValues?.[0]?.value || "Unknown",
      sessions: Number(row.metricValues?.[0]?.value ?? 0),
    }));
  });
}

// ── Acquisition: default channel group ───────────────────────────────────────

export async function getAcquisitionChannels(
  input: z.input<typeof TopSourcesInput>,
): Promise<Envelope<ChannelRow[]>> {
  const parsed = TopSourcesInput.safeParse(input);
  if (!parsed.success) return unavailable(parsed.error.issues[0]?.message ?? "invalid range");
  const clientResult = getGaDataClient();
  if (!clientResult.ok) return unavailable(clientResult.message);
  const { client, propertyId } = clientResult;
  const { start, end, limit, filters } = parsed.data;
  const dimensionFilter = buildDimensionFilter(filters);

  return runReportOrNull(`channels:${propertyId}:${start}:${end}:${limit}:${filterKey(filters)}`, async () => {
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: start, endDate: end }],
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: String(limit),
      ...(dimensionFilter ? { dimensionFilter } : {}),
    });
    return ((response.rows ?? []) as GaRow[]).map<ChannelRow>((row) => ({
      channel: row.dimensionValues?.[0]?.value || "Unassigned",
      sessions: Number(row.metricValues?.[0]?.value ?? 0),
    }));
  });
}

// ── Behavior: top pages site-wide (with engagement time) ─────────────────────

export async function getTopPagesSitewide(
  input: z.input<typeof TopPagesInput>,
): Promise<Envelope<TopPage[]>> {
  const parsed = TopPagesInput.safeParse(input);
  if (!parsed.success) return unavailable(parsed.error.issues[0]?.message ?? "invalid range");
  const clientResult = getGaDataClient();
  if (!clientResult.ok) return unavailable(clientResult.message);
  const { client, propertyId } = clientResult;
  const { start, end, limit, filters } = parsed.data;
  const dimensionFilter = buildDimensionFilter(filters);

  return runReportOrNull(`top-pages-all:${propertyId}:${start}:${end}:${limit}:${filterKey(filters)}`, async () => {
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: start, endDate: end }],
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }, { name: "userEngagementDuration" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: String(limit),
      ...(dimensionFilter ? { dimensionFilter } : {}),
    });
    return ((response.rows ?? []) as GaRow[]).map<TopPage>((row) => ({
      pagePath: row.dimensionValues?.[0]?.value || "/",
      pageviews: Number(row.metricValues?.[0]?.value ?? 0),
      avgEngagementTime: Number(row.metricValues?.[1]?.value ?? 0),
    }));
  });
}

// ── Event counts ─────────────────────────────────────────────────────────────

export async function getEventCounts(
  input: z.input<typeof EventCountsInput>,
): Promise<Envelope<EventCountMap>> {
  const parsed = EventCountsInput.safeParse(input);
  if (!parsed.success) return unavailable(parsed.error.issues[0]?.message ?? "invalid range");
  const clientResult = getGaDataClient();
  if (!clientResult.ok) return unavailable(clientResult.message);
  const { client, propertyId } = clientResult;
  const { start, end, events, filters } = parsed.data;
  const scope = buildDimensionFilter(filters);

  const eventNameClause = {
    filter: {
      fieldName: "eventName",
      inListFilter: { values: events },
    },
  };

  const dimensionFilter = scope
    ? { andGroup: { expressions: [eventNameClause, scope] } }
    : eventNameClause;

  const key = `event-counts:${propertyId}:${start}:${end}:${events.join(",")}:${filterKey(filters)}`;
  return runReportOrNull(key, async () => {
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: start, endDate: end }],
      dimensions: [{ name: "eventName" }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter,
    });
    const map: EventCountMap = Object.fromEntries(events.map((e) => [e, 0]));
    for (const row of (response.rows ?? []) as GaRow[]) {
      const name = row.dimensionValues?.[0]?.value;
      const count = Number(row.metricValues?.[0]?.value ?? 0);
      if (name && name in map) map[name] = count;
    }
    return map;
  });
}
