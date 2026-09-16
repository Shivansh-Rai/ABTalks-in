"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

/**
 * Same loader shape as `components/admin/analytics-dashboard-loader.tsx`:
 * recharts measures the DOM, so it is client-only and must not be
 * server-rendered.
 */
const RecruiterAnalyticsCharts = dynamic(
  () =>
    import("@/components/hire/recruiter-analytics-charts").then(
      (m) => m.RecruiterAnalyticsCharts,
    ),
  {
    ssr: false,
    loading: () => (
      <p className="text-sm text-muted-foreground">Loading charts…</p>
    ),
  },
);

type Props = ComponentProps<typeof RecruiterAnalyticsCharts>;

export function RecruiterAnalyticsLoader(props: Props) {
  return <RecruiterAnalyticsCharts {...props} />;
}
