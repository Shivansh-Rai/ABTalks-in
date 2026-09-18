"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AnalyticsKpiTile } from "@/components/admin/analytics-kpi-tile";
import type { AdminGaTraffic } from "@/features/admin/get-ga-traffic";
import {
  formatCompactNumber,
  formatDuration,
  formatRatioAsPercent,
  shortLanguageTag,
  trimPath,
} from "@/lib/analytics/format";

/**
 * Plan 151 — Traffic section for `/admin/analytics`, upgraded.
 *
 * Highlights over the first cut:
 *   - KPI tiles have period-over-period deltas AND a sparkline (from the
 *     sessions trend) so the reader sees direction, not just a number.
 *   - Numbers use compact notation (`1.2K`, `3.4M`) — a 30-day dashboard is
 *     unreadable in raw digits.
 *   - Every chart has a `<CardDescription>` subtitle that says in plain words
 *     what the chart shows and why to look at it.
 *   - Tables include a share-of-total progress bar so relative importance
 *     reads at a glance.
 *   - A single custom recharts `Tooltip` formats every metric consistently.
 *
 * Rendered under the admin shell; the outer container is Sohail's admin
 * layout at `src/app/admin/layout.tsx`.
 */

const TEAL = "#03535F";
const TEAL_LIGHT = "#18D39B";
const AMBER = "#F59E0B";
const ROSE = "#F43F5E";
const VIOLET = "#8B5CF6";
const SKY = "#0EA5E9";
const SLATE = "#64748B";
const PALETTE = [TEAL, TEAL_LIGHT, AMBER, VIOLET, SKY, ROSE, SLATE];

// ── Custom tooltip ──────────────────────────────────────────────────────────

type TooltipPayload = Array<{
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string;
}>;

function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter = formatCompactNumber,
}: {
  active?: boolean;
  payload?: TooltipPayload;
  label?: string | number;
  valueFormatter?: (v: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-background/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      {label !== undefined && (
        <div className="mb-1 font-semibold text-foreground">{label}</div>
      )}
      <ul className="space-y-0.5">
        {payload.map((p, i) => (
          <li key={i} className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: p.color ?? TEAL }}
            />
            <span className="text-muted-foreground">
              {p.name ?? p.dataKey}
            </span>
            <span className="ml-auto font-semibold text-foreground">
              {typeof p.value === "number" ? valueFormatter(p.value) : "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}

// ── Section root ────────────────────────────────────────────────────────────

export function TrafficAnalyticsSection({ data }: { data: AdminGaTraffic }) {
  if (!data.available) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center">
          <p className="text-sm font-medium">
            Traffic analytics unavailable in this environment.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Reason:{" "}
            <code className="rounded bg-muted px-1">{data.reason}</code>
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            <code className="rounded bg-muted px-1">GA_DATA_API_UNAVAILABLE</code>{" "}
            = one of the three env vars is unset or empty (restart the dev
            server after editing <code>.env.local</code>).{" "}
            <code className="rounded bg-muted px-1">GA_DATA_API_INIT_FAILED</code>{" "}
            = the private key could not be parsed (wrap it in double quotes and
            keep the <code>\n</code>s literal).{" "}
            <code className="rounded bg-muted px-1">GA_DATA_API_REPORT_FAILED</code>{" "}
            = the client is OK but GA rejected the query (usually the service
            account is not a Viewer on the property, or{" "}
            <code>GA_PROPERTY_ID</code> is the wrong number).
          </p>
        </CardContent>
      </Card>
    );
  }

  const s = data.summary;
  const prev = data.previousSummary;
  // A short spark of the last N points from the sessions trend, so every KPI
  // shows the same shape (any KPI-level breakdown series would be a lot more
  // GA quota for little visual gain).
  const sessionsSpark = data.sessionsTrend.map((p) => ({ v: p.sessions }));
  const newUsersSpark = data.sessionsTrend.map((p) => ({ v: p.newUsers }));

  const kpis: Array<
    Parameters<typeof AnalyticsKpiTile>[0] & { key: string }
  > = [
    {
      key: "totalUsers",
      label: "Total users",
      value: formatCompactNumber(s.totalUsers),
      delta: prev ? pctDelta(s.totalUsers, prev.totalUsers) : null,
      hint: "Distinct people who visited",
      sparkline: sessionsSpark,
    },
    {
      key: "newUsers",
      label: "New users",
      value: formatCompactNumber(s.newUsers),
      delta: prev ? pctDelta(s.newUsers, prev.newUsers) : null,
      hint: "First-time visitors",
      sparkline: newUsersSpark,
    },
    {
      key: "activeUsers",
      label: "Active users",
      value: formatCompactNumber(s.activeUsers),
      delta: prev ? pctDelta(s.activeUsers, prev.activeUsers) : null,
      hint: "Any interaction in range",
    },
    {
      key: "sessions",
      label: "Sessions",
      value: formatCompactNumber(s.sessions),
      delta: prev ? pctDelta(s.sessions, prev.sessions) : null,
      hint: "Visit-level count",
      sparkline: sessionsSpark,
    },
    {
      key: "pageviews",
      label: "Pageviews",
      value: formatCompactNumber(s.screenPageViews),
      delta: prev ? pctDelta(s.screenPageViews, prev.screenPageViews) : null,
      hint: "Total pages served",
    },
    {
      key: "avgSession",
      label: "Avg. session",
      value: formatDuration(s.averageSessionDurationSec),
      delta: prev
        ? pctDelta(s.averageSessionDurationSec, prev.averageSessionDurationSec)
        : null,
      hint: "Time on site",
    },
    {
      key: "engagementRate",
      label: "Engagement rate",
      value: formatRatioAsPercent(s.engagementRate),
      delta: prev ? pctDelta(s.engagementRate, prev.engagementRate) : null,
      hint: "Sessions with meaningful interaction",
    },
    {
      key: "bounceRate",
      label: "Bounce rate",
      value: formatRatioAsPercent(s.bounceRate),
      delta: prev ? pctDelta(s.bounceRate, prev.bounceRate) : null,
      invertDelta: true,
      hint: "Sessions that left without engaging",
    },
  ];

  const eventRows = Object.entries(data.eventCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const languages = data.languages.map((l) => ({
    ...l,
    label: shortLanguageTag(l.language),
  }));

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <AnalyticsKpiTile
            key={kpi.key}
            label={kpi.label}
            value={kpi.value}
            delta={kpi.delta}
            invertDelta={kpi.invertDelta}
            hint={kpi.hint}
            sparkline={kpi.sparkline}
          />
        ))}
      </div>

      <Tabs defaultValue="audience" className="w-full">
        <TabsList className="w-full max-w-xl">
          <TabsTrigger value="audience">Audience</TabsTrigger>
          <TabsTrigger value="acquisition">Acquisition</TabsTrigger>
          <TabsTrigger value="demographics">Demographics</TabsTrigger>
          <TabsTrigger value="behavior">Behavior</TabsTrigger>
        </TabsList>

        <TabsContent value="audience" className="mt-4 space-y-4">
          <AudienceTab
            trend={data.sessionsTrend}
            devices={data.devices}
            browsers={data.browsers}
            languages={languages}
            eventRows={eventRows}
          />
        </TabsContent>

        <TabsContent value="acquisition" className="mt-4 space-y-4">
          <AcquisitionTab channels={data.channels} sources={data.sources} />
        </TabsContent>

        <TabsContent value="demographics" className="mt-4 space-y-4">
          <DemographicsTab
            countries={data.countries}
            cities={data.cities}
          />
        </TabsContent>

        <TabsContent value="behavior" className="mt-4 space-y-4">
          <BehaviorTab topPages={data.topPages} eventRows={eventRows} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Audience ────────────────────────────────────────────────────────────────

function AudienceTab({
  trend,
  devices,
  browsers,
  languages,
  eventRows,
}: {
  trend: Array<{ date: string; sessions: number; newUsers: number }>;
  devices: Array<{ device: string; sessions: number }>;
  browsers: Array<{ browser: string; sessions: number }>;
  languages: Array<{ label: string; sessions: number }>;
  eventRows: Array<{ name: string; count: number }>;
}) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Sessions &amp; new users over time</CardTitle>
          <CardDescription>
            Sessions is every visit; new users is first-timers only. A widening
            gap means returning traffic is growing faster than acquisition.
            {" "}
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[320px]">
          {trend.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="sessions-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={TEAL} stopOpacity={0.32} />
                    <stop offset="100%" stopColor={TEAL} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="new-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={AMBER} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={AMBER} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="date"
                  minTickGap={24}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tickFormatter={formatCompactNumber}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="sessions"
                  name="Sessions"
                  stroke={TEAL}
                  strokeWidth={2}
                  fill="url(#sessions-fill)"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="newUsers"
                  name="New users"
                  stroke={AMBER}
                  strokeWidth={2}
                  fill="url(#new-fill)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyMsg>No sessions in this range.</EmptyMsg>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Donut
          title="Device category"
          description="Split of sessions across mobile, desktop and tablet."
          rows={devices.map((d) => ({
            name: d.device || "unknown",
            value: d.sessions,
          }))}
        />
        <Donut
          title="Browser"
          description="Top browsers your visitors use."
          rows={browsers.map((b) => ({ name: b.browser, value: b.sessions }))}
        />
        <Donut
          title="Language"
          description="Preferred browser language, collapsed to the base tag."
          rows={languages.map((l) => ({ name: l.label, value: l.sessions }))}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tracked site events</CardTitle>
          <CardDescription>
            Counts of the T-253 event vocabulary — the same names GA4 receives.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[340px]">
          {eventRows.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={eventRows} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tickFormatter={formatCompactNumber}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={200}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar
                  dataKey="count"
                  name="Events"
                  fill={VIOLET}
                  radius={[0, 6, 6, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyMsg>No tracked events yet.</EmptyMsg>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ── Acquisition ─────────────────────────────────────────────────────────────

function AcquisitionTab({
  channels,
  sources,
}: {
  channels: Array<{ channel: string; sessions: number }>;
  sources: Array<{ source: string; sessions: number }>;
}) {
  const sourceTotal = sources.reduce((s, r) => s + r.sessions, 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Default channel group</CardTitle>
          <CardDescription>
            GA4&apos;s automatic grouping — Organic, Direct, Referral, Social, etc.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          {channels.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channels} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tickFormatter={formatCompactNumber}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="channel"
                  width={140}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar
                  dataKey="sessions"
                  name="Sessions"
                  fill={TEAL}
                  radius={[0, 6, 6, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyMsg>No channel data.</EmptyMsg>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top sources</CardTitle>
          <CardDescription>
            The actual referrer that opened the session. &quot;(direct)&quot; is no
            referrer.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          {sources.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sources}
                  dataKey="sessions"
                  nameKey="source"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={2}
                  isAnimationActive={false}
                >
                  {sources.map((_, index) => (
                    <Cell
                      key={index}
                      fill={PALETTE[index % PALETTE.length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyMsg>No sources yet.</EmptyMsg>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Source detail</CardTitle>
          <CardDescription>
            Every top source with its share of total traffic in the range.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Sessions</TableHead>
                  <TableHead className="w-[45%]">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-muted-foreground"
                    >
                      No data.
                    </TableCell>
                  </TableRow>
                ) : (
                  sources.map((r) => {
                    const share =
                      sourceTotal > 0 ? r.sessions / sourceTotal : 0;
                    return (
                      <TableRow key={r.source}>
                        <TableCell className="font-medium">
                          {r.source}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCompactNumber(r.sessions)}
                        </TableCell>
                        <TableCell>
                          <ProgressBar
                            value={share}
                            label={`${(share * 100).toFixed(1)}%`}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Demographics ────────────────────────────────────────────────────────────

function DemographicsTab({
  countries,
  cities,
}: {
  countries: Array<{ country: string; sessions: number; users: number }>;
  cities: Array<{ city: string; sessions: number }>;
}) {
  const countryUserTotal = countries.reduce((s, r) => s + r.users, 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Users by country</CardTitle>
          <CardDescription>
            Where visitors are coming from. Set the Country filter above to
            drill into one.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[340px]">
          {countries.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={countries} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tickFormatter={formatCompactNumber}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="country"
                  width={140}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar
                  dataKey="users"
                  name="Users"
                  fill={TEAL}
                  radius={[0, 6, 6, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyMsg>No country data.</EmptyMsg>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sessions by city</CardTitle>
          <CardDescription>
            Top cities in the current window (respects filters above).
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[340px]">
          {cities.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cities} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tickFormatter={formatCompactNumber}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="city"
                  width={140}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar
                  dataKey="sessions"
                  name="Sessions"
                  fill={TEAL_LIGHT}
                  radius={[0, 6, 6, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyMsg>No city data.</EmptyMsg>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Countries in detail</CardTitle>
          <CardDescription>
            Users and sessions per country, with each country&apos;s share of total
            users in the range.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Country</TableHead>
                  <TableHead className="text-right">Users</TableHead>
                  <TableHead className="text-right">Sessions</TableHead>
                  <TableHead className="w-[35%]">Share of users</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {countries.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground"
                    >
                      No data.
                    </TableCell>
                  </TableRow>
                ) : (
                  countries.map((c) => {
                    const share =
                      countryUserTotal > 0 ? c.users / countryUserTotal : 0;
                    return (
                      <TableRow key={c.country}>
                        <TableCell className="font-medium">
                          {c.country}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCompactNumber(c.users)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCompactNumber(c.sessions)}
                        </TableCell>
                        <TableCell>
                          <ProgressBar
                            value={share}
                            label={`${(share * 100).toFixed(1)}%`}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Behavior ────────────────────────────────────────────────────────────────

function BehaviorTab({
  topPages,
  eventRows,
}: {
  topPages: Array<{ pagePath: string; pageviews: number; avgEngagementTime?: number }>;
  eventRows: Array<{ name: string; count: number }>;
}) {
  const trimmed = topPages.map((p) => ({ ...p, pagePath: trimPath(p.pagePath) }));
  const pageMax = trimmed.reduce((m, p) => Math.max(m, p.pageviews), 0);
  const eventMax = eventRows.reduce((m, e) => Math.max(m, e.count), 0);

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Top pages by pageviews</CardTitle>
          <CardDescription>
            Where attention is landing. The bar is length-weighted so you can
            see relative volume without reading numbers.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[360px]">
          {trimmed.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trimmed} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tickFormatter={formatCompactNumber}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="pagePath"
                  width={220}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar
                  dataKey="pageviews"
                  name="Pageviews"
                  fill={TEAL}
                  radius={[0, 6, 6, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyMsg>No pageviews yet.</EmptyMsg>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Page detail</CardTitle>
          <CardDescription>
            Path, pageviews and average engagement time per page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Path</TableHead>
                  <TableHead className="text-right">Pageviews</TableHead>
                  <TableHead className="text-right">Engagement</TableHead>
                  <TableHead className="w-[30%]">Volume</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trimmed.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground"
                    >
                      No data.
                    </TableCell>
                  </TableRow>
                ) : (
                  trimmed.map((p) => (
                    <TableRow key={p.pagePath}>
                      <TableCell className="font-mono text-xs">
                        {p.pagePath}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCompactNumber(p.pageviews)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {p.avgEngagementTime
                          ? formatDuration(p.avgEngagementTime)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <ProgressBar
                          value={pageMax > 0 ? p.pageviews / pageMax : 0}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Event volume</CardTitle>
          <CardDescription>
            Counts of every tracked site event in the range.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="w-[35%]">Volume</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-muted-foreground"
                    >
                      No data.
                    </TableCell>
                  </TableRow>
                ) : (
                  eventRows.map((e) => (
                    <TableRow key={e.name}>
                      <TableCell className="font-mono text-xs">
                        {e.name}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCompactNumber(e.count)}
                      </TableCell>
                      <TableCell>
                        <ProgressBar
                          value={eventMax > 0 ? e.count / eventMax : 0}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Shared bits ─────────────────────────────────────────────────────────────

function Donut({
  title,
  description,
  rows,
}: {
  title: string;
  description?: string;
  rows: Array<{ name: string; value: number }>;
}) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="h-[240px]">
        {rows.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={rows}
                dataKey="value"
                nameKey="name"
                innerRadius={45}
                outerRadius={80}
                paddingAngle={2}
                isAnimationActive={false}
              >
                {rows.map((_, index) => (
                  <Cell
                    key={index}
                    fill={PALETTE[index % PALETTE.length]}
                  />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <EmptyMsg>No data.</EmptyMsg>
        )}
      </CardContent>
      {rows.length > 0 && total > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-6 pb-4 text-[11px] text-muted-foreground">
          {rows.slice(0, 5).map((r, i) => (
            <span key={r.name} className="inline-flex items-center gap-1">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
              />
              <span className="text-foreground/80">{r.name}</span>
              <span>{((r.value / total) * 100).toFixed(0)}%</span>
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

function ProgressBar({ value, label }: { value: number; label?: string }) {
  const width = Math.min(100, Math.max(0, value * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-[#03535F]"
          style={{ width: `${width}%` }}
        />
      </div>
      {label && (
        <span className="w-12 text-right text-xs text-muted-foreground">
          {label}
        </span>
      )}
    </div>
  );
}

function EmptyMsg({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
