"use client";

import { Area, AreaChart } from "recharts";

type AdminSparklineProps = {
  data: number[];
  positive?: boolean;
};

// Fixed size matches the container (w-24 = 96px, h-10 = 40px). Rendering at a
// fixed size avoids Recharts' ResponsiveContainer reporting -1×-1 on first
// paint / during navigation (a noisy dev warning).
const WIDTH = 96;
const HEIGHT = 40;

export function AdminSparkline({ data, positive = true }: AdminSparklineProps) {
  if (!data || data.length < 2) return null;

  const chartData = data.map((value, index) => ({ index, value }));
  const strokeColor = positive ? "hsl(160 84% 39%)" : "hsl(0 91% 71%)";
  const fillColor = positive ? "hsl(160 84% 39% / 0.15)" : "hsl(0 91% 71% / 0.15)";

  return (
    <AreaChart
      width={WIDTH}
      height={HEIGHT}
      data={chartData}
      margin={{ top: 2, right: 0, left: 0, bottom: 2 }}
    >
      <Area
        type="monotone"
        dataKey="value"
        stroke={strokeColor}
        fill={fillColor}
        strokeWidth={1.5}
        dot={false}
        isAnimationActive={false}
      />
    </AreaChart>
  );
}
