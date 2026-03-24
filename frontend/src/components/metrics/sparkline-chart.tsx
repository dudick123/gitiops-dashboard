import type { ReactElement } from "react";
import { LineChart, Line, ResponsiveContainer } from "recharts";

interface SparklineChartProps {
  readonly data: readonly number[];
  readonly metricName: string;
  readonly color?: string;
}

/**
 * Determines trend direction by comparing the average of the first 3 data
 * points against the average of the last 3 data points.
 */
function determineTrend(
  data: readonly number[],
): "up" | "down" | "stable" {
  if (data.length < 6) return "stable";
  const first3Avg = ((data[0] ?? 0) + (data[1] ?? 0) + (data[2] ?? 0)) / 3;
  const last3Avg =
    ((data[data.length - 3] ?? 0) + (data[data.length - 2] ?? 0) + (data[data.length - 1] ?? 0)) /
    3;
  const diff = last3Avg - first3Avg;
  const threshold = first3Avg * 0.05; // 5% change threshold
  if (diff > threshold) return "up";
  if (diff < -threshold) return "down";
  return "stable";
}

function buildAriaLabel(
  metricName: string,
  data: readonly number[],
  trend: "up" | "down" | "stable",
): string {
  const current = data.length > 0 ? Math.round(data[data.length - 1] ?? 0) : 0;
  const trendLabel =
    trend === "up"
      ? "trending up"
      : trend === "down"
        ? "trending down"
        : "stable";
  return `${metricName} ${trendLabel}, currently ${current}%`;
}

export function SparklineChart({
  data,
  metricName,
  color = "#3b82f6",
}: SparklineChartProps): ReactElement {
  const trend = determineTrend(data);
  const chartData = data.map((value, index) => ({ index, value }));

  return (
    <div
      className="h-8 w-24"
      role="img"
      aria-label={buildAriaLabel(metricName, data, trend)}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
