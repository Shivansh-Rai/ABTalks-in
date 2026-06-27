"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";

type AdminSparklineProps = {
  data: number[];
  positive?: boolean;
};

export function AdminSparkline({ data, positive = true }: AdminSparklineProps) {
  if (!data || data.length < 2) return null;

  const chartData = data.map((value, index) => ({ index, value }));
  const strokeColor = positive ? "hsl(160 84% 39%)" : "hsl(0 91% 71%)";
  const fillColor = positive ? "hsl(160 84% 39% / 0.15)" : "hsl(0 91% 71% / 0.15)";

  return (
    <div className="h-10 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
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
      </ResponsiveContainer>
    </div>
  );
}
