import type { ReactElement } from "react";
import type { CpuMemoryMetric } from "../../mocks/data/types";
import { SparklineChart } from "./sparkline-chart";
import { QuotaBar } from "./quota-bar";

interface CpuMemoryTableProps {
  readonly metrics: readonly CpuMemoryMetric[];
  readonly view: "platform" | "project";
}

export function CpuMemoryTable({
  metrics,
  view,
}: CpuMemoryTableProps): ReactElement {
  if (metrics.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-4">No metrics data available.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table
        className="min-w-full divide-y divide-gray-200 dark:divide-gray-700"
        aria-label={
          view === "platform"
            ? "Namespace CPU and memory metrics"
            : "Workload CPU and memory metrics"
        }
      >
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              {view === "platform" ? "Namespace" : "Workload"}
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              CPU Usage
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              CPU Req/Limit
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              Memory Usage
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              Memory Req/Limit
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              Sparkline
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
          {metrics.map((m) => {
            const rowName =
              view === "project" && m.workload
                ? `${m.workload} (${m.workloadType ?? "unknown"})`
                : m.namespace;
            const cpuPct =
              m.cpuLimit > 0
                ? Math.round((m.cpuUsage / m.cpuLimit) * 100)
                : 0;
            const memPct =
              m.memoryLimitMi > 0
                ? Math.round((m.memoryUsageMi / m.memoryLimitMi) * 100)
                : 0;

            return (
              <tr key={`${m.namespace}-${m.workload ?? "ns"}`}>
                <td className="px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                  {rowName}
                </td>
                <td className="px-3 py-2">
                  <QuotaBar
                    used={m.cpuUsage}
                    limit={m.cpuLimit}
                    unit="cores"
                  />
                </td>
                <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {m.cpuRequest.toFixed(2)} / {m.cpuLimit.toFixed(2)}
                </td>
                <td className="px-3 py-2">
                  <QuotaBar
                    used={m.memoryUsageMi}
                    limit={m.memoryLimitMi}
                    unit="Mi"
                  />
                </td>
                <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {Math.round(m.memoryRequestMi)}Mi /{" "}
                  {Math.round(m.memoryLimitMi)}Mi
                </td>
                <td className="px-3 py-2">
                  <SparklineChart
                    data={m.sparkline}
                    metricName={`CPU for ${rowName}`}
                    color={cpuPct > 90 ? "#ef4444" : memPct > 90 ? "#f59e0b" : "#3b82f6"}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
