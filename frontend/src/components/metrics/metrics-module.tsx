import type { ReactElement } from "react";
import { useCpuMetrics, useOomEvents } from "../../hooks/use-metrics";
import { useProjectScope } from "../../hooks/use-project-scope";
import { CpuMemoryTable } from "./cpu-memory-table";
import { OomEventList } from "./oom-event-list";

export function MetricsModule(): ReactElement {
  const { project, environments, region } = useProjectScope();
  const view = project ? "project" : "platform";
  const env = environments[0] ?? "DEV";
  const regionStr = region === "both" ? "eastus" : region;
  const namespace = project ?? undefined;

  const cpuQuery = useCpuMetrics(
    env,
    regionStr,
    view === "project" ? namespace : undefined,
  );
  const oomQuery = useOomEvents(
    view === "project" ? namespace : undefined,
  );

  const isLoading = cpuQuery.isLoading || oomQuery.isLoading;
  const isError = cpuQuery.isError || oomQuery.isError;

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center py-12"
        aria-live="polite"
      >
        <p className="text-gray-500">Loading metrics...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-red-700" role="alert">
        Failed to load metrics data. Please try again.
      </div>
    );
  }

  return (
    <section aria-label="Metrics">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        {view === "platform" ? "Platform Metrics" : "Project Metrics"}
      </h2>

      <CpuMemoryTable metrics={cpuQuery.data ?? []} view={view} />

      {view === "project" && (
        <div className="mt-6">
          <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-3">
            OOM Events
          </h3>
          <OomEventList events={oomQuery.data ?? []} />
        </div>
      )}
    </section>
  );
}

export default MetricsModule;
