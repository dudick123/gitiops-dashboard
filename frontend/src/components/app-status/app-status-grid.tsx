import { useRef } from "react";
import type { ReactElement } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ApplicationStatus } from "../../mocks/data/types";
import { StatusBadge } from "./status-badge";

interface AppStatusGridProps {
  readonly applications: readonly ApplicationStatus[];
  readonly environments: readonly string[];
  readonly region: "eastus" | "westus" | "both";
}

const ENV_REGION_COLUMNS = [
  { env: "DEV", region: "eastus", label: "DEV-East" },
  { env: "DEV", region: "westus", label: "DEV-West" },
  { env: "STAGE", region: "eastus", label: "STAGE-East" },
  { env: "STAGE", region: "westus", label: "STAGE-West" },
  { env: "PROD", region: "eastus", label: "PROD-East" },
  { env: "PROD", region: "westus", label: "PROD-West" },
] as const;

function getVisibleColumns(
  environments: readonly string[],
  region: "eastus" | "westus" | "both",
): readonly (typeof ENV_REGION_COLUMNS)[number][] {
  return ENV_REGION_COLUMNS.filter(
    (col) =>
      environments.includes(col.env) &&
      (region === "both" || col.region === region),
  );
}

/** Group apps by name so each row shows all env/region statuses for one app */
function groupByAppName(
  apps: readonly ApplicationStatus[],
): ReadonlyMap<string, readonly ApplicationStatus[]> {
  const map = new Map<string, ApplicationStatus[]>();
  for (const app of apps) {
    const existing = map.get(app.name);
    if (existing) {
      existing.push(app);
    } else {
      map.set(app.name, [app]);
    }
  }
  return map;
}

export function AppStatusGrid({
  applications,
  environments,
  region,
}: AppStatusGridProps): ReactElement {
  const parentRef = useRef<HTMLDivElement>(null);
  const columns = getVisibleColumns(environments, region);
  const grouped = groupByAppName(applications);
  const rowNames = [...grouped.keys()];

  const virtualizer = useVirtualizer({
    count: rowNames.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 20,
  });

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      {/* Header */}
      <div
        className="flex items-center border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
        role="row"
      >
        <span className="w-48 shrink-0" role="columnheader">App Name</span>
        {columns.map((col) => (
          <span key={col.label} className="w-32 shrink-0 text-center" role="columnheader">
            {col.label}
          </span>
        ))}
      </div>

      {/* Virtualised rows */}
      <div
        ref={parentRef}
        className="max-h-[600px] overflow-auto"
        role="table"
        aria-label="Application status grid"
      >
        <div
          style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const appName = rowNames[virtualRow.index];
            if (!appName) return null;
            const appInstances = grouped.get(appName) ?? [];

            return (
              <div
                key={virtualRow.key}
                role="row"
                className="absolute left-0 flex w-full items-center border-b border-gray-100 px-3 text-sm dark:border-gray-800"
                style={{
                  top: `${virtualRow.start}px`,
                  height: `${virtualRow.size}px`,
                }}
              >
                <span
                  className="w-48 shrink-0 truncate font-medium text-gray-700 dark:text-gray-300"
                  role="cell"
                  title={appName}
                >
                  {appName}
                </span>
                {columns.map((col) => {
                  const app = appInstances.find(
                    (a) => a.environment === col.env && a.region === col.region,
                  );
                  return (
                    <span key={col.label} className="w-32 shrink-0 text-center" role="cell">
                      {app ? (
                        <StatusBadge status={app.health} />
                      ) : (
                        <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                      )}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
