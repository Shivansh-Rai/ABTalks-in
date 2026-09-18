"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

/**
 * Same pattern as `analytics-dashboard-loader.tsx`: recharts measures the DOM,
 * so the section is dynamically imported client-only.
 */
const TrafficAnalyticsSection = dynamic(
  () =>
    import("@/components/admin/traffic-analytics-section").then(
      (m) => m.TrafficAnalyticsSection,
    ),
  {
    ssr: false,
    loading: () => (
      <p className="text-sm text-muted-foreground">Loading traffic charts…</p>
    ),
  },
);

type Props = ComponentProps<typeof TrafficAnalyticsSection>;

export function TrafficAnalyticsLoader(props: Props) {
  return <TrafficAnalyticsSection {...props} />;
}
